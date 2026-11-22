import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { ENGINE_VERSION, SAMPLES, type OptimizeMode, type TargetModel } from "@intruva/engine";
import { parseKeyRegistry, sha256Hex, timingSafeEqual } from "../src/auth";
import { resetFallbackLimiters } from "../src/ratelimit";
import { BASE, call, fakeLimiter, KEY, KEY_B, makeEnv, REVOKED, validateSchema } from "./helpers";

const REQ_ID = /^req_[0-9a-f]{24}$/;
const PROMPT = "Our checkout API got really slow after yesterday's deploy, fix it. Don't change the response format.";

// Silence (but keep inspectable) the structured request logs.
let logs: string[] = [];
const origLog = console.log;
beforeEach(() => {
  logs = [];
  console.log = (...a: unknown[]) => void logs.push(a.map(String).join(" "));
  resetFallbackLimiters();
});
afterEach(() => {
  console.log = origLog;
});

describe("health & meta", () => {
  it("GET /v1/health needs no auth and reports the rule-based engine", async () => {
    const { status, json, res } = await call("/v1/health", { key: null });
    assert.equal(status, 200);
    assert.deepEqual(validateSchema("Health", json), []);
    assert.equal(json.mode, "rule-based");
    assert.equal(json.llm, false);
    assert.equal(json.engine_version, ENGINE_VERSION);
    assert.match(json.request_id, REQ_ID);
    assert.equal(res.headers.get("x-request-id"), json.request_id);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  });

  it("HEAD /v1/health returns 200 with no body", async () => {
    const { status, text } = await call("/v1/health", { key: null, method: "HEAD" });
    assert.equal(status, 200);
    assert.equal(text, "");
  });

  it("trailing slash is tolerated", async () => {
    assert.equal((await call("/v1/health/", { key: null })).status, 200);
  });

  it("GET /v1/openapi.json is a 3.1 document covering every route", async () => {
    const { status, json } = await call("/v1/openapi.json", { key: null });
    assert.equal(status, 200);
    assert.equal(json.openapi, "3.1.0");
    assert.equal(json.servers[0].url, BASE);
    for (const p of ["/v1/health", "/v1/analyze", "/v1/optimize", "/v1/security/scan", "/v1/feedback", "/v1/openapi.json"])
      assert.ok(json.paths[p], `missing ${p}`);
    // Every $ref resolves.
    const refs = [...JSON.stringify(json).matchAll(/"\$ref":"#\/components\/schemas\/(\w+)"/g)].map((m) => m[1]);
    for (const r of refs) assert.ok(json.components.schemas[r], `dangling $ref ${r}`);
  });

  it("GET /docs serves self-contained HTML with a strict CSP", async () => {
    const { status, text, res } = await call("/docs", { key: null });
    assert.equal(status, 200);
    assert.match(res.headers.get("content-type")!, /text\/html/);
    assert.match(res.headers.get("content-security-policy")!, /default-src 'none'/);
    assert.match(text, /rule-based/i);
    assert.doesNotMatch(text, /<script/i);
    assert.match(text, /\/v1\/security\/scan/);
  });

  it("unknown path → 404 not_found; wrong method → 405 with Allow", async () => {
    const nf = await call("/v1/nope", { key: null });
    assert.equal(nf.status, 404);
    assert.equal(nf.json.error.code, "not_found");
    assert.match(nf.json.request_id, REQ_ID);
    const mna = await call("/v1/analyze", { method: "GET" });
    assert.equal(mna.status, 405);
    assert.equal(mna.json.error.code, "method_not_allowed");
    assert.match(mna.res.headers.get("allow")!, /POST/);
  });
});

describe("auth", () => {
  it("missing key → 401 missing_api_key with WWW-Authenticate", async () => {
    const { status, json, res } = await call("/v1/analyze", { key: null, body: { prompt: PROMPT } });
    assert.equal(status, 401);
    assert.equal(json.error.code, "missing_api_key");
    assert.match(res.headers.get("www-authenticate")!, /^Bearer/);
    assert.deepEqual(validateSchema("Error", json), []);
  });

  it("non-Bearer Authorization → 401 invalid_authorization", async () => {
    const { status, json } = await call("/v1/analyze", {
      key: null,
      headers: { authorization: `Basic ${btoa("a:b")}` },
      body: { prompt: PROMPT },
    });
    assert.equal(status, 401);
    assert.equal(json.error.code, "invalid_authorization");
  });

  it("unknown, malformed or revoked key → 401 invalid_api_key", async () => {
    for (const key of [REVOKED, "itv_short", "sk-not-ours-aaaaaaaaaaaaaaaaaaaaaaaa", KEY + "x"]) {
      const { status, json } = await call("/v1/analyze", { key, body: { prompt: PROMPT } });
      assert.equal(status, 401, key);
      assert.equal(json.error.code, "invalid_api_key");
    }
  });

  it("valid keys → 200, and revocation works by removing the hash", async () => {
    assert.equal((await call("/v1/analyze", { key: KEY, body: { prompt: PROMPT } })).status, 200);
    assert.equal((await call("/v1/analyze", { key: KEY_B, body: { prompt: PROMPT } })).status, 200);
    const env = await makeEnv({ API_KEYS: `beta:${await sha256Hex(KEY_B)}` });
    assert.equal((await call("/v1/analyze", { key: KEY, env, body: { prompt: PROMPT } })).status, 401);
    assert.equal((await call("/v1/analyze", { key: KEY_B, env, body: { prompt: PROMPT } })).status, 200);
  });

  it("no API_KEYS secret configured → every key is rejected", async () => {
    const env = await makeEnv({ API_KEYS: undefined });
    assert.equal((await call("/v1/analyze", { env, body: { prompt: PROMPT } })).status, 401);
  });

  it("auth is checked before the body is parsed", async () => {
    const { status } = await call("/v1/analyze", { key: null, rawBody: "{not json", headers: { "content-type": "application/json" } });
    assert.equal(status, 401);
  });

  it("registry parsing accepts newline/comma lists and ignores junk", async () => {
    const h = await sha256Hex(KEY);
    const entries = parseKeyRegistry(`# c\n a:${h} , b:${h.toUpperCase()}\nbad line\nc:nothex\n:${h}`);
    assert.deepEqual(
      entries.map((e) => e.label),
      ["a", "b"],
    );
    assert.equal(entries[1].hash, h);
  });

  it("timingSafeEqual compares full strings", () => {
    assert.equal(timingSafeEqual("abcd", "abcd"), true);
    assert.equal(timingSafeEqual("abcd", "abce"), false);
    assert.equal(timingSafeEqual("abcd", "abc"), false);
    assert.equal(timingSafeEqual("", ""), true);
  });

  it("anonymous browser access is off by default and opt-in per origin", async () => {
    const headers = { origin: "https://intruva.pages.dev", "cf-connecting-ip": "203.0.113.9" };
    assert.equal((await call("/v1/analyze", { key: null, headers, body: { prompt: PROMPT } })).status, 401);
    const limiter = fakeLimiter(() => true);
    const env = await makeEnv({ ANONYMOUS_ORIGINS: "https://intruva.pages.dev", ANON_RATE_LIMITER: limiter });
    assert.equal((await call("/v1/analyze", { key: null, env, headers, body: { prompt: PROMPT } })).status, 200);
    assert.deepEqual(limiter.keys, ["ip:203.0.113.9"]);
    const other = { ...headers, origin: "https://evil.example" };
    assert.equal((await call("/v1/analyze", { key: null, env, headers: other, body: { prompt: PROMPT } })).status, 401);
  });
});

describe("validation & body limits", () => {
  const cases: [string, unknown, string, string?][] = [
    ["array body", [1, 2], "invalid_request"],
    ["missing prompt", { mode: "quick" }, "invalid_request", "prompt"],
    ["prompt not string", { prompt: 42 }, "invalid_request", "prompt"],
    ["empty prompt", { prompt: "   " }, "prompt_empty", "prompt"],
    ["short prompt", { prompt: "fix it" }, "prompt_too_short", "prompt"],
    ["long prompt", { prompt: "a".repeat(12_001) }, "prompt_too_long", "prompt"],
    ["bad mode", { prompt: PROMPT, mode: "turbo" }, "invalid_request", "mode"],
    ["bad task_type", { prompt: PROMPT, task_type: "poetry" }, "invalid_request", "task_type"],
    ["bad target_model", { prompt: PROMPT, target_model: "gpt-9" }, "invalid_request", "target_model"],
    ["unknown field", { prompt: PROMPT, temperature: 1 }, "invalid_request", "temperature"],
  ];
  for (const [name, body, code, field] of cases) {
    it(`/v1/analyze: ${name} → 400 ${code}`, async () => {
      const { status, json } = await call("/v1/analyze", { body });
      assert.equal(status, 400);
      assert.equal(json.error.code, code);
      if (field) assert.equal(json.error.field, field);
      assert.deepEqual(validateSchema("Error", json), []);
    });
  }

  it("/v1/optimize validates answers", async () => {
    const bad: [unknown, string][] = [
      ["nope", "answers"],
      [[{ field: "x", kind: "maybe" }], "answers[0].kind"],
      [[{ field: "Bad Field", kind: "answered" }], "answers[0].field"],
      [[{ field: "x", kind: "answered", value: 1 }], "answers[0].value"],
      [[{ field: "x", kind: "answered", extra: 1 }], "answers[0].extra"],
      [Array.from({ length: 11 }, () => ({ field: "x", kind: "skipped" })), "answers"],
    ];
    for (const [answers, field] of bad) {
      const { status, json } = await call("/v1/optimize", { body: { prompt: PROMPT, answers } });
      assert.equal(status, 400, field);
      assert.equal(json.error.field, field);
    }
  });

  it("/v1/security/scan validates text and redact", async () => {
    assert.equal((await call("/v1/security/scan", { body: { prompt: PROMPT } })).json.error.field, "prompt");
    assert.equal((await call("/v1/security/scan", { body: { text: PROMPT, redact: "yes" } })).json.error.field, "redact");
  });

  it("/v1/feedback requires consent flag and rejects prompt text fields", async () => {
    const ok = { request_id: "req_0123456789abcdef01234567", rating: "up", consent_benchmark: false };
    assert.equal((await call("/v1/feedback", { body: ok })).status, 202);
    const { consent_benchmark: _c, ...noConsent } = ok;
    assert.equal((await call("/v1/feedback", { body: noConsent })).json.error.field, "consent_benchmark");
    assert.equal((await call("/v1/feedback", { body: { ...ok, prompt: PROMPT } })).json.error.field, "prompt");
    assert.equal((await call("/v1/feedback", { body: { ...ok, rating: "meh" } })).json.error.field, "rating");
    assert.equal((await call("/v1/feedback", { body: { ...ok, note: "x".repeat(1001) } })).json.error.field, "note");
  });

  it("wrong Content-Type → 415", async () => {
    const { status, json } = await call("/v1/analyze", { rawBody: JSON.stringify({ prompt: PROMPT }), headers: { "content-type": "text/plain" } });
    assert.equal(status, 415);
    assert.equal(json.error.code, "unsupported_media_type");
  });

  it("malformed JSON → 400 invalid_json", async () => {
    const { status, json } = await call("/v1/analyze", { rawBody: '{"prompt": ', headers: { "content-type": "application/json" } });
    assert.equal(status, 400);
    assert.equal(json.error.code, "invalid_json");
  });

  it("body over 64 KB → 413 (Content-Length)", async () => {
    const { status, json } = await call("/v1/analyze", { body: { prompt: "x".repeat(70_000) } });
    assert.equal(status, 413);
    assert.equal(json.error.code, "payload_too_large");
  });

  it("body over 64 KB → 413 (chunked stream, no Content-Length)", async () => {
    const chunk = new TextEncoder().encode("x".repeat(16 * 1024));
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        if (sent++ < 8) c.enqueue(chunk);
        else c.close();
      },
    });
    const { status } = await call("/v1/analyze", { rawBody: stream, headers: { "content-type": "application/json" } });
    assert.equal(status, 413);
  });

  it("a body that fails mid-stream → sanitized 500 (no message leak)", async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull() {
        throw new Error("boom SECRET_INTERNAL_DETAIL");
      },
    });
    const { status, json, text } = await call("/v1/analyze", { rawBody: stream, headers: { "content-type": "application/json" } });
    assert.equal(status, 500);
    assert.equal(json.error.code, "internal_error");
    assert.doesNotMatch(text, /SECRET_INTERNAL_DETAIL|at .*\.ts/);
    assert.ok(logs.every((l) => !l.includes("SECRET_INTERNAL_DETAIL")));
  });
});

describe("endpoint shapes match the OpenAPI contract", () => {
  const modes: OptimizeMode[] = ["quick", "deep", "minimal"];
  const targets: TargetModel[] = ["generic", "claude"];

  for (const s of SAMPLES) {
    it(`analyze + optimize: sample “${s.id}” across modes/targets`, async () => {
      for (const mode of modes) {
        for (const target_model of targets) {
          const a = await call("/v1/analyze", { body: { prompt: s.prompt, mode, target_model } });
          assert.equal(a.status, 200);
          assert.deepEqual(validateSchema("AnalysisResult", a.json), [], `${s.id}/${mode}/${target_model}`);
          assert.equal(a.json.request_id, a.res.headers.get("x-request-id"));
          if (mode !== "deep") assert.equal(a.json.questions.length, 0);

          const answers = a.json.questions.slice(0, 1).map((q: { field: string }) => ({ field: q.field, kind: "answered", value: "As described." }));
          const o = await call("/v1/optimize", { body: { prompt: s.prompt, mode, target_model, answers } });
          assert.equal(o.status, 200);
          assert.deepEqual(validateSchema("OptimizeResult", o.json), [], `${s.id}/${mode}/${target_model}`);
          assert.match(o.json.request_id, REQ_ID);
          assert.equal(o.json.analysis.request_id, o.json.request_id);
          assert.equal(o.json.original, s.prompt);
          assert.deepEqual(o.json.preservation.filter((p: { status: string }) => p.status === "fail"), []);
        }
      }
    });
  }

  it("defaults: task_type=auto, mode=quick, target_model=generic", async () => {
    const { json } = await call("/v1/analyze", { body: { prompt: PROMPT } });
    assert.equal(json.task_type, "debugging");
    assert.equal(json.questions.length, 0);
  });

  it("explicit task_type overrides classification", async () => {
    const { json } = await call("/v1/analyze", { body: { prompt: PROMPT, task_type: "writing" } });
    assert.equal(json.task_type, "writing");
    assert.equal(json.task_confidence, "high");
  });

  it("security/scan shape (with and without redact)", async () => {
    const plain = await call("/v1/security/scan", { body: { text: PROMPT } });
    assert.equal(plain.status, 200);
    assert.deepEqual(validateSchema("ScanResult", plain.json), []);
    assert.equal(plain.json.redacted_text, undefined);
    const red = await call("/v1/security/scan", { body: { text: "email me at jane.doe@acme-corp.io about the bug please", redact: true } });
    assert.deepEqual(validateSchema("ScanResult", red.json), []);
    assert.equal(typeof red.json.redacted_text, "string");
    assert.ok(red.json.redactions_applied >= 1);
    assert.doesNotMatch(red.json.redacted_text, /jane\.doe@acme-corp\.io/);
  });

  it("feedback shape: 202, not stored", async () => {
    const { status, json } = await call("/v1/feedback", {
      body: { request_id: "req_x", rating: "down", meaning_preserved: "partly", outcome: "same", note: "ok", consent_benchmark: true },
    });
    assert.equal(status, 202);
    assert.deepEqual(validateSchema("FeedbackAccepted", json), []);
    assert.equal(json.stored, false);
  });
});

describe("security scan never returns raw secrets", () => {
  // Fake credentials assembled at runtime so this file doesn't trip secret scanners.
  const j = (...p: string[]) => p.join("");
  const SECRETS: Record<string, string> = {
    anthropic: j("sk-ant-", "api03-", "Zq8xY2wV5tR1nM4kL7jH0gF3dS6aP9oI"),
    openai: j("sk-", "proj-", "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8"),
    aws: j("AKIA", "IOSFODNN7EXAMPLQ"),
    github: j("ghp_", "16C7e42F292c6912E7710c838347Ae178B4a"),
    stripe: j("sk_live_", "51HbQxZ2eZvKYlo2C8nK3pQ7rT9wX"),
    jwt: j("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", ".", "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ", ".", "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"),
    conn: j("postgres://admin:", "S3cr3tPassw0rd", "@db.internal:5432/prod"),
    pkey: j("-----BEGIN RSA PRIVATE KEY-----\n", "MIIEowIBAAKCAQEA7Yh3b9s0nQ2kJ8xLmZ1pQ4rT6vW8yA0cE2gI4kM6oQ8sU0wY2", "\n-----END RSA PRIVATE KEY-----"),
  };

  for (const [name, secret] of Object.entries(SECRETS)) {
    for (const redact of [false, true]) {
      it(`${name} (redact=${redact})`, async () => {
        const text = `Please debug my deploy script. It uses this credential: ${secret} and then fails with 500.`;
        const { status, json, text: raw } = await call("/v1/security/scan", { body: { text, redact } });
        assert.equal(status, 200);
        assert.ok(json.findings.some((f: { category: string }) => f.category === "secret"), "secret detected");
        assert.ok(!raw.includes(secret), "raw secret must not appear anywhere in the response");
        // Also no long fragment of the secret (masking keeps at most a short prefix).
        const core = secret.replace(/^-----BEGIN [A-Z ]+-----\n/, "").slice(8, 24);
        assert.ok(!raw.includes(core), "no secret fragment");
        if (redact) assert.match(json.redacted_text, /\[REDACTED_/);
      });
    }
  }
});

describe("CORS", () => {
  const pre = (origin: string, path = "/v1/analyze") =>
    call(path, {
      method: "OPTIONS",
      key: null,
      headers: { origin, "access-control-request-method": "POST", "access-control-request-headers": "authorization, content-type" },
    });

  it("preflight from an allowed origin → 204 with allow headers", async () => {
    for (const origin of ["https://intruva.pages.dev", "http://localhost:3001", "https://feat-x.intruva.pages.dev"]) {
      const { status, res } = await pre(origin);
      assert.equal(status, 204, origin);
      assert.equal(res.headers.get("access-control-allow-origin"), origin);
      assert.match(res.headers.get("access-control-allow-methods")!, /POST/);
      assert.match(res.headers.get("access-control-allow-headers")!, /Authorization/);
      assert.ok(res.headers.get("x-request-id"));
    }
  });

  it("preflight from a disallowed origin → 403 forbidden_origin, no ACAO", async () => {
    for (const origin of ["https://evil.example", "https://intruva.pages.dev.evil.example", "http://localhost:3000"]) {
      const { status, json, res } = await pre(origin);
      assert.equal(status, 403, origin);
      assert.equal(json.error.code, "forbidden_origin");
      assert.equal(res.headers.get("access-control-allow-origin"), null);
    }
  });

  it("preflight to an unknown path → 404", async () => {
    assert.equal((await pre("https://intruva.pages.dev", "/v1/nope")).status, 404);
  });

  it("actual responses carry ACAO only for allowed origins", async () => {
    const ok = await call("/v1/analyze", { headers: { origin: "https://intruva.pages.dev" }, body: { prompt: PROMPT } });
    assert.equal(ok.res.headers.get("access-control-allow-origin"), "https://intruva.pages.dev");
    assert.match(ok.res.headers.get("access-control-expose-headers")!, /X-Request-Id/);
    const bad = await call("/v1/analyze", { headers: { origin: "https://evil.example" }, body: { prompt: PROMPT } });
    assert.equal(bad.res.headers.get("access-control-allow-origin"), null);
    assert.equal(bad.res.headers.get("vary"), "Origin");
  });

  it("CORS_ORIGINS env overrides the allowlist", async () => {
    const env = await makeEnv({ CORS_ORIGINS: "https://app.intruva.ai" });
    const r = await call("/v1/analyze", { method: "OPTIONS", key: null, env, headers: { origin: "https://app.intruva.ai" } });
    assert.equal(r.status, 204);
    const r2 = await call("/v1/analyze", { method: "OPTIONS", key: null, env, headers: { origin: "https://intruva.pages.dev" } });
    assert.equal(r2.status, 403);
  });
});

describe("rate limiting", () => {
  it("fallback limiter: N per minute per key, then 429 with Retry-After", async () => {
    const env = await makeEnv({ RATE_LIMIT_PER_MINUTE: "3" });
    for (let i = 0; i < 3; i++) assert.equal((await call("/v1/security/scan", { env, body: { text: PROMPT } })).status, 200);
    const limited = await call("/v1/security/scan", { env, body: { text: PROMPT } });
    assert.equal(limited.status, 429);
    assert.equal(limited.json.error.code, "rate_limited");
    assert.equal(limited.res.headers.get("retry-after"), "60");
    // Another key has its own budget.
    assert.equal((await call("/v1/security/scan", { env, key: KEY_B, body: { text: PROMPT } })).status, 200);
    // Unauthenticated requests don't consume a key's budget, and health is never limited.
    assert.equal((await call("/v1/health", { env, key: null })).status, 200);
  });

  it("uses the Workers Rate Limiting binding when bound, keyed by key hash (not the key)", async () => {
    const limiter = fakeLimiter(() => false);
    const env = await makeEnv({ RATE_LIMITER: limiter });
    const r = await call("/v1/analyze", { env, body: { prompt: PROMPT } });
    assert.equal(r.status, 429);
    assert.equal(limiter.keys.length, 1);
    assert.match(limiter.keys[0], /^key:[0-9a-f]{32}$/);
    assert.ok(!limiter.keys[0].includes(KEY.slice(4)));
  });

  it("rate limit is checked before body parsing (cheap rejection)", async () => {
    const env = await makeEnv({ RATE_LIMITER: fakeLimiter(() => false) });
    const r = await call("/v1/analyze", { env, rawBody: "{bad", headers: { "content-type": "application/json" } });
    assert.equal(r.status, 429);
  });

  it("a failing binding falls back to the in-isolate limiter instead of erroring", async () => {
    const env = await makeEnv({
      RATE_LIMITER: {
        limit: async () => {
          throw new Error("binding down");
        },
      },
    });
    assert.equal((await call("/v1/analyze", { env, body: { prompt: PROMPT } })).status, 200);
  });
});

describe("privacy: logs", () => {
  it("one structured line per request with only safe fields — never prompt text", async () => {
    const secretish = "TOP-SECRET-PROJECT-NIGHTJAR wants a migration plan for the billing database";
    await call("/v1/optimize", { body: { prompt: secretish, mode: "deep" } });
    await call("/v1/analyze", { body: { prompt: "x" } }); // validation error path
    assert.equal(logs.length, 2);
    for (const line of logs) {
      assert.ok(!line.includes("NIGHTJAR"));
      const entry = JSON.parse(line);
      const allowed = new Set(["level", "msg", "request_id", "method", "route", "status", "latency_ms", "key", "error"]);
      for (const k of Object.keys(entry)) assert.ok(allowed.has(k), `unexpected log field ${k}`);
      assert.match(entry.request_id, REQ_ID);
    }
    assert.equal(JSON.parse(logs[0]).key, "alpha");
    assert.equal(JSON.parse(logs[1]).error, "prompt_too_short");
  });
});
