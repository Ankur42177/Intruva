# Setup & local development

## Requirements

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20.9 or newer (22 LTS recommended) | `node -v` |
| npm | 10+ | ships with Node |
| Google Chrome | any recent | only for the extension and headless screenshots |
| macOS / Linux | — | the scripts are bash; on Windows use WSL |

No database, Docker, Python, or cloud account is needed to run Intruva locally.

## One-command start

```bash
./start.sh              # dev server with hot reload → http://localhost:3001
./start.sh --open       # …and open the browser
./start.sh --prod       # production static build (apps/web/out) served locally
./start.sh --port 4000  # different port
./start.sh -f           # foreground (Ctrl+C to stop)
./stop.sh               # stop everything start.sh started
./stop.sh --port        # also free the port if a stray Intruva dev server holds it
./stop.sh --clean       # also delete .run/ logs
```

`start.sh`:

1. Checks Node ≥ 20 and that the port is free.
2. Runs one `npm ci` at the repo root (npm workspaces) when `package-lock.json` is newer than `node_modules`.
3. Starts the API from `services/api` if it exists and points the web app at it; otherwise the web app uses the on-device engine.
4. Starts the web app in the background, writes `.run/web.pid`, `.run/web.port`, `.run/web.log`, waits for HTTP 200, and prints the URLs.

`stop.sh` kills the whole process tree from the PID files. It only frees a port with `--port`, and even then only if the process's working directory is inside this repo.

## Manual commands

```bash
npm install                       # once, at the repo root
npm run dev                       # web app on :3000 (Next default)
npm run build                     # static export → apps/web/out
npm run lint                      # web lint
npm test                          # engine test suite (72 tests)
npm run typecheck                 # every workspace that defines it
npm test --workspaces --if-present   # all workspace tests
```

Per workspace:

```bash
npm run dev   -w @intruva/web
npm test      -w @intruva/engine
```

The API, extension and MCP packages document their own scripts in their READMEs (`services/api`, `apps/extension`, `packages/mcp`).

## Workspace layout

```text
intruva/
├── package.json            # npm workspaces: packages/*, apps/*, services/*
├── packages/engine         # @intruva/engine: the shared engine (TS source, no deps)
├── packages/mcp            # intruva-mcp: MCP server
├── apps/web                # @intruva/web: Next.js 16 static site
├── apps/extension          # @intruva/extension: Chrome MV3 extension
└── services/api            # @intruva/api: Cloudflare Worker REST API
```

`@intruva/engine` exports TypeScript source. Every consumer compiles it:
- Next uses `transpilePackages`.
- The Worker is bundled by wrangler.
- The extension and the MCP server are bundled with esbuild.

There is nothing to pre-build.

## Environment variables (web)

Copy `.env.example` to `apps/web/.env.local` if you need any of these. All are optional and read at build time.

| Variable | Default | Effect |
|---|---|---|
| `NEXT_PUBLIC_INTRUVA_API_URL` | *(empty)* | Empty means demo mode (engine in the browser). When set, the workspace calls the API, and the header indicator switches to "Live engine". |
| `NEXT_PUBLIC_INTRUVA_API_PUBLIC_URL` | placeholder | Base URL shown in the code samples on `/developers`. |
| `NEXT_PUBLIC_FEEDBACK_URL` | *(empty)* | Shows a "Did this help?" card that links to your form with `rating`, `task` and `mode` only. It never includes prompt text. |

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Port 3001 is already in use` | `./stop.sh --port`, or `./start.sh --port 3002`. `lsof -iTCP:3001 -sTCP:LISTEN` shows the owner. |
| `node_modules/.bin/...: no such file` after moving the folder (iCloud, zip, etc.) | Symlinks were lost. Delete `node_modules` and run `npm install` at the root. |
| Landing page has no animation | Your OS has *Reduce motion* on, so Intruva respects it. Click **Motion off → on** in the header to force animations. |
| Hero shows a soft CSS orb instead of the glass sculpture | WebGL is unavailable or disabled in this browser. The fallback is intentional. |
| `Module not found: @intruva/engine` | Run `npm install` at the repo root, not inside `apps/web`. |
| TypeScript complains about `.next/dev/types/*.ts` | Stale dev types. Start `npm run dev` once, or delete `apps/web/.next`. |

## Recommended project location

Keep the repo **outside iCloud Drive / Dropbox / OneDrive** (for example `~/Projects/intruva`). Sync services strip symlinks inside `node_modules` and can move or evict files while the dev server runs.
