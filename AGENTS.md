# 🤖 GuildPilot AI Assistant Guidelines

## 📌 Host & Deployment Architecture
- **Production Host Operating System:** Debian 13 with Docker Compose.
- **Primary production path:** `compose.yaml` builds separate frontend and backend containers.
- **Persistent data:** SQLite is mounted at `/data/guildpilot.db`; transcripts are mounted at `/app/transcripts`.
- **Updates:** Run `git pull --ff-only`, `docker compose build`, and `docker compose up -d` on the host. Do not run Git or PM2 update logic inside containers.
- **Legacy support:** PM2, Kali-oriented scripts, and systemd units remain for older bare-metal installations only.

---

## ⚠️ Critical Rules for AI Assistants
1. **Always Verify Builds:** Any code change or commit to `main` MUST compile cleanly with `npm run build` without TypeScript or Next.js build errors.
2. **Environment Awareness:** Keep Docker/Debian production and Windows local development compatible. Preserve legacy scripts unless intentionally migrating them.
3. **Database Integrity:** Docker stores SQLite at `/data/guildpilot.db`; legacy local development stores it at `prisma/dev.db`. Never run destructive schema drops or bypass backups.
4. **Port Allocation:**
   - **Backend API & Bot:** Port `3001` (`src/backend/server.ts` / `dist/backend/server.js`)
   - **Web Dashboard:** Port `3000` (`src/app` / `server-frontend.js`)
5. **Real-time Sync:** Socket.IO is used to stream live telemetry, update progress, and bot stats between backend and dashboard.
