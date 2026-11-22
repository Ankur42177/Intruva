/**
 * Worker bindings and configuration.
 *
 * Kept free of `@cloudflare/workers-types` so the same code type-checks and runs
 * under Node in the test suite. The rate limiter interface matches the
 * Workers Rate Limiting binding (`env.X.limit({ key })`).
 */

export interface RateLimiterLike {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  /**
   * Secret. API key registry: one `label:sha256hex` entry per line (or comma
   * separated). Only hashes are stored — never raw keys. Remove a line and
   * re-put the secret to revoke a key.
   */
  API_KEYS?: string;
  /** Comma-separated CORS allowlist. Supports a leading `*.` wildcard in the host. */
  CORS_ORIGINS?: string;
  /**
   * Optional, off by default. Browser origins allowed to call the API with no
   * API key (rate-limited per IP). The Origin header is spoofable outside a
   * browser, so this is equivalent to a public, IP-rate-limited endpoint.
   */
  ANONYMOUS_ORIGINS?: string;
  /** Workers Rate Limiting binding keyed per API key (see wrangler.jsonc). */
  RATE_LIMITER?: RateLimiterLike;
  /** Workers Rate Limiting binding keyed per client IP for anonymous access. */
  ANON_RATE_LIMITER?: RateLimiterLike;
  /** Fallback limiter budget (requests/minute) when no binding is present. */
  RATE_LIMIT_PER_MINUTE?: string;
  ANON_RATE_LIMIT_PER_MINUTE?: string;
  /** "production" | "development" | "test" — informational only. */
  ENVIRONMENT?: string;
}

/** Minimal subset of ExecutionContext we use; optional so tests can omit it. */
export interface Ctx {
  waitUntil?(promise: Promise<unknown>): void;
}
