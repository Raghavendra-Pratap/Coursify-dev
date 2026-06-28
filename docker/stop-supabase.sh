#!/usr/bin/env bash
# Stop Supabase stack (keeps volumes / data).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOCKER_DIR="$ROOT/docker/vendor/supabase/docker"

if [ ! -d "$DOCKER_DIR" ]; then
  echo "Supabase docker dir not found."
  exit 0
fi

cd "$DOCKER_DIR"
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-supabase}"
docker compose down
echo "Supabase stopped. Data volumes preserved."
