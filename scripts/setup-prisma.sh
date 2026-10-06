#!/usr/bin/env bash
set -Eeuo pipefail

# =============================================================================
# HomeShoppie - Production Prisma Setup
# Amazon Linux 2023 / Node.js / MongoDB Replica Set
#
# Performs:
#   1. System / project checks
#   2. Environment loading and validation
#   3. npm dependency installation
#   4. Prisma version / schema checks
#   5. Prisma validate
#   6. Prisma generate
#   7. MongoDB connectivity + replica-set PRIMARY verification
#   8. Prisma db push
#   9. Prisma db seed
#  10. Application directory checks
#  11. Optional PM2 restart
#
# Production assumptions:
#   Project       : /home/ec2-user/homeshoppie
#   App user      : ec2-user
#   Environment   : /etc/homeshoppie/.env.production
#   MongoDB       : 127.0.0.1:27017
#   Replica set   : rs0
#   Database      : homeshoppie
#
# Usage:
#   sudo ./setup-prisma.sh
#
# Optional:
#   sudo ./setup-prisma.sh --skip-push
#   sudo ./setup-prisma.sh --skip-seed
#   sudo ./setup-prisma.sh --skip-pm2
#   sudo ./setup-prisma.sh --yes
#
# IMPORTANT:
#   This script intentionally does NOT run "prisma db push --accept-data-loss".
#   Any schema change that Prisma considers potentially destructive will stop
#   the script instead of silently deleting data.
# =============================================================================

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
APP_USER="ec2-user"
APP_GROUP="ec2-user"

APP_DIR="/home/ec2-user/homeshoppie"
ENV_FILE="/etc/homeshoppie/.env.production"

APP_NAME="homeshoppie"
MONGO_HOST="127.0.0.1"
MONGO_PORT="27017"
REPLICA_SET_NAME="rs0"
MONGO_DATABASE="homeshoppie"

NODE_MIN_MAJOR=20

SKIP_PUSH="false"
SKIP_SEED="false"
SKIP_PM2="false"
ASSUME_YES="false"

# -----------------------------------------------------------------------------
# Output
# -----------------------------------------------------------------------------
if [[ -t 1 ]]; then
    RED="\033[0;31m"
    GREEN="\033[0;32m"
    YELLOW="\033[1;33m"
    BLUE="\033[0;34m"
    CYAN="\033[0;36m"
    MAGENTA="\033[0;35m"
    BOLD="\033[1m"
    NC="\033[0m"
else
    RED=""
    GREEN=""
    YELLOW=""
    BLUE=""
    CYAN=""
    MAGENTA=""
    BOLD=""
    NC=""
fi

log()     { echo -e "${CYAN}[INFO]${NC} $*"; }
ok()      { echo -e "${GREEN}[OK]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
step()    { echo -e "\n${CYAN}============================================================${NC}\n ${BOLD}$*${NC}\n${CYAN}============================================================${NC}"; }
die()     { error "$*"; exit 1; }

# -----------------------------------------------------------------------------
# Error trap
# -----------------------------------------------------------------------------
on_error() {
    local exit_code=$?
    local line_no="${BASH_LINENO[0]:-unknown}"
    local command="${BASH_COMMAND:-unknown}"

    error "Script failed."
    error "Exit code : ${exit_code}"
    error "Line      : ${line_no}"
    error "Command   : ${command}"

    echo
    echo "Troubleshooting:"
    echo "  Project : ${APP_DIR}"
    echo "  Env     : ${ENV_FILE}"
    echo "  Prisma  : npx prisma --version"
    echo "  MongoDB : mongosh --host ${MONGO_HOST} --port ${MONGO_PORT}"
    echo

    exit "$exit_code"
}

trap on_error ERR

# -----------------------------------------------------------------------------
# Arguments
# -----------------------------------------------------------------------------
usage() {
    cat <<EOF
Usage: sudo ./setup-prisma.sh [options]

Options:
  --skip-push    Skip Prisma db push
  --skip-seed    Skip Prisma db seed
  --skip-pm2     Do not restart PM2
  --yes          Automatically confirm the database push
  -h, --help     Show this help

Examples:
  sudo ./setup-prisma.sh
  sudo ./setup-prisma.sh --yes
  sudo ./setup-prisma.sh --skip-push --skip-seed
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-push)
            SKIP_PUSH="true"
            ;;
        --skip-seed)
            SKIP_SEED="true"
            ;;
        --skip-pm2)
            SKIP_PM2="true"
            ;;
        --yes)
            ASSUME_YES="true"
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            die "Unknown option: $1"
            ;;
    esac
    shift
done

# -----------------------------------------------------------------------------
# Root / OS checks
# -----------------------------------------------------------------------------
step "Checking system requirements"

[[ $EUID -eq 0 ]] || \
    die "Run this script with sudo: sudo ./setup-prisma.sh"

[[ -f /etc/os-release ]] || die "/etc/os-release not found."
source /etc/os-release

if [[ "${ID:-}" != "amzn" ]]; then
    warn "This script was designed for Amazon Linux. Detected: ${PRETTY_NAME:-unknown}"
fi

command -v node >/dev/null 2>&1 || die "Node.js is not installed."
command -v npm >/dev/null 2>&1 || die "npm is not installed."

NODE_VERSION="$(node -p 'process.versions.node')"
NODE_MAJOR="$(node -p 'parseInt(process.versions.node.split(".")[0], 10)')"
NPM_VERSION="$(npm --version)"

ok "Node.js: v${NODE_VERSION}"
ok "npm: ${NPM_VERSION}"

if (( NODE_MAJOR < NODE_MIN_MAJOR )); then
    die "Node.js ${NODE_MIN_MAJOR}+ is required. Current: v${NODE_VERSION}"
fi

# -----------------------------------------------------------------------------
# Project checks
# -----------------------------------------------------------------------------
step "Checking HomeShoppie project"

[[ -d "$APP_DIR" ]] || die "Project directory not found: $APP_DIR"
[[ -f "$APP_DIR/package.json" ]] || die "package.json not found."
[[ -f "$APP_DIR/prisma/schema.prisma" ]] || die "prisma/schema.prisma not found."

if [[ ! -d "$APP_DIR/node_modules" ]]; then
    warn "node_modules does not exist. Dependencies will be installed."
fi

if [[ ! -f "$APP_DIR/prisma/seed.ts" && ! -f "$APP_DIR/prisma/seed.js" ]]; then
    warn "No prisma/seed.ts or prisma/seed.js found."
fi

PROJECT_OWNER="$(stat -c '%U:%G' "$APP_DIR")"
ok "Project: $APP_DIR"
ok "Project owner: $PROJECT_OWNER"

# -----------------------------------------------------------------------------
# Environment checks
# -----------------------------------------------------------------------------
step "Checking production environment"

[[ -f "$ENV_FILE" ]] || \
    die "Production environment file not found: $ENV_FILE"

ENV_OWNER="$(stat -c '%U:%G' "$ENV_FILE")"
ENV_MODE="$(stat -c '%a' "$ENV_FILE")"

[[ "$ENV_MODE" == "600" ]] || {
    warn "$ENV_FILE has mode $ENV_MODE. Correcting to 600."
    chmod 600 "$ENV_FILE"
}

if [[ "$ENV_OWNER" != "${APP_USER}:${APP_GROUP}" ]]; then
    warn "$ENV_FILE owner is $ENV_OWNER. Correcting to ${APP_USER}:${APP_GROUP}."
    chown "${APP_USER}:${APP_GROUP}" "$ENV_FILE"
fi

ok "Environment file: $ENV_FILE"
ok "Environment permissions: $(stat -c '%U:%G %a' "$ENV_FILE")"

# Load environment exactly as the application user would.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

[[ -n "${DATABASE_URL:-}" ]] || \
    die "DATABASE_URL is missing from $ENV_FILE"

# -----------------------------------------------------------------------------
# Validate DATABASE_URL without printing credentials
# -----------------------------------------------------------------------------
DATABASE_INFO="$(
    DATABASE_URL="$DATABASE_URL" \
    EXPECTED_DB="$MONGO_DATABASE" \
    EXPECTED_RS="$REPLICA_SET_NAME" \
    node <<'NODE'
try {
    const u = new URL(process.env.DATABASE_URL);

    if (u.protocol !== "mongodb:" && u.protocol !== "mongodb+srv:") {
        throw new Error(`Unsupported protocol: ${u.protocol}`);
    }

    const dbName = decodeURIComponent(u.pathname.replace(/^\/+/, ""));
    const replicaSet = u.searchParams.get("replicaSet") || "";

    console.log(JSON.stringify({
        protocol: u.protocol,
        host: u.hostname,
        port: u.port || "(default)",
        database: dbName,
        replicaSet,
        hasUsername: Boolean(u.username),
        hasPassword: Boolean(u.password)
    }));

    if (process.env.EXPECTED_DB && dbName !== process.env.EXPECTED_DB) {
        throw new Error(
            `DATABASE_URL database is '${dbName}', expected '${process.env.EXPECTED_DB}'`
        );
    }

    if (process.env.EXPECTED_RS && replicaSet !== process.env.EXPECTED_RS) {
        throw new Error(
            `DATABASE_URL replicaSet is '${replicaSet}', expected '${process.env.EXPECTED_RS}'`
        );
    }

    if (!u.username || !u.password) {
        throw new Error("DATABASE_URL does not contain username/password.");
    }
} catch (e) {
    console.error(e.message);
    process.exit(1);
}
NODE
)" || die "DATABASE_URL validation failed."

echo "$DATABASE_INFO"
ok "DATABASE_URL is valid and configured for replicaSet=${REPLICA_SET_NAME}"

# -----------------------------------------------------------------------------
# MongoDB service / replica set verification
# -----------------------------------------------------------------------------
step "Checking MongoDB"

command -v mongosh >/dev/null 2>&1 || \
    die "mongosh is not installed."

systemctl is-active --quiet mongod || \
    die "MongoDB service is not running."

ok "MongoDB service is running"

MONGO_HELLO="$(
    mongosh \
        --quiet \
        --host "$MONGO_HOST" \
        --port "$MONGO_PORT" \
        --eval '
            try {
                const h = db.hello();
                print(JSON.stringify({
                    ok: 1,
                    setName: h.setName || "",
                    isWritablePrimary: h.isWritablePrimary === true,
                    hosts: h.hosts || [],
                    primary: h.primary || ""
                }));
            } catch (e) {
                print(JSON.stringify({
                    ok: 0,
                    error: e.message || String(e)
                }));
                quit(1);
            }
        ' 2>/dev/null | tail -n 1
)" || die "Unable to connect to MongoDB."

echo "$MONGO_HELLO"

MONGO_CHECK="$(
    HELLO="$MONGO_HELLO" \
    EXPECTED_RS="$REPLICA_SET_NAME" \
    EXPECTED_MEMBER="${MONGO_HOST}:${MONGO_PORT}" \
    node <<'NODE'
const h = JSON.parse(process.env.HELLO || "{}");

const ok =
    h.ok === 1 &&
    h.setName === process.env.EXPECTED_RS &&
    h.isWritablePrimary === true &&
    Array.isArray(h.hosts) &&
    h.hosts.includes(process.env.EXPECTED_MEMBER);

if (!ok) {
    console.error(
        `MongoDB must be PRIMARY in replica set ${process.env.EXPECTED_RS}.`
    );
    process.exit(1);
}
NODE
)" || die "MongoDB replica-set verification failed."

ok "MongoDB is PRIMARY on replica set ${REPLICA_SET_NAME}"

# -----------------------------------------------------------------------------
# Run all application-side commands as ec2-user.
#
# This is important because npm, Prisma, generated files and node_modules
# should belong to the application user, not root.
# -----------------------------------------------------------------------------
run_as_app() {
    sudo -u "$APP_USER" -H bash -c "$1"
}

# -----------------------------------------------------------------------------
# npm install
# -----------------------------------------------------------------------------
step "Installing Node.js dependencies"

cd "$APP_DIR"

if [[ -f package-lock.json ]]; then
    log "package-lock.json found. Using npm ci for reproducible installation."

    run_as_app '
        cd "'"$APP_DIR"'"
        npm ci
    ' || die "npm ci failed."
else
    warn "package-lock.json not found. Falling back to npm install."

    run_as_app '
        cd "'"$APP_DIR"'"
        npm install
    ' || die "npm install failed."
fi

ok "Dependencies installed"

# -----------------------------------------------------------------------------
# Prisma detection
# -----------------------------------------------------------------------------
step "Checking Prisma"

PRISMA_VERSION="$(
    run_as_app '
        cd "'"$APP_DIR"'"
        npx prisma --version
    '
)" || die "Unable to execute Prisma."

echo "$PRISMA_VERSION"

# -----------------------------------------------------------------------------
# Check package.json scripts without assuming exact script names.
# -----------------------------------------------------------------------------
PACKAGE_SCRIPTS="$(
    node <<NODE
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("${APP_DIR}/package.json", "utf8"));
console.log(JSON.stringify(pkg.scripts || {}, null, 2));
NODE
)"

echo "$PACKAGE_SCRIPTS"

# -----------------------------------------------------------------------------
# Prisma schema validation
# -----------------------------------------------------------------------------
step "Validating Prisma schema"

run_as_app '
    cd "'"$APP_DIR"'"
    set -a
    source "'"$ENV_FILE"'"
    set +a
    npx prisma validate
' || die "Prisma schema validation failed."

ok "Prisma schema is valid"

# -----------------------------------------------------------------------------
# Prisma client generation
# -----------------------------------------------------------------------------
step "Generating Prisma client"

run_as_app '
    cd "'"$APP_DIR"'"
    set -a
    source "'"$ENV_FILE"'"
    set +a
    npx prisma generate
' || die "Prisma client generation failed."

ok "Prisma client generated"

# -----------------------------------------------------------------------------
# Optional Prisma db push
# -----------------------------------------------------------------------------
if [[ "$SKIP_PUSH" == "true" ]]; then

    warn "Skipping Prisma db push (--skip-push)."

else

    step "Preparing Prisma database push"

    echo
    echo "Database:"
    echo "  MongoDB     : ${MONGO_HOST}:${MONGO_PORT}"
    echo "  Database    : ${MONGO_DATABASE}"
    echo "  Replica set : ${REPLICA_SET_NAME}"
    echo
    echo "Prisma command:"
    echo "  npx prisma db push"
    echo

    if [[ "$ASSUME_YES" != "true" ]]; then
        read -r -p "Proceed with Prisma db push? [y/N]: " answer

        case "$answer" in
            y|Y|yes|YES|Yes)
                ;;
            *)
                die "Database push cancelled by user."
                ;;
        esac
    fi

    run_as_app '
        cd "'"$APP_DIR"'"
        set -a
        source "'"$ENV_FILE"'"
        set +a
        npx prisma db push
    ' || die "Prisma db push failed."

    ok "Prisma database schema pushed successfully"

fi

# -----------------------------------------------------------------------------
# Prisma seed
#
# Prefer the project's configured npm db:seed script if it exists.
# This preserves the project's own seed configuration (tsx, ts-node, etc.).
# -----------------------------------------------------------------------------
if [[ "$SKIP_SEED" == "true" ]]; then

    warn "Skipping Prisma seed (--skip-seed)."

else

    step "Seeding database"

    HAS_DB_SEED="$(
        node <<NODE
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("${APP_DIR}/package.json", "utf8"));
process.stdout.write(pkg.scripts && pkg.scripts["db:seed"] ? "yes" : "no");
NODE
    )"

    if [[ "$HAS_DB_SEED" == "yes" ]]; then

        log "Using project script: npm run db:seed"

        run_as_app '
            cd "'"$APP_DIR"'"
            set -a
            source "'"$ENV_FILE"'"
            set +a
            npm run db:seed
        ' || die "Database seed failed."

    else

        log "No npm db:seed script found."

        if [[ -f "$APP_DIR/prisma/seed.ts" ]]; then

            command -v npx >/dev/null 2>&1 || \
                die "npx is required to execute prisma/seed.ts"

            run_as_app '
                cd "'"$APP_DIR"'"
                set -a
                source "'"$ENV_FILE"'"
                set +a
                npx prisma db seed
            ' || die "Prisma database seed failed."

        elif [[ -f "$APP_DIR/prisma/seed.js" ]]; then

            run_as_app '
                cd "'"$APP_DIR"'"
                set -a
                source "'"$ENV_FILE"'"
                set +a
                npx prisma db seed
            ' || die "Prisma database seed failed."

        else
            die "No db:seed script and no Prisma seed file found."
        fi
    fi

    ok "Database seed completed successfully"

fi

# -----------------------------------------------------------------------------
# Required project directories
# -----------------------------------------------------------------------------
step "Checking application directories"

run_as_app '
    cd "'"$APP_DIR"'"

    mkdir -p public/images
    mkdir -p logs
'

ok "Required application directories are ready"

# -----------------------------------------------------------------------------
# Required project files
# -----------------------------------------------------------------------------
step "Checking project structure"

REQUIRED_FILES=(
    "package.json"
    "prisma/schema.prisma"
)

# next.config may be js/mjs/ts depending on project.
for file in "${REQUIRED_FILES[@]}"; do
    [[ -f "$APP_DIR/$file" ]] || die "Required file missing: $APP_DIR/$file"
    ok "$file"
done

if [[ -f "$APP_DIR/next.config.ts" ||
      -f "$APP_DIR/next.config.js" ||
      -f "$APP_DIR/next.config.mjs" ]]; then
    ok "Next.js config found"
else
    warn "No next.config.ts/js/mjs found."
fi

# -----------------------------------------------------------------------------
# Optional PM2 restart
# -----------------------------------------------------------------------------
if [[ "$SKIP_PM2" == "true" ]]; then

    warn "Skipping PM2 restart (--skip-pm2)."

else

    step "Checking PM2"

    if command -v pm2 >/dev/null 2>&1; then

        if sudo -u "$APP_USER" -H pm2 describe "$APP_NAME" >/dev/null 2>&1; then

            log "Restarting PM2 application: $APP_NAME"

            sudo -u "$APP_USER" -H bash -c '
                pm2 restart "'"$APP_NAME"'" --update-env
                pm2 save
            ' || die "PM2 restart failed."

            ok "PM2 application restarted"

        else
            warn "PM2 app '$APP_NAME' is not registered. Skipping restart."
        fi

    else
        warn "PM2 is not installed. Skipping PM2 restart."
    fi

fi

# -----------------------------------------------------------------------------
# Final verification
# -----------------------------------------------------------------------------
step "Final verification"

# Verify Prisma can still see the environment.
run_as_app '
    cd "'"$APP_DIR"'"
    set -a
    source "'"$ENV_FILE"'"
    set +a

    test -n "$DATABASE_URL"
    npx prisma validate
' || die "Final Prisma validation failed."

ok "Prisma final validation passed"

# Verify MongoDB remains PRIMARY.
FINAL_HELLO="$(
    mongosh \
        --quiet \
        --host "$MONGO_HOST" \
        --port "$MONGO_PORT" \
        --eval '
            const h = db.hello();
            print(JSON.stringify({
                setName: h.setName || "",
                isWritablePrimary: h.isWritablePrimary === true,
                hosts: h.hosts || [],
                primary: h.primary || ""
            }));
        ' 2>/dev/null | tail -n 1
)" || die "Final MongoDB verification failed."

echo "$FINAL_HELLO"

echo "$FINAL_HELLO" | grep -q '"isWritablePrimary":true' || \
    die "MongoDB is no longer PRIMARY."

ok "MongoDB PRIMARY verification passed"

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo
echo "============================================================"
echo -e "${GREEN}${BOLD} HomeShoppie Prisma setup completed successfully${NC}"
echo "============================================================"
echo
echo "Project       : ${APP_DIR}"
echo "Environment   : ${ENV_FILE}"
echo "MongoDB       : ${MONGO_HOST}:${MONGO_PORT}"
echo "Database      : ${MONGO_DATABASE}"
echo "Replica set   : ${REPLICA_SET_NAME}"
echo "Prisma push   : $([[ "$SKIP_PUSH" == "true" ]] && echo "SKIPPED" || echo "COMPLETED")"
echo "Prisma seed   : $([[ "$SKIP_SEED" == "true" ]] && echo "SKIPPED" || echo "COMPLETED")"
echo "PM2 restart   : $([[ "$SKIP_PM2" == "true" ]] && echo "SKIPPED" || echo "CHECKED")"
echo
ok "HomeShoppie database initialization is complete."
