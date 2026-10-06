#!/usr/bin/env bash
###############################################################################
# HomeShoppie - MongoDB 8.0 Setup / Repair
# Amazon Linux 2023
#
# SAFE VERSION
#
# Important safety properties:
#   - MongoDB remains bound to 127.0.0.1 only.
#   - Never touches /var/lib/mongo data files.
#   - Repairs /etc traversal/config permissions before starting mongod.
#   - Validates access as the actual mongod service user.
#   - Atomic config updates.
#   - Never restarts MongoDB unless the config is readable first.
#   - Authorization is enabled again before normal operation.
#   - DATABASE_URL contains only the application user.
###############################################################################

set -Eeuo pipefail

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

RECOVERY_ACTIVE="false"
RECOVERY_CONFIG_CHANGED="false"
APP_PASSWORD=""
MGMT_PASSWORD=""
PASSWORD_SOURCE=""

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
# CLEANUP
###############################################################################

cleanup() {
    local exit_code=$?

    if [[ "${RECOVERY_ACTIVE}" == "true" ]]; then
        error "MongoDB bootstrap/recovery was interrupted."

        systemctl stop "${MONGO_SERVICE}" >/dev/null 2>&1 || true

        if [[ "${RECOVERY_CONFIG_CHANGED}" == "true" ]]; then
            log "Restoring MongoDB authorization..."
            set_mongo_authorization "enabled" >/dev/null 2>&1 || true
        fi

        # IMPORTANT:
        # Do not blindly start mongod. First repair and validate its access path.
        if prepare_mongo_config_access >/dev/null 2>&1 &&
           validate_mongo_config_access >/dev/null 2>&1; then
            systemctl start "${MONGO_SERVICE}" >/dev/null 2>&1 || true
        fi

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
# ROOT / OS
###############################################################################

[[ "${EUID}" -eq 0 ]] || die "Run with sudo: sudo ./setup-mongo.sh"

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
    x86_64) ok "Supported architecture" ;;
    aarch64) warn "Verify MongoDB 8.0 repository support for aarch64." ;;
    *) die "Unsupported architecture: ${ARCH}" ;;
esac

###############################################################################
# REQUIRED ENVIRONMENT
###############################################################################

section "Checking HomeShoppie environment"

for cmd in dnf systemctl node openssl sudo stat awk sed grep mktemp getent; do
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
# DISCOVER SERVICE USER
###############################################################################

get_mongod_user() {
    local configured_user

    configured_user="$(systemctl show -p User --value "${MONGO_SERVICE}" 2>/dev/null || true)"

    if [[ -n "${configured_user}" ]]; then
        echo "${configured_user}"
        return 0
    fi

    if getent passwd mongod >/dev/null 2>&1; then
        echo "mongod"
        return 0
    fi

    # MongoDB packages normally use mongod. Refuse to guess if it is absent.
    die "Could not determine the mongod service user."
}

MONGOD_USER="$(get_mongod_user)"
MONGOD_GROUP="$(id -gn "${MONGOD_USER}" 2>/dev/null || echo "${MONGOD_USER}")"

ok "MongoDB service user: ${MONGOD_USER}:${MONGOD_GROUP}"

###############################################################################
# CONFIGURATION ACCESS / PERMISSIONS
###############################################################################

prepare_mongo_config_access() {
    [[ -f "${MONGO_CONFIG}" ]] ||
        die "MongoDB config not found: ${MONGO_CONFIG}"

    # /etc must be traversable by the mongod service user.
    # 755 is the normal safe mode for /etc: users can traverse/read directory
    # entries according to their own permissions, but cannot modify /etc.
    local etc_mode
    etc_mode="$(stat -c '%a' /etc)"

    case "${etc_mode}" in
        755|750|751|755)
            ;;
        *)
            warn "/etc permissions are ${etc_mode}; repairing to 755."
            chmod 755 /etc
            ;;
    esac

    # The config itself should be root-owned and readable.
    chown root:root "${MONGO_CONFIG}"
    chmod 644 "${MONGO_CONFIG}"

    # Restore SELinux context if restorecon exists.
    if command_exists restorecon; then
        restorecon -F "${MONGO_CONFIG}" >/dev/null 2>&1 || true
    fi

    # Ensure the backup is not accidentally executable/world writable.
    if [[ -f "${MONGO_CONFIG_BACKUP}" ]]; then
        chown root:root "${MONGO_CONFIG_BACKUP}"
        chmod 600 "${MONGO_CONFIG_BACKUP}"
        if command_exists restorecon; then
            restorecon -F "${MONGO_CONFIG_BACKUP}" >/dev/null 2>&1 || true
        fi
    fi
}

validate_mongo_config_access() {
    [[ -f "${MONGO_CONFIG}" ]] ||
        die "MongoDB configuration file does not exist."

    [[ "$(stat -c '%U:%G' "${MONGO_CONFIG}")" == "root:root" ]] ||
        die "MongoDB config must be owned by root:root."

    local mode
    mode="$(stat -c '%a' "${MONGO_CONFIG}")"

    [[ "${mode}" == "644" || "${mode}" == "640" ]] ||
        die "MongoDB config permissions are unsafe/unreadable: ${mode}"

    # Check every parent directory in the actual path.
    local dir="/etc"
    local dir_mode
    dir_mode="$(stat -c '%a' "${dir}")"

    # mongod must be able to traverse /etc.
    if ! sudo -u "${MONGOD_USER}" test -x /etc; then
        die "MongoDB service user ${MONGOD_USER} cannot traverse /etc."
    fi

    # And it must be able to read the config.
    if ! sudo -u "${MONGOD_USER}" test -r "${MONGO_CONFIG}"; then
        die "MongoDB service user ${MONGOD_USER} cannot read ${MONGO_CONFIG}."
    fi

    ok "MongoDB config access validated for ${MONGOD_USER}"
}

write_config_atomically() {
    local content_file="$1"
    local tmp

    tmp="$(mktemp "${MONGO_CONFIG}.tmp.XXXXXX")"

    cat "${content_file}" > "${tmp}"

    chown root:root "${tmp}"
    chmod 644 "${tmp}"

    if command_exists restorecon; then
        restorecon -F "${tmp}" >/dev/null 2>&1 || true
    fi

    # Validate before replacing the live config.
    sudo -u "${MONGOD_USER}" test -r "${tmp}" ||
        die "MongoDB service user cannot read temporary configuration."

    mv -f "${tmp}" "${MONGO_CONFIG}"

    chown root:root "${MONGO_CONFIG}"
    chmod 644 "${MONGO_CONFIG}"

    if command_exists restorecon; then
        restorecon -F "${MONGO_CONFIG}" >/dev/null 2>&1 || true
    fi

    validate_mongo_config_access
}

###############################################################################
# AUTH HELPERS
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

    prepare_mongo_config_access
    tmp="$(mktemp "${MONGO_CONFIG}.tmp.XXXXXX")"

    # Replace the complete top-level `security:` block carefully
    awk -v mode="${mode}" '
        BEGIN { in_sec=0; found_sec=0; auth_handled=0 }

        /^[[:space:]]*security:[[:space:]]*$/ {
            print
            in_sec=1
            found_sec=1
            next
        }

        in_sec && /^[^[:space:]#][^:]*:/ {
            if (!auth_handled) print "  authorization: " mode
            in_sec=0
            print
            next
        }

        in_sec && /^[[:space:]]+authorization:[[:space:]]*/ {
            print "  authorization: " mode
            auth_handled=1
            next
        }

        { print }

        END {
            if (in_sec && !auth_handled) {
                print "  authorization: " mode
            } else if (!found_sec) {
                print ""
                print "security:"
                print "  authorization: " mode
            }
        }
    ' "${MONGO_CONFIG}" > "${tmp}"

    chown root:root "${tmp}"
    chmod 644 "${tmp}"

    if command_exists restorecon; then
        restorecon -F "${tmp}" >/dev/null 2>&1 || true
    fi

    # Validate the exact temporary file before it becomes live config.
    sudo -u "${MONGOD_USER}" test -r "${tmp}" || {
        rm -f "${tmp}"
        die "Refusing to replace mongod.conf: ${MONGOD_USER} cannot read temporary config."
    }

    mv -f "${tmp}" "${MONGO_CONFIG}"
    chown root:root "${MONGO_CONFIG}"
    chmod 644 "${MONGO_CONFIG}"

    if command_exists restorecon; then
        restorecon -F "${MONGO_CONFIG}" >/dev/null 2>&1 || true
    fi

    validate_mongo_config_access

    # Verify the requested value is exactly what is present in the live file.
    grep -Eq "^[[:space:]]*security:[[:space:]]*$" "${MONGO_CONFIG}" ||
        die "MongoDB security section is missing after authorization update."

    grep -Eq "^[[:space:]]+authorization:[[:space:]]*${mode}[[:space:]]*$" "${MONGO_CONFIG}" ||
        die "MongoDB authorization could not be set to ${mode}."
}

verify_bootstrap_unauthenticated() {
    # `ping` is deliberately NOT used here because MongoDB permits ping
    # without authentication even when authorization is enabled.
    # listDatabases requires privileges when authorization is enabled.
    if mongosh \
        --quiet \
        --host "${MONGO_HOST}" \
        --port "${MONGO_PORT}" \
        --eval 'const r = db.adminCommand({listDatabases: 1, nameOnly: true}); quit(r.ok === 1 ? 0 : 1)' \
        >/dev/null 2>&1; then
        ok "MongoDB bootstrap instance is accepting unauthenticated admin commands"
        return 0
    fi

    error "MongoDB is still enforcing authentication in bootstrap mode."
    error "Refusing to run dropUser/createUser without authentication."
    echo >&2
    echo "Current authorization configuration:" >&2
    grep -n -A3 -B2 '^[[:space:]]*security:[[:space:]]*$' "${MONGO_CONFIG}" >&2 || true
    return 1
}

###############################################################################
# NETWORK
###############################################################################

configure_mongo_network() {
    local tmp

    prepare_mongo_config_access
    tmp="$(mktemp "${MONGO_CONFIG}.tmp.XXXXXX")"

    awk '
        BEGIN { in_net=0; found_net=0; bind_found=0; port_found=0 }

        /^[[:space:]]*net:[[:space:]]*$/ {
            print "net:"
            in_net=1
            found_net=1
            next
        }

        in_net && /^[^[:space:]#][^:]*:/ {
            if (!bind_found) print "  bindIp: 127.0.0.1"
            if (!port_found) print "  port: 27017"
            in_net=0
            print
            next
        }

        in_net && /^[[:space:]]+bindIp:[[:space:]]*/ {
            print "  bindIp: 127.0.0.1"
            bind_found=1
            next
        }

        in_net && /^[[:space:]]+port:[[:space:]]*/ {
            print "  port: 27017"
            port_found=1
            next
        }

        in_net { print; next }
        { print }

        END {
            if (in_net) {
                if (!bind_found) print "  bindIp: 127.0.0.1"
                if (!port_found) print "  port: 27017"
            }

            if (!found_net) {
                print ""
                print "net:"
                print "  bindIp: 127.0.0.1"
                print "  port: 27017"
            }
        }
    ' "${MONGO_CONFIG}" > "${tmp}"

    chown root:root "${tmp}"
    chmod 644 "${tmp}"

    if command_exists restorecon; then
        restorecon -F "${tmp}" >/dev/null 2>&1 || true
    fi

    if ! sudo -u "${MONGOD_USER}" test -r "${tmp}"; then
        rm -f "${tmp}"
        die "Refusing to install MongoDB network configuration: service user cannot read it."
    fi

    mv -f "${tmp}" "${MONGO_CONFIG}"
    chown root:root "${MONGO_CONFIG}"
    chmod 644 "${MONGO_CONFIG}"

    if command_exists restorecon; then
        restorecon -F "${MONGO_CONFIG}" >/dev/null 2>&1 || true
    fi

    validate_mongo_config_access
}

###############################################################################
# START / STOP
###############################################################################

start_mongo() {
    # NEVER start MongoDB without first validating its config access.
    prepare_mongo_config_access
    validate_mongo_config_access

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

    journalctl -u "${MONGO_SERVICE}" -n 80 --no-pager || true
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
# INITIAL CONFIGURATION
###############################################################################

section "Preparing MongoDB configuration"

[[ -f "${MONGO_CONFIG}" ]] ||
    die "MongoDB config not found: ${MONGO_CONFIG}"

if [[ ! -f "${MONGO_CONFIG_BACKUP}" ]]; then
    cp -a "${MONGO_CONFIG}" "${MONGO_CONFIG_BACKUP}"
    chown root:root "${MONGO_CONFIG_BACKUP}"
    chmod 600 "${MONGO_CONFIG_BACKUP}"
    if command_exists restorecon; then
        restorecon -F "${MONGO_CONFIG_BACKUP}" >/dev/null 2>&1 || true
    fi
    ok "MongoDB configuration backup created"
else
    ok "MongoDB configuration backup already exists"
fi

# THIS IS THE CRITICAL REPAIR.
prepare_mongo_config_access
validate_mongo_config_access

configure_mongo_network

ok "MongoDB configured for ${MONGO_HOST}:${MONGO_PORT}"

AUTH_STATUS="$(get_auth_status)"
echo
echo "MongoDB authorization: ${AUTH_STATUS}"

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
# EXISTING DATABASE URL
###############################################################################

get_database_url() {
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
}

EXISTING_DATABASE_URL="$(get_database_url || true)"
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

###############################################################################
# APP PASSWORD
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
            [[ -n "${EXISTING_APP_PASSWORD}" ]] ||
                die "No existing application password could be extracted from DATABASE_URL."
            APP_PASSWORD="${EXISTING_APP_PASSWORD}"
            PASSWORD_SOURCE="existing"
            ok "Existing application password will be retained"
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
# CONFIRM BOOTSTRAP
###############################################################################

section "MongoDB management-user bootstrap"

echo
echo "The script will perform a controlled MongoDB maintenance restart."
echo
echo "It will:"
echo "  1) Validate/repair MongoDB configuration permissions"
echo "  2) Stop MongoDB"
echo "  3) Temporarily disable authorization"
echo "  4) Start MongoDB locally"
echo "  5) Recreate ${MONGO_MGMT_USER}"
echo "  6) Create/update ${MONGO_APP_USER}"
echo "  7) Stop MongoDB"
echo "  8) Re-enable authorization"
echo "  9) Start MongoDB"
echo " 10) Verify authentication"
echo " 11) Update DATABASE_URL"
echo " 12) Restart/update PM2"
echo
warn "MongoDB will be briefly unavailable during this operation."
echo

read -r -p "Continue? [y/N]: " CONFIRM

case "${CONFIRM}" in
    y|Y|yes|YES) ;;
    *) die "Setup cancelled." ;;
esac

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
# RECOVERY
###############################################################################

RECOVERY_ACTIVE="true"

# One final pre-flight before taking MongoDB down.
prepare_mongo_config_access
validate_mongo_config_access

if ! stop_mongo; then
    journalctl -u "${MONGO_SERVICE}" -n 80 --no-pager || true
    die "Failed to stop MongoDB for controlled bootstrap."
fi

ok "MongoDB stopped"

set_mongo_authorization "disabled"
RECOVERY_CONFIG_CHANGED="true"

ok "MongoDB authorization temporarily disabled"

# Validate before restart.
prepare_mongo_config_access
validate_mongo_config_access

if ! start_mongo; then
    journalctl -u "${MONGO_SERVICE}" -n 100 --no-pager || true
    die "MongoDB failed to start in bootstrap mode."
fi

ok "MongoDB started in bootstrap mode"

# CRITICAL: Do not assume that editing mongod.conf disabled authentication.
# Verify the RUNNING server before attempting any user administration.
if ! verify_bootstrap_unauthenticated; then
    journalctl -u "${MONGO_SERVICE}" -n 100 --no-pager || true
    die "Bootstrap MongoDB is authenticated; refusing user changes."
fi

###############################################################################
# MANAGEMENT USER
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
# APPLICATION USER
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
# RESTORE AUTHORIZATION
###############################################################################

section "Restoring MongoDB authorization"

if ! stop_mongo; then
    journalctl -u "${MONGO_SERVICE}" -n 80 --no-pager || true
    die "Failed to stop MongoDB bootstrap instance."
fi

ok "Bootstrap MongoDB instance stopped"

set_mongo_authorization "enabled"
ok "MongoDB authorization enabled"

# NEVER start without checking config access.
prepare_mongo_config_access
validate_mongo_config_access

if ! start_mongo; then
    journalctl -u "${MONGO_SERVICE}" -n 100 --no-pager || true
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
# VERIFY USERS
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
# LOCAL LISTENING
###############################################################################

if command_exists ss; then
    ss -lnt | grep -Eq "127\.0\.0\.1:${MONGO_PORT}[[:space:]]" ||
        die "MongoDB is not listening on 127.0.0.1:${MONGO_PORT}"
fi

ok "MongoDB is listening on ${MONGO_HOST}:${MONGO_PORT}"

###############################################################################
# DATABASE URL
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

mv -f "${TMP_ENV}" "${ENV_FILE}"

ok "DATABASE_URL updated"

###############################################################################
# ENV VERIFICATION
###############################################################################

FINAL_DATABASE_URL="$(get_database_url || true)"

[[ -n "${FINAL_DATABASE_URL}" ]] ||
    die "DATABASE_URL could not be verified."

[[ "${FINAL_DATABASE_URL}" == mongodb://* ]] ||
    die "DATABASE_URL is not a mongodb:// URL."

chmod 600 "${ENV_FILE}"
chown "${APP_USER}:${APP_USER}" "${ENV_FILE}"

[[ "$(stat -c '%a' "${ENV_FILE}")" =~ 600 ]] ||
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

    process.stdout.write(`export ${key}=${JSON.stringify(value)}\n`);
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
        const app = apps.find(item => item.name === process.env.APP_NAME);
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
        warn "  sudo -u ${APP_USER} pm2 logs${APP_NAME} --lines 50"
    fi
else
    warn "curl is not installed; skipping application health check."
fi

###############################################################################
# FINAL SECURITY CHECK
###############################################################################

section "Security verification"

prepare_mongo_config_access
validate_mongo_config_access

FINAL_AUTH="$(get_auth_status)"

[[ "${FINAL_AUTH}" == "enabled" ]] ||
    die "MongoDB authorization is not enabled."

ok "MongoDB authorization is enabled"

grep -Eq '^[[:space:]]*bindIp:[[:space:]]*127\.0\.0\.1[[:space:]]*$' "${MONGO_CONFIG}" ||
    die "MongoDB bindIp is not verified as 127.0.0.1."

ok "MongoDB is bound only to localhost"

[[ "$(stat -c '%a' "${ENV_FILE}")" =~ 600 ]] ||
    die "Environment file permissions are not 600."

ok "Environment file permissions are 600"

###############################################################################
# SUMMARY
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
echo "  mongod config owner    : root:root"
echo "  mongod config mode     : 644"
echo "  /etc mode              : $(stat -c '%a' /etc)"
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