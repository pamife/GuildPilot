import { Router } from "express";
import {
  getCustomMessages,
  getCustomMessageById,
  createCustomMessage,
  updateCustomMessage,
  deleteCustomMessage,
  duplicateCustomMessage,
} from "../services/customMessageService";
import { discordClient, isBotReady } from "../bot/client";
import { deployCustomMessage } from "../bot/customMessageHandler";

const router = Router();

// GET /api/guilds/:guildId/custom-messages - List all custom messages
router.get("/:guildId/custom-messages", async (req, res) => {
  try {
    const { guildId } = req.params;
    const messages = await getCustomMessages(guildId);
    res.json(messages);
  } catch (error: any) {
    console.error("Error fetching custom messages:", error);
    res.status(500).json({ error: error.message || "Failed to fetch custom messages" });
  }
});

// GET /api/guilds/:guildId/custom-messages/:id - Get single custom message
router.get("/:guildId/custom-messages/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const msg = await getCustomMessageById(id);
    if (!msg) {
      return res.status(404).json({ error: "Custom message not found" });
    }
    res.json(msg);
  } catch (error: any) {
    console.error("Error fetching custom message:", error);
    res.status(500).json({ error: error.message || "Failed to fetch custom message" });
  }
});

// POST /api/guilds/:guildId/custom-messages - Create new custom message
router.post("/:guildId/custom-messages", async (req, res) => {
  try {
    const { guildId } = req.params;
    const created = await createCustomMessage(guildId, req.body);
    res.status(201).json(created);
  } catch (error: any) {
    console.error("Error creating custom message:", error);
    res.status(500).json({ error: error.message || "Failed to create custom message" });
  }
});

// PUT /api/guilds/:guildId/custom-messages/:id - Update custom message
router.put("/:guildId/custom-messages/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await updateCustomMessage(id, req.body);
    res.json(updated);
  } catch (error: any) {
    console.error("Error updating custom message:", error);
    res.status(500).json({ error: error.message || "Failed to update custom message" });
  }
});

// DELETE /api/guilds/:guildId/custom-messages/:id - Delete custom message
router.delete("/:guildId/custom-messages/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await deleteCustomMessage(id);
    res.json({ success: true, message: "Custom message deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting custom message:", error);
    res.status(500).json({ error: error.message || "Failed to delete custom message" });
  }
});

// POST /api/guilds/:guildId/custom-messages/:id/duplicate - Duplicate custom message
router.post("/:guildId/custom-messages/:id/duplicate", async (req, res) => {
  try {
    const { id } = req.params;
    const duplicated = await duplicateCustomMessage(id);
    res.status(201).json(duplicated);
  } catch (error: any) {
    console.error("Error duplicating custom message:", error);
    res.status(500).json({ error: error.message || "Failed to duplicate custom message" });
  }
});

// POST /api/guilds/:guildId/custom-messages/:id/send - Deploy/Send message to Discord
router.post("/:guildId/custom-messages/:id/send", async (req, res) => {
  try {
    if (!isBotReady()) {
      return res.status(503).json({ error: "Discord bot is not ready or offline." });
    }

    const { guildId, id } = req.params;
    const { channelId } = req.body;

    const result = await deployCustomMessage(discordClient, guildId, id, channelId);
    res.json(result);
  } catch (error: any) {
    console.error("Error sending custom message:", error);
    res.status(500).json({ error: error.message || "Failed to send custom message to Discord" });
  }
});

// POST /api/guilds/:guildId/custom-messages/send-raw - Instant raw send / test send
router.post("/:guildId/custom-messages-send-raw", async (req, res) => {
  try {
    if (!isBotReady()) {
      return res.status(503).json({ error: "Discord bot is not ready or offline." });
    }

    const { guildId } = req.params;
    const { messageData, channelId } = req.body;

    if (!channelId) {
      return res.status(400).json({ error: "channelId is required" });
    }

    const result = await deployCustomMessage(discordClient, guildId, messageData, channelId);
    res.json(result);
  } catch (error: any) {
    console.error("Error sending raw custom message:", error);
    res.status(500).json({ error: error.message || "Failed to send custom message to Discord" });
  }
});

export default router;
