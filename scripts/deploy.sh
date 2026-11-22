#!/usr/bin/env bash
# Intruva — one-command deploy to Cloudflare (Pages for the web app, Workers for the API).
#
#   scripts/deploy.sh                 test → build → deploy web (+ API if services/api exists) → smoke checks
#   scripts/deploy.sh --web-only      only the Pages site (apps/web → https://intruva.pages.dev)
#   scripts/deploy.sh --api-only      only the Worker (services/api → intruva-api.<subdomain>.workers.dev)
#   scripts/deploy.sh --skip-tests    skip typecheck/tests/lint (emergency redeploys only)
#   scripts/deploy.sh --smoke-only    deploy nothing; just run the live smoke checks
#   scripts/deploy.sh --preview       deploy the web app as a Pages *preview* for the current git branch
#   scripts/deploy.sh --allow-dirty   deploy even with uncommitted changes (marked dirty in Pages)
#
# Requirements: Node >= 20.9, npm, curl, and a logged-in Wrangler (`npx wrangler@4 login`)
# or CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in the environment.
# Env overrides: WRANGLER (default "npx --yes wrangler@4"), PAGES_PROJECT (default "intruva"),
# SITE_URL (default "https://intruva.pages.dev"), API_URL (default: parsed from `wrangler deploy`).
# See DEPLOYMENT.md for the full runbook.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PAGES_PROJECT="${PAGES_PROJECT:-intruva}"
PRODUCTION_BRANCH="main"
SITE_URL="${SITE_URL:-https://intruva.pages.dev}"
API_URL="${API_URL:-}"
WRANGLER="${WRANGLER:-npx --yes wrangler@4}"
WEB_OUT="apps/web/out"
API_DIR="services/api"

DO_WEB=1 DO_API=1 DO_TESTS=1 DO_DEPLOY=1 PREVIEW=0 ALLOW_DIRTY=0

usage() { sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --web-only) DO_API=0 ;;
    --api-only) DO_WEB=0 ;;
    --skip-tests) DO_TESTS=0 ;;
    --smoke-only) DO_DEPLOY=0; DO_TESTS=0 ;;
    --preview) PREVIEW=1; DO_API=0 ;;
    --allow-dirty) ALLOW_DIRTY=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

# ---------------------------------------------------------------- helpers
if [ -t 1 ]; then B=$'\033[1m' G=$'\033[32m' Y=$'\033[33m' R=$'\033[31m' N=$'\033[0m'; else B="" G="" Y="" R="" N=""; fi
step() { printf '\n%s==> %s%s\n' "$B" "$*" "$N"; }
ok()   { printf '  %s✓%s %s\n' "$G" "$N" "$*"; }
warn() { printf '  %s!%s %s\n' "$Y" "$N" "$*"; }
die()  { printf '%s✗ %s%s\n' "$R" "$*" "$N" >&2; exit 1; }
wr()   { $WRANGLER "$@"; }

api_present() { ls "$API_DIR"/wrangler.* >/dev/null 2>&1; }
if [ "$DO_API" = 1 ] && ! api_present; then DO_API=0; API_SKIPPED_REASON="no $API_DIR/wrangler.* yet"; fi
[ "$DO_WEB" = 0 ] && [ "$DO_API" = 0 ] && [ "$DO_DEPLOY" = 1 ] && die "Nothing to deploy (${API_SKIPPED_REASON:-check flags})."

# ---------------------------------------------------------------- preflight
step "Preflight"
command -v node >/dev/null || die "node not found (need >= 20.9)"
command -v npm  >/dev/null || die "npm not found"
command -v curl >/dev/null || die "curl not found"
node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>20||(a===20&&b>=9)?0:1)' \
  || die "Node $(node -v) is too old; need >= 20.9"
ok "node $(node -v), npm $(npm -v)"

GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
GIT_SHA="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
GIT_MSG="$(git log -1 --pretty=%s 2>/dev/null || echo "manual deploy")"
DIRTY=0; [ -n "$(git status --porcelain 2>/dev/null)" ] && DIRTY=1
ok "git $GIT_BRANCH @ ${GIT_SHA:0:7}$([ $DIRTY = 1 ] && echo ' (dirty)')"

if [ "$DO_DEPLOY" = 1 ]; then
  if [ "$PREVIEW" = 1 ]; then
    PAGES_BRANCH="$GIT_BRANCH"
    [ "$PAGES_BRANCH" = "$PRODUCTION_BRANCH" ] && die "--preview is for non-main branches; on main just run without it."
  else
    PAGES_BRANCH="$PRODUCTION_BRANCH"
    [ "$GIT_BRANCH" = "$PRODUCTION_BRANCH" ] || die "Production deploys must run from '$PRODUCTION_BRANCH' (on '$GIT_BRANCH'). Use --preview for a branch preview."
  fi
  [ "$DIRTY" = 1 ] && [ "$ALLOW_DIRTY" = 0 ] && die "Uncommitted changes. Commit first, or pass --allow-dirty."

  WHOAMI="$(wr whoami 2>&1)" || die "wrangler whoami failed — run: npx wrangler@4 login"
  if printf '%s' "$WHOAMI" | grep -qi "not authenticated"; then die "Wrangler is not logged in — run: npx wrangler@4 login"; fi
  ok "wrangler authenticated ($(printf '%s' "$WHOAMI" | grep -Eo '[[:alnum:]._%+-]+@[[:alnum:].-]+' | head -1 || echo 'API token'))"
fi

# ---------------------------------------------------------------- install
step "Dependencies"
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  npm ci --no-audit --no-fund
  ok "npm ci"
else
  ok "node_modules up to date"
fi

# ---------------------------------------------------------------- verify
if [ "$DO_TESTS" = 1 ]; then
  step "Typecheck"
  npm run typecheck --workspaces --if-present
  step "Tests (all workspaces)"
  npm test --workspaces --if-present
  step "Lint (web)"
  npm run lint -w @intruva/web
  ok "typecheck, tests, lint passed"
else
  warn "skipping typecheck/tests/lint (--skip-tests)"
fi

# ---------------------------------------------------------------- web
PAGES_DEPLOY_URL=""
if [ "$DO_DEPLOY" = 1 ] && [ "$DO_WEB" = 1 ]; then
  step "Build web (static export + MCP downloads)"
  npm run build -w @intruva/web
  [ -f "$WEB_OUT/index.html" ] || die "$WEB_OUT/index.html missing after build"
  [ -f "$WEB_OUT/downloads/manifest.json" ] || die "$WEB_OUT/downloads/manifest.json missing (bundle-downloads did not run?)"
  [ -f "$WEB_OUT/_headers" ] || die "$WEB_OUT/_headers missing"
  FILES=$(find "$WEB_OUT" -type f | wc -l | tr -d ' ')
  [ "$FILES" -lt 20000 ] || die "$FILES files exceeds the Pages limit of 20,000"
  ok "$WEB_OUT: $FILES files ($(du -sh "$WEB_OUT" | cut -f1))"

  step "Deploy web → Cloudflare Pages ($PAGES_PROJECT, branch $PAGES_BRANCH)"
  PAGES_LOG="$(mktemp)"
  wr pages deploy "$WEB_OUT" --project-name "$PAGES_PROJECT" --branch "$PAGES_BRANCH" \
      --commit-hash "$GIT_SHA" --commit-message "$GIT_MSG" --commit-dirty="$([ $DIRTY = 1 ] && echo true || echo false)" \
    2>&1 | tee "$PAGES_LOG"
  [ "${PIPESTATUS[0]}" = 0 ] || die "pages deploy failed"
  PAGES_DEPLOY_URL="$(grep -Eo 'https://[a-z0-9-]+\.'"$PAGES_PROJECT"'\.pages\.dev' "$PAGES_LOG" | tail -1 || true)"
  rm -f "$PAGES_LOG"
  [ "$PREVIEW" = 1 ] && SITE_URL="https://$(printf '%s' "$PAGES_BRANCH" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g').$PAGES_PROJECT.pages.dev"
  ok "deployed ${PAGES_DEPLOY_URL:-(see output above)}"
fi

# ---------------------------------------------------------------- api
if [ "$DO_DEPLOY" = 1 ] && [ "$DO_API" = 1 ]; then
  step "Deploy API → Cloudflare Workers ($API_DIR)"
  API_LOG="$(mktemp)"
  (cd "$API_DIR" && $WRANGLER deploy) 2>&1 | tee "$API_LOG"
  [ "${PIPESTATUS[0]}" = 0 ] || die "wrangler deploy failed"
  [ -z "$API_URL" ] && API_URL="$(grep -Eo 'https://[a-z0-9.-]+\.workers\.dev' "$API_LOG" | head -1 || true)"
  rm -f "$API_LOG"
  ok "deployed ${API_URL:-(URL not detected; set API_URL to smoke-test)}"
elif [ "$DO_API" = 0 ] && [ -n "${API_SKIPPED_REASON:-}" ]; then
  warn "API not deployed: $API_SKIPPED_REASON"
fi

# ---------------------------------------------------------------- smoke checks
step "Smoke checks"
FAILS=0
check() { # check <expected-status> <url> [label] [extra curl args...]
  local want="$1" url="$2" label="${3:-$2}" got="" _
  shift 3 2>/dev/null || shift $#
  for _ in 1 2 3 4 5 6; do   # Pages/Workers propagation usually takes a few seconds
    got="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$@" "$url" || true)"
    [ "$got" = "$want" ] && break
    sleep 5
  done
  if [ "$got" = "$want" ]; then ok "$got $label"; else printf '  %s✗%s %s (got %s, want %s)\n' "$R" "$N" "$label" "$got" "$want"; FAILS=$((FAILS+1)); fi
}
check_header() { # check_header <url> <header-name>
  if curl -sI --max-time 20 "$1" | grep -qi "^$2:"; then ok "header $2"; else printf '  %s✗%s header %s missing on %s\n' "$R" "$N" "$2" "$1"; FAILS=$((FAILS+1)); fi
}

if [ "$DO_WEB" = 1 ]; then
  for path in / /workspace/ /developers/ /privacy/ /downloads/manifest.json /downloads/intruva-mcp.tgz /downloads/intruva-mcp.js; do
    check 200 "$SITE_URL$path" "$SITE_URL$path"
  done
  check 404 "$SITE_URL/this-route-does-not-exist-$RANDOM/" "404 for unknown path"
  for h in x-content-type-options x-frame-options strict-transport-security referrer-policy; do check_header "$SITE_URL/" "$h"; done
  # shellcheck disable=SC2016  # JS template literal, not shell
  if MANIFEST="$(curl -s --max-time 20 "$SITE_URL/downloads/manifest.json")" && \
     printf '%s' "$MANIFEST" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const m=JSON.parse(s);if(!m.version||!m.files?.tarball?.sha256)process.exit(1);console.log(`  manifest: ${m.name}@${m.version}, built ${m.built_at}`)})'; then
    ok "manifest.json parses"
  else
    printf '  %s✗%s manifest.json invalid\n' "$R" "$N"; FAILS=$((FAILS+1))
  fi
fi
if [ "$DO_API" = 1 ] || { [ "$DO_DEPLOY" = 0 ] && [ -n "$API_URL" ]; }; then
  if [ -n "$API_URL" ]; then
    check 200 "$API_URL/v1/health" "API $API_URL/v1/health"
    check 401 "$API_URL/v1/analyze" "API rejects a request without a key (401)" \
      -X POST -H 'content-type: application/json' --data '{"prompt":"smoke test"}'
  else
    warn "API URL unknown; skipping API smoke checks (set API_URL=...)"
  fi
fi

# ---------------------------------------------------------------- summary
step "Live"
[ "$DO_WEB" = 1 ] && echo "  Web:        $SITE_URL"
[ -n "$PAGES_DEPLOY_URL" ] && echo "  This build: $PAGES_DEPLOY_URL"
[ "$DO_WEB" = 1 ] && echo "  MCP:        npx -y --package=$SITE_URL/downloads/intruva-mcp.tgz intruva-mcp"
[ -n "$API_URL" ] && echo "  API:        $API_URL"
echo "  Mirror:     https://intruva.onrender.com (Render static site; not deployed by this script)"
if [ "$FAILS" -gt 0 ]; then die "$FAILS smoke check(s) failed"; fi
ok "all smoke checks passed"
