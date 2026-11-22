/**
 * Per-principal rate limiting.
 *
 * Production uses the Workers Rate Limiting binding (configured in
 * wrangler.jsonc: 60 req / 60 s per API key, 20 req / 60 s per IP for optional
 * anonymous access). Those counters are per Cloudflare location and eventually
 * consistent — a guardrail against runaway clients, not a billing meter.
 *
 * When the binding is absent (unit tests, or a misconfigured deploy) we fall
 * back to an in-isolate fixed-window counter so the API is never unlimited.
 */
import type { Principal } from "./auth";
import { ApiError } from "./errors";
import type { Env, RateLimiterLike } from "./env";

const WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 60;
const DEFAULT_ANON_LIMIT = 20;

class MemoryLimiter implements RateLimiterLike {
  private windows = new Map<string, { start: number; count: number }>();
  constructor(private readonly limitPerWindow: () => number) {}

  async limit({ key }: { key: string }): Promise<{ success: boolean }> {
    const now = Date.now();
    if (this.windows.size > 10_000) {
      for (const [k, w] of this.windows) if (now - w.start >= WINDOW_MS) this.windows.delete(k);
    }
    let w = this.windows.get(key);
    if (!w || now - w.start >= WINDOW_MS) {
      w = { start: now, count: 0 };
      this.windows.set(key, w);
    }
    if (w.count >= this.limitPerWindow()) return { success: false };
    w.count += 1;
    return { success: true };
  }

  reset() {
    this.windows.clear();
  }
}

let fallbackEnv: Env = {};
const intLimit = (raw: string | undefined, dflt: number) => {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : dflt;
};
const memKeyed = new MemoryLimiter(() => intLimit(fallbackEnv.RATE_LIMIT_PER_MINUTE, DEFAULT_LIMIT));
const memAnon = new MemoryLimiter(() => intLimit(fallbackEnv.ANON_RATE_LIMIT_PER_MINUTE, DEFAULT_ANON_LIMIT));

/** Test hook: clear fallback counters. */
export function resetFallbackLimiters() {
  memKeyed.reset();
  memAnon.reset();
}

export async function enforceRateLimit(principal: Principal, env: Env): Promise<void> {
  fallbackEnv = env;
  const limiter: RateLimiterLike =
    principal.kind === "anonymous" ? (env.ANON_RATE_LIMITER ?? memAnon) : (env.RATE_LIMITER ?? memKeyed);
  let ok: boolean;
  try {
    ok = (await limiter.limit({ key: principal.rateKey })).success;
  } catch {
    // Binding failure: fail open to the in-isolate limiter rather than erroring.
    ok = (await (principal.kind === "anonymous" ? memAnon : memKeyed).limit({ key: principal.rateKey })).success;
  }
  if (!ok) {
    throw new ApiError(429, "rate_limited", "Rate limit exceeded. Retry after a minute.", { "Retry-After": "60" });
  }
}
