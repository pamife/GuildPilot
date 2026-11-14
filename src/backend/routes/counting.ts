import { PermissionFlagsBits } from "discord.js";
import { NextFunction, Response, Router } from "express";
import { AuthenticatedRequest, requireGuildAccess } from "../middleware/authMiddleware";
import { discordClient } from "../bot/client";
import { countingChannelError, notifyCountingChanged } from "../bot/countingHandler";
import { getCountingStats, resetCountingRun, setCountingChannel } from "../services/countingService";

const router = Router();
const path = "/:guildId/counting";
const guildAccess = requireGuildAccess("guildId");

async function requireManageServer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const guild = discordClient.guilds.cache.get(req.params.guildId);
  if (!discordClient.isReady() || !guild?.available) {
    return res.status(503).json({ error: "The bot is not connected to this server." });
  }

  try {
    const member = await guild.members.fetch({ user: req.user!.id, force: true });
    if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return next();
  } catch (error) {
    console.warn("[Relay Count] Failed to verify Manage Server permission:", error);
  }
  return res.status(403).json({ error: "You need Manage Server to do that." });
}

router.get(path, guildAccess, async (req, res, next) => {
  try {
    res.json(await getCountingStats(req.params.guildId));
  } catch (error) {
    next(error);
  }
});

router.put(path, guildAccess, requireManageServer, async (req, res, next) => {
  const { channelId } = req.body ?? {};
  if (typeof channelId !== "string" || !/^\d{17,20}$/.test(channelId)) {
    return res.status(400).json({ error: "Choose a server text channel." });
  }
  try {
    const { guildId } = req.params;
    const guild = discordClient.guilds.cache.get(guildId)!;
    const error = await countingChannelError(guild, channelId);
    if (error) return res.status(400).json({ error });
    const game = await setCountingChannel(guildId, channelId);
    notifyCountingChanged(guildId);
    res.json(game);
  } catch (error) {
    next(error);
  }
});

router.post(`${path}/reset`, guildAccess, requireManageServer, async (req, res, next) => {
  if (req.body?.confirmed !== true) {
    return res.status(400).json({ error: "Confirm the reset first." });
  }
  try {
    const { guildId } = req.params;
    if (!await resetCountingRun(guildId)) {
      return res.status(404).json({ error: "Relay Count is not set up yet." });
    }
    notifyCountingChanged(guildId);
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
});

export default router;
