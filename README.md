# Intruva

**Prompt intelligence: diagnose what your prompt is missing, keep what you meant, and catch risks before you send it to AI.**

**Live:** <https://intruva.pages.dev> · Developers (API, MCP server, extension): <https://intruva.pages.dev/developers/>

Intruva is not another "make my prompt sound better" rewriter. It:

1. Understands the task and your intent.
2. Finds missing, ambiguous, or contradictory context, ranked by impact.
3. Asks only 1–3 high-impact questions (Deep mode). Each one can be skipped.
4. Separates **known facts** from **labelled assumptions**. It never invents context.
5. Builds a structured, task-aware prompt **without dropping any of your words**, and verifies that with intent-preservation checks.
6. Scans for secrets, personal data, prompt injection, and risky agent instructions **on your device** before anything is sent anywhere.

> **Status: pilot preview (demo mode).** The analysis engine currently runs as a deterministic, rule-based engine in the browser. No AI model is connected yet and nothing leaves the device. The UI says so wherever it matters.

## Quick start

```bash
./start.sh          # dev server with hot reload → http://localhost:3001
./start.sh --prod   # production static build, served locally
./stop.sh           # stop everything start.sh launched
scripts/deploy.sh   # test, build, deploy to Cloudflare, smoke-check (see DEPLOYMENT.md)
```

Requires Node 20.9+. The first run installs dependencies automatically.

## Repository layout

```text
intruva/
├── apps/web/          # Next.js 16 + TypeScript + Tailwind v4 web app (static export)
│   └── src/
│       ├── app/                 # routes: / (landing), /workspace, /privacy
│       ├── components/
│       │   ├── ui/              # design-system primitives (glass, buttons, select, toasts…)
│       │   ├── layout/          # header, footer, ambient background, motion prefs
│       │   ├── landing/         # landing sections and interactive demos
│       │   └── workspace/       # editor, diagnosis, clarification, result, diff
│       └── lib/
│           ├── contracts.ts     # API contract types (mirror of the planned FastAPI schemas)
│           ├── api/client.ts    # the single UI ↔ engine seam (demo | remote)
│           ├── engine/          # demo engine: taxonomy, analysis, optimization
│           └── security/        # on-device security scanner
├── scripts/deploy.sh   # one-command deploy to Cloudflare Pages/Workers + smoke checks
├── .github/workflows/  # ci.yml (verify every PR/push), deploy.yml (deploy main to Cloudflare)
├── start.sh / stop.sh  # local run scripts
└── docs (*.md)         # see below
```

## Documentation

| Doc | What's in it |
|---|---|
| [`SETUP.md`](SETUP.md) | Running locally, scripts, environment variables, troubleshooting |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Engine pipeline, contracts, client seam, how the backend plugs in |
| [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) | Liquid-glass tokens, components, motion and accessibility rules |
| [`UI_WALKTHROUGH.md`](UI_WALKTHROUGH.md) | Screen-by-screen tour of every state, plus the sales demo script |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Hosting (Cloudflare Pages + Workers), verified free-tier limits, manual and automatic deploys, secrets, rollback, post-deploy checklist |
| [`BACKEND_MAPPING.md`](BACKEND_MAPPING.md) | Field-by-field map from UI to the planned FastAPI endpoints |

Product plan: `prompt_intelligence_product_plan.md` (kept outside the repo).
