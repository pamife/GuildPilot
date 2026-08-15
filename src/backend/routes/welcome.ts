import { Router } from "express";
import { discordClient } from "../bot/client";
import {
  getWelcomeSetting,
  updateWelcomeSetting,
  getLeaveSetting,
  updateLeaveSetting,
} from "../services/welcomeService";
import { generateGreetingCard } from "../services/welcomeCardGenerator";
import { sendTestWelcome, sendTestLeave } from "../bot/welcomeHandler";

const router = Router();

// GET all greeting settings (Welcome & Leave)
router.get("/:guildId/welcome", async (req, res) => {
  try {
    const [welcome, leave] = await Promise.all([
      getWelcomeSetting(req.params.guildId),
      getLeaveSetting(req.params.guildId),
    ]);
    res.json({ welcome, leave });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch welcome settings" });
  }
});

// POST update Welcome settings
router.post("/:guildId/welcome", async (req, res) => {
  try {
    const updated = await updateWelcomeSetting(req.params.guildId, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save welcome settings" });
  }
});

// POST update Leave / Goodbye settings
router.post("/:guildId/leave", async (req, res) => {
  try {
    const updated = await updateLeaveSetting(req.params.guildId, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save leave settings" });
  }
});

// POST generate a live preview card
router.post("/:guildId/welcome/preview", async (req, res) => {
  try {
    const {
      username = "megaloblatt",
      avatarUrl,
      memberCount = 298,
      serverName = "TheGodGen",
      title = "Welcome @megaloblatt",
      subtitle = "Member #298",
      avatarRingColor = "#00d2d3",
      cardBgColor = "#1e1f22",
      cardBorderColor = "#2b2d31",
      cardBgImage,
      mode = "welcome",
    } = req.body;

    const buffer = await generateGreetingCard({
      username,
      avatarUrl,
      memberCount,
      serverName,
      title,
      subtitle,
      avatarRingColor,
      cardBgColor,
      cardBorderColor,
      cardBgImage,
      mode,
    });

    res.setHeader("Content-Type", "image/png");
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to generate preview card" });
  }
});

// POST send test welcome message to Discord
router.post("/:guildId/welcome/test", async (req, res) => {
  try {
    if (!discordClient.isReady()) {
      return res.status(503).json({ error: "Discord Bot is offline" });
    }

    const result = await sendTestWelcome(discordClient, req.params.guildId, req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to send test welcome message" });
  }
});

// POST send test leave message to Discord
router.post("/:guildId/leave/test", async (req, res) => {
  try {
    if (!discordClient.isReady()) {
      return res.status(503).json({ error: "Discord Bot is offline" });
    }

    const result = await sendTestLeave(discordClient, req.params.guildId, req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to send test leave message" });
  }
});

export default router;
