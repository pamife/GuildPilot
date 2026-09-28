#!/bin/sh
set -eu
umask 077

required_vars="DISCORD_TOKEN DISCORD_CLIENT_ID DISCORD_CLIENT_SECRET DISCORD_REDIRECT_URI ALLOWED_USER_ID JWT_SECRET DATABASE_URL FRONTEND_URL"
for var_name in $required_vars; do
  eval "var_value=\${$var_name:-}"
  if [ -z "$var_value" ]; then
    echo "[GuildPilot] Required environment variable $var_name is missing." >&2
    exit 1
  fi
done

case "$DISCORD_TOKEN$DISCORD_CLIENT_ID$DISCORD_CLIENT_SECRET$ALLOWED_USER_ID$JWT_SECRET" in
  *your_*|*change_me*)
    echo "[GuildPilot] Refusing to start with placeholder credentials." >&2
    exit 1
    ;;
esac

db_path=${DATABASE_URL#file:}
if [ "$db_path" = "$DATABASE_URL" ]; then
  echo "[GuildPilot] DATABASE_URL must use a file: SQLite URL." >&2
  exit 1
fi

mkdir -p "$(dirname "$db_path")" /data/backups /app/transcripts /app/logs

if [ -f "$db_path" ]; then
  backup_path="/data/backups/guildpilot-$(date -u +%Y%m%dT%H%M%SZ).db"
  cp "$db_path" "$backup_path"
  echo "[GuildPilot] Database backup created at $backup_path"
fi

echo "[GuildPilot] Synchronizing Prisma schema without destructive flags..."
./node_modules/.bin/prisma db push --skip-generate
chmod 600 "$db_path"

exec node dist/backend/server.js
