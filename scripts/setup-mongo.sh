#!/usr/bin/env bash
set -Eeuo pipefail

###############################################################################
# HomeShoppie - MongoDB 8.0 Setup / Repair / Password Rotation
# Amazon Linux 2023
#
# IMPORTANT DESIGN
#
# MongoDB users:
#
# 1. Management user
#      Username : homeshoppie_db_admin
#      Database : admin
#      Roles    :
#        - userAdminAnyDatabase
#        - readWriteAnyDatabase
#
#      This account is used ONLY by this script.
#      Its password is requested interactively and is NOT stored in the
#      HomeShoppie .env file.
#
# 2. Application user
#      Username : homeshoppie_admin
#      Database : homeshoppie
#      Role     : readWrite on homeshoppie only
#
#      This is the ONLY MongoDB user placed in DATABASE_URL.
#
# BOOTSTRAP / REPAIR STRATEGY
#
# Because an existing low-privilege application user cannot create MongoDB
# users, this script performs a controlled local bootstrap:
#
#   1. Backup mongod.conf
#   2. Stop MongoDB
#   3. Temporarily disable authorization
#   4. Start MongoDB locally
#   5. Remove/recreate the management user
#   6. Create/update the application user
#   7. Stop MongoDB
#   8. Re-enable authorization
#   9. Start MongoDB
#  10. Verify both users
#  11. Update DATABASE_URL
#  12. Restart/update PM2
#
# MongoDB is ALWAYS configured to listen only on 127.0.0.1.
#
# This means the script can repair an installation even if the previous
# management-user password is unknown.
#
# Run:
#   sudo ./setup-mongo.sh
###############################################################################

set -Eeuo pipefail

###############################################################################
# CONFIGURATION
###############################################################################

ENV_FILE="/etc/homeshoppie/.env.production"

MONGO_REPO_FILE="/etc/yum.repos.d/mongodb-org-8.0.repo"
MONGO_CONFIG="/etc/mongod.conf"
MONGO_CONFIG_BACKUP="${MONGO_CONFIG}.homeshoppie-backup"
MONGO_SERVICE="mongod"

MONGO_DATABASE="homeshoppie"
MONGO_HOST="127.0.0.1"
MONGO_PORT="27017"

MONGO_APP_USER="homeshoppie_admin"
MONGO_APP_AUTH_DB="homeshoppie"

MONGO_MGMT_USER="homeshoppie_db_admin"
MONGO_MGMT_AUTH_DB="admin"

APP_USER="ec2-user"
APP_NAME="homeshoppie"
APP_DIR="/home/ec2-user/homeshoppie"
APP_PORT="3000"

MIN_PASSWORD_LENGTH=16

###############################################################################
# COLORS
###############################################################################

if [[ -t 1 ]]; then
    RED="\033[0;31m"
    GREEN="\033[0;32m"
    YELLOW="\033[1;33m"
    CYAN="\033[0;36m"
    NC="\033[0m"
else
    RED=""
    GREEN=""
    YELLOW=""
    CYAN=""
    NC=""
fi

log()   { echo -e "${CYAN}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }
die()   { error "$*"; exit 1; }

section() {
    echo
    echo "============================================================"
    echo " $*"
    echo "============================================================"
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

###############################################################################
# STATE
###############################################################################

AUTH_WAS_ENABLED="false"
RECOVERY_ACTIVE="false"
RECOVERY_CONFIG_CHANGED="false"
MONGO_WAS_RUNNING="false"

MGMT_PASSWORD=""
APP_PASSWORD=""
PASSWORD_SOURCE=""

###############################################################################
# CLEANUP / SAFETY
###############################################################################

cleanup() {
    local exit_code=$?

    if [[ "${RECOVERY_ACTIVE}" == "true" ]]; then
        error "MongoDB bootstrap/recovery was interrupted."

        # Best effort: stop recovery instance.
        systemctl stop "${MONGO_SERVICE}" >/dev/null 2>&1 || true

        # Restore authorization if the script changed it.
        if [[ "${RECOVERY_CONFIG_CHANGED}" == "true" ]]; then
            log "Restoring MongoDB authorization..."
            set_mongo_authorization "enabled" >/dev/null 2>&1 || true
        fi

        # Try to start MongoDB safely.
        systemctl start "${MONGO_SERVICE}" >/dev/null 2>&1 || true

        if systemctl is-active --quiet "${MONGO_SERVICE}"; then
            error "MongoDB was restarted with authorization restored."
        else
            error "CRITICAL: MongoDB could not be restarted."
        fi
    fi

    exit "${exit_code}"
}

trap cleanup EXIT

###############################################################################
# ROOT
###############################################################################

[[ "${EUID}" -eq 0 ]] || die "Run with sudo: sudo ./setup-mongo.sh"

###############################################################################
# OS
###############################################################################

section "Checking operating system"

[[ -f /etc/os-release ]] || die "/etc/os-release not found."

# shellcheck disable=SC1091
source /etc/os-release

[[ "${ID:-}" == "amzn" ]] ||
    die "This script requires Amazon Linux. Detected: ${PRETTY_NAME:-unknown}"

ok "Operating System: ${PRETTY_NAME:-unknown}"

ARCH="$(uname -m)"
echo "Architecture: ${ARCH}"

case "${ARCH}" in
    x86_64)
        ok "Supported architecture"
        ;;
    aarch64)
        warn "Verify MongoDB 8.0 repository support for aarch64."
        ;;
    *)
        die "Unsupported architecture: ${ARCH}"
        ;;
esac

###############################################################################
# REQUIRED ENVIRONMENT
###############################################################################

section "Checking HomeShoppie environment"

for cmd in dnf systemctl node openssl sudo; do
    command_exists "$cmd" || die "Required command not found: $cmd"
done

[[ -f "${ENV_FILE}" ]] ||
    die "Environment file not found: ${ENV_FILE}"

[[ -d "${APP_DIR}" ]] ||
    die "Application directory not found: ${APP_DIR}"

NODE_VERSION="$(node --version)"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"

ok "Node.js found: ${NODE_VERSION}"

if (( NODE_MAJOR < 20 )); then
    warn "Node.js 20+ is recommended."
fi

chmod 600 "${ENV_FILE}"
chown "${APP_USER}:${APP_USER}" "${ENV_FILE}"

ok "Environment file permissions secured"

###############################################################################
# MONGODB REPOSITORY
###############################################################################

section "Configuring MongoDB 8.0 repository"

cat > "${MONGO_REPO_FILE}" <<'EOF'
[mongodb-org-8.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/amazon/2023/mongodb-org/8.0/$basearch/
gpgcheck=1
enabled=1
gpgkey=https://pgp.mongodb.com/server-8.0.asc
EOF

chmod 644 "${MONGO_REPO_FILE}"

dnf clean all >/dev/null 2>&1 || true
dnf makecache -y >/dev/null

ok "MongoDB repository configured"

###############################################################################
# INSTALL MONGODB
###############################################################################

section "Installing MongoDB"

if rpm -q mongodb-org >/dev/null 2>&1; then
    ok "MongoDB is already installed"
else
    dnf install -y mongodb-org
    ok "MongoDB installed"
fi

command_exists mongod || die "mongod was not installed."
command_exists mongosh || die "mongosh was not installed."

MONGOD_VERSION="$(mongod --version | awk '/db version/ {print $3; exit}')"
MONGOSH_VERSION="$(mongosh --version)"

echo "MongoDB : ${MONGOD_VERSION}"
echo "mongosh : ${MONGOSH_VERSION}"

###############################################################################
# MONGODB CONFIG HELPERS
###############################################################################

get_auth_status() {
    if grep -Eq '^[[:space:]]*authorization:[[:space:]]*enabled[[:space:]]*$' "${MONGO_CONFIG}"; then
        echo "enabled"
    else
        echo "disabled"
    fi
}

set_mongo_authorization() {
    local mode="$1"
    local tmp

    [[ "${mode}" == "enabled" || "${mode}" == "disabled" ]] ||
        return 1

    tmp="$(mktemp)"

    awk -v mode="${mode}" '
        BEGIN {
            in_security=0
            authorization_found=0
        }

        /^[[:space:]]*security:[[:space:]]*$/ {
            in_security=1
            print
            next
        }

        /^[^[:space:]][^:]*:/ {
            if (in_security && !authorization_found) {
                print "  authorization: " mode
                authorization_found=1
            }
            in_security=0
        }

        in_security &&
        /^[[:space:]]+authorization:[[:space:]]*(enabled|disabled)[[:space:]]*$/ {
            if (!authorization_found) {
                print "  authorization: " mode
                authorization_found=1
            }
            next
        }

        {
            print
        }

        END {
            if (in_security && !authorization_found) {
                print "  authorization: " mode
                authorization_found=1
            }

            if (!authorization_found && !in_security) {
                print ""
                print "security:"
                print "  authorization: " mode
            }
        }
    ' "${MONGO_CONFIG}" > "${tmp}"

    chown root:root "${tmp}"
    chmod 644 "${tmp}"
    mv "${tmp}" "${MONGO_CONFIG}"
}

configure_mongo_network() {
    if ! grep -Eq '^net:[[:space:]]*$' "${MONGO_CONFIG}"; then
        cat >> "${MONGO_CONFIG}" <<'EOF'

net:
  bindIp: 127.0.0.1
  port: 27017
EOF
    else
        if grep -Eq '^[[:space:]]+bindIp:' "${MONGO_CONFIG}"; then
            sed -i -E 's/^[[:space:]]+bindIp:.*/  bindIp: 127.0.0.1/' "${MONGO_CONFIG}"
        else
            sed -i '/^net:[[:space:]]*$/a\  bindIp: 127.0.0.1' "${MONGO_CONFIG}"
        fi

        if grep -Eq '^[[:space:]]+port:' "${MONGO_CONFIG}"; then
            sed -i -E 's/^[[:space:]]+port:.*/  port: 27017/' "${MONGO_CONFIG}"
        else
            sed -i '/^net:[[:space:]]*$/a\  port: 27017' "${MONGO_CONFIG}"
        fi
    fi
}

###############################################################################
# CONFIGURE NETWORK
###############################################################################

section "Configuring MongoDB network"

[[ -f "${MONGO_CONFIG}" ]] ||
    die "MongoDB config not found: ${MONGO_CONFIG}"

if [[ ! -f "${MONGO_CONFIG_BACKUP}" ]]; then
    cp -a "${MONGO_CONFIG}" "${MONGO_CONFIG_BACKUP}"
    chmod 600 "${MONGO_CONFIG_BACKUP}"
    ok "MongoDB configuration backup created"
fi

configure_mongo_network

ok "MongoDB configured for ${MONGO_HOST}:${MONGO_PORT}"

###############################################################################
# DETECT AUTH / RUNNING STATE
###############################################################################

AUTH_STATUS="$(get_auth_status)"

echo
echo "MongoDB authorization: ${AUTH_STATUS}"

if systemctl is-active --quiet "${MONGO_SERVICE}"; then
    MONGO_WAS_RUNNING="true"
else
    MONGO_WAS_RUNNING="false"
fi

###############################################################################
# START / STOP HELPERS
###############################################################################

start_mongo() {
    systemctl daemon-reload >/dev/null 2>&1 || true
    systemctl start "${MONGO_SERVICE}"

    for _ in {1..30}; do
        if systemctl is-active --quiet "${MONGO_SERVICE}"; then
            if mongosh \
                --quiet \
                --host "${MONGO_HOST}" \
                --port "${MONGO_PORT}" \
                --eval 'quit(db.runCommand({ping: 1}).ok === 1 ? 0 : 1)' \
                >/dev/null 2>&1; then
                return 0
            fi
        fi
        sleep 1
    done

    return 1
}

stop_mongo() {
    systemctl stop "${MONGO_SERVICE}"

    for _ in {1..30}; do
        if ! systemctl is-active --quiet "${MONGO_SERVICE}"; then
            return 0
        fi
        sleep 1
    done

    return 1
}

###############################################################################
# PASSWORD HELPERS
###############################################################################

generate_password() {
    openssl rand -hex 32
}

read_password_into() {
    local label="$1"
    local password confirm

    while true; do
        echo
        read -r -s -p "${label}: " password
        echo

        [[ -n "${password}" ]] || {
            warn "Password cannot be empty."
            continue
        }

        (( ${#password} >= MIN_PASSWORD_LENGTH )) || {
            warn "Password must contain at least ${MIN_PASSWORD_LENGTH} characters."
            continue
        }

        read -r -s -p "Confirm password: " confirm
        echo

        [[ "${password}" == "${confirm}" ]] || {
            warn "Passwords do not match."
            continue
        }

        PASSWORD_RESULT="${password}"
        return 0
    done
}

###############################################################################
# PASSWORD SELECTION
###############################################################################

section "HomeShoppie application password"

echo
echo "Application user:"
echo "  ${MONGO_APP_USER}"
echo "Database:"
echo "  ${MONGO_DATABASE}"
echo

echo "Choose:"
echo "  1) Keep existing password if valid"
echo "  2) Generate a new random password"
echo "  3) Enter a new password manually"
echo

while true; do
    read -r -p "Choose [1-3]: " choice

    case "${choice}" in
        1)
            PASSWORD_SOURCE="existing"
            break
            ;;
        2)
            APP_PASSWORD="$(generate_password)"
            PASSWORD_SOURCE="generated"
            ok "New random application password generated"
            break
            ;;
        3)
            read_password_into "Enter new application password"
            APP_PASSWORD="${PASSWORD_RESULT}"
            PASSWORD_SOURCE="manual"
            ok "Manual application password accepted"
            break
            ;;
        *)
            warn "Choose 1, 2, or 3."
            ;;
    esac
done

###############################################################################
# EXISTING DATABASE_URL PASSWORD
###############################################################################

EXISTING_DATABASE_URL="$(
    node <<'NODE'
const fs = require("fs");

const file = "/etc/homeshoppie/.env.production";
const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);

for (const raw of lines) {
    const line = raw.trim();

    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^DATABASE_URL\s*=\s*(.*)$/);

    if (!match) continue;

    let value = match[1].trim();

    if (
        value.length >= 2 &&
        (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        )
    ) {
        value = value.slice(1, -1);
    }

    process.stdout.write(value);
    process.exit(0);
}
NODE
)"

EXISTING_APP_PASSWORD=""

if [[ -n "${EXISTING_DATABASE_URL}" ]]; then
    EXISTING_APP_PASSWORD="$(
        DATABASE_URL="${EXISTING_DATABASE_URL}" \
        EXPECTED_USER="${MONGO_APP_USER}" \
        EXPECTED_DB="${MONGO_DATABASE}" \
        node <<'NODE'
try {
    const url = new URL(process.env.DATABASE_URL);

    if (url.protocol !== "mongodb:") process.exit(0);

    const db = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    const user = decodeURIComponent(url.username || "");

    if (
        (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
        (url.port || "27017") === "27017" &&
        db === process.env.EXPECTED_DB &&
        user === process.env.EXPECTED_USER
    ) {
        process.stdout.write(decodeURIComponent(url.password || ""));
    }
} catch {
    process.exit(0);
}
NODE
    )"
fi

if [[ "${PASSWORD_SOURCE}" == "existing" ]]; then
    [[ -n "${EXISTING_APP_PASSWORD}" ]] ||
        die "No existing HomeShoppie application password could be found in DATABASE_URL."

    ok "Existing application password will be retained"
fi

if [[ "${PASSWORD_SOURCE}" != "existing" ]]; then
    [[ -n "${APP_PASSWORD}" ]] ||
        die "Application password is empty."

    (( ${#APP_PASSWORD} >= MIN_PASSWORD_LENGTH )) ||
        die "Application password is too short."
else
    APP_PASSWORD="${EXISTING_APP_PASSWORD}"
fi

###############################################################################
# BOOTSTRAP
#
# We deliberately rebuild the management user every time.
# This makes the script recoverable even when the old management password
# is unknown.
###############################################################################

section "MongoDB management-user bootstrap"

echo
echo "The script will perform a controlled MongoDB maintenance restart."
echo
echo "It will:"
echo "  1) Stop MongoDB"
echo "  2) Temporarily disable authorization"
echo "  3) Start MongoDB locally"
echo "  4) Remove/recreate ${MONGO_MGMT_USER}"
echo "  5) Create/update ${MONGO_APP_USER}"
echo "  6) Stop MongoDB"
echo "  7) Re-enable authorization"
echo "  8) Start MongoDB"
echo "  9) Verify authentication"
echo
warn "MongoDB will be briefly unavailable during this operation."
echo

read -r -p "Continue? [y/N]: " CONFIRM

case "${CONFIRM}" in
    y|Y|yes|YES)
        ;;
    *)
        die "Setup cancelled."
        ;;
esac

###############################################################################
# ASK MANAGEMENT PASSWORD
###############################################################################

echo
echo "Management user:"
echo "  ${MONGO_MGMT_USER}"
echo "Authentication database:"
echo "  ${MONGO_MGMT_AUTH_DB}"
echo

read_password_into "Enter new management-user password"
MGMT_PASSWORD="${PASSWORD_RESULT}"

[[ -n "${MGMT_PASSWORD}" ]] ||
    die "Management password is empty."

###############################################################################
# ENTER RECOVERY
###############################################################################

RECOVERY_ACTIVE="true"

if ! stop_mongo; then
    journalctl -u "${MONGO_SERVICE}" -n 50 --no-pager || true
    die "Failed to stop MongoDB for controlled bootstrap."
fi

ok "MongoDB stopped"

set_mongo_authorization "disabled"
RECOVERY_CONFIG_CHANGED="true"

ok "MongoDB authorization temporarily disabled"

if ! start_mongo; then
    journalctl -u "${MONGO_SERVICE}" -n 50 --no-pager || true
    die "MongoDB failed to start in bootstrap mode."
fi

ok "MongoDB started in bootstrap mode"

###############################################################################
# REMOVE / CREATE MANAGEMENT USER
###############################################################################

section "Creating MongoDB management user"

MONGO_NEW_MGMT_USER="${MONGO_MGMT_USER}" \
MONGO_NEW_MGMT_PASSWORD="${MGMT_PASSWORD}" \
mongosh \
    --quiet \
    --host "${MONGO_HOST}" \
    --port "${MONGO_PORT}" \
    "${MONGO_MGMT_AUTH_DB}" \
    --eval '
        const username = process.env.MONGO_NEW_MGMT_USER;
        const password = process.env.MONGO_NEW_MGMT_PASSWORD;

        try {
            db.dropUser(username);
            print("Existing management user removed.");
        } catch (e) {
            if (e.codeName !== "UserNotFound") {
                throw e;
            }
            print("Management user did not previously exist.");
        }

        db.createUser({
            user: username,
            pwd: password,
            roles: [
                {
                    role: "userAdminAnyDatabase",
                    db: "admin"
                },
                {
                    role: "readWriteAnyDatabase",
                    db: "admin"
                }
            ]
        });

        print("MANAGEMENT_USER_CREATED");
    ' >/dev/null

ok "Management user recreated successfully"

###############################################################################
# CREATE / UPDATE APPLICATION USER
###############################################################################

section "Creating/updating HomeShoppie application user"

MONGO_NEW_APP_USER="${MONGO_APP_USER}" \
MONGO_NEW_APP_PASSWORD="${APP_PASSWORD}" \
mongosh \
    --quiet \
    --host "${MONGO_HOST}" \
    --port "${MONGO_PORT}" \
    "${MONGO_DATABASE}" \
    --eval '
        const username = process.env.MONGO_NEW_APP_USER;
        const password = process.env.MONGO_NEW_APP_PASSWORD;

        const existing = db.getUser(username);

        if (existing) {
            db.updateUser(username, {
                pwd: password,
                roles: [
                    {
                        role: "readWrite",
                        db: "homeshoppie"
                    }
                ]
            });

            print("APPLICATION_USER_UPDATED");
        } else {
            db.createUser({
                user: username,
                pwd: password,
                roles: [
                    {
                        role: "readWrite",
                        db: "homeshoppie"
                    }
                ]
            });

            print("APPLICATION_USER_CREATED");
        }
    ' >/dev/null

ok "HomeShoppie application user configured"

###############################################################################
# STOP BOOTSTRAP INSTANCE
###############################################################################

section "Restoring MongoDB authorization"

if ! stop_mongo; then
    journalctl -u "${MONGO_SERVICE}" -n 50 --no-pager || true
    die "Failed to stop MongoDB bootstrap instance."
fi

ok "Bootstrap MongoDB instance stopped"

set_mongo_authorization "enabled"

ok "MongoDB authorization enabled"

if ! start_mongo; then
    journalctl -u "${MONGO_SERVICE}" -n 50 --no-pager || true
    die "MongoDB failed to start after authorization was enabled."
fi

ok "MongoDB restarted with authorization enabled"

RECOVERY_CONFIG_CHANGED="false"
RECOVERY_ACTIVE="false"

###############################################################################
# ENABLE AT BOOT
###############################################################################

systemctl enable "${MONGO_SERVICE}" >/dev/null

ok "MongoDB enabled at boot"

###############################################################################
# VERIFY MANAGEMENT USER
###############################################################################

section "Verifying MongoDB management user"

MONGO_VERIFY_USER="${MONGO_MGMT_USER}" \
MONGO_VERIFY_PASSWORD="${MGMT_PASSWORD}" \
mongosh \
    --quiet \
    --host "${MONGO_HOST}" \
    --port "${MONGO_PORT}" \
    "${MONGO_MGMT_AUTH_DB}" \
    --eval '
        if (!db.auth(
            process.env.MONGO_VERIFY_USER,
            process.env.MONGO_VERIFY_PASSWORD
        )) {
            quit(1);
        }

        const u = db.getUser(process.env.MONGO_VERIFY_USER);

        if (!u) {
            quit(1);
        }

        const hasUserAdmin = (u.roles || []).some(
            r => r.role === "userAdminAnyDatabase" && r.db === "admin"
        );

        const hasReadWrite = (u.roles || []).some(
            r => r.role === "readWriteAnyDatabase" && r.db === "admin"
        );

        if (!hasUserAdmin || !hasReadWrite) {
            quit(1);
        }

        quit(0);
    ' >/dev/null 2>&1 ||
    die "Management user authentication/role verification failed."

ok "Management user verified"

###############################################################################
# VERIFY APPLICATION USER
###############################################################################

section "Verifying HomeShoppie application authentication"

MONGO_VERIFY_APP_USER="${MONGO_APP_USER}" \
MONGO_VERIFY_APP_PASSWORD="${APP_PASSWORD}" \
mongosh \
    --quiet \
    --host "${MONGO_HOST}" \
    --port "${MONGO_PORT}" \
    "${MONGO_APP_AUTH_DB}" \
    --eval '
        if (!db.auth(
            process.env.MONGO_VERIFY_APP_USER,
            process.env.MONGO_VERIFY_APP_PASSWORD
        )) {
            quit(1);
        }

        const result = db.runCommand({ ping: 1 });

        quit(result.ok === 1 ? 0 : 1);
    ' >/dev/null 2>&1 ||
    die "HomeShoppie application authentication failed."

ok "HomeShoppie application authentication successful"
ok "MongoDB ping successful"

###############################################################################
# VERIFY LOCAL LISTENING
###############################################################################

if command_exists ss; then
    ss -lnt | grep -Eq "127\.0\.0\.1:${MONGO_PORT}[[:space:]]" ||
        die "MongoDB is not listening on 127.0.0.1:${MONGO_PORT}"
fi

ok "MongoDB is listening on ${MONGO_HOST}:${MONGO_PORT}"

###############################################################################
# BUILD DATABASE_URL
###############################################################################

section "Updating HomeShoppie DATABASE_URL"

ENCODED_CREDENTIALS="$(
    MONGO_USER_VALUE="${MONGO_APP_USER}" \
    MONGO_PASSWORD_VALUE="${APP_PASSWORD}" \
    node <<'NODE'
const user = encodeURIComponent(process.env.MONGO_USER_VALUE);
const password = encodeURIComponent(process.env.MONGO_PASSWORD_VALUE);

process.stdout.write(`${user}\t${password}`);
NODE
)"

IFS=$'\t' read -r ENCODED_USER ENCODED_PASSWORD <<< "${ENCODED_CREDENTIALS}"

NEW_DATABASE_URL="mongodb://${ENCODED_USER}:${ENCODED_PASSWORD}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}?authSource=${MONGO_APP_AUTH_DB}"

###############################################################################
# ATOMIC ENV UPDATE
###############################################################################

TMP_ENV="$(mktemp)"

awk -v new_url="${NEW_DATABASE_URL}" '
    BEGIN {
        found=0
    }

    /^[[:space:]]*DATABASE_URL[[:space:]]*=/ {
        if (!found) {
            print "DATABASE_URL=\"" new_url "\""
            found=1
        }
        next
    }

    {
        print
    }

    END {
        if (!found) {
            print ""
            print "DATABASE_URL=\"" new_url "\""
        }
    }
' "${ENV_FILE}" > "${TMP_ENV}"

chown "${APP_USER}:${APP_USER}" "${TMP_ENV}"
chmod 600 "${TMP_ENV}"
mv "${TMP_ENV}" "${ENV_FILE}"

ok "DATABASE_URL updated"

###############################################################################
# VERIFY ENV
###############################################################################

section "Verifying environment"

FINAL_DATABASE_URL="$(
    node <<'NODE'
const fs = require("fs");

const file = "/etc/homeshoppie/.env.production";
const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);

for (const raw of lines) {
    const trimmed = raw.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^DATABASE_URL\s*=\s*(.*)$/);

    if (!match) continue;

    let value = match[1].trim();

    if (
        value.length >= 2 &&
        (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        )
    ) {
        value = value.slice(1, -1);
    }

    process.stdout.write(value);
    process.exit(0);
}
NODE
)"

[[ -n "${FINAL_DATABASE_URL}" ]] ||
    die "DATABASE_URL could not be verified."

[[ "${FINAL_DATABASE_URL}" == mongodb://* ]] ||
    die "DATABASE_URL is not a mongodb:// URL."

chmod 600 "${ENV_FILE}"
chown "${APP_USER}:${APP_USER}" "${ENV_FILE}"

[[ "$(stat -c '%a' "${ENV_FILE}")" == "600" ]] ||
    die "Environment file permissions are not 600."

ok "DATABASE_URL verified"
ok "Environment file secured"

###############################################################################
# PM2
###############################################################################

section "Updating HomeShoppie PM2 environment"

if ! command_exists pm2; then
    warn "PM2 is not installed. Skipping PM2 update."
else

    sudo -u "${APP_USER}" -H bash -s -- \
        "${ENV_FILE}" \
        "${APP_NAME}" \
        "${APP_DIR}" \
        "${APP_PORT}" <<'PM2_SCRIPT'

set -Eeuo pipefail

ENV_FILE="$1"
APP_NAME="$2"
APP_DIR="$3"
APP_PORT="$4"

[[ -f "${ENV_FILE}" ]] || {
    echo "[ERROR] Environment file not found: ${ENV_FILE}" >&2
    exit 1
}

command -v node >/dev/null 2>&1 || {
    echo "[ERROR] Node.js is not available." >&2
    exit 1
}

command -v pm2 >/dev/null 2>&1 || {
    echo "[ERROR] PM2 is not available." >&2
    exit 1
}

echo "[INFO] Loading production environment safely..."

eval "$(
    ENV_FILE="${ENV_FILE}" node <<'NODE'
const fs = require("fs");

const file = process.env.ENV_FILE;
const content = fs.readFileSync(file, "utf8");

for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);

    if (!match) continue;

    const key = match[1];
    let value = match[2].trim();

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
        `export ${key}=${JSON.stringify(value)}\n`
    );
}
NODE
)"

export NODE_ENV="production"
export PORT="${APP_PORT}"

cd "${APP_DIR}"

if pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
    echo "[INFO] Restarting ${APP_NAME} with updated environment..."
    pm2 restart "${APP_NAME}" --update-env
else
    echo "[INFO] ${APP_NAME} is not registered. Starting it..."
    pm2 start npm \
        --name "${APP_NAME}" \
        --cwd "${APP_DIR}" \
        -- start
fi

sleep 2
pm2 save

echo "[OK] PM2 environment updated and saved"
PM2_SCRIPT

    ok "PM2 environment updated successfully"
fi

###############################################################################
# VERIFY PM2
###############################################################################

section "Verifying PM2"

if command_exists pm2 &&
   sudo -u "${APP_USER}" -H pm2 describe "${APP_NAME}" >/dev/null 2>&1; then

    PM2_STATUS="$(
        sudo -u "${APP_USER}" -H pm2 jlist 2>/dev/null |
        APP_NAME="${APP_NAME}" node <<'NODE'
let data = "";

process.stdin.on("data", chunk => data += chunk);

process.stdin.on("end", () => {
    try {
        const apps = JSON.parse(data);

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

    if [[ "${PM2_STATUS}" == "online" ]]; then
        ok "PM2 application is online"
    else
        warn "PM2 status: ${PM2_STATUS}"
        sudo -u "${APP_USER}" -H pm2 status || true
    fi
else
    warn "HomeShoppie is not registered in PM2."
fi

###############################################################################
# APPLICATION HEALTH
###############################################################################

section "Checking HomeShoppie application"

if command_exists curl; then

    HEALTH_OK="false"

    for _ in {1..20}; do
        if curl \
            --silent \
            --show-error \
            --fail \
            --max-time 5 \
            "http://127.0.0.1:${APP_PORT}" \
            >/dev/null 2>&1; then

            HEALTH_OK="true"
            break
        fi

        sleep 1
    done

    if [[ "${HEALTH_OK}" == "true" ]]; then
        ok "HomeShoppie is responding on port ${APP_PORT}"
    else
        warn "HomeShoppie did not respond on port ${APP_PORT}."
        warn "Check:"
        warn "  sudo -u ${APP_USER} pm2 logs ${APP_NAME} --lines 50"
    fi
else
    warn "curl is not installed; skipping application health check."
fi

###############################################################################
# FINAL SECURITY CHECK
###############################################################################

section "Security verification"

FINAL_AUTH="$(get_auth_status)"

[[ "${FINAL_AUTH}" == "enabled" ]] ||
    die "MongoDB authorization is not enabled."

ok "MongoDB authorization is enabled"

if grep -Eq '^[[:space:]]*bindIp:[[:space:]]*127\.0\.0\.1[[:space:]]*$' "${MONGO_CONFIG}"; then
    ok "MongoDB is bound only to localhost"
else
    warn "Could not verify bindIp automatically."
fi

if [[ "$(stat -c '%a' "${ENV_FILE}")" == "600" ]]; then
    ok "Environment file permissions are 600"
else
    die "Environment file permissions are not 600."
fi

###############################################################################
# SAFE SUMMARY
###############################################################################

SAFE_DATABASE_URL="$(
    DATABASE_URL="${FINAL_DATABASE_URL}" \
    node <<'NODE'
try {
    const url = new URL(process.env.DATABASE_URL);
    url.password = "********";
    process.stdout.write(url.toString());
} catch {
    process.stdout.write("configured");
}
NODE
)"

section "MongoDB setup completed"

echo
echo "MongoDB:"
echo "  Version                : ${MONGOD_VERSION}"
echo "  Host                   : ${MONGO_HOST}"
echo "  Port                   : ${MONGO_PORT}"
echo "  Database               : ${MONGO_DATABASE}"
echo "  Application user       : ${MONGO_APP_USER}"
echo "  Management user        : ${MONGO_MGMT_USER}"
echo "  Authorization          : enabled"
echo
echo "Environment:"
echo "  ${ENV_FILE}"
echo
echo "DATABASE_URL:"
echo "  ${SAFE_DATABASE_URL}"
echo
echo "PM2:"
echo "  Application            : ${APP_NAME}"
echo "  User                   : ${APP_USER}"
echo "  Port                   : ${APP_PORT}"
echo
echo "Security:"
echo "  MongoDB public access  : NO"
echo "  MongoDB bind           : ${MONGO_HOST}"
echo "  Env permissions        : 600"
echo
echo "Passwords:"
echo "  Management password    : NOT displayed/stored in .env"
echo "  Application password   : NOT displayed"
echo "  Application source     : ${PASSWORD_SOURCE}"
echo

ok "HomeShoppie MongoDB setup completed successfully"

trap - EXIT
exit 0
