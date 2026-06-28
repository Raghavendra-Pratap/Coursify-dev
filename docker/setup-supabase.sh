#!/usr/bin/env bash
# Clone and start official Supabase Docker stack (Path 1 self-hosting).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/docker/vendor/supabase"
DOCKER_DIR="$VENDOR/docker"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker Desktop or Docker Engine."
  exit 1
fi

if [ ! -d "$DOCKER_DIR" ]; then
  echo "Cloning Supabase docker files into docker/vendor/supabase …"
  mkdir -p "$ROOT/docker/vendor"
  git clone --depth 1 --branch master https://github.com/supabase/supabase.git "$VENDOR"
fi

cd "$DOCKER_DIR"

if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "Created $DOCKER_DIR/.env from .env.example"
  echo "For Google OAuth, edit GOTRUE_EXTERNAL_GOOGLE_* in that file before production use."
fi

export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-supabase}"

echo "Starting Supabase (Kong :8000, Studio :3000, Postgres :5432) …"
docker compose pull
docker compose up -d

echo ""
echo "Supabase is starting. Wait ~30s, then:"
echo "  Studio:  http://localhost:3000"
echo "  API:     http://localhost:8000"
echo "  ./docker/apply-schema.sh"
echo "  ./docker/print-keys.sh"
