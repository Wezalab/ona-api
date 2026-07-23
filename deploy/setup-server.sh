#!/usr/bin/env bash
# ============================================================
# ONA API — server bootstrap
# Usage: bash setup-server.sh
# Tested on: Ubuntu 22.04 / Debian 12
# ============================================================
set -euo pipefail

DOMAIN="ona.edu-pedia.com"
API_PORT=3847
EMAIL="wezalab@gmail.com"       # certbot notifications
APP_DIR="/opt/ona-api"

echo "==> [1/6] Update packages"
apt-get update -qq

echo "==> [2/6] Install Docker, nginx, certbot"
apt-get install -y -qq curl gnupg ca-certificates nginx certbot python3-certbot-nginx

# Install Docker if absent
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
if ! command -v docker compose &>/dev/null 2>&1; then
  apt-get install -y -qq docker-compose-plugin
fi

systemctl enable --now docker nginx

echo "==> [3/6] Create app directory"
mkdir -p "$APP_DIR"

echo "==> [4/6] Write .env"
cat > "$APP_DIR/.env" <<'DOTENV'
NODE_ENV=production
PORT=3000
CORS_ORIGINS=https://ona.edu-pedia.com
MONGODB_URI=mongodb://mongo:27017/ona
JWT_ACCESS_SECRET=ona-prod-access-secret-CHANGE-ME-$(openssl rand -hex 16)
JWT_ACCESS_TTL=900s
JWT_REFRESH_SECRET=ona-prod-refresh-secret-CHANGE-ME-$(openssl rand -hex 16)
JWT_REFRESH_TTL=30d
SEED_ADMIN_EMAIL=admin@ona.health
SEED_ADMIN_PASSWORD=admin1234
STARKNET_RPC_URL=https://starknet-sepolia-rpc.publicnode.com
STARKNET_NETWORK=SN_SEPOLIA
STARKNET_CONTRACT_ADDRESS=0x437335ac6168b6114bbdff68abdf6334f9a14e3a597c7ce8d8cc5f48d79aa6a
STARKNET_OWNER_ADDRESS=0x0061846dFea34312c274Ee9b06887e1ae9A9401D0A83D2ECa477B2EdD5D6b614
STARKNET_OWNER_PRIVATE_KEY=0x011dafa5bbce54b7b4d0b78a180188e981fed4b39c51695ee8f9204579b56d38
BLOCKCHAIN_ENABLED=true
BLOCKCHAIN_RETRY_INTERVAL_SEC=30
UPLOAD_MAX_BYTES=10485760
DOTENV

echo "==> [5/6] Configure nginx (HTTP only first, for certbot)"
cat > /etc/nginx/sites-available/ona-api <<NGINX
server {
    listen 80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ { root /var/www/html; }

    location / {
        proxy_pass         http://127.0.0.1:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        client_max_body_size 15M;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/ona-api /etc/nginx/sites-enabled/ona-api
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> [6/6] Obtain Let's Encrypt certificate"
certbot --nginx \
  -d "$DOMAIN" \
  --non-interactive \
  --agree-tos \
  -m "$EMAIL" \
  --redirect \
  || {
    echo "!!! certbot failed — falling back to self-signed certificate"
    openssl req -x509 -nodes -days 365 \
      -newkey rsa:2048 \
      -keyout /etc/ssl/private/ona-selfsigned.key \
      -out /etc/ssl/certs/ona-selfsigned.crt \
      -subj "/C=CD/ST=Kinshasa/L=Kinshasa/O=WEZA LAB/CN=$DOMAIN"

    cat > /etc/nginx/sites-available/ona-api <<NGINX2
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name $DOMAIN;

    ssl_certificate     /etc/ssl/certs/ona-selfsigned.crt;
    ssl_certificate_key /etc/ssl/private/ona-selfsigned.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    location / {
        proxy_pass         http://127.0.0.1:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto https;
        proxy_cache_bypass \$http_upgrade;
        client_max_body_size 15M;
    }
}
NGINX2
    nginx -t && systemctl reload nginx
  }

echo ""
echo "======================================================"
echo " ONA API server bootstrap complete!"
echo " Domain : https://$DOMAIN"
echo " API port: $API_PORT (internal port 3000)"
echo ""
echo " Next steps on THIS server:"
echo "   cd $APP_DIR"
echo "   docker compose up -d"
echo "======================================================"
