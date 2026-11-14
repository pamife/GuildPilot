import { ChannelType, PermissionFlagsBits } from "discord.js";
import { Router } from "express";
import { LevelingConfig, MAX_XP, levelForXp } from "../../types/leveling";
import { discordClient } from "../bot/client";
import { syncLevelRewards, validateRewardRoles } from "../bot/levelingRewards";
import { requireAuth, requireManageServer } from "../middleware/authMiddleware";
import { getLeaderboard, getLevelingConfig, getLevelingMember, saveLevelingConfig, setMemberXp } from "../services/levelingService";

const router = Router();
const path = "/:guildId/leveling";
const id = (value: unknown): value is string => typeof value === "string" && /^\d{17,20}$/.test(value);
const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

function parseConfig(body: unknown): LevelingConfig | null {
  if (!body || typeof body !== "object") return null;
  const input = body as Partial<LevelingConfig>;
  const { enabled, minXp, maxXp, cooldownSeconds, excludedChannelIds, excludeRelay,
    announce, announcementId, rewards, highestOnly, prestigeEnabled, prestigeLevel } = input;
  if (typeof enabled !== "boolean" || typeof excludeRelay !== "boolean" || typeof announce !== "boolean"
    || typeof highestOnly !== "boolean" || typeof prestigeEnabled !== "boolean"
    || !integer(minXp, 1, 100_000) || !integer(maxXp, minXp, 100_000)
    || !integer(cooldownSeconds, 0, 86_400) || !integer(prestigeLevel, 1, levelForXp(MAX_XP))
    || (announcementId !== null && !id(announcementId))
    || !Array.isArray(excludedChannelIds) || excludedChannelIds.length > 500 || !excludedChannelIds.every(id)
    || !Array.isArray(rewards) || rewards.length > 250
    || !rewards.every((reward) => reward && id(reward.roleId) && integer(reward.level, 1, levelForXp(MAX_XP)))) return null;

  return {
    enabled, minXp, maxXp, cooldownSeconds, excludedChannelIds: [...new Set(excludedChannelIds)], excludeRelay,
    announce, announcementId, rewards: rewards.map(({ level, roleId }) => ({ level, roleId })),
    highestOnly, prestigeEnabled, prestigeLevel,
  };
}

router.use(path, requireAuth, requireManageServer);

router.get(path, async (req, res, next) => {
  try {
    res.json(await getLevelingConfig(req.params.guildId));
  } catch (error) {
    next(error);
  }
});

router.put(path, async (req, res, next) => {
  const settings = parseConfig(req.body);
  if (!settings) return res.status(400).json({ error: "Check the XP range, cooldown, channels, reward levels and prestige level." });
  const { guildId } = req.params;
  const guild = discordClient.guilds.cache.get(guildId)!;
  try {
    if (settings.excludedChannelIds.length || settings.announcementId) {
      const channels = await guild.channels.fetch();
      if (settings.excludedChannelIds.some((channelId) => !channels.has(channelId))) {
        return res.status(400).json({ error: "Choose excluded channels from this server." });
      }
      if (settings.announcementId) {
        const channel = channels.get(settings.announcementId);
        const bot = await guild.members.fetchMe({ force: true });
        if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)
          || !channel.permissionsFor(bot).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
          return res.status(400).json({ error: "Choose a server text channel where the bot has View Channel and Send Messages." });
        }
      }
    }

    try {
      await validateRewardRoles(guild, [...new Set(settings.rewards.map(({ roleId }) => roleId))]);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Reward roles could not be verified." });
    }
    res.json(await saveLevelingConfig(guildId, settings));
  } catch (error) {
    next(error);
  }
});

router.get(`${path}/leaderboard`, async (req, res, next) => {
  const { guildId } = req.params;
  const guild = discordClient.guilds.cache.get(guildId)!;
  const page = Number(req.query.page ?? 1);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const ranking = req.query.ranking === "prestige" ? "prestige" : "xp";
  if (!integer(page, 1, 1_000_000) || search.length > 100) {
    return res.status(400).json({ error: "Invalid page or search." });
  }
  try {
    const matches = search
      ? id(search)
        ? [await guild.members.fetch({ user: search, force: true }).catch(() => null)].filter((member) => member !== null)
        : [...(await guild.members.search({ query: search, limit: 100 })).values()]
      : [];
    const byId = new Map(matches.map((member) => [member.id, member]));
    const board = await getLeaderboard(guildId, ranking, page, search ? [...byId.keys()] : undefined);
    const entries = await Promise.all(board.entries.map(async (row) => {
      const member = byId.get(row.userId) ?? await guild.members.fetch(row.userId).catch(() => null);
      return { ...row, name: member?.displayName ?? row.userId };
    }));
    res.json({ ...board, entries, matches: matches.filter((member) => !member.user.bot).map((member) => ({
      userId: member.id, name: member.displayName,
    })) });
  } catch (error) {
    next(error);
  }
});

router.get(`${path}/members/:userId`, async (req, res, next) => {
  const { guildId, userId } = req.params;
  const guild = discordClient.guilds.cache.get(guildId)!;
  if (!id(userId)) return res.status(400).json({ error: "Choose a member of this server." });
  try {
    const member = await guild.members.fetch({ user: userId, force: true }).catch(() => null);
    if (!member || member.user.bot) return res.status(404).json({ error: "Choose a human member of this server." });
    const row = await getLevelingMember(guildId, userId);
    res.json({ userId, name: member.displayName, xp: row?.xp ?? 0, level: row?.level ?? 0,
      prestige: row?.prestige ?? 0, revision: row?.revision ?? 0 });
  } catch (error) {
    next(error);
  }
});

router.put(`${path}/members/:userId`, async (req, res, next) => {
  const { guildId, userId } = req.params;
  const { xp, revision, confirmed } = req.body ?? {};
  if (confirmed !== true || !id(userId) || !integer(xp, 0, MAX_XP) || !integer(revision, 0, Number.MAX_SAFE_INTEGER)) {
    return res.status(400).json({ error: "Confirm a valid XP value for a server member." });
  }
  const guild = discordClient.guilds.cache.get(guildId)!;
  try {
    const member = await guild.members.fetch({ user: userId, force: true }).catch(() => null);
    if (!member || member.user.bot) return res.status(404).json({ error: "Choose a human member of this server." });
    if (!await setMemberXp(guildId, userId, xp, revision)) {
      return res.status(409).json({ error: "The member's XP changed. Reopen the editor to confirm the new balance." });
    }
    try {
      await syncLevelRewards(member);
      res.json({ xp });
    } catch (error) {
      console.warn("[Leveling] XP updated but role sync failed:", error);
      res.json({ xp, warning: "XP saved. Reward roles could not be updated. Check Manage Roles and the bot's role hierarchy." });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
