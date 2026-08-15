import { Router } from "express";
import { requireOwnerAuth } from "../middleware/authMiddleware";
import { getSourceServerDataSummary, cloneServerModules } from "../services/serverCloneService";

const router = Router();

router.use(requireOwnerAuth);

// GET summary of data available on source guild
router.get("/:targetGuildId/clone/summary/:sourceGuildId", async (req, res) => {
  try {
    const { targetGuildId, sourceGuildId } = req.params;
    const summary = await getSourceServerDataSummary(sourceGuildId, targetGuildId);
    res.json(summary);
  } catch (error: any) {
    console.error("[Clone Route] Error fetching source summary:", error);
    res.status(500).json({ error: error.message || "Failed to fetch source server summary" });
  }
});

// POST execute clone / import from source to target
router.post("/:targetGuildId/clone/:sourceGuildId", async (req, res) => {
  try {
    const { targetGuildId, sourceGuildId } = req.params;
    const options = req.body;
    const result = await cloneServerModules(targetGuildId, sourceGuildId, options);
    res.json(result);
  } catch (error: any) {
    console.error("[Clone Route] Error executing clone:", error);
    res.status(500).json({ error: error.message || "Failed to clone server modules" });
  }
});

export default router;
