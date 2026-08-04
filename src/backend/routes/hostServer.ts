import { Router } from "express";
import { collectHostMetrics } from "../services/hostMonitorService";
import {
  getLatestUpdate,
  notifyUpdate,
  markUpdateAsRead,
  checkOrTriggerUpdate,
  getUpdateProgress,
  updateProgressState,
  resetUpdateProgress,
} from "../services/updateService";

const router = Router();

router.get("/metrics", async (req, res) => {
  try {
    const metrics = await collectHostMetrics();
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: "Failed to collect host metrics" });
  }
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

// POST endpoint to trigger immediate update check & install
router.post("/check-update", async (req, res) => {
  try {
    const result = await checkOrTriggerUpdate(true);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Update check failed", details: err.message });
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


