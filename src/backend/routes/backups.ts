import { Router } from "express";
import {
  AuthenticatedRequest,
  requireAuth,
  requireGuildAccess,
  isOwner,
  checkUserGuildPermission,
} from "../middleware/authMiddleware";
import {
  getBackups,
  getBackupById,
  deleteBackup,
  createManualBackup,
  restoreBackup,
  importBackupJson,
} from "../services/backupService";

const router = Router();

router.use(requireAuth);

// Get list of backups (für Owner alle oder gefiltert; für normale User nur für berechtigte Guild)
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const requestedGuildId = req.query.guildId as string;

    if (user.role !== "OWNER" && !isOwner(user.id)) {
      if (!requestedGuildId) {
        return res.status(400).json({ error: "guildId query parameter is required." });
      }
      const perm = await checkUserGuildPermission(user.id, requestedGuildId);
      if (!perm.allowed) {
        return res.status(403).json({ error: perm.reason || "Forbidden." });
      }
    }

    const backups = await getBackups({ guildId: requestedGuildId });
    res.json(backups);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single backup
router.get("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const backup = await getBackupById(req.params.id);
    if (!backup) return res.status(404).json({ error: "Backup not found" });

    if (user.role !== "OWNER" && !isOwner(user.id)) {
      const perm = await checkUserGuildPermission(user.id, backup.guildId);
      if (!perm.allowed) {
        return res.status(403).json({ error: "Forbidden. Access to this backup is restricted." });
      }
    }

    res.json(backup);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Download / Export backup as JSON
router.get("/:id/download", async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const backup = await getBackupById(req.params.id);
    if (!backup) return res.status(404).json({ error: "Backup not found" });

    if (user.role !== "OWNER" && !isOwner(user.id)) {
      const perm = await checkUserGuildPermission(user.id, backup.guildId);
      if (!perm.allowed) {
        return res.status(403).json({ error: "Forbidden. Access to this backup is restricted." });
      }
    }

    const filename = `guildpilot-backup-${backup.guildName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}-${backup.id.substring(0, 8)}.json`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(backup.data, null, 2));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Import backup JSON
router.post("/import", async (req: AuthenticatedRequest, res) => {
  try {
    const backup = await importBackupJson(req.body.data, req.body.name);
    res.json(backup);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create manual backup for a guild
router.post("/guilds/:id", requireGuildAccess("id"), async (req: AuthenticatedRequest, res) => {
  try {
    const backup = await createManualBackup(req.params.id, req.body.name || "Manuelles Backup", req.body.reason);
    res.json(backup);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Restore backup onto target guild
router.post("/guilds/:id/restore/:backupId", requireGuildAccess("id"), async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const backup = await getBackupById(req.params.backupId);
    if (!backup) return res.status(404).json({ error: "Backup snapshot not found." });

    if (user.role !== "OWNER" && !isOwner(user.id)) {
      const perm = await checkUserGuildPermission(user.id, backup.guildId);
      if (!perm.allowed) {
        return res.status(403).json({ error: "Forbidden. You do not have permission for the source backup." });
      }
    }

    const result = await restoreBackup(req.params.id, req.params.backupId, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete backup
router.delete("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const backup = await getBackupById(req.params.id);
    if (!backup) return res.status(404).json({ error: "Backup not found" });

    if (user.role !== "OWNER" && !isOwner(user.id)) {
      const perm = await checkUserGuildPermission(user.id, backup.guildId);
      if (!perm.allowed) {
        return res.status(403).json({ error: "Forbidden. Access to this backup is restricted." });
      }
    }

    const result = await deleteBackup(req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

