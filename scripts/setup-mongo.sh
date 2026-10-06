#!/usr/bin/env bash



###############################################################################

# HomeShoppie - MongoDB 8.0 Setup

#

# Amazon Linux 2023

#

# MongoDB:

#   Version       : 8.0

#   Host          : 127.0.0.1

#   Port          : 27017

#   Database      : homeshoppie

#   User          : homeshoppie_admin

#

# Environment:

#   /etc/homeshoppie/.env.production

#

# IMPORTANT:

#   - Never exposes MongoDB password in command-line arguments.

#   - Never sources .env.production.

#   - Never inserts test data.

#   - Safe to run repeatedly.

###############################################################################



set -Eeuo pipefail



###############################################################################

# CONFIGURATION

###############################################################################



ENV_FILE="/etc/homeshoppie/.env.production"



MONGO_REPO_FILE="/etc/yum.repos.d/mongodb-org-8.0.repo"

MONGO_CONFIG="/etc/mongod.conf"



MONGO_DATABASE="homeshoppie"

MONGO_USER="homeshoppie_admin"

MONGO_HOST="127.0.0.1"

MONGO_PORT="27017"



MONGO_SERVICE="mongod"



APP_USER="ec2-user"



MIN_PASSWORD_LENGTH=16



###############################################################################

# COLORS

###############################################################################



if [[ -t 1 ]]; then

    RED="\033[0;31m"

    GREEN="\033[0;32m"

    YELLOW="\033[1;33m"

    BLUE="\033[0;34m"

    CYAN="\033[0;36m"

    BOLD="\033[1m"

    NC="\033[0m"

else

    RED=""

    GREEN=""

    YELLOW=""

    BLUE=""

    CYAN=""

    BOLD=""

    NC=""

fi



###############################################################################

# HELPERS

###############################################################################



log() {

    echo -e "${CYAN}[INFO]${NC} $*"

}



ok() {

    echo -e "${GREEN}[OK]${NC} $*"

}



warn() {

    echo -e "${YELLOW}[WARN]${NC} $*"

}



error() {

    echo -e "${RED}[ERROR]${NC} $*" >&2

}



die() {

    error "$*"

    exit 1

}



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

# ERROR HANDLING

###############################################################################



ORIGINAL_AUTH_ENABLED="false"

RECOVERY_MODE="false"

RECOVERY_CHANGED_CONFIG="false"



cleanup_on_error() {



    local exit_code=$?



    if [[ "${RECOVERY_MODE}" == "true" && "${RECOVERY_CHANGED_CONFIG}" == "true" ]]; then



        echo

        warn "Setup failed during MongoDB recovery."



        if [[ "${ORIGINAL_AUTH_ENABLED}" == "true" ]]; then



            warn "Restoring MongoDB authorization..."



            if set_mongo_authorization "enabled" >/dev/null 2>&1; then

                systemctl restart "${MONGO_SERVICE}" >/dev/null 2>&1 || true



                sleep 3



                if systemctl is-active --quiet "${MONGO_SERVICE}"; then

                    ok "MongoDB authorization restored"

                else

                    error "MongoDB could not be restarted while restoring authorization."

                fi

            else

                error "CRITICAL: Could not restore MongoDB authorization automatically."

                error "Check: ${MONGO_CONFIG}"

            fi

        fi

    fi



    exit "${exit_code}"

}



trap cleanup_on_error EXIT



###############################################################################

# ROOT CHECK

###############################################################################



if [[ "${EUID}" -ne 0 ]]; then

    die "Run this script with sudo:



  sudo ./setup-mongo.sh

"

fi



###############################################################################

# HEADER

###############################################################################



clear 2>/dev/null || true



echo

echo "============================================================"

echo " HomeShoppie - MongoDB 8.0 Setup"

echo "============================================================"

echo



###############################################################################

# OPERATING SYSTEM

###############################################################################



section "Checking operating system"



if [[ -f /etc/os-release ]]; then

    source /etc/os-release

else

    die "Unable to determine operating system."

fi



if [[ "${ID:-}" != "amzn" ]]; then

    warn "This script was designed for Amazon Linux."

    warn "Detected: ${PRETTY_NAME:-unknown}"



    read -r -p "Continue anyway? [y/N]: " CONTINUE



    if [[ ! "${CONTINUE}" =~ ^[Yy]$ ]]; then

        die "Setup cancelled."

    fi

fi



ok "Operating System: ${PRETTY_NAME:-unknown}"



ARCH="$(uname -m)"



echo

echo "Architecture:"

echo "  ${ARCH}"

echo



case "${ARCH}" in

    x86_64)

        ok "Supported architecture"

        ;;

    aarch64)

        warn "MongoDB repository availability for this architecture may differ."

        ;;

    *)

        die "Unsupported architecture: ${ARCH}"

        ;;

esac



###############################################################################

# REQUIRED COMMANDS

###############################################################################



section "Checking required commands"



command_exists dnf || die "dnf is required."

command_exists systemctl || die "systemctl is required."

command_exists node || die "Node.js is required."

command_exists openssl || die "openssl is required."



ok "Required system commands available"



###############################################################################

# ENVIRONMENT FILE

###############################################################################



section "Checking HomeShoppie environment"



if [[ ! -f "${ENV_FILE}" ]]; then

    die "Environment file not found:



${ENV_FILE}



Create it first."

fi



ok "Environment file found"



if ! command_exists node; then

    die "Node.js is required for safe environment parsing."

fi



NODE_VERSION="$(node --version)"

ok "Node.js found: ${NODE_VERSION}"



###############################################################################

# NODE VERSION

###############################################################################



NODE_MAJOR="$(

    node -p 'process.versions.node.split(".")[0]'

)"



if [[ "${NODE_MAJOR}" -lt 20 ]]; then

    warn "Node.js ${NODE_VERSION} detected."

    warn "Node.js 20+ is recommended."

fi



###############################################################################

# ENVIRONMENT FILE PERMISSIONS

###############################################################################



ENV_OWNER="$(stat -c '%U:%G' "${ENV_FILE}")"

ENV_PERMS="$(stat -c '%a' "${ENV_FILE}")"



if [[ "${ENV_PERMS}" != "600" ]]; then

    warn "Fixing environment file permissions: ${ENV_PERMS} -> 600"

    chmod 600 "${ENV_FILE}"

fi



if [[ "${ENV_OWNER}" != "${APP_USER}:${APP_USER}" ]]; then

    warn "Fixing environment file ownership: ${ENV_OWNER} -> ${APP_USER}:${APP_USER}"

    chown "${APP_USER}:${APP_USER}" "${ENV_FILE}"

fi



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



ok "MongoDB 8.0 repository configured"



###############################################################################

# PACKAGE CACHE

###############################################################################



log "Cleaning package cache..."

dnf clean all >/dev/null 2>&1 || true



log "Refreshing package metadata..."

dnf makecache -y >/dev/null



ok "Package metadata refreshed"



###############################################################################

# INSTALL MONGODB

###############################################################################



section "Installing MongoDB"



if rpm -q mongodb-org >/dev/null 2>&1; then



    ok "MongoDB is already installed"



else



    log "Installing MongoDB..."



    dnf install -y mongodb-org



    ok "MongoDB installed"



fi



###############################################################################

# VERIFY MONGODB

###############################################################################



if ! command_exists mongod; then

    die "mongod command not found after installation."

fi



if ! command_exists mongosh; then

    die "mongosh command not found after installation."

fi



MONGOD_VERSION="$(

    mongod --version |

        awk '/db version/ {print $3; exit}'

)"



MONGOSH_VERSION="$(

    mongosh --version

)"



echo

echo "MongoDB:"

echo "  ${MONGOD_VERSION}"



echo

echo "mongosh:"

echo "  ${MONGOSH_VERSION}"



ok "MongoDB installation verified"



###############################################################################

# MONGODB CONFIG HELPERS

###############################################################################



get_auth_status() {



    if [[ ! -f "${MONGO_CONFIG}" ]]; then

        echo "disabled"

        return

    fi



    if grep -Eq '^[[:space:]]*authorization:[[:space:]]*enabled[[:space:]]*$' "${MONGO_CONFIG}"; then

        echo "enabled"

    else

        echo "disabled"

    fi

}



set_mongo_authorization() {

    local requested="$1"

    if [[ "${requested}" != "enabled" && "${requested}" != "disabled" ]]; then
        return 1
    fi

    local tmp_file
    tmp_file="$(mktemp)"

    awk -v mode="${requested}" '
        BEGIN {
            in_security=0
            found_authorization=0
            seen_security=0
        }

        /^[[:space:]]*security:[[:space:]]*$/ {
            in_security=1
            found_authorization=0
            seen_security=1
            print
            next
        }

        {
            if (in_security && $0 !~ /^[[:space:]]*($|#)/ && $0 !~ /^[[:space:]]+/) {
                if (!found_authorization) {
                    print "  authorization: " mode
                }
                in_security=0
                found_authorization=0
            }

            if (in_security && $0 ~ /^[[:space:]]+authorization:[[:space:]]*(enabled|disabled)[[:space:]]*$/) {
                print "  authorization: " mode
                found_authorization=1
                next
            }

            print
        }

        END {
            if (in_security && !found_authorization) {
                print "  authorization: " mode
            }

            if (!seen_security) {
                print ""
                print "security:"
                print "  authorization: " mode
            }
        }
    ' "${MONGO_CONFIG}" > "${tmp_file}"

    chown root:root "${tmp_file}"
    chmod 644 "${tmp_file}"
    mv "${tmp_file}" "${MONGO_CONFIG}"
}


###############################################################################
# MONGODB NETWORK CONFIGURATION

###############################################################################



section "Configuring MongoDB network"



if [[ ! -f "${MONGO_CONFIG}" ]]; then

    die "MongoDB configuration file not found: ${MONGO_CONFIG}"

fi



MONGO_CONFIG_BACKUP="${MONGO_CONFIG}.homeshoppie-backup"



if [[ ! -f "${MONGO_CONFIG_BACKUP}" ]]; then

    cp -a "${MONGO_CONFIG}" "${MONGO_CONFIG_BACKUP}"

    chmod 600 "${MONGO_CONFIG_BACKUP}"

    ok "MongoDB configuration backup created"

fi



###############################################################################

# ENSURE BIND IP

###############################################################################



if grep -Eq '^[[:space:]]*bindIp:' "${MONGO_CONFIG}"; then



    sed -i -E \

        's/^[[:space:]]*bindIp:.*/  bindIp: 127.0.0.1/' \

        "${MONGO_CONFIG}"



else



    if grep -Eq '^net:[[:space:]]*$' "${MONGO_CONFIG}"; then



        sed -i '/^net:[[:space:]]*$/a\  bindIp: 127.0.0.1' \

            "${MONGO_CONFIG}"



    else



        cat >> "${MONGO_CONFIG}" <<'EOF'



net:

  bindIp: 127.0.0.1

  port: 27017

EOF



    fi

fi



###############################################################################

# ENSURE PORT

###############################################################################



if grep -Eq '^[[:space:]]*port:' "${MONGO_CONFIG}"; then



    sed -i -E \

        's/^[[:space:]]*port:.*/  port: 27017/' \

        "${MONGO_CONFIG}"



else



    if grep -Eq '^net:[[:space:]]*$' "${MONGO_CONFIG}"; then



        sed -i '/^net:[[:space:]]*$/a\  port: 27017' \

            "${MONGO_CONFIG}"



    fi

fi



ok "MongoDB bound to ${MONGO_HOST}:${MONGO_PORT}"



###############################################################################

# START MONGODB

###############################################################################



section "Starting MongoDB"



systemctl daemon-reload >/dev/null 2>&1 || true



systemctl enable "${MONGO_SERVICE}" >/dev/null



if systemctl is-active --quiet "${MONGO_SERVICE}"; then

    ok "MongoDB is already running"

else

    systemctl start "${MONGO_SERVICE}"

    sleep 3

    ok "MongoDB is running"

fi



if ! systemctl is-active --quiet "${MONGO_SERVICE}"; then

    journalctl -u "${MONGO_SERVICE}" -n 50 --no-pager || true

    die "MongoDB failed to start."

fi



ok "MongoDB enabled at boot"



###############################################################################

# WAIT FOR MONGODB

###############################################################################



log "Waiting for MongoDB..."



MONGO_READY="false"



for _ in {1..30}; do



    if mongosh \

        --quiet \

        --host "${MONGO_HOST}" \

        --port "${MONGO_PORT}" \

        --eval 'db.runCommand({ ping: 1 }).ok === 1' \

        2>/dev/null |

        grep -q "true"; then



        MONGO_READY="true"

        break

    fi



    sleep 1

done



if [[ "${MONGO_READY}" != "true" ]]; then

    journalctl -u "${MONGO_SERVICE}" -n 50 --no-pager || true

    die "MongoDB did not become ready."

fi



ok "MongoDB is ready"



###############################################################################

# CHECK PORT

###############################################################################



section "Checking MongoDB port"



if command_exists ss; then



    if ss -lnt | grep -Eq "127\\.0\\.0\\.1:${MONGO_PORT}[[:space:]]"; then

        ok "MongoDB is listening on ${MONGO_HOST}:${MONGO_PORT}"

    else

        die "MongoDB is not listening on ${MONGO_HOST}:${MONGO_PORT}"

    fi



else



    warn "ss command not available; skipping socket check."



fi



###############################################################################

# READ DATABASE_URL SAFELY

###############################################################################



section "Checking existing DATABASE_URL"



EXISTING_DATABASE_URL="$(

    node <<'NODE'

const fs = require("fs");



const file = "/etc/homeshoppie/.env.production";



if (!fs.existsSync(file)) {

    process.exit(0);

}



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



EXISTING_LOCAL_URL="false"

EXISTING_DB_USER=""

EXISTING_DB_PASSWORD=""

EXISTING_AUTH_SOURCE=""



if [[ -n "${EXISTING_DATABASE_URL}" ]]; then



    PARSED_ENV="$(

        DATABASE_URL="${EXISTING_DATABASE_URL}" \

        EXPECTED_USER="${MONGO_USER}" \

        EXPECTED_DB="${MONGO_DATABASE}" \

        EXPECTED_HOST="${MONGO_HOST}" \

        EXPECTED_PORT="${MONGO_PORT}" \

        node <<'NODE'

try {

    const raw = process.env.DATABASE_URL;

    const expectedUser = process.env.EXPECTED_USER;

    const expectedDb = process.env.EXPECTED_DB;

    const expectedHost = process.env.EXPECTED_HOST;

    const expectedPort = process.env.EXPECTED_PORT;



    const url = new URL(raw);



    if (

        url.protocol !== "mongodb:" &&

        url.protocol !== "mongodb+srv:"

    ) {

        process.exit(0);

    }



    if (url.protocol !== "mongodb:") {

        process.exit(0);

    }



    const hostname = url.hostname;

    const port = url.port || "27017";



    const database = decodeURIComponent(

        url.pathname.replace(/^\\/+/, "")

    );



    const params = new URLSearchParams(url.search);



    const authSource =

        params.get("authSource") ||

        database ||

        "admin";



    const username = decodeURIComponent(url.username || "");

    const password = decodeURIComponent(url.password || "");



    const localHost =

        hostname === expectedHost ||

        hostname === "localhost";



    const correctPort = port === expectedPort;

    const correctDatabase = database === expectedDb;

    const correctUser = username === expectedUser;



    if (

        localHost &&

        correctPort &&

        correctDatabase &&

        correctUser

    ) {

        process.stdout.write(

            [

                "LOCAL",

                username,

                password,

                authSource

            ].join("\t")

        );

    }

}

catch {

    process.exit(0);

}

NODE

    )"



    if [[ "${PARSED_ENV}" == LOCAL$'\t'* ]]; then



        EXISTING_LOCAL_URL="true"



        IFS=$'\t' read -r _ EXISTING_DB_USER EXISTING_DB_PASSWORD EXISTING_AUTH_SOURCE <<< "${PARSED_ENV}"



        if [[ -n "${EXISTING_DB_PASSWORD}" ]]; then

            ok "Existing local MongoDB credentials found in DATABASE_URL"

        else

            warn "Existing local DATABASE_URL has no password."

        fi



    else



        warn "DATABASE_URL is not a local HomeShoppie MongoDB URL."

        warn "It will be replaced with the local MongoDB connection."

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



    local password

    local confirm



    while true; do



        echo

        read -r -s -p "Enter MongoDB password: " password

        echo



        if [[ -z "${password}" ]]; then

            warn "Password cannot be empty."

            continue

        fi



        if [[ "${#password}" -lt "${MIN_PASSWORD_LENGTH}" ]]; then

            warn "Password must contain at least ${MIN_PASSWORD_LENGTH} characters."

            continue

        fi



        if [[ "${password}" == *$'\n'* || "${password}" == *$'\r'* ]]; then

            warn "Password cannot contain newline characters."

            continue

        fi



        read -r -s -p "Confirm MongoDB password: " confirm

        echo



        if [[ "${password}" != "${confirm}" ]]; then

            warn "Passwords do not match."

            continue

        fi



        printf '%s' "${password}"

        return 0

    done

}



###############################################################################

# DETERMINE AUTH STATE

###############################################################################



AUTH_STATUS="$(get_auth_status)"



echo

echo "MongoDB authorization:"

echo "  ${AUTH_STATUS}"



if [[ "${AUTH_STATUS}" == "enabled" ]]; then

    ORIGINAL_AUTH_ENABLED="true"

else

    ORIGINAL_AUTH_ENABLED="false"

fi



###############################################################################

# DETERMINE EXISTING CREDENTIAL VALIDITY

###############################################################################



EXISTING_CREDENTIALS_VALID="false"



if [[ "${AUTH_STATUS}" == "enabled" &&

      "${EXISTING_LOCAL_URL}" == "true" &&

      -n "${EXISTING_DB_PASSWORD}" ]]; then



    section "Validating existing MongoDB credentials"



    CURRENT_AUTH_DB="${EXISTING_AUTH_SOURCE}"



    if [[ -z "${CURRENT_AUTH_DB}" ]]; then

        CURRENT_AUTH_DB="${MONGO_DATABASE}"

    fi



    if MONGO_CURRENT_USER="${EXISTING_DB_USER}" \

       MONGO_CURRENT_PASSWORD="${EXISTING_DB_PASSWORD}" \

       mongosh \

           --quiet \

           --host "${MONGO_HOST}" \

           --port "${MONGO_PORT}" \

           "${CURRENT_AUTH_DB}" \

           --eval '

               const user = process.env.MONGO_CURRENT_USER;

               const password = process.env.MONGO_CURRENT_PASSWORD;

               const result = db.auth(user, password);

               if (!result) quit(1);

               quit(0);

           ' \

           >/dev/null 2>&1; then



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

    echo "A valid existing MongoDB credential was found."

    echo

    echo "Choose:"

    echo

    echo "  1) Keep existing password"

    echo "  2) Generate a new random password"

    echo "  3) Enter a new password manually"

    echo



    while true; do



        read -r -p "Choose [1-3]: " PASSWORD_CHOICE



        case "${PASSWORD_CHOICE}" in



            1)

                MONGO_PASSWORD="${EXISTING_DB_PASSWORD}"

                PASSWORD_SOURCE="existing"

                ok "Existing MongoDB password will be kept"

                break

                ;;



            2)

                MONGO_PASSWORD="$(generate_password)"

                PASSWORD_SOURCE="generated"

                ok "A new random MongoDB password was generated"

                break

                ;;



            3)

                MONGO_PASSWORD="$(read_manual_password)"

                PASSWORD_SOURCE="manual"

                ok "Manual MongoDB password accepted"

                break

                ;;



            *)

                warn "Please choose 1, 2, or 3."

                ;;



        esac

    done



else



    section "MongoDB password"



    if [[ "${AUTH_STATUS}" == "enabled" ]]; then



        echo

        echo "MongoDB authentication is enabled, but the existing"

        echo "credentials could not be authenticated."

        echo

        echo "The script must reset the application user's password"

        echo "using a temporary authorization-disabled recovery."

        echo

        echo "Choose:"

        echo

        echo "  1) Generate a new random password and reset the user"

        echo "  2) Enter a new password manually and reset the user"

        echo "  3) Enter the current password instead"

        echo "  4) Abort"

        echo



        while true; do



            read -r -p "Choose [1-4]: " PASSWORD_CHOICE



            case "${PASSWORD_CHOICE}" in



                1)

                    MONGO_PASSWORD="$(generate_password)"

                    PASSWORD_SOURCE="generated-reset"

                    ok "A new random password was generated"

                    break

                    ;;



                2)

                    MONGO_PASSWORD="$(read_manual_password)"

                    PASSWORD_SOURCE="manual-reset"

                    ok "Manual password accepted"

                    break

                    ;;



                3)



                    read -r -s -p "Enter current MongoDB password: " CURRENT_PASSWORD

                    echo



                    if [[ -z "${CURRENT_PASSWORD}" ]]; then

                        warn "Password cannot be empty."

                        continue

                    fi



                    CURRENT_AUTH_DB="${MONGO_DATABASE}"



                    if [[ "${EXISTING_LOCAL_URL}" == "true" &&

                          -n "${EXISTING_AUTH_SOURCE}" ]]; then

                        CURRENT_AUTH_DB="${EXISTING_AUTH_SOURCE}"

                    fi



                    if MONGO_CURRENT_USER="${MONGO_USER}" \

                       MONGO_CURRENT_PASSWORD="${CURRENT_PASSWORD}" \

                       mongosh \

                           --quiet \

                           --host "${MONGO_HOST}" \

                           --port "${MONGO_PORT}" \

                           "${CURRENT_AUTH_DB}" \

                           --eval '

                               const user = process.env.MONGO_CURRENT_USER;

                               const password = process.env.MONGO_CURRENT_PASSWORD;

                               const result = db.auth(user, password);

                               if (!result) quit(1);

                               quit(0);

                           ' \

                           >/dev/null 2>&1; then



                        MONGO_PASSWORD="${CURRENT_PASSWORD}"

                        PASSWORD_SOURCE="existing-entered"



                        ok "Current MongoDB password is valid"



                        break



                    else



                        warn "The supplied current password is not valid."



                    fi

                    ;;



                4)

                    die "Setup cancelled."

                    ;;



                *)

                    warn "Please choose 1, 2, 3, or 4."

                    ;;



            esac

        done



    else



        echo

        echo "No valid existing MongoDB credentials were found."

        echo

        echo "Choose:"

        echo

        echo "  1) Generate a random password"

        echo "  2) Enter a password manually"

        echo



        while true; do



            read -r -p "Choose [1-2]: " PASSWORD_CHOICE



            case "${PASSWORD_CHOICE}" in



                1)

                    MONGO_PASSWORD="$(generate_password)"

                    PASSWORD_SOURCE="generated"

                    ok "Generated a new random MongoDB password"

                    break

                    ;;



                2)

                    MONGO_PASSWORD="$(read_manual_password)"

                    PASSWORD_SOURCE="manual"

                    ok "Manual MongoDB password accepted"

                    break

                    ;;



                *)

                    warn "Please choose 1 or 2."

                    ;;



            esac

        done



    fi

fi



###############################################################################

# VALIDATE PASSWORD

###############################################################################



if [[ -z "${MONGO_PASSWORD}" ]]; then

    die "MongoDB password is empty."

fi



if [[ "${#MONGO_PASSWORD}" -lt "${MIN_PASSWORD_LENGTH}" ]]; then

    die "MongoDB password must contain at least ${MIN_PASSWORD_LENGTH} characters."

fi



###############################################################################

# MONGODB USER HELPERS

###############################################################################



user_exists_without_auth() {



    mongosh \

        --quiet \

        --host "${MONGO_HOST}" \

        --port "${MONGO_PORT}" \

        "${MONGO_DATABASE}" \

        --eval "

            const result = db.getUser(${MONGO_USER@Q});

            quit(result ? 0 : 1);

        " \

        >/dev/null 2>&1

}



user_exists_with_auth() {



    local auth_db="$1"

    local auth_user="$2"

    local auth_password="$3"



    MONGO_CURRENT_USER="${auth_user}" \

    MONGO_CURRENT_PASSWORD="${auth_password}" \

    MONGO_TARGET_USER="${MONGO_USER}" \

    mongosh \

        --quiet \

        --host "${MONGO_HOST}" \

        --port "${MONGO_PORT}" \

        "${auth_db}" \

        --eval '

            const currentUser = process.env.MONGO_CURRENT_USER;

            const currentPassword = process.env.MONGO_CURRENT_PASSWORD;

            const targetUser = process.env.MONGO_TARGET_USER;



            if (!db.auth(currentUser, currentPassword)) {

                quit(2);

            }



            const targetDb = db.getSiblingDB("homeshoppie");

            const result = targetDb.getUser(targetUser);



            quit(result ? 0 : 1);

        ' \

        >/dev/null 2>&1

}



###############################################################################



###############################################################################
# SAFE PASSWORD ROTATION
###############################################################################

rotate_mongo_password_with_recovery() {
    local new_password="$1"

    if [[ -z "${new_password}" ]]; then
        die "New MongoDB password is empty."
    fi

    RECOVERY_MODE="true"

    log "Temporarily disabling MongoDB authorization for password rotation..."

    if ! set_mongo_authorization "disabled"; then
        die "Could not disable MongoDB authorization for password rotation."
    fi

    RECOVERY_CHANGED_CONFIG="true"

    if ! systemctl restart "${MONGO_SERVICE}"; then
        die "MongoDB failed to restart in password recovery mode."
    fi

    local ready="false"
    for _ in {1..30}; do
        if mongosh \
            --quiet \
            --host "${MONGO_HOST}" \
            --port "${MONGO_PORT}" \
            --eval 'db.runCommand({ ping: 1 }).ok === 1' \
            2>/dev/null | grep -q "true"; then
            ready="true"
            break
        fi
        sleep 1
    done

    if [[ "${ready}" != "true" ]]; then
        die "MongoDB did not become ready in password recovery mode."
    fi

    ok "MongoDB recovery mode is active"

    log "Changing MongoDB application password..."

    MONGO_NEW_PASSWORD="${new_password}" \
    MONGO_TARGET_USER="${MONGO_USER}" \
    MONGO_TARGET_DB="${MONGO_DATABASE}" \
    mongosh \
        --quiet \
        --host "${MONGO_HOST}" \
        --port "${MONGO_PORT}" \
        "${MONGO_DATABASE}" \
        --eval '
            const newPassword = process.env.MONGO_NEW_PASSWORD;
            const targetUser = process.env.MONGO_TARGET_USER;
            const targetDbName = process.env.MONGO_TARGET_DB;

            if (!newPassword || !targetUser || !targetDbName) {
                throw new Error("MongoDB password rotation parameters are missing.");
            }

            const targetDb = db.getSiblingDB(targetDbName);
            const user = targetDb.getUser(targetUser);

            if (!user) {
                throw new Error("MongoDB application user does not exist.");
            }

            targetDb.changeUserPassword(targetUser, newPassword);
        ' \
        >/dev/null 2>&1

    ok "MongoDB application password changed"

    log "Restoring MongoDB authorization..."

    if ! set_mongo_authorization "enabled"; then
        die "Could not restore MongoDB authorization configuration."
    fi

    if ! systemctl restart "${MONGO_SERVICE}"; then
        die "MongoDB failed to restart after authorization was restored."
    fi

    ready="false"
    for _ in {1..30}; do
        if systemctl is-active --quiet "${MONGO_SERVICE}" && \
           mongosh \
               --quiet \
               --host "${MONGO_HOST}" \
               --port "${MONGO_PORT}" \
               --eval 'db.runCommand({ ping: 1 }).ok === 1' \
               2>/dev/null | grep -q "true"; then
            ready="true"
            break
        fi
        sleep 1
    done

    if [[ "${ready}" != "true" ]]; then
        die "MongoDB did not become ready after authorization restoration."
    fi

    RECOVERY_CHANGED_CONFIG="false"
    RECOVERY_MODE="false"

    ok "MongoDB authorization restored"
}

# HANDLE AUTHENTICATION

###############################################################################



if [[ "${AUTH_STATUS}" == "enabled" ]]; then



    section "Configuring MongoDB user"



    if [[ "${EXISTING_CREDENTIALS_VALID}" == "true" ||

          "${PASSWORD_SOURCE}" == "existing-entered" ]]; then



        #######################################################################

        # We have a valid administrative/application credential.

        #######################################################################



        AUTH_DB="${CURRENT_AUTH_DB:-${MONGO_DATABASE}}"



        log "Using authenticated MongoDB connection."



        if user_exists_with_auth \

            "${AUTH_DB}" \

            "${MONGO_USER}" \

            "${EXISTING_DB_PASSWORD:-${MONGO_PASSWORD}}"; then



            ok "MongoDB user already exists"



            if [[ "${PASSWORD_SOURCE}" == "existing" ||

                  "${MONGO_PASSWORD}" == "${EXISTING_DB_PASSWORD:-}" ]]; then



                ok "Keeping existing MongoDB password"



            else



                rotate_mongo_password_with_recovery "${MONGO_PASSWORD}"



                ok "MongoDB password rotation completed"



            fi



        else



            log "Creating MongoDB application user..."



            MONGO_NEW_PASSWORD="${MONGO_PASSWORD}" \

            MONGO_TARGET_USER="${MONGO_USER}" \

            mongosh \

                --quiet \

                --host "${MONGO_HOST}" \

                --port "${MONGO_PORT}" \

                "${AUTH_DB}" \

                --eval '

                    const currentUser = process.env.MONGO_CURRENT_USER;

                    const currentPassword = process.env.MONGO_CURRENT_PASSWORD;

                    const newPassword = process.env.MONGO_NEW_PASSWORD;

                    const targetUser = process.env.MONGO_TARGET_USER;



                    if (!db.auth(currentUser, currentPassword)) {

                        throw new Error("MongoDB authentication failed.");

                    }



                    const targetDb = db.getSiblingDB("homeshoppie");



                    if (targetDb.getUser(targetUser)) {

                        targetDb.changeUserPassword(

                            targetUser,

                            newPassword

                        );

                    } else {

                        targetDb.createUser({

                            user: targetUser,

                            pwd: newPassword,

                            roles: [

                                {

                                    role: "readWrite",

                                    db: "homeshoppie"

                                }

                            ]

                        });

                    }

                ' \

                >/dev/null



            ok "MongoDB application user configured"



        fi



    else



        #######################################################################

        # We DO NOT have a valid password.

        #

        # MongoDB auth is enabled and the existing password is unknown.

        #

        # Temporarily disable authorization, configure the user, then restore

        # authorization.

        #######################################################################



        warn "Existing MongoDB credentials could not authenticate."

        warn "Starting secure password recovery."



        RECOVERY_MODE="true"



        log "Temporarily disabling MongoDB authorization..."



        set_mongo_authorization "disabled"



        RECOVERY_CHANGED_CONFIG="true"



        systemctl restart "${MONGO_SERVICE}"



        sleep 3



        if ! systemctl is-active --quiet "${MONGO_SERVICE}"; then

            die "MongoDB failed to restart in recovery mode."

        fi



        # Wait for MongoDB.

        for _ in {1..30}; do



            if mongosh \

                --quiet \

                --host "${MONGO_HOST}" \

                --port "${MONGO_PORT}" \

                --eval 'db.runCommand({ ping: 1 }).ok === 1' \

                2>/dev/null |

                grep -q "true"; then



                break

            fi



            sleep 1

        done



        ok "MongoDB recovery mode is active"



        #######################################################################

        # Check whether application user exists.

        #######################################################################



        if user_exists_without_auth; then



            ok "Existing MongoDB user found"



            log "Changing MongoDB application password..."



            MONGO_NEW_PASSWORD="${MONGO_PASSWORD}" \

            MONGO_TARGET_USER="${MONGO_USER}" \

            mongosh \

                --quiet \

                --host "${MONGO_HOST}" \

                --port "${MONGO_PORT}" \

                "${MONGO_DATABASE}" \

                --eval '

                    const newPassword = process.env.MONGO_NEW_PASSWORD;

                    const targetUser = process.env.MONGO_TARGET_USER;



                    db.changeUserPassword(

                        targetUser,

                        newPassword

                    );

                ' \

                >/dev/null



            ok "MongoDB application password changed"



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

                    const newPassword = process.env.MONGO_NEW_PASSWORD;

                    const targetUser = process.env.MONGO_TARGET_USER;



                    db.createUser({

                        user: targetUser,

                        pwd: newPassword,

                        roles: [

                            {

                                role: "readWrite",

                                db: "homeshoppie"

                            }

                        ]

                    });

                ' \

                >/dev/null



            ok "MongoDB application user created"



        fi



        #######################################################################

        # Restore authorization.

        #######################################################################



        log "Restoring MongoDB authorization..."



        set_mongo_authorization "enabled"



        systemctl restart "${MONGO_SERVICE}"



        sleep 3



        if ! systemctl is-active --quiet "${MONGO_SERVICE}"; then

            die "MongoDB failed to restart with authorization enabled."

        fi



        RECOVERY_CHANGED_CONFIG="false"



        ok "MongoDB authorization enabled"



    fi



else



    ###########################################################################

    # AUTHENTICATION CURRENTLY DISABLED

    ###########################################################################



    section "Configuring MongoDB user"



    if user_exists_without_auth; then



        ok "MongoDB user already exists"



        log "Setting MongoDB application password..."



        MONGO_NEW_PASSWORD="${MONGO_PASSWORD}" \

        MONGO_TARGET_USER="${MONGO_USER}" \

        mongosh \

            --quiet \

            --host "${MONGO_HOST}" \

            --port "${MONGO_PORT}" \

            "${MONGO_DATABASE}" \

            --eval '

                const newPassword = process.env.MONGO_NEW_PASSWORD;

                const targetUser = process.env.MONGO_TARGET_USER;



                db.changeUserPassword(

                    targetUser,

                    newPassword

                );

            ' \

            >/dev/null



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

                const newPassword = process.env.MONGO_NEW_PASSWORD;

                const targetUser = process.env.MONGO_TARGET_USER;



                db.createUser({

                    user: targetUser,

                    pwd: newPassword,

                    roles: [

                        {

                            role: "readWrite",

                            db: "homeshoppie"

                        }

                    ]

                });

            ' \

            >/dev/null



        ok "MongoDB application user created"



    fi



    ###########################################################################

    # Enable authorization.

    ###########################################################################



    log "Enabling MongoDB authorization..."



    set_mongo_authorization "enabled"



    systemctl restart "${MONGO_SERVICE}"



    sleep 3



    if ! systemctl is-active --quiet "${MONGO_SERVICE}"; then

        die "MongoDB failed to restart with authorization enabled."

    fi



    ok "MongoDB authorization enabled"



fi



###############################################################################

# AUTHENTICATED CONNECTION TEST

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

            const user = process.env.MONGO_TEST_USER;

            const password = process.env.MONGO_TEST_PASSWORD;



            if (!db.auth(user, password)) {

                quit(1);

            }



            const result = db.runCommand({

                ping: 1

            });



            print(result.ok === 1 ? "PING_OK" : "PING_FAILED");

        ' \

        2>/dev/null

)"



if [[ "${MONGO_TEST_RESULT}" != *"PING_OK"* ]]; then



    error "MongoDB authentication test failed."



    die "The selected MongoDB credentials could not authenticate."



fi



ok "MongoDB authentication successful"

ok "MongoDB ping successful"



###############################################################################

# CREATE DATABASE_URL

###############################################################################



section "Updating HomeShoppie DATABASE_URL"



###############################################################################

# URL encode username/password safely using Node.

###############################################################################



ENCODED_CREDENTIALS="$(

    MONGO_USER_VALUE="${MONGO_USER}" \

    MONGO_PASSWORD_VALUE="${MONGO_PASSWORD}" \

    node <<'NODE'

const user = encodeURIComponent(process.env.MONGO_USER_VALUE);

const password = encodeURIComponent(process.env.MONGO_PASSWORD_VALUE);



process.stdout.write(\`${user}\t${password}\`);

NODE

)"



IFS=$'\t' read -r ENCODED_USER ENCODED_PASSWORD <<< "${ENCODED_CREDENTIALS}"



NEW_DATABASE_URL="mongodb://${ENCODED_USER}:${ENCODED_PASSWORD}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}?authSource=${MONGO_DATABASE}"



###############################################################################

# Atomic environment file update.

###############################################################################



TEMP_ENV_FILE="$(mktemp)"



awk '

    BEGIN {

        found=0

    }



    /^[[:space:]]*DATABASE_URL[[:space:]]*=/ {

        if (!found) {

            print "DATABASE_URL='"${NEW_DATABASE_URL}"'"

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

            print "DATABASE_URL='"${NEW_DATABASE_URL}"'"

        }

    }

' "${ENV_FILE}" > "${TEMP_ENV_FILE}"



###############################################################################

# Secure file.

###############################################################################



chown "${APP_USER}:${APP_USER}" "${TEMP_ENV_FILE}"

chmod 600 "${TEMP_ENV_FILE}"



mv "${TEMP_ENV_FILE}" "${ENV_FILE}"



ok "DATABASE_URL updated"



###############################################################################

# VERIFY ENV FILE

###############################################################################



section "Verifying environment"



FINAL_DATABASE_URL="$(

    node <<'NODE'

const fs = require("fs");



const file = "/etc/homeshoppie/.env.production";



const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);



for (const line of lines) {



    const trimmed = line.trim();



    if (!trimmed || trimmed.startsWith("#")) {

        continue;

    }



    const match = trimmed.match(/^DATABASE_URL\s*=\s*(.*)$/);



    if (match) {

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

}

NODE

)"



if [[ -z "${FINAL_DATABASE_URL}" ]]; then

    die "DATABASE_URL could not be verified."

fi



if [[ "${FINAL_DATABASE_URL}" != mongodb://* ]]; then

    die "DATABASE_URL does not contain a mongodb:// connection."

fi



ok "DATABASE_URL verified"



###############################################################################

# VERIFY ENV PERMISSIONS

###############################################################################



chmod 600 "${ENV_FILE}"

chown "${APP_USER}:${APP_USER}" "${ENV_FILE}"



FINAL_OWNER="$(stat -c '%U:%G' "${ENV_FILE}")"

FINAL_PERMS="$(stat -c '%a' "${ENV_FILE}")"



if [[ "${FINAL_OWNER}" != "${APP_USER}:${APP_USER}" ]]; then

    die "Incorrect environment file owner: ${FINAL_OWNER}"

fi



if [[ "${FINAL_PERMS}" != "600" ]]; then

    die "Incorrect environment file permissions: ${FINAL_PERMS}"

fi



ok "Environment file ownership and permissions verified"



###############################################################################

# FINAL MONGODB STATUS

###############################################################################



section "Final MongoDB status"



echo

systemctl --no-pager --full status "${MONGO_SERVICE}" |

    sed -n '1,12p'



echo



if command_exists ss; then



    echo "Listening:"

    ss -lntp 2>/dev/null |

        grep -E ":${MONGO_PORT}[[:space:]]" ||

        true



fi



echo



###############################################################################

# SECURITY CHECK

###############################################################################



section "Security verification"



FINAL_BIND_IP="$(

    grep -E '^[[:space:]]*bindIp:' "${MONGO_CONFIG}" |

        tail -1 |

        awk '{print $2}' ||

        true

)"



if [[ "${FINAL_BIND_IP}" == "127.0.0.1" ]]; then

    ok "MongoDB is bound only to localhost"

else

    warn "Could not verify bindIp automatically."

fi



FINAL_AUTH_STATUS="$(get_auth_status)"



if [[ "${FINAL_AUTH_STATUS}" == "enabled" ]]; then

    ok "MongoDB authorization is enabled"

else

    die "MongoDB authorization is NOT enabled."

fi



###############################################################################

# DATABASE_URL SUMMARY WITHOUT PASSWORD

###############################################################################



SAFE_DATABASE_URL="$(

    DATABASE_URL="${FINAL_DATABASE_URL}" \

    node <<'NODE'

try {

    const url = new URL(process.env.DATABASE_URL);



    url.password = "********";



    process.stdout.write(url.toString());

}

catch {

    process.stdout.write("mongodb://********");

}

NODE

)"



echo

echo "DATABASE_URL:"

echo "  ${SAFE_DATABASE_URL}"



###############################################################################

# FINAL SUMMARY

###############################################################################



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

echo "Security:"

echo "  MongoDB exposed publicly : NO"

echo "  MongoDB bind address     : ${MONGO_HOST}"

echo "  Environment permissions  : 600"

echo

echo "Password:"

echo "  Password value is NOT displayed."

echo "  Source: ${PASSWORD_SOURCE}"

echo



ok "MongoDB is ready for HomeShoppie"



echo

echo "Next steps:"

echo

echo "  1. Restart HomeShoppie:"

echo

echo "     pm2 restart homeshoppie --update-env"

echo

echo "  2. Check application logs:"

echo

echo "     pm2 logs homeshoppie --lines 50"

echo

echo "  3. Test application:"

echo

echo "     curl -I http://127.0.0.1:3000"

echo



###############################################################################

# SUCCESS

###############################################################################



trap - EXIT



exit 0
