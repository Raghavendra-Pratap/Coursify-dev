#!/usr/bin/env bash
# Clone and start official Supabase Docker stack (Path 1 self-hosting).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/docker/vendor/supabase"
DOCKER_DIR="$VENDOR/docker"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker Engine + Compose v2."
  exit 1
fi

if [ ! -d "$DOCKER_DIR" ]; then
  echo "Cloning Supabase docker files (sparse, docker/ only) …"
  mkdir -p "$ROOT/docker/vendor"
  git clone --depth 1 --filter=blob:none --sparse https://github.com/supabase/supabase.git "$VENDOR"
  git -C "$VENDOR" sparse-checkout set docker
fi

cd "$DOCKER_DIR"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created $DOCKER_DIR/.env from .env.example"
fi

export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-supabase}"

echo "Starting Supabase (Kong :8000, Postgres internal) …"
docker compose pull
docker compose up -d

echo ""
echo "Wait ~30s, then:"
echo "  API (Kong): http://127.0.0.1:8000"
echo "  ./docker/apply-schema.sh"
echo "  ./docker/print-keys.sh"
