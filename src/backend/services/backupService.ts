import {
  ChannelType,
  Guild,
  GuildChannelTypes,
  PermissionsBitField,
  Role,
} from "discord.js";
import { PrismaClient } from "@prisma/client";
import { discordClient, isBotReady } from "../bot/client";
import { broadcastEvent } from "../socket/socketManager";

const prisma = new PrismaClient();

export interface BackupDataSnapshot {
  guild: {
    id: string;
    name: string;
    icon: string | null;
    banner: string | null;
    description: string | null;
    verificationLevel: number;
    defaultMessageNotifications: number;
    afkTimeout: number;
    memberCount: number;
  };
  categories: Array<{
    id: string;
    name: string;
    position?: number;
    permissionOverwrites?: Array<{
      id: string;
      type: number;
      allow: string;
      deny: string;
    }>;
  }>;
  channels: Array<{
    id: string;
    name: string;
    type: number;
    topic?: string | null;
    nsfw?: boolean;
    rateLimitPerUser?: number;
    parentId?: string | null;
    position?: number;
    permissionOverwrites?: Array<{
      id: string;
      type: number;
      allow: string;
      deny: string;
    }>;
  }>;
  roles: Array<{
    id: string;
    name: string;
    color: string;
    hoist: boolean;
    position: number;
    permissions: string;
    mentionable: boolean;
    managed: boolean;
  }>;
  emojis: Array<{
    id: string;
    name: string;
    url: string;
  }>;
  stickers: Array<{
    id: string;
    name: string;
    url: string;
  }>;
  databaseModules?: {
    ticketPanels?: any[];
    ticketCategories?: any[];
    ticketSetting?: any | null;
    appForms?: any[];
    appSettings?: any | null;
    selfRolePanels?: any[];
    customMessages?: any[];
    welcomeSetting?: any | null;
    leaveSetting?: any | null;
    autoReacts?: any[];
  };
}

export interface RestoreOptions {
  restoreRoles?: boolean;
  restoreCategories?: boolean;
  restoreChannels?: boolean;
  restoreBotModules?: boolean;
}

/**
 * Capture all DB configuration records for a guild
 */
async function captureGuildDatabaseModules(guildId: string) {
  const [
    ticketPanels,
    ticketCategories,
    ticketSetting,
    appForms,
    appSettings,
    selfRolePanels,
    customMessages,
    welcomeSetting,
    leaveSetting,
    autoReacts,
  ] = await Promise.all([
    prisma.ticketPanel.findMany({ where: { guildId } }),
    prisma.ticketCategory.findMany({ where: { guildId } }),
    prisma.ticketSetting.findUnique({ where: { guildId } }),
    prisma.appForm.findMany({
      where: { guildId },
      include: { questions: true },
    }),
    prisma.appSettings.findUnique({ where: { guildId } }),
    prisma.selfRolePanel.findMany({
      where: { guildId },
      include: { options: true },
    }),
    prisma.customMessage.findMany({
      where: { guildId },
    }),
    prisma.welcomeSetting.findUnique({ where: { guildId } }),
    prisma.leaveSetting.findUnique({ where: { guildId } }),
    prisma.autoReact.findMany({ where: { guildId } }),
  ]);

  return {
    ticketPanels,
    ticketCategories,
    ticketSetting,
    appForms,
    appSettings,
    selfRolePanels,
    customMessages,
    welcomeSetting,
    leaveSetting,
    autoReacts,
  };
}

/**
 * Helper to safely extract permission overwrites from a channel or category
 */
function extractPermissionOverwrites(channel: any) {
  if (!channel || !channel.permissionOverwrites) return [];
  try {
    const values = channel.permissionOverwrites.cache
      ? Array.from(channel.permissionOverwrites.cache.values())
      : Array.isArray(channel.permissionOverwrites)
      ? channel.permissionOverwrites
      : [];

    return values.map((p: any) => ({
      id: p.id,
      type: p.type ?? 0,
      allow: p.allow?.bitfield ? p.allow.bitfield.toString() : (p.allow?.toString() || "0"),
      deny: p.deny?.bitfield ? p.deny.bitfield.toString() : (p.deny?.toString() || "0"),
    }));
  } catch (err) {
    return [];
  }
}

/**
 * Create a manual server snapshot/backup
 */
export async function createManualBackup(guildId: string, backupName: string, reason?: string) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId) || (await discordClient.guilds.fetch(guildId).catch(() => null));
  if (!guild) throw new Error("Guild not found.");

  // Fetch channels & roles if needed
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

  const dbModules = await captureGuildDatabaseModules(guildId);

  const snapshot: BackupDataSnapshot = {
    guild: {
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL(),
      banner: guild.bannerURL(),
      description: guild.description,
      verificationLevel: guild.verificationLevel,
      defaultMessageNotifications: guild.defaultMessageNotifications,
      afkTimeout: guild.afkTimeout,
      memberCount: guild.memberCount,
    },
    categories: Array.from(channels.values())
      .filter((c: any) => c && c.type === ChannelType.GuildCategory)
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        position: c.position || 0,
        permissionOverwrites: extractPermissionOverwrites(c),
      })),
    channels: Array.from(channels.values())
      .filter((c: any) => c && c.type !== ChannelType.GuildCategory)
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        topic: "topic" in c ? c.topic || null : null,
        nsfw: "nsfw" in c ? c.nsfw || false : false,
        rateLimitPerUser: "rateLimitPerUser" in c ? c.rateLimitPerUser || 0 : 0,
        parentId: c.parentId || null,
        position: "position" in c ? c.position || 0 : 0,
        permissionOverwrites: extractPermissionOverwrites(c),
      })),
    roles: Array.from(roles.values()).map((r) => ({
      id: r.id,
      name: r.name,
      color: r.hexColor,
      hoist: r.hoist,
      position: r.position,
      permissions: r.permissions.bitfield.toString(),
      mentionable: r.mentionable,
      managed: r.managed,
    })),
    emojis: Array.from(emojis.values()).map((e) => ({
      id: e.id,
      name: e.name || "emoji",
      url: e.url,
    })),
    stickers: Array.from(stickers.values()).map((s) => ({
      id: s.id,
      name: s.name,
      url: s.url,
    })),
    databaseModules: dbModules,
  };

  const backup = await prisma.serverBackup.create({
    data: {
      guildId: guild.id,
      guildName: guild.name,
      guildIcon: guild.iconURL(),
      backupName: backupName.trim(),
      backupType: "MANUAL",
      reason: reason || "Manuell erstellter Server-Snapshot",
      memberCount: guild.memberCount,
      channelsCount: channels.size,
      rolesCount: roles.size,
      emojisCount: emojis.size + stickers.size,
      isBotInGuild: true,
      data: JSON.stringify(snapshot),
    },
  });

  broadcastEvent("backupCreated", { guildId: guild.id, backupId: backup.id, backupName: backup.backupName });
  return backup;
}

/**
 * Emergency Auto-Backup when bot leaves or is removed from a guild (guildDelete event)
 */
export async function createAutoLeaveBackup(guild: Guild) {
  try {
    const channels = guild.channels?.cache || new Map();
    const roles = guild.roles?.cache || new Map();
    const emojis = guild.emojis?.cache || new Map();
    const stickers = guild.stickers?.cache || new Map();

    const dbModules = await captureGuildDatabaseModules(guild.id);

    const snapshot: BackupDataSnapshot = {
      guild: {
        id: guild.id,
        name: guild.name || "Archivierter Server",
        icon: guild.iconURL?.() || null,
        banner: guild.bannerURL?.() || null,
        description: guild.description || null,
        verificationLevel: guild.verificationLevel || 0,
        defaultMessageNotifications: guild.defaultMessageNotifications || 0,
        afkTimeout: guild.afkTimeout || 300,
        memberCount: guild.memberCount || 0,
      },
      categories: Array.from(channels.values())
        .filter((c: any) => c?.type === ChannelType.GuildCategory)
        .map((c: any) => ({
          id: c.id,
          name: c.name,
          position: c.position || 0,
          permissionOverwrites: extractPermissionOverwrites(c),
        })),
      channels: Array.from(channels.values())
        .filter((c: any) => c?.type !== ChannelType.GuildCategory)
        .map((c: any) => ({
          id: c.id,
          name: c.name,
          type: c.type || 0,
          topic: c.topic || null,
          nsfw: c.nsfw || false,
          rateLimitPerUser: c.rateLimitPerUser || 0,
          parentId: c.parentId || null,
          position: c.position || 0,
          permissionOverwrites: extractPermissionOverwrites(c),
        })),
      roles: Array.from(roles.values()).map((r: any) => ({
        id: r.id,
        name: r.name,
        color: r.hexColor || "#99aab5",
        hoist: r.hoist || false,
        position: r.position || 0,
        permissions: r.permissions ? r.permissions.bitfield.toString() : "0",
        mentionable: r.mentionable || false,
        managed: r.managed || false,
      })),
      emojis: Array.from(emojis.values()).map((e: any) => ({
        id: e.id,
        name: e.name || "emoji",
        url: e.url || "",
      })),
      stickers: Array.from(stickers.values()).map((s: any) => ({
        id: s.id,
        name: s.name,
        url: s.url || "",
      })),
      databaseModules: dbModules,
    };

    const dateStr = new Date().toLocaleString("de-DE");
    const backup = await prisma.serverBackup.create({
      data: {
        guildId: guild.id,
        guildName: guild.name || "Unbekannter Server",
        guildIcon: guild.iconURL?.() || null,
        backupName: `Notfall-Backup: ${guild.name || "Server"} (${dateStr})`,
        backupType: "AUTO_LEAVE",
        reason: "Automatischer Snapshot bei Entfernung des Bots vom Server (Kicked/Left)",
        memberCount: guild.memberCount || 0,
        channelsCount: channels.size || 0,
        rolesCount: roles.size || 0,
        emojisCount: (emojis.size || 0) + (stickers.size || 0),
        isBotInGuild: false,
        data: JSON.stringify(snapshot),
      },
    });

    console.log(`[TheGodGen Bot] Emergency auto-leave backup saved for ${guild.name} (ID: ${backup.id})`);
    return backup;
  } catch (err: any) {
    console.error("[TheGodGen Bot] Error in createAutoLeaveBackup:", err.message);
    return null;
  }
}

/**
 * List all saved server backups
 */
export async function getBackups(filters?: { guildId?: string }) {
  const where: any = {};
  if (filters?.guildId) where.guildId = filters.guildId;

  const backups = await prisma.serverBackup.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return backups.map((b) => {
    let summary = null;
    try {
      const snap: BackupDataSnapshot = JSON.parse(b.data);
      summary = {
        categoriesCount: snap.categories?.length || 0,
        textChannelsCount: snap.channels?.filter((c) => c.type === 0 || c.type === 5).length || 0,
        voiceChannelsCount: snap.channels?.filter((c) => c.type === 2).length || 0,
        rolesCount: snap.roles?.length || 0,
        hasTicketModules: Boolean(snap.databaseModules?.ticketPanels && snap.databaseModules.ticketPanels.length > 0),
        hasAppModules: Boolean(snap.databaseModules?.appForms && snap.databaseModules.appForms.length > 0),
        hasWelcome: Boolean(snap.databaseModules?.welcomeSetting?.enabled),
        hasCustomMessages: Boolean(snap.databaseModules?.customMessages && snap.databaseModules.customMessages.length > 0),
        hasAutoReact: Boolean(snap.databaseModules?.autoReacts && snap.databaseModules.autoReacts.length > 0),
      };
    } catch {}

    const isBotPresent = isBotReady() ? discordClient.guilds.cache.has(b.guildId) : b.isBotInGuild;

    return {
      ...b,
      isBotInGuild: isBotPresent,
      summary,
    };
  });
}

/**
 * Get single backup by ID with parsed JSON data
 */
export async function getBackupById(id: string) {
  const backup = await prisma.serverBackup.findUnique({ where: { id } });
  if (!backup) throw new Error("Backup not found.");

  const isBotPresent = isBotReady() ? discordClient.guilds.cache.has(backup.guildId) : backup.isBotInGuild;

  return {
    ...backup,
    isBotInGuild: isBotPresent,
    data: JSON.parse(backup.data) as BackupDataSnapshot,
  };
}

/**
 * Delete a backup by ID
 */
export async function deleteBackup(id: string) {
  await prisma.serverBackup.delete({ where: { id } });
  return { success: true, id };
}

/**
 * Import a backup from raw JSON data
 */
export async function importBackupJson(data: BackupDataSnapshot, customName?: string) {
  if (!data || !data.guild) {
    throw new Error("Invalid backup format. Missing guild object.");
  }

  const backupName = customName || `Importiertes Backup: ${data.guild.name || "Server"}`;
  const backup = await prisma.serverBackup.create({
    data: {
      guildId: data.guild.id || "imported-" + Date.now(),
      guildName: data.guild.name || "Importierter Server",
      guildIcon: data.guild.icon || null,
      backupName,
      backupType: "IMPORTED",
      reason: "Manuell hochgeladenes JSON-Backup",
      memberCount: data.guild.memberCount || 0,
      channelsCount: (data.channels?.length || 0) + (data.categories?.length || 0),
      rolesCount: data.roles?.length || 0,
      emojisCount: (data.emojis?.length || 0) + (data.stickers?.length || 0),
      isBotInGuild: false,
      data: JSON.stringify(data),
    },
  });

  return backup;
}

/**
 * Restore a backup onto a target guild
 */
export async function restoreBackup(targetGuildId: string, backupId: string, options?: RestoreOptions) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const targetGuild = discordClient.guilds.cache.get(targetGuildId) || (await discordClient.guilds.fetch(targetGuildId).catch(() => null));
  if (!targetGuild) throw new Error("Target guild not found.");

  const backup = await prisma.serverBackup.findUnique({ where: { id: backupId } });
  if (!backup) throw new Error("Backup not found.");

  const snapshot: BackupDataSnapshot = JSON.parse(backup.data);

  const results = {
    rolesCreated: 0,
    categoriesCreated: 0,
    channelsCreated: 0,
    modulesRestored: [] as string[],
  };

  const roleMap = new Map<string, string>();
  const categoryMap = new Map<string, string>();
  const channelMap = new Map<string, string>();

  // 1. Restore Roles & @everyone permissions
  if (options?.restoreRoles !== false && snapshot.roles && Array.isArray(snapshot.roles)) {
    // 1.1 Restore @everyone permissions
    const everyoneRole = snapshot.roles.find((r) => r.name === "@everyone" || r.id === snapshot.guild.id);
    if (everyoneRole && everyoneRole.permissions) {
      try {
        await targetGuild.roles.everyone.setPermissions(BigInt(everyoneRole.permissions));
      } catch (err: any) {
        console.warn("[Restore Backup] Failed to set @everyone permissions:", err.message);
      }
    }

    // 1.2 Create custom roles sorted by position
    const sortedRoles = snapshot.roles
      .filter((r) => r.name !== "@everyone" && !r.managed)
      .sort((a, b) => (a.position || 0) - (b.position || 0));

    for (const r of sortedRoles) {
      try {
        const newRole = await targetGuild.roles.create({
          name: r.name,
          color: r.color as any,
          hoist: r.hoist,
          mentionable: r.mentionable,
          permissions: r.permissions ? BigInt(r.permissions) : undefined,
          reason: `Wiederhergestellt aus Backup: ${backup.backupName}`,
        });
        roleMap.set(r.id, newRole.id);
        results.rolesCreated++;
      } catch (err: any) {
        console.warn(`[Restore Backup] Fehler beim Erstellen der Rolle @${r.name}:`, err.message);
      }
    }
  }

  // Helper to map permission overwrites
  const mapPermissionOverwrites = (overwrites: any[] = []) => {
    return overwrites
      .map((po: any) => {
        let targetId = po.id;
        // Check if overwrite is for @everyone (matches source guild ID or snapshot guild ID)
        if (po.id === snapshot.guild.id || po.id === backup.guildId) {
          targetId = targetGuild.id;
        } else if (roleMap.has(po.id)) {
          targetId = roleMap.get(po.id)!;
        } else {
          // If the role wasn't created or found, search existing roles on target guild by name
          const originalRole = snapshot.roles?.find((r) => r.id === po.id);
          if (originalRole) {
            const matchedRole = targetGuild.roles.cache.find((r) => r.name === originalRole.name);
            if (matchedRole) {
              targetId = matchedRole.id;
            }
          }
        }

        if (!targetId) return null;

        return {
          id: targetId,
          type: po.type ?? 0,
          allow: BigInt(po.allow || "0"),
          deny: BigInt(po.deny || "0"),
        };
      })
      .filter((po): po is NonNullable<typeof po> => Boolean(po && po.id));
  };

  // 2. Restore Categories with permission overwrites
  if (options?.restoreCategories !== false && snapshot.categories && Array.isArray(snapshot.categories)) {
    const sortedCategories = [...snapshot.categories].sort((a, b) => (a.position || 0) - (b.position || 0));
    for (const cat of sortedCategories) {
      try {
        const overwrites = mapPermissionOverwrites(cat.permissionOverwrites);
        const newCat = await targetGuild.channels.create({
          name: cat.name,
          type: ChannelType.GuildCategory,
          position: cat.position,
          permissionOverwrites: overwrites,
          reason: `Wiederhergestellt aus Backup: ${backup.backupName}`,
        });
        categoryMap.set(cat.id, newCat.id);
        results.categoriesCreated++;
      } catch (err: any) {
        console.warn(`[Restore Backup] Fehler beim Erstellen der Kategorie ${cat.name}:`, err.message);
      }
    }
  }

  // 3. Restore Channels with permission overwrites
  if (options?.restoreChannels !== false && snapshot.channels && Array.isArray(snapshot.channels)) {
    const sortedChannels = [...snapshot.channels].sort((a, b) => (a.position || 0) - (b.position || 0));
    for (const ch of sortedChannels) {
      try {
        const parentId = ch.parentId ? categoryMap.get(ch.parentId) : undefined;
        const overwrites = mapPermissionOverwrites(ch.permissionOverwrites);
        const newCh = await targetGuild.channels.create({
          name: ch.name,
          type: ch.type as GuildChannelTypes,
          parent: parentId,
          position: ch.position,
          topic: ch.topic || undefined,
          nsfw: ch.nsfw || false,
          rateLimitPerUser: ch.rateLimitPerUser || 0,
          permissionOverwrites: overwrites,
          reason: `Wiederhergestellt aus Backup: ${backup.backupName}`,
        });
        channelMap.set(ch.id, newCh.id);
        results.channelsCreated++;
      } catch (err: any) {
        console.warn(`[Restore Backup] Fehler beim Erstellen des Kanals #${ch.name}:`, err.message);
      }
    }
  }

  // 4. Restore Bot Modules (Tickets, Apps, Welcome, Custom Messages, Auto-React)
  if (options?.restoreBotModules !== false && snapshot.databaseModules) {
    const db = snapshot.databaseModules;

    // Welcome Setting
    if (db.welcomeSetting) {
      const mappedChannel = db.welcomeSetting.channelId ? channelMap.get(db.welcomeSetting.channelId) || null : null;
      await prisma.welcomeSetting.upsert({
        where: { guildId: targetGuildId },
        update: {
          enabled: db.welcomeSetting.enabled,
          channelId: mappedChannel,
          messageText: db.welcomeSetting.messageText,
          cardTitle: db.welcomeSetting.cardTitle,
          cardSubtitle: db.welcomeSetting.cardSubtitle,
          avatarRingColor: db.welcomeSetting.avatarRingColor,
          cardBgColor: db.welcomeSetting.cardBgColor,
          cardBorderColor: db.welcomeSetting.cardBorderColor,
          cardBgImage: db.welcomeSetting.cardBgImage,
          sendCard: db.welcomeSetting.sendCard,
          sendDm: db.welcomeSetting.sendDm,
          dmText: db.welcomeSetting.dmText,
        },
        create: {
          guildId: targetGuildId,
          enabled: db.welcomeSetting.enabled,
          channelId: mappedChannel,
          messageText: db.welcomeSetting.messageText,
          cardTitle: db.welcomeSetting.cardTitle,
          cardSubtitle: db.welcomeSetting.cardSubtitle,
          avatarRingColor: db.welcomeSetting.avatarRingColor,
          cardBgColor: db.welcomeSetting.cardBgColor,
          cardBorderColor: db.welcomeSetting.cardBorderColor,
          cardBgImage: db.welcomeSetting.cardBgImage,
          sendCard: db.welcomeSetting.sendCard,
          sendDm: db.welcomeSetting.sendDm,
          dmText: db.welcomeSetting.dmText,
        },
      });
      results.modulesRestored.push("Welcome & Goodbye System");
    }

    // Ticket Panels
    if (db.ticketPanels && Array.isArray(db.ticketPanels)) {
      for (const p of db.ticketPanels) {
        await prisma.ticketPanel.create({
          data: {
            guildId: targetGuildId,
            name: p.name,
            description: p.description,
            embedTitle: p.embedTitle,
            embedDescription: p.embedDescription,
            embedColor: p.embedColor,
            thumbnail: p.thumbnail,
            image: p.image,
            footer: p.footer,
            welcomeTitle: p.welcomeTitle,
            welcomeDescription: p.welcomeDescription,
            welcomeColor: p.welcomeColor,
            reasons: p.reasons,
            questions: p.questions,
            channelId: p.channelId ? channelMap.get(p.channelId) || null : null,
            categoryId: p.categoryId ? categoryMap.get(p.categoryId) || null : null,
            buttonText: p.buttonText,
            buttonEmoji: p.buttonEmoji,
            buttonColor: p.buttonColor,
            allowedRoles: p.allowedRoles,
            supportRoles: p.supportRoles,
            maxOpenTickets: p.maxOpenTickets,
            autoCloseHours: p.autoCloseHours,
            transcriptEnabled: p.transcriptEnabled,
          },
        });
      }
      if (db.ticketPanels.length > 0) results.modulesRestored.push("Ticket Panels");
    }

    // App Forms
    if (db.appForms && Array.isArray(db.appForms)) {
      for (const f of db.appForms) {
        const newForm = await prisma.appForm.create({
          data: {
            guildId: targetGuildId,
            name: f.name,
            description: f.description,
            emoji: f.emoji,
            category: f.category,
            displayType: f.displayType,
            embedTitle: f.embedTitle,
            embedDescription: f.embedDescription,
            embedColor: f.embedColor,
            buttonText: f.buttonText,
            buttonEmoji: f.buttonEmoji,
            buttonColor: f.buttonColor,
            targetChannelId: f.targetChannelId ? channelMap.get(f.targetChannelId) || null : null,
            categoryId: f.categoryId ? categoryMap.get(f.categoryId) || null : null,
            cooldownHours: f.cooldownHours,
            maxActiveApps: f.maxActiveApps,
            isOpen: f.isOpen,
          },
        });

        if (f.questions && Array.isArray(f.questions)) {
          for (const q of f.questions) {
            await prisma.appQuestion.create({
              data: {
                formId: newForm.id,
                label: q.label,
                type: q.type,
                placeholder: q.placeholder,
                required: q.required,
                options: q.options,
                order: q.order,
              },
            });
          }
        }
      }
      if (db.appForms.length > 0) results.modulesRestored.push("Bewerbungs-Formulare");
    }

    // Self Role Panels
    if (db.selfRolePanels && Array.isArray(db.selfRolePanels)) {
      for (const s of db.selfRolePanels) {
        const newPanel = await prisma.selfRolePanel.create({
          data: {
            guildId: targetGuildId,
            name: s.name,
            description: s.description,
            displayType: s.displayType,
            layoutMode: s.layoutMode,
            multiSelect: s.multiSelect,
            placeholderText: s.placeholderText,
            embedTitle: s.embedTitle,
            embedDescription: s.embedDescription,
            embedColor: s.embedColor,
            embedAuthorName: s.embedAuthorName,
            embedAuthorIcon: s.embedAuthorIcon,
            embedAuthorUrl: s.embedAuthorUrl,
            thumbnail: s.thumbnail,
            image: s.image,
            footer: s.footer,
            footerIcon: s.footerIcon,
            showTimestamp: s.showTimestamp,
            embedFields: s.embedFields,
            addRoleMessage: s.addRoleMessage,
            removeRoleMessage: s.removeRoleMessage,
            ephemeralResponse: s.ephemeralResponse,
            channelId: s.channelId ? channelMap.get(s.channelId) || null : null,
          },
        });

        if (s.options && Array.isArray(s.options)) {
          for (const opt of s.options) {
            const mappedRoleId = roleMap.get(opt.roleId) || opt.roleId;
            await prisma.selfRoleOption.create({
              data: {
                panelId: newPanel.id,
                roleId: mappedRoleId,
                roleName: opt.roleName,
                roleColor: opt.roleColor,
                label: opt.label,
                emoji: opt.emoji,
                buttonColor: opt.buttonColor,
                description: opt.description,
                showMemberCount: opt.showMemberCount,
                requiredRoles: opt.requiredRoles,
                exclusiveGroup: opt.exclusiveGroup,
                order: opt.order,
              },
            });
          }
        }
      }
      if (db.selfRolePanels.length > 0) results.modulesRestored.push("Self-Role Panels");
    }

    // Custom Messages
    if (db.customMessages && Array.isArray(db.customMessages)) {
      for (const cm of db.customMessages) {
        const mappedChannelId = cm.channelId ? channelMap.get(cm.channelId) || cm.channelId : null;
        await prisma.customMessage.create({
          data: {
            guildId: targetGuildId,
            name: cm.name,
            description: cm.description,
            mode: cm.mode,
            channelId: mappedChannelId,
            content: cm.content,
            flags: cm.flags,
            accentColor: cm.accentColor,
            spoiler: cm.spoiler,
            containerConfig: cm.containerConfig,
            embedConfig: cm.embedConfig,
            componentsConfig: cm.componentsConfig,
          },
        });
      }
      if (db.customMessages.length > 0) results.modulesRestored.push("Custom Messages (V2)");
    }

    // Auto-React
    if (db.autoReacts && Array.isArray(db.autoReacts)) {
      for (const ar of db.autoReacts) {
        let mappedChannelIds = ar.channelIds;
        try {
          const parsedIds: string[] = JSON.parse(ar.channelIds);
          const mapped = parsedIds.map((id) => channelMap.get(id) || id);
          mappedChannelIds = JSON.stringify(mapped);
        } catch {}

        await prisma.autoReact.create({
          data: {
            guildId: targetGuildId,
            name: ar.name,
            enabled: ar.enabled,
            channelIds: mappedChannelIds,
            emojis: ar.emojis,
            ignoreBots: ar.ignoreBots,
          },
        });
      }
      if (db.autoReacts.length > 0) results.modulesRestored.push("Auto-Reaktionen");
    }
  }

  broadcastEvent("guildUpdate", { guildId: targetGuildId });
  broadcastEvent("channelCreate", { guildId: targetGuildId });
  broadcastEvent("roleCreate", { guildId: targetGuildId });

  return results;
}
