#!/usr/bin/env bash
# Pull all data from Supabase Cloud → import into self-hosted Postgres on this VPS.
# Works in Hostinger web terminal (no SSH/scp needed).
#
# 1. cp .env.cloud.example .env.cloud
# 2. nano .env.cloud   # paste Cloud URL + service_role key
# 3. ./docker/pull-cloud-data.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env.cloud ]; then
  echo "Create .env.cloud first:"
  echo "  cp .env.cloud.example .env.cloud"
  echo "  nano .env.cloud"
  echo ""
  echo "Get service_role key: Supabase Dashboard → Project Settings → API"
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx supabase-db; then
  echo "Supabase is not running. Start with: ./docker/setup-supabase.sh"
  exit 1
fi

ensure_node() {
  if command -v node >/dev/null 2>&1; then
    return
  fi
  echo "Installing Node.js 20 (one-time)…"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
}

ensure_node

if [ ! -d node_modules/@supabase/supabase-js ]; then
  echo "Installing @supabase/supabase-js…"
  npm install @supabase/supabase-js --no-save --silent
fi

echo "==> Export from Supabase Cloud"
node docker/export-cloud-data.mjs

echo ""
echo "==> Import into local Postgres + create auth users"
node docker/import-cloud-data.mjs

echo ""
echo "Done. Sign in with Google at https://coursify.bsoc.space"
echo "Optional: ./docker/seed-dev-enrollments.sh so My learning shows courses for all users"
