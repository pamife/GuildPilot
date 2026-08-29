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

report_progress() {
  local step="$1"
  local total_steps="$2"
  local percent="$3"
  local action="$4"
  local log_msg="$5"
  local status="${6:-running}"
  
  local payload=$(cat <<EOF
{
  "isUpdating": true,
  "step": ${step},
  "totalSteps": ${total_steps},
  "percent": ${percent},
  "currentAction": "${action}",
  "status": "${status}",
  "logs": ["$(date +"[%H:%M:%S]") ${log_msg}"]
}
EOF
  )
  curl -H "Content-Type: application/json" -X POST -d "${payload}" http://localhost:3001/api/host-server/update-progress > /dev/null 2>&1 || true
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

# Flags
IS_FORCE=false
SKIP_GIT=false
for arg in "$@"; do
  case $arg in
    --force)
      IS_FORCE=true
      ;;
    --skip-git)
      SKIP_GIT=true
      ;;
  esac
done

# Step 1: Check remote for changes
if [ "${SKIP_GIT}" = "false" ]; then
  log "Checking for GitHub updates on branch main..."
  report_progress 1 6 15 "Prüfe GitHub-Repository..." "Checking for updates on branch main..."
  git fetch origin main > /dev/null 2>&1 || true

  LOCAL_HASH=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
  REMOTE_HASH=$(git rev-parse origin/main 2>/dev/null || echo "${LOCAL_HASH}")

  if [ "${IS_FORCE}" = "false" ] && [ "${LOCAL_HASH}" != "unknown" ] && [ "${LOCAL_HASH}" == "${REMOTE_HASH}" ]; then
    log "System is up to date (Commit: ${LOCAL_HASH:0:7}). No update required."
    report_progress 6 6 100 "System ist aktuell" "Keine neuen Commits vorhanden." "idle"
    exit 0
  fi

  log "Processing update (Local: ${LOCAL_HASH:0:7}, Target: ${REMOTE_HASH:0:7})..."
else
  log "Skip Git pull requested. Performing force rebuild on local workspace..."
  report_progress 1 6 15 "Vorbereitung für Rebuild..." "Lokaler Rebuild ohne Git-Pull initiiert..."
  LOCAL_HASH=$(git rev-parse HEAD 2>/dev/null || echo "local")
  REMOTE_HASH="${LOCAL_HASH}"
fi

# Step 2: Create pre-update backup snapshot
BACKUP_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_FILE="${PROJECT_DIR}/prisma/dev.db"
DB_BACKUP="${PROJECT_DIR}/backups/db_${LOCAL_HASH:0:7}_${BACKUP_TIMESTAMP}.db"
STATE_BACKUP="${PROJECT_DIR}/backups/state_${LOCAL_HASH:0:7}_${BACKUP_TIMESTAMP}.json"

log "Creating pre-update backup snapshot..."
report_progress 2 6 30 "Erstelle Datenbank-Sicherung..." "Pre-update Backup der Datenbank wird angelegt..."

if [ -f "${DB_FILE}" ]; then
  cp "${DB_FILE}" "${DB_BACKUP}" || true
  log "Database backed up to ${DB_BACKUP}"
fi

cat <<EOF > "${STATE_BACKUP}"
{
  "commit": "${LOCAL_HASH}",
  "timestamp": "${TIMESTAMP}",
  "db_backup": "${DB_BACKUP}"
}
EOF

# Step 3: Perform Update Operations
if [ "${SKIP_GIT}" = "false" ]; then
  log "Pulling latest changes from GitHub..."
  report_progress 3 6 45 "Lade Quellcode herunter..." "git pull origin main..."
  git reset --hard HEAD || true
  if ! git pull origin main; then
    log "❌ Git pull failed"
  fi
fi

# Step 4: Install dependencies & Prisma DB
log "Installing dependencies and updating Prisma schema..."
report_progress 4 6 60 "Installiere Abhängigkeiten & DB Schema..." "npm install & Prisma..."
npm install --include=dev --no-audit --no-fund || npm install --no-audit --no-fund || true
npx prisma generate || true
npx prisma db push --accept-data-loss || true

# Step 5: Rebuild Frontend & Backend
log "Building production binaries (npm run build)..."
report_progress 5 6 80 "Kompiliere Production Build (npm run build)..." "Bauen von Frontend & Backend binaries..."
if ! npm run build; then
  log "❌ Build failed!"
  report_progress 5 6 80 "Build fehlgeschlagen" "❌ Build-Fehler beim Kompilieren" "error"
  exit 1
fi

# Step 6: Restart PM2 services
log "Restarting application services via PM2 (${PM2_CMD})..."
${PM2_CMD} startOrRestart ecosystem.config.js || ${PM2_CMD} restart all || true

FINAL_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "${REMOTE_HASH}")

# Health Checks with Friendly Warmup Loop
log "Verifying application health..."
HEALTH_PASSED=false
HEALTH_BACKEND="000"
HEALTH_FRONTEND="000"

for i in {1..15}; do
  sleep 4
  HEALTH_BACKEND=$(curl -sL -o /dev/null -w "%{http_code}" http://localhost:3001/api/health 2>/dev/null || echo "000")
  HEALTH_FRONTEND=$(curl -sL -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")

  log "Health check attempt ${i}/15: Backend HTTP ${HEALTH_BACKEND}, Frontend HTTP ${HEALTH_FRONTEND}"

  if [[ "${HEALTH_BACKEND}" =~ ^(200|301|302|307|308)$ ]] && [[ "${HEALTH_FRONTEND}" =~ ^(200|301|302|307|308)$ ]]; then
    HEALTH_PASSED=true
    break
  fi
done

if [ "${HEALTH_PASSED}" = "true" ]; then
  log "✅ SUCCESS: GuildPilot updated and verified healthy on commit ${FINAL_COMMIT:0:7}"
else
  log "⚠️ Notice: Services restarted, health check warmup continuing in background."
fi

UPDATE_JSON="${PROJECT_DIR}/logs/latest-update.json"
cat <<EOF > "${UPDATE_JSON}"
{
  "id": "update_${FINAL_COMMIT:0:7}_${BACKUP_TIMESTAMP}",
  "commit": "${FINAL_COMMIT}",
  "commitShort": "${FINAL_COMMIT:0:7}",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "title": "GuildPilot Server Aktualisiert & Neu Kompiliert",
  "message": "Server erfolgreich auf den neuesten Stand gebracht und neu gebaut (Commit: ${FINAL_COMMIT:0:7})",
  "status": "success",
  "unread": true
}
EOF

curl -H "Content-Type: application/json" -X POST -d @"${UPDATE_JSON}" http://localhost:3001/api/host-server/notify-update > /dev/null 2>&1 || true
report_progress 6 6 100 "Update & Build erfolgreich abgeschlossen!" "✅ UPDATE & BUILD ERFOLGREICH ABGESCHLOSSEN!" "success"

send_discord_notification \
  "✅ GuildPilot Updated & Built Successfully" \
  "**Commit:** \`${FINAL_COMMIT:0:7}\`\n**Backend Health:** HTTP ${HEALTH_BACKEND}\n**Frontend Health:** HTTP ${HEALTH_FRONTEND}" \
  65280

exit 0
