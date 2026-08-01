import { ChannelType } from "discord.js";
import { discordClient, isBotReady } from "../bot/client";
import { getGuildChannels } from "./channelService";
import { getGuildRoles } from "./roleService";
import { getGuildEmojis } from "./emojiStickerService";

export async function bulkCreateChannels(
  guildId: string,
  channelsData: Array<{ name: string; type: ChannelType; parentId?: string }>
) {
  if (!isBotReady) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const created = [];
  for (const item of channelsData) {
    try {
      const ch = await guild.channels.create({
        name: item.name,
        type: item.type,
        parent: item.parentId || undefined,
      });
      created.push({ id: ch.id, name: ch.name, type: ch.type });
    } catch (err) {
      console.error(`Bulk create failed for ${item.name}`, err);
    }
  }

  return { success: true, count: created.length, created };
}

export async function bulkRenameChannels(
  guildId: string,
  renameData: Array<{ id: string; name: string }>
) {
  if (!isBotReady) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const updated = [];
  for (const item of renameData) {
    try {
      const ch = guild.channels.cache.get(item.id);
      if (ch) {
        const edited = await ch.edit({ name: item.name });
        updated.push({ id: edited.id, name: edited.name });
      }
    } catch (err) {
      console.error(`Bulk rename failed for channel ${item.id}`, err);
    }
  }

  return { success: true, count: updated.length, updated };
}

export async function searchGuildItems(guildId: string, query: string) {
  if (!query || query.trim().length === 0) {
    return { channels: [], roles: [], emojis: [] };
  }

  const q = query.toLowerCase().trim();
  const channels = await getGuildChannels(guildId);
  const roles = await getGuildRoles(guildId);
  const emojis = await getGuildEmojis(guildId);

  return {
    channels: channels.filter((c) => c.name.toLowerCase().includes(q)),
    roles: roles.filter((r) => r.name.toLowerCase().includes(q)),
    emojis: emojis.filter((e) => e.name?.toLowerCase().includes(q)),
  };
}
