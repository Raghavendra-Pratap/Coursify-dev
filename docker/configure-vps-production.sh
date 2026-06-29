#!/usr/bin/env bash
# Write a docker-compose-safe .env.production (no comments — compose rejects some # lines).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/.env.production"
SUPABASE_ENV="$ROOT/docker/vendor/supabase/docker/.env"

APP_DOMAIN="${APP_DOMAIN:-}"
API_DOMAIN="${API_DOMAIN:-}"

if [ -z "$APP_DOMAIN" ] || [ -z "$API_DOMAIN" ]; then
  echo "Usage: APP_DOMAIN=coursify.example.com API_DOMAIN=api.coursify.example.com $0"
  exit 1
fi

if [ ! -f "$SUPABASE_ENV" ]; then
  echo "Run ./docker/setup-supabase.sh first."
  exit 1
fi

# shellcheck source=docker/_env.sh
source "$(dirname "$0")/_env.sh"

APP_URL="https://${APP_DOMAIN}"
API_URL="https://${API_DOMAIN}"
ANON_KEY=$(read_supabase_env ANON_KEY "$SUPABASE_ENV" || true)
SERVICE_KEY=$(read_supabase_env SERVICE_ROLE_KEY "$SUPABASE_ENV" || true)

if [ -z "$ANON_KEY" ] || [ -z "$SERVICE_KEY" ]; then
  echo "Missing ANON_KEY or SERVICE_ROLE_KEY in $SUPABASE_ENV"
  exit 1
fi

# Preserve secrets if user already edited .env.production
OLD="$OUT"
read_old() {
  if [ -f "$OLD" ]; then
    read_supabase_env "$1" "$OLD" 2>/dev/null || true
  fi
}

GOOGLE_ID=$(read_old GOOGLE_CLIENT_ID)
GOOGLE_SECRET=$(read_old GOOGLE_CLIENT_SECRET)
RESEND_KEY=$(read_old RESEND_API_KEY)
RESEND_FROM=$(read_old RESEND_FROM_EMAIL)
ASSESSMENT_ORIGIN=$(read_old NEXT_PUBLIC_ASSESSMENT_PRO_ORIGIN)

# Supabase GoTrue / Kong
set_env_val() {
  local key="$1" val="$2" file="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i.bak "s|^${key}=.*|${key}=${val}|" "$file"
  else
    echo "${key}=${val}" >> "$file"
  fi
}

set_env_val SITE_URL "$APP_URL" "$SUPABASE_ENV"
set_env_val API_EXTERNAL_URL "$API_URL" "$SUPABASE_ENV"
set_env_val SUPABASE_PUBLIC_URL "$API_URL" "$SUPABASE_ENV"
set_env_val ADDITIONAL_REDIRECT_URLS "${APP_URL},${APP_URL}/auth/callback,${APP_URL}/**" "$SUPABASE_ENV"

cat > "$OUT" <<EOF
NEXT_PUBLIC_SUPABASE_URL=${API_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
NEXT_PUBLIC_APP_URL=${APP_URL}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY}
APP_PORT=3000
GOOGLE_CLIENT_ID=${GOOGLE_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_SECRET}
RESEND_API_KEY=${RESEND_KEY}
RESEND_FROM_EMAIL=${RESEND_FROM}
NEXT_PUBLIC_ASSESSMENT_PRO_ORIGIN=${ASSESSMENT_ORIGIN}
EOF

echo "Wrote $OUT (no comments — safe for docker compose)"
echo "  App:  $APP_URL"
echo "  API:  $API_URL"
echo ""
echo "Edit secrets: nano $OUT"
echo "  GOOGLE_CLIENT_ID=....apps.googleusercontent.com"
echo "  GOOGLE_CLIENT_SECRET=...."
echo "Values with spaces must be quoted, e.g. RESEND_FROM_EMAIL=\"Coursify <noreply@domain.com>\""
echo ""
echo "Then: ./docker/configure-google-oauth.sh && ./docker/build-app.sh"
