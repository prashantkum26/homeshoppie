#!/usr/bin/env bash

set -Eeuo pipefail

# ============================================================
# HomeShoppie - Production Environment Setup
# Amazon Linux + Next.js + PM2
# ============================================================

APP_NAME="homeshoppie"
ENV_DIR="/etc/${APP_NAME}"
ENV_FILE="${ENV_DIR}/.env.production"

# User that runs deployment / PM2
APP_USER="${SUDO_USER:-${USER}}"

# ------------------------------------------------------------
# Colors
# ------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✓ $1${NC}"
}

warn() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

error() {
    echo -e "${RED}✗ $1${NC}"
}

# ============================================================
# 1. Check sudo
# ============================================================

if [[ "${EUID}" -eq 0 ]]; then
    SUDO=""
else
    if ! command -v sudo >/dev/null 2>&1; then
        error "sudo is required."
        exit 1
    fi

    SUDO="sudo"
fi

# ============================================================
# 2. Validate application user
# ============================================================

if ! id "$APP_USER" >/dev/null 2>&1; then
    error "Application user does not exist: $APP_USER"
    exit 1
fi

log "Application user: $APP_USER"

# ============================================================
# 3. Create environment directory
# ============================================================

log "Creating environment directory..."

${SUDO} mkdir -p "$ENV_DIR"

# Only owner can access directory
${SUDO} chmod 700 "$ENV_DIR"

# Directory ownership
${SUDO} chown "$APP_USER:$APP_USER" "$ENV_DIR"

success "Environment directory ready:"
echo "  $ENV_DIR"

# ============================================================
# 4. Existing environment check
# ============================================================

if [[ -f "$ENV_FILE" ]]; then

    warn "Production environment file already exists:"
    echo "  $ENV_FILE"
    echo

    CURRENT_PERMS=$(stat -c "%a" "$ENV_FILE")
    CURRENT_OWNER=$(stat -c "%U:%G" "$ENV_FILE")

    echo "Current permissions: $CURRENT_PERMS"
    echo "Current owner      : $CURRENT_OWNER"

    # --------------------------------------------------------
    # Fix ownership
    # --------------------------------------------------------

    if [[ "$CURRENT_OWNER" != "${APP_USER}:${APP_USER}" ]]; then

        warn "Fixing environment file ownership..."

        ${SUDO} chown "$APP_USER:$APP_USER" "$ENV_FILE"

        success "Ownership changed to ${APP_USER}:${APP_USER}."

    fi

    # --------------------------------------------------------
    # Fix permissions
    # --------------------------------------------------------

    if [[ "$CURRENT_PERMS" != "600" ]]; then

        warn "Fixing environment file permissions..."

        ${SUDO} chmod 600 "$ENV_FILE"

        success "Permissions changed to 600."

    else

        success "Permissions are already 600."

    fi

    echo
    echo "Environment file was NOT overwritten."
    echo
    echo "To edit it:"
    echo "  sudo nano $ENV_FILE"
    echo
    echo "To verify:"
    echo "  sudo stat -c '%a %U:%G %n' $ENV_FILE"
    echo

    exit 0

fi

# ============================================================
# 5. Create environment file
# ============================================================

log "Creating production environment file..."

${SUDO} touch "$ENV_FILE"

# Set ownership BEFORE writing
${SUDO} chown "$APP_USER:$APP_USER" "$ENV_FILE"

# Secure permissions
${SUDO} chmod 600 "$ENV_FILE"

# ============================================================
# 6. Write environment template
# ============================================================

${SUDO} tee "$ENV_FILE" >/dev/null <<'EOF'
# ============================================================
# HomeShoppie - Production Environment
# ============================================================

NODE_ENV=production
PORT=3000

# ============================================================
# Application URLs
# ============================================================

NEXT_PUBLIC_URL="https://homeshoppie.com"
NEXT_PUBLIC_APP_URL="https://homeshoppie.com"
NEXTAUTH_URL="https://homeshoppie.com"
NEXT_PUBLIC_BASE_URL="https://homeshoppie.com"
NEXT_PUBLIC_IMAGE_SERVICE_URL="https://homeshoppie.com/api"

# ============================================================
# Database
# ============================================================

DATABASE_URL=""

# ============================================================
# Email / SMTP
# ============================================================

EMAIL_HOST=""
EMAIL_PORT=""
EMAIL_USER=""
EMAIL_PASS=""

# ============================================================
# JWT Authentication
# ============================================================

JWT_SECRET=""

# ============================================================
# Google OAuth
# ============================================================

GOOGLE_ID=""
GOOGLE_SECRET=""

# ============================================================
# Image Service
# ============================================================

# Internal server-to-server image service URL
IMAGE_SERVICE_BASE_URL="http://localhost:5000"

# Image service authentication
IMAGE_SERVICE_API_KEY=""
IMAGE_SERVICE_API_SECRET=""

# ============================================================
# Razorpay Configuration
# ============================================================

# Current mode: test
# Change to "live" for production payments when ready.
RAZORPAY_KEY_ID=""
RAZORPAY_KEY_SECRET=""
RAZORPAY_WEBHOOK_SECRET=""
RAZORPAY_MODE="test"

# Safe to expose to browser
NEXT_PUBLIC_RAZORPAY_KEY_ID=""

# ============================================================
# NextAuth
# ============================================================

NEXTAUTH_SECRET=""

# ============================================================
# Security Secrets
# ============================================================

CSRF_SECRET=""
CRON_SECRET=""

# ============================================================
# Add additional server-side secrets below
# ============================================================

EOF

# ============================================================
# 7. Secure ownership and permissions
# ============================================================

${SUDO} chown "$APP_USER:$APP_USER" "$ENV_FILE"
${SUDO} chmod 600 "$ENV_FILE"

# ============================================================
# 8. Verify
# ============================================================

log "Verifying environment file..."

if [[ ! -f "$ENV_FILE" ]]; then

    error "Failed to create environment file."
    exit 1

fi

PERMISSIONS=$(stat -c "%a" "$ENV_FILE")
OWNER=$(stat -c "%U:%G" "$ENV_FILE")

if [[ "$PERMISSIONS" != "600" ]]; then

    error "Incorrect permissions: $PERMISSIONS"
    error "Expected: 600"
    exit 1

fi

if [[ "$OWNER" != "${APP_USER}:${APP_USER}" ]]; then

    error "Incorrect ownership: $OWNER"
    error "Expected: ${APP_USER}:${APP_USER}"
    exit 1

fi

success "Environment file created securely."

# ============================================================
# 9. Verify required variables exist
# ============================================================

log "Checking required environment variable definitions..."

REQUIRED_VARS=(
    "NEXT_PUBLIC_URL"
    "NEXT_PUBLIC_APP_URL"
    "NEXTAUTH_URL"
    "NEXT_PUBLIC_BASE_URL"
    "NEXT_PUBLIC_IMAGE_SERVICE_URL"

    "DATABASE_URL"

    "EMAIL_HOST"
    "EMAIL_PORT"
    "EMAIL_USER"
    "EMAIL_PASS"

    "JWT_SECRET"

    "GOOGLE_ID"
    "GOOGLE_SECRET"

    "IMAGE_SERVICE_BASE_URL"
    "IMAGE_SERVICE_API_KEY"
    "IMAGE_SERVICE_API_SECRET"

    "RAZORPAY_KEY_ID"
    "RAZORPAY_KEY_SECRET"
    "RAZORPAY_WEBHOOK_SECRET"
    "RAZORPAY_MODE"
    "NEXT_PUBLIC_RAZORPAY_KEY_ID"

    "NEXTAUTH_SECRET"
    "CSRF_SECRET"
    "CRON_SECRET"
)

MISSING_VARS=()

for VAR in "${REQUIRED_VARS[@]}"; do

    if ! grep -qE "^${VAR}=" "$ENV_FILE"; then
        MISSING_VARS+=("$VAR")
    fi

done

if [[ "${#MISSING_VARS[@]}" -gt 0 ]]; then

    error "Missing environment variable definitions:"

    for VAR in "${MISSING_VARS[@]}"; do
        echo "  - $VAR"
    done

    exit 1

fi

success "All required environment variables are defined."

# ============================================================
# 10. Final information
# ============================================================

echo
echo "============================================================"
echo " Environment Configuration"
echo "============================================================"
echo
echo "Application : $APP_NAME"
echo "User        : $APP_USER"
echo "Directory   : $ENV_DIR"
echo "Environment : $ENV_FILE"
echo "Permissions : $PERMISSIONS"
echo "Owner       : $OWNER"
echo
echo "============================================================"
echo " Application URLs"
echo "============================================================"
echo
echo "NEXT_PUBLIC_URL               = https://homeshoppie.com"
echo "NEXT_PUBLIC_APP_URL           = https://homeshoppie.com"
echo "NEXTAUTH_URL                  = https://homeshoppie.com"
echo "NEXT_PUBLIC_BASE_URL          = https://homeshoppie.com"
echo "NEXT_PUBLIC_IMAGE_SERVICE_URL = https://homeshoppie.com/api"
echo
echo "============================================================"
echo " Image Service"
echo "============================================================"
echo
echo "IMAGE_SERVICE_BASE_URL = http://localhost:5000"
echo
echo "============================================================"
echo " Razorpay"
echo "============================================================"
echo
echo "RAZORPAY_MODE = test"
echo
echo "============================================================"
echo
echo "Next steps:"
echo
echo "1. Edit the environment file:"
echo
echo "   sudo nano $ENV_FILE"
echo
echo "2. Add your production secrets."
echo
echo "3. Verify permissions:"
echo
echo "   sudo stat -c '%a %U:%G %n' $ENV_FILE"
echo
echo "4. Verify variables without displaying secret values:"
echo
echo "   sudo grep -E '^[A-Z0-9_]+=' $ENV_FILE | cut -d= -f1"
echo
echo "5. Run deployment:"
echo
echo "   ./deploy.sh"
echo
echo "============================================================"

success "Environment setup completed."