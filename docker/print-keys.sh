#!/usr/bin/env bash
# Print Supabase keys for Coursify .env.production / .env.local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/docker/vendor/supabase/docker/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Run ./docker/setup-supabase.sh first."
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

echo "# Paste into .env.production or .env.local"
echo "NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY:-}"
echo "SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY:-}"
echo ""
echo "# For npm run dev (port 3000):"
echo "NEXT_PUBLIC_APP_URL=http://localhost:3000"
echo ""
echo "# For docker compose coursify (port 3001):"
echo "NEXT_PUBLIC_APP_URL=http://localhost:3001"
echo "APP_PORT=3001"
