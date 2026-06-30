#!/usr/bin/env bash
# Check whether the running coursify container sees RESEND_API_KEY (no secret printed).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.production"

echo "=== .env.production on disk ==="
if [ -f "$ENV_FILE" ]; then
  if grep -q '^RESEND_API_KEY=.\+' "$ENV_FILE" 2>/dev/null; then
    echo "  RESEND_API_KEY: set ($(grep '^RESEND_API_KEY=' "$ENV_FILE" | cut -d= -f2- | wc -c | tr -d ' ') chars in file)"
  else
    echo "  RESEND_API_KEY: MISSING or empty in $ENV_FILE"
  fi
else
  echo "  Missing $ENV_FILE"
fi

echo ""
echo "=== coursify container process.env ==="
if ! docker ps --format '{{.Names}}' | grep -qx coursify; then
  echo "  Container 'coursify' is not running."
  exit 1
fi

docker exec coursify node -e "
const k = process.env.RESEND_API_KEY;
console.log('  RESEND_API_KEY present:', typeof k === 'string');
console.log('  RESEND_API_KEY length:', k ? k.trim().length : 0);
console.log('  looks like Resend key:', Boolean(k && k.trim().startsWith('re_')));
console.log('  RESEND_FROM_EMAIL:', process.env.RESEND_FROM_EMAIL ? '(set)' : '(not set)');
"

echo ""
echo "=== HTTP /api/email/status ==="
APP_URL=$(grep '^NEXT_PUBLIC_APP_URL=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- || echo 'http://127.0.0.1:3000')
curl -fsS "${APP_URL%/}/api/email/status" 2>/dev/null || curl -fsS "http://127.0.0.1:3000/api/email/status" 2>/dev/null || echo "  (could not reach status endpoint)"
echo ""
