#!/usr/bin/env bash
# Enable Google OAuth on self-hosted Supabase.
# Reads GOOGLE_CLIENT_ID/SECRET from .env.production (VPS) or .env.local (dev).
# Optional overrides: APP_URL=https://app.example.com API_URL=https://api.example.com
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SUPABASE_ENV="$ROOT/docker/vendor/supabase/docker/.env"
COMPOSE="$ROOT/docker/vendor/supabase/docker/docker-compose.yml"

# shellcheck source=docker/_env.sh
source "$(dirname "$0")/_env.sh"

APP_ENV="$ROOT/.env.production"
if [ ! -f "$APP_ENV" ]; then
  APP_ENV="$ROOT/.env.local"
fi

if [ ! -f "$APP_ENV" ]; then
  echo "Missing .env.production or .env.local (need GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)"
  exit 1
fi
if [ ! -f "$SUPABASE_ENV" ]; then
  echo "Run ./docker/setup-supabase.sh first."
  exit 1
fi

CLIENT_ID=$(read_supabase_env GOOGLE_CLIENT_ID "$APP_ENV" 2>/dev/null || true)
CLIENT_SECRET=$(read_supabase_env GOOGLE_CLIENT_SECRET "$APP_ENV" 2>/dev/null || true)
if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ]; then
  echo "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in $APP_ENV"
  exit 1
fi

APP_URL="${APP_URL:-$(read_supabase_env NEXT_PUBLIC_APP_URL "$APP_ENV" 2>/dev/null || echo http://localhost:3000)}"
API_URL="${API_URL:-$(read_supabase_env NEXT_PUBLIC_SUPABASE_URL "$APP_ENV" 2>/dev/null || echo http://localhost:8000)}"

if [[ "$APP_URL" == *"0.0.0.0"* ]] || [[ "$APP_URL" == *"127.0.0.1"* ]]; then
  echo "ERROR: NEXT_PUBLIC_APP_URL must be your public domain (https://coursify.bsoc.space), not ${APP_URL}"
  echo "Run: APP_DOMAIN=coursify.bsoc.space API_DOMAIN=api.coursify.bsoc.space ./docker/configure-vps-production.sh"
  echo "Then: APP_URL=https://coursify.bsoc.space API_URL=https://api.coursify.bsoc.space $0"
  exit 1
fi
if [ "$APP_ENV" = "$ROOT/.env.production" ] && [[ "$APP_URL" == http://localhost* ]]; then
  echo "ERROR: .env.production still has localhost for NEXT_PUBLIC_APP_URL."
  echo "Run: APP_DOMAIN=your.app API_DOMAIN=api.your.app ./docker/configure-vps-production.sh"
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

set_env_val GOOGLE_ENABLED true "$SUPABASE_ENV"
set_env_val GOOGLE_CLIENT_ID "$CLIENT_ID" "$SUPABASE_ENV"
set_env_val GOOGLE_SECRET "$CLIENT_SECRET" "$SUPABASE_ENV"
set_env_val API_EXTERNAL_URL "$API_URL" "$SUPABASE_ENV"
set_env_val SUPABASE_PUBLIC_URL "$API_URL" "$SUPABASE_ENV"
set_env_val SITE_URL "$APP_URL" "$SUPABASE_ENV"
set_env_val ADDITIONAL_REDIRECT_URLS "${APP_URL},${APP_URL}/auth/callback,${APP_URL}/**" "$SUPABASE_ENV"
set_env_val ENABLE_EMAIL_AUTOCONFIRM true "$SUPABASE_ENV"

if grep -q '^      # GOTRUE_EXTERNAL_GOOGLE_ENABLED' "$COMPOSE"; then
  sed -i.bak \
    -e 's/^      # GOTRUE_EXTERNAL_GOOGLE_ENABLED/      GOTRUE_EXTERNAL_GOOGLE_ENABLED/' \
    -e 's/^      # GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID/      GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID/' \
    -e 's/^      # GOTRUE_EXTERNAL_GOOGLE_SECRET/      GOTRUE_EXTERNAL_GOOGLE_SECRET/' \
    -e 's/^      # GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI/      GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI/' \
    "$COMPOSE"
fi

export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-supabase}"
cd "$ROOT/docker/vendor/supabase/docker"
docker compose up -d auth kong

CALLBACK="${API_URL%/}/auth/v1/callback"
echo ""
echo "Google OAuth enabled."
echo "Add Authorized redirect URI in Google Cloud Console:"
echo "  ${CALLBACK}"
echo "App URL: ${APP_URL}"
