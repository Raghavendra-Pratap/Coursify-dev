#!/usr/bin/env bash
# Check whether the running coursify container sees RESEND_API_KEY (no secret printed).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.production"

read_env() {
  grep -E "^${1}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || true
}

APP_PORT="$(read_env APP_PORT)"
APP_PORT="${APP_PORT:-3001}"
APP_URL="$(read_env NEXT_PUBLIC_APP_URL)"

echo "=== .env.production on disk ==="
if [ -f "$ENV_FILE" ]; then
  if grep -q '^RESEND_API_KEY=.\+' "$ENV_FILE" 2>/dev/null; then
    echo "  RESEND_API_KEY: set ($(grep '^RESEND_API_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r' | wc -c | tr -d ' ') chars in file)"
    echo "  APP_PORT: ${APP_PORT}"
  else
    echo "  RESEND_API_KEY: MISSING or empty in $ENV_FILE"
  fi
else
  echo "  Missing $ENV_FILE"
fi

echo ""
echo "=== Docker port mapping ==="
if docker ps --format '{{.Names}}' | grep -qx coursify; then
  docker port coursify 2>/dev/null || echo "  (no published ports?)"
else
  echo "  Container 'coursify' is not running."
  exit 1
fi

echo ""
echo "=== Mounted runtime env file (coursify container only) ==="
docker exec coursify sh -c 'if [ -f /app/config/production.env ]; then echo "  /app/config/production.env: present"; grep -q "^RESEND_API_KEY=." /app/config/production.env && echo "  RESEND_API_KEY in file: yes" || echo "  RESEND_API_KEY in file: no"; else echo "  /app/config/production.env: MISSING — run git pull && ./docker/build-app.sh"; fi' 2>/dev/null || true

echo ""
echo "=== coursify container process.env ==="
docker exec coursify node -e "
const k = process.env.RESEND_API_KEY;
console.log('  RESEND_API_KEY present:', typeof k === 'string');
console.log('  RESEND_API_KEY length:', k ? k.trim().length : 0);
console.log('  looks like Resend key:', Boolean(k && k.trim().startsWith('re_')));
console.log('  RESEND_FROM_EMAIL:', process.env.RESEND_FROM_EMAIL ? '(set)' : '(not set)');
"

echo ""
echo "=== HTTP /api/email/status (inside container → app :3000) ==="
docker exec coursify node -e "
fetch('http://127.0.0.1:3000/api/email/status')
  .then((r) => r.json())
  .then((j) => console.log(' ', JSON.stringify(j)))
  .catch((e) => console.log('  FAIL:', e.message));
" 2>/dev/null || echo "  (could not run in-container fetch)"

echo ""
echo "=== HTTP /api/email/status (host 127.0.0.1:${APP_PORT}) ==="
curl -fsS "http://127.0.0.1:${APP_PORT}/api/email/status" 2>/dev/null && echo "" || echo "  (could not reach http://127.0.0.1:${APP_PORT}/api/email/status)"

echo ""
echo "=== HTTP /api/email/status (public APP URL) ==="
if [ -n "$APP_URL" ]; then
  curl -fsS "${APP_URL%/}/api/email/status" 2>/dev/null && echo "" || echo "  (could not reach ${APP_URL%/}/api/email/status)"
else
  echo "  NEXT_PUBLIC_APP_URL not set in .env.production"
fi

echo ""
echo "=== Routing hints ==="
if ss -tlnp 2>/dev/null | grep -q ":${APP_PORT} "; then
  echo "  Something is listening on host port ${APP_PORT}."
else
  echo "  WARN: nothing listening on host port ${APP_PORT} — Caddy should proxy to the port from 'docker port coursify'."
fi
if [ -n "$APP_URL" ]; then
  PUB_IP=$(getent ahosts "$(echo "$APP_URL" | sed -E 's#https?://([^/]+).*#\1#')" 2>/dev/null | awk '{print $1; exit}' || true)
  VPS_IP=$(curl -4 -s ifconfig.me 2>/dev/null || true)
  if [ -n "$PUB_IP" ] && [ -n "$VPS_IP" ] && [ "$PUB_IP" != "$VPS_IP" ]; then
    echo "  WARN: ${APP_URL} resolves to ${PUB_IP} but this VPS is ${VPS_IP}."
    echo "        Public traffic may not hit this Docker container (e.g. still on Vercel)."
  fi
fi
echo "  Caddy should reverse_proxy to the HOST port shown by: docker port coursify"
echo ""
