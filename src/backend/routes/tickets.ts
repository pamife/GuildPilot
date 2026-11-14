import { Router } from "express";
import fs from "fs";
import { discordClient } from "../bot/client";
import {
  getTicketStats,
  getTicketPanels,
  getTicketPanelById,
  createTicketPanel,
  updateTicketPanel,
  deleteTicketPanel,
  duplicateTicketPanel,
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
import { closeTicket, deployTicketPanelEmbed, reopenTicket } from "../bot/ticketHandler";
import { validateTicketPanelComponents } from "../utils/ticketComponentValidator";
import { convertLegacyPanelToComponentsV2 } from "../bot/ticketComponentBuilder";
import { getTranscriptFilePath, generateHtmlTranscript } from "../services/transcriptService";
import { ChannelType, DiscordAPIError, RESTJSONErrorCodes, TextChannel } from "discord.js";
import { AuthenticatedRequest, requireGuildAccess } from "../middleware/authMiddleware";

const router = Router();

// Absicherung gegen IDOR: Zugriff nur für berechtigte Nutzer dieses Servers
router.use(requireGuildAccess("guildId"));


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

// Validate Discord Components V2 Panel
router.post("/:guildId/tickets/panels/validate", async (req, res) => {
  try {
    const { containerConfig, ticketTypesConfig } = req.body;
    const result = validateTicketPanelComponents(containerConfig || [], ticketTypesConfig || []);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to validate panel configuration" });
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
    let syncedLive = false;
    if (panel.messageId && panel.channelId) {
      try {
        await deployTicketPanelEmbed(discordClient, panel.id);
        syncedLive = true;
      } catch (syncErr) {
        console.warn(`[Ticket System] Live panel sync warning for panel ${panel.id}:`, syncErr);
      }
    }
    res.json({ ...panel, syncedLive });
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

router.post("/:guildId/tickets/panels/:panelId/duplicate", async (req, res) => {
  try {
    const duplicated = await duplicateTicketPanel(req.params.panelId);
    res.json(duplicated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to duplicate panel" });
  }
});

router.post("/:guildId/tickets/panels/:panelId/migrate-v2", async (req, res) => {
  try {
    const existing = await getTicketPanelById(req.params.panelId);
    if (!existing) return res.status(404).json({ error: "Ticket panel not found" });

    const migrated = convertLegacyPanelToComponentsV2(existing);
    const updated = await updateTicketPanel(req.params.panelId, {
      layoutMode: "components_v2",
      accentColor: migrated.accentColor,
      spoiler: migrated.spoiler,
      containerConfig: migrated.containerConfig,
      ticketTypesConfig: migrated.ticketTypesConfig,
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to migrate panel to V2" });
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
    if (!ticket || ticket.guildId !== req.params.guildId) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    if (action === "close" || action === "reopen") {
      const closing = action === "close";
      if (closing ? ticket.status === "CLOSED" : ticket.status !== "CLOSED") {
        return res.json({ success: true, ticket });
      }

      const user = (req as AuthenticatedRequest).user;
      if (!user) return res.status(401).json({ error: "Authentication required" });

      const channel = await discordClient.channels.fetch(ticket.channelId).catch((error) => {
        if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownChannel) {
          return null;
        }
        throw error;
      });
      if (channel && (channel.type !== ChannelType.GuildText || channel.guildId !== ticket.guildId)) {
        return res.status(409).json({ error: "Ticket channel does not match this server" });
      }

      if (closing) {
        await closeTicket(ticket, channel, { id: user.id, tag: user.username }, "Closed via Webpanel");
      } else {
        if (!channel) return res.status(409).json({ error: "This ticket’s Discord channel has been deleted." });
        await reopenTicket(ticket, channel, { id: user.id, tag: user.username });
      }
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
        const filePath = await generateHtmlTranscript(
          channel,
          {
            number: ticket.ticketNumber,
            creatorTag: ticket.userTag,
          },
          ticket.id
        );
        await updateTicketStatus(ticket.id, ticket.status as any, {
          transcriptUrl: `/api/guilds/${ticket.guildId}/tickets/transcripts/${ticket.id}/download`,
        });
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to execute action" });
  }
});

// Transcript Download / Display
router.get("/:guildId/tickets/transcripts/:ticketId/download", async (req, res) => {
  try {
    const { guildId, ticketId } = req.params;
    const ticket = await getTicketById(ticketId);

    let filePath = getTranscriptFilePath(ticketId, ticket?.channelId);

    // If file does not exist on disk, attempt live generation if Discord channel still exists
    if (!fs.existsSync(filePath) && ticket && ticket.channelId) {
      const channel = (await discordClient.channels.fetch(ticket.channelId).catch(() => null)) as TextChannel;
      if (channel && channel.isTextBased()) {
        filePath = await generateHtmlTranscript(
          channel,
          {
            number: ticket.ticketNumber,
            creatorTag: ticket.userTag,
          },
          ticket.id
        );
        await updateTicketStatus(ticket.id, ticket.status as any, {
          transcriptUrl: `/api/guilds/${guildId}/tickets/transcripts/${ticket.id}/download`,
        });
      }
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Transcript Not Found</title></head>
        <body style="font-family: system-ui, sans-serif; background: #090a0f; color: #fff; display: flex; items-center: center; justify-content: center; height: 100vh; margin: 0;">
          <div style="text-align: center; padding: 40px; background: #12131a; border: 1px solid #18181b; border-radius: 24px; max-width: 450px;">
            <h2 style="color: #f43f5e; margin-top: 0;">📄 Transcript Not Found</h2>
            <p style="color: #a1a1aa; font-size: 14px; line-height: 1.5;">No transcript file recorded for Ticket #${ticket?.ticketNumber || ticketId}. The channel may have been deleted before a transcript was generated.</p>
          </div>
        </body>
        </html>
      `);
    }

    if (req.query.download === "true") {
      return res.download(filePath, `transcript-ticket-${ticket?.ticketNumber || ticketId}.html`);
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(filePath);
  } catch (err: any) {
    res.status(500).send("Error serving transcript.");
  }
});

export default router;
