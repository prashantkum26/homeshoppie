#!/usr/bin/env bash

set -Eeuo pipefail

# ============================================================
# HomeShoppie - Nginx Setup
# ============================================================

APP_NAME="homeshoppie"
APP_PORT="3000"

# CHANGE THESE TO YOUR REAL DOMAIN
DOMAIN="homeshoppie.com"
WWW_DOMAIN="www.homeshoppie.com"

NGINX_CONF="/etc/nginx/conf.d/${APP_NAME}.conf"
PROJECT_DIR="/home/ec2-user/homeshoppie"

echo ""
echo "============================================================"
echo " HomeShoppie - Nginx Setup"
echo "============================================================"
echo ""

# ------------------------------------------------------------
# Root check
# ------------------------------------------------------------

if [[ "${EUID}" -ne 0 ]]; then
    echo "ERROR: This script must be run with sudo."
    echo ""
    echo "Run:"
    echo "  sudo ./setup-nginx.sh"
    echo ""
    exit 1
fi

echo "Running as: $(whoami)"
echo "Domain:     ${DOMAIN}"
echo "WWW:        ${WWW_DOMAIN}"
echo "App port:   ${APP_PORT}"
echo ""

# ------------------------------------------------------------
# Check Amazon Linux
# ------------------------------------------------------------

if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    echo "OS: ${PRETTY_NAME:-Unknown}"
else
    echo "WARNING: Unable to detect operating system."
fi

# ------------------------------------------------------------
# Install Nginx if missing
# ------------------------------------------------------------

if command -v nginx >/dev/null 2>&1; then
    echo "✓ Nginx already installed"
else
    echo "Installing Nginx..."

    dnf install -y nginx

    echo "✓ Nginx installed"
fi

# ------------------------------------------------------------
# Enable Nginx
# ------------------------------------------------------------

systemctl enable nginx

echo "✓ Nginx enabled at boot"

# ------------------------------------------------------------
# Create Nginx configuration
# ------------------------------------------------------------

echo ""
echo "Creating:"
echo "  ${NGINX_CONF}"
echo ""

cat > "${NGINX_CONF}" <<EOF
# ============================================================
# HomeShoppie
# Next.js reverse proxy
# ============================================================

server {
    listen 80;
    listen [::]:80;

    server_name ${DOMAIN} ${WWW_DOMAIN};

    # --------------------------------------------------------
    # Security headers
    # --------------------------------------------------------

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # --------------------------------------------------------
    # Gzip
    # --------------------------------------------------------

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;

    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # --------------------------------------------------------
    # Next.js static assets
    # --------------------------------------------------------

    location /_next/static/ {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # --------------------------------------------------------
    # Main Next.js application
    # --------------------------------------------------------

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};

        proxy_http_version 1.1;

        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_cache_bypass \$http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # --------------------------------------------------------
    # Block hidden files
    # --------------------------------------------------------

    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    # --------------------------------------------------------
    # Block sensitive files
    # --------------------------------------------------------

    location ~* ^/(\.env|\.env\..*|package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|ecosystem\.config\.js|tsconfig\.json|next\.config\..*)$ {
        deny all;
        access_log off;
        log_not_found off;
    }
}
EOF

echo "✓ Nginx configuration created"

# ------------------------------------------------------------
# Validate configuration
# ------------------------------------------------------------

echo ""
echo "Testing Nginx configuration..."

if nginx -t; then
    echo "✓ Nginx configuration is valid"
else
    echo ""
    echo "ERROR: Nginx configuration test failed."
    echo ""
    exit 1
fi

# ------------------------------------------------------------
# Check application
# ------------------------------------------------------------

echo ""
echo "Checking HomeShoppie application..."

if curl -fsS --max-time 5 "http://127.0.0.1:${APP_PORT}" >/dev/null 2>&1; then
    echo "✓ HomeShoppie is responding on port ${APP_PORT}"
else
    echo "WARNING: HomeShoppie is not responding on port ${APP_PORT}"
    echo ""
    echo "Make sure PM2 is running:"
    echo ""
    echo "  pm2 status"
    echo "  pm2 restart ${APP_NAME}"
    echo ""
fi

# ------------------------------------------------------------
# Restart Nginx
# ------------------------------------------------------------

echo ""
echo "Restarting Nginx..."

systemctl restart nginx

if systemctl is-active --quiet nginx; then
    echo "✓ Nginx is running"
else
    echo "ERROR: Nginx failed to start."
    echo ""
    systemctl status nginx --no-pager
    exit 1
fi

# ------------------------------------------------------------
# Firewall / listening port
# ------------------------------------------------------------

echo ""
echo "Checking listening ports..."

ss -lntp | grep -E ':80 |:443 |:3000 ' || true

# ------------------------------------------------------------
# Final information
# ------------------------------------------------------------

echo ""
echo "============================================================"
echo " Nginx Setup Complete"
echo "============================================================"
echo ""
echo "Nginx config:"
echo "  ${NGINX_CONF}"
echo ""
echo "Application:"
echo "  http://127.0.0.1:${APP_PORT}"
echo ""
echo "Domain:"
echo "  http://${DOMAIN}"
echo "  http://${WWW_DOMAIN}"
echo ""
echo "Next step for HTTPS:"
echo ""
echo "  sudo certbot --nginx -d ${DOMAIN} -d ${WWW_DOMAIN}"
echo ""
echo "============================================================"