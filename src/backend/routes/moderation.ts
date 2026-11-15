import { Router } from "express";
import { discordClient } from "../bot/client";
import { privateModLogChannel } from "../bot/moderationLog";
import { requireAuth, requireManageServer } from "../middleware/authMiddleware";
import {
  getAutoModSettings, getModerationSettings, moderationDb,
} from "../services/moderationService";
import { autoModRuleIds, type AutoModRule, type AutoModSettings, type SpamRule } from "../../types/moderation";

const router = Router();
const moderationPath = "/:guildId/moderation";
const autoModPath = "/:guildId/automod";
const access = [requireAuth, requireManageServer];
const snowflake = /^\d{17,20}$/;

function parseList(input: unknown, pattern: RegExp) {
  if (!Array.isArray(input) || input.length > 250 ||
      !input.every((item): item is string => typeof item === "string" && pattern.test(item))) return null;
  return [...new Set(input)];
}

function settingsObject(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null ? input as Record<string, unknown> : {};
}

function parseRule(input: unknown): AutoModRule | null {
  const { enabled, action, exemptRoleIds, exemptChannelIds } = settingsObject(input);
  const roles = parseList(exemptRoleIds, snowflake);
  const channels = parseList(exemptChannelIds, snowflake);
  if (typeof enabled !== "boolean" || (action !== "log" && action !== "delete") || !roles || !channels) return null;
  return { enabled, action, exemptRoleIds: roles, exemptChannelIds: channels };
}

function intInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function parseSpam(input: unknown): SpamRule | null {
  const rule = parseRule(input);
  const { threshold, windowSeconds } = settingsObject(input);
  if (!rule || !intInRange(threshold, 2, 50) || !intInRange(windowSeconds, 1, 120)) return null;
  return { ...rule, threshold, windowSeconds };
}

router.get(moderationPath, ...access, async (req, res, next) => {
  try {
    res.json(await getModerationSettings(req.params.guildId));
  } catch (error) {
    next(error);
  }
});

router.put(moderationPath, ...access, async (req, res, next) => {
  const { guildId } = req.params;
  const { logChannelId, reviewRoleIds, timeoutRoleIds } = settingsObject(req.body);
  const review = parseList(reviewRoleIds, snowflake);
  const timeout = parseList(timeoutRoleIds, snowflake);
  if ((logChannelId !== null && (typeof logChannelId !== "string" || !snowflake.test(logChannelId))) ||
      !review || !timeout) return res.status(400).json({ error: "Choose valid server roles and a log channel." });

  try {
    const guild = discordClient.guilds.cache.get(guildId)!;
    const roles = await guild.roles.fetch();
    if ([...review, ...timeout].some(id => id === guildId || !roles.has(id))) {
      return res.status(400).json({ error: "Choose roles from this server other than @everyone." });
    }
    if (logChannelId) {
      try {
        await privateModLogChannel(guild, logChannelId);
      } catch (error) {
        return res.status(400).json({ error: error instanceof Error ? error.message : "The log channel is unavailable." });
      }
    }
    const data = { logChannelId, reviewRoleIds: JSON.stringify(review), timeoutRoleIds: JSON.stringify(timeout) };
    await moderationDb.moderationSettings.upsert({ where: { guildId }, create: { guildId, ...data }, update: data });
    res.json(await getModerationSettings(guildId));
  } catch (error) {
    next(error);
  }
});

router.get(autoModPath, ...access, async (req, res, next) => {
  try {
    res.json(await getAutoModSettings(req.params.guildId));
  } catch (error) {
    next(error);
  }
});

router.put(autoModPath, ...access, async (req, res, next) => {
  const { guildId } = req.params;
  const { flood, repeat, invites } = settingsObject(req.body);
  const floodRule = parseSpam(flood);
  const repeatRule = parseSpam(repeat);
  const inviteRule = parseRule(invites);
  const allowedCodes = parseList(settingsObject(invites).allowedCodes, /^[a-zA-Z0-9-]{1,64}$/);
  if (!floodRule || !repeatRule || !inviteRule || !allowedCodes) {
    return res.status(400).json({ error: "Choose valid settings for each AutoMod rule." });
  }
  const settings: AutoModSettings = { flood: floodRule, repeat: repeatRule, invites: { ...inviteRule, allowedCodes } };
  try {
    const guild = discordClient.guilds.cache.get(guildId)!;
    const [roles, channels] = await Promise.all([guild.roles.fetch(), guild.channels.fetch()]);
    for (const id of autoModRuleIds) {
      const rule = settings[id];
      if (rule.exemptRoleIds.some(id => id === guildId || !roles.has(id)) ||
          rule.exemptChannelIds.some(id => !channels.get(id))) {
        return res.status(400).json({ error: "Choose exception roles and channels from this server." });
      }
    }
    const rules = JSON.stringify(settings);
    await moderationDb.autoModSettings.upsert({ where: { guildId }, create: { guildId, rules }, update: { rules } });
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

export default router;
