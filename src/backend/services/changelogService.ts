import { randomBytes } from "node:crypto";
import { GuildChangelog, Prisma } from "@prisma/client";
import { DiscordAPIError, Guild } from "discord.js";
import { ChangelogContent } from "../../types/changelog";
import { buildChangelogAnnouncement, buildChangelogPing } from "../bot/changelogComponents";
import { ChangelogChannel, discordCode, fetchChangelogChannel, validateDestination } from "./changelogValidation";
import { PluginError, pluginDb } from "./pluginService";

const changelogs = pluginDb.guildChangelog;
const pageSize = 15;
const conflict = () => new PluginError(409, "Der Changelog wurde zwischenzeitlich geändert. Lade ihn neu.");
const pending = () => new PluginError(409, "Die Veröffentlichung läuft noch oder konnte nicht bestätigt werden. Prüfe den Discord-Kanal. Ein erneuter Versand ist für diesen Entwurf gesperrt.");

function view({ guildId, content, ...row }: GuildChangelog) {
  return { ...row, content: JSON.parse(content) as ChangelogContent };
}

async function findChangelog(guildId: string, id: string) {
  const row = await changelogs.findUnique({ where: { guildId_id: { guildId, id } } });
  if (!row) throw new PluginError(404, "Changelog nicht gefunden.");
  return row;
}

export async function getChangelog(guildId: string, id: string) {
  return view(await findChangelog(guildId, id));
}

export async function listChangelogs(guildId: string, drafts: boolean, page: number) {
  const rows = await changelogs.findMany({
    where: { guildId, status: drafts ? "draft" : { not: "draft" } },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize + 1,
    select: {
      id: true, title: true, version: true, status: true, revision: true, updatedAt: true,
      channelId: true, channelName: true, messageId: true, pingMessageId: true, publishedAt: true,
      publisherId: true, publisherName: true,
    },
  });
  return { items: rows.slice(0, pageSize), hasNext: rows.length > pageSize };
}

export async function saveChangelog(guildId: string, id: string, revision: number | null, content: ChangelogContent) {
  const key = { guildId, id };
  const data = { title: content.title, version: content.version, content: JSON.stringify(content) };
  if (revision === null) {
    try {
      return view(await changelogs.create({ data: { ...key, ...data } }));
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      const existing = await findChangelog(guildId, id);
      if (existing.content === data.content && existing.status === "draft") return view(existing);
      throw conflict();
    }
  }
  try {
    return view(await changelogs.update({
      where: { guildId_id: key, revision, status: "draft" },
      data: { ...data, revision: { increment: 1 } },
    }));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") throw conflict();
    throw error;
  }
}

export async function deleteDraft(guildId: string, id: string, revision: number) {
  const result = await changelogs.deleteMany({ where: { guildId, id, revision, status: "draft" } });
  if (!result.count) throw conflict();
}

async function deleteMessage(channel: ChangelogChannel, id: string) {
  try {
    await channel.messages.delete(id);
  } catch (error) {
    if (!discordCode(error, 10008) && !discordCode(error, 10003)) throw error;
  }
}

function isDiscordRejection(error: unknown) {
  return error instanceof DiscordAPIError && error.status >= 400 && error.status < 500 && error.status !== 408;
}

export async function publishChangelog(guild: Guild, id: string, revision: number, publisher: { id: string; username: string }) {
  const row = await findChangelog(guild.id, id);
  if (row.status === "published") return view(row);
  if (row.status === "publishing") throw pending();
  if (row.status !== "draft" || row.revision !== revision) throw conflict();

  const content = view(row).content;
  const roleId = content.ping ? content.roleId : null;
  const channel = await validateDestination(guild, content.channelId, content.roleId, content.ping);
  if (!channel) throw new PluginError(400, "Wähle einen Ankündigungskanal.");
  const publishedAt = new Date();
  const announcement = buildChangelogAnnouncement(content, publishedAt);

  const key = { guildId: guild.id, id };
  const claim = await changelogs.updateMany({
    where: { ...key, revision, status: "draft" },
    data: { status: "publishing", channelId: channel.id, channelName: channel.name,
      publisherId: publisher.id, publisherName: publisher.username },
  });
  if (!claim.count) {
    const current = await findChangelog(guild.id, id);
    if (current.status === "published") return view(current);
    if (current.status === "publishing") throw pending();
    throw conflict();
  }

  const update = (data: Prisma.GuildChangelogUpdateInput) => changelogs.update({
    where: { guildId_id: key }, data,
  });
  const nonce = randomBytes(12).toString("hex");
  let pingMessageId: string | null = null;
  let rejected = false;
  let messageId: string;
  try {
    if (roleId) {
      const ping = await channel.send({ ...buildChangelogPing(roleId), nonce: `p${nonce}`, enforceNonce: true });
      pingMessageId = ping.id;
      await update({ pingMessageId });
      if (!ping.mentions.roles.has(roleId)) {
        rejected = true;
        throw new PluginError(400, "Discord hat die ausgewählte Rolle nicht erwähnt. Prüfe die Rollenrechte des Bots.");
      }
    }
    const message = await channel.send({ ...announcement, nonce: `c${nonce}`, enforceNonce: true });
    messageId = message.id;
  } catch (error) {
    // A timeout or connection loss can happen after Discord accepts a message.
    if (!rejected && !isDiscordRejection(error)) {
      console.error("[Changelog] Delivery could not be confirmed:", key, error);
      throw pending();
    }
    if (pingMessageId) {
      try {
        await deleteMessage(channel, pingMessageId);
      } catch (cleanupError) {
        await update({ status: "failed" });
        console.warn("[Changelog] Ping cleanup failed:", key, cleanupError);
        throw new PluginError(502, "Die Ankündigung ist fehlgeschlagen. Der Rollenping ist noch im Kanal und kann im Verlauf gelöscht werden.");
      }
    }
    await update({ status: "draft", channelId: null, channelName: null, pingMessageId: null, publisherId: null, publisherName: null });
    if (error instanceof PluginError) throw error;
    if (discordCode(error, 50001) || discordCode(error, 10003)) {
      throw new PluginError(502, "Discord meldet, dass der Bot keinen Zugriff auf den Kanal hat.");
    }
    if (discordCode(error, 50013)) {
      throw new PluginError(502, "Discord hat den Versand wegen fehlender Bot-Berechtigungen abgelehnt.");
    }
    throw new PluginError(502, "Discord hat die Nachricht abgelehnt. Prüfe Inhalt, Banner und Kanalrechte und versuche es erneut.");
  }

  try {
    return view(await update({ status: "published", publishedAt, messageId }));
  } catch (error) {
    console.error("[Changelog] Discord confirmed the message, but saving it failed:", key, messageId, error);
    throw pending();
  }
}

export async function deleteAnnouncement(guild: Guild, id: string) {
  const row = await findChangelog(guild.id, id);
  if (row.status === "deleted") return view(row);
  if (!["published", "failed", "deleting"].includes(row.status) || !row.channelId) throw conflict();

  const key = { guildId: guild.id, id };
  await changelogs.updateMany({ where: { ...key, status: { in: ["published", "failed"] } }, data: { status: "deleting" } });
  try {
    const channel = await fetchChangelogChannel(guild, row.channelId);
    if (row.messageId) await deleteMessage(channel, row.messageId);
    if (row.pingMessageId) await deleteMessage(channel, row.pingMessageId);
  } catch (error) {
    if (!discordCode(error, 10003)) {
      throw new PluginError(502, "Die Löschung konnte nicht bestätigt werden. Prüfe den Kanalzugriff des Bots und versuche es im Verlauf erneut.");
    }
  }
  return view(await changelogs.update({ where: { guildId_id: key }, data: { status: "deleted" } }));
}
