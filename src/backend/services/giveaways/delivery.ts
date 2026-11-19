import { Giveaway, GiveawayJob } from "@prisma/client";
import {
  Client, DiscordAPIError, DMChannel, Guild, Message, MessageCreateOptions, PermissionFlagsBits, TextChannel, NewsChannel,
} from "discord.js";
import { entryDeadline } from "../../../types/giveaways";
import { deliveryReference, entryAnnouncement, resultsAnnouncement, safeMentions, winnerDm } from "../../bot/giveawayComponents";
import { discordCode, validateDestination } from "../changelogValidation";
import { PluginError } from "../pluginService";
import { finishPublication, replaceExpired } from "./claims";
import { auditGiveaway, configOf, db, enabled, getGiveaway, hash, id, job, lockGiveaway, system, transaction, Tx } from "./store";

type Channel = TextChannel | NewsChannel | DMChannel;
const lease = 90_000;

export function originalUrl(row: Giveaway) {
  const { channelId } = configOf(row);
  return row.messageId && channelId ? `https://discord.com/channels/${row.guildId}/${channelId}/${row.messageId}` : null;
}

export async function destination(guild: Guild, channelId: string | null, roleId: string | null = null) {
  const channel = await validateDestination(guild, channelId, roleId, Boolean(roleId));
  const bot = await guild.members.fetchMe();
  if (!channel?.permissionsFor(bot).has(PermissionFlagsBits.ReadMessageHistory)) {
    throw new PluginError(400, "Der Bot benötigt Zugriff und Nachrichtenverlauf im Giveaway-Kanal.");
  }
  return channel;
}

function hasReference(message: Message, reference: string) {
  if (message.content.split("\n").includes(reference)) return true;
  return message.components.some(component => "components" in component && component.components.some(child =>
    "content" in child && typeof child.content === "string" && child.content.split("\n").includes(`-# ${reference}`)
  ));
}

async function recover(channel: Channel, firstSendAt: Date, authorId: string, reference: string, ensureLease: () => Promise<void>) {
  let before: string | undefined;
  const earliest = firstSendAt.getTime() - 60_000;
  while (true) {
    await ensureLease();
    const batch = await channel.messages.fetch({ before, limit: 100, cache: false });
    for (const message of batch.values()) {
      if (message.author.id === authorId && message.createdTimestamp >= earliest && hasReference(message, reference)) return message.id;
    }
    const oldest = batch.last();
    if (!oldest || batch.size < 100 || oldest.createdTimestamp < earliest) return null;
    before = oldest.id;
  }
}

async function deliver(item: GiveawayJob, channel: Channel, payload: MessageCreateOptions, authorId: string,
  reference: string, ensureLease: () => Promise<void>, sendNew = true) {
  if (item.firstSendAt) {
    const prior = await recover(channel, item.firstSendAt, authorId, reference, ensureLease);
    if (prior) return prior;
  }
  if (!sendNew) return null;
  await ensureLease();
  if (!item.firstSendAt) {
    const recorded = await db.giveawayJob.updateMany({
      where: { id: item.id, lockToken: item.lockToken, doneAt: null },
      data: { firstSendAt: new Date() },
    });
    if (!recorded.count) throw new Error("Zustelllease abgelaufen.");
  }
  const message = await channel.send({ ...payload, nonce: hash(item.id).slice(0, 24), enforceNonce: true });
  return message.id;
}

async function run(item: GiveawayJob, guild: Guild, ensureLease: () => Promise<void>) {
  const row = item.giveawayId ? await getGiveaway(guild.id, item.giveawayId) : null;
  const config = row && configOf(row);
  const payload = JSON.parse(item.payload);
  const reference = deliveryReference(hash(item.id).slice(0, 16));
  const author = guild.client.user!.id;
  const send = (channel: Channel, message: MessageCreateOptions, sendNew = true) => deliver(item, channel, message, author, reference, ensureLease, sendNew);
  type Finish = (tx: Tx, row: Giveaway) => Promise<unknown>;
  const none: { messageId?: string | null; finish?: Finish } = {};
  if (item.kind === "AUDIT") {
    const channel = await destination(guild, payload.channelId);
    if (channel.permissionsFor(guild.roles.everyone).has(PermissionFlagsBits.ViewChannel)) throw new PluginError(400, "Audit-Kanal muss privat bleiben.");
    return { messageId: await send(channel, {
      content: `Giveaways · \`${payload.event}\` · Audit #${payload.auditId}\n${reference}`, allowedMentions: safeMentions,
    }) };
  }
  if (!row || !config) return none;
  if (item.kind === "ANNOUNCEMENT") {
    if (row.status !== "SCHEDULED" || row.messageId) return none;
    const deadline = entryDeadline(row.endAt, config.rules);
    const active = await enabled(db, row.guildId);
    if (!active && !item.firstSendAt && deadline > new Date()) throw new PluginError(409, "Start pausiert, bis das Plugin wieder aktiviert ist.");
    const canStart = active && deadline > new Date();
    const channel = canStart || item.firstSendAt ? await destination(guild, config.channelId) : null;
    const messageId = channel && await send(channel, entryAnnouncement(config, { ...row, status: "ACTIVE" }, 0, reference, canStart), canStart);
    if (!messageId && !active && deadline > new Date()) throw new PluginError(409, "Start pausiert, bis das Plugin wieder aktiviert ist.");
    return { messageId, finish: async (tx: Tx, current: Giveaway) => {
      const now = new Date();
      if (!messageId) {
        await tx.giveaway.update({ where: { id: row.id }, data: { status: "FAILED", error: "Das Teilnahmefenster ist vor der Veröffentlichung abgelaufen." } });
        await auditGiveaway(tx, current, system, "SCHEDULE_MISSED", {}, true);
        return;
      }
      await tx.giveaway.update({ where: { id: row.id }, data: {
        messageId, status: "ACTIVE",
        refreshAt: now >= deadline || !await enabled(tx, row.guildId) ? now : config.rules.entryBufferMinutes ? deadline : null,
        error: null,
      } });
      await auditGiveaway(tx, current, system, "GIVEAWAY_PUBLISHED", { messageId, channelId: config.channelId }, true);
      if (config.pingRoleId && now < deadline && await enabled(tx, row.guildId)) {
        await job(tx, row.guildId, row.id, "PING", {}, `ping-${row.id}`);
      }
    } };
  }
  if (item.kind === "PING") {
    if (!config.pingRoleId || !row.messageId) return none;
    if (!item.firstSendAt && (row.status !== "ACTIVE" || entryDeadline(row.endAt, config.rules) <= new Date() || !await enabled(db, row.guildId))) return none;
    const channel = await destination(guild, config.channelId, config.pingRoleId);
    return { messageId: await send(channel, {
      content: `<@&${config.pingRoleId}> · 🎉 Neues Giveaway\n${originalUrl(row)}\n${reference}`,
      allowedMentions: { ...safeMentions, roles: [config.pingRoleId] },
    }, row.status === "ACTIVE" && entryDeadline(row.endAt, config.rules) > new Date() && await enabled(db, row.guildId)) };
  }
  if (item.kind === "RESULT") {
    if (row.publishedRound >= payload.round) return none;
    const channel = await destination(guild, payload.channelId);
    const [candidates, count] = await Promise.all([
      db.giveawayCandidate.findMany({ where: { giveawayId: row.id, id: { in: payload.candidateIds }, status: "APPROVED" }, orderBy: { slot: "asc" } }),
      db.giveawayEntry.count({ where: { giveawayId: row.id, withdrawnAt: null } }),
    ]);
    if (candidates.length !== payload.candidateIds.length) throw new Error("Freigegebene Gewinnerliste ist inkonsistent.");
    const messageId = await send(channel, resultsAnnouncement(config, row.id, candidates.map(item => item.userId),
      candidates.filter(item => !item.announcedAt).map(item => item.userId), count, originalUrl(row), reference, payload.round));
    if (!messageId) throw new Error("Discord-Ergebnis fehlt.");
    return { messageId, finish: (tx: Tx, current: Giveaway) => finishPublication(tx, current, payload.candidateIds, payload.round, messageId) };
  }
  if (item.kind === "DM") {
    const candidate = await db.giveawayCandidate.findFirst({ where: { id: payload.candidateId, giveawayId: row.id }, include: { claim: true } });
    if (!candidate?.announcedAt || candidate.status !== "APPROVED") return none;
    const claim = candidate.claim?.status === "PENDING" && candidate.claim.deadline > new Date() ? candidate.claim : undefined;
    if ((payload.extension || !config.dmWinners) && !claim) return none;
    try {
      const channel = await guild.client.users.createDM(candidate.userId);
      const messageId = await send(channel, winnerDm(config, guild.name, reference, claim, payload.extension));
      return { messageId, finish: (tx: Tx, current: Giveaway) => auditGiveaway(tx, current, system, "WINNER_DM_SENT", { userId: candidate.userId, messageId }) };
    } catch (error) {
      if (!discordCode(error, 50007) && !discordCode(error, 10013)) throw error;
      return { finish: (tx: Tx, current: Giveaway) => auditGiveaway(tx, current, system, "WINNER_DM_FAILED", {
        userId: candidate.userId, reason: "Discord erlaubt keine Direktnachricht. Der öffentliche Abholbutton bleibt verfügbar.",
      }, true) };
    }
  }
  if (item.kind === "EXPIRED_REPLACEMENT") {
    await replaceExpired(guild, row.id, payload.candidateId);
    return none;
  }
  throw new Error(`Unbekannter Zustelltyp ${item.kind}`);
}

export async function processJob(client: Client, jobId: string) {
  const now = new Date();
  const lockToken = id();
  const updated = await db.giveawayJob.updateMany({ where: {
    id: jobId, doneAt: null, runAt: { lte: now }, OR: [{ lockUntil: null }, { lockUntil: { lt: now } }],
  }, data: { lockToken, lockUntil: new Date(now.getTime() + lease), tries: { increment: 1 } } });
  if (!updated.count) return;
  const item = await db.giveawayJob.findUniqueOrThrow({ where: { id: jobId } });
  const ensureLease = async () => {
    const updated = await db.giveawayJob.updateMany({ where: { id: jobId, lockToken, doneAt: null }, data: { lockUntil: new Date(Date.now() + lease) } });
    if (!updated.count) throw new Error("Zustelllease abgelaufen.");
  };
  const timer = setInterval(() => void ensureLease().catch(() => {}), 15_000);
  timer.unref();
  try {
    const guild = client.guilds.cache.get(item.guildId);
    if (!guild?.available) throw new PluginError(503, "Discord-Server momentan nicht erreichbar.");
    const outcome = await run(item, guild, ensureLease);
    await transaction(async tx => {
      const updated = await tx.giveawayJob.updateMany({ where: { id: jobId, lockToken, doneAt: null },
        data: { doneAt: new Date(), messageId: outcome.messageId, error: null, lockUntil: null, lockToken: null },
      });
      if (!updated.count) throw new Error("Zustelllease abgelaufen.");
      if (outcome.finish && item.giveawayId) await outcome.finish(tx, await lockGiveaway(tx, item.guildId, item.giveawayId));
    });
  } catch (error) {
    const code = error instanceof DiscordAPIError ? ` (Discord ${error.code})` : "";
    const known = error instanceof PluginError ? error.message : `Discord-Zustellung fehlgeschlagen${code}. Ein erneuter Versuch ist geplant.`;
    if (!(error instanceof PluginError)) console.warn(`[Giveaways] ${item.kind} failed`, error instanceof Error ? error.name : "Unknown error");
    const finalDmFailure = item.kind === "DM" && item.tries >= 5;
    await transaction(async tx => {
      const updated = await tx.giveawayJob.updateMany({ where: { id: jobId, lockToken, doneAt: null },
        data: { error: known, lockUntil: null, lockToken: null, doneAt: finalDmFailure ? new Date() : null,
          runAt: new Date(Date.now() + Math.min(5_000 * 2 ** Math.min(item.tries, 8), 300_000)) },
      });
      if (!updated.count || !item.giveawayId) return;
      if (finalDmFailure) await auditGiveaway(tx, await getGiveaway(item.guildId, item.giveawayId, tx), system, "WINNER_DM_FAILED",
        { candidateId: JSON.parse(item.payload).candidateId, reason: known }, true);
      if (item.kind === "ANNOUNCEMENT" || item.kind === "RESULT") {
        await tx.giveaway.update({ where: { id: item.giveawayId }, data: { error: known } });
      }
    });
  } finally {
    clearInterval(timer);
  }
}

export async function refreshAnnouncement(guild: Guild, row: Giveaway) {
  const until = new Date(Date.now() + lease);
  const locked = await db.giveaway.updateMany({
    where: { id: row.id, refreshAt: row.refreshAt, revision: row.revision }, data: { refreshAt: until },
  });
  if (!locked.count || !row.messageId) return;
  const config = configOf(row);
  try {
    const [channel, count, active, announcement] = await Promise.all([
      destination(guild, config.channelId),
      db.giveawayEntry.count({ where: { giveawayId: row.id, withdrawnAt: null } }),
      enabled(db, row.guildId),
      db.giveawayJob.findFirst({ where: { giveawayId: row.id, kind: "ANNOUNCEMENT", messageId: row.messageId } }),
    ]);
    const acceptsEntries = active && row.status === "ACTIVE" && entryDeadline(row.endAt, config.rules) > new Date();
    const reference = deliveryReference(hash(announcement?.id ?? row.id).slice(0, 16));
    const { components, allowedMentions } = entryAnnouncement(config, row, count, reference, acceptsEntries);
    await channel.messages.edit(row.messageId, { components, allowedMentions });
    const finished = await db.giveaway.updateMany({
      where: { id: row.id, refreshAt: until, revision: row.revision },
      data: { refreshAt: acceptsEntries && config.rules.entryBufferMinutes ? entryDeadline(row.endAt, config.rules) : null },
    });
    if (!finished.count) await db.giveaway.updateMany({
      where: { id: row.id, refreshAt: until }, data: { refreshAt: new Date(Date.now() + 7_000) },
    });
  } catch (error) {
    // A deleted Discord message cannot be edited. The authoritative database lifecycle continues.
    await db.giveaway.updateMany({
      where: { id: row.id, refreshAt: until }, data: {
        refreshAt: discordCode(error, 10008) ? null : new Date(Date.now() + lease),
      },
    });
    if (discordCode(error, 10008)) await transaction(tx => auditGiveaway(tx, row, system, "ORIGINAL_MESSAGE_DELETED"));
  }
}
