import { PrismaClient } from "@prisma/client";
import { ChannelType, Guild } from "discord.js";
import { discordClient, isBotReady } from "../bot/client";
import { broadcastEvent } from "../socket/socketManager";

const prisma = new PrismaClient();

export interface CloneOptions {
  tickets?: {
    enabled: boolean;
    includeSettings?: boolean;
    panelIds?: string[];
    categoryIds?: string[];
  };
  applications?: {
    enabled: boolean;
    includeSettings?: boolean;
    panelIds?: string[];
    formIds?: string[];
  };
  customMessages?: {
    enabled: boolean;
    messageIds?: string[];
  };
  welcome?: {
    enabled: boolean;
    includeWelcome?: boolean;
    includeLeave?: boolean;
  };
  autoReact?: {
    enabled: boolean;
    ruleIds?: string[];
  };
  layout?: {
    enabled: boolean;
    includeCategories?: boolean;
    includeChannels?: boolean;
    includeRoles?: boolean;
  };
  smartMapping?: boolean;
  createMissingRoles?: boolean;
  createMissingChannels?: boolean;
}

/**
 * Returns a full structured summary of configurable items on the source server
 */
export async function getSourceServerDataSummary(sourceGuildId: string, targetGuildId: string) {
  // 1. Fetch database records from source guild
  const [
    ticketSettings,
    ticketPanels,
    ticketCategories,
    appSettings,
    appPanels,
    appForms,
    customMessages,
    welcomeSetting,
    leaveSetting,
    autoReacts,
  ] = await Promise.all([
    prisma.ticketSetting.findUnique({ where: { guildId: sourceGuildId } }),
    prisma.ticketPanel.findMany({ where: { guildId: sourceGuildId }, orderBy: { createdAt: "desc" } }),
    prisma.ticketCategory.findMany({ where: { guildId: sourceGuildId }, orderBy: { createdAt: "desc" } }),
    prisma.appSettings.findUnique({ where: { guildId: sourceGuildId } }),
    prisma.appPanel.findMany({ where: { guildId: sourceGuildId }, orderBy: { createdAt: "desc" } }),
    prisma.appForm.findMany({
      where: { guildId: sourceGuildId },
      include: { questions: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.customMessage.findMany({ where: { guildId: sourceGuildId }, orderBy: { createdAt: "desc" } }),
    prisma.welcomeSetting.findUnique({ where: { guildId: sourceGuildId } }),
    prisma.leaveSetting.findUnique({ where: { guildId: sourceGuildId } }),
    prisma.autoReact.findMany({ where: { guildId: sourceGuildId }, orderBy: { createdAt: "desc" } }),
  ]);

  // 2. Fetch Discord metadata if bot is connected
  let sourceGuildInfo = { name: "Source Server", memberCount: 0, channelsCount: 0, rolesCount: 0 };
  let targetGuildInfo = { name: "Target Server", memberCount: 0, channelsCount: 0, rolesCount: 0 };

  if (isBotReady()) {
    const src = discordClient.guilds.cache.get(sourceGuildId);
    if (src) {
      sourceGuildInfo = {
        name: src.name,
        memberCount: src.memberCount,
        channelsCount: src.channels.cache.size,
        rolesCount: src.roles.cache.size,
      };
    }

    const tgt = discordClient.guilds.cache.get(targetGuildId);
    if (tgt) {
      targetGuildInfo = {
        name: tgt.name,
        memberCount: tgt.memberCount,
        channelsCount: tgt.channels.cache.size,
        rolesCount: tgt.roles.cache.size,
      };
    }
  }

  // Parse JSON properties for frontend consumption
  const parsedTicketPanels = ticketPanels.map((p) => {
    let reasons: any[] = [];
    let questions: any[] = [];
    try {
      reasons = JSON.parse(p.reasons || "[]");
    } catch (e) {}
    try {
      questions = JSON.parse(p.questions || "[]");
    } catch (e) {}
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      embedTitle: p.embedTitle,
      buttonText: p.buttonText,
      buttonEmoji: p.buttonEmoji,
      embedColor: p.embedColor,
      reasonsCount: reasons.length,
      questionsCount: questions.length,
      createdAt: p.createdAt,
    };
  });

  const parsedAppForms = appForms.map((f) => ({
    id: f.id,
    name: f.name,
    category: f.category,
    emoji: f.emoji,
    description: f.description,
    displayType: f.displayType,
    questionsCount: f.questions.length,
    isOpen: f.isOpen,
    createdAt: f.createdAt,
  }));

  const parsedCustomMessages = customMessages.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    mode: m.mode,
    accentColor: m.accentColor,
    createdAt: m.createdAt,
  }));

  const parsedAutoReacts = autoReacts.map((r) => {
    let emojis: string[] = [];
    try {
      emojis = JSON.parse(r.emojis || "[]");
    } catch (e) {}
    return {
      id: r.id,
      name: r.name,
      enabled: r.enabled,
      emojis,
      createdAt: r.createdAt,
    };
  });

  return {
    sourceGuild: sourceGuildInfo,
    targetGuild: targetGuildInfo,
    tickets: {
      hasSettings: Boolean(ticketSettings),
      panels: parsedTicketPanels,
      categories: ticketCategories.map((c) => ({ id: c.id, name: c.name, emoji: c.emoji })),
    },
    applications: {
      hasSettings: Boolean(appSettings),
      panels: appPanels.map((p) => ({ id: p.id, name: p.name, description: p.description })),
      forms: parsedAppForms,
    },
    customMessages: parsedCustomMessages,
    welcome: {
      welcomeConfigured: Boolean(welcomeSetting),
      welcomeEnabled: welcomeSetting?.enabled || false,
      welcomeCardTitle: welcomeSetting?.cardTitle || null,
      leaveConfigured: Boolean(leaveSetting),
      leaveEnabled: leaveSetting?.enabled || false,
      leaveCardTitle: leaveSetting?.cardTitle || null,
    },
    autoReact: parsedAutoReacts,
  };
}

/**
 * Execute cloning / importing of modules from source guild to target guild
 */
export async function cloneServerModules(
  targetGuildId: string,
  sourceGuildId: string,
  options: CloneOptions
) {
  if (sourceGuildId === targetGuildId) {
    throw new Error("Source server and target server cannot be the same.");
  }

  const results: {
    tickets?: { panelsCloned: number; categoriesCloned: number; settingsCloned: boolean };
    applications?: { panelsCloned: number; formsCloned: number; settingsCloned: boolean };
    customMessages?: { messagesCloned: number };
    welcome?: { welcomeCloned: boolean; leaveCloned: boolean };
    autoReact?: { rulesCloned: number };
    layout?: { categoriesCreated: number; channelsCreated: number; rolesCreated: number };
  } = {};

  // Build role and channel maps (source ID -> target ID)
  const roleMap = new Map<string, string>();
  const channelMap = new Map<string, string>();
  const categoryMap = new Map<string, string>();

  let sourceGuild: Guild | undefined;
  let targetGuild: Guild | undefined;

  if (isBotReady()) {
    sourceGuild = discordClient.guilds.cache.get(sourceGuildId);
    targetGuild = discordClient.guilds.cache.get(targetGuildId);
  }

  const mapRoleIdsArray = (srcRoleIds: string[] | string): string => {
    let ids: string[] = [];
    if (typeof srcRoleIds === "string") {
      try {
        ids = JSON.parse(srcRoleIds || "[]");
      } catch (e) {
        ids = [];
      }
    } else if (Array.isArray(srcRoleIds)) {
      ids = srcRoleIds;
    }
    const mapped = ids.map((id) => roleMap.get(id)).filter(Boolean) as string[];
    return JSON.stringify(mapped);
  };

  const mapChannelId = (srcChannelId: string | null | undefined): string | null => {
    if (!srcChannelId) return null;
    return channelMap.get(srcChannelId) || null;
  };

  const mapCategoryId = (srcCatId: string | null | undefined): string | null => {
    if (!srcCatId) return null;
    return categoryMap.get(srcCatId) || null;
  };

  // Perform Smart Name Matching between Source and Target guilds
  if (sourceGuild && targetGuild) {
    const srcRoles = sourceGuild.roles.cache;
    const tgtRoles = targetGuild.roles.cache;

    srcRoles.forEach((srcRole) => {
      if (srcRole.name === "@everyone") {
        const tgtEveryone = targetGuild?.roles.everyone;
        if (tgtEveryone) roleMap.set(srcRole.id, tgtEveryone.id);
        return;
      }
      const matched = tgtRoles.find(
        (tr) => tr.name.toLowerCase() === srcRole.name.toLowerCase() && !tr.managed
      );
      if (matched) {
        roleMap.set(srcRole.id, matched.id);
      }
    });

    const srcChannels = sourceGuild.channels.cache;
    const tgtChannels = targetGuild.channels.cache;

    srcChannels.forEach((srcCh) => {
      if (srcCh.type === ChannelType.GuildCategory) {
        const matchedCat = tgtChannels.find(
          (tc) => tc.type === ChannelType.GuildCategory && tc.name.toLowerCase() === srcCh.name.toLowerCase()
        );
        if (matchedCat) {
          categoryMap.set(srcCh.id, matchedCat.id);
        }
      } else {
        const matchedCh = tgtChannels.find(
          (tc) => tc.type === srcCh.type && tc.name.toLowerCase() === srcCh.name.toLowerCase()
        );
        if (matchedCh) {
          channelMap.set(srcCh.id, matchedCh.id);
        }
      }
    });

    // Optional: Create missing roles on target server
    if (options.createMissingRoles) {
      for (const [srcId, srcRole] of srcRoles) {
        if (srcRole.name === "@everyone" || srcRole.managed || roleMap.has(srcId)) continue;
        try {
          const newRole = await targetGuild.roles.create({
            name: srcRole.name,
            color: srcRole.color,
            hoist: srcRole.hoist,
            mentionable: srcRole.mentionable,
          });
          roleMap.set(srcId, newRole.id);
        } catch (err) {
          console.warn(`[Clone Service] Failed to create role ${srcRole.name}:`, err);
        }
      }
    }

    // Optional: Create missing categories and channels
    if (options.createMissingChannels) {
      for (const [srcId, srcCh] of srcChannels) {
        if (srcCh.type === ChannelType.GuildCategory && !categoryMap.has(srcId)) {
          try {
            const newCat = await targetGuild.channels.create({
              name: srcCh.name,
              type: ChannelType.GuildCategory,
            });
            categoryMap.set(srcId, newCat.id);
          } catch (err) {
            console.warn(`[Clone Service] Failed to create category ${srcCh.name}:`, err);
          }
        }
      }

      for (const [srcId, srcCh] of srcChannels) {
        if (srcCh.type !== ChannelType.GuildCategory && !channelMap.has(srcId)) {
          try {
            const parentId = srcCh.parentId ? categoryMap.get(srcCh.parentId) : undefined;
            const newCh = await targetGuild.channels.create({
              name: srcCh.name,
              type: srcCh.type as any,
              parent: parentId,
            });
            channelMap.set(srcId, newCh.id);
          } catch (err) {
            console.warn(`[Clone Service] Failed to create channel ${srcCh.name}:`, err);
          }
        }
      }
    }
  }

  // =========================================================================
  // 1. TICKET SYSTEM CLONING
  // =========================================================================
  if (options.tickets?.enabled) {
    let panelsCloned = 0;
    let categoriesCloned = 0;
    let settingsCloned = false;

    // Clone Ticket Settings
    if (options.tickets.includeSettings !== false) {
      const srcSettings = await prisma.ticketSetting.findUnique({ where: { guildId: sourceGuildId } });
      if (srcSettings) {
        const mappedRoles = mapRoleIdsArray(srcSettings.defaultSupportRoles);
        const mappedCat = mapCategoryId(srcSettings.defaultCategoryId);
        const mappedLog = mapChannelId(srcSettings.logChannelId);

        await prisma.ticketSetting.upsert({
          where: { guildId: targetGuildId },
          update: {
            namingFormat: srcSettings.namingFormat,
            defaultSupportRoles: mappedRoles,
            defaultCategoryId: mappedCat,
            logChannelId: mappedLog,
            closeConfirmation: srcSettings.closeConfirmation,
            deleteDelaySeconds: srcSettings.deleteDelaySeconds,
            transcriptStorage: srcSettings.transcriptStorage,
            maxTicketsPerUser: srcSettings.maxTicketsPerUser,
            autoArchive: srcSettings.autoArchive,
          },
          create: {
            guildId: targetGuildId,
            namingFormat: srcSettings.namingFormat,
            defaultSupportRoles: mappedRoles,
            defaultCategoryId: mappedCat,
            logChannelId: mappedLog,
            closeConfirmation: srcSettings.closeConfirmation,
            deleteDelaySeconds: srcSettings.deleteDelaySeconds,
            transcriptStorage: srcSettings.transcriptStorage,
            maxTicketsPerUser: srcSettings.maxTicketsPerUser,
            autoArchive: srcSettings.autoArchive,
          },
        });
        settingsCloned = true;
      }
    }

    // Clone Ticket Categories (DB categories)
    const srcCategories = await prisma.ticketCategory.findMany({ where: { guildId: sourceGuildId } });
    for (const cat of srcCategories) {
      if (options.tickets.categoryIds && !options.tickets.categoryIds.includes(cat.id)) continue;
      await prisma.ticketCategory.create({
        data: {
          guildId: targetGuildId,
          name: cat.name,
          description: cat.description,
          emoji: cat.emoji,
        },
      });
      categoriesCloned++;
    }

    // Clone Ticket Panels
    const srcPanels = await prisma.ticketPanel.findMany({ where: { guildId: sourceGuildId } });
    for (const panel of srcPanels) {
      if (options.tickets.panelIds && !options.tickets.panelIds.includes(panel.id)) continue;

      // Remap reasons JSON
      let reasons: any[] = [];
      try {
        reasons = JSON.parse(panel.reasons || "[]");
        reasons = reasons.map((r: any) => ({
          ...r,
          categoryId: r.categoryId ? mapCategoryId(r.categoryId) || null : undefined,
          supportRoles: r.supportRoles ? (JSON.parse(mapRoleIdsArray(r.supportRoles)) as string[]) : [],
        }));
      } catch (e) {}

      await prisma.ticketPanel.create({
        data: {
          guildId: targetGuildId,
          name: panel.name,
          description: panel.description,
          embedTitle: panel.embedTitle,
          embedDescription: panel.embedDescription,
          embedColor: panel.embedColor,
          thumbnail: panel.thumbnail,
          image: panel.image,
          footer: panel.footer,
          welcomeTitle: panel.welcomeTitle,
          welcomeDescription: panel.welcomeDescription,
          welcomeColor: panel.welcomeColor,
          welcomeThumbnail: panel.welcomeThumbnail,
          welcomeImage: panel.welcomeImage,
          welcomeFooter: panel.welcomeFooter,
          reasons: JSON.stringify(reasons),
          questions: panel.questions,
          channelId: mapChannelId(panel.channelId),
          categoryId: mapCategoryId(panel.categoryId),
          buttonText: panel.buttonText,
          buttonEmoji: panel.buttonEmoji,
          buttonColor: panel.buttonColor,
          allowedRoles: mapRoleIdsArray(panel.allowedRoles),
          supportRoles: mapRoleIdsArray(panel.supportRoles),
          maxOpenTickets: panel.maxOpenTickets,
          autoCloseHours: panel.autoCloseHours,
          transcriptEnabled: panel.transcriptEnabled,
          messageId: null, // Ready for fresh deploy on target
        },
      });
      panelsCloned++;
    }

    broadcastEvent("ticketPanelCreate", { guildId: targetGuildId });
    results.tickets = { panelsCloned, categoriesCloned, settingsCloned };
  }

  // =========================================================================
  // 2. APPLICATION SYSTEM CLONING
  // =========================================================================
  if (options.applications?.enabled) {
    let panelsCloned = 0;
    let formsCloned = 0;
    let settingsCloned = false;

    // Clone App Settings
    if (options.applications.includeSettings !== false) {
      const srcAppSettings = await prisma.appSettings.findUnique({ where: { guildId: sourceGuildId } });
      if (srcAppSettings) {
        await prisma.appSettings.upsert({
          where: { guildId: targetGuildId },
          update: {
            defaultReviewerRoles: mapRoleIdsArray(srcAppSettings.defaultReviewerRoles),
            defaultCategoryId: mapCategoryId(srcAppSettings.defaultCategoryId),
            archiveCategoryId: mapCategoryId(srcAppSettings.archiveCategoryId),
            logChannelId: mapChannelId(srcAppSettings.logChannelId),
            transcriptStorage: srcAppSettings.transcriptStorage,
            defaultCooldownHours: srcAppSettings.defaultCooldownHours,
            maxAppsPerUser: srcAppSettings.maxAppsPerUser,
            autoCloseHours: srcAppSettings.autoCloseHours,
            autoArchive: srcAppSettings.autoArchive,
            timezone: srcAppSettings.timezone,
          },
          create: {
            guildId: targetGuildId,
            defaultReviewerRoles: mapRoleIdsArray(srcAppSettings.defaultReviewerRoles),
            defaultCategoryId: mapCategoryId(srcAppSettings.defaultCategoryId),
            archiveCategoryId: mapCategoryId(srcAppSettings.archiveCategoryId),
            logChannelId: mapChannelId(srcAppSettings.logChannelId),
            transcriptStorage: srcAppSettings.transcriptStorage,
            defaultCooldownHours: srcAppSettings.defaultCooldownHours,
            maxAppsPerUser: srcAppSettings.maxAppsPerUser,
            autoCloseHours: srcAppSettings.autoCloseHours,
            autoArchive: srcAppSettings.autoArchive,
            timezone: srcAppSettings.timezone,
          },
        });
        settingsCloned = true;
      }
    }

    // Clone App Panels and maintain map of sourcePanelId -> newPanelId
    const appPanelIdMap = new Map<string, string>();
    const srcAppPanels = await prisma.appPanel.findMany({ where: { guildId: sourceGuildId } });
    for (const panel of srcAppPanels) {
      if (options.applications.panelIds && !options.applications.panelIds.includes(panel.id)) continue;
      const newPanel = await prisma.appPanel.create({
        data: {
          guildId: targetGuildId,
          name: panel.name,
          description: panel.description,
          displayType: panel.displayType,
          embedTitle: panel.embedTitle,
          embedDescription: panel.embedDescription,
          embedColor: panel.embedColor,
          embedAuthorName: panel.embedAuthorName,
          embedAuthorIcon: panel.embedAuthorIcon,
          embedAuthorUrl: panel.embedAuthorUrl,
          thumbnail: panel.thumbnail,
          image: panel.image,
          footer: panel.footer,
          footerIcon: panel.footerIcon,
          showTimestamp: panel.showTimestamp,
          embedFields: panel.embedFields,
          dmTitle: panel.dmTitle,
          dmDescription: panel.dmDescription,
          dmColor: panel.dmColor,
          dmAuthorName: panel.dmAuthorName,
          dmAuthorIcon: panel.dmAuthorIcon,
          dmThumbnail: panel.dmThumbnail,
          dmImage: panel.dmImage,
          dmFooter: panel.dmFooter,
          dmFooterIcon: panel.dmFooterIcon,
          welcomeTitle: panel.welcomeTitle,
          welcomeDescription: panel.welcomeDescription,
          welcomeColor: panel.welcomeColor,
          welcomeAuthorName: panel.welcomeAuthorName,
          welcomeAuthorIcon: panel.welcomeAuthorIcon,
          welcomeThumbnail: panel.welcomeThumbnail,
          welcomeImage: panel.welcomeImage,
          welcomeFooter: panel.welcomeFooter,
          welcomeFooterIcon: panel.welcomeFooterIcon,
          acceptMessage: panel.acceptMessage,
          acceptEmbedTitle: panel.acceptEmbedTitle,
          acceptEmbedDescription: panel.acceptEmbedDescription,
          acceptEmbedColor: panel.acceptEmbedColor,
          denyMessage: panel.denyMessage,
          denyEmbedTitle: panel.denyEmbedTitle,
          denyEmbedDescription: panel.denyEmbedDescription,
          denyEmbedColor: panel.denyEmbedColor,
          waitlistMessage: panel.waitlistMessage,
          waitlistEmbedTitle: panel.waitlistEmbedTitle,
          waitlistEmbedDescription: panel.waitlistEmbedDescription,
          waitlistEmbedColor: panel.waitlistEmbedColor,
          channelId: mapChannelId(panel.channelId),
          messageId: null,
        },
      });
      appPanelIdMap.set(panel.id, newPanel.id);
      panelsCloned++;
    }

    // Clone App Forms & child Questions
    const srcForms = await prisma.appForm.findMany({
      where: { guildId: sourceGuildId },
      include: { questions: { orderBy: { order: "asc" } } },
    });

    for (const form of srcForms) {
      if (options.applications.formIds && !options.applications.formIds.includes(form.id)) continue;

      const newPanelId = form.panelId ? appPanelIdMap.get(form.panelId) || null : null;

      const newForm = await prisma.appForm.create({
        data: {
          guildId: targetGuildId,
          panelId: newPanelId,
          name: form.name,
          description: form.description,
          emoji: form.emoji,
          category: form.category,
          displayType: form.displayType,
          embedTitle: form.embedTitle,
          embedDescription: form.embedDescription,
          embedColor: form.embedColor,
          embedAuthorName: form.embedAuthorName,
          embedAuthorIcon: form.embedAuthorIcon,
          embedAuthorUrl: form.embedAuthorUrl,
          thumbnail: form.thumbnail,
          image: form.image,
          footer: form.footer,
          footerIcon: form.footerIcon,
          showTimestamp: form.showTimestamp,
          embedFields: form.embedFields,
          dmTitle: form.dmTitle,
          dmDescription: form.dmDescription,
          dmColor: form.dmColor,
          dmAuthorName: form.dmAuthorName,
          dmAuthorIcon: form.dmAuthorIcon,
          dmThumbnail: form.dmThumbnail,
          dmImage: form.dmImage,
          dmFooter: form.dmFooter,
          dmFooterIcon: form.dmFooterIcon,
          welcomeTitle: form.welcomeTitle,
          welcomeDescription: form.welcomeDescription,
          welcomeColor: form.welcomeColor,
          welcomeAuthorName: form.welcomeAuthorName,
          welcomeAuthorIcon: form.welcomeAuthorIcon,
          welcomeThumbnail: form.welcomeThumbnail,
          welcomeImage: form.welcomeImage,
          welcomeFooter: form.welcomeFooter,
          welcomeFooterIcon: form.welcomeFooterIcon,
          acceptMessage: form.acceptMessage,
          acceptEmbedTitle: form.acceptEmbedTitle,
          acceptEmbedDescription: form.acceptEmbedDescription,
          acceptEmbedColor: form.acceptEmbedColor,
          denyMessage: form.denyMessage,
          denyEmbedTitle: form.denyEmbedTitle,
          denyEmbedDescription: form.denyEmbedDescription,
          denyEmbedColor: form.denyEmbedColor,
          waitlistMessage: form.waitlistMessage,
          waitlistEmbedTitle: form.waitlistEmbedTitle,
          waitlistEmbedDescription: form.waitlistEmbedDescription,
          waitlistEmbedColor: form.waitlistEmbedColor,
          buttonText: form.buttonText,
          buttonEmoji: form.buttonEmoji,
          buttonColor: form.buttonColor,
          targetChannelId: mapChannelId(form.targetChannelId),
          categoryId: mapCategoryId(form.categoryId),
          reviewerRoles: mapRoleIdsArray(form.reviewerRoles),
          applicantRoles: mapRoleIdsArray(form.applicantRoles),
          acceptedRoles: mapRoleIdsArray(form.acceptedRoles),
          deniedRoles: mapRoleIdsArray(form.deniedRoles),
          cooldownHours: form.cooldownHours,
          maxActiveApps: form.maxActiveApps,
          isOpen: form.isOpen,
          messageId: null,
          channelId: null,
        },
      });

      // Clone nested questions
      for (const q of form.questions) {
        await prisma.appQuestion.create({
          data: {
            formId: newForm.id,
            label: q.label,
            type: q.type,
            placeholder: q.placeholder,
            required: q.required,
            options: q.options,
            minLength: q.minLength,
            maxLength: q.maxLength,
            validationRegex: q.validationRegex,
            validationError: q.validationError,
            helpText: q.helpText,
            order: q.order,
          },
        });
      }
      formsCloned++;
    }

    broadcastEvent("appFormCreate", { guildId: targetGuildId });
    results.applications = { panelsCloned, formsCloned, settingsCloned };
  }

  // =========================================================================
  // 3. CUSTOM MESSAGES / COMPONENTS V2 CLONING
  // =========================================================================
  if (options.customMessages?.enabled) {
    let messagesCloned = 0;
    const srcMessages = await prisma.customMessage.findMany({ where: { guildId: sourceGuildId } });

    for (const msg of srcMessages) {
      if (options.customMessages.messageIds && !options.customMessages.messageIds.includes(msg.id)) continue;
      await prisma.customMessage.create({
        data: {
          guildId: targetGuildId,
          name: msg.name,
          description: msg.description,
          mode: msg.mode,
          channelId: mapChannelId(msg.channelId),
          messageId: null,
          content: msg.content,
          flags: msg.flags,
          accentColor: msg.accentColor,
          spoiler: msg.spoiler,
          containerConfig: msg.containerConfig,
          embedConfig: msg.embedConfig,
          componentsConfig: msg.componentsConfig,
        },
      });
      messagesCloned++;
    }

    broadcastEvent("customMessageCreate", { guildId: targetGuildId });
    results.customMessages = { messagesCloned };
  }

  // =========================================================================
  // 4. WELCOME & GOODBYE CARDS CLONING
  // =========================================================================
  if (options.welcome?.enabled) {
    let welcomeCloned = false;
    let leaveCloned = false;

    if (options.welcome.includeWelcome !== false) {
      const srcWelcome = await prisma.welcomeSetting.findUnique({ where: { guildId: sourceGuildId } });
      if (srcWelcome) {
        await prisma.welcomeSetting.upsert({
          where: { guildId: targetGuildId },
          update: {
            enabled: srcWelcome.enabled,
            channelId: mapChannelId(srcWelcome.channelId),
            messageText: srcWelcome.messageText,
            cardTitle: srcWelcome.cardTitle,
            cardSubtitle: srcWelcome.cardSubtitle,
            avatarRingColor: srcWelcome.avatarRingColor,
            cardBgColor: srcWelcome.cardBgColor,
            cardBorderColor: srcWelcome.cardBorderColor,
            cardBgImage: srcWelcome.cardBgImage,
            sendCard: srcWelcome.sendCard,
            sendDm: srcWelcome.sendDm,
            dmText: srcWelcome.dmText,
            autoRoles: mapRoleIdsArray(srcWelcome.autoRoles),
          },
          create: {
            guildId: targetGuildId,
            enabled: srcWelcome.enabled,
            channelId: mapChannelId(srcWelcome.channelId),
            messageText: srcWelcome.messageText,
            cardTitle: srcWelcome.cardTitle,
            cardSubtitle: srcWelcome.cardSubtitle,
            avatarRingColor: srcWelcome.avatarRingColor,
            cardBgColor: srcWelcome.cardBgColor,
            cardBorderColor: srcWelcome.cardBorderColor,
            cardBgImage: srcWelcome.cardBgImage,
            sendCard: srcWelcome.sendCard,
            sendDm: srcWelcome.sendDm,
            dmText: srcWelcome.dmText,
            autoRoles: mapRoleIdsArray(srcWelcome.autoRoles),
          },
        });
        welcomeCloned = true;
      }
    }

    if (options.welcome.includeLeave !== false) {
      const srcLeave = await prisma.leaveSetting.findUnique({ where: { guildId: sourceGuildId } });
      if (srcLeave) {
        await prisma.leaveSetting.upsert({
          where: { guildId: targetGuildId },
          update: {
            enabled: srcLeave.enabled,
            channelId: mapChannelId(srcLeave.channelId),
            messageText: srcLeave.messageText,
            cardTitle: srcLeave.cardTitle,
            cardSubtitle: srcLeave.cardSubtitle,
            avatarRingColor: srcLeave.avatarRingColor,
            cardBgColor: srcLeave.cardBgColor,
            cardBorderColor: srcLeave.cardBorderColor,
            cardBgImage: srcLeave.cardBgImage,
            sendCard: srcLeave.sendCard,
          },
          create: {
            guildId: targetGuildId,
            enabled: srcLeave.enabled,
            channelId: mapChannelId(srcLeave.channelId),
            messageText: srcLeave.messageText,
            cardTitle: srcLeave.cardTitle,
            cardSubtitle: srcLeave.cardSubtitle,
            avatarRingColor: srcLeave.avatarRingColor,
            cardBgColor: srcLeave.cardBgColor,
            cardBorderColor: srcLeave.cardBorderColor,
            cardBgImage: srcLeave.cardBgImage,
            sendCard: srcLeave.sendCard,
          },
        });
        leaveCloned = true;
      }
    }

    broadcastEvent("welcomeSettingsUpdate", { guildId: targetGuildId });
    results.welcome = { welcomeCloned, leaveCloned };
  }

  // =========================================================================
  // 5. AUTO REACTIONS CLONING
  // =========================================================================
  if (options.autoReact?.enabled) {
    let rulesCloned = 0;
    const srcAutoReacts = await prisma.autoReact.findMany({ where: { guildId: sourceGuildId } });

    for (const rule of srcAutoReacts) {
      if (options.autoReact.ruleIds && !options.autoReact.ruleIds.includes(rule.id)) continue;
      const mappedChannels = mapRoleIdsArray(rule.channelIds);

      await prisma.autoReact.create({
        data: {
          guildId: targetGuildId,
          name: rule.name,
          enabled: rule.enabled,
          channelIds: mappedChannels,
          emojis: rule.emojis,
          ignoreBots: rule.ignoreBots,
        },
      });
      rulesCloned++;
    }

    broadcastEvent("autoReactCreate", { guildId: targetGuildId });
    results.autoReact = { rulesCloned };
  }

  return {
    success: true,
    sourceGuildId,
    targetGuildId,
    results,
  };
}
