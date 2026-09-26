#!/usr/bin/env bash
# ==============================================================================
# SedayaClick VPS Setup & Deployment Script
# Target OS: Ubuntu 20.04 / 22.04 / 24.04 LTS
# ==============================================================================

set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=====================================================${NC}"
echo -e "${GREEN}   Setup & Deploy SedayaClick PWA di VPS Rumahweb   ${NC}"
echo -e "${BLUE}=====================================================${NC}"

if [ "$(id -u)" -ne 0 ]; then
    echo -e "${RED}Script ini harus dijalankan sebagai root.${NC}"
    exit 1
fi

DOMAIN="${1:-sedayaclick.cloud}"
EMAIL="${2:-admin@sedayaclick.cloud}"

echo -e "Domain yang akan digunakan: ${GREEN}${DOMAIN}${NC}"
echo -e "Email untuk Let's Encrypt : ${GREEN}${EMAIL}${NC}"

# Generate password acak untuk DB dan Session
DB_PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 16)
SESSION_SECRET=$(openssl rand -hex 32)

# Buat Swap 2GB jika belum ada untuk stabilitas RAM
if [ "$(swapon --show | wc -l)" -le 1 ]; then
    echo -e "\n${YELLOW}[Info] Membuat 2GB Swap Memory untuk stabilitas...${NC}"
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    if ! grep -q '/swapfile' /etc/fstab; then
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
    fi
fi

echo -e "\n${YELLOW}[1/8] Memperbarui sistem operasi & instalasi utility...${NC}"
DEBIAN_FRONTEND=noninteractive apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y curl wget git ufw fail2ban openssl build-essential software-properties-common

# Set Timezone WIB (Asia/Jakarta)
timedatectl set-timezone Asia/Jakarta

echo -e "\n${YELLOW}[2/8] Menginstal Node.js 20 LTS & PM2...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
npm install -g pm2

echo -e "\n${YELLOW}[3/8] Menginstal & mengonfigurasi MySQL Server...${NC}"
DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server
systemctl enable --now mysql

# Buat database dan user MySQL
mysql -e "CREATE DATABASE IF NOT EXISTS sedayaclick CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS 'sedaya_user'@'localhost' IDENTIFIED WITH mysql_native_password BY '${DB_PASS}';"
mysql -e "ALTER USER 'sedaya_user'@'localhost' IDENTIFIED WITH mysql_native_password BY '${DB_PASS}';"
mysql -e "GRANT ALL PRIVILEGES ON sedayaclick.* TO 'sedaya_user'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

echo -e "\n${YELLOW}[4/8] Mengunduh project dari GitHub...${NC}"
APP_DIR="/var/www/sedayaclick"
if [ -d "$APP_DIR/.git" ]; then
    echo "Direktori $APP_DIR sudah ada, menarik pembaruan..."
    cd "$APP_DIR"
    git fetch origin main
    git reset --hard origin/main
else
    mkdir -p /var/www
    git clone https://github.com/dausfla/SedayaClickAbsensiDigital.git "$APP_DIR"
    cd "$APP_DIR"
fi

echo -e "\n${YELLOW}[5/8] Konfigurasi environment (.env) & import database...${NC}"
cat > "$APP_DIR/.env" <<EOF
PORT=3000
SESSION_SECRET=${SESSION_SECRET}
NODE_ENV=production
ALLOWED_ORIGIN=https://${DOMAIN},https://www.${DOMAIN}

DB_HOST=localhost
DB_PORT=3306
DB_USER=sedaya_user
DB_PASSWORD=${DB_PASS}
DB_NAME=sedayaclick

# Toleransi lokasi kantor
OFFICE_LATITUDE=-6.597147
OFFICE_LONGITUDE=106.806038
OFFICE_RADIUS_METERS=150
EOF

# Install dependensi
npm install --production

# Import skema database
mysql -u sedaya_user -p"${DB_PASS}" sedayaclick < config/schema.sql

# Seed akun Super Admin default
npm run seed

echo -e "\n${YELLOW}[6/8] Menjalankan aplikasi dengan PM2...${NC}"
mkdir -p uploads/attendance uploads/submissions
chmod -R 755 uploads

pm2 stop sedayaclick 2>/dev/null || true
pm2 delete sedayaclick 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup systemd -u root --hp /root || true

echo -e "\n${YELLOW}[7/8] Menginstal & mengonfigurasi Nginx...${NC}"
DEBIAN_FRONTEND=noninteractive apt-get install -y nginx certbot python3-certbot-nginx

# Buat konfigurasi Nginx
cat > "/etc/nginx/sites-available/sedayaclick" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};

    client_max_body_size 25M;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/sedayaclick /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo -e "\n${YELLOW}[8/8] Menerapkan SSL HTTPS Let's Encrypt...${NC}"
certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" --non-interactive --agree-tos -m "${EMAIL}" --redirect || {
    echo -e "${YELLOW}Mencoba SSL hanya untuk domain root ${DOMAIN}...${NC}"
    certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${EMAIL}" --redirect || {
        echo -e "${RED}Peringatan: Gagal mendapatkan SSL. Periksa DNS domain ${DOMAIN}.${NC}"
    }
}

# Firewall UFW
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo -e "\n${BLUE}=====================================================${NC}"
echo -e "${GREEN}   SELESAI! SedayaClick Berhasil Dideploy!           ${NC}"
echo -e "${BLUE}=====================================================${NC}"
echo -e "Akses Website     : https://${DOMAIN}"
echo -e "Database User     : sedaya_user"
echo -e "Database Pass     : ${DB_PASS}"
echo -e "Status PM2        : 'pm2 status' atau 'pm2 logs'"
echo -e "${BLUE}=====================================================${NC}"
