import { broadcastEvent } from "../socket/socketManager";
import { resetUpdateProgress, checkOrTriggerUpdate } from "./updateService";
import { exec } from "child_process";

let nextRestartTimestamp: Date = getNextHourlyTimestamp();
let restartTimer: NodeJS.Timeout | null = null;
let autoUpdateInterval: NodeJS.Timeout | null = null;

function getNextHourlyTimestamp(): Date {
  // Always schedule full 60 minutes from current time
  return new Date(Date.now() + 60 * 60 * 1000);
}

export function getNextRestartTime(): { nextRestart: string; minutesRemaining: number } {
  const now = new Date();
  const diffMs = Math.max(0, nextRestartTimestamp.getTime() - now.getTime());
  const minutesRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60)));
  return {
    nextRestart: nextRestartTimestamp.toISOString(),
    minutesRemaining,
  };
}

export function triggerImmediateRestart(reason = "Automatischer stündlicher Neustart"): void {
  console.log(`[HourlyRestart] 🔄 ${reason} wird jetzt durchgeführt...`);
  
  resetUpdateProgress();

  broadcastEvent("systemRestarting", {
    reason,
    timestamp: new Date().toISOString(),
  });

  setTimeout(() => {
    try {
      exec("pm2 restart all", (err) => {
        if (err) {
          console.log("[HourlyRestart] PM2 restart skipped/failed (not running under PM2). Rescheduling next hourly check.");
          scheduleNextHourlyRestart();
        }
      });
    } catch (e) {
      console.log("[HourlyRestart] PM2 restart exception. Rescheduling next hourly check.");
      scheduleNextHourlyRestart();
    }
  }, 1000);
}

export function initHourlyRestartScheduler(): void {
  scheduleNextHourlyRestart();
  console.log(`[HourlyRestart] ⏰ Stündlicher Auto-Neustart aktiviert. Nächster regulärer Neustart um ${nextRestartTimestamp.toLocaleTimeString()}`);

  // Recurring background GitHub check every 10 minutes (checking only, no automatic forced reboot)
  if (autoUpdateInterval) clearInterval(autoUpdateInterval);
  
  // Initial check 30 seconds after server startup (non-installing check)
  setTimeout(() => {
    checkOrTriggerUpdate(false).catch(() => {});
  }, 30000);

  autoUpdateInterval = setInterval(() => {
    checkOrTriggerUpdate(false).catch(() => {});
  }, 10 * 60 * 1000); // Check every 10 minutes non-intrusively
}

function scheduleNextHourlyRestart(): void {
  if (restartTimer) clearTimeout(restartTimer);

  nextRestartTimestamp = getNextHourlyTimestamp();
  const msUntilNext = Math.max(60000, nextRestartTimestamp.getTime() - Date.now());

  restartTimer = setTimeout(async () => {
    console.log("[HourlyRestart] ⏰ 60 Minuten abgelaufen. Führe stündlichen Neustart durch...");
    try {
      const updateResult = await checkOrTriggerUpdate(false);
      triggerImmediateRestart("Stündlicher automatischer System-Neustart (Cron 60 Min)");
    } catch {
      triggerImmediateRestart("Stündlicher automatischer System-Neustart (Cron 60 Min)");
    }
  }, msUntilNext);
}
