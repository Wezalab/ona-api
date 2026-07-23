#!/usr/bin/env python3
"""
ONA API — remote deploy via paramiko (SSH + SFTP)
Uploads the project and bootstraps the server.
"""
import os, sys, tarfile, io, time
import paramiko

HOST     = "46.202.168.1"
PORT     = 22
USER     = "root"
PASSWORD = "Ch4ng3m32025?"
DOMAIN   = "ona.edu-pedia.com"
APP_PORT = 3847          # host port exposed by docker
EMAIL    = "wezalab@gmail.com"
APP_DIR  = "/opt/ona-api"
LOCAL_SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # /…/ona-api

EXCLUDE = {
    "node_modules", ".git", "dist", "coverage", "deploy",
    ".env", "__pycache__", "*.log",
}

ENV_CONTENT = f"""NODE_ENV=production
PORT=3000
CORS_ORIGINS=*
MONGODB_URI=mongodb://mongo:27017/ona
JWT_ACCESS_SECRET=ona-prod-access-SECURE-CHANGE-ME
JWT_ACCESS_TTL=900s
JWT_REFRESH_SECRET=ona-prod-refresh-SECURE-CHANGE-ME
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
"""

NGINX_CONF = f"""server {{
    listen 80;
    server_name {DOMAIN};
    location /.well-known/acme-challenge/ {{ root /var/www/html; }}
    location / {{
        proxy_pass         http://127.0.0.1:{APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 15M;
    }}
}}
"""

SETUP_SCRIPT = f"""#!/bin/bash
set -euo pipefail

echo '>>> apt update'
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq

echo '>>> install nginx, certbot'
apt-get install -y -qq nginx certbot python3-certbot-nginx

echo '>>> install docker'
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
if ! docker compose version &>/dev/null 2>&1; then
  apt-get install -y -qq docker-compose-plugin
fi
systemctl enable --now docker nginx

echo '>>> nginx config'
cat > /etc/nginx/sites-available/ona-api << 'NGINXEOF'
{NGINX_CONF}
NGINXEOF
ln -sf /etc/nginx/sites-available/ona-api /etc/nginx/sites-enabled/ona-api
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo '>>> certbot'
certbot --nginx \\
  -d {DOMAIN} \\
  --non-interactive \\
  --agree-tos \\
  -m {EMAIL} \\
  --redirect \\
  || {{
    echo 'certbot failed — using self-signed'
    openssl req -x509 -nodes -days 365 \\
      -newkey rsa:2048 \\
      -keyout /etc/ssl/private/ona-selfsigned.key \\
      -out    /etc/ssl/certs/ona-selfsigned.crt \\
      -subj "/C=CD/ST=Kinshasa/L=Kinshasa/O=WEZALAB/CN={DOMAIN}"

    cat > /etc/nginx/sites-available/ona-api << 'NGINXEOF2'
server {{
    listen 80;
    server_name {DOMAIN};
    return 301 https://$host$request_uri;
}}
server {{
    listen 443 ssl;
    server_name {DOMAIN};
    ssl_certificate     /etc/ssl/certs/ona-selfsigned.crt;
    ssl_certificate_key /etc/ssl/private/ona-selfsigned.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    location / {{
        proxy_pass         http://127.0.0.1:{APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-Proto https;
        client_max_body_size 15M;
    }}
}}
NGINXEOF2
    nginx -t && systemctl reload nginx
  }}

echo '>>> docker compose up'
cd {APP_DIR}
docker compose pull --quiet 2>/dev/null || true
docker compose up -d --build

echo '>>> done'
docker compose ps
"""

def run(ssh: paramiko.SSHClient, cmd: str, timeout=120) -> tuple[int, str, str]:
    print(f"  $ {cmd[:80]}{'…' if len(cmd)>80 else ''}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout, get_pty=True)
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    rc  = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.strip())
    if err.strip() and rc != 0:
        print("STDERR:", err.strip(), file=sys.stderr)
    return rc, out, err

def make_tarball() -> bytes:
    """Pack the backend source (minus excludes) into a tar.gz in memory."""
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for root, dirs, files in os.walk(LOCAL_SRC):
            dirs[:] = [d for d in dirs if d not in EXCLUDE]
            for f in files:
                if any(f.endswith(e.lstrip("*")) for e in EXCLUDE if "*" in e):
                    continue
                path = os.path.join(root, f)
                arcname = os.path.relpath(path, LOCAL_SRC)
                tar.add(path, arcname=arcname)
    return buf.getvalue()

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {HOST}…")
    ssh.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=15)
    print("Connected.\n")

    # 1. Create app dir
    run(ssh, f"mkdir -p {APP_DIR}")

    # 2. Upload source
    print("Uploading source…")
    tarball = make_tarball()
    sftp = ssh.open_sftp()
    sftp.putfo(io.BytesIO(tarball), f"{APP_DIR}/src.tar.gz")
    sftp.close()
    run(ssh, f"cd {APP_DIR} && tar -xzf src.tar.gz --strip-components=0 && rm src.tar.gz")

    # 3. Write .env on server
    run(ssh, f"cat > {APP_DIR}/.env << 'ENVEOF'\n{ENV_CONTENT}\nENVEOF")

    # 4. Write setup script and run
    print("\nRunning server bootstrap (apt, docker, nginx, certbot)…")
    sftp = ssh.open_sftp()
    sftp.putfo(io.BytesIO(SETUP_SCRIPT.encode()), f"{APP_DIR}/setup.sh")
    sftp.close()
    run(ssh, f"chmod +x {APP_DIR}/setup.sh && bash {APP_DIR}/setup.sh", timeout=600)

    print("\n✅  Deploy complete!")
    print(f"    API live at: https://{DOMAIN}/api")
    print(f"    Swagger:     https://{DOMAIN}/api/docs")
    ssh.close()

if __name__ == "__main__":
    main()
