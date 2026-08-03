import { ChannelType } from "discord.js";
import { discordClient, isBotReady } from "../bot/client";

export async function getGuilds() {
  if (!isBotReady()) return [];

  let guildsList = Array.from(discordClient.guilds.cache.values());
  if (guildsList.length === 0) {
    try {
      const fetchedOAuthGuilds = await discordClient.guilds.fetch();
      const resolved = await Promise.all(
        fetchedOAuthGuilds.map((g) => g.fetch().catch(() => null))
      );
      guildsList = resolved.filter(Boolean) as any[];
    } catch (e) {
      // Fallback to cache
    }
  }

  return guildsList.map((guild) => ({
    id: guild.id,
    name: guild.name,
    icon: guild.iconURL(),
    memberCount: guild.memberCount,
    joinedAt: guild.joinedAt,
    ownerId: guild.ownerId,
  }));
}

interface GuildDetailsCache {
  data: any;
  timestamp: number;
}
const guildDetailsCache = new Map<string, GuildDetailsCache>();
const CACHE_TTL_MS = 5000; // 5 seconds cache

export async function getGuildDetails(guildId: string) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");

  // Check 5s TTL cache first for instant responses
  const cached = guildDetailsCache.get(guildId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const guild = discordClient.guilds.cache.get(guildId) || (await discordClient.guilds.fetch(guildId).catch(() => null));
  if (!guild) throw new Error("Guild not found.");

  // Use in-memory caches first for zero network delay
  let channels: any = guild.channels.cache;
  if (channels.size === 0) {
    channels = await guild.channels.fetch().catch(() => guild.channels.cache);
  }

  let roles = guild.roles.cache;
  if (roles.size === 0) {
    roles = await guild.roles.fetch().catch(() => guild.roles.cache);
  }

  const emojis = guild.emojis.cache;
  const stickers = guild.stickers.cache;

  const textCount = channels.filter((c) => c?.type === ChannelType.GuildText).size;
  const voiceCount = channels.filter((c) => c?.type === ChannelType.GuildVoice).size;
  const categoryCount = channels.filter((c) => c?.type === ChannelType.GuildCategory).size;
  const forumCount = channels.filter((c) => c?.type === ChannelType.GuildForum).size;

  const result = {
    id: guild.id,
    name: guild.name,
    icon: guild.iconURL(),
    banner: guild.bannerURL(),
    description: guild.description,
    memberCount: guild.memberCount,
    verificationLevel: guild.verificationLevel,
    defaultMessageNotifications: guild.defaultMessageNotifications,
    afkChannelId: guild.afkChannelId,
    afkTimeout: guild.afkTimeout,
    counts: {
      channels: channels.size,
      textChannels: textCount,
      voiceChannels: voiceCount,
      categoryChannels: categoryCount,
      forumChannels: forumCount,
      roles: roles.size,
      emojis: emojis.size,
      stickers: stickers.size,
      invites: 0,
    },
    botStatus: {
      ready: isBotReady(),
      tag: discordClient.user?.tag || "TheGodGen Bot",
      ping: discordClient.ws.ping,
      uptime: discordClient.uptime,
    },
  };

  guildDetailsCache.set(guildId, { data: result, timestamp: Date.now() });
  return result;
}

export async function updateGuildSettings(
  guildId: string,
  data: {
    name?: string;
    icon?: string;
    description?: string;
    verificationLevel?: number;
    defaultMessageNotifications?: number;
    afkChannelId?: string | null;
    afkTimeout?: number;
  }
) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const editPayload: any = {};
  if (data.name !== undefined) editPayload.name = data.name;
  if (data.icon !== undefined) editPayload.icon = data.icon;
  if (data.description !== undefined) editPayload.description = data.description;
  if (data.verificationLevel !== undefined) editPayload.verificationLevel = data.verificationLevel;
  if (data.defaultMessageNotifications !== undefined) editPayload.defaultNotificationLevel = data.defaultMessageNotifications;
  if (data.afkChannelId !== undefined) editPayload.afkChannel = data.afkChannelId;
  if (data.afkTimeout !== undefined) editPayload.afkTimeout = data.afkTimeout;

  const updatedGuild = await guild.edit(editPayload);
  return {
    id: updatedGuild.id,
    name: updatedGuild.name,
    icon: updatedGuild.iconURL(),
    description: updatedGuild.description,
    verificationLevel: updatedGuild.verificationLevel,
    defaultMessageNotifications: updatedGuild.defaultMessageNotifications,
    afkChannelId: updatedGuild.afkChannelId,
    afkTimeout: updatedGuild.afkTimeout,
  };
}
