# Deployment

How Intruva is hosted, why, and how to ship, verify, and roll back.

**Live:** <https://intruva.pages.dev> (Cloudflare Pages, production) · secondary mirror: <https://intruva.onrender.com> (Render static site, see [Render mirror](#render-mirror))

| What | Where | How it gets there |
|---|---|---|
| Web app (`apps/web`, Next.js static export) | Cloudflare **Pages** project `intruva` → `https://intruva.pages.dev` | `scripts/deploy.sh` or the `Deploy` GitHub Action |
| MCP server downloads (`packages/mcp`) | Same Pages site, `/downloads/` (`intruva-mcp.tgz`, `intruva-mcp.js`, `manifest.json`) | Generated during the web build by `apps/web/scripts/bundle-downloads.mjs` |
| Developer API (`services/api`) | Cloudflare **Worker** `intruva-api` → `https://intruva-api.<account-subdomain>.workers.dev` | `scripts/deploy.sh` or the `Deploy` GitHub Action (only when `services/api/wrangler.*` exists) |
| Chrome extension (`apps/extension`) | Zip download from the site (`/downloads/`), Chrome Web Store later | Built into the site's downloads during the web build (once `feat/extension` is integrated) |

## Contents

1. [Architecture](#architecture)
2. [Why these services](#why-these-services)
3. [Free-tier limits (verified)](#free-tier-limits-verified)
4. [Manual deploy](#manual-deploy)
5. [Automatic deploys (GitHub Actions)](#automatic-deploys-github-actions)
6. [Environment variables and secrets](#environment-variables-and-secrets)
7. [Rollback](#rollback)
8. [Custom domain (optional)](#custom-domain-optional)
9. [Cost guardrails and when to go paid](#cost-guardrails-and-when-to-go-paid)
10. [Post-deploy checklist](#post-deploy-checklist)
11. [Render mirror](#render-mirror)

---

## Architecture

```text
                       ┌──────────────────────────── Cloudflare (free plans) ────────────────────────────┐
 browser / phone ────▶ │  Pages  "intruva"   static HTML/JS/CSS + /downloads/*   (no Functions, no server)  │
                       │     └─ the engine runs in the browser; prompts never leave the device           │
 API clients ────────▶ │  Worker "intruva-api"   /v1/analyze · /v1/optimize · /v1/security/scan · …       │
                       │     └─ same @intruva/engine, API keys as SHA-256 hashes in the API_KEYS secret   │
                       └─────────────────────────────────────────────────────────────────────────────────┘
 MCP clients (Claude Desktop, Cursor, …) run intruva-mcp locally:
     npx -y --package=https://intruva.pages.dev/downloads/intruva-mcp.tgz intruva-mcp
```

- **Web**: `next build` with `output: "export"` writes plain files to `apps/web/out`. Pages serves them from its CDN. `apps/web/public/_headers` adds security headers (nosniff, `X-Frame-Options: DENY`, HSTS, Referrer-Policy, Permissions-Policy, COOP), long-lived caching for hashed `/_next/static/*`, and a 5-minute cache for `/downloads/*`. `trailingSlash: true` gives every route a `…/index.html`, and `404.html` is served for unknown paths with status 404.
- **MCP server**: distributed from the site, not npm (yet). `bundle-downloads.mjs` runs before every web build (`prebuild`) and `npm pack`s `packages/mcp`. It also writes a single-file build, third-party licenses, and `manifest.json` with version, sizes, and SHA-256 hashes, which `/developers` reads at build time. It moves to npm (`npx intruva-mcp`) once the package is published.
- **API**: a Cloudflare Worker that imports the same `@intruva/engine`. It has no database. API keys are stored only as hashes in a Worker secret. Rate limits use the Workers Rate Limiting binding, with an in-isolate fallback. Prompts are not logged. Details are in `services/api/README.md`.
- **Extension**: a Chrome MV3 extension zip, downloadable from `/developers#extension` and installed with *Load unpacked*. It moves to the Chrome Web Store after the pilot.

## Why these services

From the product plan (§29.1–29.2): a commercial pilot with 3–5 customers, $0 infrastructure where free tiers fit, and **no cold starts**, because a prospect may open the link on a phone during a sales call.

- **Cloudflare Pages**: the app is a static export, so there's no server and nothing to cold-start. Static requests are free and unlimited, and the site is served from Cloudflare's edge.
- **Cloudflare Workers** for the API: it runs the same TypeScript engine with no extra runtime. Isolates start in milliseconds with no sleeping instance, and the free plan allows 100k requests/day.
- **GitHub Actions** for CI/CD. The Pages project was created by direct upload (`Git Provider: No`), and Cloudflare doesn't allow connecting Git to a direct-upload project later. CI therefore deploys with `wrangler pages deploy`, the same command `scripts/deploy.sh` uses.
- **Not chosen**: Vercel Hobby, whose terms restrict it to personal, non-commercial use (plan §29.2). Render Free web services, which sleep when idle; this matters for the API. The Render *static* site has no cold start and stays as a mirror only.

## Free-tier limits (verified)

Checked on 2026-11-22 against Cloudflare's official docs. Re-check before launch, because free plans change.

**Cloudflare Pages (Free)**, from <https://developers.cloudflare.com/pages/platform/limits/>:

| Limit | Free | Intruva today |
|---|---|---|
| Builds (deploys) per month | **500** | One per push to `main` plus manual deploys |
| Concurrent builds | 1 | The deploy workflow uses `concurrency` and never overlaps |
| Files per site | **20,000** | Fewer than 100 (CI fails if `out/` reaches 20,000) |
| Max size of a single file | **25 MiB** | MCP tgz and js files are a few hundred KiB |
| Custom domains per project | 100 | 0 |
| `_headers` rules | 100 | 3 |
| Redirects | 2,000 static + 100 dynamic | 0 |
| Static asset requests | **Free and unlimited** on free and paid plans ([Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/)) | The site uses no Functions |

**Cloudflare Workers (Free)**, from <https://developers.cloudflare.com/workers/platform/limits/> and <https://developers.cloudflare.com/workers/platform/pricing/>:

| Limit | Free | Notes |
|---|---|---|
| Requests | **100,000 / day**, reset at 00:00 UTC | Beyond that, requests fail with error 1027 until the reset. They are not billed. |
| CPU time | **10 ms per invocation** | The engine is CPU-bound. Body-size limits keep requests inside this budget (see `services/api/README.md`). |
| Memory | 128 MB per isolate | |
| Subrequests | 50 per invocation | The API makes none |
| Worker size | 64 MiB uncompressed | About 120 KiB |
| Workers per account | 100 | 1 |
| Env vars and secrets | 64 per Worker, 5 KB each | `API_KEYS` holds one `label:hash` line per key (about 80 bytes), so roughly 60 keys fit before you need KV |
| Paid plan | $5/month minimum: 10M requests and 30M CPU-ms included, up to 5 min CPU per request | |

**Workers Rate Limiting binding**: it has been GA since 2025-09-19 ([changelog](https://developers.cloudflare.com/changelog/2025-09-19-ratelimit-workers-ga/), [docs](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)). The docs don't say which plans include it. Whether the free account accepts it is shown by the result of the first real `wrangler deploy` of `intruva-api` (recorded under [API deploy notes](#api-deploy-notes)). Limits are per Cloudflare location and eventually consistent, so treat them as a guardrail rather than a meter. Periods must be 10 or 60 seconds.

**Commercial use: confirm this yourself.** I read Cloudflare's [Self-Serve Subscription Agreement](https://www.cloudflare.com/terms/) and the [Developer Platform service-specific terms](https://www.cloudflare.com/service-specific-terms-developer-platform/) on 2026-11-22. Neither contained a clause limiting free plans to personal or non-commercial use. That is my reading, not a legal confirmation, so **the account owner must confirm commercial-use eligibility in Cloudflare's current terms before charging customers.** Two clauses do apply:
- Free services come with no liability or SLA from Cloudflare (§2.6).
- Web properties on free services must not process or collect credit-card information (§2.2.1(h)). Intruva doesn't, so keep payments on a separate provider such as Stripe Checkout.

## Manual deploy

One command from the repo root, on `main`, with a clean tree:

```bash
scripts/deploy.sh                 # preflight → npm ci (if needed) → typecheck, all tests, lint → build → deploy Pages (+ Worker) → smoke checks
scripts/deploy.sh --web-only      # only the Pages site
scripts/deploy.sh --api-only      # only the Worker
scripts/deploy.sh --skip-tests    # emergency redeploy: no typecheck, tests, or lint
scripts/deploy.sh --smoke-only    # deploy nothing; check the live site (and API_URL=… if set)
scripts/deploy.sh --preview       # from a feature branch: Pages preview at https://<branch>.intruva.pages.dev
```

**Prerequisites**
- Node 20.9+ and curl.
- Wrangler logged in: run `npx wrangler@4 login` once (OAuth in the browser), then `npx wrangler@4 whoami`. You can use `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment instead.

**What it does**
1. Preflight. It refuses a production deploy from a branch other than `main`, or with uncommitted changes (`--allow-dirty` overrides the second).
2. Runs `npm ci` when `node_modules` is missing or older than `package-lock.json`.
3. Runs `npm run typecheck --workspaces --if-present`, `npm test --workspaces --if-present` (engine, MCP, API, extension), and `npm run lint -w @intruva/web`.
4. Runs `npm run build -w @intruva/web`, which generates the MCP downloads first. It checks that `out/index.html`, `_headers`, and `downloads/manifest.json` exist and that the file count is under 20,000.
5. Runs `wrangler pages deploy apps/web/out --project-name intruva --branch main --commit-hash … --commit-message …`.
6. If `services/api/wrangler.*` exists, runs `wrangler deploy` from `services/api`.
7. Smoke checks: `/`, `/workspace/`, `/developers/`, `/privacy/`, and `/downloads/{manifest.json,intruva-mcp.tgz,intruva-mcp.js}` must return 200. A bogus path must return 404. Security headers must be present and `manifest.json` must parse. For the API, `/v1/health` must return 200 and a keyless POST to `/v1/analyze` must return 401. It retries for up to 30 s while the deploy propagates.
8. Prints the live URLs.

> **Wrangler quirk (4.166.0):** `wrangler pages project create` run from this monorepo's root tries to hand off to Workers and fails. The `intruva` project already exists, so you don't need it: `pages deploy` works as is, without `--force`. Never recreate the project.

## Automatic deploys (GitHub Actions)

| Workflow | Trigger | Does |
|---|---|---|
| `.github/workflows/ci.yml` | Every PR, push to `main`, manual | Node 22, `npm ci`, typecheck, tests, and build for all workspaces, plus web lint. Checks the static export and uploads `apps/web/out` as the `web-out` artifact (kept 7 days). |
| `.github/workflows/deploy.yml` | Push to `main`, manual (*Actions → Deploy → Run workflow*) | Tests and builds, then `cloudflare/wrangler-action@v4` runs `pages deploy` and, when `services/api` exists, `deploy` for the Worker. Then it runs the smoke checks. `concurrency: deploy-production` stops deploys from overlapping. **If the secrets below are missing, the deploy steps are skipped with a notice and the run stays green.** |

**One-time setup (the repo owner does this; the token never goes in the repo or in chat):**

1. **Create a least-privilege API token.** In the Cloudflare dashboard, go to *My Profile → API Tokens → Create Token → Create Custom Token* (<https://dash.cloudflare.com/profile/api-tokens>) and set:
   - *Token name*: `intruva-github-deploy`
   - *Permissions*: **Account → Cloudflare Pages → Edit** and **Account → Workers Scripts → Edit**
   - *Account Resources*: **Include → Ankur42177's account** (the one with ID `d29eba259fbe19a916145cedbb2df311`), not "All accounts".
   - *Client IP filtering*: leave empty, because GitHub-hosted runners have changing IPs.
   - *TTL*: optional. An expiry such as 1 year forces a yearly rotation.
   - Choose *Continue to summary → Create Token* and copy the token. It is shown only once.
2. **Add the repository secrets.** On GitHub, go to <https://github.com/Ankur42177/Intruva> → *Settings → Secrets and variables → Actions → New repository secret*:
   - `CLOUDFLARE_API_TOKEN`: the token from step 1.
   - `CLOUDFLARE_ACCOUNT_ID`: `d29eba259fbe19a916145cedbb2df311`. This is also on the dashboard's Workers & Pages overview, in the right sidebar.
3. Trigger the workflow from *Actions → Deploy → Run workflow*, or push to `main`. Check that the run summary lists the deployed URLs.

If a deploy fails with `Authentication error [code: 10000]` on a specific endpoint, add only the permission that endpoint names. For example, *Account Settings → Read* if wrangler needs to list memberships. Don't switch to a broader template token.

**Rotating the token**: create a new token, update the `CLOUDFLARE_API_TOKEN` secret, run the Deploy workflow, then delete the old token in the dashboard.

## Environment variables and secrets

**Web (build time, all optional).** Set them in the shell for `scripts/deploy.sh`. For CI, set them as **Variables** (not secrets) under *Settings → Secrets and variables → Actions → Variables*; `deploy.yml` passes them to the build.

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://intruva.pages.dev` | Origin used in the copy-paste download commands on `/developers` |
| `NEXT_PUBLIC_INTRUVA_API_PUBLIC_URL` | the deployed Worker URL | Base URL shown in the API samples on `/developers` |
| `NEXT_PUBLIC_INTRUVA_API_URL` | *(empty, demo mode)* | When set, the workspace calls the API instead of the in-browser engine. Leave it empty for the pilot: the on-device engine is faster and keeps prompts on the device. |
| `NEXT_PUBLIC_FEEDBACK_URL` | *(empty)* | Pilot feedback form link |

Everything `NEXT_PUBLIC_*` is embedded in public JavaScript. **Never put a secret in one.**

**API Worker** (`services/api/wrangler.jsonc`):
- `vars`: `CORS_ORIGINS`, `ANONYMOUS_ORIGINS`, `RATE_LIMIT_PER_MINUTE`, `ANON_RATE_LIMIT_PER_MINUTE`, and `ENVIRONMENT`. These are committed and non-secret.
- Secret `API_KEYS`: one `label:sha256hex` line per key. Only hashes are stored. Manage it with:

```bash
# new key: the plaintext goes to a file outside the repo; only the hash line reaches Cloudflare
node scripts/create-api-key.mjs <label> --entry-only 2>"$HOME/intruva-key-<label>.txt" \
  | (cd services/api && npx wrangler@4 secret put API_KEYS)
```

`secret put` **replaces** the whole value. To add a key without revoking the others, pipe *all* the `label:hash` lines you want to keep, newline-separated. Remove a line to revoke a key. Hand the plaintext key to the customer over a private channel, then delete the file.

## Rollback

**Web (Pages)**
- **Fastest: dashboard.** Go to *Workers & Pages → intruva → Deployments*, find the last good production deployment, then *⋯ → Rollback to this deployment*. It takes effect instantly with no rebuild.
- **List deployments from the CLI**: `npx wrangler@4 pages deployment list --project-name intruva`. Every deployment keeps its own immutable URL (`https://<id>.intruva.pages.dev`), so you can check a candidate before rolling back to it.
- **From git**: `git revert <bad-sha>` on `main`, push, and let CI deploy or run `scripts/deploy.sh`. Don't force-push or rewrite `main`.

**API (Worker)**
- `cd services/api && npx wrangler@4 deployments list` shows recent deployments and versions.
- `npx wrangler@4 rollback` goes back to the previous version. `npx wrangler@4 rollback <version-id>` goes back to a specific one. A rollback doesn't touch secrets, so a key revoked since then stays revoked.
- Dashboard: *Workers & Pages → intruva-api → Deployments*.

## Custom domain (optional)

The free `*.pages.dev` and `*.workers.dev` subdomains are fine for the pilot (plan §29.2). If you want a branded domain later:
1. Register a domain. Cloudflare Registrar sells at cost. Add the domain to Cloudflare as a zone on the free plan.
2. **Pages**: *Workers & Pages → intruva → Custom domains → Set up a custom domain*, then enter `app.example.com` or the apex domain. Cloudflare creates the DNS record and certificate.
3. **Worker**: add `"routes": [{ "pattern": "api.example.com", "custom_domain": true }]` to `services/api/wrangler.jsonc` and deploy.
4. Update `CORS_ORIGINS` (Worker), `NEXT_PUBLIC_SITE_URL`, and `NEXT_PUBLIC_INTRUVA_API_PUBLIC_URL`, then redeploy both. Keep the `pages.dev` origin in CORS until all links are switched.

## Cost guardrails and when to go paid

- **What can't happen on the free plans**: you can't be billed. When a limit is reached, Workers return error 1027 until 00:00 UTC, and Pages deploys are refused after 500 in a month.
- **What to watch**: in the dashboard, check *Workers & Pages → intruva-api → Metrics* (requests per day, CPU time, errors) and the Pages deployment count each month. The Worker logs a structured line per request, without prompt text.
- **Defenses already in place**: every API call needs a key unless `ANONYMOUS_ORIGINS` is set. There are per-key and per-IP rate limits, a request-body size limit (which also bounds CPU), static assets that cost nothing, and a deploy workflow that can't run concurrent builds.
- **Upgrade to Workers Paid ($5/month) when any of these happens** (plan §29.7):
  - API traffic stays above about 50k requests/day, which is half the free quota.
  - Requests regularly fail on the 10 ms CPU limit, for example because customers need bigger prompts.
  - A customer needs a daily quota guarantee.
  - You need Workers features the free plan lacks.
- **Pages** rarely needs a paid plan for a static site. Upgrade only if you exceed 500 deploys/month or need more concurrent builds.

## Post-deploy checklist

`scripts/deploy.sh` automates the first four checks. Do the rest by hand after any user-visible change:

- [ ] `/`, `/workspace/`, `/developers/`, and `/privacy/` return 200, and `/does-not-exist/` returns the styled 404 page with status 404.
- [ ] `curl -sI https://intruva.pages.dev/` shows `x-frame-options`, `strict-transport-security`, and `x-content-type-options`.
- [ ] `https://intruva.pages.dev/downloads/manifest.json` shows the expected MCP version and SHA-256.
- [ ] `npx -y --package=https://intruva.pages.dev/downloads/intruva-mcp.tgz intruva-mcp --version` prints that version.
- [ ] **On a real phone, using the real URL (not localhost)**: the landing page loads in under 3 s on mobile data, the hero and *Optimize* button are reachable without horizontal scroll, and `/workspace/?sample=secret` shows the security findings without layout overflow.
- [ ] Desktop at 1440 px: the workspace flow (Analyze, Clarify, Optimize, Diff) works end to end, with no console errors in DevTools.
- [ ] `/developers`: the MCP and extension download cards show the current version and their downloads work. The API samples point at the live Worker URL.
- [ ] API (when deployed): `/v1/health` returns 200, a keyless call returns 401, and a call with a pilot key works. CORS preflight from `https://intruva.pages.dev` is allowed.
- [ ] GitHub: the latest `CI` and `Deploy` runs on `main` are green.

## Render mirror

The original static site at <https://intruva.onrender.com> still exists, but **its GitHub auto-deploy isn't firing**, so it may serve an older build. It's kept as a secondary mirror and is not deployed by `scripts/deploy.sh` or CI. Don't share it with customers; `https://intruva.pages.dev` is canonical. To update it, trigger a manual deploy from the Render dashboard. To retire it, suspend or delete the service there. Nothing in this repo depends on it.

## API deploy notes

*This section is filled in when `services/api` is first deployed (Worker URL, Rate Limiting binding result on the free plan, smoke-test results).*
