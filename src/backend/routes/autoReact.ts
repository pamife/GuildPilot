import { Router } from "express";
import {
  getAutoReacts,
  createAutoReact,
  updateAutoReact,
  deleteAutoReact,
  toggleAutoReact,
} from "../services/autoReactService";

const router = Router();

// GET all auto-react rules for a guild
router.get("/:guildId/auto-reacts", async (req, res) => {
  try {
    const rules = await getAutoReacts(req.params.guildId);
    res.json(rules);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch auto react rules" });
  }
});

// POST create new auto-react rule
router.post("/:guildId/auto-reacts", async (req, res) => {
  try {
    const rule = await createAutoReact(req.params.guildId, req.body);
    res.json(rule);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create auto react rule" });
  }
});

// PUT update auto-react rule
router.put("/:guildId/auto-reacts/:id", async (req, res) => {
  try {
    const rule = await updateAutoReact(req.params.id, req.body);
    res.json(rule);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update auto react rule" });
  }
});

// DELETE auto-react rule
router.delete("/:guildId/auto-reacts/:id", async (req, res) => {
  try {
    await deleteAutoReact(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete auto react rule" });
  }
});

// PATCH toggle auto-react rule
router.patch("/:guildId/auto-reacts/:id/toggle", async (req, res) => {
  try {
    const updated = await toggleAutoReact(req.params.id);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to toggle auto react rule" });
  }
});

export default router;
