#!/usr/bin/env bash
# Diagnose and fix Caddy not starting on VPS.
set -euo pipefail

APP_DOMAIN="${APP_DOMAIN:-coursify.bsoc.space}"
API_DOMAIN="${API_DOMAIN:-api.coursify.bsoc.space}"

echo "==> What is listening on 80 / 443?"
sudo ss -tlnp | grep -E ':80 |:443 ' || echo "  (nothing on 80/443)"
echo ""

echo "==> Other web servers?"
systemctl is-active nginx 2>/dev/null && echo "  nginx: active" || echo "  nginx: not active"
systemctl is-active apache2 2>/dev/null && echo "  apache2: active" || echo "  apache2: not active"
echo ""

echo "==> Caddyfile"
sudo cat /etc/caddy/Caddyfile 2>/dev/null || echo "  missing /etc/caddy/Caddyfile"
echo ""

echo "==> Validate config"
sudo caddy validate --config /etc/caddy/Caddyfile 2>&1 || true
echo ""

echo "==> Recent Caddy logs"
sudo journalctl -u caddy -n 30 --no-pager 2>/dev/null || true
echo ""

# Stop common conflicts on 80/443
if systemctl is-active nginx >/dev/null 2>&1; then
  echo "==> Stopping nginx (frees 80/443 for Caddy)…"
  sudo systemctl stop nginx
  sudo systemctl disable nginx
fi
if systemctl is-active apache2 >/dev/null 2>&1; then
  echo "==> Stopping apache2…"
  sudo systemctl stop apache2
  sudo systemctl disable apache2
fi

if ! sudo ss -tlnp | grep -q ':80 '; then
  echo "==> Port 80 is free — starting Caddy"
  sudo tee /etc/caddy/Caddyfile > /dev/null <<EOF
${APP_DOMAIN} {
	encode gzip
	reverse_proxy 127.0.0.1:3000
}

${API_DOMAIN} {
	encode gzip
	reverse_proxy 127.0.0.1:8000
}
EOF
  sudo systemctl enable caddy
  sudo systemctl restart caddy
  sleep 2
  sudo systemctl status caddy --no-pager | head -10
else
  echo "==> Port 80 still in use — kill the process above or change Caddy to another port"
  sudo ss -tlnp | grep -E ':80 |:443 '
fi

echo ""
echo "==> Test locally (via Host header)"
curl -sI -H "Host: ${APP_DOMAIN}" http://127.0.0.1/ 2>/dev/null | head -5 || echo "  HTTP test failed — Caddy may still be down"
echo ""
echo "DNS must point ${APP_DOMAIN} → $(curl -4 -s ifconfig.me 2>/dev/null || echo VPS_IP) (remove Vercel CNAME)"
