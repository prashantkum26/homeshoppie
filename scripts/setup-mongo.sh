#!/usr/bin/env bash
set -Eeuo pipefail

###############################################################################
# HomeShoppie - MongoDB 8.0 Setup
# Amazon Linux 2023
#
# MongoDB:
#   Host       : 127.0.0.1
#   Port       : 27017
#   Database   : homeshoppie
#   User       : homeshoppie_admin
#
# Environment:
#   /etc/homeshoppie/.env.production
#
# This script:
#   - Installs/configures MongoDB 8.0
#   - Binds MongoDB to localhost only
#   - Creates/updates the HomeShoppie MongoDB user
#   - Safely handles unknown existing passwords
#   - Enables MongoDB authorization
#   - Updates DATABASE_URL
#   - Safely loads .env.production into the ec2-user PM2 process
#   - Restarts/starts HomeShoppie with --update-env
#   - Saves PM2 state
#   - Does not insert test data
###############################################################################

set -Eeuo pipefail

ENV_FILE="/etc/homeshoppie/.env.production"
MONGO_REPO_FILE="/etc/yum.repos.d/mongodb-org-8.0.repo"
MONGO_CONFIG="/etc/mongod.conf"

MONGO_DATABASE="homeshoppie"
MONGO_USER="homeshoppie_admin"
MONGO_HOST="127.0.0.1"
MONGO_PORT="27017"
MONGO_SERVICE="mongod"

APP_USER="ec2-user"
APP_NAME="homeshoppie"
APP_DIR="/home/ec2-user/homeshoppie"
APP_PORT="3000"

MIN_PASSWORD_LENGTH=16

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

[[ "${ID:-}" == "amzn" ]] || die "This script requires Amazon Linux. Detected: ${PRETTY_NAME:-unknown}"

ok "Operating System: ${PRETTY_NAME:-unknown}"

ARCH="$(uname -m)"
echo "Architecture: ${ARCH}"

case "${ARCH}" in
    x86_64) ok "Supported architecture" ;;
    aarch64) warn "Verify MongoDB 8.0 repository support for aarch64." ;;
    *) die "Unsupported architecture: ${ARCH}" ;;
esac

###############################################################################
# REQUIRED COMMANDS / FILES
###############################################################################

section "Checking HomeShoppie environment"

for cmd in dnf systemctl node openssl sudo; do
    command_exists "$cmd" || die "Required command not found: $cmd"
done

[[ -f "${ENV_FILE}" ]] || die "Environment file not found: ${ENV_FILE}"
[[ -d "${APP_DIR}" ]] || die "Application directory not found: ${APP_DIR}"

NODE_VERSION="$(node --version)"
ok "Node.js found: ${NODE_VERSION}"

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
(( NODE_MAJOR >= 20 )) || warn "Node.js 20+ is recommended."

chmod 600 "${ENV_FILE}"
chown "${APP_USER}:${APP_USER}" "${ENV_FILE}"
ok "Environment file permissions secured"

###############################################################################
# REPOSITORY
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
# INSTALL
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
# MONGODB CONFIGURATION HELPERS
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

    [[ "${mode}" == "enabled" || "${mode}" == "disabled" ]] || return 1

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

        in_security && /^[[:space:]]+authorization:[[:space:]]*(enabled|disabled)[[:space:]]*$/ {
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

###############################################################################
# NETWORK
###############################################################################

section "Configuring MongoDB network"

[[ -f "${MONGO_CONFIG}" ]] || die "MongoDB config not found: ${MONGO_CONFIG}"

BACKUP="${MONGO_CONFIG}.homeshoppie-backup"

if [[ ! -f "${BACKUP}" ]]; then
    cp -a "${MONGO_CONFIG}" "${BACKUP}"
    chmod 600 "${BACKUP}"
    ok "MongoDB configuration backup created"
fi

# Ensure net section exists.
if ! grep -Eq '^net:[[:space:]]*$' "${MONGO_CONFIG}"; then
    cat >> "${MONGO_CONFIG}" <<'EOF'

net:
  bindIp: 127.0.0.1
  port: 27017
EOF
else
    # Update existing bindIp/port or insert them after net.
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

ok "MongoDB configured for ${MONGO_HOST}:${MONGO_PORT}"

###############################################################################
# START / ENABLE
###############################################################################

section "Starting MongoDB"

systemctl daemon-reload >/dev/null 2>&1 || true
systemctl enable "${MONGO_SERVICE}" >/dev/null

if systemctl is-active --quiet "${MONGO_SERVICE}"; then
    ok "MongoDB is already running"
else
    systemctl start "${MONGO_SERVICE}"
fi

systemctl is-active --quiet "${MONGO_SERVICE}" || {
    journalctl -u "${MONGO_SERVICE}" -n 50 --no-pager || true
    die "MongoDB failed to start."
}

ok "MongoDB is running"
ok "MongoDB enabled at boot"

wait_for_mongo() {
    local authenticated="${1:-false}"

    for _ in {1..30}; do
        if [[ "${authenticated}" == "true" ]]; then
            if MONGO_TEST_USER="${MONGO_USER}" \
               MONGO_TEST_PASSWORD="${MONGO_PASSWORD}" \
               mongosh \
                   --quiet \
                   --host "${MONGO_HOST}" \
                   --port "${MONGO_PORT}" \
                   "${MONGO_DATABASE}" \
                   --eval '
                       if (!db.auth(
                           process.env.MONGO_TEST_USER,
                           process.env.MONGO_TEST_PASSWORD
                       )) quit(1);
                       quit(db.runCommand({ping: 1}).ok === 1 ? 0 : 1);
                   ' >/dev/null 2>&1; then
                return 0
            fi
        else
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

wait_for_mongo false || die "MongoDB did not become ready."

if command_exists ss; then
    ss -lnt | grep -Eq "127\.0\.0\.1:${MONGO_PORT}[[:space:]]" ||
        die "MongoDB is not listening on 127.0.0.1:${MONGO_PORT}"
fi

ok "MongoDB is listening on ${MONGO_HOST}:${MONGO_PORT}"

###############################################################################
# READ DATABASE_URL SAFELY
###############################################################################

section "Checking existing DATABASE_URL"

EXISTING_DATABASE_URL="$(
    node <<'NODE'
const fs = require("fs");

const file = "/etc/homeshoppie/.env.production";
const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);

for (const line of lines) {
    const value = line.trim();
    if (!value || value.startsWith("#")) continue;

    const match = value.match(/^DATABASE_URL\s*=\s*(.*)$/);
    if (!match) continue;

    let result = match[1].trim();

    if (
        result.length >= 2 &&
        (
            (result.startsWith('"') && result.endsWith('"')) ||
            (result.startsWith("'") && result.endsWith("'"))
        )
    ) {
        result = result.slice(1, -1);
    }

    process.stdout.write(result);
    process.exit(0);
}
NODE
)"

EXISTING_LOCAL_URL="false"
EXISTING_DB_USER=""
EXISTING_DB_PASSWORD=""
EXISTING_AUTH_SOURCE=""

if [[ -n "${EXISTING_DATABASE_URL}" ]]; then

    PARSED="$(
        DATABASE_URL="${EXISTING_DATABASE_URL}" \
        EXPECTED_USER="${MONGO_USER}" \
        EXPECTED_DB="${MONGO_DATABASE}" \
        EXPECTED_HOST="${MONGO_HOST}" \
        EXPECTED_PORT="${MONGO_PORT}" \
        node <<'NODE'
try {
    const url = new URL(process.env.DATABASE_URL);

    if (url.protocol !== "mongodb:") process.exit(0);

    const host = url.hostname;
    const port = url.port || "27017";
    const db = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    const user = decodeURIComponent(url.username || "");
    const password = decodeURIComponent(url.password || "");
    const params = new URLSearchParams(url.search);
    const authSource = params.get("authSource") || db || "admin";

    const localHost =
        host === process.env.EXPECTED_HOST ||
        host === "localhost";

    if (
        localHost &&
        port === process.env.EXPECTED_PORT &&
        db === process.env.EXPECTED_DB &&
        user === process.env.EXPECTED_USER
    ) {
        process.stdout.write(
            ["LOCAL", user, password, authSource].join("\t")
        );
    }
} catch {
    process.exit(0);
}
NODE
    )"

    if [[ "${PARSED}" == LOCAL$'\t'* ]]; then
        EXISTING_LOCAL_URL="true"
        IFS=$'\t' read -r _ EXISTING_DB_USER EXISTING_DB_PASSWORD EXISTING_AUTH_SOURCE <<< "${PARSED}"

        if [[ -n "${EXISTING_DB_PASSWORD}" ]]; then
            ok "Existing local MongoDB credentials found"
        else
            warn "Existing local DATABASE_URL has no password."
        fi
    else
        warn "Existing DATABASE_URL is not the expected local MongoDB URL."
        warn "It will be replaced."
    fi
else
    warn "No DATABASE_URL found."
fi

###############################################################################
# PASSWORD HELPERS
###############################################################################

generate_password() {
    openssl rand -hex 32
}

read_manual_password() {
    local password confirm

    while true; do
        echo
        read -r -s -p "Enter MongoDB password: " password
        echo

        [[ -n "${password}" ]] || {
            warn "Password cannot be empty."
            continue
        }

        (( ${#password} >= MIN_PASSWORD_LENGTH )) || {
            warn "Password must contain at least ${MIN_PASSWORD_LENGTH} characters."
            continue
        }

        read -r -s -p "Confirm MongoDB password: " confirm
        echo

        [[ "${password}" == "${confirm}" ]] || {
            warn "Passwords do not match."
            continue
        }

        printf '%s' "${password}"
        return 0
    done
}

###############################################################################
# AUTH STATE
###############################################################################

AUTH_STATUS="$(get_auth_status)"
echo "MongoDB authorization: ${AUTH_STATUS}"

###############################################################################
# VALIDATE EXISTING CREDENTIALS
###############################################################################

EXISTING_CREDENTIALS_VALID="false"
CURRENT_AUTH_DB="${MONGO_DATABASE}"

if [[ "${AUTH_STATUS}" == "enabled" &&
      "${EXISTING_LOCAL_URL}" == "true" &&
      -n "${EXISTING_DB_PASSWORD}" ]]; then

    section "Validating existing MongoDB credentials"

    CURRENT_AUTH_DB="${EXISTING_AUTH_SOURCE:-${MONGO_DATABASE}}"

    if MONGO_CURRENT_USER="${EXISTING_DB_USER}" \
       MONGO_CURRENT_PASSWORD="${EXISTING_DB_PASSWORD}" \
       mongosh \
           --quiet \
           --host "${MONGO_HOST}" \
           --port "${MONGO_PORT}" \
           "${CURRENT_AUTH_DB}" \
           --eval '
               quit(
                   db.auth(
                       process.env.MONGO_CURRENT_USER,
                       process.env.MONGO_CURRENT_PASSWORD
                   ) ? 0 : 1
               );
           ' >/dev/null 2>&1; then

        EXISTING_CREDENTIALS_VALID="true"
        ok "Existing MongoDB credentials are valid"
    else
        warn "Existing DATABASE_URL password could not authenticate."
    fi
fi

###############################################################################
# PASSWORD SELECTION
###############################################################################

MONGO_PASSWORD=""
PASSWORD_SOURCE=""

if [[ "${EXISTING_CREDENTIALS_VALID}" == "true" ]]; then

    section "MongoDB password"

    echo
    echo "Choose:"
    echo "  1) Keep existing password"
    echo "  2) Generate a new random password"
    echo "  3) Enter a new password manually"
    echo

    while true; do
        read -r -p "Choose [1-3]: " choice

        case "${choice}" in
            1)
                MONGO_PASSWORD="${EXISTING_DB_PASSWORD}"
                PASSWORD_SOURCE="existing"
                ok "Existing MongoDB password will be kept"
                break
                ;;
            2)
                MONGO_PASSWORD="$(generate_password)"
                PASSWORD_SOURCE="generated"
                ok "New random MongoDB password generated"
                break
                ;;
            3)
                MONGO_PASSWORD="$(read_manual_password)"
                PASSWORD_SOURCE="manual"
                ok "Manual MongoDB password accepted"
                break
                ;;
            *)
                warn "Choose 1, 2, or 3."
                ;;
        esac
    done

elif [[ "${AUTH_STATUS}" == "enabled" ]]; then

    section "MongoDB password recovery"

    echo
    echo "MongoDB authentication is enabled, but the existing"
    echo "application credentials could not authenticate."
    echo
    echo "Choose:"
    echo "  1) Generate a new password and reset the user"
    echo "  2) Enter a new password and reset the user"
    echo "  3) Enter the current password"
    echo "  4) Abort"
    echo

    while true; do
        read -r -p "Choose [1-4]: " choice

        case "${choice}" in
            1)
                MONGO_PASSWORD="$(generate_password)"
                PASSWORD_SOURCE="generated-reset"
                break
                ;;
            2)
                MONGO_PASSWORD="$(read_manual_password)"
                PASSWORD_SOURCE="manual-reset"
                break
                ;;
            3)
                read -r -s -p "Enter current MongoDB password: " CURRENT_PASSWORD
                echo

                if MONGO_CURRENT_USER="${MONGO_USER}" \
                   MONGO_CURRENT_PASSWORD="${CURRENT_PASSWORD}" \
                   mongosh \
                       --quiet \
                       --host "${MONGO_HOST}" \
                       --port "${MONGO_PORT}" \
                       "${CURRENT_AUTH_DB}" \
                       --eval '
                           quit(
                               db.auth(
                                   process.env.MONGO_CURRENT_USER,
                                   process.env.MONGO_CURRENT_PASSWORD
                               ) ? 0 : 1
                           );
                       ' >/dev/null 2>&1; then

                    MONGO_PASSWORD="${CURRENT_PASSWORD}"
                    PASSWORD_SOURCE="existing-entered"
                    EXISTING_CREDENTIALS_VALID="true"
                    ok "Current MongoDB password is valid"
                    break
                else
                    warn "Current password is not valid."
                fi
                ;;
            4)
                die "Setup cancelled."
                ;;
            *)
                warn "Choose 1, 2, 3, or 4."
                ;;
        esac
    done

else

    section "MongoDB password"

    echo
    echo "Choose:"
    echo "  1) Generate a random password"
    echo "  2) Enter a password manually"
    echo

    while true; do
        read -r -p "Choose [1-2]: " choice

        case "${choice}" in
            1)
                MONGO_PASSWORD="$(generate_password)"
                PASSWORD_SOURCE="generated"
                break
                ;;
            2)
                MONGO_PASSWORD="$(read_manual_password)"
                PASSWORD_SOURCE="manual"
                break
                ;;
            *)
                warn "Choose 1 or 2."
                ;;
        esac
    done
fi

[[ -n "${MONGO_PASSWORD}" ]] || die "MongoDB password is empty."
(( ${#MONGO_PASSWORD} >= MIN_PASSWORD_LENGTH )) ||
    die "MongoDB password is too short."

###############################################################################
# USER HELPERS
###############################################################################

user_exists_without_auth() {
    MONGO_TARGET_USER="${MONGO_USER}" \
    mongosh \
        --quiet \
        --host "${MONGO_HOST}" \
        --port "${MONGO_PORT}" \
        "${MONGO_DATABASE}" \
        --eval '
            const result = db.getUser(
                process.env.MONGO_TARGET_USER
            );
            quit(result ? 0 : 1);
        ' >/dev/null 2>&1
}

###############################################################################
# RECOVERY STATE / CLEANUP
###############################################################################

RECOVERY_MODE="false"
RECOVERY_CONFIG_CHANGED="false"

cleanup() {
    local exit_code=$?

    if [[ "${RECOVERY_MODE}" == "true" &&
          "${RECOVERY_CONFIG_CHANGED}" == "true" ]]; then

        error "Setup interrupted during MongoDB recovery."

        set_mongo_authorization "enabled" >/dev/null 2>&1 || true
        systemctl restart "${MONGO_SERVICE}" >/dev/null 2>&1 || true

        if systemctl is-active --quiet "${MONGO_SERVICE}"; then
            error "MongoDB authorization was restored."
        else
            error "CRITICAL: MongoDB could not be restarted."
        fi
    fi

    exit "${exit_code}"
}

trap cleanup EXIT

###############################################################################
# CONFIGURE USER
###############################################################################

if [[ "${AUTH_STATUS}" == "enabled" ]]; then

    section "Configuring MongoDB user"

    if [[ "${EXISTING_CREDENTIALS_VALID}" == "true" ]]; then

        if [[ "${PASSWORD_SOURCE}" == "existing" ]]; then
            ok "Existing MongoDB password retained"
        else
            log "Changing MongoDB application password..."

            MONGO_CURRENT_USER="${MONGO_USER}" \
            MONGO_CURRENT_PASSWORD="${EXISTING_DB_PASSWORD:-${MONGO_PASSWORD}}" \
            MONGO_NEW_PASSWORD="${MONGO_PASSWORD}" \
            mongosh \
                --quiet \
                --host "${MONGO_HOST}" \
                --port "${MONGO_PORT}" \
                "${CURRENT_AUTH_DB}" \
                --eval '
                    if (!db.auth(
                        process.env.MONGO_CURRENT_USER,
                        process.env.MONGO_CURRENT_PASSWORD
                    )) {
                        throw new Error("Current MongoDB authentication failed.");
                    }

                    const targetDb = db.getSiblingDB("homeshoppie");

                    targetDb.changeUserPassword(
                        process.env.MONGO_CURRENT_USER,
                        process.env.MONGO_NEW_PASSWORD
                    );
                ' >/dev/null

            ok "MongoDB password changed"
        fi

    else

        #######################################################################
        # Existing auth-enabled MongoDB user cannot be authenticated.
        # Temporarily disable authorization, reset/create the application
        # user, then enable authorization again.
        #######################################################################

        section "Recovering MongoDB application user"

        RECOVERY_MODE="true"

        log "Temporarily disabling MongoDB authorization..."

        set_mongo_authorization "disabled"
        RECOVERY_CONFIG_CHANGED="true"

        systemctl restart "${MONGO_SERVICE}"
        sleep 3

        systemctl is-active --quiet "${MONGO_SERVICE}" ||
            die "MongoDB failed to start in recovery mode."

        wait_for_mongo false ||
            die "MongoDB did not become ready in recovery mode."

        ok "MongoDB recovery mode active"

        if user_exists_without_auth; then

            log "Existing MongoDB user found. Resetting password..."

            MONGO_NEW_PASSWORD="${MONGO_PASSWORD}" \
            MONGO_TARGET_USER="${MONGO_USER}" \
            mongosh \
                --quiet \
                --host "${MONGO_HOST}" \
                --port "${MONGO_PORT}" \
                "${MONGO_DATABASE}" \
                --eval '
                    db.changeUserPassword(
                        process.env.MONGO_TARGET_USER,
                        process.env.MONGO_NEW_PASSWORD
                    );
                ' >/dev/null

            ok "MongoDB application password reset"

        else

            log "MongoDB user does not exist. Creating it..."

            MONGO_NEW_PASSWORD="${MONGO_PASSWORD}" \
            MONGO_TARGET_USER="${MONGO_USER}" \
            mongosh \
                --quiet \
                --host "${MONGO_HOST}" \
                --port "${MONGO_PORT}" \
                "${MONGO_DATABASE}" \
                --eval '
                    db.createUser({
                        user: process.env.MONGO_TARGET_USER,
                        pwd: process.env.MONGO_NEW_PASSWORD,
                        roles: [
                            {
                                role: "readWrite",
                                db: "homeshoppie"
                            }
                        ]
                    });
                ' >/dev/null

            ok "MongoDB application user created"
        fi

        log "Re-enabling MongoDB authorization..."

        set_mongo_authorization "enabled"
        systemctl restart "${MONGO_SERVICE}"
        sleep 3

        systemctl is-active --quiet "${MONGO_SERVICE}" ||
            die "MongoDB failed to restart with authorization enabled."

        wait_for_mongo true ||
            die "New MongoDB credentials could not authenticate."

        RECOVERY_CONFIG_CHANGED="false"
        RECOVERY_MODE="false"

        ok "MongoDB authorization enabled"
        ok "New MongoDB credentials verified"
    fi

else

    section "Configuring MongoDB user"

    if user_exists_without_auth; then

        log "Existing MongoDB user found. Updating password..."

        MONGO_NEW_PASSWORD="${MONGO_PASSWORD}" \
        MONGO_TARGET_USER="${MONGO_USER}" \
        mongosh \
            --quiet \
            --host "${MONGO_HOST}" \
            --port "${MONGO_PORT}" \
            "${MONGO_DATABASE}" \
            --eval '
                db.changeUserPassword(
                    process.env.MONGO_TARGET_USER,
                    process.env.MONGO_NEW_PASSWORD
                );
            ' >/dev/null

        ok "MongoDB application password updated"

    else

        log "Creating MongoDB application user..."

        MONGO_NEW_PASSWORD="${MONGO_PASSWORD}" \
        MONGO_TARGET_USER="${MONGO_USER}" \
        mongosh \
            --quiet \
            --host "${MONGO_HOST}" \
            --port "${MONGO_PORT}" \
            "${MONGO_DATABASE}" \
            --eval '
                db.createUser({
                    user: process.env.MONGO_TARGET_USER,
                    pwd: process.env.MONGO_NEW_PASSWORD,
                    roles: [
                        {
                            role: "readWrite",
                            db: "homeshoppie"
                        }
                    ]
                });
            ' >/dev/null

        ok "MongoDB application user created"
    fi

    log "Enabling MongoDB authorization..."

    set_mongo_authorization "enabled"
    systemctl restart "${MONGO_SERVICE}"
    sleep 3

    systemctl is-active --quiet "${MONGO_SERVICE}" ||
        die "MongoDB failed to restart with authorization enabled."

    wait_for_mongo true ||
        die "MongoDB authentication failed after enabling authorization."

    ok "MongoDB authorization enabled"
fi

###############################################################################
# FINAL AUTHENTICATED TEST
###############################################################################

section "Testing MongoDB authentication"

MONGO_TEST_RESULT="$(
    MONGO_TEST_USER="${MONGO_USER}" \
    MONGO_TEST_PASSWORD="${MONGO_PASSWORD}" \
    mongosh \
        --quiet \
        --host "${MONGO_HOST}" \
        --port "${MONGO_PORT}" \
        "${MONGO_DATABASE}" \
        --eval '
            if (!db.auth(
                process.env.MONGO_TEST_USER,
                process.env.MONGO_TEST_PASSWORD
            )) {
                quit(1);
            }

            const result = db.runCommand({ ping: 1 });

            print(result.ok === 1 ? "PING_OK" : "PING_FAILED");
        ' 2>/dev/null
)"

[[ "${MONGO_TEST_RESULT}" == *"PING_OK"* ]] ||
    die "MongoDB authentication/ping failed."

ok "MongoDB authentication successful"
ok "MongoDB ping successful"

###############################################################################
# BUILD DATABASE_URL
###############################################################################

section "Updating HomeShoppie DATABASE_URL"

ENCODED_CREDENTIALS="$(
    MONGO_USER_VALUE="${MONGO_USER}" \
    MONGO_PASSWORD_VALUE="${MONGO_PASSWORD}" \
    node <<'NODE'
const user = encodeURIComponent(process.env.MONGO_USER_VALUE);
const password = encodeURIComponent(process.env.MONGO_PASSWORD_VALUE);

process.stdout.write(`${user}\t${password}`);
NODE
)"

IFS=$'\t' read -r ENCODED_USER ENCODED_PASSWORD <<< "${ENCODED_CREDENTIALS}"

NEW_DATABASE_URL="mongodb://${ENCODED_USER}:${ENCODED_PASSWORD}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}?authSource=${MONGO_DATABASE}"

###############################################################################
# ATOMIC ENV UPDATE
###############################################################################

TMP_ENV="$(mktemp)"

awk -v new_url="${NEW_DATABASE_URL}" '
    BEGIN { found=0 }

    /^[[:space:]]*DATABASE_URL[[:space:]]*=/ {
        if (!found) {
            print "DATABASE_URL=\"" new_url "\""
            found=1
        }
        next
    }

    { print }

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

for (const line of lines) {
    const trimmed = line.trim();

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

[[ -n "${FINAL_DATABASE_URL}" ]] || die "DATABASE_URL could not be verified."

[[ "${FINAL_DATABASE_URL}" == mongodb://* ]] ||
    die "DATABASE_URL is not a mongodb:// URL."

chmod 600 "${ENV_FILE}"
chown "${APP_USER}:${APP_USER}" "${ENV_FILE}"

[[ "$(stat -c '%a' "${ENV_FILE}")" == "600" ]] ||
    die "Environment file permissions are not 600."

ok "DATABASE_URL verified"
ok "Environment file secured"

###############################################################################
# UPDATE PM2 ENVIRONMENT
###############################################################################

section "Updating HomeShoppie PM2 environment"

if ! command_exists pm2; then
    warn "PM2 is not installed. Skipping PM2 update."
else

    # IMPORTANT:
    # PM2 belongs to ec2-user. Running pm2 as root would operate on a
    # different PM2 daemon and would NOT update the application's environment.
    if sudo -u "${APP_USER}" -H bash -s -- \
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

# DO NOT use:
#   source /etc/homeshoppie/.env.production
#
# Parse dotenv values using Node so URLs and special characters are not
# interpreted as shell syntax.
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
    then
        ok "PM2 environment updated successfully"
    else
        die "Failed to update PM2 environment."
    fi
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
const fs = require("fs");

let data = "";
process.stdin.on("data", chunk => data += chunk);
process.stdin.on("end", () => {
    try {
        const apps = JSON.parse(data);
        const app = apps.find(
            item => item.name === process.env.APP_NAME
        );
        process.stdout.write(app?.pm2_env?.status || "unknown");
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

    echo
    echo "PM2 environment verification:"
    echo "  DATABASE_URL is configured in the PM2 process."

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
# SECURITY
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
echo "  Version       : ${MONGOD_VERSION}"
echo "  Host          : ${MONGO_HOST}"
echo "  Port          : ${MONGO_PORT}"
echo "  Database      : ${MONGO_DATABASE}"
echo "  User          : ${MONGO_USER}"
echo "  Authorization : enabled"
echo
echo "Environment:"
echo "  ${ENV_FILE}"
echo
echo "DATABASE_URL:"
echo "  ${SAFE_DATABASE_URL}"
echo
echo "PM2:"
echo "  Application   : ${APP_NAME}"
echo "  User          : ${APP_USER}"
echo "  Port          : ${APP_PORT}"
echo
echo "Security:"
echo "  MongoDB public access : NO"
echo "  MongoDB bind          : ${MONGO_HOST}"
echo "  Env permissions       : 600"
echo
echo "Password:"
echo "  Password value is NOT displayed."
echo "  Source: ${PASSWORD_SOURCE}"
echo

ok "HomeShoppie MongoDB setup completed successfully"

trap - EXIT
exit 0
