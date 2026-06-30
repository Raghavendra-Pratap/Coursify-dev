#!/usr/bin/env bash
# Point Caddy at the host port Docker actually publishes for coursify (fixes APP_PORT mismatches).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.production"
APP_DOMAIN="${APP_DOMAIN:-coursify.bsoc.space}"
API_DOMAIN="${API_DOMAIN:-api.coursify.bsoc.space}"

if ! docker ps --format '{{.Names}}' | grep -qx coursify; then
  echo "Container 'coursify' is not running. Start with ./docker/build-app.sh"
  exit 1
fi

HOST_PORT="$(docker port coursify 3000/tcp 2>/dev/null | head -1 | sed -E 's/.*:([0-9]+)$/\\1/')"
if [ -z "$HOST_PORT" ]; then
  echo "Could not detect host port for coursify:3000"
  docker port coursify || true
  exit 1
fi

echo "Coursify container 3000/tcp → host :${HOST_PORT}"

if ! command -v caddy >/dev/null 2>&1; then
  echo "Caddy not installed. Install first or set reverse_proxy 127.0.0.1:${HOST_PORT} manually."
  exit 1
fi

sudo tee /etc/caddy/Caddyfile > /dev/null <<EOF
${APP_DOMAIN} {
	encode gzip
	reverse_proxy 127.0.0.1:${HOST_PORT}
}

${API_DOMAIN} {
	encode gzip
	reverse_proxy 127.0.0.1:8000
}
EOF

sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
echo "OK: Caddy now proxies ${APP_DOMAIN} → 127.0.0.1:${HOST_PORT}"
echo "Test: curl -fsS http://127.0.0.1:${HOST_PORT}/api/email/status"
