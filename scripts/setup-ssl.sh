#!/usr/bin/env bash

set -Eeuo pipefail

# ============================================================
# HomeShoppie - Let's Encrypt SSL Setup
# Amazon Linux 2023 + Nginx + Certbot
# ============================================================

APP_NAME="homeshoppie"

# ============================================================
# CHANGE THESE
# ============================================================

DOMAIN="homeshoppie.com"
WWW_DOMAIN="www.homeshoppie.com"
EMAIL="admin@${DOMAIN}"

# ============================================================
# COLORS
# ============================================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================
# LOGGING
# ============================================================

log() {
    echo -e "${GREEN}[OK]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

section() {
    echo ""
    echo "============================================================"
    echo " $1"
    echo "============================================================"
    echo ""
}

# ============================================================
# ERROR HANDLER
# ============================================================

trap 'error "Script failed at line $LINENO."; error "Command: $BASH_COMMAND"; exit 1' ERR

# ============================================================
# ROOT CHECK
# ============================================================

if [[ "${EUID}" -ne 0 ]]; then
    error "This script must be run with sudo."
    echo ""
    echo "Run:"
    echo "  sudo ./scripts/setup-ssl.sh"
    echo ""
    exit 1
fi

# ============================================================
# HEADER
# ============================================================

echo ""
echo "============================================================"
echo " HomeShoppie - Let's Encrypt SSL Setup"
echo "============================================================"
echo ""
echo "Domain:     ${DOMAIN}"
echo "WWW Domain: ${WWW_DOMAIN}"
echo "Email:      ${EMAIL}"
echo ""

# ============================================================
# OPERATING SYSTEM CHECK
# ============================================================

section "Checking Operating System"

if [[ ! -f /etc/os-release ]]; then
    error "/etc/os-release not found."
    exit 1
fi

. /etc/os-release

echo "Operating System:"
echo "  ${PRETTY_NAME:-Unknown}"
echo ""

if [[ "${ID:-}" != "amzn" ]]; then
    warn "This script is designed for Amazon Linux."
    warn "Detected OS: ${PRETTY_NAME:-Unknown}"
fi

if ! command -v dnf >/dev/null 2>&1; then
    error "dnf was not found."
    error "This script requires Amazon Linux / a DNF-based system."
    exit 1
fi

log "DNF package manager is available"

# ============================================================
# CHECK REQUIRED COMMANDS
# ============================================================

section "Checking Required Commands"

for CMD in systemctl nginx curl ss getent awk grep; do
    if command -v "${CMD}" >/dev/null 2>&1; then
        log "${CMD} is available"
    else
        error "${CMD} is not installed or not available."
        exit 1
    fi
done

# ============================================================
# CHECK NGINX
# ============================================================

section "Checking Nginx"

if ! command -v nginx >/dev/null 2>&1; then
    error "Nginx is not installed."
    echo ""
    echo "Install Nginx first using your Nginx setup script."
    echo ""
    exit 1
fi

log "Nginx is installed"

echo ""
nginx -v 2>&1 || true

# ============================================================
# CHECK NGINX SERVICE
# ============================================================

section "Checking Nginx Service"

if systemctl is-enabled --quiet nginx 2>/dev/null; then
    log "Nginx is enabled at boot"
else
    warn "Nginx is not enabled at boot."
    systemctl enable nginx
    log "Nginx enabled at boot"
fi

if systemctl is-active --quiet nginx; then
    log "Nginx is running"
else
    warn "Nginx is not running."
    echo "Starting Nginx..."

    systemctl start nginx

    if systemctl is-active --quiet nginx; then
        log "Nginx started successfully"
    else
        error "Failed to start Nginx."
        systemctl --no-pager --full status nginx || true
        exit 1
    fi
fi

# ============================================================
# CHECK NGINX CONFIGURATION
# ============================================================

section "Testing Nginx Configuration"

if nginx -t; then
    log "Nginx configuration is valid"
else
    error "Nginx configuration test failed."
    exit 1
fi

# ============================================================
# DNS CHECK
# ============================================================

section "Checking DNS"

info "Checking IPv4 DNS resolution..."

DOMAIN_IP="$(getent ahostsv4 "${DOMAIN}" 2>/dev/null | awk 'NR==1 {print $1}' || true)"
WWW_IP="$(getent ahostsv4 "${WWW_DOMAIN}" 2>/dev/null | awk 'NR==1 {print $1}' || true)"

if [[ -z "${DOMAIN_IP}" ]]; then
    error "${DOMAIN} does not resolve to an IPv4 address."
    echo ""
    echo "Make sure your DNS A record points to this server."
    echo ""
    echo "Expected:"
    echo "  ${DOMAIN} -> <YOUR_SERVER_PUBLIC_IP>"
    echo ""
    exit 1
fi

log "${DOMAIN} resolves to ${DOMAIN_IP}"

if [[ -z "${WWW_IP}" ]]; then
    error "${WWW_DOMAIN} does not resolve to an IPv4 address."
    echo ""
    echo "Make sure your DNS A record exists:"
    echo ""
    echo "  ${WWW_DOMAIN} -> <YOUR_SERVER_PUBLIC_IP>"
    echo ""
    exit 1
fi

log "${WWW_DOMAIN} resolves to ${WWW_IP}"

# ============================================================
# SHOW DNS WARNING IF DOMAINS DIFFER
# ============================================================

if [[ "${DOMAIN_IP}" != "${WWW_IP}" ]]; then
    warn "The root and www domains resolve to different IP addresses."
    echo ""
    echo "Root:"
    echo "  ${DOMAIN} -> ${DOMAIN_IP}"
    echo ""
    echo "WWW:"
    echo "  ${WWW_DOMAIN} -> ${WWW_IP}"
    echo ""
    echo "Both domains should normally point to this server"
    echo "before requesting the certificate."
    echo ""
fi

# ============================================================
# CHECK PORT 80
# ============================================================

section "Checking HTTP Port 80"

if ss -lnt 2>/dev/null | grep -qE '(:80[[:space:]]|:80$)'; then
    log "Port 80 is listening"
else
    warn "Port 80 is not currently listening."
    echo ""
    echo "Let's Encrypt HTTP-01 validation may fail."
    echo ""
fi

# ============================================================
# CHECK PORT 443
# ============================================================

section "Checking HTTPS Port 443"

if ss -lnt 2>/dev/null | grep -qE '(:443[[:space:]]|:443$)'; then
    log "Port 443 is already listening"
else
    info "Port 443 is not listening yet."
    info "This is normal before SSL is installed."
fi

# ============================================================
# INSTALL CERTBOT
# ============================================================

section "Checking Certbot"

if command -v certbot >/dev/null 2>&1; then
    log "Certbot is already installed"
else
    info "Certbot is not installed."
    info "Installing Certbot..."

    dnf install -y certbot

    if command -v certbot >/dev/null 2>&1; then
        log "Certbot installed successfully"
    else
        error "Certbot installation failed."
        exit 1
    fi
fi

echo ""
certbot --version

# ============================================================
# INSTALL CERTBOT NGINX PLUGIN
# ============================================================

section "Checking Certbot Nginx Plugin"

if rpm -q python3-certbot-nginx >/dev/null 2>&1; then
    log "python3-certbot-nginx package is installed"
else
    warn "python3-certbot-nginx is not installed."
    info "Installing Certbot Nginx plugin..."

    dnf install -y python3-certbot-nginx

    if rpm -q python3-certbot-nginx >/dev/null 2>&1; then
        log "Certbot Nginx plugin installed successfully"
    else
        error "Failed to install python3-certbot-nginx."
        exit 1
    fi
fi

# ============================================================
# VERIFY CERTBOT NGINX PLUGIN
# ============================================================

section "Verifying Certbot Plugins"

if certbot plugins 2>/dev/null | grep -qiE '(^|[[:space:]])nginx([[:space:]]|$)'; then
    log "Certbot Nginx plugin is available"
else
    error "Certbot Nginx plugin is NOT available."
    echo ""
    echo "Installed Certbot plugins:"
    echo ""
    certbot plugins || true
    echo ""
    echo "Try manually:"
    echo "  sudo dnf reinstall -y python3-certbot-nginx"
    echo ""
    exit 1
fi

# ============================================================
# TEST NGINX BEFORE CERTBOT
# ============================================================

section "Testing Nginx Before SSL"

if nginx -t; then
    log "Nginx configuration is valid"
else
    error "Nginx configuration test failed."
    exit 1
fi

# ============================================================
# CHECK HTTP RESPONSE
# ============================================================

section "Checking HTTP Response"

HTTP_STATUS="$(curl \
    -s \
    -o /dev/null \
    -w "%{http_code}" \
    --max-time 15 \
    "http://${DOMAIN}" || true)"

if [[ -n "${HTTP_STATUS}" && "${HTTP_STATUS}" != "000" ]]; then
    log "HTTP request to ${DOMAIN} returned status ${HTTP_STATUS}"
else
    warn "Could not get an HTTP response from ${DOMAIN}."
    echo ""
    echo "Possible causes:"
    echo "  - EC2 Security Group does not allow TCP 80"
    echo "  - Nginx server block is incorrect"
    echo "  - AWS networking issue"
    echo ""
fi

# ============================================================
# FIREWALL CHECK
# ============================================================

section "Checking Firewall"

if command -v firewall-cmd >/dev/null 2>&1; then

    if systemctl is-active --quiet firewalld; then
        log "firewalld is active"

        info "Allowing HTTP..."
        firewall-cmd --permanent --add-service=http >/dev/null

        info "Allowing HTTPS..."
        firewall-cmd --permanent --add-service=https >/dev/null

        firewall-cmd --reload >/dev/null

        log "HTTP/HTTPS allowed through firewalld"
    else
        info "firewalld is installed but not active"
    fi

else
    info "firewalld is not installed"

    echo ""
    echo "For AWS EC2, make sure your Security Group allows:"
    echo ""
    echo "  TCP 80   0.0.0.0/0"
    echo "  TCP 443  0.0.0.0/0"
    echo ""
fi

# ============================================================
# EXISTING CERTIFICATE CHECK
# ============================================================

section "Checking Existing Certificate"

CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
KEY_PATH="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"

if [[ -f "${CERT_PATH}" && -f "${KEY_PATH}" ]]; then

    log "Existing certificate found"

    echo ""
    echo "Certificate:"
    echo "  ${CERT_PATH}"
    echo ""
    echo "Private key:"
    echo "  ${KEY_PATH}"
    echo ""

    if openssl x509 \
        -in "${CERT_PATH}" \
        -noout \
        -subject \
        -issuer \
        -dates 2>/dev/null; then

        log "Existing certificate is readable"
    else
        warn "Existing certificate could not be inspected"
    fi

else
    info "No existing certificate found"
fi

# ============================================================
# REQUEST / INSTALL SSL
# ============================================================

section "Requesting Let's Encrypt Certificate"

echo "Domains:"
echo "  ${DOMAIN}"
echo "  ${WWW_DOMAIN}"
echo ""
echo "Email:"
echo "  ${EMAIL}"
echo ""

info "Running Certbot with Nginx plugin..."

if certbot \
    --nginx \
    --non-interactive \
    --agree-tos \
    --redirect \
    --keep-until-expiring \
    --email "${EMAIL}" \
    -d "${DOMAIN}" \
    -d "${WWW_DOMAIN}"; then

    log "Certbot completed successfully"

else

    error "Certbot failed."
    echo ""
    echo "The detailed log is:"
    echo "  /var/log/letsencrypt/letsencrypt.log"
    echo ""
    echo "Useful command:"
    echo "  sudo tail -100 /var/log/letsencrypt/letsencrypt.log"
    echo ""

    exit 1
fi

# ============================================================
# TEST NGINX AFTER CERTBOT
# ============================================================

section "Testing Nginx After SSL"

if nginx -t; then
    log "Nginx SSL configuration is valid"
else
    error "Nginx configuration became invalid after Certbot."
    exit 1
fi

# ============================================================
# RELOAD NGINX
# ============================================================

section "Reloading Nginx"

systemctl reload nginx

if systemctl is-active --quiet nginx; then
    log "Nginx reloaded successfully"
else
    error "Nginx is not running after reload."
    systemctl --no-pager --full status nginx || true
    exit 1
fi

# ============================================================
# CHECK CERTIFICATE FILES
# ============================================================

section "Checking Certificate Files"

if [[ -f "${CERT_PATH}" ]]; then
    log "Certificate file exists"
else
    error "Certificate file not found:"
    error "${CERT_PATH}"
    exit 1
fi

if [[ -f "${KEY_PATH}" ]]; then
    log "Private key exists"
else
    error "Private key not found:"
    error "${KEY_PATH}"
    exit 1
fi

# ============================================================
# CERTIFICATE INFORMATION
# ============================================================

section "Certificate Information"

certbot certificates

echo ""

if openssl x509 \
    -in "${CERT_PATH}" \
    -noout \
    -subject \
    -issuer \
    -dates; then

    log "Certificate information read successfully"

else
    warn "Could not read certificate information"
fi

# ============================================================
# TEST HTTPS ROOT DOMAIN
# ============================================================

section "Testing HTTPS - Root Domain"

HTTPS_STATUS="$(curl \
    -k \
    -s \
    -o /dev/null \
    -w "%{http_code}" \
    --max-time 15 \
    "https://${DOMAIN}" || true)"

if [[ -n "${HTTPS_STATUS}" && "${HTTPS_STATUS}" != "000" ]]; then
    log "HTTPS request to ${DOMAIN} returned status ${HTTPS_STATUS}"
else
    warn "HTTPS request to ${DOMAIN} failed"
    echo ""
    echo "Check:"
    echo "  1. EC2 Security Group allows TCP 443"
    echo "  2. Nginx is running"
    echo "  3. SSL certificate exists"
    echo "  4. Nginx SSL configuration is correct"
    echo ""
fi

# ============================================================
# TEST WWW HTTPS
# ============================================================

section "Testing HTTPS - WWW Domain"

WWW_HTTPS_STATUS="$(curl \
    -k \
    -s \
    -o /dev/null \
    -w "%{http_code}" \
    --max-time 15 \
    "https://${WWW_DOMAIN}" || true)"

if [[ -n "${WWW_HTTPS_STATUS}" && "${WWW_HTTPS_STATUS}" != "000" ]]; then
    log "HTTPS request to ${WWW_DOMAIN} returned status ${WWW_HTTPS_STATUS}"
else
    warn "HTTPS request to ${WWW_DOMAIN} failed"
fi

# ============================================================
# CHECK HTTP -> HTTPS REDIRECT
# ============================================================

section "Checking HTTP to HTTPS Redirect"

REDIRECT_LOCATION="$(curl \
    -s \
    -I \
    -L \
    --max-time 15 \
    -o /dev/null \
    -w "%{url_effective}" \
    "http://${DOMAIN}" || true)"

if [[ "${REDIRECT_LOCATION}" == https://* ]]; then
    log "HTTP redirects to HTTPS"
    echo "Final URL:"
    echo "  ${REDIRECT_LOCATION}"
else
    warn "Could not confirm HTTP -> HTTPS redirect"
    echo "Final URL:"
    echo "  ${REDIRECT_LOCATION:-unknown}"
fi

# ============================================================
# CERTIFICATE RENEWAL TEST
# ============================================================

section "Testing Automatic Certificate Renewal"

info "Running certbot renew --dry-run..."

if certbot renew --dry-run; then
    log "Certificate renewal dry-run succeeded"
else
    error "Certificate renewal dry-run failed"
    echo ""
    echo "Check:"
    echo "  sudo tail -100 /var/log/letsencrypt/letsencrypt.log"
    echo ""
    exit 1
fi

# ============================================================
# CHECK SYSTEMD RENEWAL TIMER
# ============================================================

section "Checking Certbot Renewal Timer"

if systemctl list-timers --all 2>/dev/null | grep -qi certbot; then
    log "Certbot renewal timer detected"

    echo ""
    systemctl list-timers --all 2>/dev/null | grep -i certbot || true

else

    warn "Certbot renewal timer was not detected."

    echo ""
    echo "Checking Certbot services..."
    systemctl list-unit-files 2>/dev/null | grep -i certbot || true

fi

# ============================================================
# CHECK NGINX STATUS
# ============================================================

section "Nginx Status"

if systemctl is-active --quiet nginx; then
    log "Nginx is active"
else
    error "Nginx is not active"
    exit 1
fi

systemctl --no-pager --full status nginx | head -20 || true

# ============================================================
# FINAL STATUS
# ============================================================

section "SSL SETUP COMPLETE"

echo "Application:"
echo "  ${APP_NAME}"
echo ""

echo "HTTP:"
echo "  http://${DOMAIN}"
echo ""

echo "HTTPS:"
echo "  https://${DOMAIN}"
echo ""

echo "WWW HTTPS:"
echo "  https://${WWW_DOMAIN}"
echo ""

echo "Certificate:"
echo "  ${CERT_PATH}"
echo ""

echo "Private Key:"
echo "  ${KEY_PATH}"
echo ""

echo "Certificate renewal test:"
echo "  sudo certbot renew --dry-run"
echo ""

echo "Certbot certificates:"
echo "  sudo certbot certificates"
echo ""

echo "Nginx test:"
echo "  sudo nginx -t"
echo ""

echo "Nginx reload:"
echo "  sudo systemctl reload nginx"
echo ""

echo "Nginx status:"
echo "  sudo systemctl status nginx"
echo ""

echo "============================================================"
echo " HTTPS IS CONFIGURED FOR HOMESHOPPIE"
echo "============================================================"
echo ""