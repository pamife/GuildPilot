import { Router } from "express";
import { requireOwner } from "../middleware/authMiddleware";
import { collectHostMetrics } from "../services/hostMonitorService";
import {
  getLatestUpdate,
  notifyUpdate,
  markUpdateAsRead,
  checkOrTriggerUpdate,
  forceRebuild,
  getUpdateProgress,
  updateProgressState,
  resetUpdateProgress,
} from "../services/updateService";
import { getNextRestartTime, triggerImmediateRestart } from "../services/hourlyRestartService";

const router = Router();

// Strikter Schutz: Alle Host-System- und Telemetrie-Endpunkte sind OWNER ONLY
router.use((req, res, next) => {
  // Lokale Systemskripte (127.0.0.1) für internen Update-Fortschritt zulassen
  const isLoopback =
    req.ip === "127.0.0.1" ||
    req.ip === "::1" ||
    req.ip === "::ffff:127.0.0.1" ||
    req.socket.remoteAddress === "127.0.0.1" ||
    req.socket.remoteAddress === "::1";

  if (isLoopback && (req.path === "/update-progress" || req.path === "/notify-update")) {
    return next();
  }

  return requireOwner(req, res, next);
});


router.get("/metrics", async (req, res) => {
  try {
    const metrics = await collectHostMetrics();
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: "Failed to collect host metrics" });
  }
});

// GET scheduled hourly restart info
router.get("/hourly-restart-info", (req, res) => {
  const info = getNextRestartTime();
  res.json(info);
});

// POST endpoint to trigger immediate manual system restart
router.post("/restart-now", (req, res) => {
  triggerImmediateRestart("Manuell angeforderter System-Neustart via Dashboard");
  res.json({ success: true, message: "System-Neustart initiiert..." });
});

// GET latest server update status
router.get("/updates", (req, res) => {
  const update = getLatestUpdate();
  res.json(update || { unread: false, message: "No update recorded." });
});

// GET active update progress
router.get("/update-progress", (req, res) => {
  const progress = getUpdateProgress();
  res.json(progress);
});

// POST endpoint for scripts to report active update progress & logs
router.post("/update-progress", (req, res) => {
  const updated = updateProgressState(req.body);
  res.json({ success: true, progress: updated });
});

// POST endpoint to force reset update state (Fix / Repair Button)
router.post("/reset-update-state", (req, res) => {
  const resetState = resetUpdateProgress();
  res.json({ success: true, progress: resetState });
});

// POST endpoint to trigger immediate update check & install (optionally forced)
router.post("/check-update", async (req, res) => {
  try {
    const force = Boolean(req.body?.force);
    const result = await checkOrTriggerUpdate(true, force);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Update check failed", details: err.message });
  }
});

// POST endpoint to trigger clean rebuild of frontend & backend
router.post("/force-rebuild", async (req, res) => {
  try {
    const skipGit = Boolean(req.body?.skipGit);
    const result = await forceRebuild(skipGit);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Force rebuild failed", details: err.message });
  }
});

// POST endpoint for auto-update script to post update notifications
router.post("/notify-update", (req, res) => {
  const notification = notifyUpdate(req.body);
  res.json({ success: true, notification });
});

// POST endpoint to mark update as read
router.post("/updates/read", (req, res) => {
  const updated = markUpdateAsRead();
  res.json({ success: updated });
});

export default router;


