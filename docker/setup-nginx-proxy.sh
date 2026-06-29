#!/usr/bin/env bash
# Configure nginx as reverse proxy (when nginx already uses ports 80/443).
# After DNS points to this VPS, run certbot for HTTPS.
#
#   export APP_DOMAIN=coursify.bsoc.space
#   export API_DOMAIN=api.coursify.bsoc.space
#   ./docker/setup-nginx-proxy.sh
set -euo pipefail

APP_DOMAIN="${APP_DOMAIN:-coursify.bsoc.space}"
API_DOMAIN="${API_DOMAIN:-api.coursify.bsoc.space}"

if ! command -v nginx >/dev/null 2>&1; then
  echo "Installing nginx…"
  sudo apt-get update -qq
  sudo apt-get install -y nginx
fi

CONF="/etc/nginx/sites-available/coursify"
sudo tee "$CONF" > /dev/null <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${APP_DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name ${API_DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

sudo ln -sf "$CONF" /etc/nginx/sites-enabled/coursify
sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx

echo ""
echo "Nginx proxy OK (HTTP only until certbot runs)."
echo ""
echo "1. Point DNS A records to this VPS:"
echo "     ${APP_DOMAIN} → $(curl -4 -s ifconfig.me 2>/dev/null || echo YOUR_VPS_IP)"
echo "     ${API_DOMAIN} → same IP"
echo ""
echo "2. After DNS propagates, get HTTPS:"
echo "     sudo apt install -y certbot python3-certbot-nginx"
echo "     sudo certbot --nginx -d ${APP_DOMAIN} -d ${API_DOMAIN}"
echo ""
echo "3. Test: curl -sI http://${APP_DOMAIN}/ | head -3"
