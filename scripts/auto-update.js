const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http");

const projectDir = path.resolve(__dirname, "..");
const logsDir = path.join(projectDir, "logs");
const updateFile = path.join(logsDir, "latest-update.json");

const isForce = process.argv.includes("--force") || process.env.FORCE_REBUILD === "true";
const skipGit = process.argv.includes("--skip-git");

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

function log(msg) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [AutoUpdate] ${msg}`);
}

function reportProgress(step, totalSteps, percent, currentAction, logMsg, status = "running") {
  const timeStr = new Date().toLocaleTimeString();
  const fullLog = logMsg ? `[${timeStr}] ${logMsg}` : null;

  const progressFile = path.join(logsDir, "update-progress.json");
  let existingLogs = [];
  try {
    if (fs.existsSync(progressFile)) {
      const prev = JSON.parse(fs.readFileSync(progressFile, "utf-8"));
      if (Array.isArray(prev.logs)) existingLogs = prev.logs;
    }
  } catch (e) {}

  const logs = fullLog ? [...existingLogs, fullLog].slice(-100) : existingLogs;

  const payload = {
    isUpdating: status === "running" || status === "checking",
    step,
    totalSteps: totalSteps || 6,
    percent,
    currentAction,
    status,
    logs,
    timestamp: new Date().toISOString(),
  };

  try {
    fs.writeFileSync(progressFile, JSON.stringify(payload, null, 2), "utf-8");
  } catch (e) {}

  try {
    const dataStr = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: "localhost",
        port: 3001,
        path: "/api/host-server/update-progress",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(dataStr),
        },
      },
      () => {}
    );
    req.on("error", () => {});
    req.write(dataStr);
    req.end();
  } catch (e) {}
}

function notifyUpdate(payload) {
  const notification = {
    id: payload.id || `update_${Date.now()}`,
    commit: payload.commit || "unknown",
    commitShort: payload.commitShort || payload.commit?.substring(0, 7) || "latest",
    timestamp: new Date().toISOString(),
    title: payload.title || "GuildPilot Server Updated",
    message: payload.message || "",
    status: payload.status || "success",
    unread: true,
  };

  try {
    fs.writeFileSync(updateFile, JSON.stringify(notification, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write latest-update.json:", e);
  }
}

try {
  let localCommit = "unknown";
  let remoteCommit = "unknown";

  try {
    localCommit = execSync("git rev-parse HEAD", { cwd: projectDir }).toString().trim();
  } catch (e) {}

  if (!skipGit) {
    log("Step 1/6: Fetching remote changes from GitHub...");
    reportProgress(1, 6, 15, "Prüfe GitHub-Repository...", "Git fetch origin main gestartet...");
    
    try {
      execSync("git fetch origin main", { cwd: projectDir, stdio: "inherit" });
      remoteCommit = execSync("git rev-parse origin/main", { cwd: projectDir }).toString().trim();
    } catch (fetchErr) {
      log(`Git fetch notice: ${fetchErr.message}`);
      remoteCommit = localCommit;
    }

    if (!isForce && localCommit !== "unknown" && remoteCommit !== "unknown" && localCommit === remoteCommit) {
      log(`System is up to date at commit ${localCommit.substring(0, 7)}.`);
      reportProgress(6, 6, 100, `System ist aktuell (Commit ${localCommit.substring(0, 7)})`, "Keine neuen Commits vorhanden.", "idle");
      process.exit(0);
    }
  } else {
    log("Step 1/6: Skip Git pull requested. Performing force rebuild on local code...");
    reportProgress(1, 6, 15, "Vorbereitung für Rebuild...", "Lokaler Rebuild ohne Git-Pull initiiert...");
    remoteCommit = localCommit;
  }

  log(`Updating / Rebuilding system (Local: ${localCommit.substring(0, 7)}, Target: ${remoteCommit.substring(0, 7)})...`);

  // Step 2: Database Backup (Safe non-blocking backup)
  log("Step 2/6: Creating Database Backup Snapshot...");
  reportProgress(2, 6, 30, "Erstelle Datenbank-Sicherung...", "Backup der SQLite Datenbank vor dem Update...");
  try {
    const backupsDir = path.join(projectDir, "backups");
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
    const dbFile = path.join(projectDir, "prisma", "dev.db");
    if (fs.existsSync(dbFile)) {
      const backupFile = path.join(backupsDir, `db_${localCommit.substring(0, 7)}_${Date.now()}.db`);
      fs.copyFileSync(dbFile, backupFile);
      log(`Database backed up to ${backupFile}`);
    }
  } catch (backupErr) {
    log(`Warning: Database backup skipped or failed (${backupErr.message}). Continuing update...`);
  }

  // Step 3: Git Reset & Git Pull (if not skipGit)
  if (!skipGit) {
    log("Step 3/6: Executing git pull origin main...");
    reportProgress(3, 6, 45, "Lade Quellcode herunter (git pull)...", `Ziel-Commit ${remoteCommit.substring(0, 7)} wird synchronisiert...`);
    try {
      execSync("git reset --hard HEAD", { cwd: projectDir, stdio: "inherit", shell: true });
      execSync("git pull origin main", { cwd: projectDir, stdio: "inherit", shell: true });
    } catch (gitErr) {
      reportProgress(3, 6, 45, `Git Pull fehlgeschlagen: ${gitErr.message}`, `❌ Git Pull-Fehler: ${gitErr.message}`, "error");
      throw gitErr;
    }
  } else {
    reportProgress(3, 6, 45, "Git-Pull übersprungen (Force Rebuild)...", "Verwende aktuellen lokalen Quellcode...");
  }

  // Step 4: NPM Install & Prisma Synchronization
  log("Step 4/6: Installing dependencies and synchronizing Prisma...");
  reportProgress(4, 6, 60, "Installiere Abhängigkeiten & Synchronisiere DB...", "npm install & Prisma generate/db push...");
  try {
    log("Running npm install...");
    execSync("npm install --no-audit --no-fund", { cwd: projectDir, stdio: "inherit", shell: true });
    
    log("Running Prisma generate & push...");
    execSync("npx prisma generate", { cwd: projectDir, stdio: "inherit", shell: true });
    execSync("npx prisma db push --accept-data-loss", { cwd: projectDir, stdio: "inherit", shell: true });
  } catch (depsErr) {
    reportProgress(4, 6, 60, `Abhängigkeiten/Prisma Sync fehlgeschlagen: ${depsErr.message}`, `❌ Dependency/Prisma-Fehler: ${depsErr.message}`, "error");
    throw depsErr;
  }

  // Step 5: Clean Build Backend & Frontend
  log("Step 5/6: Building production binaries (npm run build)...");
  reportProgress(5, 6, 80, "Kompiliere Production Build (npm run build)...", "Bauen von Frontend (Next.js) & Backend (TypeScript)...");
  try {
    execSync("npm run build", { cwd: projectDir, stdio: "inherit", shell: true });
  } catch (buildErr) {
    reportProgress(5, 6, 80, `Build fehlgeschlagen: ${buildErr.message}`, `❌ Build-Fehler: ${buildErr.message}`, "error");
    throw buildErr;
  }

  // Step 6: Restart PM2 services
  log("Step 6/6: Restarting application services...");

  const finalCommit = (() => {
    try {
      return execSync("git rev-parse HEAD", { cwd: projectDir }).toString().trim();
    } catch (e) {
      return remoteCommit || localCommit;
    }
  })();

  notifyUpdate({
    commit: finalCommit,
    commitShort: finalCommit.substring(0, 7),
    title: "GuildPilot Server Aktualisiert & Neu Kompiliert",
    message: `Server erfolgreich aktualisiert und neu gebaut (Commit ${finalCommit.substring(0, 7)}).`,
    status: "success",
  });

  reportProgress(6, 6, 100, `Build & Update erfolgreich abgeschlossen! (Commit ${finalCommit.substring(0, 7)})`, "✅ BUILD & UPDATE ERFOLGREICH ABGESCHLOSSEN!", "success");
  log("✅ BUILD & UPDATE COMPLETED SUCCESSFULLY!");

  try {
    const isWin = process.platform === "win32";
    const npxCmd = isWin ? "npx.cmd" : "npx";
    const localPm2 = path.join(projectDir, "node_modules", ".bin", isWin ? "pm2.cmd" : "pm2");
    const pm2Bin = fs.existsSync(localPm2) ? `"${localPm2}"` : `${npxCmd} pm2`;

    try {
      log(`Restarting services via PM2 (${pm2Bin} startOrRestart ecosystem.config.js)...`);
      execSync(`${pm2Bin} startOrRestart ecosystem.config.js`, { cwd: projectDir, stdio: "inherit", shell: true });
    } catch (e1) {
      execSync(`${pm2Bin} restart all`, { cwd: projectDir, stdio: "inherit", shell: true });
    }
  } catch (pm2Err) {
    log(`PM2 restart skipped or failed (${pm2Err.message}). Standalone/Dev mode active.`);
  }
} catch (err) {
  console.error("❌ UPDATE/BUILD FAILED:", err.message);
  notifyUpdate({
    title: "GuildPilot Update/Build Failed",
    message: `Update/Build failed: ${err.message}`,
    status: "error",
  });
  process.exit(1);
}

