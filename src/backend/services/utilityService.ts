import { ChannelType, GuildChannelTypes } from "discord.js";
import { PrismaClient } from "@prisma/client";
import { discordClient, isBotReady } from "../bot/client";
import { getGuildChannels } from "./channelService";
import { getGuildRoles } from "./roleService";
import { getGuildEmojis } from "./emojiStickerService";
import { createManualBackup } from "./backupService";
import { broadcastEvent } from "../socket/socketManager";

const prisma = new PrismaClient();

export interface PurgeOptions {
  createAutoBackup?: boolean;
  deleteChannels?: boolean;
  deleteCategories?: boolean;
  createFallbackChannel?: boolean;
  deleteRoles?: boolean;
  deleteEmojis?: boolean;
  deleteStickers?: boolean;
  deleteInvites?: boolean;
  deleteDatabaseConfigs?: boolean;
}

export async function bulkCreateChannels(
  guildId: string,
  channelsData: Array<{ name: string; type: number; parentId?: string }>
) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const created = [];
  for (const item of channelsData) {
    try {
      const ch = await guild.channels.create({
        name: item.name,
        type: item.type as GuildChannelTypes,
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
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
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

/**
 * Summary of purgeable items on the server
 */
export async function getServerPurgeSummary(guildId: string) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId) || (await discordClient.guilds.fetch(guildId).catch(() => null));
  if (!guild) throw new Error("Guild not found.");

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
  const invites = await guild.invites.fetch().catch(() => new Map());

  const botHighestPosition = guild.members.me?.roles.highest.position || 0;
  const deletableRoles = roles.filter(
    (r) => !r.managed && r.name !== "@everyone" && r.position < botHighestPosition
  );

  const nonCategoryChannels = Array.from(channels.values()).filter((c: any) => c && c.type !== ChannelType.GuildCategory);
  const categoryChannels = Array.from(channels.values()).filter((c: any) => c && c.type === ChannelType.GuildCategory);

  const [
    ticketPanelsCount,
    appFormsCount,
    customMessagesCount,
    autoReactsCount,
    selfRolesCount,
  ] = await Promise.all([
    prisma.ticketPanel.count({ where: { guildId } }),
    prisma.appForm.count({ where: { guildId } }),
    prisma.customMessage.count({ where: { guildId } }),
    prisma.autoReact.count({ where: { guildId } }),
    prisma.selfRolePanel.count({ where: { guildId } }),
  ]);

  return {
    guildName: guild.name,
    channelsCount: nonCategoryChannels.length,
    categoriesCount: categoryChannels.length,
    rolesCount: deletableRoles.size,
    emojisCount: emojis.size,
    stickersCount: stickers.size,
    invitesCount: invites.size,
    dbConfigsCount: ticketPanelsCount + appFormsCount + customMessagesCount + autoReactsCount + selfRolesCount,
  };
}

/**
 * Execute Selective or Full Server Purge (Delete Everything)
 */
export async function purgeServerData(guildId: string, options: PurgeOptions) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId) || (await discordClient.guilds.fetch(guildId).catch(() => null));
  if (!guild) throw new Error("Guild not found.");

  const results = {
    backupCreated: false,
    backupId: null as string | null,
    fallbackChannelCreated: false,
    channelsDeleted: 0,
    categoriesDeleted: 0,
    rolesDeleted: 0,
    emojisDeleted: 0,
    stickersDeleted: 0,
    invitesDeleted: 0,
    dbConfigsDeleted: 0,
  };

  // 1. Safety Automatic Backup
  if (options.createAutoBackup !== false) {
    try {
      const backup = await createManualBackup(
        guildId,
        `Sicherheits-Backup vor Purge (${guild.name})`,
        `Automatisches Sicherheits-Backup vor Ausführung der Server-Bereinigung am ${new Date().toLocaleString("de-DE")}`
      );
      results.backupCreated = true;
      results.backupId = backup.id;
    } catch (e: any) {
      console.warn("[Purge Service] Auto backup failed, continuing:", e.message);
    }
  }

  // 2. Optional Fallback Channel before deleting channels
  let fallbackChannelId: string | null = null;
  if (options.deleteChannels && options.createFallbackChannel !== false) {
    try {
      const fallback = await guild.channels.create({
        name: "general",
        type: ChannelType.GuildText,
        reason: "Fallback text channel created during Server Purge",
      });
      fallbackChannelId = fallback.id;
      results.fallbackChannelCreated = true;
    } catch (e: any) {
      console.warn("[Purge Service] Failed to create fallback channel:", e.message);
    }
  }

  // 3. Delete Channels
  if (options.deleteChannels) {
    let channels: any = guild.channels.cache;
    if (channels.size === 0) {
      channels = await guild.channels.fetch().catch(() => guild.channels.cache);
    }

    for (const [, ch] of channels) {
      if (fallbackChannelId && ch.id === fallbackChannelId) continue;
      if (ch.type !== ChannelType.GuildCategory) {
        try {
          await ch.delete("Server Purge via GuildPilot");
          results.channelsDeleted++;
        } catch (e: any) {
          console.warn(`[Purge Service] Failed to delete channel ${ch.name}:`, e.message);
        }
      }
    }
  }

  // 4. Delete Categories
  if (options.deleteCategories) {
    let channels: any = guild.channels.cache;
    for (const [, ch] of channels) {
      if (ch.type === ChannelType.GuildCategory) {
        try {
          await ch.delete("Server Purge via GuildPilot");
          results.categoriesDeleted++;
        } catch (e: any) {
          console.warn(`[Purge Service] Failed to delete category ${ch.name}:`, e.message);
        }
      }
    }
  }

  // 5. Delete Roles
  if (options.deleteRoles) {
    let roles = guild.roles.cache;
    if (roles.size === 0) {
      roles = await guild.roles.fetch().catch(() => guild.roles.cache);
    }
    const botHighestPosition = guild.members.me?.roles.highest.position || 0;

    for (const [, r] of roles) {
      if (r.name === "@everyone" || r.managed || r.position >= botHighestPosition) continue;
      try {
        await r.delete("Server Purge via GuildPilot");
        results.rolesDeleted++;
      } catch (e: any) {
        console.warn(`[Purge Service] Failed to delete role ${r.name}:`, e.message);
      }
    }
  }

  // 6. Delete Emojis
  if (options.deleteEmojis) {
    const emojis = guild.emojis.cache;
    for (const [, emoji] of emojis) {
      try {
        await emoji.delete("Server Purge via GuildPilot");
        results.emojisDeleted++;
      } catch (e: any) {
        console.warn(`[Purge Service] Failed to delete emoji ${emoji.name}:`, e.message);
      }
    }
  }

  // 7. Delete Stickers
  if (options.deleteStickers) {
    const stickers = guild.stickers.cache;
    for (const [, sticker] of stickers) {
      try {
        await sticker.delete("Server Purge via GuildPilot");
        results.stickersDeleted++;
      } catch (e: any) {
        console.warn(`[Purge Service] Failed to delete sticker ${sticker.name}:`, e.message);
      }
    }
  }

  // 8. Delete Invites
  if (options.deleteInvites) {
    try {
      const invites = await guild.invites.fetch().catch(() => new Map());
      for (const [, inv] of invites) {
        try {
          await inv.delete("Server Purge via GuildPilot");
          results.invitesDeleted++;
        } catch (e) {}
      }
    } catch {}
  }

  // 9. Reset Database Module Configs for this Guild
  if (options.deleteDatabaseConfigs) {
    try {
      const [tp, af, cm, ar, sr] = await Promise.all([
        prisma.ticketPanel.deleteMany({ where: { guildId } }),
        prisma.ticketCategory.deleteMany({ where: { guildId } }),
        prisma.ticketSetting.deleteMany({ where: { guildId } }),
        prisma.appPanel.deleteMany({ where: { guildId } }),
        prisma.appForm.deleteMany({ where: { guildId } }),
        prisma.appSettings.deleteMany({ where: { guildId } }),
        prisma.selfRolePanel.deleteMany({ where: { guildId } }),
        prisma.customMessage.deleteMany({ where: { guildId } }),
        prisma.welcomeSetting.deleteMany({ where: { guildId } }),
        prisma.leaveSetting.deleteMany({ where: { guildId } }),
        prisma.autoReact.deleteMany({ where: { guildId } }),
      ]);
      results.dbConfigsDeleted = tp.count + af.count + cm.count + ar.count + sr.count;
    } catch (e: any) {
      console.warn("[Purge Service] Error resetting DB configs:", e.message);
    }
  }

  broadcastEvent("guildUpdate", { guildId });
  broadcastEvent("channelDelete", { guildId });
  broadcastEvent("roleDelete", { guildId });

  return results;
}
