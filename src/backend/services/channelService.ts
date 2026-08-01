import { ChannelType, GuildChannel, TextChannel, VoiceChannel, CategoryChannel, ForumChannel, PermissionFlagsBits } from "discord.js";
import { discordClient, isBotReady } from "../bot/client";

export async function getGuildChannels(guildId: string) {
  if (!isBotReady) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const channels = await guild.channels.fetch();

  return channels
    .filter((c): c is GuildChannel => c !== null)
    .map((c) => {
      const isText = c.type === ChannelType.GuildText;
      const isVoice = c.type === ChannelType.GuildVoice;
      const isForum = c.type === ChannelType.GuildForum;

      return {
        id: c.id,
        name: c.name,
        type: c.type,
        position: c.position,
        parentId: c.parentId,
        topic: isText || isForum ? (c as TextChannel | ForumChannel).topic : null,
        nsfw: isText || isForum ? (c as TextChannel | ForumChannel).nsfw : false,
        slowmode: isText || isForum ? (c as TextChannel | ForumChannel).rateLimitPerUser : 0,
        bitrate: isVoice ? (c as VoiceChannel).bitrate : null,
        userLimit: isVoice ? (c as VoiceChannel).userLimit : null,
        permissionOverwrites: c.permissionOverwrites.cache.map((po) => ({
          id: po.id,
          type: po.type, // 0 for Role, 1 for Member
          allow: po.allow.bitfield.toString(),
          deny: po.deny.bitfield.toString(),
        })),
      };
    })
    .sort((a, b) => a.position - b.position);
}

export async function createChannel(
  guildId: string,
  data: {
    name: string;
    type: ChannelType;
    parentId?: string;
    topic?: string;
    nsfw?: boolean;
    slowmode?: number;
  }
) {
  if (!isBotReady) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const newChannel = await guild.channels.create({
    name: data.name,
    type: data.type,
    parent: data.parentId || undefined,
    topic: data.topic,
    nsfw: data.nsfw,
    rateLimitPerUser: data.slowmode,
  });

  return {
    id: newChannel.id,
    name: newChannel.name,
    type: newChannel.type,
    parentId: newChannel.parentId,
  };
}

export async function updateChannel(
  guildId: string,
  channelId: string,
  data: {
    name?: string;
    topic?: string;
    nsfw?: boolean;
    slowmode?: number;
    parentId?: string | null;
    position?: number;
    permissionOverwrites?: Array<{ id: string; allow: string[]; deny: string[] }>;
  }
) {
  if (!isBotReady) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const channel = guild.channels.cache.get(channelId);
  if (!channel) throw new Error("Channel not found.");

  const editPayload: any = {};
  if (data.name !== undefined) editPayload.name = data.name;
  if (data.topic !== undefined) editPayload.topic = data.topic;
  if (data.nsfw !== undefined) editPayload.nsfw = data.nsfw;
  if (data.slowmode !== undefined) editPayload.rateLimitPerUser = data.slowmode;
  if (data.parentId !== undefined) editPayload.parent = data.parentId;
  if (data.position !== undefined) editPayload.position = data.position;

  if (data.permissionOverwrites) {
    editPayload.permissionOverwrites = data.permissionOverwrites.map((po) => ({
      id: po.id,
      allow: po.allow.map((p) => BigInt(p)),
      deny: po.deny.map((p) => BigInt(p)),
    }));
  }

  const updated = await channel.edit(editPayload);
  return {
    id: updated.id,
    name: updated.name,
    type: updated.type,
    position: updated.position,
    parentId: updated.parentId,
  };
}

export async function deleteChannel(guildId: string, channelId: string) {
  if (!isBotReady) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const channel = guild.channels.cache.get(channelId);
  if (!channel) throw new Error("Channel not found.");

  await channel.delete();
  return { success: true, channelId };
}
