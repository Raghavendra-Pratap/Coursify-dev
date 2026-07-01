#!/usr/bin/env bash
# Routine VPS update after git pull (run from repo root on the server).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="${BRANCH:-develop}"

echo "==> Pull latest (${BRANCH})"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

if [ -f .env.production ]; then
  if ! grep -q '^NEXT_PUBLIC_SITE_URL=' .env.production 2>/dev/null; then
    APP_URL=$(grep '^NEXT_PUBLIC_APP_URL=' .env.production | cut -d= -f2- || true)
    if [ -n "$APP_URL" ]; then
      echo "NEXT_PUBLIC_SITE_URL=${APP_URL}" >> .env.production
      echo "Added NEXT_PUBLIC_SITE_URL to .env.production"
    fi
  fi
fi

echo "==> Apply database migrations"
./docker/apply-schema.sh

echo "==> Rebuild and restart Coursify"
./docker/build-app.sh

echo ""
echo "Update complete. Verify: curl -sI https://coursify.bsoc.space/home | head -5"
echo "Container logs: docker logs -f coursify --tail 50"
