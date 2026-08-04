import { Router } from "express";
import { discordClient } from "../bot/client";
import {
  getSelfRolePanels,
  getSelfRolePanelById,
  createSelfRolePanel,
  updateSelfRolePanel,
  deleteSelfRolePanel,
  duplicateSelfRolePanel,
} from "../services/selfRoleService";
import { deploySelfRolePanelEmbed, refreshSelfRolePanelMessage } from "../bot/selfRoleHandler";

const router = Router();

// GET all panels for a guild
router.get("/:guildId/self-roles/panels", async (req, res) => {
  try {
    const panels = await getSelfRolePanels(req.params.guildId);
    res.json(panels);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch self role panels" });
  }
});

// GET single panel by ID
router.get("/:guildId/self-roles/panels/:panelId", async (req, res) => {
  try {
    const panel = await getSelfRolePanelById(req.params.panelId);
    if (!panel) return res.status(404).json({ error: "Panel not found" });
    res.json(panel);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch panel" });
  }
});

// POST create panel
router.post("/:guildId/self-roles/panels", async (req, res) => {
  try {
    const panel = await createSelfRolePanel(req.params.guildId, req.body);
    res.json(panel);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create self role panel" });
  }
});

// PUT update panel
router.put("/:guildId/self-roles/panels/:panelId", async (req, res) => {
  try {
    const panel = await updateSelfRolePanel(req.params.panelId, req.body);

    // If panel is already published on Discord, automatically refresh live message
    if (panel.channelId && panel.messageId && discordClient.isReady()) {
      refreshSelfRolePanelMessage(discordClient, panel.id).catch((e) =>
        console.warn("Failed to auto-refresh live self role message:", e)
      );
    }

    res.json(panel);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update self role panel" });
  }
});

// DELETE panel
router.delete("/:guildId/self-roles/panels/:panelId", async (req, res) => {
  try {
    await deleteSelfRolePanel(req.params.panelId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete self role panel" });
  }
});

// POST duplicate panel
router.post("/:guildId/self-roles/panels/:panelId/duplicate", async (req, res) => {
  try {
    const newPanel = await duplicateSelfRolePanel(req.params.panelId);
    res.json(newPanel);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to duplicate panel" });
  }
});

// POST deploy panel to Discord channel
router.post("/:guildId/self-roles/panels/:panelId/post", async (req, res) => {
  console.log("[SEND] request received");
  try {
    if (!discordClient.isReady()) {
      console.log("[SEND] Discord bot is not ready");
      return res.status(400).json({ error: "Discord bot is not online or ready." });
    }

    const result = await deploySelfRolePanelEmbed(discordClient, req.params.guildId, req.params.panelId);
    console.log("[SEND] API response sent");
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error("[SEND] Error posting panel:", err);
    res.status(500).json({ error: err.message || "Failed to post panel to Discord" });
  }
});

// POST refresh live Discord message button counts
router.post("/:guildId/self-roles/panels/:panelId/refresh", async (req, res) => {
  try {
    if (!discordClient.isReady()) {
      return res.status(400).json({ error: "Discord bot is not online or ready." });
    }

    await refreshSelfRolePanelMessage(discordClient, req.params.panelId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to refresh message" });
  }
});

export default router;
