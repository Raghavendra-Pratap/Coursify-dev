#!/usr/bin/env bash
# Finish VPS setup: Caddy TLS, firewall, health checks.
# Run on VPS after ./docker/build-app.sh succeeds.
#
#   export APP_DOMAIN=coursify.bsoc.space
#   export API_DOMAIN=api.coursify.bsoc.space
#   ./docker/finish-vps-setup.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DOMAIN="${APP_DOMAIN:-coursify.bsoc.space}"
API_DOMAIN="${API_DOMAIN:-api.coursify.bsoc.space}"

echo "==> VPS public IP (use for DNS A records):"
VPS_IP=$(curl -4 -s ifconfig.me 2>/dev/null || curl -4 -s icanhazip.com 2>/dev/null || true)
echo "  ${VPS_IP:-unknown}"
echo ""

echo "==> Docker containers"
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'coursify|supabase-kong|supabase-db|NAMES' || true
echo ""

echo "==> Local health"
curl -sf -o /dev/null -w "  app :3000 → %{http_code}\n" http://127.0.0.1:3000/ || echo "  app :3000 → FAIL"
# 401 on /rest/v1/ without apikey is expected — do not use curl -f
curl -s -o /dev/null -w "  api :8000 → %{http_code} (401 is OK)\n" http://127.0.0.1:8000/rest/v1/ || echo "  api :8000 → FAIL"
echo ""

echo "==> Caddy"
if ! command -v caddy >/dev/null 2>&1; then
  echo "Installing Caddy…"
  sudo apt-get update -qq
  sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt-get update -qq
  sudo apt-get install -y caddy
fi

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
sudo systemctl start caddy 2>/dev/null || true
sudo systemctl reload caddy 2>/dev/null || sudo systemctl restart caddy
sudo systemctl --no-pager status caddy | head -5 || true
echo "Caddy configured for ${APP_DOMAIN} and ${API_DOMAIN}"
echo ""

echo "==> Firewall (ufw) — SSH (port 22) is allowed BEFORE enable"
if command -v ufw >/dev/null 2>&1; then
  sudo ufw allow 22/tcp comment 'SSH' >/dev/null 2>&1 || true
  sudo ufw allow OpenSSH >/dev/null 2>&1 || true
  sudo ufw allow 80/tcp comment 'HTTP' >/dev/null 2>&1 || true
  sudo ufw allow 443/tcp comment 'HTTPS' >/dev/null 2>&1 || true
  if sudo ufw status | grep -q "Status: active"; then
    sudo ufw reload
    echo "ufw already active — rules updated"
  else
    echo "Enabling ufw (SSH + 80 + 443 only)…"
    sudo ufw --force enable
  fi
  sudo ufw status numbered || true
else
  echo "ufw not installed — skip or: sudo apt install ufw"
fi
echo ""

echo "==> DNS checklist (do this in your domain registrar / Cloudflare)"
echo "  ${APP_DOMAIN}      A    ${VPS_IP:-YOUR_VPS_IP}"
echo "  ${API_DOMAIN}  A    ${VPS_IP:-YOUR_VPS_IP}"
echo ""
echo "  REMOVE Vercel CNAME for coursify (currently still points to vercel-dns)."
echo "  Wait 5–30 min after DNS change, then: curl -sI https://${APP_DOMAIN} | grep -i server"
echo ""
echo "==> Google OAuth (Google Cloud Console → Authorized redirect URIs)"
echo "  https://${API_DOMAIN}/auth/v1/callback"
echo ""
echo "==> Optional: import cloud data"
echo "  On laptop: ./docker/export-from-cloud.sh && scp -r database/seed root@${VPS_IP:-VPS}:~/coursify/database/"
echo "  On VPS:    ./docker/import-cloud-data.sh"
