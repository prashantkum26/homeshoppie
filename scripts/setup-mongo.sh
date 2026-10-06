#!/usr/bin/env bash

set -Eeuo pipefail

# ============================================================
# HomeShoppie - MongoDB 8.0 Setup
# Amazon Linux 2023
# ============================================================

MONGO_REPO_FILE="/etc/yum.repos.d/mongodb-org-8.0.repo"
MONGO_CONFIG="/etc/mongod.conf"

MONGO_DATABASE="homeshoppie"
MONGO_USER="homeshoppie_admin"
MONGO_PORT="27017"

# ------------------------------------------------------------
# Password
#
# Recommended:
#
#   export MONGO_PASSWORD='your-strong-password'
#   sudo -E ./setup-mongo.sh
#
# If MONGO_PASSWORD is not supplied, a strong password
# will be generated automatically.
# ------------------------------------------------------------

# ============================================================
# Colors
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
# Root check
# ============================================================

if [[ "${EUID}" -ne 0 ]]; then
    error "This script must be run with sudo."
    echo ""
    echo "Run:"
    echo ""
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

if [[ -f /etc/os-release ]]; then
    . /etc/os-release

    echo "Operating System:"
    echo "  ${PRETTY_NAME:-Unknown}"
    echo ""
fi

if ! command -v dnf >/dev/null 2>&1; then
    error "dnf is not available."
    error "This script is intended for Amazon Linux 2023."
    exit 1
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
        error "Unsupported architecture: ${ARCH}"
        exit 1
        ;;
esac

# ============================================================
# Generate password if not supplied
# ============================================================

if [[ -z "${MONGO_PASSWORD:-}" ]]; then

    if command -v openssl >/dev/null 2>&1; then
        MONGO_PASSWORD="$(openssl rand -hex 24)"
    else
        MONGO_PASSWORD="$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32)"
    fi

    PASSWORD_GENERATED="true"

else

    PASSWORD_GENERATED="false"

fi

# ============================================================
# MongoDB Repository
# ============================================================

echo ""
echo "============================================================"
echo " Configuring MongoDB 8.0 repository"
echo "============================================================"
echo ""

cat > "${MONGO_REPO_FILE}" <<EOF
[mongodb-org-8.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/amazon/2023/mongodb-org/8.0/\$basearch/
gpgcheck=1
enabled=1
gpgkey=https://pgp.mongodb.com/server-8.0.asc
EOF

log "MongoDB 8.0 repository created"

echo ""
echo "Repository:"
cat "${MONGO_REPO_FILE}"

# ============================================================
# Clean package cache
# ============================================================

echo ""
echo "Cleaning package cache..."

dnf clean all >/dev/null 2>&1 || true

log "Package cache cleaned"

# ============================================================
# Make package cache
# ============================================================

echo ""
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
# Verify MongoDB installation
# ============================================================

echo ""
echo "MongoDB version:"
mongod --version | head -5

echo ""
echo "mongosh version:"
mongosh --version

log "MongoDB installation verified"

# ============================================================
# Check configuration file
# ============================================================

if [[ ! -f "${MONGO_CONFIG}" ]]; then
    error "MongoDB configuration file does not exist:"
    error "${MONGO_CONFIG}"
    exit 1
fi

# ============================================================
# Configure localhost binding
# ============================================================

echo ""
echo "Configuring MongoDB network binding..."

# Make sure bindIp is localhost only.
if grep -qE '^[[:space:]]*bindIp:' "${MONGO_CONFIG}"; then

    sed -i \
        's/^[[:space:]]*bindIp:.*/  bindIp: 127.0.0.1/' \
        "${MONGO_CONFIG}"

else

    if grep -qE '^net:' "${MONGO_CONFIG}"; then

        sed -i \
            '/^net:/a\  bindIp: 127.0.0.1' \
            "${MONGO_CONFIG}"

    else

        cat >> "${MONGO_CONFIG}" <<'EOF'

net:
  port: 27017
  bindIp: 127.0.0.1
EOF

    fi

fi

# Make sure port is 27017.
if grep -qE '^[[:space:]]*port:' "${MONGO_CONFIG}"; then

    sed -i \
        's/^[[:space:]]*port:.*/  port: 27017/' \
        "${MONGO_CONFIG}"

fi

log "MongoDB configured for 127.0.0.1:27017"

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
    error "MongoDB failed to start."
    echo ""
    systemctl status mongod --no-pager
    echo ""
    echo "Recent logs:"
    journalctl -u mongod -n 50 --no-pager
    exit 1
fi

# ============================================================
# Enable MongoDB on boot
# ============================================================

systemctl enable mongod

if systemctl is-enabled --quiet mongod; then
    log "MongoDB is enabled at boot"
else
    error "MongoDB could not be enabled at boot"
    exit 1
fi

# ============================================================
# Check MongoDB port
# ============================================================

echo ""
echo "Checking MongoDB port..."

if ss -lnt | grep -q "127.0.0.1:${MONGO_PORT}"; then

    log "MongoDB is listening on 127.0.0.1:${MONGO_PORT}"

else

    error "MongoDB is not listening on 127.0.0.1:${MONGO_PORT}"
    echo ""
    ss -lntp | grep "${MONGO_PORT}" || true
    exit 1

fi

# ============================================================
# Check mongosh
# ============================================================

if ! command -v mongosh >/dev/null 2>&1; then
    error "mongosh is not installed."
    exit 1
fi

log "mongosh is available"

# ============================================================
# Check existing MongoDB user
# ============================================================

echo ""
echo "Checking MongoDB user..."

USER_EXISTS="$(
    mongosh \
        --quiet \
        --host 127.0.0.1 \
        --port "${MONGO_PORT}" \
        --eval "
            const db = db.getSiblingDB('${MONGO_DATABASE}');
            print(db.getUser('${MONGO_USER}') ? 'yes' : 'no');
        " 2>/dev/null || true
)"

# ============================================================
# Create database user
# ============================================================

if [[ "${USER_EXISTS}" == "yes" ]]; then

    log "MongoDB user '${MONGO_USER}' already exists"

else

    echo ""
    echo "Creating MongoDB database user..."

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

fi

# ============================================================
# Enable authentication
# ============================================================

echo ""
echo "Enabling MongoDB authentication..."

if grep -qE '^[[:space:]]*authorization:' "${MONGO_CONFIG}"; then

    sed -i \
        's/^[[:space:]]*authorization:.*/  authorization: enabled/' \
        "${MONGO_CONFIG}"

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
    error "MongoDB failed after authentication was enabled."
    echo ""
    systemctl status mongod --no-pager
    echo ""
    journalctl -u mongod -n 50 --no-pager
    exit 1
fi

# ============================================================
# Verify MongoDB is listening
# ============================================================

if ss -lnt | grep -q "127.0.0.1:${MONGO_PORT}"; then

    log "MongoDB is listening on 127.0.0.1:${MONGO_PORT}"

else

    error "MongoDB is not listening on port ${MONGO_PORT}"
    exit 1

fi

# ============================================================
# Test authenticated connection
# ============================================================

echo ""
echo "Testing authenticated MongoDB connection..."

if mongosh \
    --quiet \
    "mongodb://${MONGO_USER}:${MONGO_PASSWORD}@127.0.0.1:${MONGO_PORT}/${MONGO_DATABASE}?authSource=${MONGO_DATABASE}" \
    --eval "db.test.insertOne({ message: 'authentication works', createdAt: new Date() })" \
    >/dev/null 2>&1; then

    log "MongoDB authentication works"

else

    error "MongoDB authenticated connection failed"
    exit 1

fi

# ============================================================
# Verify database
# ============================================================

echo ""
echo "Verifying database..."

DB_EXISTS="$(
    mongosh \
        --quiet \
        "mongodb://${MONGO_USER}:${MONGO_PASSWORD}@127.0.0.1:${MONGO_PORT}/${MONGO_DATABASE}?authSource=${MONGO_DATABASE}" \
        --eval "print(db.getName())"
)"

if [[ "${DB_EXISTS}" == "${MONGO_DATABASE}" ]]; then
    log "Database '${MONGO_DATABASE}' is working"
else
    error "Database verification failed"
    exit 1
fi

# ============================================================
# Final information
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
echo "MongoDB URI:"
echo ""
echo "  mongodb://${MONGO_USER}:<PASSWORD>@127.0.0.1:${MONGO_PORT}/${MONGO_DATABASE}?authSource=${MONGO_DATABASE}"

if [[ "${PASSWORD_GENERATED}" == "true" ]]; then

    echo ""
    echo "============================================================"
    echo " GENERATED PASSWORD"
    echo "============================================================"
    echo ""
    echo "  ${MONGO_PASSWORD}"
    echo ""
    echo "IMPORTANT:"
    echo "Save this password securely."
    echo "Do NOT commit it to Git."
    echo ""

fi

echo "============================================================"
echo ""
echo "MongoDB service:"
echo "  sudo systemctl status mongod"
echo ""
echo "MongoDB logs:"
echo "  sudo journalctl -u mongod -f"
echo ""
echo "Check port:"
echo "  sudo ss -lntp | grep 27017"
echo ""
echo "============================================================"