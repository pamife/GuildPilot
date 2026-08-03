#!/usr/bin/env bash

# ==============================================================================
# GuildPilot Automatic Sync & Rollback Engine
# ==============================================================================

set -e

# Resolve project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_DIR}"

# Ensure directories exist
mkdir -p "${PROJECT_DIR}/logs"
mkdir -p "${PROJECT_DIR}/backups"

LOG_FILE="${PROJECT_DIR}/logs/auto-update.log"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# Ensure Node, npm, and PM2 paths are available (including systemd & NVM environments)
export PATH="/usr/local/bin:/usr/bin:/bin:${PATH}"
if [ -d "$HOME/.nvm/versions/node" ]; then
  LATEST_NODE=$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -n 1)
  if [ -n "$LATEST_NODE" ]; then
    export PATH="$HOME/.nvm/versions/node/$LATEST_NODE/bin:$PATH"
  fi
fi

# Detect PM2 binary
PM2_CMD="pm2"
if ! command -v pm2 &> /dev/null; then
  if [ -f "${PROJECT_DIR}/node_modules/.bin/pm2" ]; then
    PM2_CMD="${PROJECT_DIR}/node_modules/.bin/pm2"
  elif command -v npx &> /dev/null; then
    PM2_CMD="npx pm2"
  fi
fi

log() {
  echo "[${TIMESTAMP}] $1" | tee -a "${LOG_FILE}"
}

# Load secrets and env vars if present
if [ -f "/etc/guildpilot/secrets.env" ]; then
  set -a
  source /etc/guildpilot/secrets.env
  set +a
elif [ -f "${PROJECT_DIR}/.env" ]; then
  set -a
  source "${PROJECT_DIR}/.env"
  set +a
fi

send_discord_notification() {
  local title="$1"
  local description="$2"
  local color="$3" # Integer color (e.g., 65280 green, 16711680 red)

  if [ -z "${DISCORD_WEBHOOK_URL}" ]; then
    return 0
  fi

  local payload=$(cat <<EOF
{
  "embeds": [
    {
      "title": "${title}",
      "description": "${description}",
      "color": ${color},
      "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
      "footer": { "text": "TheGodGen Auto-Sync Engine" }
    }
  ]
}
EOF
  )

  curl -H "Content-Type: application/json" -X POST -d "${payload}" "${DISCORD_WEBHOOK_URL}" > /dev/null 2>&1 || true
}

# Step 1: Check remote for changes
log "Checking for GitHub updates on branch main..."
git fetch origin main > /dev/null 2>&1

LOCAL_HASH=$(git rev-parse HEAD)
REMOTE_HASH=$(git rev-parse origin/main)

if [ "${LOCAL_HASH}" == "${REMOTE_HASH}" ]; then
  log "System is up to date (Commit: ${LOCAL_HASH:0:7}). No update required."
  exit 0
fi

log "New commit detected on origin/main!"
log "Current Local Hash: ${LOCAL_HASH:0:7}"
log "Target Remote Hash: ${REMOTE_HASH:0:7}"

# Step 2: Create pre-update backup snapshot
BACKUP_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_FILE="${PROJECT_DIR}/prisma/dev.db"
DB_BACKUP="${PROJECT_DIR}/backups/db_${LOCAL_HASH:0:7}_${BACKUP_TIMESTAMP}.db"
STATE_BACKUP="${PROJECT_DIR}/backups/state_${LOCAL_HASH:0:7}_${BACKUP_TIMESTAMP}.json"

log "Creating pre-update backup snapshot..."

if [ -f "${DB_FILE}" ]; then
  cp "${DB_FILE}" "${DB_BACKUP}"
  log "Database backed up to ${DB_BACKUP}"
fi

cat <<EOF > "${STATE_BACKUP}"
{
  "commit": "${LOCAL_HASH}",
  "timestamp": "${TIMESTAMP}",
  "db_backup": "${DB_BACKUP}"
}
EOF

rollback() {
  local error_msg="$1"
  log "❌ UPDATE FAILED: ${error_msg}"
  log "Executing automatic rollback to commit ${LOCAL_HASH:0:7}..."

  git reset --hard "${LOCAL_HASH}" || true

  if [ -f "${DB_BACKUP}" ]; then
    cp "${DB_BACKUP}" "${DB_FILE}" || true
    log "Restored database snapshot from ${DB_BACKUP}"
  fi

  log "Rebuilding previous working state..."
  npm ci || npm install || true
  npx prisma generate || true
  npm run build || true
  ${PM2_CMD} startOrRestart ecosystem.config.js || ${PM2_CMD} restart all || true

  # Record failure notification for Webpanel
  UPDATE_JSON="${PROJECT_DIR}/logs/latest-update.json"
  cat <<EOF > "${UPDATE_JSON}"
{
  "id": "update_${LOCAL_HASH:0:7}_${BACKUP_TIMESTAMP}",
  "commit": "${LOCAL_HASH}",
  "commitShort": "${LOCAL_HASH:0:7}",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "title": "GuildPilot Update Failed",
  "message": "Update failed: ${error_msg}. Rolled back to commit ${LOCAL_HASH:0:7}",
  "status": "error",
  "unread": true
}
EOF

  curl -H "Content-Type: application/json" -X POST -d @"${UPDATE_JSON}" http://localhost:3001/api/host-server/notify-update > /dev/null 2>&1 || true

  send_discord_notification \
    "❌ GuildPilot Update Failed - Rollback Executed" \
    "**Error:** ${error_msg}\n**Rolled back to commit:** \`${LOCAL_HASH:0:7}\`\n**Status:** Restored working state." \
    16711680

  exit 1
}

# Step 3: Perform Update Operations
log "Pulling latest changes from GitHub..."
if ! git pull origin main; then
  rollback "git pull origin main failed"
fi

# Check if dependencies changed
if git diff --name-only "${LOCAL_HASH}" "${REMOTE_HASH}" | grep -E "package(-lock)?\.json" > /dev/null; then
  log "Dependencies changed. Running npm ci..."
  if ! (npm ci || npm install); then
    rollback "npm install failed"
  fi
fi

# Synchronize Prisma Client & Database Schema
log "Synchronizing Prisma Client & Database Schema..."
npx prisma generate || rollback "prisma generate failed"
npx prisma db push --accept-data-loss || rollback "Prisma db push failed"

# Step 4: Rebuild Frontend & Backend
log "Building production binaries (npm run build)..."
if ! npm run build; then
  rollback "npm run build failed"
fi

# Step 5: Restart PM2 services
log "Restarting application services via PM2 (${PM2_CMD})..."
if ! (${PM2_CMD} startOrRestart ecosystem.config.js || ${PM2_CMD} restart all || ${PM2_CMD} start ecosystem.config.js); then
  rollback "PM2 restart failed"
fi

# Step 6: Perform Health Checks
log "Verifying application health..."
sleep 5

HEALTH_BACKEND=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health || echo "000")
HEALTH_FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "000")

if [ "${HEALTH_BACKEND}" != "200" ] || [ "${HEALTH_FRONTEND}" != "200" ]; then
  rollback "Health check failed (Backend: ${HEALTH_BACKEND}, Frontend: ${HEALTH_FRONTEND})"
fi

log "✅ SUCCESS: GuildPilot updated successfully to commit ${REMOTE_HASH:0:7}"

# Record success update notification for Webpanel
UPDATE_JSON="${PROJECT_DIR}/logs/latest-update.json"
cat <<EOF > "${UPDATE_JSON}"
{
  "id": "update_${REMOTE_HASH:0:7}_${BACKUP_TIMESTAMP}",
  "commit": "${REMOTE_HASH}",
  "commitShort": "${REMOTE_HASH:0:7}",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "title": "GuildPilot Server Updated",
  "message": "Server successfully pulled & installed update from GitHub (Commit: ${REMOTE_HASH:0:7})",
  "status": "success",
  "unread": true
}
EOF

curl -H "Content-Type: application/json" -X POST -d @"${UPDATE_JSON}" http://localhost:3001/api/host-server/notify-update > /dev/null 2>&1 || true

send_discord_notification \
  "✅ GuildPilot Updated Successfully" \
  "**New Commit:** \`${REMOTE_HASH:0:7}\`\n**Backend Health:** HTTP 200 OK\n**Frontend Health:** HTTP 200 OK" \
  65280

exit 0
