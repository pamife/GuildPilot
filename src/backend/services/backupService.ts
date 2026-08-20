import { PrismaClient } from "@prisma/client";
import { ChannelType, Guild, GuildChannelTypes, Role } from "discord.js";
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
    position: number;
    permissionOverwrites?: Array<{ id: string; type: number; allow: string; deny: string }>;
  }>;
  channels: Array<{
    id: string;
    name: string;
    type: number;
    topic: string | null;
    nsfw: boolean;
    rateLimitPerUser: number;
    parentId: string | null;
    position: number;
    permissionOverwrites?: Array<{ id: string; type: number; allow: string; deny: string }>;
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
  databaseModules: {
    ticketSettings: any;
    ticketPanels: any[];
    ticketCategories: any[];
    appSettings: any;
    appPanels: any[];
    appForms: any[];
    selfRolePanels: any[];
    customMessages: any[];
    welcomeSetting: any;
    leaveSetting: any;
    autoReacts: any[];
  };
}

/**
 * Capture full database module settings for a guild
 */
async function captureGuildDatabaseModules(guildId: string) {
  const [
    ticketSettings,
    ticketPanels,
    ticketCategories,
    appSettings,
    appPanels,
    appForms,
    selfRolePanels,
    customMessages,
    welcomeSetting,
    leaveSetting,
    autoReacts,
  ] = await Promise.all([
    prisma.ticketSetting.findUnique({ where: { guildId } }).catch(() => null),
    prisma.ticketPanel.findMany({ where: { guildId } }).catch(() => []),
    prisma.ticketCategory.findMany({ where: { guildId } }).catch(() => []),
    prisma.appSettings.findUnique({ where: { guildId } }).catch(() => null),
    prisma.appPanel.findMany({ where: { guildId } }).catch(() => []),
    prisma.appForm.findMany({ where: { guildId }, include: { questions: true } }).catch(() => []),
    prisma.selfRolePanel.findMany({ where: { guildId }, include: { options: true } }).catch(() => []),
    prisma.customMessage.findMany({ where: { guildId } }).catch(() => []),
    prisma.welcomeSetting.findUnique({ where: { guildId } }).catch(() => null),
    prisma.leaveSetting.findUnique({ where: { guildId } }).catch(() => null),
    prisma.autoReact.findMany({ where: { guildId } }).catch(() => []),
  ]);

  return {
    ticketSettings,
    ticketPanels,
    ticketCategories,
    appSettings,
    appPanels,
    appForms,
    selfRolePanels,
    customMessages,
    welcomeSetting,
    leaveSetting,
    autoReacts,
  };
}

/**
 * Create a full snapshot of a guild
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
        permissionOverwrites: c.permissionOverwrites
          ? Array.from(c.permissionOverwrites.cache.values()).map((p: any) => ({
              id: p.id,
              type: p.type,
              allow: p.allow.bitfield.toString(),
              deny: p.deny.bitfield.toString(),
            }))
          : [],
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
        permissionOverwrites: c.permissionOverwrites
          ? Array.from(c.permissionOverwrites.cache.values()).map((p: any) => ({
              id: p.id,
              type: p.type,
              allow: p.allow.bitfield.toString(),
              deny: p.deny.bitfield.toString(),
            }))
          : [],
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
        backupName: `Auto-Backup (Bot verlassen: ${guild.name || guild.id})`,
        backupType: "AUTO_LEAVE",
        reason: `Automatisches Notfall-Backup beim Verlassen/Entfernen des Bots am ${dateStr}`,
        memberCount: guild.memberCount || 0,
        channelsCount: channels.size || 0,
        rolesCount: roles.size || 0,
        emojisCount: (emojis.size || 0) + (stickers.size || 0),
        isBotInGuild: false,
        data: JSON.stringify(snapshot),
      },
    });

    // Mark previous backups of this guild as isBotInGuild: false
    await prisma.serverBackup.updateMany({
      where: { guildId: guild.id },
      data: { isBotInGuild: false },
    });

    console.log(`[Backup Service] Successfully created auto-leave backup for guild: ${guild.name} (${guild.id})`);
    return backup;
  } catch (err) {
    console.error("[Backup Service] Error inside createAutoLeaveBackup:", err);
    return null;
  }
}

/**
 * Get list of all backups
 */
export async function getBackups(options?: { guildId?: string }) {
  const where: any = {};
  if (options?.guildId) where.guildId = options.guildId;

  const backups = await prisma.serverBackup.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return backups.map((b) => {
    let parsed: any = null;
    try {
      parsed = JSON.parse(b.data);
    } catch {}

    const isConnected = isBotReady() && Boolean(discordClient.guilds.cache.get(b.guildId));

    return {
      id: b.id,
      guildId: b.guildId,
      guildName: b.guildName,
      guildIcon: b.guildIcon,
      backupName: b.backupName,
      backupType: b.backupType,
      reason: b.reason,
      memberCount: b.memberCount,
      channelsCount: b.channelsCount,
      rolesCount: b.rolesCount,
      emojisCount: b.emojisCount,
      isBotInGuild: isConnected,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      summary: parsed
        ? {
            categoriesCount: parsed.categories?.length || 0,
            textChannelsCount: parsed.channels?.filter((c: any) => c.type === 0)?.length || 0,
            voiceChannelsCount: parsed.channels?.filter((c: any) => c.type === 2)?.length || 0,
            rolesCount: parsed.roles?.length || 0,
            hasTicketModules: Boolean(parsed.databaseModules?.ticketPanels?.length),
            hasAppModules: Boolean(parsed.databaseModules?.appForms?.length),
            hasWelcome: Boolean(parsed.databaseModules?.welcomeSetting),
            hasCustomMessages: Boolean(parsed.databaseModules?.customMessages?.length),
            hasAutoReact: Boolean(parsed.databaseModules?.autoReacts?.length),
          }
        : null,
    };
  });
}

/**
 * Get detailed backup with full decoded data
 */
export async function getBackupById(backupId: string) {
  const backup = await prisma.serverBackup.findUnique({ where: { id: backupId } });
  if (!backup) throw new Error("Backup nicht gefunden.");

  return {
    ...backup,
    data: JSON.parse(backup.data),
  };
}

/**
 * Delete backup
 */
export async function deleteBackup(backupId: string) {
  await prisma.serverBackup.delete({ where: { id: backupId } });
  return { success: true, id: backupId };
}

/**
 * Import backup from JSON data
 */
export async function importBackupJson(payload: any, backupName?: string) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Ungültige JSON-Backup-Daten.");
  }

  const guildName = payload.guild?.name || "Importierter Server";
  const guildId = payload.guild?.id || `imported_${Date.now()}`;
  const icon = payload.guild?.icon || null;
  const name = backupName?.trim() || `Import: ${guildName} (${new Date().toLocaleDateString("de-DE")})`;

  const channelsCount = (payload.channels?.length || 0) + (payload.categories?.length || 0);
  const rolesCount = payload.roles?.length || 0;
  const emojisCount = (payload.emojis?.length || 0) + (payload.stickers?.length || 0);

  const backup = await prisma.serverBackup.create({
    data: {
      guildId,
      guildName,
      guildIcon: icon,
      backupName: name,
      backupType: "IMPORTED",
      reason: "Manuell importierte Backup-Datei",
      memberCount: payload.guild?.memberCount || 0,
      channelsCount,
      rolesCount,
      emojisCount,
      isBotInGuild: false,
      data: JSON.stringify(payload),
    },
  });

  return backup;
}

/**
 * Restore a backup onto a target Discord guild
 */
export async function restoreBackup(
  targetGuildId: string,
  backupId: string,
  options?: {
    restoreRoles?: boolean;
    restoreCategories?: boolean;
    restoreChannels?: boolean;
    restoreBotModules?: boolean;
  }
) {
  if (!isBotReady()) throw new Error("Discord Bot ist nicht verbunden.");
  const targetGuild = discordClient.guilds.cache.get(targetGuildId);
  if (!targetGuild) throw new Error("Ziel-Server nicht gefunden oder Bot hat keinen Zugriff.");

  const backup = await prisma.serverBackup.findUnique({ where: { id: backupId } });
  if (!backup) throw new Error("Backup nicht gefunden.");

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

  // 1. Restore Roles
  if (options?.restoreRoles !== false && snapshot.roles && Array.isArray(snapshot.roles)) {
    for (const r of snapshot.roles) {
      if (r.name === "@everyone" || r.managed) continue;
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

  // 2. Restore Categories
  if (options?.restoreCategories !== false && snapshot.categories && Array.isArray(snapshot.categories)) {
    for (const cat of snapshot.categories) {
      try {
        const newCat = await targetGuild.channels.create({
          name: cat.name,
          type: ChannelType.GuildCategory,
          reason: `Wiederhergestellt aus Backup: ${backup.backupName}`,
        });
        categoryMap.set(cat.id, newCat.id);
        results.categoriesCreated++;
      } catch (err: any) {
        console.warn(`[Restore Backup] Fehler beim Erstellen der Kategorie ${cat.name}:`, err.message);
      }
    }
  }

  // 3. Restore Channels
  if (options?.restoreChannels !== false && snapshot.channels && Array.isArray(snapshot.channels)) {
    for (const ch of snapshot.channels) {
      try {
        const parentId = ch.parentId ? categoryMap.get(ch.parentId) : undefined;
        const newCh = await targetGuild.channels.create({
          name: ch.name,
          type: ch.type as GuildChannelTypes,
          parent: parentId,
          topic: ch.topic || undefined,
          nsfw: ch.nsfw || false,
          rateLimitPerUser: ch.rateLimitPerUser || 0,
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

    // Custom Messages
    if (db.customMessages && Array.isArray(db.customMessages)) {
      for (const m of db.customMessages) {
        await prisma.customMessage.create({
          data: {
            guildId: targetGuildId,
            name: m.name,
            description: m.description,
            mode: m.mode,
            channelId: m.channelId ? channelMap.get(m.channelId) || null : null,
            content: m.content,
            flags: m.flags,
            accentColor: m.accentColor,
            spoiler: m.spoiler,
            containerConfig: m.containerConfig,
            embedConfig: m.embedConfig,
            componentsConfig: m.componentsConfig,
          },
        });
      }
      if (db.customMessages.length > 0) results.modulesRestored.push("Custom Messages & V2");
    }

    // Auto Reacts
    if (db.autoReacts && Array.isArray(db.autoReacts)) {
      for (const r of db.autoReacts) {
        await prisma.autoReact.create({
          data: {
            guildId: targetGuildId,
            name: r.name,
            enabled: r.enabled,
            channelIds: r.channelIds,
            emojis: r.emojis,
            ignoreBots: r.ignoreBots,
          },
        });
      }
      if (db.autoReacts.length > 0) results.modulesRestored.push("Auto Reactions");
    }
  }

  return results;
}
