#!/usr/bin/env bash
set -Eeuo pipefail

# HomeShoppie - MongoDB single-node replica set (rs0)
# Amazon Linux 2023 / MongoDB 8.0
# Idempotent: safe to execute repeatedly.

MONGO_SERVICE="mongod"
MONGO_CONFIG="/etc/mongod.conf"
MONGO_HOST="127.0.0.1"
MONGO_PORT="27017"
REPLICA_SET_NAME="rs0"
REPLICA_MEMBER="${MONGO_HOST}:${MONGO_PORT}"

ENV_FILE="/etc/homeshoppie/.env.production"
MONGO_DATABASE="homeshoppie"
APP_USER="ec2-user"
APP_NAME="homeshoppie"
APP_DIR="/home/ec2-user/homeshoppie"
APP_PORT="3000"
MAX_WAIT=60

if [[ -t 1 ]]; then
  RED="\033[0;31m"; GREEN="\033[0;32m"; YELLOW="\033[1;33m"; CYAN="\033[0;36m"; NC="\033[0m"
else
  RED=""; GREEN=""; YELLOW=""; CYAN=""; NC=""
fi

log(){ echo -e "${CYAN}[INFO]${NC} $*"; }
ok(){ echo -e "${GREEN}[OK]${NC} $*"; }
warn(){ echo -e "${YELLOW}[WARN]${NC} $*"; }
error(){ echo -e "${RED}[ERROR]${NC} $*" >&2; }
die(){ error "$*"; exit 1; }
section(){ echo; echo "============================================================"; echo " $*"; echo "============================================================"; }
command_exists(){ command -v "$1" >/dev/null 2>&1; }

[[ $EUID -eq 0 ]] || die "Run with sudo: sudo ./setup-mongo-replica.sh"
[[ -f /etc/os-release ]] || die "/etc/os-release not found."
source /etc/os-release
[[ ${ID:-} == "amzn" ]] || die "This script requires Amazon Linux. Detected: ${PRETTY_NAME:-unknown}"
command_exists mongosh || die "mongosh is not installed."
[[ -f "$MONGO_CONFIG" ]] || die "MongoDB config not found: $MONGO_CONFIG"
[[ -f "$ENV_FILE" ]] || die "Environment file not found: $ENV_FILE"

wait_for_mongo() {
  for ((i=1;i<=MAX_WAIT;i++)); do
    if mongosh --quiet --host "$MONGO_HOST" --port "$MONGO_PORT"       --eval 'quit(db.runCommand({ping:1}).ok === 1 ? 0 : 1)' >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

get_replset_name() {
  mongosh --quiet --host "$MONGO_HOST" --port "$MONGO_PORT" --eval '
    try {
      const c=db.adminCommand({getCmdLineOpts:1});
      print(c.parsed?.replication?.replSetName || "");
    } catch(e) { print(""); }
  ' 2>/dev/null | tail -n 1
}

get_rs_status() {
  mongosh --quiet --host "$MONGO_HOST" --port "$MONGO_PORT" --eval '
    try {
      const s=rs.status();
      print(JSON.stringify({ok:1,set:s.set||"",members:s.members||[]}));
    } catch(e) {
      print(JSON.stringify({ok:0,message:e.message||String(e)}));
    }
  ' 2>/dev/null | tail -n 1
}

section "Checking MongoDB"
systemctl enable "$MONGO_SERVICE" >/dev/null 2>&1 || true
systemctl is-active --quiet "$MONGO_SERVICE" || systemctl start "$MONGO_SERVICE"
wait_for_mongo || die "MongoDB is not responding."

section "Configuring replica set"
CURRENT_REPLSET="$(get_replset_name || true)"

if [[ -n "$CURRENT_REPLSET" && "$CURRENT_REPLSET" != "$REPLICA_SET_NAME" ]]; then
  die "MongoDB already uses replica set '$CURRENT_REPLSET', not '$REPLICA_SET_NAME'."
fi

if [[ "$CURRENT_REPLSET" != "$REPLICA_SET_NAME" ]]; then
  cp -a "$MONGO_CONFIG" "${MONGO_CONFIG}.before-rs0"

  if grep -Eq '^[[:space:]]*replication:[[:space:]]*$' "$MONGO_CONFIG"; then
    if grep -Eq '^[[:space:]]+replSetName:' "$MONGO_CONFIG"; then
      sed -i -E "s|^[[:space:]]+replSetName:.*|  replSetName: ${REPLICA_SET_NAME}|" "$MONGO_CONFIG"
    else
      sed -i "/^[[:space:]]*replication:[[:space:]]*$/a\  replSetName: ${REPLICA_SET_NAME}" "$MONGO_CONFIG"
    fi
  else
    cat >> "$MONGO_CONFIG" <<EOF

replication:
  replSetName: ${REPLICA_SET_NAME}
EOF
  fi
  chmod 644 "$MONGO_CONFIG"
  ok "Added replication.replSetName: $REPLICA_SET_NAME"
else
  ok "MongoDB is already configured for replica set $REPLICA_SET_NAME"
fi

section "Restarting MongoDB"
systemctl restart "$MONGO_SERVICE"
wait_for_mongo || {
  journalctl -u "$MONGO_SERVICE" -n 80 --no-pager || true
  die "MongoDB failed to restart."
}
ok "MongoDB restarted"

section "Initializing replica set"
STATUS="$(get_rs_status || true)"

if [[ "$STATUS" == *'"ok":1'* ]]; then
  ok "Replica set is already initialized"
else
  mongosh --quiet --host "$MONGO_HOST" --port "$MONGO_PORT" --eval "
    rs.initiate({
      _id: '${REPLICA_SET_NAME}',
      members: [{ _id: 0, host: '${REPLICA_MEMBER}' }]
    })
  " >/dev/null
  ok "Replica set initialization requested"
fi

section "Waiting for PRIMARY"
PRIMARY="false"
for ((i=1;i<=MAX_WAIT;i++)); do
  STATE="$(mongosh --quiet --host "$MONGO_HOST" --port "$MONGO_PORT" --eval '
    try {
      const h=db.hello();
      print(h.isWritablePrimary ? "PRIMARY" : "NOT_PRIMARY");
    } catch(e) { print("NOT_READY"); }
  ' 2>/dev/null | tail -n 1)"
  if [[ "$STATE" == "PRIMARY" ]]; then PRIMARY="true"; break; fi
  sleep 1
done

[[ "$PRIMARY" == "true" ]] || {
  get_rs_status || true
  journalctl -u "$MONGO_SERVICE" -n 50 --no-pager || true
  die "Replica set did not become PRIMARY within ${MAX_WAIT}s."
}
ok "MongoDB is PRIMARY"

section "Verifying replica set"
FINAL_STATUS="$(get_rs_status || true)"
[[ "$FINAL_STATUS" == *'"ok":1'* ]] || die "Replica-set status verification failed."

MEMBER_COUNT="$(FINAL_STATUS="$FINAL_STATUS" node -e '
try {
 const x=JSON.parse(process.env.FINAL_STATUS);
 console.log((x.members||[]).length);
} catch { console.log(0); }
')"
[[ "$MEMBER_COUNT" == "1" ]] || die "Expected 1 replica-set member, found $MEMBER_COUNT."
[[ "$FINAL_STATUS" == *"$REPLICA_MEMBER"* ]] || die "Replica member $REPLICA_MEMBER not found."
ok "Replica set $REPLICA_SET_NAME has exactly one member: $REPLICA_MEMBER"

section "Updating DATABASE_URL"
CURRENT_DATABASE_URL="$(node <<'NODE'
const fs=require("fs");
const lines=fs.readFileSync("/etc/homeshoppie/.env.production","utf8").split(/\r?\n/);
for(const raw of lines){
  const line=raw.trim();
  if(!line || line.startsWith("#")) continue;
  const m=line.match(/^DATABASE_URL\s*=\s*(.*)$/);
  if(!m) continue;
  let v=m[1].trim();
  if(v.length>=2 && ((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))) v=v.slice(1,-1);
  process.stdout.write(v); break;
}
NODE
)"
[[ -n "$CURRENT_DATABASE_URL" ]] || die "DATABASE_URL not found in $ENV_FILE"

NEW_DATABASE_URL="$(DATABASE_URL="$CURRENT_DATABASE_URL" node <<'NODE'
try {
  const u=new URL(process.env.DATABASE_URL);
  if(u.protocol!=="mongodb:" && u.protocol!=="mongodb+srv:") throw new Error("DATABASE_URL is not a MongoDB URL");
  u.searchParams.set("replicaSet","rs0");
  process.stdout.write(u.toString());
} catch(e) { console.error(e.message); process.exit(1); }
NODE
)"

TMP_ENV="$(mktemp)"
awk -v new_url="$NEW_DATABASE_URL" '
BEGIN{found=0}
/^[[:space:]]*DATABASE_URL[[:space:]]*=/{
  if(!found){print "DATABASE_URL=\"" new_url "\""; found=1}
  next
}
{print}
END{if(!found){print ""; print "DATABASE_URL=\"" new_url "\""}}
' "$ENV_FILE" > "$TMP_ENV"
chown "$APP_USER:$APP_USER" "$TMP_ENV"
chmod 600 "$TMP_ENV"
mv "$TMP_ENV" "$ENV_FILE"

REPLICA_FROM_URL="$(DATABASE_URL="$NEW_DATABASE_URL" node -e '
const u=new URL(process.env.DATABASE_URL); console.log(u.searchParams.get("replicaSet")||"");
')"
[[ "$REPLICA_FROM_URL" == "$REPLICA_SET_NAME" ]] || die "DATABASE_URL replicaSet verification failed."
ok "DATABASE_URL updated with replicaSet=$REPLICA_SET_NAME"

section "Restarting HomeShoppie PM2"
if command_exists pm2; then
  sudo -u "$APP_USER" -H bash -s -- "$APP_NAME" "$APP_DIR" <<'PM2'
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
PM2
else
  warn "PM2 is not installed; skipping PM2 restart."
fi

section "Final verification"
FINAL_STATE="$(mongosh --quiet --host "$MONGO_HOST" --port "$MONGO_PORT" --eval '
try {
 const h=db.hello(); const s=rs.status();
 print(JSON.stringify({set:s.set,primary:h.isWritablePrimary,members:s.members.length}));
} catch(e) { print(JSON.stringify({error:e.message||String(e)})); quit(1); }
')"
echo "$FINAL_STATE"
[[ "$FINAL_STATE" == *'"primary":true'* ]] || die "Final PRIMARY verification failed."
[[ "$(stat -c '%a' "$ENV_FILE")" == "600" ]] || die "Environment file is not mode 600."

echo
ok "MongoDB replica-set setup completed successfully"
echo "  Replica set : $REPLICA_SET_NAME"
echo "  Member      : $REPLICA_MEMBER"
echo "  State       : PRIMARY"
echo "  Members     : $MEMBER_COUNT"
echo "  Env file    : $ENV_FILE"
echo "  Prisma       : MongoDB transactions enabled"
