#!/usr/bin/env bash
# Write production .env.production and Supabase URLs for VPS.
# Usage:
#   APP_DOMAIN=coursify.bsoc.space API_DOMAIN=api.coursify.bsoc.space ./docker/configure-vps-production.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SUPABASE_ENV="$ROOT/docker/vendor/supabase/docker/.env"
TEMPLATE="$ROOT/.env.selfhosted.example"
OUT="$ROOT/.env.production"

APP_DOMAIN="${APP_DOMAIN:-}"
API_DOMAIN="${API_DOMAIN:-}"

if [ -z "$APP_DOMAIN" ] || [ -z "$API_DOMAIN" ]; then
  echo "Usage: APP_DOMAIN=coursify.example.com API_DOMAIN=api.coursify.example.com $0"
  exit 1
fi

APP_URL="https://${APP_DOMAIN}"
API_URL="https://${API_DOMAIN}"

if [ ! -f "$SUPABASE_ENV" ]; then
  echo "Run ./docker/setup-supabase.sh first."
  exit 1
fi

# shellcheck source=docker/_env.sh
source "$(dirname "$0")/_env.sh"

ANON_KEY=$(read_supabase_env ANON_KEY "$SUPABASE_ENV" || true)
SERVICE_KEY=$(read_supabase_env SERVICE_ROLE_KEY "$SUPABASE_ENV" || true)

if [ -z "$ANON_KEY" ] || [ -z "$SERVICE_KEY" ]; then
  echo "Missing ANON_KEY or SERVICE_ROLE_KEY in $SUPABASE_ENV"
  exit 1
fi

set_env_val() {
  local key="$1" val="$2" file="$3"
  if grep -q "^${key}=" "$file"; then
    sed -i.bak "s|^${key}=.*|${key}=${val}|" "$file"
  else
    echo "${key}=${val}" >> "$file"
  fi
}

# Supabase GoTrue / Kong public URLs
set_env_val SITE_URL "$APP_URL" "$SUPABASE_ENV"
set_env_val API_EXTERNAL_URL "$API_URL" "$SUPABASE_ENV"
set_env_val SUPABASE_PUBLIC_URL "$API_URL" "$SUPABASE_ENV"
set_env_val ADDITIONAL_REDIRECT_URLS "${APP_URL},${APP_URL}/**,${APP_URL}/oauth/consent" "$SUPABASE_ENV"

# Coursify app env
cp "$TEMPLATE" "$OUT"
set_env_val NEXT_PUBLIC_SUPABASE_URL "$API_URL" "$OUT"
set_env_val NEXT_PUBLIC_SUPABASE_ANON_KEY "$ANON_KEY" "$OUT"
set_env_val SUPABASE_SERVICE_ROLE_KEY "$SERVICE_KEY" "$OUT"
set_env_val NEXT_PUBLIC_APP_URL "$APP_URL" "$OUT"
set_env_val APP_PORT "3000" "$OUT"

echo "Wrote $OUT"
echo "  App:  $APP_URL"
echo "  API:  $API_URL"
echo ""
echo "Add secrets to $OUT if needed: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, RESEND_API_KEY"
echo "Then: ./docker/configure-google-oauth.sh && docker compose up -d --build"
