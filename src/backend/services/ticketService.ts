import { PrismaClient } from "@prisma/client";
import { broadcastEvent } from "../socket/socketManager";

const prisma = new PrismaClient();

// ==========================================
// TICKET SETTINGS
// ==========================================
export async function getTicketSettings(guildId: string) {
  let settings = await prisma.ticketSetting.findUnique({
    where: { guildId },
  });

  if (!settings) {
    settings = await prisma.ticketSetting.create({
      data: {
        guildId,
        namingFormat: "ticket-{username}",
        defaultSupportRoles: "[]",
        closeConfirmation: true,
        deleteDelaySeconds: 5,
        transcriptStorage: "local",
        maxTicketsPerUser: 3,
        autoArchive: false,
      },
    });
  }

  return settings;
}

export async function updateTicketSettings(guildId: string, data: any) {
  const settings = await prisma.ticketSetting.upsert({
    where: { guildId },
    update: {
      namingFormat: data.namingFormat,
      defaultSupportRoles: JSON.stringify(data.defaultSupportRoles || []),
      defaultCategoryId: data.defaultCategoryId || null,
      logChannelId: data.logChannelId || null,
      closeConfirmation: data.closeConfirmation !== undefined ? data.closeConfirmation : true,
      deleteDelaySeconds: data.deleteDelaySeconds !== undefined ? Number(data.deleteDelaySeconds) : 5,
      transcriptStorage: data.transcriptStorage || "local",
      maxTicketsPerUser: data.maxTicketsPerUser !== undefined ? Number(data.maxTicketsPerUser) : 3,
      autoArchive: data.autoArchive !== undefined ? Boolean(data.autoArchive) : false,
    },
    create: {
      guildId,
      namingFormat: data.namingFormat || "ticket-{username}",
      defaultSupportRoles: JSON.stringify(data.defaultSupportRoles || []),
      defaultCategoryId: data.defaultCategoryId || null,
      logChannelId: data.logChannelId || null,
      closeConfirmation: data.closeConfirmation !== undefined ? data.closeConfirmation : true,
      deleteDelaySeconds: data.deleteDelaySeconds !== undefined ? Number(data.deleteDelaySeconds) : 5,
      transcriptStorage: data.transcriptStorage || "local",
      maxTicketsPerUser: data.maxTicketsPerUser !== undefined ? Number(data.maxTicketsPerUser) : 3,
      autoArchive: data.autoArchive !== undefined ? Boolean(data.autoArchive) : false,
    },
  });

  broadcastEvent("ticketSettingsUpdate", { guildId, settings });
  return settings;
}

// ==========================================
// TICKET PANELS
// ==========================================
export async function getTicketPanels(guildId: string) {
  return prisma.ticketPanel.findMany({
    where: { guildId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTicketPanelById(panelId: string) {
  return prisma.ticketPanel.findUnique({
    where: { id: panelId },
  });
}

export async function createTicketPanel(guildId: string, data: any) {
  const panel = await prisma.ticketPanel.create({
    data: {
      guildId,
      name: data.name,
      description: data.description || null,
      embedTitle: data.embedTitle || data.name,
      embedDescription: data.embedDescription || "Click the button below to open a support ticket.",
      embedColor: data.embedColor || "#5865F2",
      thumbnail: data.thumbnail || null,
      image: data.image || null,
      footer: data.footer || "TheGodGen Ticket Engine",
      welcomeTitle: data.welcomeTitle || "👋 Welcome to your ticket!",
      welcomeDescription: data.welcomeDescription || "Support staff will be with you shortly. Use the controls below to manage this ticket.",
      welcomeColor: data.welcomeColor || "#5865F2",
      welcomeThumbnail: data.welcomeThumbnail || null,
      welcomeImage: data.welcomeImage || null,
      welcomeFooter: data.welcomeFooter || "TheGodGen Ticket Engine",
      reasons: JSON.stringify(data.reasons || []),
      questions: JSON.stringify(data.questions || []),
      channelId: data.channelId || null,
      categoryId: data.categoryId || null,
      buttonText: data.buttonText || "Create Ticket",
      buttonEmoji: data.buttonEmoji || "📩",
      buttonColor: data.buttonColor || "Primary",
      allowedRoles: JSON.stringify(data.allowedRoles || []),
      supportRoles: JSON.stringify(data.supportRoles || []),
      maxOpenTickets: Number(data.maxOpenTickets || 1),
      autoCloseHours: Number(data.autoCloseHours || 0),
      transcriptEnabled: data.transcriptEnabled !== undefined ? Boolean(data.transcriptEnabled) : true,
    },
  });

  broadcastEvent("ticketPanelCreate", { guildId, panelId: panel.id });
  return panel;
}

export async function updateTicketPanel(panelId: string, data: any) {
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description || null;
  if (data.embedTitle !== undefined) updateData.embedTitle = data.embedTitle;
  if (data.embedDescription !== undefined) updateData.embedDescription = data.embedDescription;
  if (data.embedColor !== undefined) updateData.embedColor = data.embedColor;
  if (data.thumbnail !== undefined) updateData.thumbnail = data.thumbnail || null;
  if (data.image !== undefined) updateData.image = data.image || null;
  if (data.footer !== undefined) updateData.footer = data.footer || null;
  if (data.welcomeTitle !== undefined) updateData.welcomeTitle = data.welcomeTitle;
  if (data.welcomeDescription !== undefined) updateData.welcomeDescription = data.welcomeDescription;
  if (data.welcomeColor !== undefined) updateData.welcomeColor = data.welcomeColor;
  if (data.welcomeThumbnail !== undefined) updateData.welcomeThumbnail = data.welcomeThumbnail || null;
  if (data.welcomeImage !== undefined) updateData.welcomeImage = data.welcomeImage || null;
  if (data.welcomeFooter !== undefined) updateData.welcomeFooter = data.welcomeFooter || null;
  if (data.reasons !== undefined) updateData.reasons = typeof data.reasons === "string" ? data.reasons : JSON.stringify(data.reasons || []);
  if (data.questions !== undefined) updateData.questions = typeof data.questions === "string" ? data.questions : JSON.stringify(data.questions || []);
  if (data.channelId !== undefined) updateData.channelId = data.channelId || null;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId || null;
  if (data.buttonText !== undefined) updateData.buttonText = data.buttonText;
  if (data.buttonEmoji !== undefined) updateData.buttonEmoji = data.buttonEmoji || null;
  if (data.buttonColor !== undefined) updateData.buttonColor = data.buttonColor;
  if (data.allowedRoles !== undefined) updateData.allowedRoles = typeof data.allowedRoles === "string" ? data.allowedRoles : JSON.stringify(data.allowedRoles || []);
  if (data.supportRoles !== undefined) updateData.supportRoles = typeof data.supportRoles === "string" ? data.supportRoles : JSON.stringify(data.supportRoles || []);
  if (data.maxOpenTickets !== undefined) updateData.maxOpenTickets = Number(data.maxOpenTickets || 1);
  if (data.autoCloseHours !== undefined) updateData.autoCloseHours = Number(data.autoCloseHours || 0);
  if (data.transcriptEnabled !== undefined) updateData.transcriptEnabled = Boolean(data.transcriptEnabled);
  if (data.messageId !== undefined) updateData.messageId = data.messageId;

  const panel = await prisma.ticketPanel.update({
    where: { id: panelId },
    data: updateData,
  });

  broadcastEvent("ticketPanelUpdate", { guildId: panel.guildId, panelId: panel.id });
  return panel;
}

export async function deleteTicketPanel(panelId: string) {
  const panel = await prisma.ticketPanel.delete({
    where: { id: panelId },
  });
  broadcastEvent("ticketPanelDelete", { guildId: panel.guildId, panelId: panel.id });
  return panel;
}

// ==========================================
// TICKET CATEGORIES
// ==========================================
export async function getTicketCategories(guildId: string) {
  return prisma.ticketCategory.findMany({
    where: { guildId },
    orderBy: { name: "asc" },
  });
}

export async function createTicketCategory(guildId: string, name: string, description?: string, emoji?: string) {
  const category = await prisma.ticketCategory.create({
    data: {
      guildId,
      name,
      description: description || null,
      emoji: emoji || null,
    },
  });
  broadcastEvent("ticketCategoryCreate", { guildId, categoryId: category.id });
  return category;
}

export async function deleteTicketCategory(categoryId: string) {
  const cat = await prisma.ticketCategory.delete({
    where: { id: categoryId },
  });
  broadcastEvent("ticketCategoryDelete", { guildId: cat.guildId, categoryId: cat.id });
  return cat;
}

// ==========================================
// TICKETS
// ==========================================
export async function getNextTicketNumber(guildId: string): Promise<number> {
  const lastTicket = await prisma.ticket.findFirst({
    where: { guildId },
    orderBy: { ticketNumber: "desc" },
  });
  return lastTicket ? lastTicket.ticketNumber + 1 : 1;
}

export async function createTicketRecord(data: {
  guildId: string;
  panelId?: string;
  channelId: string;
  userId: string;
  userTag: string;
  userAvatar?: string;
  categoryId?: string;
}) {
  const number = await getNextTicketNumber(data.guildId);

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: number,
      guildId: data.guildId,
      panelId: data.panelId || null,
      channelId: data.channelId,
      userId: data.userId,
      userTag: data.userTag,
      userAvatar: data.userAvatar || null,
      categoryId: data.categoryId || null,
      status: "OPEN",
    },
  });

  await createTicketLog({
    guildId: data.guildId,
    ticketId: ticket.id,
    ticketNumber: number,
    action: "OPENED",
    executorId: data.userId,
    executorTag: data.userTag,
    details: `Ticket #${number} opened by ${data.userTag}`,
  });

  broadcastEvent("ticketCreate", { guildId: data.guildId, ticketId: ticket.id, ticketNumber: number });
  return ticket;
}

export async function getTickets(guildId: string, filters?: { status?: string; search?: string }) {
  const where: any = { guildId };

  if (filters?.status && filters.status !== "ALL") {
    where.status = filters.status;
  }

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    where.OR = [
      { userTag: { contains: q } },
      { claimedByTag: { contains: q } },
      { channelId: { contains: q } },
    ];
  }

  return prisma.ticket.findMany({
    where,
    include: {
      panel: true,
      logs: {
        orderBy: { timestamp: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTicketById(ticketId: string) {
  return prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      panel: true,
      logs: {
        orderBy: { timestamp: "desc" },
      },
    },
  });
}

export async function getTicketByChannelId(channelId: string) {
  return prisma.ticket.findUnique({
    where: { channelId },
    include: {
      panel: true,
    },
  });
}

export async function updateTicketStatus(
  ticketId: string,
  status: "OPEN" | "CLOSED" | "CLAIMED",
  meta?: { closedByUserId?: string; closedByTag?: string; claimedByUserId?: string; claimedByTag?: string; claimedByAvatar?: string; transcriptUrl?: string }
) {
  const data: any = { status };

  if (status === "CLOSED" && meta) {
    data.closedByUserId = meta.closedByUserId;
    data.closedByTag = meta.closedByTag;
    data.closedAt = new Date();
  }

  if (status === "CLAIMED" && meta) {
    data.claimedByUserId = meta.claimedByUserId;
    data.claimedByTag = meta.claimedByTag;
    data.claimedByAvatar = meta.claimedByAvatar;
  }

  if (meta?.transcriptUrl) {
    data.transcriptUrl = meta.transcriptUrl;
  }

  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data,
  });

  broadcastEvent("ticketUpdate", { guildId: ticket.guildId, ticketId: ticket.id, status });
  return ticket;
}

export async function deleteTicketRecord(ticketId: string) {
  const ticket = await prisma.ticket.delete({
    where: { id: ticketId },
  });
  broadcastEvent("ticketDelete", { guildId: ticket.guildId, ticketId });
  return ticket;
}

// ==========================================
// TICKET LOGS
// ==========================================
export async function createTicketLog(data: {
  guildId: string;
  ticketId?: string;
  ticketNumber: number;
  action: string;
  executorId: string;
  executorTag: string;
  details?: string;
}) {
  const log = await prisma.ticketLog.create({
    data: {
      guildId: data.guildId,
      ticketId: data.ticketId || null,
      ticketNumber: data.ticketNumber,
      action: data.action,
      executorId: data.executorId,
      executorTag: data.executorTag,
      details: data.details || null,
    },
  });

  broadcastEvent("ticketLogCreate", { guildId: data.guildId, logId: log.id });
  return log;
}

export async function getTicketLogs(guildId: string) {
  return prisma.ticketLog.findMany({
    where: { guildId },
    orderBy: { timestamp: "desc" },
    take: 100,
  });
}

// ==========================================
// TICKET STATS
// ==========================================
export async function getTicketStats(guildId: string) {
  const [total, open, claimed, closed, panelsCount] = await Promise.all([
    prisma.ticket.count({ where: { guildId } }),
    prisma.ticket.count({ where: { guildId, status: "OPEN" } }),
    prisma.ticket.count({ where: { guildId, status: "CLAIMED" } }),
    prisma.ticket.count({ where: { guildId, status: "CLOSED" } }),
    prisma.ticketPanel.count({ where: { guildId } }),
  ]);

  return {
    total,
    open,
    claimed,
    closed,
    panelsCount,
  };
}
