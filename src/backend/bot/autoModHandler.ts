import { createHash } from "node:crypto";
import { DiscordAPIError, Message, MessageType, RESTJSONErrorCodes } from "discord.js";
import { autoModRuleIds, type AutoModRuleId, type AutoModSettings } from "../../types/moderation";
import {
  finishCase, getAutoModSettings, moderationDb, reserveCase, serializeModeration,
} from "../services/moderationService";
import { publishModerationCase } from "./moderationLog";

const labels: Record<AutoModRuleId, string> = {
  flood: "Message flood",
  repeat: "Repeated messages",
  invites: "Discord invites",
};

export function inviteCodes(content: string) {
  const pattern = /(?<![\w.@/-])(?:https?:\/\/)?(?:www\.)?(?:discord\.gg\/|discord(?:app)?\.com\/invite\/)([a-z0-9-]+)(?![\w-])/gi;
  return [...content.matchAll(pattern)].map(match => match[1]);
}

interface AutoModInput {
  guildId: string;
  channelId: string;
  parentId: string | null;
  userId: string;
  roleIds: ReadonlySet<string>;
  messageId: string;
  content: string;
  timestamp: number;
}

export function createAutoModDetector() {
  // Keep bounded, recent counters per server/member and per repeated message body.
  const samples = new Map<string, { id: string; timestamp: number }[]>();
  return (settings: AutoModSettings, message: AutoModInput) => {
    const matches: AutoModRuleId[] = [];
    const body = message.content.trim().toLowerCase().replace(/\s+/g, " ");
    for (const id of autoModRuleIds) {
      const rule = settings[id];
      if (!rule.enabled || rule.exemptRoleIds.some(role => message.roleIds.has(role)) ||
          rule.exemptChannelIds.some(channel => channel === message.channelId || channel === message.parentId)) continue;

      if (id === "invites") {
        if (inviteCodes(message.content).some(code => !settings.invites.allowedCodes.includes(code))) {
          matches.push(id);
        }
        continue;
      }

      if (id === "repeat" && !body) continue;
      const { threshold, windowSeconds } = settings[id];
      const contentKey = id === "repeat" ? createHash("sha256").update(body).digest("hex") : "";
      const key = `${message.guildId}:${message.userId}:${id}:${threshold}:${windowSeconds}:${contentKey}`;
      const recent = (samples.get(key) ?? []).filter(sample =>
        Math.abs(message.timestamp - sample.timestamp) <= windowSeconds * 1000);
      if (!recent.some(sample => sample.id === message.messageId)) {
        recent.push({ id: message.messageId, timestamp: message.timestamp });
      }

      samples.delete(key);
      samples.set(key, recent.slice(-threshold));
      if (samples.size > 10_000) samples.delete(samples.keys().next().value!);
      if (recent.length >= threshold) matches.push(id);
    }

    return { matches, shouldDelete: matches.some(id => settings[id].action === "delete") };
  };
}

const detect = createAutoModDetector();

export async function processAutoModMessage(message: Message): Promise<boolean> {
  if (!message.inGuild() || message.author.bot || message.webhookId ||
      (message.type !== MessageType.Default && message.type !== MessageType.Reply)) return false;

  const sourceId = `message:${message.id}`;
  return serializeModeration(sourceId, async () => {
    const existing = await moderationDb.moderationCase.findUnique({ where: { sourceId } });
    if (existing) return existing.action === "auto_delete" &&
      (existing.status === "succeeded" || existing.status === "message_missing");

    const settings = await getAutoModSettings(message.guildId);
    if (!autoModRuleIds.some(id => settings[id].enabled)) return false;
    const member = message.member ?? await message.guild.members.fetch(message.author.id);
    const { matches, shouldDelete } = detect(settings, {
      guildId: message.guildId, channelId: message.channelId,
      parentId: message.channel.isThread() ? message.channel.parentId : null,
      userId: message.author.id, roleIds: new Set(member.roles.cache.keys()),
      messageId: message.id, content: message.content, timestamp: message.createdTimestamp,
    });
    if (!matches.length) return false;

    const { record: reserved, created } = await reserveCase({
      sourceId, guildId: message.guildId, targetId: message.author.id,
      action: shouldDelete ? "auto_delete" : "auto_log",
      ruleIds: matches.join(", "),
      reason: `${matches.map(id => labels[id]).join(", ")} in #${message.channelId}`,
    });

    if (!created) return reserved.action === "auto_delete" &&
      (reserved.status === "succeeded" || reserved.status === "message_missing");

    let deleted = false;
    let status: Parameters<typeof finishCase>[1] = "succeeded";
    let error: string | undefined;
    if (shouldDelete) {
      try {
        await message.delete();
        deleted = true;
      } catch (failure) {
        deleted = failure instanceof DiscordAPIError && failure.code === RESTJSONErrorCodes.UnknownMessage;
        status = deleted ? "message_missing" : "failed";
        error = deleted ? "The message was already gone." : "Could not delete the message. Check Manage Messages.";
        console.warn(`[AutoMod] Delete failed for ${message.guildId}/${message.id}:`, failure);
      }
    }

    // A logging/storage failure must not send a successfully deleted message downstream.
    try {
      const record = await finishCase(sourceId, status, { error });
      const logError = await publishModerationCase(message.guild, record);
      if (logError) console.warn(`[AutoMod] Case ${message.guildId}/${record.number}: ${logError}`);
    } catch (failure) {
      console.error(`[AutoMod] Could not finalize ${message.guildId}/${message.id}:`, failure);
    }
    return deleted;
  });
}
