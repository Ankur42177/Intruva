/**
 * Request handling: routing, CORS, auth, rate limiting, validation, engine
 * calls, sanitized errors and privacy-safe structured logs.
 */
import {
  analyzeLocal,
  applyRedactions,
  ENGINE_VERSION,
  optimizeLocal,
  scanPrompt,
  ValidationError,
} from "@intruva/engine";
import { authenticate, originMatches, type Principal } from "./auth";
import { renderDocs } from "./docs";
import type { Ctx, Env } from "./env";
import { ApiError } from "./errors";
import { API_VERSION, buildOpenApi } from "./openapi";
import { enforceRateLimit } from "./ratelimit";
import { parseAnalyze, parseFeedback, parseOptimize, parseScan, readJson } from "./validate";

export const DEFAULT_CORS_ORIGINS = "https://intruva.pages.dev,http://localhost:3001";

type Handler = (ctx: RouteCtx) => Promise<Response> | Response;
interface RouteCtx {
  req: Request;
  env: Env;
  url: URL;
  requestId: string;
  principal?: Principal;
}
interface Route {
  method: "GET" | "POST";
  path: string;
  auth: boolean;
  handler: Handler;
}

export function newRequestId(): string {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return "req_" + [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

/** Map engine validation errors (defence in depth; the API validates first). */
function engineCall<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof ValidationError) {
      const code = e.code === "empty" ? "prompt_empty" : e.code === "too_short" ? "prompt_too_short" : "prompt_too_long";
      throw new ApiError(400, code, "Prompt failed validation.", {}, "prompt");
    }
    throw e;
  }
}

const ROUTES: Route[] = [
  {
    method: "GET",
    path: "/v1/health",
    auth: false,
    handler: ({ requestId }) =>
      json({
        status: "ok",
        service: "intruva-api",
        api_version: API_VERSION,
        engine_version: ENGINE_VERSION,
        mode: "rule-based",
        llm: false,
        request_id: requestId,
      }),
  },
  {
    method: "GET",
    path: "/v1/openapi.json",
    auth: false,
    handler: ({ url }) => json(buildOpenApi(url.origin), 200, { "Cache-Control": "public, max-age=300" }),
  },
  {
    method: "GET",
    path: "/docs",
    auth: false,
    handler: ({ url }) =>
      new Response(renderDocs(url.origin), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=300",
          "Content-Security-Policy":
            "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        },
      }),
  },
  {
    method: "GET",
    path: "/",
    auth: false,
    handler: ({ requestId }) =>
      json({ service: "intruva-api", docs: "/docs", openapi: "/v1/openapi.json", health: "/v1/health", request_id: requestId }),
  },
  {
    method: "POST",
    path: "/v1/analyze",
    auth: true,
    handler: async ({ req, requestId }) => {
      const input = parseAnalyze(await readJson(req));
      const result = engineCall(() => analyzeLocal(input));
      return json({ ...result, request_id: requestId });
    },
  },
  {
    method: "POST",
    path: "/v1/optimize",
    auth: true,
    handler: async ({ req, requestId }) => {
      const input = parseOptimize(await readJson(req));
      const result = engineCall(() => optimizeLocal(input));
      return json({ ...result, request_id: requestId, analysis: { ...result.analysis, request_id: requestId } });
    },
  },
  {
    method: "POST",
    path: "/v1/security/scan",
    auth: true,
    handler: async ({ req, requestId }) => {
      const { text, redact } = parseScan(await readJson(req));
      const report = scanPrompt(text);
      const body: Record<string, unknown> = { request_id: requestId, ...report };
      if (redact) {
        body.redacted_text = applyRedactions(text, report.findings);
        body.redactions_applied = report.findings.filter((f) => f.redaction).length;
      }
      return json(body);
    },
  },
  {
    method: "POST",
    path: "/v1/feedback",
    auth: true,
    handler: async ({ req, requestId }) => {
      parseFeedback(await readJson(req));
      // Pilot: validated and acknowledged, deliberately not persisted (no storage, no logs of content).
      return json({ request_id: requestId, accepted: true, stored: false }, 202);
    },
  },
];

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const h: Record<string, string> = { Vary: "Origin" };
  if (origin && originMatches(origin, env.CORS_ORIGINS ?? DEFAULT_CORS_ORIGINS)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Expose-Headers"] = "X-Request-Id, Retry-After";
  }
  return h;
}

function preflight(req: Request, env: Env, url: URL): Response {
  const origin = req.headers.get("origin");
  const known = ROUTES.some((r) => r.path === normalizePath(url.pathname));
  if (!known) throw new ApiError(404, "not_found", "No such endpoint.");
  if (!origin || !originMatches(origin, env.CORS_ORIGINS ?? DEFAULT_CORS_ORIGINS)) {
    throw new ApiError(403, "forbidden_origin", "Origin is not allowed by this API's CORS policy.");
  }
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "7200",
      Vary: "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
    },
  });
}

function normalizePath(p: string): string {
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

function log(entry: Record<string, unknown>) {
  // Privacy: never add request/response bodies, prompt text, findings, or headers here.
  console.log(JSON.stringify(entry));
}

export async function handle(req: Request, env: Env, _ctx?: Ctx): Promise<Response> {
  const started = Date.now();
  const requestId = newRequestId();
  const url = new URL(req.url);
  const path = normalizePath(url.pathname);
  let route = "unmatched";
  let principal: Principal | undefined;
  let res: Response;
  let errorName: string | undefined;

  try {
    if (req.method === "OPTIONS") {
      route = path;
      res = preflight(req, env, url);
    } else {
      const candidates = ROUTES.filter((r) => r.path === path);
      if (!candidates.length) throw new ApiError(404, "not_found", "No such endpoint. See /docs.");
      route = path;
      const r = candidates.find((c) => c.method === req.method || (c.method === "GET" && req.method === "HEAD"));
      if (!r) {
        throw new ApiError(405, "method_not_allowed", `Use ${candidates.map((c) => c.method).join(", ")} for this endpoint.`, {
          Allow: [...candidates.map((c) => c.method), "OPTIONS"].join(", "),
        });
      }
      if (r.auth) {
        principal = await authenticate(req, env);
        await enforceRateLimit(principal, env);
      }
      res = await r.handler({ req, env, url, requestId, principal });
      if (req.method === "HEAD") res = new Response(null, { status: res.status, headers: res.headers });
    }
  } catch (e) {
    if (e instanceof ApiError) {
      res = json(e.body(requestId), e.status, e.headers);
      errorName = e.code;
    } else {
      // Sanitized: no message or stack leaves the Worker, and none is logged.
      errorName = e instanceof Error ? e.name : "unknown";
      res = json(new ApiError(500, "internal_error", "Internal error. Quote the request_id if you contact support.").body(requestId), 500);
    }
  }

  const headers = new Headers(res.headers);
  headers.set("X-Request-Id", requestId);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) if (!headers.has(k)) headers.set(k, v);
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
  if (req.method !== "OPTIONS") for (const [k, v] of Object.entries(corsHeaders(req.headers.get("origin"), env))) headers.set(k, v);

  log({
    level: res.status >= 500 ? "error" : "info",
    msg: "request",
    request_id: requestId,
    method: req.method,
    route,
    status: res.status,
    latency_ms: Date.now() - started,
    ...(principal ? { key: principal.label } : {}),
    ...(errorName ? { error: errorName } : {}),
  });

  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
