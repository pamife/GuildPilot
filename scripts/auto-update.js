const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectDir = path.resolve(__dirname, "..");
const logsDir = path.join(projectDir, "logs");
const updateFile = path.join(logsDir, "latest-update.json");

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

function log(msg) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [AutoUpdate] ${msg}`);
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
  log("Fetching remote changes from GitHub...");
  execSync("git fetch origin main", { cwd: projectDir, stdio: "inherit" });

  const localCommit = execSync("git rev-parse HEAD", { cwd: projectDir }).toString().trim();
  const remoteCommit = execSync("git rev-parse origin/main", { cwd: projectDir }).toString().trim();

  if (localCommit === remoteCommit) {
    log(`Already up to date at commit ${localCommit.substring(0, 7)}.`);
    process.exit(0);
  }

  log(`Updating from ${localCommit.substring(0, 7)} to ${remoteCommit.substring(0, 7)}...`);

  // Step 1: Git Pull
  log("Executing git pull origin main...");
  execSync("git pull origin main", { cwd: projectDir, stdio: "inherit" });

  // Step 2: Prisma Generate & DB Push
  log("Synchronizing Prisma Client & Database Schema...");
  execSync("npx prisma generate", { cwd: projectDir, stdio: "inherit" });
  execSync("npx prisma db push --accept-data-loss", { cwd: projectDir, stdio: "inherit" });

  // Step 3: Build Backend & Frontend
  log("Building production binaries (npm run build)...");
  execSync("npm run build", { cwd: projectDir, stdio: "inherit" });

  // Step 4: PM2 Restart if running under PM2
  try {
    log("Attempting PM2 restart...");
    execSync("pm2 restart all", { cwd: projectDir, stdio: "inherit" });
  } catch (pm2Err) {
    log("PM2 restart skipped or failed (process may be running directly).");
  }

  notifyUpdate({
    commit: remoteCommit,
    commitShort: remoteCommit.substring(0, 7),
    title: "GuildPilot Server Updated",
    message: `Server successfully updated to commit ${remoteCommit.substring(0, 7)}.`,
    status: "success",
  });

  log("✅ UPDATE COMPLETED SUCCESSFULLY!");
} catch (err) {
  console.error("❌ UPDATE FAILED:", err.message);
  notifyUpdate({
    title: "GuildPilot Update Failed",
    message: `Update failed: ${err.message}`,
    status: "error",
  });
  process.exit(1);
}
