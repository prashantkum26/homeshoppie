#!/usr/bin/env bash

set -Eeuo pipefail

# ============================================================
# HomeShoppie - Production Environment Manager
# Amazon Linux / EC2 + Next.js + PM2
# ============================================================

APP_NAME="homeshoppie"
APP_USER="ec2-user"
ENV_DIR="/etc/${APP_NAME}"
ENV_FILE="${ENV_DIR}/.env.production"

DEFAULT_URL="https://homeshoppie.com"
DEFAULT_IMAGE_PUBLIC_URL="https://homeshoppie.com/api"
DEFAULT_IMAGE_SERVICE_BASE_URL="http://localhost:5000"
DEFAULT_PORT="3000"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SUDO=""
if [[ "$EUID" -ne 0 ]]; then
    SUDO="sudo"
fi

declare -A ENV_VALUES=()
declare -A UPDATE_VALUES=()

# ============================================================
# UI helpers
# ============================================================

log()     { echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*"; }
success() { echo -e "${GREEN}✓ $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠ $*${NC}"; }
error()   { echo -e "${RED}✗ $*${NC}"; }
info()    { echo -e "${CYAN}ℹ $*${NC}"; }

section() {
    echo
    echo "============================================================"
    echo " $*"
    echo "============================================================"
    echo
}

prompt_yes_no() {
    local prompt="$1"
    local default="${2:-N}"
    local answer=""

    if [[ "$default" == "Y" ]]; then
        read -r -p "$prompt [Y/n]: " answer || true
        answer="${answer:-Y}"
    else
        read -r -p "$prompt [y/N]: " answer || true
        answer="${answer:-N}"
    fi

    case "${answer,,}" in
        y|yes) return 0 ;;
        *) return 1 ;;
    esac
}

prompt_value() {
    local label="$1"
    local current="${2:-}"
    local value=""

    if [[ -n "$current" ]]; then
        read -r -p "$label [ENTER to keep current]: " value || true
        REPLY="${value:-$current}"
    else
        read -r -p "$label: " value || true
        REPLY="$value"
    fi
}

prompt_secret_value() {
    local label="$1"
    local current="${2:-}"
    local value=""

    if [[ -n "$current" ]]; then
        read -r -s -p "$label [ENTER to keep current]: " value || true
        echo
        REPLY="${value:-$current}"
    else
        read -r -s -p "$label: " value || true
        echo
        REPLY="$value"
    fi
}

# ============================================================
# Requirements / filesystem
# ============================================================

check_requirements() {
    local cmd

    for cmd in bash awk grep sed stat mktemp chmod chown cp mv date id; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            error "Required command not found: $cmd"
            return 1
        fi
    done

    if [[ "$EUID" -ne 0 ]] && ! command -v sudo >/dev/null 2>&1; then
        error "sudo is required when the script is not run as root."
        return 1
    fi

    if ! id "$APP_USER" >/dev/null 2>&1; then
        error "Application user does not exist: $APP_USER"
        return 1
    fi
}

ensure_environment_directory() {
    ${SUDO} mkdir -p "$ENV_DIR"
    ${SUDO} chown "$APP_USER:$APP_USER" "$ENV_DIR"
    ${SUDO} chmod 700 "$ENV_DIR"
}

ensure_environment_exists() {
    if [[ ! -f "$ENV_FILE" ]]; then
        error "Environment file does not exist: $ENV_FILE"
        echo "Run 'Full environment setup' first."
        return 1
    fi
}

secure_existing_environment() {
    ensure_environment_exists || return 1

    local permissions owner
    permissions="$(stat -c '%a' "$ENV_FILE")"
    owner="$(stat -c '%U:%G' "$ENV_FILE")"

    if [[ "$permissions" != "600" ]]; then
        warn "Fixing environment permissions: $permissions -> 600"
        ${SUDO} chmod 600 "$ENV_FILE"
    fi

    if [[ "$owner" != "${APP_USER}:${APP_USER}" ]]; then
        warn "Fixing environment owner: $owner -> ${APP_USER}:${APP_USER}"
        ${SUDO} chown "$APP_USER:$APP_USER" "$ENV_FILE"
    fi
}

# ============================================================
# Environment keys / safe parsing / writing
# ============================================================

known_keys() {
    cat <<'KEYS'
NODE_ENV
PORT
NEXT_PUBLIC_URL
NEXT_PUBLIC_APP_URL
NEXTAUTH_URL
NEXT_PUBLIC_BASE_URL
NEXT_PUBLIC_IMAGE_SERVICE_URL
DATABASE_URL
EMAIL_HOST
EMAIL_PORT
EMAIL_USER
EMAIL_PASS
EMAIL_SECURE
JWT_SECRET
GOOGLE_ID
GOOGLE_SECRET
IMAGE_SERVICE_BASE_URL
IMAGE_SERVICE_API_KEY
IMAGE_SERVICE_API_SECRET
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
RAZORPAY_MODE
NEXT_PUBLIC_RAZORPAY_KEY_ID
NEXTAUTH_SECRET
CSRF_SECRET
CRON_SECRET
KEYS
}

# Read the first assignment for a known key without evaluating the file.
get_existing_value() {
    local key="$1"
    local value=""

    [[ -f "$ENV_FILE" ]] || { REPLY=""; return 0; }

    value="$(awk -v key="$key" '
        $0 ~ "^[[:space:]]*" key "=" {
            sub("^[[:space:]]*" key "=", "", $0)
            if ($0 ~ /^".*"$/) {
                sub(/^"/, "", $0)
                sub(/"$/, "", $0)
            } else if ($0 ~ /^'"'"'.*'"'"'$/) {
                sub(/^'"'"'/, "", $0)
                sub(/'"'"'$/, "", $0)
            }
            print
            exit
        }
    ' "$ENV_FILE" 2>/dev/null || true)"

    # Values written by this script are double-quoted and shell-escaped.
    # Decode those escapes so an ENTER/keep-current operation does not
    # progressively double-escape an existing value.
    if [[ "$value" == *\\* ]]; then
        local decoded=""
        printf -v decoded '%b' "$value"
        value="$decoded"
    fi

    REPLY="$value"
}

load_existing_values() {
    local key
    ENV_VALUES=()

    while IFS= read -r key; do
        [[ -z "$key" ]] && continue
        get_existing_value "$key"
        ENV_VALUES["$key"]="$REPLY"
    done < <(known_keys)
}

# Escape a value for safe storage in a Bash-compatible double-quoted .env file.
# This prevents $, backticks, quotes and backslashes from being interpreted when sourced.
escape_env_value() {
    local value="$1"
    value="${value//\\/\\\\}"
    value="${value//\"/\\\"}"
    value="${value//\$/\\\$}"
    value="${value//\`/\\\`}"
    value="${value//$'\n'/ }"
    value="${value//$'\r'/ }"
    printf '%s' "$value"
}

write_env_key_to_file() {
    local file="$1"
    local key="$2"
    local value="$3"
    local escaped

    escaped="$(escape_env_value "$value")"

    if grep -qE "^[[:space:]]*${key}=" "$file"; then
        awk -v key="$key" -v replacement="${key}=\"${escaped}\"" '
            $0 ~ "^[[:space:]]*" key "=" {
                print replacement
                next
            }
            { print }
        ' "$file" > "${file}.new"
        chmod 600 "${file}.new"
        mv "${file}.new" "$file"
    else
        printf '%s\n' "${key}=\"${escaped}\"" >> "$file"
    fi
}

# Validate shell syntax only. The file is never sourced by this function.
validate_env_syntax() {
    ensure_environment_exists || return 1
    if ! bash -n "$ENV_FILE" >/dev/null 2>&1; then
        error "Environment file contains invalid shell syntax: $ENV_FILE"
        return 1
    fi
}

update_env_keys_preserve() {
    local temp_file key value

    ensure_environment_exists || return 1
    secure_existing_environment || return 1

    temp_file="$(mktemp "${ENV_DIR}/.env.production.tmp.XXXXXX")"
    trap 'rm -f "${temp_file:-}" 2>/dev/null || true' RETURN

    cp -p "$ENV_FILE" "$temp_file"
    chmod 600 "$temp_file"

    for key in "$@"; do
        value="${UPDATE_VALUES[$key]-}"
        write_env_key_to_file "$temp_file" "$key" "$value"
    done

    ${SUDO} chown "$APP_USER:$APP_USER" "$temp_file"
    ${SUDO} chmod 600 "$temp_file"
    ${SUDO} mv "$temp_file" "$ENV_FILE"
    ${SUDO} chown "$APP_USER:$APP_USER" "$ENV_FILE"
    ${SUDO} chmod 600 "$ENV_FILE"

    trap - RETURN
    success "Environment updated without replacing unrelated variables."
}

write_environment_file() {
    local temp_file key value

    ensure_environment_directory
    temp_file="$(mktemp "${ENV_DIR}/.env.production.new.XXXXXX")"
    trap 'rm -f "${temp_file:-}" 2>/dev/null || true' RETURN

    chmod 600 "$temp_file"

    cat > "$temp_file" <<'HEADER'
# ============================================================
# HomeShoppie - Production Environment
# Managed by setup-env.sh
# ============================================================
HEADER

    while IFS= read -r key; do
        [[ -z "$key" ]] && continue
        value="${ENV_VALUES[$key]-}"
        write_env_key_to_file "$temp_file" "$key" "$value"
    done < <(known_keys)

    ${SUDO} chown "$APP_USER:$APP_USER" "$temp_file"
    ${SUDO} chmod 600 "$temp_file"
    ${SUDO} mv "$temp_file" "$ENV_FILE"
    ${SUDO} chown "$APP_USER:$APP_USER" "$ENV_FILE"
    ${SUDO} chmod 600 "$ENV_FILE"

    trap - RETURN
    success "Environment file written securely."
}

# ============================================================
# Backup
# ============================================================

backup_existing_env() {
    ensure_environment_exists || return 1
    secure_existing_environment || return 1

    local timestamp backup_file
    timestamp="$(date '+%Y%m%d-%H%M%S')"
    backup_file="${ENV_FILE}.backup-${timestamp}"

    # Avoid overwriting a backup if two operations occur in the same second.
    if [[ -e "$backup_file" ]]; then
        backup_file="${ENV_FILE}.backup-${timestamp}-$$"
    fi

    ${SUDO} cp -p "$ENV_FILE" "$backup_file"
    ${SUDO} chown "$APP_USER:$APP_USER" "$backup_file"
    ${SUDO} chmod 600 "$backup_file"

    success "Backup created: $backup_file"
}

# ============================================================
# Secret generation
# ============================================================

generate_secret() {
    local length="${1:-64}"

    if command -v openssl >/dev/null 2>&1; then
        openssl rand -hex "$((length / 2))"
        return 0
    fi

    if command -v node >/dev/null 2>&1; then
        node -e "console.log(require('crypto').randomBytes($((length / 2))).toString('hex'))"
        return 0
    fi

    error "Neither openssl nor node is available for secure secret generation."
    return 1
}

configure_security_secret() {
    local key="$1"
    local label="$2"
    local current="${ENV_VALUES[$key]-}"
    local choice generated

    echo
    echo "$label"

    if [[ -n "$current" ]]; then
        echo "  1) Keep current"
        echo "  2) Generate new"
        echo "  3) Enter manually"
        read -r -p "  Select [1-3]: " choice || true

        case "$choice" in
            2)
                generated="$(generate_secret 64)"
                ENV_VALUES["$key"]="$generated"
                success "$key regenerated."
                ;;
            3)
                prompt_secret_value "  Enter $key" "$current"
                ENV_VALUES["$key"]="$REPLY"
                ;;
            *)
                success "$key kept."
                ;;
        esac
    else
        echo "  1) Generate securely"
        echo "  2) Enter manually"
        read -r -p "  Select [1-2] (default 1): " choice || true
        choice="${choice:-1}"

        case "$choice" in
            2)
                prompt_secret_value "  Enter $key"
                ENV_VALUES["$key"]="$REPLY"
                ;;
            *)
                generated="$(generate_secret 64)"
                ENV_VALUES["$key"]="$generated"
                success "$key generated."
                ;;
        esac
    fi
}

# ============================================================
# Full setup configuration
# ============================================================

configure_defaults() {
    ENV_VALUES[NODE_ENV]="production"
    ENV_VALUES[PORT]="${ENV_VALUES[PORT]:-$DEFAULT_PORT}"
    ENV_VALUES[NEXT_PUBLIC_URL]="${ENV_VALUES[NEXT_PUBLIC_URL]:-$DEFAULT_URL}"
    ENV_VALUES[NEXT_PUBLIC_APP_URL]="${ENV_VALUES[NEXT_PUBLIC_APP_URL]:-$DEFAULT_URL}"
    ENV_VALUES[NEXTAUTH_URL]="${ENV_VALUES[NEXTAUTH_URL]:-$DEFAULT_URL}"
    ENV_VALUES[NEXT_PUBLIC_BASE_URL]="${ENV_VALUES[NEXT_PUBLIC_BASE_URL]:-$DEFAULT_URL}"
    ENV_VALUES[NEXT_PUBLIC_IMAGE_SERVICE_URL]="${ENV_VALUES[NEXT_PUBLIC_IMAGE_SERVICE_URL]:-$DEFAULT_IMAGE_PUBLIC_URL}"
    ENV_VALUES[IMAGE_SERVICE_BASE_URL]="${ENV_VALUES[IMAGE_SERVICE_BASE_URL]:-$DEFAULT_IMAGE_SERVICE_BASE_URL}"
    ENV_VALUES[RAZORPAY_MODE]="${ENV_VALUES[RAZORPAY_MODE]:-test}"
}

configure_database() {
    section "Database Configuration"
    prompt_secret_value "DATABASE_URL" "${ENV_VALUES[DATABASE_URL]-}"
    ENV_VALUES[DATABASE_URL]="$REPLY"
}

configure_email() {
    section "Email / SMTP Configuration"
    prompt_value "EMAIL_HOST" "${ENV_VALUES[EMAIL_HOST]-}"
    ENV_VALUES[EMAIL_HOST]="$REPLY"
    prompt_value "EMAIL_PORT" "${ENV_VALUES[EMAIL_PORT]-}"
    ENV_VALUES[EMAIL_PORT]="$REPLY"
    prompt_value "EMAIL_USER" "${ENV_VALUES[EMAIL_USER]-}"
    ENV_VALUES[EMAIL_USER]="$REPLY"
    prompt_value "EMAIL_SECURE" "${ENV_VALUES[EMAIL_SECURE]-}"
    ENV_VALUES[EMAIL_SECURE]="$REPLY"
    prompt_secret_value "EMAIL_PASS" "${ENV_VALUES[EMAIL_PASS]-}"
    ENV_VALUES[EMAIL_PASS]="$REPLY"
}

configure_google() {
    section "Google OAuth Configuration"
    prompt_value "GOOGLE_ID" "${ENV_VALUES[GOOGLE_ID]-}"
    ENV_VALUES[GOOGLE_ID]="$REPLY"
    prompt_secret_value "GOOGLE_SECRET" "${ENV_VALUES[GOOGLE_SECRET]-}"
    ENV_VALUES[GOOGLE_SECRET]="$REPLY"
}

configure_image_service() {
    section "Image Service Configuration"
    prompt_value "IMAGE_SERVICE_BASE_URL" "${ENV_VALUES[IMAGE_SERVICE_BASE_URL]-$DEFAULT_IMAGE_SERVICE_BASE_URL}"
    ENV_VALUES[IMAGE_SERVICE_BASE_URL]="$REPLY"
    prompt_secret_value "IMAGE_SERVICE_API_KEY" "${ENV_VALUES[IMAGE_SERVICE_API_KEY]-}"
    ENV_VALUES[IMAGE_SERVICE_API_KEY]="$REPLY"
    prompt_secret_value "IMAGE_SERVICE_API_SECRET" "${ENV_VALUES[IMAGE_SERVICE_API_SECRET]-}"
    ENV_VALUES[IMAGE_SERVICE_API_SECRET]="$REPLY"
}

configure_razorpay() {
    section "Razorpay Configuration"

    local mode_choice="" mode_confirm=""

    echo "1) Test"
    echo "2) Live"
    read -r -p "Select Razorpay mode [1-2] (default 1): " mode_choice || true
    mode_choice="${mode_choice:-1}"

    case "$mode_choice" in
        2)
            warn "LIVE Razorpay mode will process real payments."
            read -r -p 'Type YES to confirm LIVE mode: ' mode_confirm || true
            if [[ "$mode_confirm" == "YES" ]]; then
                ENV_VALUES[RAZORPAY_MODE]="live"
            else
                error "Live mode confirmation failed. Keeping test mode."
                ENV_VALUES[RAZORPAY_MODE]="test"
            fi
            ;;
        *)
            ENV_VALUES[RAZORPAY_MODE]="test"
            ;;
    esac

    prompt_secret_value "RAZORPAY_KEY_ID" "${ENV_VALUES[RAZORPAY_KEY_ID]-}"
    ENV_VALUES[RAZORPAY_KEY_ID]="$REPLY"

    prompt_secret_value "RAZORPAY_KEY_SECRET" "${ENV_VALUES[RAZORPAY_KEY_SECRET]-}"
    ENV_VALUES[RAZORPAY_KEY_SECRET]="$REPLY"

    prompt_secret_value "RAZORPAY_WEBHOOK_SECRET" "${ENV_VALUES[RAZORPAY_WEBHOOK_SECRET]-}"
    ENV_VALUES[RAZORPAY_WEBHOOK_SECRET]="$REPLY"

    ENV_VALUES[NEXT_PUBLIC_RAZORPAY_KEY_ID]="${ENV_VALUES[RAZORPAY_KEY_ID]}"
}

configure_security() {
    section "Application Security Secrets"
    echo "These are application-owned secrets and may be generated securely."

    configure_security_secret "JWT_SECRET" "JWT_SECRET"
    configure_security_secret "NEXTAUTH_SECRET" "NEXTAUTH_SECRET"
    configure_security_secret "CSRF_SECRET" "CSRF_SECRET"
    configure_security_secret "CRON_SECRET" "CRON_SECRET"
}

# ============================================================
# Validation
# ============================================================

required_variables() {
    known_keys
}

validate_environment_file() {
    ensure_environment_exists || return 1
    secure_existing_environment || return 1
    validate_env_syntax || return 1

    local missing=()
    local malformed=()
    local key value permissions owner

    while IFS= read -r key; do
        [[ -z "$key" ]] && continue

        if ! grep -qE "^[[:space:]]*${key}=" "$ENV_FILE"; then
            missing+=("$key")
            continue
        fi

        get_existing_value "$key"
        value="$REPLY"

        case "$key" in
            NODE_ENV|PORT|NEXT_PUBLIC_URL|NEXT_PUBLIC_APP_URL|NEXTAUTH_URL|NEXT_PUBLIC_BASE_URL|NEXT_PUBLIC_IMAGE_SERVICE_URL|IMAGE_SERVICE_BASE_URL|RAZORPAY_MODE)
                [[ -n "$value" ]] || malformed+=("$key is empty")
                ;;
        esac
    done < <(required_variables)

    permissions="$(stat -c '%a' "$ENV_FILE")"
    owner="$(stat -c '%U:%G' "$ENV_FILE")"

    [[ "$permissions" == "600" ]] || malformed+=("permissions must be 600")
    [[ "$owner" == "${APP_USER}:${APP_USER}" ]] || malformed+=("owner must be ${APP_USER}:${APP_USER}")

    if (( ${#missing[@]} > 0 )); then
        error "Missing variable definitions:"
        printf '  - %s\n' "${missing[@]}"
    fi

    if (( ${#malformed[@]} > 0 )); then
        error "Invalid/empty configuration:"
        printf '  - %s\n' "${malformed[@]}"
    fi

    if (( ${#missing[@]} == 0 && ${#malformed[@]} == 0 )); then
        success "Environment validation passed."
        return 0
    fi

    return 1
}

# ============================================================
# PM2
# ============================================================

run_as_app_user() {
    if [[ "$EUID" -eq 0 ]]; then
        sudo -u "$APP_USER" -H "$@"
    else
        "$@"
    fi
}

run_shell_as_app_user() {
    local command="$1"
    if [[ "$EUID" -eq 0 ]]; then
        sudo -u "$APP_USER" -H bash -lc "$command"
    else
        bash -lc "$command"
    fi
}

pm2_is_available() {
    run_shell_as_app_user 'command -v pm2 >/dev/null 2>&1'
}

pm2_app_exists() {
    run_shell_as_app_user "pm2 describe '$APP_NAME' >/dev/null 2>&1"
}

pm2_restart_with_latest_env() {
    ensure_environment_exists || return 1
    validate_env_syntax || return 1

    log "Loading latest environment for PM2..."

    local pm2_command
    pm2_command="
        set -a
        source '$ENV_FILE'
        set +a
        unset SUDO_COMMAND SUDO_USER SUDO_UID SUDO_GID
        pm2 restart '$APP_NAME' --update-env
    "

    run_shell_as_app_user "$pm2_command"
}

pm2_after_targeted_update() {
    if ! pm2_is_available; then
        warn "PM2 is not installed or not available for user '$APP_USER'."
        return 0
    fi

    if ! pm2_app_exists; then
        warn "PM2 app '$APP_NAME' is not registered for user '$APP_USER'."
        echo "The environment file was updated successfully."
        return 0
    fi

    echo
    if prompt_yes_no "Restart PM2 '$APP_NAME' and load the updated environment?" "Y"; then
        if pm2_restart_with_latest_env; then
            success "PM2 restarted with the latest environment."
            echo "PM2 user: $APP_USER"
        else
            error "PM2 restart failed. Environment file remains updated."
            return 1
        fi
    else
        warn "PM2 was not restarted."
        echo "The running PM2 process still has its previous environment."
        echo
        echo "Run:"
        echo "  sudo -u $APP_USER -H bash -lc 'set -a; source $ENV_FILE; set +a; unset SUDO_COMMAND SUDO_USER SUDO_UID SUDO_GID; pm2 restart $APP_NAME --update-env'"
    fi
}

configure_pm2() {
    if ! pm2_is_available; then
        warn "PM2 not found for user '$APP_USER'. Skipping PM2 reload."
        return 0
    fi

    if ! pm2_app_exists; then
        warn "PM2 app '$APP_NAME' is not registered for user '$APP_USER'."
        return 0
    fi

    echo
    if prompt_yes_no "Restart PM2 '$APP_NAME' and load the new environment?" "Y"; then
        if pm2_restart_with_latest_env; then
            success "PM2 restarted with updated environment."
        else
            error "PM2 restart failed."
            return 1
        fi
    else
        warn "PM2 restart skipped."
        echo "Run later:"
        echo "  sudo -u $APP_USER -H bash -lc 'set -a; source $ENV_FILE; set +a; unset SUDO_COMMAND SUDO_USER SUDO_UID SUDO_GID; pm2 restart $APP_NAME --update-env'"
    fi
}

show_pm2_status() {
    echo
    echo "PM2 status:"

    if ! pm2_is_available; then
        warn "PM2 is not installed/in PATH for user '$APP_USER'."
        return 0
    fi

    if pm2_app_exists; then
        run_as_app_user pm2 status "$APP_NAME"
    else
        warn "PM2 app '$APP_NAME' is not currently registered for user '$APP_USER'."
    fi
}

# ============================================================
# Status
# ============================================================

status_line() {
    local key="$1"
    local value=""
    get_existing_value "$key"
    value="$REPLY"

    if [[ -n "$value" ]]; then
        printf '  %-34s %s\n' "$key" "configured"
    else
        printf '  %-34s %s\n' "$key" "NOT SET / EMPTY"
    fi
}

show_environment_status() {
    ensure_environment_exists || return 1
    secure_existing_environment || return 1

    local permissions owner
    permissions="$(stat -c '%a' "$ENV_FILE")"
    owner="$(stat -c '%U:%G' "$ENV_FILE")"

    section "Environment Status"
    echo "Application : $APP_NAME"
    echo "User        : $APP_USER"
    echo "Directory   : $ENV_DIR"
    echo "Environment : $ENV_FILE"
    echo "Permissions : $permissions"
    echo "Owner       : $owner"
    echo

    echo "Configuration status:"
    status_line DATABASE_URL
    status_line EMAIL_HOST
    status_line EMAIL_PORT
    status_line EMAIL_USER
    status_line EMAIL_SECURE
    status_line EMAIL_PASS
    status_line GOOGLE_ID
    status_line GOOGLE_SECRET
    status_line IMAGE_SERVICE_BASE_URL
    status_line IMAGE_SERVICE_API_KEY
    status_line IMAGE_SERVICE_API_SECRET
    status_line RAZORPAY_KEY_ID
    status_line RAZORPAY_KEY_SECRET
    status_line RAZORPAY_WEBHOOK_SECRET
    status_line NEXT_PUBLIC_RAZORPAY_KEY_ID
    status_line JWT_SECRET
    status_line NEXTAUTH_SECRET
    status_line CSRF_SECRET
    status_line CRON_SECRET

    get_existing_value RAZORPAY_MODE
    echo
    echo "  Razorpay mode: ${REPLY:-NOT SET}"

    echo
    echo "Application URLs:"
    local key
    for key in NEXT_PUBLIC_URL NEXT_PUBLIC_APP_URL NEXTAUTH_URL NEXT_PUBLIC_BASE_URL NEXT_PUBLIC_IMAGE_SERVICE_URL; do
        get_existing_value "$key"
        printf '  %-34s %s\n' "$key" "${REPLY:-NOT SET}"
    done

    show_pm2_status
}

# ============================================================
# Targeted updates
# ============================================================

prepare_targeted_update() {
    ensure_environment_exists || return 1
    secure_existing_environment || return 1
    backup_existing_env || return 1
    UPDATE_VALUES=()
}

finish_targeted_update() {
    if ! validate_environment_file; then
        error "Validation failed after update."
        return 1
    fi

    pm2_after_targeted_update
}

update_razorpay_only() {
    prepare_targeted_update || return 1
    section "Update Razorpay"

    local current mode_choice="" mode_confirm=""
    local key_id key_secret webhook_secret

    get_existing_value RAZORPAY_MODE
    current="$REPLY"
    echo "Current mode: ${current:-NOT SET}"
    echo "1) Test"
    echo "2) Live"
    read -r -p "Select [1-2] (default 1): " mode_choice || true
    mode_choice="${mode_choice:-1}"

    if [[ "$mode_choice" == "2" ]]; then
        warn "LIVE Razorpay mode is for real payments."
        read -r -p 'Type YES to confirm LIVE mode: ' mode_confirm || true
        if [[ "$mode_confirm" == "YES" ]]; then
            UPDATE_VALUES[RAZORPAY_MODE]="live"
        else
            error "Confirmation failed. Keeping test mode."
            UPDATE_VALUES[RAZORPAY_MODE]="test"
        fi
    else
        UPDATE_VALUES[RAZORPAY_MODE]="test"
    fi

    get_existing_value RAZORPAY_KEY_ID
    key_id="$REPLY"
    prompt_value "Razorpay Key ID" "$key_id"
    UPDATE_VALUES[RAZORPAY_KEY_ID]="$REPLY"

    get_existing_value RAZORPAY_KEY_SECRET
    key_secret="$REPLY"
    prompt_secret_value "Razorpay Key Secret" "$key_secret"
    UPDATE_VALUES[RAZORPAY_KEY_SECRET]="$REPLY"

    get_existing_value RAZORPAY_WEBHOOK_SECRET
    webhook_secret="$REPLY"
    prompt_secret_value "Razorpay Webhook Secret" "$webhook_secret"
    UPDATE_VALUES[RAZORPAY_WEBHOOK_SECRET]="$REPLY"

    UPDATE_VALUES[NEXT_PUBLIC_RAZORPAY_KEY_ID]="${UPDATE_VALUES[RAZORPAY_KEY_ID]}"

    echo
    echo "Only these Razorpay variables will be changed:"
    printf '  %s\n' RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET RAZORPAY_MODE NEXT_PUBLIC_RAZORPAY_KEY_ID

    if ! prompt_yes_no "Save Razorpay changes?" "Y"; then
        warn "Razorpay update cancelled. Backup remains available."
        return 0
    fi

    update_env_keys_preserve RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET RAZORPAY_MODE NEXT_PUBLIC_RAZORPAY_KEY_ID
    finish_targeted_update
}

update_google_only() {
    prepare_targeted_update || return 1
    section "Update Google OAuth"

    get_existing_value GOOGLE_ID
    prompt_value "Google Client ID" "$REPLY"
    UPDATE_VALUES[GOOGLE_ID]="$REPLY"

    get_existing_value GOOGLE_SECRET
    prompt_secret_value "Google Client Secret" "$REPLY"
    UPDATE_VALUES[GOOGLE_SECRET]="$REPLY"

    if prompt_yes_no "Save Google OAuth changes?" "Y"; then
        update_env_keys_preserve GOOGLE_ID GOOGLE_SECRET
        finish_targeted_update
    else
        warn "Google OAuth update cancelled."
    fi
}

update_email_only() {
    prepare_targeted_update || return 1
    section "Update Email / SMTP"

    get_existing_value EMAIL_HOST
    prompt_value "EMAIL_HOST" "$REPLY"
    UPDATE_VALUES[EMAIL_HOST]="$REPLY"

    get_existing_value EMAIL_PORT
    prompt_value "EMAIL_PORT" "$REPLY"
    UPDATE_VALUES[EMAIL_PORT]="$REPLY"

    get_existing_value EMAIL_USER
    prompt_value "EMAIL_USER" "$REPLY"
    UPDATE_VALUES[EMAIL_USER]="$REPLY"

    get_existing_value EMAIL_SECURE
    prompt_value "EMAIL_SECURE" "$REPLY"
    UPDATE_VALUES[EMAIL_SECURE]="$REPLY"

    get_existing_value EMAIL_PASS
    prompt_secret_value "EMAIL_PASS" "$REPLY"
    UPDATE_VALUES[EMAIL_PASS]="$REPLY"

    if prompt_yes_no "Save Email / SMTP changes?" "Y"; then
        update_env_keys_preserve EMAIL_HOST EMAIL_PORT EMAIL_USER EMAIL_PASS EMAIL_SECURE
        finish_targeted_update
    else
        warn "Email update cancelled."
    fi
}

update_image_service_only() {
    prepare_targeted_update || return 1
    section "Update Image Service"

    get_existing_value IMAGE_SERVICE_BASE_URL
    prompt_value "IMAGE_SERVICE_BASE_URL" "$REPLY"
    UPDATE_VALUES[IMAGE_SERVICE_BASE_URL]="$REPLY"

    get_existing_value IMAGE_SERVICE_API_KEY
    prompt_secret_value "IMAGE_SERVICE_API_KEY" "$REPLY"
    UPDATE_VALUES[IMAGE_SERVICE_API_KEY]="$REPLY"

    get_existing_value IMAGE_SERVICE_API_SECRET
    prompt_secret_value "IMAGE_SERVICE_API_SECRET" "$REPLY"
    UPDATE_VALUES[IMAGE_SERVICE_API_SECRET]="$REPLY"

    if prompt_yes_no "Save Image Service changes?" "Y"; then
        update_env_keys_preserve IMAGE_SERVICE_BASE_URL IMAGE_SERVICE_API_KEY IMAGE_SERVICE_API_SECRET
        finish_targeted_update
    else
        warn "Image Service update cancelled."
    fi
}

update_database_only() {
    prepare_targeted_update || return 1
    section "Update Database"

    get_existing_value DATABASE_URL
    prompt_secret_value "DATABASE_URL" "$REPLY"
    UPDATE_VALUES[DATABASE_URL]="$REPLY"

    if prompt_yes_no "Save Database changes?" "Y"; then
        update_env_keys_preserve DATABASE_URL
        finish_targeted_update
    else
        warn "Database update cancelled."
    fi
}

update_urls_only() {
    prepare_targeted_update || return 1
    section "Update Application URLs"

    local key
    for key in NEXT_PUBLIC_URL NEXT_PUBLIC_APP_URL NEXTAUTH_URL NEXT_PUBLIC_BASE_URL NEXT_PUBLIC_IMAGE_SERVICE_URL; do
        get_existing_value "$key"
        prompt_value "$key" "$REPLY"
        UPDATE_VALUES["$key"]="$REPLY"
    done

    if prompt_yes_no "Save Application URL changes?" "Y"; then
        update_env_keys_preserve NEXT_PUBLIC_URL NEXT_PUBLIC_APP_URL NEXTAUTH_URL NEXT_PUBLIC_BASE_URL NEXT_PUBLIC_IMAGE_SERVICE_URL
        finish_targeted_update
    else
        warn "URL update cancelled."
    fi
}

update_security_only() {
    prepare_targeted_update || return 1
    section "Update Application Security Secrets"

    local key choice current generated

    for key in JWT_SECRET NEXTAUTH_SECRET CSRF_SECRET CRON_SECRET; do
        get_existing_value "$key"
        current="$REPLY"

        echo
        echo "$key"
        echo "  1) Keep current"
        echo "  2) Generate new"
        echo "  3) Enter manually"
        read -r -p "  Select [1-3] (default 1): " choice || true
        choice="${choice:-1}"

        case "$choice" in
            2)
                generated="$(generate_secret 64)"
                UPDATE_VALUES["$key"]="$generated"
                ;;
            3)
                prompt_secret_value "  Enter $key" "$current"
                UPDATE_VALUES["$key"]="$REPLY"
                ;;
            *)
                UPDATE_VALUES["$key"]="$current"
                ;;
        esac
    done

    if prompt_yes_no "Save Security Secret changes?" "Y"; then
        update_env_keys_preserve JWT_SECRET NEXTAUTH_SECRET CSRF_SECRET CRON_SECRET
        finish_targeted_update
    else
        warn "Security update cancelled."
    fi
}

targeted_update_menu() {
    ensure_environment_exists || return 1

    while true; do
        section "Update Specific Environment"
        echo "  1) Razorpay"
        echo "  2) Google OAuth"
        echo "  3) Email / SMTP"
        echo "  4) Image Service"
        echo "  5) Database"
        echo "  6) Application URLs"
        echo "  7) Security Secrets"
        echo "  8) Back"
        echo

        local choice=""
        read -r -p "Select [1-8]: " choice || true

        case "$choice" in
            1) update_razorpay_only ;;
            2) update_google_only ;;
            3) update_email_only ;;
            4) update_image_service_only ;;
            5) update_database_only ;;
            6) update_urls_only ;;
            7) update_security_only ;;
            8) return 0 ;;
            *) error "Invalid selection. Please choose 1-8." ;;
        esac

        echo
        read -r -p "Press ENTER to return to the update menu..." _ || true
    done
}

# ============================================================
# Full setup
# ============================================================

handle_existing_environment() {
    if [[ ! -f "$ENV_FILE" ]]; then
        EXISTING_ACTION="new"
        return 0
    fi

    section "Existing Environment Detected"
    local permissions owner choice=""
    permissions="$(stat -c '%a' "$ENV_FILE")"
    owner="$(stat -c '%U:%G' "$ENV_FILE")"

    echo "Environment : $ENV_FILE"
    echo "Permissions : $permissions"
    echo "Owner       : $owner"
    echo
    echo "1) Update existing values (preserve current values)"
    echo "2) Recreate all values from scratch"
    echo "3) Cancel"
    echo
    read -r -p "Select [1-3]: " choice || true

    case "$choice" in
        2) EXISTING_ACTION="recreate" ;;
        3) warn "Setup cancelled."; return 2 ;;
        *) EXISTING_ACTION="update" ;;
    esac

    # Production safety: always create a backup before rewriting an existing env.
    backup_existing_env
}

show_configuration_summary() {
    section "Configuration Summary"

    echo "Application URLs:"
    echo "  NEXT_PUBLIC_URL               = ${ENV_VALUES[NEXT_PUBLIC_URL]}"
    echo "  NEXT_PUBLIC_APP_URL           = ${ENV_VALUES[NEXT_PUBLIC_APP_URL]}"
    echo "  NEXTAUTH_URL                  = ${ENV_VALUES[NEXTAUTH_URL]}"
    echo "  NEXT_PUBLIC_BASE_URL          = ${ENV_VALUES[NEXT_PUBLIC_BASE_URL]}"
    echo "  NEXT_PUBLIC_IMAGE_SERVICE_URL = ${ENV_VALUES[NEXT_PUBLIC_IMAGE_SERVICE_URL]}"
    echo

    echo "Database: $([[ -n "${ENV_VALUES[DATABASE_URL]-}" ]] && echo 'configured' || echo 'NOT SET')"
    echo "Email:    $([[ -n "${ENV_VALUES[EMAIL_HOST]-}" ]] && echo 'configured' || echo 'NOT SET')"
    echo "Google:   $([[ -n "${ENV_VALUES[GOOGLE_ID]-}" ]] && echo 'configured' || echo 'NOT SET')"
    echo "Image Service: $([[ -n "${ENV_VALUES[IMAGE_SERVICE_API_KEY]-}" ]] && echo 'configured' || echo 'NOT SET')"
    echo "Razorpay mode: ${ENV_VALUES[RAZORPAY_MODE]}"
    echo "Razorpay Key ID: $([[ -n "${ENV_VALUES[RAZORPAY_KEY_ID]-}" ]] && echo 'configured' || echo 'NOT SET')"
    echo

    echo "Security secrets:"
    local key
    for key in JWT_SECRET NEXTAUTH_SECRET CSRF_SECRET CRON_SECRET; do
        if [[ -n "${ENV_VALUES[$key]-}" ]]; then
            echo "  $key = configured"
        else
            echo "  $key = NOT SET"
        fi
    done
    echo
    echo "Secret values are not displayed."
}

run_setup() {
    section "HomeShoppie Production Environment Setup"

    echo "Application : $APP_NAME"
    echo "User        : $APP_USER"
    echo "Environment : $ENV_FILE"
    echo

    local existing_result=0
    handle_existing_environment || existing_result=$?
    if [[ "$existing_result" -eq 2 ]]; then
        return 0
    elif [[ "$existing_result" -ne 0 ]]; then
        return 1
    fi

    if [[ "${EXISTING_ACTION:-new}" == "update" ]]; then
        load_existing_values
    else
        ENV_VALUES=()
    fi

    configure_defaults
    configure_database
    configure_email
    configure_google
    configure_image_service
    configure_razorpay
    configure_security

    show_configuration_summary

    section "Final Confirmation"
    echo "The environment file will be written to:"
    echo "  $ENV_FILE"
    echo
    echo "Directory permissions: 700"
    echo "File permissions     : 600"
    echo "File owner           : ${APP_USER}:${APP_USER}"
    echo

    if ! prompt_yes_no "Save this configuration?" "Y"; then
        warn "Configuration cancelled. No environment file was changed."
        return 0
    fi

    write_environment_file

    if ! validate_environment_file; then
        error "Environment was written but validation failed."
        return 1
    fi

    configure_pm2

    section "Setup Complete"
    success "HomeShoppie production environment is ready."
    echo
    echo "Environment file: $ENV_FILE"
    echo "Permissions: 600"
    echo "Owner: ${APP_USER}:${APP_USER}"
    echo
    echo "Useful commands:"
    echo "  sudo stat -c '%a %U:%G %n' $ENV_FILE"
    echo "  sudo -u $APP_USER -H pm2 status"
    echo "  sudo -u $APP_USER -H pm2 list"
    echo "  sudo -u $APP_USER -H pm2 env <PM2_ID> | grep IMAGE_SERVICE"
    echo "  sudo -u $APP_USER -H bash -lc 'set -a; source $ENV_FILE; set +a; unset SUDO_COMMAND SUDO_USER SUDO_UID SUDO_GID; pm2 restart $APP_NAME --update-env'"
    echo
}

full_setup() {
    run_setup
}

# ============================================================
# Main menu
# ============================================================

main_menu() {
    while true; do
        section "HomeShoppie Production Environment Manager"

        echo "Application : $APP_NAME"
        echo "Environment : $ENV_FILE"
        echo "User        : $APP_USER"
        echo
        echo "What would you like to do?"
        echo
        echo "  1) Full environment setup"
        echo "  2) Update specific environment"
        echo "  3) View environment status"
        echo "  4) Validate environment"
        echo "  5) Create backup"
        echo "  6) Exit"
        echo

        local choice=""
        read -r -p "Select [1-6]: " choice || true

        case "$choice" in
            1) full_setup ;;
            2) targeted_update_menu ;;
            3) show_environment_status || true ;;
            4) validate_environment_file || true ;;
            5) backup_existing_env || true ;;
            6) success "Goodbye."; exit 0 ;;
            *) error "Invalid selection. Please choose 1-6." ;;
        esac

        echo
        read -r -p "Press ENTER to return to the main menu..." _ || true
    done
}

# ============================================================
# Error handling / start
# ============================================================

on_error() {
    local line="$1"
    local code="$2"
    error "Script failed at line $line with exit code $code."
}

trap 'on_error "$LINENO" "$?"' ERR

check_requirements
ensure_environment_directory
main_menu
