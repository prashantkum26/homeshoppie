#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

# HomeShoppie production deployment for Amazon Linux 2023.
# Run as ec2-user. The script never kills unrelated processes.

APP_NAME="homeshoppie"
APP_USER="ec2-user"
PROJECT_DIR="/home/ec2-user/homeshoppie"
ENV_DIR="/etc/homeshoppie"
ENV_FILE="/etc/homeshoppie/.env.production"
APP_PORT="3000"                 # Keep aligned with Nginx upstream.
NODE_HEAP_MB="512"              # Conservative for a ~1 GiB RAM instance.
MIN_DISK_GB="2"
MIN_AVAILABLE_MB="180"          # Warn only; swap may still allow a build.
HEALTH_ATTEMPTS="15"
HEALTH_WAIT_SECONDS="2"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()     { printf "${BLUE}[%s]${NC} %s\n" "$(date '+%F %T')" "$*"; }
success() { printf "${GREEN}✓ %s${NC}\n" "$*"; }
warn()    { printf "${YELLOW}⚠ %s${NC}\n" "$*"; }
die()     { printf "${RED}✗ %s${NC}\n" "$*" >&2; exit 1; }

on_error() {
  local rc=$?
  trap - ERR
  echo
  warn "Deployment failed (exit code ${rc})."
  echo "User: $(id -un 2>/dev/null || true)"
  echo "Memory status:"
  free -h || true
  echo "PM2 status:"
  pm2 status || true
  echo "Recent ${APP_NAME} logs:"
  pm2 logs "$APP_NAME" --lines 40 --nostream 2>/dev/null || true
  exit "$rc"
}
trap on_error ERR

# If started as root, re-execute as ec2-user so PM2 uses the correct home.
if [[ "$(id -un)" == "root" ]]; then
  id "$APP_USER" >/dev/null 2>&1 || die "User ${APP_USER} does not exist."
  command -v sudo >/dev/null 2>&1 || die "sudo is required to switch to ${APP_USER}."
  exec sudo -u "$APP_USER" -H env HOME="/home/${APP_USER}" \
    PATH="/usr/local/bin:/usr/bin:/bin:/home/${APP_USER}/.local/bin" bash "$0" "$@"
fi
[[ "$(id -un)" == "$APP_USER" ]] || die "Run this script as ${APP_USER}."

log "HomeShoppie deployment starting"
log "Checking operating system and tools"
[[ -r /etc/os-release ]] && . /etc/os-release || true
printf 'OS: %s\n' "${PRETTY_NAME:-unknown}"
command -v node >/dev/null 2>&1 || die "Node.js is not installed."
command -v npm >/dev/null 2>&1 || die "npm is not installed."
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)' || die "Node.js 20+ is required."
command -v pm2 >/dev/null 2>&1 || { warn "PM2 not found; installing it globally."; npm install -g pm2; }
printf 'Node: %s | npm: %s | PM2: %s\n' "$(node -v)" "$(npm -v)" "$(pm2 -v | tail -n 1)"

[[ -d "$PROJECT_DIR" ]] || die "Project directory not found: $PROJECT_DIR"
cd "$PROJECT_DIR"
[[ -f package.json ]] || die "package.json not found in $PROJECT_DIR"
[[ -d "$ENV_DIR" && -f "$ENV_FILE" ]] || die "Production env file not found: $ENV_FILE"

# Secure the external env file; sudo is only used for these privileged file changes.
if [[ "$(stat -c '%a' "$ENV_FILE")" != "600" ]]; then
  if command -v sudo >/dev/null 2>&1; then sudo chmod 600 "$ENV_FILE"; else die "Cannot set env file mode to 600 without sudo."; fi
fi
if [[ "$(stat -c '%U:%G' "$ENV_FILE")" != "${APP_USER}:${APP_USER}" ]]; then
  if command -v sudo >/dev/null 2>&1; then sudo chown "${APP_USER}:${APP_USER}" "$ENV_FILE"; else die "Cannot fix env file owner without sudo."; fi
fi
[[ "$(stat -c '%a' "$ENV_FILE")" == "600" ]] || die "Env file must have mode 600."
[[ "$(stat -c '%U:%G' "$ENV_FILE")" == "${APP_USER}:${APP_USER}" ]] || die "Env file must be owned by ${APP_USER}:${APP_USER}."

# Parse KEY=value lines without sourcing the file as shell code. Supports plain,
# single-quoted, and double-quoted values on one line. Never prints secret values.
log "Loading environment variables from ${ENV_FILE}"
ENV_EXPORTS="$(ENV_FILE="$ENV_FILE" node <<'NODE'
const fs = require('fs');
const file = process.env.ENV_FILE;
const lines = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
function quoteShell(s) { return "'" + s.replace(/'/g, "'\\''") + "'"; }
for (let i = 0; i < lines.length; i++) {
  let line = lines[i].trim();
  if (!line || line.startsWith('#')) continue;
  if (line.startsWith('export ')) line = line.slice(7).trim();
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!m) { console.error(`Invalid environment syntax at line ${i + 1}`); process.exit(2); }
  const key = m[1];
  let value = m[2].trim();
  if (value.length >= 2 && ((value[0] === '"' && value.at(-1) === '"') || (value[0] === "'" && value.at(-1) === "'"))) {
    const q = value[0]; value = value.slice(1, -1);
    if (q === '"') value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  } else {
    value = value.replace(/\s+#.*$/, '').trim();
  }
  process.stdout.write(`export ${key}=${quoteShell(value)}\n`);
}
NODE
)"
eval "$ENV_EXPORTS"
unset ENV_EXPORTS
export NODE_ENV=production PORT="$APP_PORT" NODE_OPTIONS="--max-old-space-size=${NODE_HEAP_MB}"
[[ -n "${DATABASE_URL:-}" ]] || die "DATABASE_URL is missing or empty in ${ENV_FILE}."
[[ -n "${NEXTAUTH_SECRET:-}" ]] || die "NEXTAUTH_SECRET is missing or empty in ${ENV_FILE}."
success "Required environment variables are present; values were not displayed."

# Disk preflight.
AVAILABLE_KB="$(df -Pk "$PROJECT_DIR" | awk 'NR==2 {print $4}')"
AVAILABLE_GB=$((AVAILABLE_KB / 1024 / 1024))
printf 'Available disk: %s GB\n' "$AVAILABLE_GB"
(( AVAILABLE_GB >= MIN_DISK_GB )) || die "Less than ${MIN_DISK_GB} GB disk space available."

print_memory_status() {
  echo
  free -h
  echo "MemAvailable / swap details:"
  awk '/MemTotal:|MemAvailable:|SwapTotal:|SwapFree:/ {print}' /proc/meminfo
  echo "Swap devices:"
  swapon --show 2>/dev/null || true
  echo "Top memory consumers (RSS; KB):"
  ps -eo pid,user,comm,rss,%mem --sort=-rss | head -n 12 || true
  echo
}

log "MEMORY STATUS BEFORE RECLAIM"
print_memory_status
log "Requesting safe reclaim of reclaimable filesystem caches"
# Cache dropping is optional and requires non-interactive sudo. It does not free
# memory owned by live processes and is not a substitute for adding RAM/swap.
if command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
  if sudo -n sh -c 'sync; echo 3 > /proc/sys/vm/drop_caches'; then
    success "Linux was asked to release reclaimable page/dentry/inode caches."
  else
    warn "Cache reclaim was denied or unavailable; continuing without it."
  fi
else
  warn "Passwordless sudo unavailable; skipped cache reclaim. No processes were stopped."
fi
sleep 2
log "MEMORY STATUS AFTER RECLAIM"
print_memory_status
AVAILABLE_MB="$(awk '/MemAvailable:/ {print int($2 / 1024)}' /proc/meminfo)"
if [[ -n "$AVAILABLE_MB" ]] && (( AVAILABLE_MB < MIN_AVAILABLE_MB )); then
  warn "Only ${AVAILABLE_MB} MiB RAM is available. Build may be slow or fail under memory pressure."
  warn "Continuing with a ${NODE_HEAP_MB} MiB V8 heap limit; Node's total RSS can be higher."
fi

# Validate package scripts.
BUILD_SCRIPT="$(node -p "require('./package.json').scripts?.build || ''")"
START_SCRIPT="$(node -p "require('./package.json').scripts?.start || ''")"
LINT_SCRIPT="$(node -p "require('./package.json').scripts?.lint || ''")"
printf 'Build script: %s\nStart script: %s\nLint script: %s\n' "${BUILD_SCRIPT:-<missing>}" "${START_SCRIPT:-<missing>}" "${LINT_SCRIPT:-<missing>}"
[[ -n "$BUILD_SCRIPT" ]] || die "package.json has no build script."
[[ -n "$START_SCRIPT" ]] || die "package.json has no start script."
[[ "$BUILD_SCRIPT" == "next build" ]] || warn "Build script is not exactly 'next build'; using package.json script as configured."
if ! [[ "$START_SCRIPT" =~ ^next[[:space:]]+start([[:space:]]+.*)?$ ]]; then
  die "Expected package.json start script like: \"start\": \"next start\". Found: ${START_SCRIPT}"
fi
[[ -f package-lock.json ]] || die "package-lock.json is required for reproducible npm ci deployments. Commit it first."

# Avoid running npm/chown recursively over the entire repository unless needed.
PROJECT_OWNER="$(stat -c '%U:%G' "$PROJECT_DIR")"
if [[ "$PROJECT_OWNER" != "${APP_USER}:${APP_USER}" ]]; then
  warn "Project root owner is ${PROJECT_OWNER}; repairing project ownership."
  sudo chown -R "${APP_USER}:${APP_USER}" "$PROJECT_DIR"
fi

log "Installing locked dependencies (npm ci)"
npm ci --include=dev
[[ -x ./node_modules/.bin/tsc || ! -f tsconfig.json ]] || die "Local TypeScript compiler missing. Add typescript as a dev dependency and commit package-lock.json."
if [[ -f tsconfig.json ]]; then
  log "Running TypeScript check"
  ./node_modules/.bin/tsc --noEmit
  success "TypeScript check passed."
fi
if [[ -n "$LINT_SCRIPT" ]]; then
  log "Running lint script"
  npm run lint
  success "Lint passed."
else
  warn "No lint script configured; skipping lint."
fi

log "Dependency audit (high severity); findings are reported but do not automatically block deployment"
if npm audit --audit-level=high; then success "npm audit passed."; else warn "npm audit reported high/critical issues or could not reach the registry; review output above."; fi

log "Starting production build with NODE_OPTIONS=${NODE_OPTIONS}"
# Do not manually rm -rf .next; Next.js manages its build output.
npm run build
[[ -d .next ]] || die "Build finished but .next directory is missing."
if [[ -f .next/BUILD_ID ]]; then
  printf 'Build ID: %s\n' "$(cat .next/BUILD_ID)"
else
  warn ".next/BUILD_ID was not found; verify this project's Next.js output mode."
fi
success "Production build completed."

# Do not touch PM2 until the build has succeeded.
log "Checking existing PM2 process"
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  PM2_EXISTED_BEFORE=true
else
  PM2_EXISTED_BEFORE=false
fi

log "Starting/restarting ${APP_NAME} on port ${APP_PORT}"
export NODE_ENV=production PORT="$APP_PORT" NODE_OPTIONS="--max-old-space-size=${NODE_HEAP_MB}"
if [[ "$PM2_EXISTED_BEFORE" == true ]]; then
  pm2 restart "$APP_NAME" --update-env
else
  pm2 start npm --name "$APP_NAME" --cwd "$PROJECT_DIR" -- start -- -p "$APP_PORT"
fi

log "Waiting for application startup"
sleep 3
PM2_STATUS="$(APP_NAME="$APP_NAME" pm2 jlist | node -e '
let s=""; process.stdin.on("data",d=>s+=d); process.stdin.on("end",()=>{try { const a=JSON.parse(s).find(x=>x.name===process.env.APP_NAME); process.stdout.write(a?.pm2_env?.status || "missing"); } catch { process.stdout.write("unknown"); process.exitCode=1; } });')"
printf 'PM2 status: %s\n' "$PM2_STATUS"
if [[ "$PM2_STATUS" != online ]]; then
  pm2 status || true
  pm2 logs "$APP_NAME" --lines 80 --nostream || true
  die "PM2 application is not online."
fi

log "HTTP health check: http://127.0.0.1:${APP_PORT}/"
command -v curl >/dev/null 2>&1 || die "curl is required for the local health check."
HEALTH_OK=false
for attempt in $(seq 1 "$HEALTH_ATTEMPTS"); do
  if curl --silent --show-error --fail --max-time 10 "http://127.0.0.1:${APP_PORT}/" >/dev/null; then HEALTH_OK=true; break; fi
  printf 'Health check %s/%s failed; waiting %s seconds.\n' "$attempt" "$HEALTH_ATTEMPTS" "$HEALTH_WAIT_SECONDS"
  sleep "$HEALTH_WAIT_SECONDS"
done
if [[ "$HEALTH_OK" != true ]]; then
  pm2 status || true
  pm2 logs "$APP_NAME" --lines 80 --nostream || true
  die "HTTP health check failed. Check the application logs and Nginx upstream port."
fi
success "Application is responding over HTTP."

log "Saving PM2 process list"
pm2 save
PM2_SERVICE="pm2-${APP_USER}"
if systemctl is-enabled "$PM2_SERVICE" >/dev/null 2>&1; then
  success "PM2 startup service is enabled: ${PM2_SERVICE}"
else
  warn "PM2 startup service is not confirmed enabled. If not configured, run once:"
  echo "  sudo env PATH=\$PATH:/usr/local/bin pm2 startup systemd -u ${APP_USER} --hp /home/${APP_USER}"
  echo "  pm2 save"
fi

echo
log "FINAL PM2 STATUS"
pm2 status
echo
log "FINAL MEMORY STATUS"
print_memory_status
echo "Listening socket for port ${APP_PORT}:"
ss -lntp 2>/dev/null | grep ":${APP_PORT}" || warn "No listener found for port ${APP_PORT}."
echo
success "HomeShoppie deployment completed successfully."
printf 'App: %s\nDirectory: %s\nEnv file: %s\nPort: %s\nNode heap limit: %s MiB\n' "$APP_NAME" "$PROJECT_DIR" "$ENV_FILE" "$APP_PORT" "$NODE_HEAP_MB"
