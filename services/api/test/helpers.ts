import { handle } from "../src/app";
import { sha256Hex } from "../src/auth";
import type { Env, RateLimiterLike } from "../src/env";
import { buildOpenApi } from "../src/openapi";

export const BASE = "https://api.test";
export const KEY = "itv_TEST_ONLY_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
export const KEY_B = "itv_TEST_ONLY_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
export const REVOKED = "itv_TEST_ONLY_ccccccccccccccccccccccccccccccccccccccc";

export async function makeEnv(overrides: Partial<Env> = {}): Promise<Env> {
  return {
    API_KEYS: `# test registry\nalpha:${await sha256Hex(KEY)}\nbeta:${await sha256Hex(KEY_B)}`,
    CORS_ORIGINS: "https://intruva.pages.dev,https://*.intruva.pages.dev,http://localhost:3001",
    RATE_LIMIT_PER_MINUTE: "1000",
    ENVIRONMENT: "test",
    ...overrides,
  };
}

export interface CallOpts {
  method?: string;
  key?: string | null;
  body?: unknown;
  rawBody?: BodyInit;
  headers?: Record<string, string>;
  env?: Env;
}

export async function call(path: string, opts: CallOpts = {}) {
  const env = opts.env ?? (await makeEnv());
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  const key = opts.key === undefined ? KEY : opts.key;
  if (key) headers.authorization = `Bearer ${key}`;
  let body: BodyInit | undefined = opts.rawBody;
  if (opts.body !== undefined) {
    body = JSON.stringify(opts.body);
    headers["content-type"] ??= "application/json";
  }
  const method = opts.method ?? (body === undefined ? "GET" : "POST");
  const init: RequestInit & { duplex?: "half" } = { method, headers, body };
  if (body instanceof ReadableStream) init.duplex = "half";
  const res = await handle(new Request(BASE + path, init), env);
  const text = await res.text();
  let json: any = undefined;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { res, status: res.status, text, json };
}

/** A rate-limiter binding double. */
export function fakeLimiter(fn: (key: string) => boolean | Promise<boolean>): RateLimiterLike & { keys: string[] } {
  const keys: string[] = [];
  return {
    keys,
    async limit({ key }) {
      keys.push(key);
      return { success: await fn(key) };
    },
  };
}

/* ------------------------------------------------ tiny JSON Schema checker */

type Schema = Record<string, any>;
const SPEC = buildOpenApi(BASE);

/** Validate `value` against a component schema; returns a list of problems (empty = valid). */
export function validateSchema(name: string, value: unknown): string[] {
  const errors: string[] = [];
  check({ $ref: `#/components/schemas/${name}` }, value, "$", errors);
  return errors;
}

function check(schema: Schema, v: unknown, path: string, errors: string[]): void {
  if (schema.$ref) {
    const target = (SPEC.components.schemas as Record<string, Schema>)[schema.$ref.split("/").pop()!];
    if (!target) return void errors.push(`${path}: unknown $ref ${schema.$ref}`);
    return check(target, v, path, errors);
  }
  if (schema.const !== undefined && v !== schema.const) errors.push(`${path}: expected const ${schema.const}`);
  if (schema.enum && !schema.enum.includes(v)) errors.push(`${path}: ${JSON.stringify(v)} not in enum`);
  switch (schema.type) {
    case "string":
      if (typeof v !== "string") return void errors.push(`${path}: expected string`);
      if (schema.pattern && !new RegExp(schema.pattern).test(v)) errors.push(`${path}: pattern mismatch`);
      if (schema.maxLength !== undefined && v.length > schema.maxLength) errors.push(`${path}: too long`);
      if (schema.minLength !== undefined && v.length < schema.minLength) errors.push(`${path}: too short`);
      break;
    case "integer":
    case "number":
      if (typeof v !== "number" || !Number.isFinite(v)) return void errors.push(`${path}: expected number`);
      if (schema.type === "integer" && !Number.isInteger(v)) errors.push(`${path}: expected integer`);
      if (schema.minimum !== undefined && v < schema.minimum) errors.push(`${path}: < minimum`);
      if (schema.maximum !== undefined && v > schema.maximum) errors.push(`${path}: > maximum`);
      break;
    case "boolean":
      if (typeof v !== "boolean") errors.push(`${path}: expected boolean`);
      break;
    case "array":
      if (!Array.isArray(v)) return void errors.push(`${path}: expected array`);
      if (schema.maxItems !== undefined && v.length > schema.maxItems) errors.push(`${path}: too many items`);
      v.forEach((item, i) => check(schema.items, item, `${path}[${i}]`, errors));
      break;
    case "object": {
      if (typeof v !== "object" || v === null || Array.isArray(v)) return void errors.push(`${path}: expected object`);
      const o = v as Record<string, unknown>;
      for (const r of schema.required ?? []) if (!(r in o)) errors.push(`${path}.${r}: required`);
      for (const [k, val] of Object.entries(o)) {
        const ps = schema.properties?.[k];
        if (!ps) {
          if (schema.additionalProperties === false) errors.push(`${path}.${k}: not in schema`);
          continue;
        }
        if (val === undefined) continue;
        check(ps, val, `${path}.${k}`, errors);
      }
      break;
    }
  }
}
