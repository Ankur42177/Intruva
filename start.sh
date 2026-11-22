#!/usr/bin/env bash
# =============================================================================
# Intruva — start script
#
# Starts the Intruva web app in the background, writes PID + logs to .run/,
# waits until it responds, then prints the URLs. When services/api exists
# (FastAPI, next milestone) it is started too and the web app is pointed at it.
#
# Usage:
#   ./start.sh              # development mode (hot reload)  → http://localhost:3001
#   ./start.sh --prod       # production static build, served locally
#   ./start.sh --port 4000  # custom port
#   ./start.sh --open       # open the browser when ready
#   ./start.sh --foreground # run attached to this terminal (Ctrl+C to stop)
#
# Stop everything with ./stop.sh
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$ROOT/apps/web"
API_DIR="$ROOT/services/api"
RUN_DIR="$ROOT/.run"

MODE="dev"
PORT="${PORT:-3001}"
API_PORT="${API_PORT:-8000}"
OPEN_BROWSER=0
FOREGROUND=0

c_reset=$'\033[0m'; c_dim=$'\033[2m'; c_bold=$'\033[1m'
c_iris=$'\033[38;5;141m'; c_aqua=$'\033[38;5;80m'; c_ok=$'\033[38;5;78m'; c_err=$'\033[38;5;203m'; c_warn=$'\033[38;5;221m'

info() { printf "%s›%s %s\n" "$c_iris" "$c_reset" "$*"; }
ok()   { printf "%s✓%s %s\n" "$c_ok" "$c_reset" "$*"; }
warn() { printf "%s!%s %s\n" "$c_warn" "$c_reset" "$*"; }
fail() { printf "%s✗%s %s\n" "$c_err" "$c_reset" "$*" >&2; exit 1; }
usage() { sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'; exit 0; }

port_in_use() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }
is_running() { [[ -f "$1" ]] && kill -0 "$(cat "$1")" 2>/dev/null; }

wait_for_http() {
  local url="$1" name="$2" timeout="$3" pid="$4" logfile="$5" i=0
  printf "%s›%s Waiting for %s " "$c_iris" "$c_reset" "$name"
  until curl -fsS -o /dev/null "$url" 2>/dev/null; do
    if ! kill -0 "$pid" 2>/dev/null; then
      printf "\n"; warn "$name exited during startup. Last log lines:"
      tail -n 25 "$logfile" >&2 || true
      exit 1
    fi
    (( i++ >= timeout )) && { printf "\n"; fail "$name did not respond within ${timeout}s (log: $logfile)"; }
    printf "."; sleep 1
  done
  printf " %sready%s\n" "$c_ok" "$c_reset"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prod|--production) MODE="prod" ;;
    --dev) MODE="dev" ;;
    --port) PORT="${2:?--port needs a value}"; shift ;;
    --open) OPEN_BROWSER=1 ;;
    --foreground|-f) FOREGROUND=1 ;;
    -h|--help) usage ;;
    *) fail "Unknown option: $1 (try --help)" ;;
  esac
  shift
done

printf "\n%s%s  Intruva%s %s· prompt intelligence%s\n\n" "$c_bold" "$c_iris" "$c_reset" "$c_dim" "$c_reset"

# ------------------------------------------------------------------ preflight
command -v node >/dev/null 2>&1 || fail "Node.js is not installed. Install Node 20.9+ from https://nodejs.org"
command -v npm  >/dev/null 2>&1 || fail "npm is not installed."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
(( NODE_MAJOR >= 20 )) || fail "Node $NODE_MAJOR found; Intruva needs Node 20.9 or newer."
ok "Node $(node -v)"

[[ -d "$WEB_DIR" ]] || fail "Web app not found at $WEB_DIR"
mkdir -p "$RUN_DIR"
WEB_PID="$RUN_DIR/web.pid"; WEB_LOG="$RUN_DIR/web.log"

if is_running "$WEB_PID"; then
  ok "Already running (PID $(cat "$WEB_PID")) → http://localhost:$(cat "$RUN_DIR/web.port" 2>/dev/null || echo "$PORT")"
  info "Restart with: ./stop.sh && ./start.sh"
  exit 0
fi
port_in_use "$PORT" && fail "Port $PORT is already in use. Run ./stop.sh, free the port, or use --port <n>."

# --------------------------------------------------------------- dependencies
# npm workspaces: one install at the repository root covers every package.
cd "$ROOT"
if [[ ! -d node_modules ]] || [[ package-lock.json -nt node_modules/.package-lock.json ]]; then
  info "Installing dependencies for all workspaces (first run can take a minute)…"
  npm ci --no-audit --no-fund --loglevel=error || npm install --no-audit --no-fund --loglevel=error
  ok "Dependencies installed"
else
  ok "Dependencies up to date"
fi

# --------------------------------------------------------------- optional API
if [[ -f "$API_DIR/pyproject.toml" || -f "$API_DIR/requirements.txt" ]]; then
  API_PID="$RUN_DIR/api.pid"; API_LOG="$RUN_DIR/api.log"
  if ! is_running "$API_PID"; then
    command -v python3 >/dev/null 2>&1 || fail "python3 is required for services/api"
    port_in_use "$API_PORT" && fail "API port $API_PORT is in use. Set API_PORT=<n>."
    info "Starting API on :${API_PORT}…"
    (
      cd "$API_DIR"
      [[ -d .venv ]] || python3 -m venv .venv
      # shellcheck disable=SC1091
      source .venv/bin/activate
      if [[ -f requirements.txt ]]; then pip install -q -r requirements.txt; else pip install -q -e .; fi
      nohup uvicorn app.main:app --host 127.0.0.1 --port "$API_PORT" >"$API_LOG" 2>&1 &
      echo $! >"$API_PID"
    )
    wait_for_http "http://127.0.0.1:$API_PORT/v1/health" "API" 60 "$(cat "$API_PID")" "$API_LOG"
  fi
  export NEXT_PUBLIC_INTRUVA_API_URL="http://127.0.0.1:$API_PORT"
  ok "Web app will use the live engine at $NEXT_PUBLIC_INTRUVA_API_URL"
else
  info "No API service yet. Running in demo mode: rule-based engine, nothing leaves the browser."
fi

# -------------------------------------------------------------------- web app
cd "$WEB_DIR"
export PORT NEXT_TELEMETRY_DISABLED=1

if [[ "$MODE" == "prod" ]]; then
  info "Building production (static export)…"
  npm run build >"$RUN_DIR/build.log" 2>&1 || { tail -n 40 "$RUN_DIR/build.log" >&2; fail "Build failed (log: $RUN_DIR/build.log)"; }
  ok "Build complete → apps/web/out"
  CMD=(npx --yes serve@14 out -l "$PORT" --no-clipboard)
else
  info "Packaging MCP server downloads…"
  node scripts/bundle-downloads.mjs >"$RUN_DIR/downloads.log" 2>&1 || warn "MCP downloads not generated (see $RUN_DIR/downloads.log)"
  CMD=(npx next dev -p "$PORT")
fi

if (( FOREGROUND )); then
  info "Running in foreground on http://localhost:$PORT (Ctrl+C to stop)"
  exec "${CMD[@]}"
fi

info "Starting web app ($MODE) on :${PORT}…"
nohup "${CMD[@]}" >"$WEB_LOG" 2>&1 &
echo $! >"$WEB_PID"
echo "$PORT" >"$RUN_DIR/web.port"
wait_for_http "http://localhost:$PORT/" "web app" 120 "$(cat "$WEB_PID")" "$WEB_LOG"

URL="http://localhost:$PORT"
printf "\n  %sIntruva is running%s (%s)\n\n" "$c_bold" "$c_reset" "$MODE"
printf "  %-11s %s%s%s\n" "Landing"   "$c_aqua" "$URL/"          "$c_reset"
printf "  %-11s %s%s%s\n" "Workspace" "$c_aqua" "$URL/workspace" "$c_reset"
printf "  %-11s %s%s%s\n" "Privacy"   "$c_aqua" "$URL/privacy"   "$c_reset"
printf "\n  %sLogs:%s %s\n  %sStop:%s ./stop.sh\n\n" "$c_dim" "$c_reset" "$WEB_LOG" "$c_dim" "$c_reset"

if (( OPEN_BROWSER )); then
  if command -v open >/dev/null 2>&1; then open "$URL"; elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"; fi
fi
