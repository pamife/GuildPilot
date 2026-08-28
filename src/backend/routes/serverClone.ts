import { Router } from "express";
import {
  AuthenticatedRequest,
  requireAuth,
  checkUserGuildPermission,
  isOwner,
} from "../middleware/authMiddleware";
import { getSourceServerDataSummary, cloneServerModules } from "../services/serverCloneService";

const router = Router();

router.use(requireAuth);

// GET summary of data available on source guild
router.get("/:targetGuildId/clone/summary/:sourceGuildId", async (req: AuthenticatedRequest, res) => {
  try {
    const { targetGuildId, sourceGuildId } = req.params;
    const user = req.user!;

    if (user.role !== "OWNER" && !isOwner(user.id)) {
      const [targetPerm, sourcePerm] = await Promise.all([
        checkUserGuildPermission(user.id, targetGuildId),
        checkUserGuildPermission(user.id, sourceGuildId),
      ]);

      if (!targetPerm.allowed) {
        return res.status(403).json({ error: targetPerm.reason || "No permission on target server." });
      }
      if (!sourcePerm.allowed) {
        return res.status(403).json({ error: sourcePerm.reason || "No permission on source server." });
      }
    }

    const summary = await getSourceServerDataSummary(sourceGuildId, targetGuildId);
    res.json(summary);
  } catch (error: any) {
    console.error("[Clone Route] Error fetching source summary:", error);
    res.status(500).json({ error: error.message || "Failed to fetch source server summary" });
  }
});

// POST execute clone / import from source to target
router.post("/:targetGuildId/clone/:sourceGuildId", async (req: AuthenticatedRequest, res) => {
  try {
    const { targetGuildId, sourceGuildId } = req.params;
    const user = req.user!;

    if (user.role !== "OWNER" && !isOwner(user.id)) {
      const [targetPerm, sourcePerm] = await Promise.all([
        checkUserGuildPermission(user.id, targetGuildId),
        checkUserGuildPermission(user.id, sourceGuildId),
      ]);

      if (!targetPerm.allowed) {
        return res.status(403).json({ error: targetPerm.reason || "No permission on target server." });
      }
      if (!sourcePerm.allowed) {
        return res.status(403).json({ error: sourcePerm.reason || "No permission on source server." });
      }
    }

    const options = req.body;
    const result = await cloneServerModules(targetGuildId, sourceGuildId, options);
    res.json(result);
  } catch (error: any) {
    console.error("[Clone Route] Error executing clone:", error);
    res.status(500).json({ error: error.message || "Failed to clone server modules" });
  }
});

export default router;

