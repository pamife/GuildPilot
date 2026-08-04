import { broadcastEvent } from "../socket/socketManager";
import { resetUpdateProgress } from "./updateService";
import { exec } from "child_process";

let nextRestartTimestamp: Date = getNextHourlyTimestamp();
let restartTimer: NodeJS.Timeout | null = null;

function getNextHourlyTimestamp(): Date {
  const now = new Date();
  const next = new Date(now);
  next.setHours(now.getHours() + 1);
  next.setMinutes(0);
  next.setSeconds(0);
  next.setMilliseconds(0);
  return next;
}

export function getNextRestartTime(): { nextRestart: string; minutesRemaining: number } {
  const now = new Date();
  const diffMs = Math.max(0, nextRestartTimestamp.getTime() - now.getTime());
  const minutesRemaining = Math.ceil(diffMs / (1000 * 60));
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
          console.log("[HourlyRestart] PM2 restart skipped/failed, executing process.exit(0)...");
          process.exit(0);
        }
      });
    } catch (e) {
      process.exit(0);
    }
  }, 1000);
}

export function initHourlyRestartScheduler(): void {
  scheduleNextHourlyRestart();
  console.log(`[HourlyRestart] ⏰ Stündlicher Auto-Neustart aktiviert. Nächster Neustart um ${nextRestartTimestamp.toLocaleTimeString()}`);
}

function scheduleNextHourlyRestart(): void {
  if (restartTimer) clearTimeout(restartTimer);

  nextRestartTimestamp = getNextHourlyTimestamp();
  const msUntilNext = Math.max(1000, nextRestartTimestamp.getTime() - Date.now());

  restartTimer = setTimeout(() => {
    triggerImmediateRestart("Stündlicher automatischer System-Neustart (Cron 60 Min)");
  }, msUntilNext);
}
