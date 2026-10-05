#!/usr/bin/env bash

set -Eeuo pipefail

# ============================================================
# HomeShoppie - Amazon Linux Production Deployment
# Next.js + PM2 + Nginx
# ============================================================

APP_NAME="homeshoppie"
APP_PORT="3000"
NODE_HEAP_MB="640"

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

if ! command -v npm >/dev/null 2>&1; then
    error "npm is not installed."
    exit 1
fi

echo "NPM: $(npm -v)"

# ============================================================
# 4. Install PM2 if required
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
# 5. Check disk
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
# 6. Check memory
# ============================================================

log "Current memory:"

free -h

echo
echo "Swap:"
swapon --show || true

# ============================================================
# 7. Stop PM2
# ============================================================

log "Stopping PM2 applications..."

pm2 stop all || true

sleep 2

log "Memory after stopping PM2:"
free -h

# ============================================================
# 8. Install dependencies
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
# 9. TypeScript check
# ============================================================

log "Running TypeScript check..."

if [[ -f "tsconfig.json" ]]; then
    npx tsc --noEmit
    success "TypeScript check passed."
else
    warn "tsconfig.json not found."
fi

# ============================================================
# 10. ESLint
# ============================================================

if npm run | grep -qE '^  lint'; then

    log "Running ESLint..."

    npm run lint

    success "ESLint passed."

else

    warn "No lint script found. Skipping ESLint."

fi

# ============================================================
# 11. Security audit
# ============================================================

log "Checking dependency vulnerabilities..."

npm audit --audit-level=high || {
    warn "High/critical vulnerabilities detected."
    warn "Review npm audit output."
    warn "Deployment will continue."
}

# ============================================================
# 12. Clean previous Next.js build
# ============================================================

log "Cleaning previous Next.js build..."

rm -rf .next

success "Previous .next directory removed."

# ============================================================
# 13. Configure Node heap
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
# 14. Production build
# ============================================================

log "Starting production build..."

free -h

echo

npm run build

success "Production build completed."

# ============================================================
# 15. Verify build
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
# 16. Check package start script
# ============================================================

log "Checking production start script..."

if ! node -e "
const p=require('./package.json');
if (!p.scripts || !p.scripts.start) process.exit(1);
"; then

    error "package.json does not contain a 'start' script."

    echo
    echo "You need:"
    echo '"start": "next start"'
    echo

    exit 1
fi

success "Production start script found."

# ============================================================
# 17. Start / Restart PM2 application
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
        -- start -p "$APP_PORT"

fi

success "PM2 application started."

# ============================================================
# 18. Save PM2 process list
# ============================================================

log "Saving PM2 process list..."

pm2 save

success "PM2 process list saved."

# ============================================================
# 19. PM2 startup configuration
# ============================================================

log "Checking PM2 startup configuration..."

if systemctl is-enabled pm2-ec2-user >/dev/null 2>&1; then

    success "PM2 startup already configured."

else

    warn "PM2 startup service is not configured."

    echo
    echo "Run the following command once:"
    echo

    pm2 startup systemd -u "$(whoami)" --hp "$HOME"

    echo
    warn "Copy and run the command printed above."
    warn "Then run: pm2 save"

fi

# ============================================================
# 20. Final status
# ============================================================

echo
log "Final PM2 status:"

pm2 status

echo
log "Final memory:"

free -h

# ============================================================
# 21. Optional local health check
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
        warn "Check: pm2 logs ${APP_NAME}"

    fi

fi

# ============================================================
# DONE
# ============================================================

echo
echo "============================================================"
success "DEPLOYMENT COMPLETED"
echo "============================================================"
echo
echo "Application : ${APP_NAME}"
echo "Port        : ${APP_PORT}"
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
echo "To check local health:"
echo "  curl http://127.0.0.1:${APP_PORT}"
echo