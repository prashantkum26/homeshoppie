#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

# ============================================================
# HomeShoppie - Production Deployment
# Amazon Linux 2023
# Next.js + Node.js + npm + PM2 + Nginx
# ============================================================

APP_NAME="homeshoppie"
APP_USER="ec2-user"

PROJECT_DIR="/home/ec2-user/homeshoppie"

ENV_DIR="/etc/homeshoppie"
ENV_FILE="/etc/homeshoppie/.env.production"

APP_PORT="3000"
NODE_HEAP_MB="640"

MIN_DISK_GB="2"

# Number of health-check attempts.
HEALTH_ATTEMPTS="15"
HEALTH_WAIT_SECONDS="2"

# ============================================================
# Colors
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================
# Logging
# ============================================================

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

info() {
    echo -e "${CYAN}ℹ $1${NC}"
}

die() {
    error "$1"
    exit 1
}

# ============================================================
# Deployment state
# ============================================================

DEPLOY_STARTED="false"
PM2_EXISTED_BEFORE="false"
OLD_PM2_STATUS=""
OLD_PM2_ID=""

# ============================================================
# Error handler
# ============================================================

on_error() {
    local exit_code=$?

    echo
    echo "============================================================"
    error "HOMESHOPPIE DEPLOYMENT FAILED"
    echo "============================================================"
    echo "Exit code: ${exit_code}"
    echo

    if [[ "$DEPLOY_STARTED" == "true" ]]; then
        warn "Deployment was interrupted."
    fi

    echo "Current user:"
    whoami || true

    echo
    echo "Memory:"
    free -h || true

    echo
    echo "PM2 status:"
    pm2 status || true

    echo
    echo "Recent ${APP_NAME} logs:"
    pm2 logs "$APP_NAME" --lines 40 --nostream 2>/dev/null || true

    echo
    warn "The deployment script never intentionally stopped all PM2 applications."

    exit "$exit_code"
}

trap on_error ERR

# ============================================================
# 1. Ensure correct user
# ============================================================

log "Checking deployment user..."

CURRENT_USER="$(id -un)"

echo "Current user: ${CURRENT_USER}"

if [[ "$CURRENT_USER" == "root" ]]; then

    warn "Deployment was started as root."
    log "Switching to ${APP_USER}..."

    if ! id "$APP_USER" >/dev/null 2>&1; then
        die "User '${APP_USER}' does not exist."
    fi

    exec sudo -u "$APP_USER" \
        -H \
        env \
        HOME="/home/${APP_USER}" \
        PATH="/usr/local/bin:/usr/bin:/bin:/home/${APP_USER}/.local/bin" \
        bash "$0" "$@"

fi

if [[ "$CURRENT_USER" != "$APP_USER" ]]; then
    die "This deployment must run as ${APP_USER}."
fi

success "Running as ${APP_USER}."

# ============================================================
# 2. Check operating system
# ============================================================

log "Checking operating system..."

if [[ -f /etc/os-release ]]; then

    # shellcheck disable=SC1091
    source /etc/os-release

    echo "OS: ${PRETTY_NAME:-unknown}"

    if [[ "${ID:-}" != "amzn" ]]; then
        warn "This script is optimized for Amazon Linux."
    fi

else

    warn "/etc/os-release not found."

fi

# ============================================================
# 3. Check project directory
# ============================================================

log "Checking project directory..."

if [[ ! -d "$PROJECT_DIR" ]]; then
    die "Project directory does not exist: ${PROJECT_DIR}"
fi

cd "$PROJECT_DIR"

success "Project directory:"
echo "  ${PROJECT_DIR}"

# ============================================================
# 4. Verify project ownership
# ============================================================

log "Checking project ownership..."

PROJECT_OWNER="$(stat -c "%U:%G" "$PROJECT_DIR")"

echo "Project owner: ${PROJECT_OWNER}"

if [[ "$PROJECT_OWNER" != "${APP_USER}:${APP_USER}" ]]; then

    warn "Project directory is not owned by ${APP_USER}:${APP_USER}."

    info "Attempting to repair project ownership."

    if command -v sudo >/dev/null 2>&1; then

        sudo chown -R \
            "${APP_USER}:${APP_USER}" \
            "$PROJECT_DIR"

    else

        die "sudo is required to repair project ownership."

    fi

    PROJECT_OWNER="$(stat -c "%U:%G" "$PROJECT_DIR")"

    if [[ "$PROJECT_OWNER" != "${APP_USER}:${APP_USER}" ]]; then
        die "Unable to repair project ownership."
    fi

    success "Project ownership repaired."

else

    success "Project ownership is correct."

fi

# ============================================================
# 5. Verify package.json
# ============================================================

log "Checking package.json..."

if [[ ! -f package.json ]]; then
    die "package.json was not found."
fi

success "package.json found."

# ============================================================
# 6. Check Node.js
# ============================================================

log "Checking Node.js..."

if ! command -v node >/dev/null 2>&1; then
    die "Node.js is not installed."
fi

NODE_VERSION="$(node -v)"
NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"

echo "Node: ${NODE_VERSION}"

if (( NODE_MAJOR < 20 )); then
    die "Node.js 20 or newer is required."
fi

success "Node.js version is supported."

# ============================================================
# 7. Check npm
# ============================================================

log "Checking npm..."

if ! command -v npm >/dev/null 2>&1; then
    die "npm is not installed."
fi

NPM_VERSION="$(npm -v)"

echo "NPM: ${NPM_VERSION}"

success "npm available."

# ============================================================
# 8. Check PM2
# ============================================================

log "Checking PM2..."

if command -v pm2 >/dev/null 2>&1; then

    PM2_VERSION="$(pm2 -v)"

    success "PM2 already installed."
    echo "PM2: ${PM2_VERSION}"

else

    warn "PM2 is not installed."

    log "Installing PM2 globally..."

    npm install -g pm2

    if ! command -v pm2 >/dev/null 2>&1; then
        die "PM2 installation failed."
    fi

    PM2_VERSION="$(pm2 -v)"

    success "PM2 installed."
    echo "PM2: ${PM2_VERSION}"

fi

# ============================================================
# 9. Check environment directory
# ============================================================

log "Checking production environment..."

if [[ ! -d "$ENV_DIR" ]]; then
    die "Environment directory does not exist: ${ENV_DIR}"
fi

if [[ ! -f "$ENV_FILE" ]]; then
    die "Production environment file does not exist:"
    echo "  ${ENV_FILE}"
fi

ENV_PERMISSIONS="$(stat -c "%a" "$ENV_FILE")"
ENV_OWNER="$(stat -c "%U:%G" "$ENV_FILE")"

echo "Environment : ${ENV_FILE}"
echo "Permissions : ${ENV_PERMISSIONS}"
echo "Owner       : ${ENV_OWNER}"

if [[ "$ENV_PERMISSIONS" != "600" ]]; then

    warn "Environment permissions are ${ENV_PERMISSIONS}."

    if command -v sudo >/dev/null 2>&1; then
        sudo chmod 600 "$ENV_FILE"
    else
        die "Unable to secure environment file."
    fi

    ENV_PERMISSIONS="$(stat -c "%a" "$ENV_FILE")"

fi

if [[ "$ENV_OWNER" != "${APP_USER}:${APP_USER}" ]]; then

    warn "Environment file owner is ${ENV_OWNER}."

    if command -v sudo >/dev/null 2>&1; then
        sudo chown "${APP_USER}:${APP_USER}" "$ENV_FILE"
    else
        die "Unable to repair environment file ownership."
    fi

    ENV_OWNER="$(stat -c "%U:%G" "$ENV_FILE")"

fi

if [[ "$ENV_PERMISSIONS" != "600" ]]; then
    die "Environment file permissions must be 600."
fi

if [[ "$ENV_OWNER" != "${APP_USER}:${APP_USER}" ]]; then
    die "Environment file ownership must be ${APP_USER}:${APP_USER}."
fi

success "Production environment is secure."

# ============================================================
# 10. Load environment safely
#
# NEVER use:
#
#   source "$ENV_FILE"
#
# ============================================================

log "Loading production environment..."

ENV_EXPORTS="$(
    ENV_FILE="$ENV_FILE" node <<'NODE'
const fs = require("fs");

const file = process.env.ENV_FILE;

if (!file) {
    console.error("ENV_FILE is not defined.");
    process.exit(1);
}

const content = fs.readFileSync(file, "utf8");

function shellQuote(value) {
    return "'" + value.replace(/'/g, "'\\''") + "'";
}

const lines = content.split(/\r?\n/);

for (let i = 0; i < lines.length; i++) {

    const lineNumber = i + 1;

    let line = lines[i].trim();

    if (!line) {
        continue;
    }

    if (line.startsWith("#")) {
        continue;
    }

    if (line.startsWith("export ")) {
        line = line.slice(7).trim();
    }

    const match = line.match(
        /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/
    );

    if (!match) {
        console.error(
            `Invalid environment line ${lineNumber}: ${lines[i]}`
        );
        process.exit(1);
    }

    const key = match[1];

    let value = match[2];

    if (
        value.length >= 2 &&
        (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        )
    ) {
        value = value.slice(1, -1);
    }

    process.stdout.write(
        `export ${key}=${shellQuote(value)}\n`
    );
}
NODE
)"

eval "$ENV_EXPORTS"

# Force deployment runtime variables.
export NODE_ENV="production"
export PORT="$APP_PORT"
export NODE_OPTIONS="--max-old-space-size=${NODE_HEAP_MB}"

success "Production environment loaded."

# ============================================================
# 11. Validate environment variables
# ============================================================

log "Checking required environment variables..."

REQUIRED_ENV_VARS=(
    "DATABASE_URL"
    "NEXTAUTH_SECRET"
)

MISSING_ENV_VARS=()

for VAR in "${REQUIRED_ENV_VARS[@]}"; do

    if [[ -z "${!VAR:-}" ]]; then
        MISSING_ENV_VARS+=("$VAR")
    fi

done

if (( ${#MISSING_ENV_VARS[@]} > 0 )); then

    error "Missing required environment variables:"

    for VAR in "${MISSING_ENV_VARS[@]}"; do
        echo "  - ${VAR}"
    done

    die "Environment validation failed."

fi

success "Required environment variables are present."

# ============================================================
# 12. Check disk space
# ============================================================

log "Checking disk space..."

AVAILABLE_KB="$(
    df -Pk "$PROJECT_DIR" |
    awk 'NR==2 {print $4}'
)"

AVAILABLE_GB=$((AVAILABLE_KB / 1024 / 1024))

echo "Available disk: ${AVAILABLE_GB} GB"

if (( AVAILABLE_GB < MIN_DISK_GB )); then
    die "Less than ${MIN_DISK_GB} GB disk space available."
fi

success "Disk space OK."

# ============================================================
# 13. Check memory
# ============================================================

log "Checking memory..."

free -h

echo
echo "Swap:"
swapon --show || true

# ============================================================
# 14. Check package scripts
# ============================================================

log "Checking package scripts..."

BUILD_SCRIPT="$(
    node -p "require('./package.json').scripts?.build || ''"
)"

START_SCRIPT="$(
    node -p "require('./package.json').scripts?.start || ''"
)"

TYPE_CHECK_SCRIPT="$(
    node -p "require('./package.json').scripts?.['type-check'] || ''"
)"

LINT_SCRIPT="$(
    node -p "require('./package.json').scripts?.lint || ''"
)"

echo "Build      : ${BUILD_SCRIPT:-<missing>}"
echo "Start      : ${START_SCRIPT:-<missing>}"
echo "Type-check : ${TYPE_CHECK_SCRIPT:-<missing>}"
echo "Lint       : ${LINT_SCRIPT:-<missing>}"

if [[ -z "$BUILD_SCRIPT" ]]; then
    die "package.json does not contain a build script."
fi

if [[ "$BUILD_SCRIPT" != "next build" ]]; then
    warn "Build script is '${BUILD_SCRIPT}', expected 'next build'."
fi

if [[ -z "$START_SCRIPT" ]]; then
    die "package.json does not contain a start script."
fi

if ! [[ "$START_SCRIPT" =~ ^next[[:space:]]+start([[:space:]]+.*)?$ ]]; then

    error "Invalid Next.js start script:"
    echo "  ${START_SCRIPT}"

    echo
    echo 'Expected:'
    echo '  "start": "next start"'

    die "Invalid production start script."

fi

success "Package scripts validated."

# ============================================================
# 15. Check package lock
# ============================================================

if [[ -f package-lock.json ]]; then

    success "package-lock.json found."

else

    warn "package-lock.json is missing."
    warn "npm install will be used."

fi

# ============================================================
# 16. Check git state
# ============================================================

if command -v git >/dev/null 2>&1 && [[ -d ".git" ]]; then

    log "Checking Git repository..."

    CURRENT_BRANCH="$(
        git branch --show-current 2>/dev/null || true
    )"

    echo "Git branch: ${CURRENT_BRANCH:-unknown}"

    if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then

        warn "Working tree contains local changes."

        git status --short

        warn "Deployment will continue."
        warn "Local changes will NOT be overwritten."

    else

        success "Git working tree is clean."

    fi

fi

# ============================================================
# 17. Detect root-owned files before npm ci
# ============================================================

log "Checking file permissions..."

ROOT_OWNED_COUNT="$(
    find "$PROJECT_DIR" \
        -xdev \
        -user root \
        -not -path "${PROJECT_DIR}/.git/*" \
        -not -path "${PROJECT_DIR}/.next/*" \
        2>/dev/null |
    wc -l
)"

if (( ROOT_OWNED_COUNT > 0 )); then

    warn "${ROOT_OWNED_COUNT} root-owned project files detected."

    info "Repairing project ownership..."

    if command -v sudo >/dev/null 2>&1; then

        sudo chown -R \
            "${APP_USER}:${APP_USER}" \
            "$PROJECT_DIR"

    else

        die "sudo is required to repair project ownership."

    fi

    success "Project ownership repaired."

else

    success "Project file ownership is OK."

fi

# ============================================================
# 18. Install dependencies
# ============================================================

log "Installing dependencies..."

if [[ -f package-lock.json ]]; then

    log "Running npm ci --include=dev..."

    npm ci --include=dev

else

    log "Running npm install --include=dev..."

    npm install --include=dev

fi

success "Dependencies installed."

# ============================================================
# 19. Verify node_modules
# ============================================================

log "Checking node_modules..."

if [[ ! -d node_modules ]]; then
    die "node_modules was not created."
fi

success "node_modules available."

# ============================================================
# 20. Verify local TypeScript
# ============================================================

if [[ -f tsconfig.json ]]; then

    log "Checking TypeScript compiler..."

    if [[ ! -x "./node_modules/.bin/tsc" ]]; then

        error "Local TypeScript compiler not found."

        echo
        echo "Run locally:"
        echo
        echo "  npm install -D typescript"
        echo
        echo "Then commit:"
        echo
        echo "  package.json"
        echo "  package-lock.json"

        die "TypeScript compiler missing."

    fi

    TYPESCRIPT_VERSION="$(
        ./node_modules/.bin/tsc --version
    )"

    echo "TypeScript: ${TYPESCRIPT_VERSION}"

    success "TypeScript compiler found."

fi

# ============================================================
# 21. TypeScript check
# ============================================================

if [[ -f tsconfig.json ]]; then

    log "Running TypeScript check..."

    ./node_modules/.bin/tsc --noEmit

    success "TypeScript check passed."

else

    warn "tsconfig.json not found."
    warn "Skipping TypeScript."

fi

# ============================================================
# 22. ESLint
# ============================================================

if [[ -n "$LINT_SCRIPT" ]]; then

    log "Running ESLint..."

    npm run lint

    success "ESLint passed."

else

    warn "No lint script found."
    warn "Skipping ESLint."

fi

# ============================================================
# 23. npm audit
# ============================================================

log "Checking dependency vulnerabilities..."

if npm audit --audit-level=high; then

    success "npm audit passed."

else

    warn "High/critical vulnerabilities were reported."
    warn "Deployment will continue."
    warn "Review npm audit output."

fi

# ============================================================
# 24. Configure Node heap
# ============================================================

export NODE_OPTIONS="--max-old-space-size=${NODE_HEAP_MB}"

log "Node heap configuration:"
echo "  NODE_OPTIONS=${NODE_OPTIONS}"

node <<'NODE'
const v8 = require("v8");

const heap =
    v8.getHeapStatistics().heap_size_limit /
    1024 /
    1024;

console.log(
    "V8 heap limit: " +
    Math.round(heap) +
    " MB"
);
NODE

# ============================================================
# 25. Clean previous build
# ============================================================

log "Removing previous .next build..."

rm -rf .next

success ".next cleaned."

# ============================================================
# 26. Production build
# ============================================================

log "Starting Next.js production build..."

echo
free -h
echo

npm run build

success "Next.js production build completed."

# ============================================================
# 27. Verify build output
# ============================================================

log "Verifying production build..."

if [[ ! -d .next ]]; then
    die ".next directory does not exist."
fi

if [[ -f .next/BUILD_ID ]]; then

    BUILD_ID="$(cat .next/BUILD_ID)"

    success "Next.js build verified."
    echo "BUILD_ID: ${BUILD_ID}"

else

    warn ".next/BUILD_ID was not found."
    warn "Continuing because .next exists."

fi

# ============================================================
# 28. DO NOT TOUCH PM2 BEFORE THIS POINT
# ============================================================

echo
echo "============================================================"
success "PRE-DEPLOYMENT VALIDATION PASSED"
echo "============================================================"
echo

# ============================================================
# 29. Capture current PM2 state
# ============================================================

log "Checking existing PM2 application..."

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then

    PM2_EXISTED_BEFORE="true"

    OLD_PM2_STATUS="$(
        pm2 jlist |
        APP_NAME="$APP_NAME" node <<'NODE'
let input = "";

process.stdin.on("data", chunk => {
    input += chunk;
});

process.stdin.on("end", () => {

    try {

        const apps = JSON.parse(input);

        const app = apps.find(
            item => item.name === process.env.APP_NAME
        );

        process.stdout.write(
            app?.pm2_env?.status || "unknown"
        );

    } catch {

        process.stdout.write("unknown");

    }

});
NODE
    )"

    echo "Existing PM2 status: ${OLD_PM2_STATUS}"

else

    PM2_EXISTED_BEFORE="false"

    echo "No existing PM2 application."

fi

# ============================================================
# 30. Start/restart PM2
# ============================================================

log "Deploying application to PM2..."

export NODE_ENV="production"
export PORT="$APP_PORT"
export NODE_OPTIONS="--max-old-space-size=${NODE_HEAP_MB}"

if [[ "$PM2_EXISTED_BEFORE" == "true" ]]; then

    log "Restarting ${APP_NAME}..."

    pm2 restart "$APP_NAME" --update-env

else

    log "Starting ${APP_NAME}..."

    pm2 start npm \
        --name "$APP_NAME" \
        --cwd "$PROJECT_DIR" \
        -- start

fi

DEPLOY_STARTED="true"

success "PM2 deployment command completed."

# ============================================================
# 31. Wait for startup
# ============================================================

log "Waiting for application..."

sleep 3

# ============================================================
# 32. Verify PM2 online
# ============================================================

log "Checking PM2 status..."

PM2_STATUS="$(
    APP_NAME="$APP_NAME" pm2 jlist |
    node <<'NODE'
let input = "";

process.stdin.on("data", chunk => {
    input += chunk;
});

process.stdin.on("end", () => {

    try {

        const apps = JSON.parse(input);

        const app = apps.find(
            item => item.name === process.env.APP_NAME
        );

        if (!app) {
            process.stdout.write("missing");
            process.exit(1);
        }

        process.stdout.write(
            app.pm2_env?.status || "unknown"
        );

    } catch {

        process.stdout.write("unknown");
        process.exit(1);

    }

});
NODE
)"

echo "PM2 status: ${PM2_STATUS}"

if [[ "$PM2_STATUS" != "online" ]]; then

    error "PM2 application is not online."

    echo
    pm2 status || true

    echo
    pm2 logs "$APP_NAME" --lines 60 --nostream || true

    # --------------------------------------------------------
    # Rollback attempt
    # --------------------------------------------------------

    if [[ "$PM2_EXISTED_BEFORE" == "true" ]]; then

        warn "Attempting to restore previous PM2 process state."

        pm2 restart "$APP_NAME" --update-env || true

    fi

    die "PM2 application failed to start."

fi

success "PM2 application is online."

# ============================================================
# 33. Health check
# ============================================================

log "Checking local HTTP health..."

if ! command -v curl >/dev/null 2>&1; then

    warn "curl is not installed."
    warn "Skipping HTTP health check."

else

    HEALTH_OK="false"

    for ATTEMPT in $(seq 1 "$HEALTH_ATTEMPTS"); do

        if curl \
            --silent \
            --show-error \
            --fail \
            --max-time 10 \
            "http://127.0.0.1:${APP_PORT}/" \
            >/dev/null; then

            HEALTH_OK="true"
            break

        fi

        echo "Health check ${ATTEMPT}/${HEALTH_ATTEMPTS} failed."
        sleep "$HEALTH_WAIT_SECONDS"

    done

    if [[ "$HEALTH_OK" != "true" ]]; then

        error "Application did not respond successfully."

        echo
        echo "PM2 status:"
        pm2 status || true

        echo
        echo "Application logs:"
        pm2 logs "$APP_NAME" --lines 80 --nostream || true

        die "HTTP health check failed."

    fi

    success "Application is responding on port ${APP_PORT}."

fi

# ============================================================
# 34. Save PM2 only after successful health check
# ============================================================

log "Saving PM2 process list..."

pm2 save

success "PM2 process list saved."

# ============================================================
# 35. Check PM2 startup service
# ============================================================

log "Checking PM2 startup service..."

PM2_SERVICE="pm2-${APP_USER}"

if systemctl is-enabled "$PM2_SERVICE" >/dev/null 2>&1; then

    success "PM2 startup service is enabled:"
    echo "  ${PM2_SERVICE}"

else

    warn "PM2 startup service is not enabled."

    echo
    echo "Run once:"
    echo

    pm2 startup systemd \
        -u "$APP_USER" \
        --hp "/home/${APP_USER}"

    echo

    warn "Execute the command printed above."
    warn "Then run:"
    echo "  pm2 save"

fi

# ============================================================
# 36. Final status
# ============================================================

echo
log "Final PM2 status:"

pm2 status

echo
log "Final memory:"

free -h

echo
log "Listening on port ${APP_PORT}:"

if command -v ss >/dev/null 2>&1; then
    ss -lntp 2>/dev/null |
        grep ":${APP_PORT}" ||
        warn "No listener found in ss output."

fi

# ============================================================
# 37. Final success
# ============================================================

echo
echo "============================================================"
echo -e "${GREEN}       HOMESHOPPIE DEPLOYMENT SUCCESSFUL${NC}"
echo "============================================================"
echo

echo "Application : ${APP_NAME}"
echo "User        : ${APP_USER}"
echo "Directory   : ${PROJECT_DIR}"
echo "Environment : ${ENV_FILE}"
echo "Port        : ${APP_PORT}"
echo "Node        : $(node -v)"
echo "NPM         : $(npm -v)"
echo "PM2         : $(pm2 -v)"
echo "Node Heap   : ${NODE_HEAP_MB} MB"

echo
echo "Health:"
echo "  http://127.0.0.1:${APP_PORT}"

echo
echo "Useful commands:"
echo "  pm2 status"
echo "  pm2 logs ${APP_NAME}"
echo "  pm2 restart ${APP_NAME}"
echo "  pm2 save"
echo "  curl http://127.0.0.1:${APP_PORT}"

echo
echo "Environment permissions:"
echo "  sudo stat -c '%a %U:%G %n' ${ENV_FILE}"

echo
echo "============================================================"
success "Production deployment completed."
echo "============================================================"