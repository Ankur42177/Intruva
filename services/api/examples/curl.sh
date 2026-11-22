#!/usr/bin/env bash
# Intruva Developer API — curl examples.
#
#   INTRUVA_API_URL=https://intruva-api.<subdomain>.workers.dev \
#   INTRUVA_API_KEY=itv_... ./services/api/examples/curl.sh
#
# Defaults target local `wrangler dev` (port 8787) with the dev-only key from .dev.vars.example.
set -euo pipefail

API="${INTRUVA_API_URL:-http://127.0.0.1:8787}"
KEY="${INTRUVA_API_KEY:-itv_local_dev_only_DO_NOT_USE_IN_PRODUCTION_000000}"
PRETTY="cat"
command -v jq >/dev/null && PRETTY="jq ."

echo "== GET /v1/health (no auth)"
curl -sS "$API/v1/health" | $PRETTY

echo "== POST /v1/analyze (deep mode → up to 3 clarification questions)"
curl -sS -X POST "$API/v1/analyze" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Our checkout API got really slow after yesterday'\''s deploy, fix it. Don'\''t change the response format.","mode":"deep"}' \
  | $PRETTY

echo "== POST /v1/optimize (answer one question, skip the rest)"
curl -sS -X POST "$API/v1/optimize" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Our checkout API got really slow after yesterday'\''s deploy, fix it. Don'\''t change the response format.","mode":"deep","target_model":"claude","answers":[{"field":"expected_behavior","kind":"answered","value":"p95 under 300 ms"}]}' \
  | $PRETTY

echo "== POST /v1/security/scan (redact: true)"
curl -sS -X POST "$API/v1/security/scan" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"text":"Deploy with key AKIAIOSFODNN7EXAMPLQ and email ops@acme-corp.io if it fails.","redact":true}' \
  | $PRETTY

echo "== POST /v1/feedback (never prompt text)"
curl -sS -X POST "$API/v1/feedback" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"request_id":"req_0123456789abcdef01234567","rating":"up","meaning_preserved":"yes","outcome":"better","consent_benchmark":false}' \
  | $PRETTY
