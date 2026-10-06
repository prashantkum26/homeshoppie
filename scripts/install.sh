#!/usr/bin/env bash
# =============================================================================
# Amazon Linux 2023 Server Environment Setup
# HomeShoppie / Next.js deployment
#
# Usage:
#   chmod +x setup-amazon-linux.sh
#   sudo ./setup-amazon-linux.sh
#
# Optional:
#   NODE_MAJOR=20 sudo ./setup-amazon-linux.sh
#   NODE_MAJOR=24 sudo ./setup-amazon-linux.sh
#   INSTALL_MONGODB=false sudo ./setup-amazon-linux.sh
#   INSTALL_NGINX=false sudo ./setup-amazon-linux.sh
#   INSTALL_CERTBOT=false sudo ./setup-amazon-linux.sh
#
# Notes:
# - Safe to run multiple times.
# - Existing packages/services are skipped.
# - MongoDB is optional and defaults to true because the supplied deployment
#   guide uses MongoDB locally on port 27017.
# - AWS Lightsail/EC2 security-group/firewall rules are separate from this
#   script. The script only checks local listening ports.
# =============================================================================
set -Eeuo pipefail
# ----------------------------- Configuration ---------------------------------
NODE_MAJOR="${NODE_MAJOR:-24}"
INSTALL_MONGODB="${INSTALL_MONGODB:-true}"
INSTALL_NGINX="${INSTALL_NGINX:-true}"
INSTALL_CERTBOT="${INSTALL_CERTBOT:-true}"
INSTALL_PM2="${INSTALL_PM2:-true}"
CREATE_SWAP="${CREATE_SWAP:-true}"
SWAP_SIZE_GB="${SWAP_SIZE_GB:-2}"
APP_USER="${APP_USER:-homeshoppie-app}"
APP_DIR="${APP_DIR:-/var/www/homeshoppie}"
APP_PORT="${APP_PORT:-3000}"
MONGO_PORT="${MONGO_PORT:-27017}"
NGINX_HTTP_PORT="${NGINX_HTTP_PORT:-80}"
NGINX_HTTPS_PORT="${NGINX_HTTPS_PORT:-443}"
SSH_PORT="${SSH_PORT:-22}"
# ----------------------------- Colors -----------------------------------------
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    CYAN=''
    NC=''
fi
log() {
    echo -e "${BLUE}[INFO]${NC} $*"
}
success() {
    echo -e "${GREEN}[OK]${NC} $*"
}
warn() {
    echo -e "${YELLOW}[SKIP/WARN]${NC} $*"
}
error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}
section() {
    echo
    echo -e "${CYAN}============================================================${NC}"
    echo -e "${CYAN}$*${NC}"
    echo -e "${CYAN}============================================================${NC}"
}
command_exists() {
    command -v "$1" >/dev/null 2>&1
}
rpm_installed() {
    rpm -q "$1" >/dev/null 2>&1
}
dnf_package_available() {
    dnf info "$1" >/dev/null 2>&1
}
service_exists() {
    systemctl list-unit-files --type=service 2>/dev/null \
        | awk '{print $1}' \
        | grep -qx "$1.service"
}
service_active() {
    systemctl is-active --quiet "$1"
}
port_listening() {
    local port="$1"
    ss -lntH 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]${port}$"
}
install_package() {
    local package="$1"

    # Exact package already installed.
    if rpm_installed "$package"; then
        success "$package is already installed - skipped"
        return 0
    fi

    # Amazon Linux 2023 commonly ships minimal variants.
    # Do not replace them with conflicting full packages.
    case "$package" in
        curl)
            if rpm_installed curl-minimal || command_exists curl; then
                success "curl-minimal/curl is already available - skipped"
                return 0
            fi
            ;;
        gnupg2)
            if rpm_installed gnupg2-minimal || command_exists gpg; then
                success "gnupg2-minimal/gnupg2 is already available - skipped"
                return 0
            fi
            ;;
    esac

    log "Installing $package ..."

    if ! dnf install -y "$package"; then
        error "Failed to install $package"
        return 1
    fi

    success "$package installed"
}

enable_start_service() {
    local service="$1"
    if ! service_exists "$service"; then
        warn "Service $service.service is not installed - skipped"
        return 0
    fi
    if service_active "$service"; then
        success "$service is already running - skipped start"
    else
        log "Starting $service ..."
        systemctl start "$service"
        success "$service started"
    fi
    if systemctl is-enabled --quiet "$service" 2>/dev/null; then
        success "$service is already enabled at boot - skipped"
    else
        systemctl enable "$service" >/dev/null
        success "$service enabled at boot"
    fi
}
# ----------------------------- Root check -------------------------------------
if [[ "${EUID}" -ne 0 ]]; then
    error "Run this script with sudo:"
    echo "  sudo ./setup-amazon-linux.sh"
    exit 1
fi
# ----------------------------- OS check ---------------------------------------
section "Checking operating system"
if [[ -f /etc/os-release ]]; then
    # shellcheck disable=SC1091
    source /etc/os-release
else
    error "/etc/os-release not found"
    exit 1
fi
log "OS: ${PRETTY_NAME:-unknown}"
if [[ "${ID:-}" != "amzn" ]]; then
    warn "This script is designed for Amazon Linux. Detected ID=${ID:-unknown}"
    read -r -p "Continue anyway? [y/N]: " answer
    [[ "${answer}" =~ ^[Yy]$ ]] || exit 1
fi
if [[ "${VERSION_ID:-}" != "2023" ]]; then
    warn "This script is optimized for Amazon Linux 2023."
fi
if ! command_exists dnf; then
    error "dnf is required. This does not look like Amazon Linux 2023."
    exit 1
fi
# ----------------------------- System update ----------------------------------
section "Updating Amazon Linux packages"
log "Refreshing DNF metadata ..."
dnf makecache -y >/dev/null
log "Updating installed packages ..."
dnf upgrade -y --allowerasing
success "System package update complete"
# ----------------------------- Essential packages ----------------------------
section "Installing essential server packages"
# Amazon Linux 2023 normally provides curl-minimal instead of full curl.
# Do NOT force-install the full curl package because curl and curl-minimal conflict.
# We verify that a working curl command is available below.
ESSENTIAL_PACKAGES=(
    wget
    git
    unzip
    tar
    gzip
    zip
    rsync
    jq
    openssl
    ca-certificates
    gcc
    gcc-c++
    make
    python3
    python3-pip
    which
    procps-ng
    iproute
    net-tools
    htop
    vim
)
for package in "${ESSENTIAL_PACKAGES[@]}"; do
    install_package "$package"
done

# ----------------------------- curl -------------------------------------------
# Amazon Linux 2023 normally provides curl-minimal.
# Full curl conflicts with curl-minimal, so accept either.
if command_exists curl; then
    success "curl: $(curl --version | head -n 1) - available"
else
    error "curl is not available. Install curl-minimal before continuing."
    exit 1
fi

# ----------------------------- GnuPG ------------------------------------------
# Amazon Linux 2023 may provide gnupg2-minimal instead of full gnupg2.
if command_exists gpg; then
    success "GnuPG: $(gpg --version | head -n 1) - available"
else
    error "GnuPG is not available."
    exit 1
fi


# ----------------------------- curl -------------------------------------------
# Amazon Linux 2023 may provide either curl-minimal or full curl.
# Both provide the curl command required by this setup script.
if command_exists curl; then
    success "curl: $(curl --version | head -n 1) - already available - skipped"
else
    error "curl is not available. Install curl-minimal or curl before continuing."
    exit 1
fi

# ----------------------------- Git --------------------------------------------
section "Checking Git"
if command_exists git; then
    success "Git: $(git --version)"
else
    error "Git installation failed"
    exit 1
fi
# ----------------------------- Node.js ----------------------------------------
section "Installing Node.js ${NODE_MAJOR}.x"
if command_exists node; then
    CURRENT_NODE="$(node -p 'process.versions.node' 2>/dev/null || true)"
    CURRENT_MAJOR="${CURRENT_NODE%%.*}"
    if [[ "${CURRENT_MAJOR}" == "${NODE_MAJOR}" ]]; then
        success "Node.js ${CURRENT_NODE} already installed - skipped"
    else
        warn "Node.js ${CURRENT_NODE} is installed, but requested major is ${NODE_MAJOR}."
        warn "Leaving existing Node.js unchanged."
        warn "To intentionally change it, manage Node.js separately or use NODE_MAJOR=${CURRENT_MAJOR}."
    fi
else
    log "Installing NodeSource repository for Node.js ${NODE_MAJOR}.x ..."
    curl -fsSL "https://rpm.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    if ! rpm_installed nodejs; then
        dnf install -y nodejs
    fi
    success "Node.js installed: $(node --version)"
fi
if command_exists npm; then
    success "npm: $(npm --version)"
else
    error "npm was not installed with Node.js"
    exit 1
fi
# ----------------------------- pnpm -------------------------------------------
section "Installing pnpm"
if command_exists pnpm; then
    success "pnpm $(pnpm --version) already installed - skipped"
else
    npm install --global pnpm
    success "pnpm $(pnpm --version) installed"
fi
# ----------------------------- PM2 --------------------------------------------
section "Installing PM2"
if [[ "${INSTALL_PM2}" == "true" ]]; then
    if command_exists pm2; then
        success "PM2 $(pm2 --version) already installed - skipped"
    else
        npm install --global pm2
        success "PM2 $(pm2 --version) installed"
    fi
else
    warn "PM2 installation disabled: INSTALL_PM2=${INSTALL_PM2}"
fi
# ----------------------------- Swap -------------------------------------------
section "Checking swap"
if swapon --show --noheadings 2>/dev/null | grep -q .; then
    success "Swap is already enabled - skipped"
    swapon --show
elif [[ "${CREATE_SWAP}" == "true" ]]; then
    if [[ -e /swapfile ]]; then
        warn "/swapfile exists but is not active; attempting to enable it"
        chmod 600 /swapfile
        swapon /swapfile || true
    else
        log "Creating ${SWAP_SIZE_GB}G swap file ..."
        if command_exists fallocate; then
            fallocate -l "${SWAP_SIZE_GB}G" /swapfile
        else
            dd if=/dev/zero of=/swapfile bs=1M count="$((SWAP_SIZE_GB * 1024))" status=progress
        fi
        chmod 600 /swapfile
        mkswap /swapfile >/dev/null
        swapon /swapfile
    fi
    if ! grep -Eq '^[[:space:]]*/swapfile[[:space:]]' /etc/fstab; then
        echo '/swapfile swap swap defaults 0 0' >> /etc/fstab
        success "Swap added to /etc/fstab"
    else
        success "Swap already exists in /etc/fstab - skipped"
    fi
    swapon --show
else
    warn "Swap creation disabled: CREATE_SWAP=${CREATE_SWAP}"
fi
# ----------------------------- Application user -------------------------------
section "Creating application user and directories"
if id "${APP_USER}" >/dev/null 2>&1; then
    success "User ${APP_USER} already exists - skipped"
else
    useradd --system --create-home --shell /bin/bash "${APP_USER}"
    success "Created user ${APP_USER}"
fi
mkdir -p "${APP_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
if [[ -d /home/${APP_USER} ]]; then
    chown "${APP_USER}:${APP_USER}" "/home/${APP_USER}"
fi
success "Application directory: ${APP_DIR}"
# ----------------------------- MongoDB ----------------------------------------
section "MongoDB"
if [[ "${INSTALL_MONGODB}" == "true" ]]; then
    if command_exists mongod || rpm_installed mongodb-org-server || rpm_installed mongodb-org; then
        success "MongoDB is already installed - skipped"
    else
        log "Adding MongoDB 8.0 repository for Amazon Linux 2023 / RHEL 9 compatible systems ..."
        cat > /etc/yum.repos.d/mongodb-org-8.0.repo <<'EOF'
[mongodb-org-8.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/amazon/2023/mongodb-org/8.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://pgp.mongodb.com/server-8.0.asc
EOF
        dnf makecache -y >/dev/null
        dnf install -y mongodb-org
        success "MongoDB installed"
    fi
    if command_exists mongod; then
        success "mongod: $(mongod --version | head -n 1)"
    fi
    enable_start_service mongod
    if port_listening "${MONGO_PORT}"; then
        success "MongoDB is listening on port ${MONGO_PORT}"
    else
        warn "MongoDB service is installed/running, but port ${MONGO_PORT} is not currently listening."
    fi
else
    warn "MongoDB installation disabled: INSTALL_MONGODB=${INSTALL_MONGODB}"
fi
# ----------------------------- Nginx ------------------------------------------
section "Nginx"
if [[ "${INSTALL_NGINX}" == "true" ]]; then
    if command_exists nginx || rpm_installed nginx; then
        success "Nginx is already installed - skipped"
    else
        install_package nginx
    fi
    if command_exists nginx; then
        nginx -t
        enable_start_service nginx
    fi
else
    warn "Nginx installation disabled: INSTALL_NGINX=${INSTALL_NGINX}"
fi
# ----------------------------- Certbot ----------------------------------------
section "Certbot"
if [[ "${INSTALL_CERTBOT}" == "true" ]]; then
    if command_exists certbot || rpm_installed certbot; then
        success "Certbot is already installed - skipped"
    else
        # Amazon Linux repositories may expose different Certbot package names.
        if dnf_package_available certbot; then
            dnf install -y certbot
            success "Certbot installed"
        else
            warn "certbot package is not available in the enabled Amazon Linux repositories."
            warn "Install Certbot separately if you need Let's Encrypt automation."
        fi
    fi
    if command_exists certbot; then
        success "Certbot: $(certbot --version 2>&1)"
    fi
else
    warn "Certbot installation disabled: INSTALL_CERTBOT=${INSTALL_CERTBOT}"
fi
# ----------------------------- Firewall notes ---------------------------------
section "Firewall / network ports"
# Amazon Lightsail/EC2 commonly uses the AWS-side firewall/security-group
# rather than UFW. Do not enable a local firewall automatically because it can
# lock out SSH if rules are incomplete.
if command_exists ufw; then
    warn "UFW is installed, but this script does not enable it automatically."
fi
if command_exists firewall-cmd; then
    log "firewalld detected; leaving its current state unchanged."
    firewall-cmd --state 2>/dev/null || true
fi
cat <<EOF
AWS-side ports you normally need to allow:
  ${SSH_PORT}/TCP   SSH
  ${NGINX_HTTP_PORT}/TCP   HTTP
  ${NGINX_HTTPS_PORT}/TCP   HTTPS
Do NOT expose MongoDB (${MONGO_PORT}) publicly unless you have a specific,
secured requirement. Keep MongoDB bound to localhost where possible.
Application port ${APP_PORT}/TCP normally does NOT need to be exposed publicly
when Nginx reverse-proxies to 127.0.0.1:${APP_PORT}.
EOF
# ----------------------------- Port checks ------------------------------------
section "Port status check"
check_port() {
    local port="$1"
    local name="$2"
    if port_listening "$port"; then
        success "${name}: port ${port} is LISTENING"
    else
        warn "${name}: port ${port} is NOT listening"
    fi
}
check_port "${SSH_PORT}" "SSH"
check_port "${NGINX_HTTP_PORT}" "HTTP/Nginx"
check_port "${NGINX_HTTPS_PORT}" "HTTPS/Nginx"
if [[ "${INSTALL_MONGODB}" == "true" ]]; then
    check_port "${MONGO_PORT}" "MongoDB"
fi
check_port "${APP_PORT}" "Next.js/PM2 application"
echo
log "All listening TCP sockets:"
ss -lntp 2>/dev/null || ss -lnt
# ----------------------------- Service summary -------------------------------
section "Service status"
for service in sshd nginx mongod; do
    if service_exists "${service}"; then
        if service_active "${service}"; then
            success "${service}: RUNNING"
        else
            warn "${service}: installed but NOT running"
        fi
    else
        warn "${service}: not installed"
    fi
done
# ----------------------------- Version summary --------------------------------
section "Installed versions"
printf '%-15s' "OS:"
echo "${PRETTY_NAME:-unknown}"
if command_exists git; then
    printf '%-15s' "Git:"
    git --version
fi
if command_exists node; then
    printf '%-15s' "Node.js:"
    node --version
fi
if command_exists npm; then
    printf '%-15s' "npm:"
    npm --version
fi
if command_exists pnpm; then
    printf '%-15s' "pnpm:"
    pnpm --version
fi
if command_exists pm2; then
    printf '%-15s' "PM2:"
    pm2 --version
fi
if command_exists nginx; then
    printf '%-15s' "Nginx:"
    nginx -v 2>&1
fi
if command_exists mongod; then
    printf '%-15s' "MongoDB:"
    mongod --version | head -n 1
fi
if command_exists certbot; then
    printf '%-15s' "Certbot:"
    certbot --version 2>&1
fi
# ----------------------------- Resources --------------------------------------
section "Server resources"
echo "Memory:"
free -h
echo
echo "Disk:"
df -h /
echo
echo "Kernel:"
uname -a
# ----------------------------- Final instructions -----------------------------
section "Setup complete"
cat <<EOF
Environment setup finished.
Application:
  User:       ${APP_USER}
  Directory:  ${APP_DIR}
  Port:       ${APP_PORT}
Next deployment steps:
  1. Configure GitHub SSH authentication.
  2. Clone/update the application as ${APP_USER}.
  3. Configure ${APP_DIR}/.env.
  4. Run pnpm install.
  5. Run your Prisma generate/database command.
  6. Run pnpm build.
  7. Configure PM2 to run the production app on ${APP_PORT}.
  8. Configure Nginx to proxy to 127.0.0.1:${APP_PORT}.
  9. Configure DNS and Let's Encrypt.
  10. Re-run this script any time; installed components will be skipped.
Useful checks:
  systemctl status nginx
  systemctl status mongod
  sudo -u ${APP_USER} pm2 status
  ss -lntp
  free -h
  df -h
EOF
success "Amazon Linux environment setup completed successfully."
