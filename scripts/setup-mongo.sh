#!/usr/bin/env bash

set -Eeuo pipefail

# ============================================================
# HomeShoppie - MongoDB 8.0 Setup
# Amazon Linux 2023
# ============================================================

ENV_FILE="/etc/homeshoppie/.env.production"

MONGO_REPO_FILE="/etc/yum.repos.d/mongodb-org-8.0.repo"
MONGO_CONFIG="/etc/mongod.conf"

MONGO_DATABASE="homeshoppie"
MONGO_USER="homeshoppie_admin"
MONGO_PORT="27017"

# ============================================================
# Colors
# ============================================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[OK]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

die() {
    error "$1"
    exit 1
}

# ============================================================
# Cleanup
# ============================================================

TEMP_ENV_FILE=""

cleanup() {
    if [[ -n "${TEMP_ENV_FILE}" && -f "${TEMP_ENV_FILE}" ]]; then
        rm -f "${TEMP_ENV_FILE}"
    fi
}

trap cleanup EXIT

# ============================================================
# Root check
# ============================================================

if [[ "${EUID}" -ne 0 ]]; then
    error "This script must be run with sudo."
    echo ""
    echo "Run:"
    echo "  sudo ./setup-mongo.sh"
    echo ""
    exit 1
fi

# ============================================================
# Header
# ============================================================

echo ""
echo "============================================================"
echo " HomeShoppie - MongoDB 8.0 Setup"
echo "============================================================"
echo ""

# ============================================================
# OS check
# ============================================================

if [[ ! -f /etc/os-release ]]; then
    die "Cannot determine operating system."
fi

. /etc/os-release

echo "Operating System:"
echo "  ${PRETTY_NAME:-Unknown}"
echo ""

if [[ "${ID:-}" != "amzn" ]]; then
    warn "This script is designed for Amazon Linux."
    warn "Detected OS: ${PRETTY_NAME:-Unknown}"
    echo ""
fi

if ! command -v dnf >/dev/null 2>&1; then
    die "dnf is not available."
fi

# ============================================================
# Architecture
# ============================================================

ARCH="$(uname -m)"

echo "Architecture:"
echo "  ${ARCH}"
echo ""

case "${ARCH}" in
    x86_64|aarch64)
        log "Supported architecture"
        ;;
    *)
        die "Unsupported architecture: ${ARCH}"
        ;;
esac

# ============================================================
# Environment file
# ============================================================

echo ""
echo "Checking HomeShoppie environment..."

if [[ ! -f "${ENV_FILE}" ]]; then
    die "Environment file not found: ${ENV_FILE}"
fi

chmod 600 "${ENV_FILE}"

if id ec2-user >/dev/null 2>&1; then
    chown ec2-user:ec2-user "${ENV_FILE}"
fi

log "Environment file found"

# ============================================================
# Check Node.js
# ============================================================

if ! command -v node >/dev/null 2>&1; then
    die "Node.js is required but was not found."
fi

log "Node.js found: $(node --version)"

# ============================================================
# MongoDB repository
# ============================================================

echo ""
echo "============================================================"
echo " Configuring MongoDB 8.0 repository"
echo "============================================================"
echo ""

cat > "${MONGO_REPO_FILE}" <<'EOF'
[mongodb-org-8.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/amazon/2023/mongodb-org/8.0/$basearch/
gpgcheck=1
enabled=1
gpgkey=https://pgp.mongodb.com/server-8.0.asc
EOF

log "MongoDB 8.0 repository configured"

# ============================================================
# Package cache
# ============================================================

echo ""
echo "Cleaning package cache..."

dnf clean all >/dev/null 2>&1 || true

echo "Refreshing package metadata..."

dnf makecache

log "Package metadata refreshed"

# ============================================================
# Install MongoDB
# ============================================================

echo ""
echo "============================================================"
echo " Installing MongoDB"
echo "============================================================"
echo ""

if command -v mongod >/dev/null 2>&1; then
    log "MongoDB is already installed"
else
    dnf install -y mongodb-org
    log "MongoDB installed"
fi

# ============================================================
# Verify installation
# ============================================================

echo ""
echo "MongoDB:"
mongod --version | head -5

echo ""
echo "mongosh:"
mongosh --version

log "MongoDB installation verified"

# ============================================================
# MongoDB config check
# ============================================================

if [[ ! -f "${MONGO_CONFIG}" ]]; then
    die "MongoDB configuration file not found: ${MONGO_CONFIG}"
fi

# ============================================================
# Configure MongoDB network
# ============================================================

echo ""
echo "Configuring MongoDB network..."

if grep -qE '^net:' "${MONGO_CONFIG}"; then

    if grep -qE '^[[:space:]]+port:' "${MONGO_CONFIG}"; then
        sed -i \
            's/^[[:space:]]*port:.*/  port: 27017/' \
            "${MONGO_CONFIG}"
    else
        sed -i \
            '/^net:/a\  port: 27017' \
            "${MONGO_CONFIG}"
    fi

    if grep -qE '^[[:space:]]+bindIp:' "${MONGO_CONFIG}"; then
        sed -i \
            's/^[[:space:]]*bindIp:.*/  bindIp: 127.0.0.1/' \
            "${MONGO_CONFIG}"
    else
        sed -i \
            '/^net:/a\  bindIp: 127.0.0.1' \
            "${MONGO_CONFIG}"
    fi

else

    cat >> "${MONGO_CONFIG}" <<'EOF'

net:
  port: 27017
  bindIp: 127.0.0.1
EOF

fi

log "MongoDB bound to 127.0.0.1:27017"

# ============================================================
# Start MongoDB
# ============================================================

echo ""
echo "Starting MongoDB..."

systemctl daemon-reload
systemctl start mongod

sleep 3

if systemctl is-active --quiet mongod; then
    log "MongoDB is running"
else
    systemctl status mongod --no-pager || true
    echo ""
    journalctl -u mongod -n 50 --no-pager || true
    die "MongoDB failed to start."
fi

# ============================================================
# Enable MongoDB at boot
# ============================================================

systemctl enable mongod

if systemctl is-enabled --quiet mongod; then
    log "MongoDB enabled at boot"
else
    die "Failed to enable MongoDB at boot."
fi

# ============================================================
# Check MongoDB port
# ============================================================

echo ""
echo "Checking MongoDB port..."

if ss -lnt | grep -q "127.0.0.1:${MONGO_PORT}"; then
    log "MongoDB is listening on 127.0.0.1:${MONGO_PORT}"
else
    ss -lntp | grep "${MONGO_PORT}" || true
    die "MongoDB is not listening on 127.0.0.1:${MONGO_PORT}"
fi

# ============================================================
# Read existing DATABASE_URL
# ============================================================

echo ""
echo "Checking existing DATABASE_URL..."

EXISTING_DATABASE_URL="$(
    awk -F= '
        /^[[:space:]]*DATABASE_URL[[:space:]]*=/ {
            sub(/^[[:space:]]*DATABASE_URL[[:space:]]*=[[:space:]]*/, "", $0)
            gsub(/^"/, "", $0)
            gsub(/"$/, "", $0)
            print
            exit
        }
    ' "${ENV_FILE}"
)"

# ============================================================
# Determine existing password
# ============================================================

EXISTING_MONGO_PASSWORD=""

if [[ -n "${EXISTING_DATABASE_URL}" ]]; then

    EXISTING_MONGO_PASSWORD="$(
        EXISTING_DATABASE_URL="${EXISTING_DATABASE_URL}" node <<'NODE'
try {
    const value = process.env.EXISTING_DATABASE_URL;
    const parsed = new URL(value);

    if (
        parsed.protocol !== "mongodb:" &&
        parsed.protocol !== "mongodb+srv:"
    ) {
        process.exit(0);
    }

    if (parsed.password) {
        console.log(decodeURIComponent(parsed.password));
    }
} catch {
    process.exit(0);
}
NODE
    )"

    if [[ -n "${EXISTING_MONGO_PASSWORD}" ]]; then
        log "Existing MongoDB credentials found"
    else
        warn "DATABASE_URL exists, but MongoDB password could not be extracted."
    fi

else

    info "No existing DATABASE_URL found."

fi

# ============================================================
# Check authentication state
# ============================================================

AUTH_ENABLED=false

if grep -qE '^[[:space:]]*authorization:[[:space:]]*enabled' "${MONGO_CONFIG}"; then
    AUTH_ENABLED=true
fi

# ============================================================
# Existing credentials decision
# ============================================================

MONGO_PASSWORD=""
PASSWORD_SOURCE=""

if [[ -n "${EXISTING_MONGO_PASSWORD}" ]]; then

    echo ""
    echo "============================================================"
    echo " Existing MongoDB credentials found"
    echo "============================================================"
    echo ""
    echo "Choose how to handle the MongoDB password:"
    echo ""
    echo "  1) Use existing password"
    echo "  2) Generate a new random password"
    echo "  3) Enter a new password manually"
    echo ""

    while true; do
        read -r -p "Choose [1-3]: " PASSWORD_CHOICE

        case "${PASSWORD_CHOICE}" in

            1)
                MONGO_PASSWORD="${EXISTING_MONGO_PASSWORD}"
                PASSWORD_SOURCE="existing"
                echo ""
                log "Using existing MongoDB password"
                break
                ;;

            2)
                if command -v openssl >/dev/null 2>&1; then
                    MONGO_PASSWORD="$(openssl rand -hex 24)"
                else
                    MONGO_PASSWORD="$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32)"
                fi

                PASSWORD_SOURCE="new-random"

                echo ""
                log "Generated a new random MongoDB password"
                break
                ;;

            3)
                echo ""
                read -r -s -p "Enter new MongoDB password: " MONGO_PASSWORD
                echo ""

                if [[ -z "${MONGO_PASSWORD}" ]]; then
                    warn "Password cannot be empty."
                    continue
                fi

                read -r -s -p "Confirm new MongoDB password: " MONGO_PASSWORD_CONFIRM
                echo ""

                if [[ "${MONGO_PASSWORD}" != "${MONGO_PASSWORD_CONFIRM}" ]]; then
                    warn "Passwords do not match."
                    continue
                fi

                PASSWORD_SOURCE="new-manual"

                echo ""
                log "Using manually provided password"
                break
                ;;

            *)
                warn "Please choose 1, 2, or 3."
                ;;

        esac
    done

else

    echo ""
    echo "No existing MongoDB password was found."
    echo ""
    echo "Choose:"
    echo ""
    echo "  1) Generate a random password"
    echo "  2) Enter a password manually"
    echo ""

    while true; do
        read -r -p "Choose [1-2]: " PASSWORD_CHOICE

        case "${PASSWORD_CHOICE}" in

            1)
                if command -v openssl >/dev/null 2>&1; then
                    MONGO_PASSWORD="$(openssl rand -hex 24)"
                else
                    MONGO_PASSWORD="$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32)"
                fi

                PASSWORD_SOURCE="new-random"

                log "Generated a new random MongoDB password"
                break
                ;;

            2)
                echo ""
                read -r -s -p "Enter MongoDB password: " MONGO_PASSWORD
                echo ""

                if [[ -z "${MONGO_PASSWORD}" ]]; then
                    warn "Password cannot be empty."
                    continue
                fi

                read -r -s -p "Confirm MongoDB password: " MONGO_PASSWORD_CONFIRM
                echo ""

                if [[ "${MONGO_PASSWORD}" != "${MONGO_PASSWORD_CONFIRM}" ]]; then
                    warn "Passwords do not match."
                    continue
                fi

                PASSWORD_SOURCE="new-manual"

                log "Using manually provided password"
                break
                ;;

            *)
                warn "Please choose 1 or 2."
                ;;

        esac
    done

fi

# ============================================================
# URL encode credentials
# ============================================================

MONGO_USER_ENCODED="$(
    MONGO_USER="${MONGO_USER}" node -e \
    'console.log(encodeURIComponent(process.env.MONGO_USER))'
)"

MONGO_PASSWORD_ENCODED="$(
    MONGO_PASSWORD="${MONGO_PASSWORD}" node -e \
    'console.log(encodeURIComponent(process.env.MONGO_PASSWORD))'
)"

MONGO_URI="mongodb://${MONGO_USER_ENCODED}:${MONGO_PASSWORD_ENCODED}@127.0.0.1:${MONGO_PORT}/${MONGO_DATABASE}?authSource=${MONGO_DATABASE}"

# ============================================================
# Check / create MongoDB user
# ============================================================

echo ""
echo "Checking MongoDB user..."

USER_EXISTS=false

if [[ "${AUTH_ENABLED}" == "true" ]]; then

    if mongosh \
        --quiet \
        "${MONGO_URI}" \
        --eval "db.getUser('${MONGO_USER}')" \
        >/dev/null 2>&1; then

        USER_EXISTS=true
        log "Existing MongoDB user verified"

    else

        if [[ "${PASSWORD_SOURCE}" == "existing" ]]; then
            die "Existing MongoDB password could not authenticate."
        fi

        warn "Current password could not authenticate."
        warn "The password may need to be changed."

    fi

else

    EXISTING_USER_RESULT="$(
        mongosh \
            --quiet \
            --host 127.0.0.1 \
            --port "${MONGO_PORT}" \
            --eval "
                const db = db.getSiblingDB('${MONGO_DATABASE}');
                print(db.getUser('${MONGO_USER}') ? 'yes' : 'no');
            " 2>/dev/null || true
    )"

    if [[ "${EXISTING_USER_RESULT}" == "yes" ]]; then
        USER_EXISTS=true
        log "Existing MongoDB user found"
    fi

fi

# ============================================================
# Create or update MongoDB user
# ============================================================

if [[ "${USER_EXISTS}" == "false" ]]; then

    echo ""
    echo "Creating MongoDB user..."

    if [[ "${AUTH_ENABLED}" == "true" ]]; then
        die "MongoDB authentication is enabled, but the selected credentials cannot authenticate."
    fi

    mongosh \
        --quiet \
        --host 127.0.0.1 \
        --port "${MONGO_PORT}" \
        --eval "
            const db = db.getSiblingDB('${MONGO_DATABASE}');

            db.createUser({
                user: '${MONGO_USER}',
                pwd: '${MONGO_PASSWORD}',
                roles: [
                    {
                        role: 'readWrite',
                        db: '${MONGO_DATABASE}'
                    }
                ]
            });
        "

    log "MongoDB user created"

elif [[ "${PASSWORD_SOURCE}" == "new-random" || "${PASSWORD_SOURCE}" == "new-manual" ]]; then

    echo ""
    echo "Updating MongoDB user password..."

    if [[ "${AUTH_ENABLED}" == "true" ]]; then

        # Authenticate using the old password.
        if [[ -z "${EXISTING_MONGO_PASSWORD}" ]]; then
            die "Cannot rotate password because the existing password is unavailable."
        fi

        OLD_URI="mongodb://${MONGO_USER_ENCODED}:$(EXISTING_MONGO_PASSWORD="${EXISTING_MONGO_PASSWORD}" node -e 'console.log(encodeURIComponent(process.env.EXISTING_MONGO_PASSWORD))')@127.0.0.1:${MONGO_PORT}/${MONGO_DATABASE}?authSource=${MONGO_DATABASE}"

        mongosh \
            --quiet \
            "${OLD_URI}" \
            --eval "
                db.changeUserPassword(
                    '${MONGO_USER}',
                    '${MONGO_PASSWORD}'
                );
            "

    else

        mongosh \
            --quiet \
            --host 127.0.0.1 \
            --port "${MONGO_PORT}" \
            --eval "
                const db = db.getSiblingDB('${MONGO_DATABASE}');

                db.changeUserPassword(
                    '${MONGO_USER}',
                    '${MONGO_PASSWORD}'
                );
            "

    fi

    log "MongoDB password changed"

else

    log "MongoDB password unchanged"

fi

# ============================================================
# Enable MongoDB authentication
# ============================================================

echo ""
echo "Configuring MongoDB authentication..."

if grep -qE '^security:' "${MONGO_CONFIG}"; then

    if grep -qE '^[[:space:]]+authorization:' "${MONGO_CONFIG}"; then

        sed -i \
            's/^[[:space:]]*authorization:.*/  authorization: enabled/' \
            "${MONGO_CONFIG}"

    else

        sed -i \
            '/^security:/a\  authorization: enabled' \
            "${MONGO_CONFIG}"

    fi

else

    cat >> "${MONGO_CONFIG}" <<'EOF'

security:
  authorization: enabled
EOF

fi

log "MongoDB authentication enabled"

# ============================================================
# Restart MongoDB
# ============================================================

echo ""
echo "Restarting MongoDB..."

systemctl restart mongod

sleep 3

if systemctl is-active --quiet mongod; then
    log "MongoDB restarted successfully"
else
    systemctl status mongod --no-pager || true
    echo ""
    journalctl -u mongod -n 50 --no-pager || true
    die "MongoDB failed after configuration."
fi

# ============================================================
# Verify port
# ============================================================

if ss -lnt | grep -q "127.0.0.1:${MONGO_PORT}"; then
    log "MongoDB is listening on 127.0.0.1:${MONGO_PORT}"
else
    die "MongoDB is not listening on 127.0.0.1:${MONGO_PORT}"
fi

# ============================================================
# Final authenticated connection test
# ============================================================

echo ""
echo "Testing authenticated MongoDB connection..."

if mongosh \
    --quiet \
    "${MONGO_URI}" \
    --eval "db.runCommand({ ping: 1 })" \
    >/dev/null 2>&1; then

    log "MongoDB authentication works"

else

    die "MongoDB authenticated connection failed."
fi

# ============================================================
# Update DATABASE_URL
# ============================================================

echo ""
echo "============================================================"
echo " Updating HomeShoppie DATABASE_URL"
echo "============================================================"
echo ""

DATABASE_URL="${MONGO_URI}"

TEMP_ENV_FILE="$(mktemp)"

# Remove existing DATABASE_URL.
awk '
    !/^[[:space:]]*DATABASE_URL[[:space:]]*=/
' "${ENV_FILE}" > "${TEMP_ENV_FILE}"

# Add exactly one DATABASE_URL.
printf '\nDATABASE_URL="%s"\n' "${DATABASE_URL}" >> "${TEMP_ENV_FILE}"

chmod 600 "${TEMP_ENV_FILE}"
chown ec2-user:ec2-user "${TEMP_ENV_FILE}"

# Atomic replacement.
mv "${TEMP_ENV_FILE}" "${ENV_FILE}"

TEMP_ENV_FILE=""

chmod 600 "${ENV_FILE}"
chown ec2-user:ec2-user "${ENV_FILE}"

log "DATABASE_URL added/updated"

# ============================================================
# Verify DATABASE_URL exists
# ============================================================

if grep -qE '^[[:space:]]*DATABASE_URL[[:space:]]*=' "${ENV_FILE}"; then
    log "DATABASE_URL verified"
else
    die "DATABASE_URL was not written successfully."
fi

# ============================================================
# Final status
# ============================================================

echo ""
echo "============================================================"
echo " MongoDB Setup Complete"
echo "============================================================"
echo ""

echo "Database:"
echo "  ${MONGO_DATABASE}"

echo ""
echo "User:"
echo "  ${MONGO_USER}"

echo ""
echo "Host:"
echo "  127.0.0.1"

echo ""
echo "Port:"
echo "  ${MONGO_PORT}"

echo ""
echo "Authentication:"
echo "  Enabled"

echo ""
echo "Environment:"
echo "  ${ENV_FILE}"

echo ""
echo "Password:"
case "${PASSWORD_SOURCE}" in
    existing)
        echo "  Existing password retained"
        ;;
    new-random)
        echo "  New random password configured"
        ;;
    new-manual)
        echo "  New manually supplied password configured"
        ;;
esac

echo ""
echo "DATABASE_URL:"
echo "  mongodb://${MONGO_USER}:********@127.0.0.1:${MONGO_PORT}/${MONGO_DATABASE}?authSource=${MONGO_DATABASE}"

echo ""
echo "============================================================"
echo " Next steps"
echo "============================================================"
echo ""
echo "Restart HomeShoppie:"
echo "  pm2 restart homeshoppie --update-env"
echo ""
echo "Check application logs:"
echo "  pm2 logs homeshoppie --lines 50"
echo ""
echo "Check MongoDB:"
echo "  sudo systemctl status mongod"
echo ""
echo "Check MongoDB port:"
echo "  sudo ss -lntp | grep 27017"
echo ""
echo "============================================================"