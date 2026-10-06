#!/usr/bin/env bash

set -Eeuo pipefail

###############################################################################
# HomeShoppie Image Service - Application Credential Setup
#
# Creates an application through:
#   POST /api/applications/register
#
# If credentials already exist locally:
#   - Authenticate using the existing API key + API secret
#   - Get fresh access/refresh tokens
#
# IMPORTANT:
# The dashboard source does NOT expose an API endpoint to regenerate
# API Key/API Secret. Therefore this script does not invent such an endpoint.
###############################################################################

APP_NAME="${APP_NAME:-homeshoppie}"
APP_DESCRIPTION="${APP_DESCRIPTION:-HomeShoppie e-commerce image service}"
APP_DOMAIN="${APP_DOMAIN:-homeshoppie.in}"

IMAGE_SERVICE_URL="${IMAGE_SERVICE_URL:-http://localhost:5000}"

PLAN="${PLAN:-free}"

# Your production frontend origin
ALLOWED_ORIGIN="${ALLOWED_ORIGIN:-https://homeshoppie.in}"

# Where credentials will be stored
CREDENTIALS_DIR="${CREDENTIALS_DIR:-$HOME/.homeshoppie}"
CREDENTIALS_FILE="${CREDENTIALS_FILE:-$CREDENTIALS_DIR/image-service.env}"

REGISTER_ENDPOINT="${IMAGE_SERVICE_URL}/api/applications/register"
AUTH_ENDPOINT="${IMAGE_SERVICE_URL}/api/applications/authenticate"


###############################################################################
# Colors
###############################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

    command -v curl >/dev/null 2>&1 \
        || die "curl is required."

    command -v jq >/dev/null 2>&1 \
        || die "jq is required. Install with: sudo dnf install -y jq"

}


###############################################################################
# Create secure credentials directory
###############################################################################

prepare_credentials_directory() {

    mkdir -p "$CREDENTIALS_DIR"

    chmod 700 "$CREDENTIALS_DIR"

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

    if [[ "$http_code" != "2"* ]]; then
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

    [[ -n "$access_token" ]] \
        || die "Authentication succeeded but access token was not returned."

    [[ -n "$refresh_token" ]] \
        || die "Authentication succeeded but refresh token was not returned."

    save_credentials \
        "$IMAGE_SERVICE_API_KEY" \
        "$IMAGE_SERVICE_API_SECRET" \
        "$access_token" \
        "$refresh_token"

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

    if [[ "$http_code" != "2"* ]]; then

        error "Application registration failed."
        echo
        echo "HTTP Status: $http_code"
        echo

        echo "$body" | jq . 2>/dev/null || echo "$body"

        echo

        warning "If the application already exists, the API page only"
        warning "provides authentication, not API-key/API-secret regeneration."

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

    [[ -n "$api_key" ]] \
        || die "Registration succeeded but API key was not returned."

    [[ -n "$api_secret" ]] \
        || die "Registration succeeded but API secret was not returned."

    [[ -n "$access_token" ]] \
        || die "Registration succeeded but access token was not returned."

    [[ -n "$refresh_token" ]] \
        || die "Registration succeeded but refresh token was not returned."


    save_credentials \
        "$api_key" \
        "$api_secret" \
        "$access_token" \
        "$refresh_token"


    echo
    echo "============================================================"
    echo "              IMAGE SERVICE CREDENTIALS"
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
    warning "Do NOT commit $CREDENTIALS_FILE to Git."
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
    echo

    ###########################################################################
    # Existing credentials
    ###########################################################################

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


    ###########################################################################
    # Register
    ###########################################################################

    register_application

}


main "$@"