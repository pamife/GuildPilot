import { Router } from "express";
import fs from "fs";
import { discordClient } from "../bot/client";
import {
  getTicketStats,
  getTicketPanels,
  createTicketPanel,
  updateTicketPanel,
  deleteTicketPanel,
  getTicketCategories,
  createTicketCategory,
  deleteTicketCategory,
  getTickets,
  getTicketById,
  updateTicketStatus,
  deleteTicketRecord,
  getTicketLogs,
  getTicketSettings,
  updateTicketSettings,
  createTicketLog,
} from "../services/ticketService";
import { deployTicketPanelEmbed } from "../bot/ticketHandler";
import { getTranscriptFilePath, generateHtmlTranscript } from "../services/transcriptService";
import { TextChannel } from "discord.js";

const router = Router();

// Stats
router.get("/:guildId/tickets/stats", async (req, res) => {
  try {
    const stats = await getTicketStats(req.params.guildId);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch ticket stats" });
  }
});

// Panels CRUD
router.get("/:guildId/tickets/panels", async (req, res) => {
  try {
    const panels = await getTicketPanels(req.params.guildId);
    res.json(panels);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch ticket panels" });
  }
});

router.post("/:guildId/tickets/panels", async (req, res) => {
  try {
    const panel = await createTicketPanel(req.params.guildId, req.body);
    res.json(panel);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create panel" });
  }
});

router.patch("/:guildId/tickets/panels/:panelId", async (req, res) => {
  try {
    const panel = await updateTicketPanel(req.params.panelId, req.body);
    res.json(panel);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update panel" });
  }
});

router.delete("/:guildId/tickets/panels/:panelId", async (req, res) => {
  try {
    const panel = await deleteTicketPanel(req.params.panelId);
    res.json(panel);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete panel" });
  }
});

router.post("/:guildId/tickets/panels/:panelId/deploy", async (req, res) => {
  try {
    const messageId = await deployTicketPanelEmbed(discordClient, req.params.panelId);
    await updateTicketPanel(req.params.panelId, { messageId });
    res.json({ success: true, messageId });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to deploy panel embed" });
  }
});

// Categories CRUD
router.get("/:guildId/tickets/categories", async (req, res) => {
  try {
    const categories = await getTicketCategories(req.params.guildId);
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.post("/:guildId/tickets/categories", async (req, res) => {
  try {
    const { name, description, emoji } = req.body;
    const category = await createTicketCategory(req.params.guildId, name, description, emoji);
    res.json(category);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create category" });
  }
});

router.delete("/:guildId/tickets/categories/:categoryId", async (req, res) => {
  try {
    const cat = await deleteTicketCategory(req.params.categoryId);
    res.json(cat);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete category" });
  }
});

// Tickets List & Actions
router.get("/:guildId/tickets", async (req, res) => {
  try {
    const status = req.query.status as string;
    const search = req.query.search as string;
    const tickets = await getTickets(req.params.guildId, { status, search });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

router.get("/:guildId/tickets/:ticketId", async (req, res) => {
  try {
    const ticket = await getTicketById(req.params.ticketId);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
});

router.post("/:guildId/tickets/:ticketId/action", async (req, res) => {
  try {
    const { action } = req.body;
    const ticket = await getTicketById(req.params.ticketId);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    if (action === "close") {
      await updateTicketStatus(ticket.id, "CLOSED", {
        closedByUserId: "dashboard_owner",
        closedByTag: "Dashboard Owner",
      });
      await createTicketLog({
        guildId: ticket.guildId,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        action: "CLOSED",
        executorId: "dashboard",
        executorTag: "Dashboard",
        details: "Ticket closed via Webpanel",
      });
    } else if (action === "reopen") {
      await updateTicketStatus(ticket.id, "OPEN");
      await createTicketLog({
        guildId: ticket.guildId,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        action: "REOPENED",
        executorId: "dashboard",
        executorTag: "Dashboard",
        details: "Ticket reopened via Webpanel",
      });
    } else if (action === "delete") {
      await createTicketLog({
        guildId: ticket.guildId,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        action: "DELETED",
        executorId: "dashboard",
        executorTag: "Dashboard",
        details: "Ticket record deleted via Webpanel",
      });
      await deleteTicketRecord(ticket.id);
    } else if (action === "transcript") {
      const channel = (await discordClient.channels.fetch(ticket.channelId).catch(() => null)) as TextChannel;
      if (channel && channel.isTextBased()) {
        const filePath = await generateHtmlTranscript(channel, {
          number: ticket.ticketNumber,
          creatorTag: ticket.userTag,
        });
        await updateTicketStatus(ticket.id, ticket.status as any, { transcriptUrl: `/api/guilds/${ticket.guildId}/tickets/transcripts/${ticket.id}/download` });
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to execute action" });
  }
});

// Transcript Download
router.get("/:guildId/tickets/transcripts/:ticketId/download", (req, res) => {
  const filePath = getTranscriptFilePath(req.params.ticketId);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Transcript file not found.");
  }
  res.setHeader("Content-Type", "text/html");
  res.download(filePath, `transcript-ticket-${req.params.ticketId}.html`);
});

// Logs & Settings
router.get("/:guildId/tickets/logs", async (req, res) => {
  try {
    const logs = await getTicketLogs(req.params.guildId);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch ticket logs" });
  }
});

router.get("/:guildId/tickets/settings", async (req, res) => {
  try {
    const settings = await getTicketSettings(req.params.guildId);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.patch("/:guildId/tickets/settings", async (req, res) => {
  try {
    const settings = await updateTicketSettings(req.params.guildId, req.body);
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update settings" });
  }
});

export default router;
