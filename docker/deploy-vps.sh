#!/usr/bin/env bash
# First-time VPS deploy (run on the server from repo root).
# Set domains before running:
#   export APP_DOMAIN=coursify.bsoc.space
#   export API_DOMAIN=api.coursify.bsoc.space
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

: "${APP_DOMAIN:?Set APP_DOMAIN e.g. coursify.bsoc.space}"
: "${API_DOMAIN:?Set API_DOMAIN e.g. api.coursify.bsoc.space}"

chmod +x docker/*.sh

echo "==> Supabase stack"
./docker/setup-supabase.sh
sleep 20

echo "==> Database schema"
./docker/apply-schema.sh

echo "==> Production env"
./docker/configure-vps-production.sh

if grep -q '^GOOGLE_CLIENT_ID=.\+' .env.production 2>/dev/null; then
  echo "==> Google OAuth"
  ./docker/configure-google-oauth.sh
else
  echo "Skip Google OAuth — add GOOGLE_CLIENT_ID/SECRET to .env.production and run ./docker/configure-google-oauth.sh"
fi

echo "==> Build & start Coursify"
docker compose up -d --build

echo ""
echo "Deploy complete (app on :3000, API on :8000)."
echo "Point Caddy/nginx at 127.0.0.1:3000 and 127.0.0.1:8000 — see docs/VPS_DEPLOY.md"
echo "Optional data: run ./docker/export-from-cloud.sh on your laptop, scp database/seed/ here, ./docker/import-cloud-data.sh"
