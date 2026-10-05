#!/usr/bin/env bash

set -Eeuo pipefail

# ============================================================
# HomeShoppie - Amazon Linux Production Deployment
# Next.js + PM2 + Nginx
# ============================================================

APP_NAME="homeshoppie"
APP_PORT="3000"
NODE_HEAP_MB="640"

ENV_DIR="/etc/${APP_NAME}"
ENV_FILE="${ENV_DIR}/.env.production"

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

cleanup_on_error() {
    error "Deployment failed."

    echo
    echo "Memory:"
    free -h || true

    echo
    echo "PM2 status:"
    pm2 status || true

    exit 1
}

trap cleanup_on_error ERR

# ============================================================
# 1. Verify project
# ============================================================

log "Checking project..."

if [[ ! -f "package.json" ]]; then
    error "package.json not found."
    error "Run this script from the project root."
    exit 1
fi

success "Project found: $(pwd)"

# ============================================================
# 2. Check Node
# ============================================================

log "Checking Node.js..."

if ! command -v node >/dev/null 2>&1; then
    error "Node.js is not installed."
    exit 1
fi

echo "Node: $(node -v)"

# ============================================================
# 3. Check NPM
# ============================================================

log "Checking npm..."

if ! command -v npm >/dev/null 2>&1; then
    error "npm is not installed."
    exit 1
fi

echo "NPM: $(npm -v)"

# ============================================================
# 4. Check PM2
# ============================================================

log "Checking PM2..."

if command -v pm2 >/dev/null 2>&1; then

    success "PM2 already installed."
    echo "PM2: $(pm2 -v)"

else

    warn "PM2 not found."
    log "Installing PM2 globally..."

    npm install -g pm2

    if ! command -v pm2 >/dev/null 2>&1; then
        error "PM2 installation failed."
        exit 1
    fi

    success "PM2 installed."
    echo "PM2: $(pm2 -v)"

fi

# ============================================================
# 5. Check production environment
# ============================================================

log "Checking production environment..."

if [[ ! -d "$ENV_DIR" ]]; then
    error "Environment directory does not exist:"
    error "$ENV_DIR"
    echo
    echo "Run setup-env.sh first."
    exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
    error "Production environment file not found:"
    error "$ENV_FILE"
    echo
    echo "Run setup-env.sh first."
    exit 1
fi

if [[ ! -r "$ENV_FILE" ]]; then
    error "Production environment file is not readable:"
    error "$ENV_FILE"
    exit 1
fi

ENV_PERMISSIONS=$(stat -c "%a" "$ENV_FILE")

if [[ "$ENV_PERMISSIONS" != "600" ]]; then
    error "Invalid permissions on environment file."
    error "Expected: 600"
    error "Current : $ENV_PERMISSIONS"
    exit 1
fi

success "Production environment file found."
echo "Environment: $ENV_FILE"
echo "Permissions : $ENV_PERMISSIONS"

# ============================================================
# 6. Load production environment
# ============================================================

log "Loading production environment..."

set -a
source "$ENV_FILE"
set +a

export NODE_ENV="production"
export PORT="$APP_PORT"

success "Production environment loaded."

# Do NOT print environment variables here.
# They may contain passwords, tokens, API keys, etc.

# ============================================================
# 7. Check disk
# ============================================================

log "Checking disk space..."

AVAILABLE_KB=$(df -Pk . | awk 'NR==2 {print $4}')
AVAILABLE_GB=$((AVAILABLE_KB / 1024 / 1024))

echo "Available disk: ${AVAILABLE_GB} GB"

if (( AVAILABLE_GB < 2 )); then
    error "Less than 2 GB disk space available."
    exit 1
fi

success "Disk space OK."

# ============================================================
# 8. Check memory
# ============================================================

log "Current memory:"

free -h

echo
echo "Swap:"
swapon --show || true

# ============================================================
# 9. Stop current PM2 application
# ============================================================

log "Stopping ${APP_NAME}..."

pm2 stop "$APP_NAME" || true

sleep 2

log "Memory after stopping application:"

free -h

# ============================================================
# 10. Install dependencies
# ============================================================

log "Installing dependencies..."

if [[ -f "package-lock.json" ]]; then

    log "package-lock.json found."
    log "Running npm ci..."

    npm ci

else

    warn "package-lock.json not found."
    warn "Running npm install instead."

    npm install

fi

success "Dependencies installed."

# ============================================================
# 11. TypeScript check
# ============================================================

log "Running TypeScript check..."

if [[ -f "tsconfig.json" ]]; then

    npx tsc --noEmit

    success "TypeScript check passed."

else

    warn "tsconfig.json not found."

fi

# ============================================================
# 12. ESLint
# ============================================================

if npm run | grep -qE '^  lint'; then

    log "Running ESLint..."

    npm run lint

    success "ESLint passed."

else

    warn "No lint script found. Skipping ESLint."

fi

# ============================================================
# 13. Security audit
# ============================================================

log "Checking dependency vulnerabilities..."

npm audit --audit-level=high || {

    warn "High/critical vulnerabilities detected."
    warn "Review npm audit output."
    warn "Deployment will continue."

}

# ============================================================
# 14. Clean previous Next.js build
# ============================================================

log "Cleaning previous Next.js build..."

rm -rf .next

success "Previous .next directory removed."

# ============================================================
# 15. Configure Node heap
# ============================================================

export NODE_OPTIONS="--max-old-space-size=${NODE_HEAP_MB}"

log "Node heap configured:"
echo "NODE_OPTIONS=${NODE_OPTIONS}"

node -e "
const v8 = require('v8');
const heap = v8.getHeapStatistics().heap_size_limit / 1024 / 1024;
console.log('V8 heap limit: ' + Math.round(heap) + ' MB');
"

# ============================================================
# 16. Production build
# ============================================================

log "Starting production build..."

free -h

echo

npm run build

success "Production build completed."

# ============================================================
# 17. Verify Next.js build
# ============================================================

log "Verifying Next.js build..."

if [[ ! -d ".next" ]]; then

    error ".next directory does not exist."
    exit 1

fi

if [[ ! -f ".next/BUILD_ID" ]]; then

    warn ".next/BUILD_ID not found."

fi

success "Next.js build verified."

# ============================================================
# 18. Verify production start script
# ============================================================

log "Checking production start script..."

START_SCRIPT=$(node -e "
const p = require('./package.json');

if (!p.scripts || !p.scripts.start) {
    process.exit(1);
}

process.stdout.write(p.scripts.start);
")

if [[ "$START_SCRIPT" != *"next start"* ]]; then

    error "Invalid production start script:"
    error "$START_SCRIPT"

    echo
    echo "Expected something like:"
    echo '"start": "next start -p 3000"'
    echo

    exit 1

fi

success "Production start script found:"
echo "$START_SCRIPT"

# ============================================================
# 19. Start / Restart PM2
# ============================================================

log "Configuring PM2 application..."

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then

    log "PM2 application already exists."
    log "Restarting ${APP_NAME}..."

    pm2 restart "$APP_NAME" --update-env

else

    log "PM2 application does not exist."
    log "Creating ${APP_NAME}..."

    pm2 start npm \
        --name "$APP_NAME" \
        -- start

fi

success "PM2 application started."

# ============================================================
# 20. Save PM2 process list
# ============================================================

log "Saving PM2 process list..."

pm2 save

success "PM2 process list saved."

# ============================================================
# 21. PM2 startup configuration
# ============================================================

log "Checking PM2 startup configuration..."

PM2_SERVICE="pm2-$(whoami)"

if systemctl is-enabled "$PM2_SERVICE" >/dev/null 2>&1; then

    success "PM2 startup already configured."

else

    warn "PM2 startup service is not configured."

    echo
    echo "Run this command once:"
    echo

    pm2 startup systemd -u "$(whoami)" --hp "$HOME"

    echo
    warn "Copy and run the command printed above."
    warn "Then run:"
    echo "pm2 save"

fi

# ============================================================
# 22. Final PM2 status
# ============================================================

echo
log "Final PM2 status:"

pm2 status

# ============================================================
# 23. Final memory
# ============================================================

echo
log "Final memory:"

free -h

# ============================================================
# 24. Application health check
# ============================================================

log "Checking application locally..."

sleep 3

if command -v curl >/dev/null 2>&1; then

    if curl -fsS \
        --max-time 10 \
        "http://127.0.0.1:${APP_PORT}" \
        >/dev/null; then

        success "Application is responding on port ${APP_PORT}."

    else

        warn "Application did not respond on port ${APP_PORT}."
        warn "Check:"
        echo "pm2 logs ${APP_NAME}"

    fi

else

    warn "curl is not installed. Skipping health check."

fi

# ============================================================
# 25. DONE
# ============================================================

echo
echo "============================================================"
success "DEPLOYMENT COMPLETED"
echo "============================================================"
echo
echo "Application : ${APP_NAME}"
echo "Port        : ${APP_PORT}"
echo "Environment : ${ENV_FILE}"
echo "Node        : $(node -v)"
echo "NPM         : $(npm -v)"
echo "PM2         : $(pm2 -v)"
echo "Heap        : ${NODE_HEAP_MB} MB"
echo
echo "Useful commands:"
echo "  pm2 status"
echo "  pm2 logs ${APP_NAME}"
echo "  pm2 restart ${APP_NAME}"
echo "  pm2 save"
echo
echo "Local health:"
echo "  curl http://127.0.0.1:${APP_PORT}"
echo