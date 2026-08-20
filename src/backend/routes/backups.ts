import { Router } from "express";
import { requireOwnerAuth } from "../middleware/authMiddleware";
import {
  getBackups,
  getBackupById,
  deleteBackup,
  createManualBackup,
  restoreBackup,
  importBackupJson,
} from "../services/backupService";

const router = Router();

router.use(requireOwnerAuth);

// Get list of all backups
router.get("/", async (req, res) => {
  try {
    const backups = await getBackups({ guildId: req.query.guildId as string });
    res.json(backups);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single backup
router.get("/:id", async (req, res) => {
  try {
    const backup = await getBackupById(req.params.id);
    res.json(backup);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Download / Export backup as JSON
router.get("/:id/download", async (req, res) => {
  try {
    const backup = await getBackupById(req.params.id);
    const filename = `guildpilot-backup-${backup.guildName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}-${backup.id.substring(0, 8)}.json`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(backup.data, null, 2));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Import backup JSON
router.post("/import", async (req, res) => {
  try {
    const backup = await importBackupJson(req.body.data, req.body.name);
    res.json(backup);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create manual backup for a guild
router.post("/guilds/:id", async (req, res) => {
  try {
    const backup = await createManualBackup(req.params.id, req.body.name || "Manuelles Backup", req.body.reason);
    res.json(backup);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Restore backup onto target guild
router.post("/guilds/:id/restore/:backupId", async (req, res) => {
  try {
    const result = await restoreBackup(req.params.id, req.params.backupId, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete backup
router.delete("/:id", async (req, res) => {
  try {
    const result = await deleteBackup(req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
