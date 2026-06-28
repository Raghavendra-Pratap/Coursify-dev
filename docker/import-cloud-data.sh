#!/usr/bin/env bash
# Import cloud-data.json into self-hosted Supabase (creates auth users + public data).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f database/seed/cloud-data.json ]; then
  echo "Missing database/seed/cloud-data.json — run ./docker/export-from-cloud.sh first."
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx supabase-db; then
  echo "Supabase is not running — run ./docker/setup-supabase.sh first."
  exit 1
fi

node docker/import-cloud-data.mjs
