#!/usr/bin/env bash
# Fix Google sign-in redirecting to 0.0.0.0:3000 or localhost after OAuth.
# Sets public URLs in .env.production + Supabase GoTrue, then rebuilds the app.
#
#   export APP_DOMAIN=coursify.bsoc.space
#   export API_DOMAIN=api.coursify.bsoc.space
#   ./docker/fix-oauth-redirects.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP_DOMAIN="${APP_DOMAIN:-coursify.bsoc.space}"
API_DOMAIN="${API_DOMAIN:-api.coursify.bsoc.space}"
export APP_URL="https://${APP_DOMAIN}"
export API_URL="https://${API_DOMAIN}"

echo "==> Set production URLs"
echo "  App: ${APP_URL}"
echo "  API: ${API_URL}"
./docker/configure-vps-production.sh

echo ""
echo "==> Supabase GoTrue (SITE_URL + redirect allow list)"
APP_URL="$APP_URL" API_URL="$API_URL" ./docker/configure-google-oauth.sh

echo ""
echo "==> Rebuild app (NEXT_PUBLIC_APP_URL is baked at build time)"
./docker/build-app.sh

echo ""
echo "Done. Sign in again at ${APP_URL}"
echo "Google Cloud → Authorized redirect URI must include:"
echo "  ${API_URL}/auth/v1/callback"
