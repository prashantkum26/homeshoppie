#!/usr/bin/env bash
set -Eeuo pipefail

# =============================================================================
# HomeShoppie - MongoDB Single-Node Replica Set Setup
# Amazon Linux 2023 / MongoDB 8.0
#
# IMPORTANT:
# MongoDB keyFile authentication can cause rs.initiate() to require
# authentication during first-time bootstrap. Therefore, when rs0 is not yet
# initialized, this script temporarily starts mongod WITHOUT the security:
# block, initializes rs0, waits for PRIMARY, then restores the original
# security configuration (keyFile + authorization enabled).
#
# Safe to run repeatedly:
#   - rs.initiate() is only executed when rs0 is not initialized.
#   - Existing security configuration is preserved.
#   - Already initialized rs0 is never bootstrapped again.
# =============================================================================

set +eE
BOOTSTRAP_ACTIVE="false"
ORIGINAL_CONFIG_BACKUP=""
set -eE

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
MONGO_SERVICE="mongod"
MONGO_CONFIG="/etc/mongod.conf"
MONGO_KEYFILE="/etc/mongod-keyfile"

MONGO_HOST="127.0.0.1"
MONGO_PORT="27017"

REPLICA_SET_NAME="rs0"
REPLICA_MEMBER="${MONGO_HOST}:${MONGO_PORT}"

ENV_FILE="/etc/homeshoppie/.env.production"

APP_USER="ec2-user"
APP_NAME="homeshoppie"
APP_DIR="/home/ec2-user/homeshoppie"

MAX_WAIT=90

# -----------------------------------------------------------------------------
# Output
# -----------------------------------------------------------------------------
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

[[ $EUID -eq 0 ]] || die "Run with sudo: sudo ./setup-mongo-replica.sh"
[[ -f "$MONGO_CONFIG" ]] || die "MongoDB config not found: $MONGO_CONFIG"
[[ -f "$ENV_FILE" ]] || die "Environment file not found: $ENV_FILE"
command_exists mongosh || die "mongosh is not installed."
command_exists openssl || die "openssl is not installed."

# -----------------------------------------------------------------------------
# MongoDB service helpers
# -----------------------------------------------------------------------------
wait_for_mongo() {
    local i
    for ((i=1; i<=MAX_WAIT; i++)); do
        if mongosh \
            --quiet \
            --host "$MONGO_HOST" \
            --port "$MONGO_PORT" \
            --eval 'quit(db.runCommand({ping:1}).ok === 1 ? 0 : 1)' \
            >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
    done
    return 1
}

restart_mongo() {
    log "Restarting MongoDB..."
    systemctl restart "$MONGO_SERVICE"

    if ! wait_for_mongo; then
        journalctl -u "$MONGO_SERVICE" -n 100 --no-pager || true
        die "MongoDB failed to start/respond after restart."
    fi

    ok "MongoDB is running"
}

# -----------------------------------------------------------------------------
# Get MongoDB hello without credentials.
#
# db.hello() itself is allowed during both auth-enabled and auth-disabled
# states, so this is suitable for detecting whether the replica set exists.
# -----------------------------------------------------------------------------
get_hello_json() {
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
                    secondary: h.secondary === true,
                    isreplicaset: h.isreplicaset === true,
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
}

is_replica_initialized() {
    local hello="$1"

    HELLO="$hello" \
    REPLICA_SET_NAME="$REPLICA_SET_NAME" \
    REPLICA_MEMBER="$REPLICA_MEMBER" \
    node <<'NODE'
const h = JSON.parse(process.env.HELLO || "{}");

const initialized =
    h.ok === 1 &&
    h.setName === process.env.REPLICA_SET_NAME &&
    Array.isArray(h.hosts) &&
    h.hosts.includes(process.env.REPLICA_MEMBER);

process.exit(initialized ? 0 : 1);
NODE
}

is_primary() {
    local hello="$1"

    HELLO="$hello" \
    REPLICA_SET_NAME="$REPLICA_SET_NAME" \
    REPLICA_MEMBER="$REPLICA_MEMBER" \
    node <<'NODE'
const h = JSON.parse(process.env.HELLO || "{}");

const primary =
    h.ok === 1 &&
    h.setName === process.env.REPLICA_SET_NAME &&
    h.isWritablePrimary === true &&
    Array.isArray(h.hosts) &&
    h.hosts.includes(process.env.REPLICA_MEMBER);

process.exit(primary ? 0 : 1);
NODE
}

# -----------------------------------------------------------------------------
# Config parsing
# -----------------------------------------------------------------------------
get_replset_name_from_config() {
    awk '
        /^[[:space:]]*replication:[[:space:]]*$/ {
            in_replication=1
            next
        }

        in_replication && /^[[:space:]]+replSetName:[[:space:]]*/ {
            value=$2
            gsub(/"/, "", value)
            gsub(/'\''/, "", value)
            print value
            exit
        }

        in_replication && /^[^[:space:]]/ {
            in_replication=0
        }
    ' "$MONGO_CONFIG" | tail -n 1
}

# -----------------------------------------------------------------------------
# Ensure keyFile exists and is secure.
# -----------------------------------------------------------------------------
ensure_keyfile() {
    section "Configuring MongoDB keyFile"

    if [[ ! -f "$MONGO_KEYFILE" ]]; then
        log "Creating MongoDB internal authentication keyFile..."

        umask 077
        openssl rand -base64 756 > "$MONGO_KEYFILE"

        ok "MongoDB keyFile created"
    else
        ok "Existing MongoDB keyFile retained"
    fi

    chown mongod:mongod "$MONGO_KEYFILE"
    chmod 400 "$MONGO_KEYFILE"

    ok "MongoDB keyFile permissions: 400"
    ok "MongoDB keyFile owner: mongod:mongod"
}

# -----------------------------------------------------------------------------
# Configure secure production security block.
#
# This deliberately creates the exact desired security block and removes any
# duplicate top-level security block before adding it.
# -----------------------------------------------------------------------------
ensure_secure_security_config() {
    local tmp
    tmp="$(mktemp)"

    awk '
        BEGIN {
            in_security=0
            security_found=0
        }

        /^[[:space:]]*security:[[:space:]]*$/ {
            if (!security_found) {
                print "security:"
                print "  keyFile: /etc/mongod-keyfile"
                print "  authorization: enabled"
                security_found=1
            }

            in_security=1
            next
        }

        in_security && /^[^[:space:]]/ {
            in_security=0
            print
            next
        }

        in_security {
            next
        }

        {
            print
        }

        END {
            if (!security_found) {
                print ""
                print "security:"
                print "  keyFile: /etc/mongod-keyfile"
                print "  authorization: enabled"
            }
        }
    ' "$MONGO_CONFIG" > "$tmp"

    chown root:root "$tmp"
    chmod 644 "$tmp"
    mv "$tmp" "$MONGO_CONFIG"

    # Exact verification.
    if ! grep -Eq '^security:[[:space:]]*$' "$MONGO_CONFIG"; then
        die "Failed to create MongoDB security block."
    fi

    if ! grep -Eq '^[[:space:]]+keyFile:[[:space:]]*/etc/mongod-keyfile[[:space:]]*$' "$MONGO_CONFIG"; then
        die "MongoDB security.keyFile was not configured correctly."
    fi

    if ! grep -Eq '^[[:space:]]+authorization:[[:space:]]*enabled[[:space:]]*$' "$MONGO_CONFIG"; then
        die "MongoDB authorization was not configured as enabled."
    fi

    ok "MongoDB security configured: keyFile + authorization enabled"
}

# -----------------------------------------------------------------------------
# Configure replica set.
# -----------------------------------------------------------------------------
ensure_replica_config() {
    section "Configuring replica set"

    local current
    current="$(get_replset_name_from_config || true)"

    if [[ -n "$current" && "$current" != "$REPLICA_SET_NAME" ]]; then
        die "MongoDB already uses replica set '$current', not '$REPLICA_SET_NAME'."
    fi

    if [[ "$current" == "$REPLICA_SET_NAME" ]]; then
        ok "MongoDB is already configured for replica set $REPLICA_SET_NAME"
        return
    fi

    cp -a "$MONGO_CONFIG" "${MONGO_CONFIG}.before-${REPLICA_SET_NAME}" || true

    if grep -Eq '^[[:space:]]*replication:[[:space:]]*$' "$MONGO_CONFIG"; then
        if grep -Eq '^[[:space:]]+replSetName:[[:space:]]*' "$MONGO_CONFIG"; then
            sed -i -E \
                "s|^[[:space:]]+replSetName:[[:space:]]*.*$|  replSetName: ${REPLICA_SET_NAME}|" \
                "$MONGO_CONFIG"
        else
            sed -i \
                "/^[[:space:]]*replication:[[:space:]]*$/a\\  replSetName: ${REPLICA_SET_NAME}" \
                "$MONGO_CONFIG"
        fi
    else
        cat >> "$MONGO_CONFIG" <<EOF

replication:
  replSetName: ${REPLICA_SET_NAME}
EOF
    fi

    ok "Added replication.replSetName: $REPLICA_SET_NAME"
}

# -----------------------------------------------------------------------------
# FIRST-BOOTSTRAP METHOD
#
# We do NOT try to toggle authorization while keyFile remains configured.
# Instead:
#
#   1. Save the exact production config.
#   2. Remove the entire security block from mongod.conf.
#   3. Restart mongod.
#   4. Verify unauthenticated admin access really works.
#   5. rs.initiate().
#   6. Wait for PRIMARY.
#   7. Restore the exact production config.
#   8. Restart mongod.
#
# This directly avoids the "replSetInitiate requires authentication" problem.
# -----------------------------------------------------------------------------
create_bootstrap_config() {
    section "Preparing unauthenticated replica-set bootstrap"

    ORIGINAL_CONFIG_BACKUP="$(mktemp)"

    cp -a "$MONGO_CONFIG" "$ORIGINAL_CONFIG_BACKUP"

    local tmp
    tmp="$(mktemp)"

    awk '
        BEGIN {
            in_security=0
        }

        /^[[:space:]]*security:[[:space:]]*$/ {
            in_security=1
            next
        }

        in_security && /^[^[:space:]]/ {
            in_security=0
            print
            next
        }

        in_security {
            next
        }

        {
            print
        }
    ' "$MONGO_CONFIG" > "$tmp"

    chown root:root "$tmp"
    chmod 644 "$tmp"
    mv "$tmp" "$MONGO_CONFIG"

    if grep -Eq '^[[:space:]]*security:[[:space:]]*$' "$MONGO_CONFIG"; then
        die "Bootstrap config still contains a security block."
    fi

    ok "Temporarily removed MongoDB security block for rs.initiate()"

    BOOTSTRAP_ACTIVE="true"

    restart_mongo
}

verify_bootstrap_is_unauthenticated() {
    section "Verifying bootstrap authentication state"

    local result

    result="$(
        mongosh \
            --quiet \
            --host "$MONGO_HOST" \
            --port "$MONGO_PORT" \
            --eval '
                try {
                    const r = db.getSiblingDB("admin").runCommand({
                        connectionStatus: 1,
                        showPrivileges: false
                    });

                    const users =
                        r.authInfo &&
                        Array.isArray(r.authInfo.authenticatedUsers)
                            ? r.authInfo.authenticatedUsers
                            : [];

                    print(JSON.stringify({
                        ok: r.ok === 1,
                        authenticatedUsers: users.length
                    }));

                    quit(r.ok === 1 && users.length === 0 ? 0 : 1);
                } catch (e) {
                    print(JSON.stringify({
                        ok: 0,
                        error: e.message || String(e)
                    }));
                    quit(1);
                }
            ' 2>/dev/null | tail -n 1
    )" || {
        error "MongoDB still requires authentication."
        error "Bootstrap was stopped before rs.initiate()."
        return 1
    }

    if [[ "$result" != *'"authenticatedUsers":0'* ]]; then
        error "Unexpected authentication state: $result"
        return 1
    fi

    ok "MongoDB accepts unauthenticated bootstrap commands"
}

restore_secure_config() {
    section "Restoring secure MongoDB configuration"

    [[ -n "$ORIGINAL_CONFIG_BACKUP" ]] || \
        die "Original MongoDB config backup is missing."

    cp -a "$ORIGINAL_CONFIG_BACKUP" "$MONGO_CONFIG"

    rm -f "$ORIGINAL_CONFIG_BACKUP"
    ORIGINAL_CONFIG_BACKUP=""

    BOOTSTRAP_ACTIVE="false"

    ok "Original MongoDB security configuration restored"

    # Make absolutely sure the desired production configuration is present.
    ensure_keyfile
    ensure_secure_security_config

    restart_mongo
}

# -----------------------------------------------------------------------------
# Cleanup on error/interruption.
# -----------------------------------------------------------------------------
cleanup() {
    local rc=$?

    if [[ "$BOOTSTRAP_ACTIVE" == "true" ]]; then
        warn "Bootstrap did not complete. Restoring secure MongoDB configuration..."

        if [[ -n "$ORIGINAL_CONFIG_BACKUP" && -f "$ORIGINAL_CONFIG_BACKUP" ]]; then
            cp -a "$ORIGINAL_CONFIG_BACKUP" "$MONGO_CONFIG" || true
            rm -f "$ORIGINAL_CONFIG_BACKUP" || true
            ORIGINAL_CONFIG_BACKUP=""
        fi

        BOOTSTRAP_ACTIVE="false"

        systemctl restart "$MONGO_SERVICE" >/dev/null 2>&1 || true

        if wait_for_mongo; then
            ok "MongoDB secure configuration restored"
        else
            error "MongoDB did not become reachable after cleanup."
        fi
    fi

    exit "$rc"
}

trap cleanup EXIT INT TERM

# -----------------------------------------------------------------------------
# MAIN
# -----------------------------------------------------------------------------
section "Checking MongoDB"

systemctl enable "$MONGO_SERVICE" >/dev/null 2>&1 || true

if ! systemctl is-active --quiet "$MONGO_SERVICE"; then
    log "MongoDB is stopped. Starting..."
    systemctl start "$MONGO_SERVICE"
fi

wait_for_mongo || die "MongoDB is not responding."

ok "MongoDB is running"

section "Preparing MongoDB configuration"

ensure_keyfile
ensure_secure_security_config
ensure_replica_config

# Restart using the production configuration before checking replica state.
restart_mongo

section "Checking replica-set state"

HELLO="$(get_hello_json || true)"

[[ -n "$HELLO" ]] || die "Unable to query MongoDB hello status."

echo "$HELLO"

if is_replica_initialized "$HELLO"; then

    ok "Replica set $REPLICA_SET_NAME is already initialized"

else

    log "Replica set $REPLICA_SET_NAME is NOT initialized yet."

    create_bootstrap_config

    verify_bootstrap_is_unauthenticated || \
        die "MongoDB authentication could not be disabled for bootstrap."

    section "Initializing replica set"

    log "Running rs.initiate()..."

    mongosh \
        --quiet \
        --host "$MONGO_HOST" \
        --port "$MONGO_PORT" \
        --eval "
            const cfg = {
                _id: '${REPLICA_SET_NAME}',
                members: [
                    {
                        _id: 0,
                        host: '${REPLICA_MEMBER}'
                    }
                ]
            };

            printjson(rs.initiate(cfg));
        "

    ok "rs.initiate() completed"

    section "Waiting for PRIMARY"

    PRIMARY="false"

    for ((i=1; i<=MAX_WAIT; i++)); do
        CURRENT_HELLO="$(get_hello_json || true)"

        if [[ -n "$CURRENT_HELLO" ]] && is_primary "$CURRENT_HELLO"; then
            PRIMARY="true"
            break
        fi

        sleep 1
    done

    [[ "$PRIMARY" == "true" ]] || {
        error "Replica set did not become PRIMARY within ${MAX_WAIT}s."
        journalctl -u "$MONGO_SERVICE" -n 100 --no-pager || true
        die "Replica-set bootstrap failed."
    }

    ok "MongoDB replica set is PRIMARY"

    # Restore keyFile + authorization enabled.
    restore_secure_config

fi

# -----------------------------------------------------------------------------
# Final PRIMARY verification
# -----------------------------------------------------------------------------
section "Final replica-set verification"

FINAL_HELLO="$(get_hello_json || true)"

[[ -n "$FINAL_HELLO" ]] || die "Unable to read final MongoDB hello status."

echo "$FINAL_HELLO"

if ! is_primary "$FINAL_HELLO"; then
    journalctl -u "$MONGO_SERVICE" -n 100 --no-pager || true
    die "MongoDB is not PRIMARY."
fi

ok "MongoDB is PRIMARY"

FINAL_HOSTS="$(
    HELLO="$FINAL_HELLO" node <<'NODE'
const h = JSON.parse(process.env.HELLO || "{}");
console.log(Array.isArray(h.hosts) ? h.hosts.join("\n") : "");
NODE
)"

if ! grep -Fxq "$REPLICA_MEMBER" <<< "$FINAL_HOSTS"; then
    die "Replica member $REPLICA_MEMBER was not reported by MongoDB."
fi

HOST_COUNT="$(grep -c . <<< "$FINAL_HOSTS" || true)"

[[ "$HOST_COUNT" == "1" ]] || \
    die "Expected exactly one replica-set member, found $HOST_COUNT."

ok "Replica set $REPLICA_SET_NAME has exactly one member: $REPLICA_MEMBER"

# -----------------------------------------------------------------------------
# Update DATABASE_URL
# -----------------------------------------------------------------------------
section "Updating DATABASE_URL"

CURRENT_DATABASE_URL="$(
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
    break;
}
NODE
)"

[[ -n "$CURRENT_DATABASE_URL" ]] || \
    die "DATABASE_URL not found in $ENV_FILE"

NEW_DATABASE_URL="$(
    DATABASE_URL="$CURRENT_DATABASE_URL" \
    REPLICA_SET_NAME="$REPLICA_SET_NAME" \
    node <<'NODE'
try {
    const u = new URL(process.env.DATABASE_URL);

    if (u.protocol !== "mongodb:" && u.protocol !== "mongodb+srv:") {
        throw new Error("DATABASE_URL is not a MongoDB URL");
    }

    u.searchParams.set("replicaSet", process.env.REPLICA_SET_NAME);

    process.stdout.write(u.toString());
} catch (e) {
    console.error(e.message);
    process.exit(1);
}
NODE
)"

TMP_ENV="$(mktemp)"

awk -v new_url="$NEW_DATABASE_URL" '
BEGIN {
    found = 0
}

/^[[:space:]]*DATABASE_URL[[:space:]]*=/ {
    if (!found) {
        print "DATABASE_URL=\"" new_url "\""
        found = 1
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
' "$ENV_FILE" > "$TMP_ENV"

chown "$APP_USER:$APP_USER" "$TMP_ENV"
chmod 600 "$TMP_ENV"
mv "$TMP_ENV" "$ENV_FILE"

REPLICA_FROM_URL="$(
    DATABASE_URL="$NEW_DATABASE_URL" \
    node -e '
        const u = new URL(process.env.DATABASE_URL);
        console.log(u.searchParams.get("replicaSet") || "");
    '
)"

[[ "$REPLICA_FROM_URL" == "$REPLICA_SET_NAME" ]] || \
    die "DATABASE_URL replicaSet verification failed."

ok "DATABASE_URL contains replicaSet=$REPLICA_SET_NAME"

# -----------------------------------------------------------------------------
# Environment security
# -----------------------------------------------------------------------------
section "Checking environment security"

ENV_OWNER="$(stat -c '%U:%G' "$ENV_FILE")"
ENV_MODE="$(stat -c '%a' "$ENV_FILE")"

[[ "$ENV_OWNER" == "$APP_USER:$APP_USER" ]] || \
    die "$ENV_FILE owner must be $APP_USER:$APP_USER. Current: $ENV_OWNER"

[[ "$ENV_MODE" == "600" ]] || \
    die "$ENV_FILE permissions must be 600. Current: $ENV_MODE"

ok "Environment file owner: $ENV_OWNER"
ok "Environment file permissions: $ENV_MODE"

# -----------------------------------------------------------------------------
# Verify production MongoDB security configuration
# -----------------------------------------------------------------------------
section "Checking MongoDB security"

if ! grep -Eq '^[[:space:]]+keyFile:[[:space:]]*/etc/mongod-keyfile[[:space:]]*$' "$MONGO_CONFIG"; then
    die "MongoDB keyFile is not configured."
fi

if ! grep -Eq '^[[:space:]]+authorization:[[:space:]]*enabled[[:space:]]*$' "$MONGO_CONFIG"; then
    die "MongoDB authorization is not enabled."
fi

[[ "$(stat -c '%U:%G' "$MONGO_KEYFILE")" == "mongod:mongod" ]] || \
    die "MongoDB keyFile owner is incorrect."

[[ "$(stat -c '%a' "$MONGO_KEYFILE")" == "400" ]] || \
    die "MongoDB keyFile permissions must be 400."

ok "MongoDB keyFile and authorization configuration verified"

# -----------------------------------------------------------------------------
# PM2
# -----------------------------------------------------------------------------
section "Restarting HomeShoppie PM2"

if command_exists pm2; then
    sudo -u "$APP_USER" -H bash -s -- "$APP_NAME" "$APP_DIR" <<'PM2_SCRIPT'
set -Eeuo pipefail

APP_NAME="$1"
APP_DIR="$2"

cd "$APP_DIR"

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    pm2 restart "$APP_NAME" --update-env
    pm2 save
    echo "[OK] PM2 application restarted"
else
    echo "[WARN] PM2 app '$APP_NAME' is not registered; skipping restart."
fi
PM2_SCRIPT
else
    warn "PM2 is not installed; skipping PM2 restart."
fi

# -----------------------------------------------------------------------------
# Final summary
# -----------------------------------------------------------------------------
section "Final verification"

FINAL_HELLO="$(get_hello_json || true)"

if ! is_primary "$FINAL_HELLO"; then
    die "Final MongoDB PRIMARY verification failed."
fi

echo "MongoDB hello:"
echo "$FINAL_HELLO"

echo
echo "============================================================"
ok "MongoDB replica-set setup completed successfully"
echo "============================================================"
echo "  MongoDB     : ${MONGO_HOST}:${MONGO_PORT}"
echo "  Replica set : ${REPLICA_SET_NAME}"
echo "  Member      : ${REPLICA_MEMBER}"
echo "  State       : PRIMARY"
echo "  Environment : ${ENV_FILE}"
echo
echo "Next step:"
echo "  cd ${APP_DIR}"
echo "  set -a"
echo "  source ${ENV_FILE}"
echo "  set +a"
echo "  npm run db:seed"
echo

exit 0
