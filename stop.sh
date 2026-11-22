#!/usr/bin/env bash
# =============================================================================
# Intruva — stop script
#
# Stops everything ./start.sh launched (web app and, if present, the API),
# including child processes, using the PID files in .run/.
#
# Usage:
#   ./stop.sh           # stop processes started by ./start.sh
#   ./stop.sh --port    # ALSO free the web port (3001 or the saved port) if a
#                       # stray Intruva dev server is still listening on it
#   ./stop.sh --clean   # also delete .run/ logs
#
# It never kills processes it didn't start unless you pass --port, and even
# then only processes whose working directory is inside this repository.
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$ROOT/.run"
FREE_PORT=0
CLEAN=0

c_reset=$'\033[0m'; c_iris=$'\033[38;5;141m'; c_ok=$'\033[38;5;78m'; c_warn=$'\033[38;5;221m'
info() { printf "%s›%s %s\n" "$c_iris" "$c_reset" "$*"; }
ok()   { printf "%s✓%s %s\n" "$c_ok" "$c_reset" "$*"; }
warn() { printf "%s!%s %s\n" "$c_warn" "$c_reset" "$*"; }

for arg in "$@"; do
  case "$arg" in
    --port) FREE_PORT=1 ;;
    --clean) CLEAN=1 ;;
    -h|--help) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) warn "Unknown option: $arg" ;;
  esac
done

# Kill a process and all its descendants (npx → node → next-server …).
kill_tree() {
  local pid="$1" sig="${2:-TERM}" child
  for child in $(pgrep -P "$pid" 2>/dev/null); do kill_tree "$child" "$sig"; done
  kill -"$sig" "$pid" 2>/dev/null || true
}

stop_service() {
  local name="$1" pidfile="$RUN_DIR/$1.pid"
  if [[ ! -f "$pidfile" ]]; then
    info "$name: not started by ./start.sh"
    return
  fi
  local pid; pid="$(cat "$pidfile")"
  if ! kill -0 "$pid" 2>/dev/null; then
    info "$name: already stopped"
    rm -f "$pidfile"
    return
  fi
  info "Stopping $name (PID $pid)…"
  kill_tree "$pid" TERM
  for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.25; done
  if kill -0 "$pid" 2>/dev/null; then
    warn "$name did not exit; forcing"
    kill_tree "$pid" KILL
  fi
  rm -f "$pidfile"
  ok "$name stopped"
}

stop_service web
stop_service api

if (( FREE_PORT )); then
  PORT="$(cat "$RUN_DIR/web.port" 2>/dev/null || echo "${PORT:-3001}")"
  for pid in $(lsof -nP -t -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null); do
    cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')"
    if [[ "$cwd" == "$ROOT"* ]]; then
      info "Freeing port $PORT (PID $pid, $cwd)"
      kill_tree "$pid" TERM
    else
      warn "Port $PORT is used by a process outside this repo ($cwd); leaving it alone."
    fi
  done
fi

rm -f "$RUN_DIR/web.port"
if (( CLEAN )); then rm -rf "$RUN_DIR"; ok "Removed .run/"; fi
ok "Intruva stopped"
