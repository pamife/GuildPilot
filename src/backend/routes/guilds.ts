import { Router } from "express";
import {
  AuthenticatedRequest,
  requireAuth,
  requireGuildAccess,
  isOwner,
} from "../middleware/authMiddleware";
import {
  getGuilds,
  getUserManageableGuilds,
  getGuildDetails,
  updateGuildSettings,
} from "../services/guildService";

const router = Router();

// GET /api/guilds - Gibt für Owner alle Server, für normale User nur berechtigte Server zurück
router.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    if (user.role === "OWNER" || isOwner(user.id)) {
      const allGuilds = await getGuilds();
      return res.json(allGuilds);
    }

    const userGuilds = await getUserManageableGuilds(user.id);
    return res.json(userGuilds);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/guilds/:id - Liefert Details nur bei autorisiertem Zugriff
router.get("/:id", requireGuildAccess("id"), async (req, res) => {
  try {
    const details = await getGuildDetails(req.params.id);
    res.json(details);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/guilds/:id/settings - Aktualisiert Einstellungen
router.patch("/:id/settings", requireGuildAccess("id"), async (req, res) => {
  try {
    const updated = await updateGuildSettings(req.params.id, req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

