# Intruva Developer API (`@intruva/api`)

A Cloudflare Worker that serves the shared `@intruva/engine` over HTTPS. It's the same engine the web app, Chrome extension and MCP server use, and there is no Python port.

> **The engine is deterministic and rule-based. No LLM is called.** Task classification, missing-context ranking, optimization and security scanning all use pattern matching and weighted rules, so the same input always returns the same output. `GET /v1/health` reports this as `"mode": "rule-based", "llm": false`.

- Runtime: Cloudflare Workers (Free plan compatible). Config: [`wrangler.jsonc`](wrangler.jsonc). Wrangler 4.166.0 recommends `wrangler.jsonc` for new projects.
- Worker name: `intruva-api`. Public URL: `https://intruva-api.<account-subdomain>.workers.dev`.
- Zero runtime dependencies besides the engine. The bundle is about 121 KiB, or 37 KiB gzipped.
- There's no database, KV, queue or billing. The only server-side state is the `API_KEYS` secret (hashes) and the rate-limit counters.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/v1/health` | none | Status, `api_version`, `engine_version`, `mode: "rule-based"`, `llm: false` |
| GET | `/v1/openapi.json` | none | OpenAPI 3.1 document. Its schemas mirror `packages/engine/src/contracts.ts`, and the tests validate real responses against it. |
| GET | `/docs` | none | Human docs page generated from the OpenAPI document. It's self-contained, with no JavaScript and no CDN, and is served with `default-src 'none'`. |
| POST | `/v1/analyze` | key | `AnalyzeRequest` → `AnalysisResult`. Covers the task, intent, facts and labelled assumptions, ranked missing context, coverage, scores and the security report. `deep` mode adds up to 3 questions. |
| POST | `/v1/optimize` | key | `OptimizeRequest` (with `answers`) → `OptimizeResult`. Returns the optimized prompt (every original sentence kept verbatim), change notes, intent-preservation checks and before/after scores. |
| POST | `/v1/security/scan` | key | `{ text, redact? }` → `SecurityReport` + `request_id`. With `redact: true` it also returns `redacted_text` and `redactions_applied`. Findings carry masked evidence only, and the raw input is never echoed. |
| POST | `/v1/feedback` | key | `FeedbackRequest` → `202 { accepted: true, stored: false }`. It's validated but **not stored** during the pilot. Unknown fields such as `prompt` are rejected. |

Request fields mirror the engine contracts. `task_type` (default `auto`), `mode` (`quick`), and `target_model` (`generic`) are optional. Unknown fields are rejected with `400 invalid_request`, which catches typos. `request_id` in every analyze/optimize response is the API's own id (`req_<24 hex>`), and `analysis.request_id` inside `/v1/optimize` is set to the same value.

`GET /v1/usage` is **omitted on purpose**. Honest per-key usage counts need durable storage: KV's free tier allows 1,000 writes a day, and an Analytics Engine query needs an account API token inside the Worker. Neither is justified for a 3–5 customer pilot. For aggregate request counts per route and status, use the Workers dashboard. Our structured logs include the key label, so per-customer counts can be pulled from Workers Logs if needed.

### Limits and validation

| Limit | Value | Error |
|---|---|---|
| Request body | 64 KB, enforced while streaming, so chunked bodies are capped too | `413 payload_too_large` |
| Content-Type | `application/json` | `415 unsupported_media_type` |
| JSON | must parse, valid UTF-8, top level is an object | `400 invalid_json` / `invalid_request` |
| `prompt` / `text` | 8–12,000 chars after trimming (same rule as the engine) | `400 prompt_empty` / `prompt_too_short` / `prompt_too_long` |
| `answers` | ≤ 10 items, `field` matches `^[a-z0-9_]{1,64}$`, `value` ≤ 2,000 chars | `400 invalid_request` |
| feedback `note` | ≤ 1,000 chars | `400 invalid_request` |
| Rate limit | 60 req/min per API key (20 req/min per IP for optional anonymous access) | `429 rate_limited` + `Retry-After: 60` |

### Errors

Every error uses one shape. Messages are fixed strings and never contain exception text, stack traces, or echoed input:

```json
{ "error": { "code": "invalid_request", "message": "`mode` must be one of: quick, deep, minimal.", "field": "mode" },
  "request_id": "req_6f1c0d2a9b8e7f6a5b4c3d2e" }
```

Every response, including errors, preflights and `/docs`, carries an `X-Request-Id` header. JSON bodies also carry `request_id`. Codes: `not_found`, `method_not_allowed`, `missing_api_key`, `invalid_authorization`, `invalid_api_key`, `forbidden_origin`, `rate_limited`, `unsupported_media_type`, `payload_too_large`, `invalid_json`, `invalid_request`, `prompt_empty`, `prompt_too_short`, `prompt_too_long`, `internal_error`. The order of checks is: route → auth → rate limit → content type → body size → JSON → schema → engine. Unauthenticated and rate-limited requests are rejected before the body is read.

## Authentication and key management

Clients send `Authorization: Bearer itv_<43 base64url chars>`, which is 256 bits of randomness.

- **Only SHA-256 hashes are stored.** They go in the Worker secret **`API_KEYS`**, one `label:sha256hex` entry per line (comma-separated also works, and `#` comments are ignored).
- The Worker hashes the presented key with WebCrypto and compares it against **every** entry with a constant-time XOR comparison. There's no early exit, so timing reveals neither which entry matched nor how much of it matched. Hashing first also means attacker-chosen bytes never reach the comparison directly.
- The key label (for example `acme-pilot`) appears in logs. The rate-limit key is a hash prefix, never the raw key.
- **Revoke** a key by deleting its line and re-uploading the secret. The change takes effect on the next request; there are no caches to clear.
- If `API_KEYS` is missing or empty, every authenticated request returns `401`. The Worker fails closed.

### Create a key

Run from the repo root:

```bash
node scripts/create-api-key.mjs acme-pilot
```

This prints the **plaintext key** (shown once; send it to the customer securely) and the **SHA-256 hash** on separate lines. It also appends `acme-pilot:<hash>` to the local registry `services/api/.api-keys` (git-ignored, mode 600). Worker secrets can't be read back, so this file is the source of truth for the full list. Then upload the whole registry:

```bash
npx wrangler secret put API_KEYS --cwd services/api < services/api/.api-keys
```

For non-interactive or CI use, stdout is exactly the secret line and stderr is the plaintext key:

```bash
node scripts/create-api-key.mjs acme-pilot --entry-only --no-registry 2>acme-pilot.key \
  | npx wrangler secret put API_KEYS --cwd services/api     # replaces API_KEYS with this one entry
node scripts/create-api-key.mjs acme-pilot --json --no-registry   # {label,key,hash,entry,...}
```

`wrangler secret put` reads the value from stdin when stdin is not a TTY (wrangler 4.166.0, verified in its CLI source). Note that `API_KEYS` holds *all* keys, so piping a single entry replaces the existing ones. To add a key alongside existing ones, upload the registry file.

### Optional: anonymous browser access (off by default)

The web app's API client (`apps/web/src/lib/api/client.ts`) sends no `Authorization` header, and an API key embedded in a public static site would not be secret anyway. If you ever point `NEXT_PUBLIC_INTRUVA_API_URL` at this API, set `ANONYMOUS_ORIGINS` (for example `https://intruva.pages.dev`). Requests with no `Authorization` header and a matching `Origin` are then accepted and rate-limited per client IP (`ANON_RATE_LIMITER`, 20/min). The `Origin` header is trivially spoofed outside a browser, so treat this as a **public endpoint with per-IP limits**, not as auth. For the pilot, the recommendation is to leave it empty: the web app runs the same engine on-device, so calling the API adds no quality and sends prompts off-device.

## Rate limiting

Production uses the **Workers Rate Limiting binding** ([`ratelimits` in `wrangler.jsonc`](wrangler.jsonc)):

- `RATE_LIMITER` allows 60 requests per 60 s, keyed by `key:<first 32 hex of the key hash>`. `ANON_RATE_LIMITER` allows 20 per 60 s, keyed by `ip:<CF-Connecting-IP>`.
- Per Cloudflare's docs, counters are **per Cloudflare location and eventually consistent** ("Rate limits are approximate and apply separately in each Cloudflare location"), and `period` must be 10 or 60. This is a guardrail against runaway clients, not a billing meter. A strict global limit would need a Durable Object, which isn't justified for the pilot.
- **Fallback:** if the binding is absent (unit tests) or throws, an in-isolate fixed-window counter applies `RATE_LIMIT_PER_MINUTE` / `ANON_RATE_LIMIT_PER_MINUTE`, so the API is never unlimited. Keep those vars equal to the binding limits.
- Locally, `wrangler dev` simulates the binding. The smoke test below saw exactly 60 successes and then `429`.

**Is the binding available on the Workers Free plan?** Here's what was verified on 2026-11-22:
- The binding is GA and "recommended for all production workloads" ([changelog, 2025-09-19](https://developers.cloudflare.com/changelog/2025-09-19-ratelimit-workers-ga/)). It requires Wrangler ≥ 4.36.0 ([binding docs](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)).
- Neither the binding docs nor the changelog restricts it to paid plans or lists a price. The [Workers pricing page](https://developers.cloudflare.com/workers/platform/pricing/) lists no charge for it.
- A secondary source ([Classmethod, 2026-05-22](https://dev.classmethod.jp/en/articles/cloudflare-rate-limit-experiments/)) states "There is no additional charge for Rate Limiting Binding itself" and lists it alongside Workers Free limits.
- **Not verified:** a real deploy to a Free account. If `wrangler deploy` rejects the binding on Free, remove the `ratelimits` block. The in-isolate fallback still enforces per-key limits, though per isolate rather than per location.

## CORS

`CORS_ORIGINS` is a comma-separated allowlist. A `scheme://*.host` wildcard matches subdomains, which covers Pages preview URLs. The default is:

```
https://intruva.pages.dev,https://*.intruva.pages.dev,http://localhost:3001
```

- A preflight (`OPTIONS`) from an allowed origin returns `204` with `Access-Control-Allow-Origin: <origin>`, methods `GET, POST, OPTIONS`, headers `Authorization, Content-Type`, and max-age 7200.
- A preflight from a disallowed origin returns `403 forbidden_origin`. A preflight to an unknown path returns `404`.
- On normal responses, `Access-Control-Allow-Origin` is echoed only for allowed origins (with `Vary: Origin`), and `X-Request-Id, Retry-After` are exposed. Credentials are never allowed.

## Privacy

- **Prompt text, findings and response bodies are never logged.** Each request produces one structured line: `{level, msg, request_id, method, route, status, latency_ms, key?, error?}`. `route` is the matched route template (unknown paths log as `unmatched`). `error` is an error *code* or exception *class name*, never a message. A test asserts that no other fields are present and that prompt text never appears.
- `observability.logs.invocation_logs` is `false`, so Cloudflare's per-invocation request/response logs are not recorded; only the lines above are. `redact_query_string` is `true`. Workers Logs is included on Free: 200,000 events/day, 3-day retention ([docs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)).
- Nothing is stored. `/v1/feedback` is acknowledged and discarded, and responses are `Cache-Control: no-store`.
- `/v1/security/scan` never returns the raw input. Findings use masked evidence (for example `AKIA•••••••• (20 chars hidden)`). Tests cover 8 credential types, with and without redaction.
- `/v1/analyze` and `/v1/optimize` necessarily echo parts of the prompt back to the caller (facts, constraints, `original`, `optimized`). To keep secrets out of those responses, scan with `redact: true` first and send `redacted_text`.
- Security headers are applied to all responses: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, and HSTS.

## CPU time vs the Workers Free limit

The Workers Free plan allows **10 ms CPU per HTTP request**, 100,000 requests/day, and a 1 s startup limit for global scope. Isolates have "some built-in flexibility" for infrequent overruns; consistent overruns fail with error 1102 ([limits](https://developers.cloudflare.com/workers/platform/limits/), accessed 2026-11-22).

Measured with `npm run bench -w @intruva/api` on an Apple M4 with Node 25.2.1 (the same V8 engine family as workerd). The input was a realistic worst case: an **11,911-character** bug report with logs, a traceback, constraints, 12 security findings, `mode: deep`, `target_model: claude`. CPU is `process.cpuUsage()`, which is process-wide and so includes background GC and JIT threads. Treat these figures as upper bounds.

| | CPU ms |
|---|---|
| Module-scope warm-up (startup, not per request) | 12–15 |
| **First request in a fresh isolate**, full `POST /v1/optimize` handler (auth + JSON + engine) | **5.3** |
| The same first request *without* the warm-up | 10–14 |
| Warm `POST /v1/optimize`, p50 / p95 / max of 100 | 2.6–2.8 / 5.2–6.8 / 11–13 |
| Warm engine only: scan / analyze / optimize, p50 | 0.2 / 0.5 / 2.1 |

Cold-start cost is roughly **independent of input size**. Fresh-process `optimize` costs 7–11 ms at 300 chars and 8–9 ms at 12,000 chars. It's one-off regex compilation and lazy bytecode compilation, not input-dependent work.

That's why [`src/warmup.ts`](src/warmup.ts) runs each engine path once at **global scope**, which counts toward the 1 s startup limit instead of the request budget. It's pure computation: no I/O, timers or crypto randomness. Verified working under `wrangler dev`/workerd.

**Conclusion:** the engine fits the Free plan's 10 ms budget with about 2× headroom at the p95 for maximum-size inputs, and by a wide margin for typical prompts. The rare warm max of 11–13 ms comes from GC pauses on 12k-char inputs, which the documented per-isolate flexibility covers. The one ongoing risk is that a heavier future engine (for example LLM orchestration or bigger rule sets) would push past 10 ms. At that point move to Workers Paid ($5/month, 30 s default CPU).

## Local development

```bash
npm install                                   # at the repo root (npm workspaces)
cp services/api/.dev.vars.example services/api/.dev.vars
npm run dev -w @intruva/api                   # wrangler dev on http://127.0.0.1:8787
npm run smoke -w @intruva/api                 # examples/curl.sh against it
```

`.dev.vars.example` contains a **dev-only** key, `itv_local_dev_only_DO_NOT_USE_IN_PRODUCTION_000000`, and its hash. Never add that hash to the production secret. Ports 3000–3002 are used by the web app, so the API uses 8787.

| Script | What it does |
|---|---|
| `npm test -w @intruva/api` | 77 tests (node:test + tsx). They exercise the Worker fetch handler directly under Node and validate responses against the OpenAPI schemas. |
| `npm run typecheck -w @intruva/api` | `src` against `@cloudflare/workers-types`; tests/examples against Node types |
| `npm run build -w @intruva/api` | `wrangler deploy --dry-run --outdir dist`: bundles and validates config, no credentials needed |
| `npm run bench -w @intruva/api` | CPU benchmark above (`bench:no-warmup` for the comparison) |
| `npm run keys:create -w @intruva/api -- <label>` | Same as `node scripts/create-api-key.mjs <label>` |

## Deploy

Deploying needs Cloudflare credentials (`npx wrangler login`, or `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` in CI). Everything runs non-interactively from `services/api`:

```bash
cd services/api
npx wrangler deploy --dry-run --outdir dist                    # sanity check
npx wrangler deploy                                            # → https://intruva-api.<subdomain>.workers.dev
npx wrangler secret put API_KEYS < .api-keys                   # after creating keys (see above)
curl -s https://intruva-api.<subdomain>.workers.dev/v1/health  # smoke
INTRUVA_API_URL=https://intruva-api.<subdomain>.workers.dev INTRUVA_API_KEY=itv_... bash examples/curl.sh
```

| Name | Kind | Default | Purpose |
|---|---|---|---|
| `API_KEYS` | **secret** | none (all keys rejected) | `label:sha256hex` lines |
| `CORS_ORIGINS` | var | Pages origin, `*.intruva.pages.dev` previews, `http://localhost:3001` | CORS allowlist |
| `ANONYMOUS_ORIGINS` | var | empty (off) | Origins allowed without a key (per-IP limited) |
| `RATE_LIMIT_PER_MINUTE` / `ANON_RATE_LIMIT_PER_MINUTE` | var | `60` / `20` | Fallback limiter; keep equal to the bindings |
| `ENVIRONMENT` | var | `production` | Informational |
| `RATE_LIMITER` / `ANON_RATE_LIMITER` | rate-limit binding | 60/60 s, 20/60 s (`namespace_id` 4201/4202) | Per-key / per-IP limits |

Change vars in `wrangler.jsonc` and redeploy. With a custom domain (for example `api.intruva.ai`), add it as a Workers Custom Domain in the dashboard or under `routes`. Then add the new docs/app origins to `CORS_ORIGINS`. To roll back, run `npx wrangler rollback` (or use Deployments → Rollback in the dashboard). Secrets are not versioned with code, so re-put `API_KEYS` if needed.

## Examples

- [`examples/curl.sh`](examples/curl.sh): every endpoint. Defaults to local dev; set `INTRUVA_API_URL` and `INTRUVA_API_KEY` to point it elsewhere.
- [`examples/typescript-client.ts`](examples/typescript-client.ts): scan → analyze → answer questions → optimize → feedback, using the typed client [`src/client.ts`](src/client.ts) (`import { IntruvaClient } from "@intruva/api/client"`). The client is one dependency-free file you can copy anywhere fetch exists.
- [`examples/python_client.py`](examples/python_client.py): the same flow with `requests`, including 429 retry handling.

All three were run against `wrangler dev`.

## Layout

```
src/index.ts      Worker entry (imports warmup, delegates to app)
src/app.ts        routing, CORS, error mapping, security headers, structured logs
src/auth.ts       key registry parsing, SHA-256, constant-time compare, origin matching
src/ratelimit.ts  binding + in-isolate fallback
src/validate.ts   streaming body cap, hand-rolled request validation
src/openapi.ts    OpenAPI 3.1 document (mirrors engine contracts)
src/docs.ts       /docs HTML
src/client.ts     typed fetch client
src/warmup.ts     global-scope engine warm-up
scripts/bench-cpu.ts, test/*.test.ts, examples/*
```

## Known gaps

- The web client (`apps/web/src/lib/api/client.ts`) reads FastAPI-style `detail` on 4xx. This API returns `error.message`, so the web app would show a generic "Request failed (400)". That's harmless while the web app stays on-device, but worth a one-line client change if it ever uses this API.
- Rate limits are per location and approximate (see above). There's no per-key daily quota without storage.
