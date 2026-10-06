#!/usr/bin/env bash

set -Eeuo pipefail

# ============================================================
# HomeShoppie - Let's Encrypt SSL Setup
# Amazon Linux 2023 + Nginx
# ============================================================

APP_NAME="homeshoppie"

# ============================================================
# CHANGE THESE
# ============================================================

DOMAIN="homeshoppie.com"
WWW_DOMAIN="www.homeshoppie.com"

# ============================================================
# COLORS
# ============================================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[OK]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ============================================================
# ROOT CHECK
# ============================================================

if [[ "${EUID}" -ne 0 ]]; then
    error "This script must be run with sudo."
    echo ""
    echo "Run:"
    echo "  sudo ./setup-ssl.sh"
    echo ""
    exit 1
fi

echo ""
echo "============================================================"
echo " HomeShoppie - Let's Encrypt SSL Setup"
echo "============================================================"
echo ""
echo "Domain:     ${DOMAIN}"
echo "WWW Domain: ${WWW_DOMAIN}"
echo ""

# ============================================================
# AMAZON LINUX CHECK
# ============================================================

if [[ -f /etc/os-release ]]; then
    . /etc/os-release

    echo "Operating System:"
    echo "  ${PRETTY_NAME:-Unknown}"
    echo ""
fi

if ! command -v dnf >/dev/null 2>&1; then
    error "dnf was not found. This script is intended for Amazon Linux."
    exit 1
fi

# ============================================================
# CHECK NGINX
# ============================================================

if ! command -v nginx >/dev/null 2>&1; then
    error "Nginx is not installed."
    echo ""
    echo "Run your Nginx setup script first:"
    echo ""
    echo "  sudo ./setup-nginx.sh"
    echo ""
    exit 1
fi

log "Nginx is installed"

# ============================================================
# CHECK NGINX SERVICE
# ============================================================

if systemctl is-active --quiet nginx; then
    log "Nginx is running"
else
    warn "Nginx is not running. Starting it..."
    systemctl enable nginx
    systemctl start nginx
    log "Nginx started"
fi

# ============================================================
# CHECK DNS
# ============================================================

echo ""
echo "Checking DNS..."

DOMAIN_IP="$(getent ahostsv4 "${DOMAIN}" 2>/dev/null | awk 'NR==1 {print $1}' || true)"
WWW_IP="$(getent ahostsv4 "${WWW_DOMAIN}" 2>/dev/null | awk 'NR==1 {print $1}' || true)"

if [[ -z "${DOMAIN_IP}" ]]; then
    error "${DOMAIN} does not resolve to an IPv4 address."
    echo ""
    echo "Make sure your DNS A record points to this EC2 instance."
    exit 1
fi

if [[ -z "${WWW_IP}" ]]; then
    warn "${WWW_DOMAIN} does not currently resolve."
    echo "Make sure the www DNS record is configured."
else
    log "${DOMAIN} resolves to ${DOMAIN_IP}"
    log "${WWW_DOMAIN} resolves to ${WWW_IP}"
fi

# ============================================================
# CHECK CERTBOT
# ============================================================

if command -v certbot >/dev/null 2>&1; then
    log "Certbot already installed"
else
    echo ""
    echo "Installing Certbot..."

    dnf install -y certbot python3-certbot-nginx

    log "Certbot installed"
fi

# ============================================================
# DISPLAY CERTBOT VERSION
# ============================================================

echo ""
certbot --version

# ============================================================
# TEST NGINX BEFORE CERTBOT
# ============================================================

echo ""
echo "Testing Nginx configuration..."

if nginx -t; then
    log "Nginx configuration is valid"
else
    error "Nginx configuration test failed."
    exit 1
fi

# ============================================================
# CHECK PORT 80
# ============================================================

echo ""
echo "Checking HTTP access..."

if ss -lnt | grep -q ':80 '; then
    log "Port 80 is listening"
else
    warn "Port 80 is not listening."
    echo "Let's Encrypt HTTP validation may fail."
fi

# ============================================================
# OBTAIN / INSTALL CERTIFICATE
# ============================================================

echo ""
echo "============================================================"
echo " Requesting Let's Encrypt certificate"
echo "============================================================"
echo ""

certbot \
    --nginx \
    --non-interactive \
    --agree-tos \
    --redirect \
    --keep-until-expiring \
    --email "admin@${DOMAIN}" \
    -d "${DOMAIN}" \
    -d "${WWW_DOMAIN}"

log "SSL certificate installed"

# ============================================================
# TEST NGINX AFTER CERTBOT
# ============================================================

echo ""
echo "Testing Nginx after SSL configuration..."

if nginx -t; then
    log "Nginx SSL configuration is valid"
else
    error "Nginx configuration became invalid after Certbot."
    exit 1
fi

# ============================================================
# RELOAD NGINX
# ============================================================

systemctl reload nginx

log "Nginx reloaded"

# ============================================================
# CERTIFICATE INFORMATION
# ============================================================

echo ""
echo "============================================================"
echo " Certificate Information"
echo "============================================================"
echo ""

certbot certificates

# ============================================================
# TEST HTTPS
# ============================================================

echo ""
echo "Testing HTTPS..."

if curl -fsSI --max-time 15 "https://${DOMAIN}" >/dev/null 2>&1; then
    log "HTTPS is working for ${DOMAIN}"
else
    warn "HTTPS test failed for ${DOMAIN}"
    echo ""
    echo "Check:"
    echo "  1. EC2 Security Group allows TCP 443"
    echo "  2. DNS points to this server"
    echo "  3. Nginx is running"
    echo ""
fi

# ============================================================
# TEST WWW HTTPS
# ============================================================

if curl -fsSI --max-time 15 "https://${WWW_DOMAIN}" >/dev/null 2>&1; then
    log "HTTPS is working for ${WWW_DOMAIN}"
else
    warn "HTTPS test failed for ${WWW_DOMAIN}"
fi

# ============================================================
# CERTIFICATE RENEWAL TEST
# ============================================================

echo ""
echo "============================================================"
echo " Testing automatic certificate renewal"
echo "============================================================"
echo ""

if certbot renew --dry-run; then
    log "Certificate renewal dry-run succeeded"
else
    error "Certificate renewal dry-run failed"
    exit 1
fi

# ============================================================
# SYSTEMD TIMER
# ============================================================

echo ""
echo "Checking Certbot renewal timer..."

if systemctl list-timers --all 2>/dev/null | grep -q certbot; then
    log "Certbot renewal timer is configured"
else
    warn "Certbot timer was not detected."
    echo "Check:"
    echo "  systemctl list-timers --all | grep certbot"
fi

# ============================================================
# FIREWALL INFORMATION
# ============================================================

echo ""
echo "============================================================"
echo " Firewall"
echo "============================================================"
echo ""

if command -v firewall-cmd >/dev/null 2>&1; then
    echo "firewalld detected."

    if systemctl is-active --quiet firewalld; then
        log "firewalld is active"

        firewall-cmd --permanent --add-service=http
        firewall-cmd --permanent --add-service=https
        firewall-cmd --reload

        log "HTTP/HTTPS allowed through firewalld"
    else
        echo "firewalld is not active."
    fi
else
    echo "No firewalld detected."
    echo ""
    echo "For EC2, make sure the Security Group allows:"
    echo "  TCP 80"
    echo "  TCP 443"
fi

# ============================================================
# FINAL STATUS
# ============================================================

echo ""
echo "============================================================"
echo " SSL SETUP COMPLETE"
echo "============================================================"
echo ""
echo "HTTP:"
echo "  http://${DOMAIN}"
echo ""
echo "HTTPS:"
echo "  https://${DOMAIN}"
echo ""
echo "WWW:"
echo "  https://${WWW_DOMAIN}"
echo ""
echo "Certificate:"
echo "  /etc/letsencrypt/live/${DOMAIN}/"
echo ""
echo "Test renewal:"
echo "  sudo certbot renew --dry-run"
echo ""
echo "Nginx status:"
systemctl --no-pager --full status nginx | head -20
echo ""
echo "============================================================"