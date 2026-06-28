#!/usr/bin/env bash
# Import cloud-data.sql into self-hosted Supabase Postgres.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SEED="$ROOT/database/seed/cloud-data.sql"
ENV_FILE="$ROOT/docker/vendor/supabase/docker/.env"

if [ ! -f "$SEED" ]; then
  echo "Missing $SEED — run ./docker/export-from-cloud.sh first."
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Run ./docker/setup-supabase.sh first."
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"

echo "Importing seed data …"
if command -v psql >/dev/null 2>&1; then
  PGPASSWORD="$POSTGRES_PASSWORD" psql \
    -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -v ON_ERROR_STOP=0 \
    -f "$SEED"
else
  docker exec -i supabase-db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=0 < "$SEED"
fi

echo ""
echo "Auth users are NOT in cloud-data.sql (passwords not exportable)."
echo "See database/seed/auth-users.json — recreate users in Studio or use magic links."
echo "Done."
