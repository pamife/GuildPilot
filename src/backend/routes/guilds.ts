import { Router } from "express";
import { requireOwnerAuth } from "../middleware/authMiddleware";
import { getGuilds, getGuildDetails, updateGuildSettings } from "../services/guildService";

const router = Router();

router.use(requireOwnerAuth);

router.get("/", async (req, res) => {
  try {
    const guilds = await getGuilds();
    res.json(guilds);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const details = await getGuildDetails(req.params.id);
    res.json(details);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/:id/settings", async (req, res) => {
  try {
    const updated = await updateGuildSettings(req.params.id, req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
