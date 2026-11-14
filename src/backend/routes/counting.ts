import { Router } from "express";
import { requireAuth, requireManageServer } from "../middleware/authMiddleware";
import { discordClient } from "../bot/client";
import { countingChannelError, notifyCountingChanged } from "../bot/countingHandler";
import { getCountingStats, resetCountingRun, setCountingChannel } from "../services/countingService";

const router = Router();
const path = "/:guildId/counting";

router.get(path, requireAuth, requireManageServer, async (req, res, next) => {
  try {
    res.json(await getCountingStats(req.params.guildId));
  } catch (error) {
    next(error);
  }
});

router.put(path, requireAuth, requireManageServer, async (req, res, next) => {
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

router.post(`${path}/reset`, requireAuth, requireManageServer, async (req, res, next) => {
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
