import fs from "fs";
import path from "path";
import { broadcastEvent } from "../socket/socketManager";

export interface UpdateNotification {
  id: string;
  commit: string;
  commitShort: string;
  timestamp: string;
  title: string;
  message: string;
  status: "success" | "error";
  unread: boolean;
}

const LOGS_DIR = path.join(process.cwd(), "logs");
const UPDATE_FILE = path.join(LOGS_DIR, "latest-update.json");

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

export function getLatestUpdate(): UpdateNotification | null {
  try {
    ensureLogsDir();
    if (!fs.existsSync(UPDATE_FILE)) {
      return null;
    }
    const data = fs.readFileSync(UPDATE_FILE, "utf-8");
    return JSON.parse(data) as UpdateNotification;
  } catch (err) {
    console.error("[UpdateService] Error reading latest-update.json:", err);
    return null;
  }
}

export function notifyUpdate(payload: Partial<UpdateNotification>): UpdateNotification {
  ensureLogsDir();

  const notification: UpdateNotification = {
    id: payload.id || `update_${Date.now()}`,
    commit: payload.commit || "unknown",
    commitShort: payload.commitShort || payload.commit?.substring(0, 7) || "latest",
    timestamp: payload.timestamp || new Date().toISOString(),
    title: payload.title || "GuildPilot Updated",
    message: payload.message || "Server pulled and installed latest update from GitHub.",
    status: payload.status || "success",
    unread: payload.unread !== undefined ? payload.unread : true,
  };

  try {
    fs.writeFileSync(UPDATE_FILE, JSON.stringify(notification, null, 2), "utf-8");
    console.log(`[UpdateService] Persisted update notification for commit ${notification.commitShort}`);
  } catch (err) {
    console.error("[UpdateService] Failed to write latest-update.json:", err);
  }

  // Broadcast real-time update event via Socket.IO
  broadcastEvent("updateNotification", notification);

  return notification;
}

export function markUpdateAsRead(): boolean {
  try {
    const current = getLatestUpdate();
    if (current && current.unread) {
      current.unread = false;
      fs.writeFileSync(UPDATE_FILE, JSON.stringify(current, null, 2), "utf-8");
      broadcastEvent("updateNotificationRead", { id: current.id });
      return true;
    }
  } catch (err) {
    console.error("[UpdateService] Failed to mark update as read:", err);
  }
  return false;
}

export async function checkOrTriggerUpdate(installIfAvailable = true): Promise<{
  hasUpdate: boolean;
  localCommit: string;
  remoteCommit: string;
  message: string;
}> {
  const { exec } = await import("child_process");
  const projectDir = process.cwd();
  const scriptPath = path.join(projectDir, "scripts", "auto-update.sh");

  return new Promise((resolve) => {
    exec("git fetch origin main && git rev-parse HEAD && git rev-parse origin/main", { cwd: projectDir }, (err, stdout) => {
      if (err) {
        return resolve({
          hasUpdate: false,
          localCommit: "unknown",
          remoteCommit: "unknown",
          message: "Failed to connect to remote GitHub repository.",
        });
      }

      const lines = stdout.trim().split("\n").map((l) => l.trim()).filter(Boolean);
      const localCommit = lines[0] ? lines[0].substring(0, 7) : "unknown";
      const remoteCommit = lines[1] ? lines[1].substring(0, 7) : "unknown";

      if (localCommit === remoteCommit) {
        return resolve({
          hasUpdate: false,
          localCommit,
          remoteCommit,
          message: `System is up to date (Commit: ${localCommit}).`,
        });
      }

      // Update is available!
      if (installIfAvailable) {
        const isWin = process.platform === "win32";
        const cmd = isWin ? `bash "${scriptPath}"` : `"${scriptPath}"`;

        exec(cmd, { cwd: projectDir }, (updateErr, updateStdout, updateStderr) => {
          if (updateErr) {
            console.error("[UpdateService] Update script execution error:", updateStderr || updateErr.message);
          } else {
            console.log("[UpdateService] Update script executed successfully:", updateStdout);
          }
        });

        return resolve({
          hasUpdate: true,
          localCommit,
          remoteCommit,
          message: `New update found (${remoteCommit})! Installing update in background...`,
        });
      } else {
        return resolve({
          hasUpdate: true,
          localCommit,
          remoteCommit,
          message: `New update available on GitHub (${remoteCommit}).`,
        });
      }
    });
  });
}

