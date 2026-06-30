#!/usr/bin/env bash
# Build/run Coursify with .env.production (required for NEXT_PUBLIC_* at build time).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.production"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE"
  echo "Run: ./docker/configure-vps-production.sh  (VPS)"
  echo " Or: cp .env.selfhosted.example .env.production && fill keys from ./docker/print-keys.sh"
  exit 1
fi

# shellcheck source=docker/_env.sh
source "$(dirname "$0")/_env.sh"

URL=$(read_supabase_env NEXT_PUBLIC_SUPABASE_URL "$ENV_FILE" || true)
KEY=$(read_supabase_env NEXT_PUBLIC_SUPABASE_ANON_KEY "$ENV_FILE" || true)
APP=$(read_supabase_env NEXT_PUBLIC_APP_URL "$ENV_FILE" || true)

if [ -z "$URL" ] || [ -z "$KEY" ]; then
  echo "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in .env.production"
  echo "Run ./docker/configure-vps-production.sh or ./docker/print-keys.sh"
  exit 1
fi

echo "Building with NEXT_PUBLIC_SUPABASE_URL=${URL}"
echo "                  NEXT_PUBLIC_APP_URL=${APP:-"(not set)"}"

"$(dirname "$0")/validate-env.sh" "$ENV_FILE"

RESEND_LEN=$(read_supabase_env RESEND_API_KEY "$ENV_FILE" | wc -c | tr -d ' ')
if [ "${RESEND_LEN:-0}" -le 1 ]; then
  echo "WARN: RESEND_API_KEY is empty in .env.production — invite emails will not send."
else
  echo "OK: RESEND_API_KEY is set in .env.production (${RESEND_LEN} chars)"
fi

cd "$ROOT"
exec docker compose --env-file "$ENV_FILE" up -d --build --force-recreate "$@"
