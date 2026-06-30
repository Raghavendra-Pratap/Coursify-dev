#!/usr/bin/env bash
# Diagnostic only — does NOT modify /etc/caddy/Caddyfile (shared with other apps).
set -euo pipefail

if ! docker ps --format '{{.Names}}' | grep -qx coursify; then
  echo "Container 'coursify' is not running. Start with ./docker/build-app.sh"
  exit 1
fi

HOST_PORT="$(docker port coursify 3000/tcp 2>/dev/null | head -1 | awk -F: '{print $NF}')"
if [ -z "$HOST_PORT" ]; then
  echo "Could not detect host port for coursify:3000"
  docker port coursify || true
  exit 1
fi

echo "Coursify container 3000/tcp → host :${HOST_PORT}"
echo ""
echo "This script does not change Caddy. In your existing Caddy config, ensure coursify.bsoc.space"
echo "reverse_proxies to 127.0.0.1:${HOST_PORT} (only if that is how you route this app)."
echo ""
echo "Test: curl -fsS http://127.0.0.1:${HOST_PORT}/api/email/status"
