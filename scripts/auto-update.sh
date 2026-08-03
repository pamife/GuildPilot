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
      "footer": { "text": "GuildPilot Auto-Sync Engine" }
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
  pm2 restart ecosystem.config.js || true

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

# Check if Prisma schema changed
if git diff --name-only "${LOCAL_HASH}" "${REMOTE_HASH}" | grep "prisma/schema.prisma" > /dev/null; then
  log "Prisma schema changed. Generating client & running migrations..."
  npx prisma generate || rollback "prisma generate failed"
  if ! npx prisma migrate deploy; then
    log "Prisma migrate deploy failed. Falling back to npx prisma db push..."
    npx prisma db push || rollback "Prisma schema update failed"
  fi
fi

# Step 4: Rebuild Frontend & Backend
log "Building production binaries (npm run build)..."
if ! npm run build; then
  rollback "npm run build failed"
fi

# Step 5: Restart PM2 services
log "Restarting application services via PM2..."
if ! pm2 restart ecosystem.config.js; then
  log "PM2 restart failed, attempting start..."
  pm2 start ecosystem.config.js || rollback "PM2 restart failed"
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

send_discord_notification \
  "✅ GuildPilot Updated Successfully" \
  "**New Commit:** \`${REMOTE_HASH:0:7}\`\n**Backend Health:** HTTP 200 OK\n**Frontend Health:** HTTP 200 OK" \
  65280

exit 0
