import { Router } from "express";
import { requireOwnerAuth } from "../middleware/authMiddleware";
import {
  bulkCreateChannels,
  bulkRenameChannels,
  searchGuildItems,
  getServerPurgeSummary,
  purgeServerData,
} from "../services/utilityService";

const router = Router();

router.use(requireOwnerAuth);

router.post("/:id/bulk-channels", async (req, res) => {
  try {
    const { channels } = req.body;
    const result = await bulkCreateChannels(req.params.id, channels);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:id/bulk-rename", async (req, res) => {
  try {
    const { renames } = req.body;
    const result = await bulkRenameChannels(req.params.id, renames);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id/search", async (req, res) => {
  try {
    const query = req.query.q as string;
    const results = await searchGuildItems(req.params.id, query);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Purge Summary (counts of deletable items)
router.get("/:id/purge-summary", async (req, res) => {
  try {
    const summary = await getServerPurgeSummary(req.params.id);
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Execute Server Purge / Delete Everything
router.post("/:id/purge", async (req, res) => {
  try {
    const results = await purgeServerData(req.params.id, req.body);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
