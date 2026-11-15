import { createHash } from "node:crypto";
import { DiscordAPIError, Message, MessageType, PermissionFlagsBits, RESTJSONErrorCodes } from "discord.js";
import { autoModRuleIds, type AutoModRuleId, type AutoModSettings } from "../../types/moderation";
import {
  finishCase, getAutoModSettings, moderationDb, reserveCase, serializeModeration,
} from "../services/moderationService";
import { publishModerationCase } from "./moderationLog";

const labels: Record<AutoModRuleId, string> = {
  flood: "Message flood",
  repeat: "Repeated messages",
  invites: "Discord invites", mentions: "Mention spam", words: "Word filter", domains: "Domain filter",
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
  edited?: boolean;
}

export function createAutoModDetector() {
  // Keep bounded, recent counters per server/member and per repeated message body.
  const samples = new Map<string, { id: string; timestamp: number }[]>();
  return (settings: AutoModSettings, message: AutoModInput) => {
    const matches: AutoModRuleId[] = [];
    const body = message.content.trim().toLowerCase().replace(/\s+/g, " ");
    for (const id of autoModRuleIds) {
      const rule = settings[id];
      if (!rule || !rule.enabled || rule.exemptRoleIds.some(role => message.roleIds.has(role)) ||
          rule.exemptChannelIds.some(channel => channel === message.channelId || channel === message.parentId)) continue;

      if (id === "invites") {
        if (inviteCodes(message.content).some(code => !settings.invites.allowedCodes.includes(code))) {
          matches.push(id);
        }
        continue;
      }

      if (id === "mentions") {
        const mentions = new Set(message.content.match(/<@!?\d+>|<@&\d+>/g) ?? []).size;
        if (mentions >= settings.mentions.threshold || (settings.mentions.everyone && /@(everyone|here)\b/.test(message.content))) matches.push(id);
        continue;
      }
      if (id === "words") {
        if (settings.words.words.filter(Boolean).some(word => {
          const normalized = word.toLocaleLowerCase();
          if (!settings.words.wholeWord) return body.includes(normalized);
          const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'u').test(body);
        })) matches.push(id);
        continue;
      }
      if (id === "domains") {
        const { domains, allowedDomains, subdomains } = settings.domains;
        const contains = (host: string, list: string[]) => list.some(domain => host === domain || (subdomains && host.endsWith(`.${domain}`)));
        if (messageHosts(message.content).some(host => contains(host, domains) && !contains(host, allowedDomains))) matches.push(id);
        continue;
      }
      if (message.edited) continue;
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

export async function processAutoModMessage(message: Message, edited = false): Promise<boolean> {
  if (!message.inGuild() || message.author.bot || message.webhookId ||
      (message.type !== MessageType.Default && message.type !== MessageType.Reply)) return false;

  const sourceId = edited ? `edit:${message.id}:${message.editedTimestamp ?? createHash("sha256").update(message.content).digest("hex")}` : `message:${message.id}`;
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
      messageId: message.id, content: message.content, timestamp: message.createdTimestamp, edited,
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
    if (!edited) await escalateSpam(message, settings, matches).catch(() => console.warn("[AutoMod] Escalation could not be completed."));
    return deleted;
  });
}


export function messageHosts(content: string): string[] {
  const candidates = content.match(/(?:https?:\/\/|www\.)[^\s<>]+|(?<![\w@/])(?:[a-z0-9-]+\.)+[a-z]{2,63}(?:\/[^\s<>]*)?/gi) ?? [];
  return candidates.flatMap(candidate => {
    try { candidate = candidate.replace(/[)\]\"',.!?:;]+$/, ''); return [new URL(/^https?:/i.test(candidate) ? candidate : `https://${candidate}`).hostname.toLowerCase().replace(/\.$/, '')]; }
    catch { return []; }
  });
}

async function escalateSpam(message: Message<true>, settings: AutoModSettings, matches: AutoModRuleId[]) {
  for (const id of ["flood", "repeat"] as const) {
    const escalation = settings[id].escalation;
    if (!escalation?.enabled || !matches.includes(id)) continue;
    const hits = await moderationDb.moderationCase.count({ where: { guildId: message.guildId, targetId: message.author.id,
      action: { in: ["auto_log", "auto_delete"] }, ruleIds: { contains: id }, createdAt: { gte: new Date(Date.now() - escalation.windowSeconds * 1000) } } });
    if (hits < escalation.hits) continue;
    const { acquireLease, releaseLease } = await import("../services/moderationActions");
    const key = `action:${message.guildId}:${message.author.id}`;
    const token = await acquireLease(key, 300000);
    if (!token) return;
    try {
      const member = await message.guild.members.fetch({ user: message.author.id, force: true });
      const bot = await message.guild.members.fetchMe({ force: true });
      if (!member.moderatable || member.id === message.guild.ownerId || !bot.permissions.has(PermissionFlagsBits.ModerateMembers) || bot.roles.highest.comparePositionTo(member.roles.highest) <= 0 ||
          (member.communicationDisabledUntilTimestamp ?? 0) > Date.now()) return;
      if (await moderationDb.moderationCase.findFirst({ where: { guildId: message.guildId, targetId: member.id, status: "pending" } })) return;
      const sourceId = `spam-timeout:${message.id}`;
      const { created } = await reserveCase({ guildId: message.guildId, targetId: member.id, sourceId, action: "timeout", reason: `Repeated ${labels[id]} hits`, ruleIds: id, durationSeconds: escalation.timeoutSeconds });
      if (!created) return;
      let record;
      try { const updated = await member.timeout(escalation.timeoutSeconds * 1000, `AutoMod: ${id}`); record = await finishCase(sourceId, "succeeded", { timeoutUntil: updated.communicationDisabledUntil }); }
      catch { record = await finishCase(sourceId, "failed", { error: "Discord could not confirm the AutoMod timeout." }); }
      await publishModerationCase(message.guild, record);
    } finally { await releaseLease(key, token); }
    return;
  }
}
