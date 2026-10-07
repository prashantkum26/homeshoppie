#!/usr/bin/env bash

set -Eeuo pipefail

###############################################################################
# HomeShoppie Image Service - Application Credential Setup
###############################################################################

APP_NAME="${APP_NAME:-homeshoppie}"
APP_DESCRIPTION="${APP_DESCRIPTION:-HomeShoppie e-commerce image service}"
APP_DOMAIN="${APP_DOMAIN:-homeshoppie.com}"
IMAGE_SERVICE_URL="${IMAGE_SERVICE_URL:-http://localhost:5000}"
PLAN="${PLAN:-free}"
ALLOWED_ORIGIN="${ALLOWED_ORIGIN:-https://homeshoppie.com}"

APP_USER="ec2-user"
APP_DIR="/home/ec2-user/homeshoppie"
ENV_FILE="/etc/homeshoppie/.env.production"

CREDENTIALS_DIR="/home/ec2-user/.homeshoppie"
CREDENTIALS_FILE="${CREDENTIALS_DIR}/image-service.env"

REGISTER_ENDPOINT="${IMAGE_SERVICE_URL}/api/applications/register"
AUTH_ENDPOINT="${IMAGE_SERVICE_URL}/api/applications/authenticate"

###############################################################################
# Colors
###############################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

###############################################################################
# Helpers
###############################################################################

log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

die() {
    error "$1"
    exit 1
}

###############################################################################
# Check dependencies
###############################################################################

check_dependencies() {
    [[ "${EUID}" -eq 0 ]] ||
        die "Run with sudo: sudo ./setup-image-service-client.sh"

    command -v curl >/dev/null 2>&1 ||
        die "curl is required."

    command -v jq >/dev/null 2>&1 ||
        die "jq is required. Install with: sudo dnf install -y jq"

    command -v node >/dev/null 2>&1 ||
        die "Node.js is required."

    command -v sudo >/dev/null 2>&1 ||
        die "sudo is required."

    [[ -d "$APP_DIR" ]] ||
        die "Application directory not found: $APP_DIR"

    mkdir -p "$(dirname "$ENV_FILE")"

    if [[ ! -f "$ENV_FILE" ]]; then
        touch "$ENV_FILE"
        chown "$APP_USER:$APP_USER" "$ENV_FILE"
        chmod 600 "$ENV_FILE"
    fi

    chown "$APP_USER:$APP_USER" "$ENV_FILE"
    chmod 600 "$ENV_FILE"

    success "HomeShoppie environment: $ENV_FILE"
}

###############################################################################
# Create secure credentials directory
###############################################################################

prepare_credentials_directory() {
    mkdir -p "$CREDENTIALS_DIR"
    chmod 700 "$CREDENTIALS_DIR"
}

###############################################################################
# Update HomeShoppie production environment
###############################################################################

update_homeshoppie_env() {
    local api_key="$1"
    local api_secret="$2"
    local tmp_env

    log "Updating HomeShoppie production environment..."

    [[ -d "$APP_DIR" ]] ||
        die "Application directory not found: $APP_DIR"

    mkdir -p "$(dirname "$ENV_FILE")"
    touch "$ENV_FILE"

    tmp_env="$(mktemp)"

    awk \
        -v api_key="$api_key" \
        -v api_secret="$api_secret" '
        BEGIN {
            base_found = 0
            key_found = 0
            secret_found = 0
            public_found = 0
        }

        /^[[:space:]]*IMAGE_SERVICE_BASE_URL[[:space:]]*=/ {
            if (!base_found) {
                print "IMAGE_SERVICE_BASE_URL=\"http://localhost:5000\""
                base_found = 1
            }
            next
        }

        /^[[:space:]]*IMAGE_SERVICE_API_KEY[[:space:]]*=/ {
            if (!key_found) {
                print "IMAGE_SERVICE_API_KEY=\"" api_key "\""
                key_found = 1
            }
            next
        }

        /^[[:space:]]*IMAGE_SERVICE_API_SECRET[[:space:]]*=/ {
            if (!secret_found) {
                print "IMAGE_SERVICE_API_SECRET=\"" api_secret "\""
                secret_found = 1
            }
            next
        }

        /^[[:space:]]*NEXT_PUBLIC_IMAGE_SERVICE_URL[[:space:]]*=/ {
            if (!public_found) {
                print "NEXT_PUBLIC_IMAGE_SERVICE_URL=\"https://homeshoppie.com/api\""
                public_found = 1
            }
            next
        }

        {
            print
        }

        END {
            if (!base_found) {
                print ""
                print "IMAGE_SERVICE_BASE_URL=\"http://localhost:5000\""
            }

            if (!key_found) {
                print "IMAGE_SERVICE_API_KEY=\"" api_key "\""
            }

            if (!secret_found) {
                print "IMAGE_SERVICE_API_SECRET=\"" api_secret "\""
            }

            if (!public_found) {
                print "NEXT_PUBLIC_IMAGE_SERVICE_URL=\"https://homeshoppie.com/api\""
            }
        }
    ' "$ENV_FILE" > "$tmp_env"

    chown "$APP_USER:$APP_USER" "$tmp_env"
    chmod 600 "$tmp_env"

    mv -f "$tmp_env" "$ENV_FILE"

    chown "$APP_USER:$APP_USER" "$ENV_FILE"
    chmod 600 "$ENV_FILE"

    success "HomeShoppie production environment updated:"
    echo "  $ENV_FILE"
}

###############################################################################
# Update PM2 environment
###############################################################################

update_pm2_environment() {
    log "Updating HomeShoppie PM2 environment..."

    command -v pm2 >/dev/null 2>&1 || {
        warning "PM2 is not installed. Skipping PM2 environment update."
        return 0
    }

    sudo -u "$APP_USER" -H bash -s -- \
        "$ENV_FILE" \
        "$APP_NAME" \
        "$APP_DIR" <<'PM2_SCRIPT'

set -Eeuo pipefail

ENV_FILE="$1"
APP_NAME="$2"
APP_DIR="$3"

[[ -f "$ENV_FILE" ]] || {
    echo "[ERROR] Environment file not found: $ENV_FILE" >&2
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
    ENV_FILE="$ENV_FILE" node <<'NODE'
const fs = require("fs");

const file = process.env.ENV_FILE;
const content = fs.readFileSync(file, "utf8");

for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
        continue;
    }

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);

    if (!match) {
        continue;
    }

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

cd "$APP_DIR"

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    echo "[INFO] Restarting $APP_NAME with updated environment..."

    pm2 restart "$APP_NAME" --update-env
else
    echo "[INFO] $APP_NAME is not registered. Starting it..."

    pm2 start npm \
        --name "$APP_NAME" \
        --cwd "$APP_DIR" \
        -- start
fi

sleep 2

pm2 save

echo "[OK] PM2 environment updated and saved"

PM2_SCRIPT

    success "PM2 environment updated successfully."
}

###############################################################################
# Save credentials
###############################################################################

save_credentials() {
    local api_key="$1"
    local api_secret="$2"
    local access_token="$3"
    local refresh_token="$4"

    cat > "$CREDENTIALS_FILE" <<EOF
# HomeShoppie Image Service credentials
# Generated: $(date '+%Y-%m-%d %H:%M:%S %Z')

IMAGE_SERVICE_URL='$IMAGE_SERVICE_URL'
IMAGE_SERVICE_APP_NAME='$APP_NAME'
IMAGE_SERVICE_API_KEY='$api_key'
IMAGE_SERVICE_API_SECRET='$api_secret'
IMAGE_SERVICE_ACCESS_TOKEN='$access_token'
IMAGE_SERVICE_REFRESH_TOKEN='$refresh_token'
EOF

    chmod 600 "$CREDENTIALS_FILE"
    chown "$APP_USER:$APP_USER" "$CREDENTIALS_FILE"

    success "Credentials saved to:"
    echo "  $CREDENTIALS_FILE"
}

###############################################################################
# Load existing credentials
###############################################################################

load_existing_credentials() {
    if [[ ! -f "$CREDENTIALS_FILE" ]]; then
        return 1
    fi

    # shellcheck disable=SC1090
    source "$CREDENTIALS_FILE"

    if [[ -n "${IMAGE_SERVICE_API_KEY:-}" ]] &&
       [[ -n "${IMAGE_SERVICE_API_SECRET:-}" ]]; then
        return 0
    fi

    return 1
}

###############################################################################
# Authenticate existing application
###############################################################################

authenticate_existing() {
    log "Existing credentials found."
    log "Authenticating existing application..."

    local response
    local http_code
    local body

    response=$(
        curl \
            --silent \
            --show-error \
            --write-out '\n%{http_code}' \
            --request POST \
            --header "Content-Type: application/json" \
            --data "$(jq -n \
                --arg apiKey "$IMAGE_SERVICE_API_KEY" \
                --arg apiSecret "$IMAGE_SERVICE_API_SECRET" \
                '{
                    apiKey: $apiKey,
                    apiSecret: $apiSecret
                }')" \
            "$AUTH_ENDPOINT"
    ) || {
        error "Unable to contact image service."
        return 1
    }

    http_code="$(echo "$response" | tail -n1)"
    body="$(echo "$response" | sed '$d')"

    if [[ "$http_code" != 2* ]]; then
        warning "Authentication failed. HTTP $http_code"
        echo "$body" | jq . 2>/dev/null || echo "$body"
        return 1
    fi

    if ! echo "$body" | jq -e '.success == true' >/dev/null 2>&1; then
        warning "Image service rejected authentication."
        echo "$body" | jq . 2>/dev/null || echo "$body"
        return 1
    fi

    local access_token
    local refresh_token

    access_token="$(echo "$body" | jq -r '.data.accessToken // empty')"
    refresh_token="$(echo "$body" | jq -r '.data.refreshToken // empty')"

    [[ -n "$access_token" ]] ||
        die "Authentication succeeded but access token was not returned."

    [[ -n "$refresh_token" ]] ||
        die "Authentication succeeded but refresh token was not returned."

    save_credentials \
        "$IMAGE_SERVICE_API_KEY" \
        "$IMAGE_SERVICE_API_SECRET" \
        "$access_token" \
        "$refresh_token"

    update_homeshoppie_env \
        "$IMAGE_SERVICE_API_KEY" \
        "$IMAGE_SERVICE_API_SECRET"

    update_pm2_environment

    success "Existing application authenticated successfully."

    return 0
}

###############################################################################
# Register new application
###############################################################################

register_application() {
    log "No usable existing credentials found."
    log "Registering application..."
    echo

    local payload

    payload="$(
        jq -n \
            --arg name "$APP_NAME" \
            --arg description "$APP_DESCRIPTION" \
            --arg domain "$APP_DOMAIN" \
            --arg origin "$ALLOWED_ORIGIN" \
            --arg plan "$PLAN" \
            '{
                name: $name,
                description: $description,
                domain: $domain,
                allowedOrigins: [$origin],
                plan: $plan
            }'
    )"

    local response
    local http_code
    local body

    response=$(
        curl \
            --silent \
            --show-error \
            --write-out '\n%{http_code}' \
            --request POST \
            --header "Content-Type: application/json" \
            --data "$payload" \
            "$REGISTER_ENDPOINT"
    ) || die "Unable to contact image service at $REGISTER_ENDPOINT"

    http_code="$(echo "$response" | tail -n1)"
    body="$(echo "$response" | sed '$d')"

    echo

    if [[ "$http_code" != 2* ]]; then
        error "Application registration failed."

        echo
        echo "HTTP Status: $http_code"
        echo

        echo "$body" | jq . 2>/dev/null || echo "$body"

        echo

        warning "If the application already exists, use the existing credentials."

        return 1
    fi

    if ! echo "$body" | jq -e '.success == true' >/dev/null 2>&1; then
        error "Registration was rejected by the image service."

        echo "$body" | jq . 2>/dev/null || echo "$body"

        return 1
    fi

    local api_key
    local api_secret
    local access_token
    local refresh_token

    api_key="$(echo "$body" | jq -r '.data.application.apiKey // empty')"
    api_secret="$(echo "$body" | jq -r '.data.application.apiSecret // empty')"
    access_token="$(echo "$body" | jq -r '.data.accessToken // empty')"
    refresh_token="$(echo "$body" | jq -r '.data.refreshToken // empty')"

    [[ -n "$api_key" ]] ||
        die "Registration succeeded but API key was not returned."

    [[ -n "$api_secret" ]] ||
        die "Registration succeeded but API secret was not returned."

    [[ -n "$access_token" ]] ||
        die "Registration succeeded but access token was not returned."

    [[ -n "$refresh_token" ]] ||
        die "Registration succeeded but refresh token was not returned."

    save_credentials \
        "$api_key" \
        "$api_secret" \
        "$access_token" \
        "$refresh_token"

    update_homeshoppie_env \
        "$api_key" \
        "$api_secret"

    update_pm2_environment

    echo
    echo "============================================================"
    echo "             IMAGE SERVICE CREDENTIALS"
    echo "============================================================"
    echo
    echo "Application:"
    echo "  $APP_NAME"
    echo
    echo "Image Service:"
    echo "  $IMAGE_SERVICE_URL"
    echo
    echo "API Key:"
    echo "  $api_key"
    echo
    echo "API Secret:"
    echo "  $api_secret"
    echo
    echo "Access Token:"
    echo "  $access_token"
    echo
    echo "Refresh Token:"
    echo "  $refresh_token"
    echo
    echo "============================================================"
    echo

    warning "Store the API secret securely."
    warning "Do NOT commit $CREDENTIALS_FILE or $ENV_FILE to Git."

    echo
}

###############################################################################
# Main
###############################################################################

main() {
    echo
    echo "============================================================"
    echo "      HomeShoppie Image Service Application Setup"
    echo "============================================================"
    echo

    check_dependencies
    prepare_credentials_directory

    echo "Configuration:"
    echo "  Application : $APP_NAME"
    echo "  Domain      : $APP_DOMAIN"
    echo "  Origin      : $ALLOWED_ORIGIN"
    echo "  Plan        : $PLAN"
    echo "  Service URL : $IMAGE_SERVICE_URL"
    echo "  App Dir     : $APP_DIR"
    echo "  Env File    : $ENV_FILE"
    echo

    if load_existing_credentials; then
        success "Existing application credentials found."

        if authenticate_existing; then
            echo
            echo "Existing application credentials were reused."
            echo
            exit 0
        fi

        echo
        warning "Existing credentials could not authenticate."
        warning "Attempting new application registration..."
        echo
    fi

    register_application
}

main "$@"