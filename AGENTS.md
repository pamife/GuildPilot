# 🤖 GuildPilot AI Assistant Guidelines

## 📌 Host & Deployment Architecture
- **Production Host Operating System:** Linux (Kali Linux environment).
- **Auto-Sync & Deployment Engine:** The Linux Kali server runs 24/7 and automatically checks GitHub (`origin/main`) for updates.
- **Update Workflow:** When updates are detected, the host executes the update engine (`scripts/auto-update.js` / `scripts/auto-update.sh`), which:
  1. Creates a SQLite database backup in `backups/`
  2. Pulls new commits (`git pull origin main`)
  3. Installs dependencies (`npm install --no-audit --no-fund`)
  4. Synchronizes Prisma Client & Database Schema (`npx prisma generate` & `npx prisma db push`)
  5. Compiles production binaries (`npm run build` -> `tsc` for Backend + `next build` for Frontend)
  6. Restarts services via PM2 (`ecosystem.config.js`)

---

## ⚠️ Critical Rules for AI Assistants
1. **Always Verify Builds:** Any code change or commit to `main` MUST compile cleanly with `npm run build` without TypeScript or Next.js build errors. If the build breaks, the Kali server's update pipeline will fail.
2. **Environment Awareness:** Ensure all scripts and paths remain compatible with both Linux (Kali Linux host) and Windows (local development).
3. **Database Integrity:** SQLite database is located at `prisma/dev.db`. Never run destructive schema drops or bypass migrations without backups.
4. **Port Allocation:**
   - **Backend API & Bot:** Port `3001` (`src/backend/server.ts` / `dist/backend/server.js`)
   - **Web Dashboard:** Port `3000` (`src/app` / `server-frontend.js`)
5. **Real-time Sync:** Socket.IO is used to stream live telemetry, update progress, and bot stats between backend and dashboard.
