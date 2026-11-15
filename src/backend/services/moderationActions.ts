import { randomUUID } from "node:crypto";
import { AuditLogEvent, ChannelType, DiscordAPIError, Guild, GuildMember, PermissionFlagsBits as P, RESTJSONErrorCodes } from "discord.js";
import type { ModerationCase } from "@prisma/client";
import { moderationPermissions, ModerationAction, ModerationPermission, ModerationSettings } from "../../types/moderation";
import { getModerationSettings, moderationDb as db, reserveCase, serializeModeration } from "./moderationService";
import { publishModerationCase } from "../bot/moderationLog";

export class ModerationError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const discordPermissions: Record<ModerationPermission, bigint> = {
  cases: P.ManageMessages, warn: P.ManageMessages, timeout: P.ModerateMembers, kick: P.KickMembers,
  ban: P.BanMembers, chat: P.ManageMessages, review: P.ManageMessages, settings: P.ManageGuild,
};
export function permissionFor(action: ModerationAction): ModerationPermission {
  const permissions: Record<ModerationAction, ModerationPermission> = { warn: "warn", revoke_warn: "warn", timeout: "timeout", untimeout: "timeout", kick: "kick", ban: "ban", unban: "ban", purge: "chat", slowmode: "chat" };
  return permissions[action];
}
export function hasModerationPermission(actor: GuildMember, permission: ModerationPermission, settings: ModerationSettings) {
  if (!actor.permissions.has(discordPermissions[permission])) return false;
  if (actor.permissions.has(P.Administrator)) return true;
  const roles = settings.permissions?.[permission] ?? (permission === "timeout" ? settings.timeoutRoleIds :
    permission === "cases" || permission === "warn" ? settings.reviewRoleIds : []);
  // Preserve the existing Manage Server configuration access until explicit settings roles are configured.
  if (permission === "settings" && settings.permissions?.settings === undefined) return true;
  return roles.some(id => id !== actor.guild.id && actor.roles.cache.has(id));
}
export async function authorizePermission(guild: Guild, actorId: string, permission: ModerationPermission) {
  const actor = await guild.members.fetch({ user: actorId, force: true }).catch(() => null);
  const settings = await getModerationSettings(guild.id);
  if (!actor || !hasModerationPermission(actor, permission, settings)) {
    throw new ModerationError("You need the configured moderator role and Discord permission in this server.", 403);
  }
  return { actor, settings };
}
export async function moderationAccess(guild: Guild, actorId: string) {
  const actor = await guild.members.fetch({ user: actorId, force: true }).catch(() => null);
  if (!actor) return [];
  const settings = await getModerationSettings(guild.id);
  return moderationPermissions.filter(permission => hasModerationPermission(actor, permission, settings));
}
export function canModerate(actor: GuildMember, target: GuildMember | null, action: ModerationAction | "cases", settings: ModerationSettings) {
  if (!hasModerationPermission(actor, action === "cases" ? "cases" : permissionFor(action), settings)) return false;
  if (!target) return ["cases", "unban", "ban", "revoke_warn", "purge", "slowmode"].includes(action);
  if (target.id === actor.id) return action === "cases";
  if (target.id === actor.guild.ownerId) return false;
  return actor.id === actor.guild.ownerId || actor.roles.highest.comparePositionTo(target.roles.highest) > 0;
}
export async function fetchTarget(guild: Guild, id: string) {
  try { return await guild.members.fetch({ user: id, force: true }) ?? null; }
  catch (error) {
    if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownMember) return null;
    throw new ModerationError("Could not verify the target's membership. Try again.", 503);
  }
}
export async function authorizeAction(guild: Guild, actorId: string, targetId: string, action: ModerationAction) {
  const { actor, settings } = await authorizePermission(guild, actorId, permissionFor(action));
  const chat = action === "purge" || action === "slowmode";
  const target = chat ? null : await fetchTarget(guild, targetId);
  if (!canModerate(actor, target, action, settings)) throw new ModerationError("Insufficient role hierarchy or target is no longer a server member.", 403);
  const bot = await guild.members.fetchMe({ force: true });
  if (!chat) {
    if (!bot.permissions.has(discordPermissions[permissionFor(action)])) throw new ModerationError("The bot is missing the Discord permission for this action.");
    if (target && (target.id === bot.id || target.id === guild.ownerId || bot.roles.highest.comparePositionTo(target.roles.highest) <= 0)) {
      throw new ModerationError("The bot's role must be above the target's highest role.");
    }
    if ((action === "timeout" || action === "untimeout") && !target?.moderatable) throw new ModerationError("The bot cannot manage this member's timeout.");
    if (action === "kick" && !target?.kickable) throw new ModerationError("The bot cannot kick this member.");
    if (action === "ban" && target && !target.bannable) throw new ModerationError("The bot cannot ban this member.");
  }
  const channel = chat ? await guild.channels.fetch(targetId, { force: true }) : null;
  if (chat) {
    if (!channel || channel.type !== ChannelType.GuildText) throw new ModerationError("Choose a server text channel.");
    const required = [P.ViewChannel, action === "purge" ? P.ManageMessages : P.ManageChannels];
    if (action === "purge") required.push(P.ReadMessageHistory);
    if (!channel.permissionsFor(actor).has(required) || !channel.permissionsFor(bot).has(required)) {
      throw new ModerationError("Moderator and bot need View Channel and Manage Messages/Read History (purge) or Manage Channels (slowmode).", 403);
    }
  }
  return { actor, settings, target, channel };
}

// Cross-process SQLite lease. A fencing check is required before committing work after remote I/O.
export async function acquireLease(key: string, milliseconds: number) {
  const token = randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + milliseconds);
  const changed = await db.$executeRaw`INSERT INTO "ModerationLease" ("key", "token", "expiresAt") VALUES (${key}, ${token}, ${expires})
    ON CONFLICT("key") DO UPDATE SET "token"=${token}, "expiresAt"=${expires} WHERE "expiresAt" < ${now}`;
  return changed ? token : null;
}
export async function releaseLease(key: string, token: string) { await db.moderationLease.deleteMany({ where: { key, token } }); }
export function canLiftRecordedTimeout(record: ModerationCase, latest: ModerationCase | null, currentUntil: number) {
  return record.action === "timeout" && record.status === "succeeded" && latest?.number === record.number &&
    record.timeoutUntil?.getTime() === currentUntil && currentUntil > Date.now();
}
export interface ActionInput {
  action: ModerationAction; targetId: string; reason: string; requestId: string;
  durationSeconds?: number; count?: number; userFilter?: string; dm?: boolean; reverseNumber?: number; reviewId?: string;
}
export const actions: ModerationAction[] = ["warn", "revoke_warn", "timeout", "untimeout", "kick", "ban", "unban", "purge", "slowmode"];
export async function executeModeration(guild: Guild, actorId: string, input: ActionInput) {
  if (!input || typeof input !== "object") throw new ModerationError("Invalid moderation request.");
  const { action, targetId } = input;
  if (!actions.includes(action) || typeof targetId !== "string" || typeof input.requestId !== "string" || !/^\d{17,20}$/.test(targetId) || typeof input.reason !== "string" ||
      !input.reason.trim() || input.reason.length > 450 || !/^[\w:-]{1,120}$/.test(input.requestId)) throw new ModerationError("Invalid moderation request.");
  const reason = input.reason.trim();
  if (input.dm !== undefined && typeof input.dm !== "boolean") throw new ModerationError("Invalid DM option.");
  if (input.reverseNumber !== undefined && (!Number.isSafeInteger(input.reverseNumber) || input.reverseNumber < 1)) throw new ModerationError("Invalid case number.");
  if ((action === "timeout" && (!Number.isInteger(input.durationSeconds) || input.durationSeconds! < 60 || input.durationSeconds! > 2419200)) ||
      (action === "slowmode" && (!Number.isInteger(input.durationSeconds) || input.durationSeconds! < 0 || input.durationSeconds! > 21600)) ||
      (action === "purge" && (!Number.isInteger(input.count) || input.count! < 1 || input.count! > 100 ||
        (input.userFilter !== undefined && !/^\d{17,20}$/.test(input.userFilter))))) throw new ModerationError("Duration/count is outside the allowed range.");
  return serializeModeration(`member:${guild.id}:${targetId}`, async () => {
    await authorizePermission(guild, actorId, permissionFor(action));
    const sourceId = input.requestId.startsWith("interaction:") ? input.requestId : `web:${guild.id}:${actorId}:${input.requestId}`;
    const existing = await db.moderationCase.findUnique({ where: { sourceId } });
    if (existing) {
      if (existing.guildId !== guild.id || existing.moderatorId !== actorId || existing.action !== action || existing.targetId !== targetId) throw new ModerationError("Request key already used for another action.", 409);
      return { record: existing, notes: [] };
    }
    const { settings, target, channel } = await authorizeAction(guild, actorId, targetId, action);
    const key = `action:${guild.id}:${targetId}`;
    const token = await acquireLease(key, 300_000);
    if (!token) throw new ModerationError("Another action is in progress for this target.", 409);
    try {
      if (await db.moderationCase.findFirst({ where: { guildId: guild.id, targetId, status: "pending" } })) {
        throw new ModerationError("An earlier action has an unconfirmed outcome. Inspect Discord and the case before continuing.", 409);
      }
      let original: ModerationCase | null = null;
      if (input.reverseNumber) {
        await authorizePermission(guild, actorId, "cases");
        original = await db.moderationCase.findUnique({ where: { guildId_number: { guildId: guild.id, number: input.reverseNumber } } });
        if (!original || original.targetId !== targetId || original.status !== "succeeded" ||
          !({ revoke_warn: "warn", untimeout: "timeout", unban: "ban", slowmode: "slowmode" } as Record<string, string>)[action] ||
          original.action !== ({ revoke_warn: "warn", untimeout: "timeout", unban: "ban", slowmode: "slowmode" } as Record<string, string>)[action]) throw new ModerationError("This case cannot be reversed.");
        if (await db.moderationCase.findFirst({ where: { guildId: guild.id, reversesCaseNumber: original.number, status: "succeeded" } })) throw new ModerationError("This case was already reversed.");
      }
      if (action === "revoke_warn" && !original) throw new ModerationError("Choose the warning case to revoke.");
      if (action === "untimeout") {
        const latest = await db.moderationCase.findFirst({ where: { guildId: guild.id, targetId, action: "timeout", status: "succeeded" }, orderBy: { number: "desc" } });
        const until = target?.communicationDisabledUntilTimestamp ?? 0;
        if (original && !canLiftRecordedTimeout(original, latest, until)) throw new ModerationError("This case no longer owns the active timeout.");
        if (until <= Date.now()) throw new ModerationError("This member has no active timeout.");
        if (latest && canLiftRecordedTimeout(latest, latest, until)) original = latest;
      }
      if (action === "unban") {
        const ban = await guild.bans.fetch(targetId);
        const latest = await db.moderationCase.findFirst({ where: { guildId: guild.id, targetId, action: "ban", status: "succeeded" }, orderBy: { number: "desc" } });
        // Audit entry IDs distinguish a later external re-ban even if its reason was copied.
        let owns = false;
        if (latest?.result && ban.reason?.includes(`[GP:${latest.sourceId}]`)) {
          const audit = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 100 }).catch(() => null);
          owns = audit?.entries.find(entry => entry.targetId === targetId)?.id === latest.result;
        }
        if (original && (!owns || latest?.number !== original.number)) throw new ModerationError("This case no longer owns the active ban, or View Audit Log is unavailable. Use Unban by ID for the current ban.");
        if (owns) original = latest;
      }
      if (action === "slowmode" && input.durationSeconds === 0 && channel?.type === ChannelType.GuildText) {
        const latest = await db.moderationCase.findFirst({ where: { guildId: guild.id, targetId, action: "slowmode", status: "succeeded" }, orderBy: { number: "desc" } });
        const owns = latest && (latest.durationSeconds ?? 0) > 0 && latest.durationSeconds === channel.rateLimitPerUser;
        if (original && (!owns || latest?.number !== original.number)) throw new ModerationError("This case no longer owns the active slowmode.");
        if (owns) original = latest;
      } else if (original && action === "slowmode") throw new ModerationError("A slowmode reversal must set its duration to zero.");
      if (input.reviewId) {
        await authorizePermission(guild, actorId, "review");
        const hint = await db.geminiHint.findFirst({ where: { id: input.reviewId, guildId: guild.id } });
        if (!hint) throw new ModerationError("Review hint not found.", 404);
        const refs = JSON.parse(hint.references) as { userId: string; messageId: string }[];
        if (action === "purge" || action === "slowmode" ? targetId !== hint.channelId : !refs.some(ref => ref.userId === targetId)) throw new ModerationError("Target does not belong to this review hint.");
      }
      const { record: reserved, created } = await reserveCase({ guildId: guild.id, sourceId, targetId, action, reason,
        moderatorId: actorId, durationSeconds: input.durationSeconds, reversesCaseNumber: original?.number });
      if (!created) return { record: reserved, notes: [] };
      let dmStatus = "not_requested";
      if ((input.dm ?? settings.dmDefault) && ["warn", "timeout", "kick", "ban"].includes(action)) {
        dmStatus = "failed";
        try {
          const user = target?.user ?? await guild.client.users.fetch(targetId);
          await user.send({ content: `Moderation in ${guild.name}: ${action}\nReason: ${reason}\nThis notice precedes the action; execution may still fail.`, allowedMentions: { parse: [] } });
          dmStatus = "delivered";
        } catch { /* Delivery never prevents moderation. */ }
      }
      let timeoutUntil: Date | null = null;
      let result: string | undefined;
      let error: string | undefined;
      try {
        const marker = ` [GP:${sourceId}]`;
        const auditReason = `${reason.slice(0, 512 - marker.length)}${marker}`;
        if (action === "timeout" || action === "untimeout") timeoutUntil = (await target!.timeout(action === "timeout" ? input.durationSeconds! * 1000 : null, reason)).communicationDisabledUntil;
        if (action === "kick") await target!.kick(reason);
        if (action === "ban") {
          await guild.members.ban(targetId, { reason: auditReason });
          const audit = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 20 }).catch(() => null);
          result = audit?.entries.find(entry => entry.targetId === targetId && entry.reason === auditReason)?.id;
        }
        if (action === "unban") await guild.members.unban(targetId, reason);
        if (channel?.type === ChannelType.GuildText && action === "slowmode") {
          await channel.setRateLimitPerUser(input.durationSeconds!, reason);
          result = `Slowmode: ${input.durationSeconds} seconds`;
        }
        if (channel?.type === ChannelType.GuildText && action === "purge") {
          const messages = await channel.messages.fetch({ limit: 100 });
          const eligible = messages.filter(message => (!input.userFilter || message.author.id === input.userFilter) && message.createdTimestamp > Date.now() - 14 * 86400_000).first(input.count!);
          const removed = eligible.length ? await channel.bulkDelete(eligible, true) : null;
          result = `${removed?.size ?? 0} messages deleted (maximum ${input.count}; searched latest 100, younger than 14 days).`;
        }
      } catch (failure) {
        error = failure instanceof DiscordAPIError ? `Discord rejected the action (code ${failure.code}). Check permissions and current target state.` : "Discord did not confirm the action. Inspect the current state before retrying.";
      }
      let record = await db.moderationCase.update({ where: { sourceId }, data: {
        status: error ? "failed" : "succeeded", timeoutUntil, error, dmStatus, result, reviewId: !error ? input.reviewId : undefined,
      } });
      const logError = await publishModerationCase(guild, record, settings);
      record = await db.moderationCase.findUniqueOrThrow({ where: { sourceId } });
      return { record, notes: [logError, dmStatus === "failed" ? "The user's DM could not be delivered." : null].filter(Boolean) };
    } finally { await releaseLease(key, token); }
  });
}
