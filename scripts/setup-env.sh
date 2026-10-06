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

    # Fix ownership
    if [[ "$CURRENT_OWNER" != "${APP_USER}:${APP_USER}" ]]; then

        warn "Fixing environment file ownership..."

        ${SUDO} chown "$APP_USER:$APP_USER" "$ENV_FILE"

        success "Ownership changed to ${APP_USER}:${APP_USER}."

    fi

    # Fix permissions
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
# Database
# ============================================================

DATABASE_URL=""

# ============================================================
# Authentication
# ============================================================

NEXTAUTH_SECRET=""

# ============================================================
# Razorpay
# ============================================================

RAZORPAY_KEY_ID=""
RAZORPAY_KEY_SECRET=""

# ============================================================
# Public Razorpay Key
# Only use NEXT_PUBLIC_ for values safe to expose to browser.
# ============================================================

NEXT_PUBLIC_RAZORPAY_KEY_ID=""

# ============================================================
# Email / SMTP
# ============================================================

# SMTP_HOST=""
# SMTP_PORT=""
# SMTP_USER=""
# SMTP_PASSWORD=""

# ============================================================
# Admin
# ============================================================

# ADMIN_EMAIL=""
# ADMIN_PASSWORD=""

# ============================================================
# Add other server-side secrets below
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
# 9. Final information
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
echo "4. Run deployment:"
echo
echo "   ./deploy.sh"
echo
echo "============================================================"

success "Environment setup completed."