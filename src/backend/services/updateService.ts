import fs from "fs";
import path from "path";
import { broadcastEvent } from "../socket/socketManager";
import { isDockerDeployment } from "../config/runtime";

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

export interface UpdateProgressState {
  isUpdating: boolean;
  step: number;
  totalSteps: number;
  percent: number;
  currentAction: string;
  status: "idle" | "checking" | "running" | "success" | "error";
  logs: string[];
  localCommit?: string;
  remoteCommit?: string;
  timestamp: string;
  errorDetails?: string;
}

const LOGS_DIR = path.join(process.cwd(), "logs");
const UPDATE_FILE = path.join(LOGS_DIR, "latest-update.json");
const PROGRESS_FILE = path.join(LOGS_DIR, "update-progress.json");

let activeProgressState: UpdateProgressState = {
  isUpdating: false,
  step: 0,
  totalSteps: 6,
  percent: 0,
  currentAction: "Bereit für Update-Prüfung",
  status: "idle",
  logs: [],
  timestamp: new Date().toISOString(),
};

export function getUpdateProgress(): UpdateProgressState {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = fs.readFileSync(PROGRESS_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === "object") {
        activeProgressState = { ...activeProgressState, ...parsed };
      }
    }
  } catch (e) {}
  return activeProgressState;
}

export function updateProgressState(partial: Partial<UpdateProgressState>): UpdateProgressState {
  const newLogs = partial.logs
    ? [...activeProgressState.logs, ...partial.logs]
    : activeProgressState.logs;

  activeProgressState = {
    ...activeProgressState,
    ...partial,
    logs: newLogs.slice(-100),
    timestamp: new Date().toISOString(),
  };

  try {
    ensureLogsDir();
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(activeProgressState, null, 2), "utf-8");
  } catch (e) {}

  broadcastEvent("updateProgress", activeProgressState);
  return activeProgressState;
}

export function resetUpdateProgress(): UpdateProgressState {
  activeProgressState = {
    isUpdating: false,
    step: 0,
    totalSteps: 6,
    percent: 0,
    currentAction: "Bereit für Update-Prüfung",
    status: "idle",
    logs: [`[${new Date().toLocaleTimeString()}] 🔧 Update-Engine & Status wurden zurückgesetzt.`],
    timestamp: new Date().toISOString(),
  };

  try {
    ensureLogsDir();
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(activeProgressState, null, 2), "utf-8");
  } catch (e) {}

  broadcastEvent("updateProgress", activeProgressState);
  return activeProgressState;
}

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

export async function checkOrTriggerUpdate(
  installIfAvailable = true,
  force = false
): Promise<{
  hasUpdate: boolean;
  localCommit: string;
  remoteCommit: string;
  message: string;
}> {
  if (isDockerDeployment) {
    return {
      hasUpdate: false,
      localCommit: "container",
      remoteCommit: "container",
      message: "Docker-Deployment: Updates werden auf dem Host mit git pull und docker compose build/up eingespielt.",
    };
  }
  const { exec } = await import("child_process");
  const util = await import("util");
  const execPromise = util.promisify(exec);
  const projectDir = process.cwd();

  const timeStr = new Date().toLocaleTimeString();

  updateProgressState({
    isUpdating: true,
    status: "checking",
    step: 1,
    totalSteps: 6,
    percent: 10,
    currentAction: "Prüfe GitHub-Repository auf neue Commits...",
    logs: [`[${timeStr}] Starte GitHub origin/main Abfrage...`],
  });

  try {
    // Step 1: Fetch remote changes
    await execPromise("git fetch origin main", { cwd: projectDir }).catch(() => {});

    // Step 2: Get exact local HEAD commit hash
    let localCommitFull = "unknown";
    try {
      const { stdout: localOut } = await execPromise("git rev-parse HEAD", { cwd: projectDir });
      localCommitFull = localOut.trim();
    } catch (e) {}
    const localCommit = localCommitFull.substring(0, 7);

    // Step 3: Get exact remote origin/main commit hash
    let remoteCommitFull = localCommitFull;
    try {
      const { stdout: remoteOut } = await execPromise("git rev-parse origin/main", { cwd: projectDir });
      remoteCommitFull = remoteOut.trim();
    } catch (e) {}
    const remoteCommit = remoteCommitFull.substring(0, 7);

    if (!force && localCommitFull !== "unknown" && remoteCommitFull !== "unknown" && localCommitFull === remoteCommitFull) {
      updateProgressState({
        isUpdating: false,
        status: "idle",
        step: 6,
        totalSteps: 6,
        percent: 100,
        currentAction: `System ist aktuell (Commit ${localCommit})`,
        localCommit,
        remoteCommit,
        logs: [`[${new Date().toLocaleTimeString()}] ✅ System ist bereits auf dem neuesten Stand (${localCommit}).`],
      });

      return {
        hasUpdate: false,
        localCommit,
        remoteCommit,
        message: `System ist vollständig aktuell auf Commit ${localCommit}.`,
      };
    }

    // Update is available or force triggered!
    const actionMsg = force
      ? `Manueller Rebuild & Update erzwungen (Commit ${remoteCommit})...`
      : `Neues Update gefunden (${remoteCommit}). Starte Prozess...`;

    updateProgressState({
      isUpdating: true,
      status: "running",
      step: 1,
      totalSteps: 6,
      percent: 15,
      currentAction: actionMsg,
      localCommit,
      remoteCommit,
      logs: [
        `[${new Date().toLocaleTimeString()}] 🚀 ${force ? "Erzwungener Rebuild gestartet" : `Neuer Commit auf origin/main erkannt: ${remoteCommit}`}.`,
        `[${new Date().toLocaleTimeString()}] Starte Aktualisierung und Kompilierung...`,
      ],
    });

    if (installIfAvailable) {
      const jsScript = path.join(projectDir, "scripts", "auto-update.js");
      const shScript = path.join(projectDir, "scripts", "auto-update.sh");

      const flags = force ? " --force" : "";
      const cmd = fs.existsSync(jsScript)
        ? `node "${jsScript}"${flags}`
        : process.platform === "win32"
        ? `bash "${shScript}"${flags}`
        : `"${shScript}"${flags}`;

      exec(cmd, { cwd: projectDir }, (updateErr, updateStdout, updateStderr) => {
        if (updateErr) {
          console.error("[UpdateService] Update script execution error:", updateStderr || updateErr.message);
          updateProgressState({
            isUpdating: false,
            status: "error",
            errorDetails: updateStderr || updateErr.message,
            logs: [`[${new Date().toLocaleTimeString()}] ❌ Update-Fehler: ${updateStderr || updateErr.message}`],
          });
        } else {
          console.log("[UpdateService] Update script executed successfully:", updateStdout);
        }
      });

      return {
        hasUpdate: true,
        localCommit,
        remoteCommit,
        message: force
          ? `System wird neu kompiliert und neu gestartet...`
          : `Neues Update (${remoteCommit}) wird im Hintergrund installiert...`,
      };
    } else {
      return {
        hasUpdate: true,
        localCommit,
        remoteCommit,
        message: `Neues Update auf GitHub verfügbar (${remoteCommit}).`,
      };
    }
  } catch (err: any) {
    console.error("[UpdateService] Git check error:", err);
    updateProgressState({
      isUpdating: false,
      status: "error",
      errorDetails: err.message || String(err),
      logs: [`[${new Date().toLocaleTimeString()}] ❌ Fehler beim Update-Check: ${err.message || err}`],
    });
    return {
      hasUpdate: false,
      localCommit: "unknown",
      remoteCommit: "unknown",
      message: `Fehler beim Prüfen auf Updates: ${err.message || err}`,
    };
  }
}

export async function forceRebuild(skipGit = false): Promise<{
  success: boolean;
  message: string;
}> {
  if (isDockerDeployment) {
    return {
      success: false,
      message: "Docker-Deployment: Rebuild auf dem Host mit docker compose build und docker compose up -d ausführen.",
    };
  }
  const { exec } = await import("child_process");
  const projectDir = process.cwd();

  const timeStr = new Date().toLocaleTimeString();

  updateProgressState({
    isUpdating: true,
    status: "running",
    step: 1,
    totalSteps: 6,
    percent: 15,
    currentAction: "Manueller Rebuild & Cache-Bereinigung gestartet...",
    logs: [
      `[${timeStr}] 🔧 Manueller Rebuild angefordert (Clean Build & Restart)...`,
      `[${timeStr}] Starte Kompilierungs-Pipeline...`,
    ],
  });

  const jsScript = path.join(projectDir, "scripts", "auto-update.js");
  const shScript = path.join(projectDir, "scripts", "auto-update.sh");

  const flags = ` --force${skipGit ? " --skip-git" : ""}`;
  const cmd = fs.existsSync(jsScript)
    ? `node "${jsScript}"${flags}`
    : process.platform === "win32"
    ? `bash "${shScript}"${flags}`
    : `"${shScript}"${flags}`;

  exec(cmd, { cwd: projectDir }, (updateErr, updateStdout, updateStderr) => {
    if (updateErr) {
      console.error("[UpdateService] Force rebuild error:", updateStderr || updateErr.message);
      updateProgressState({
        isUpdating: false,
        status: "error",
        errorDetails: updateStderr || updateErr.message,
        logs: [`[${new Date().toLocaleTimeString()}] ❌ Rebuild-Fehler: ${updateStderr || updateErr.message}`],
      });
    } else {
      console.log("[UpdateService] Force rebuild completed successfully:", updateStdout);
    }
  });

  return {
    success: true,
    message: "Rebuild-Prozess wurde im Hintergrund gestartet. Fortschritt wird live übertragen.",
  };
}

