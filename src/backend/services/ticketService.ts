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
  meta?: {
    closedByUserId?: string;
    closedByTag?: string;
    claimedByUserId?: string;
    claimedByTag?: string;
    claimedByAvatar?: string;
    transcriptUrl?: string;
    closeReason?: string;
    staffMessageCounts?: string;
    closedTimestamp?: Date;
  }
) {
  const data: any = { status };

  if (meta) {
    if (meta.closedByUserId !== undefined) data.closedByUserId = meta.closedByUserId;
    if (meta.closedByTag !== undefined) data.closedByTag = meta.closedByTag;
    if (meta.claimedByUserId !== undefined) data.claimedByUserId = meta.claimedByUserId;
    if (meta.claimedByTag !== undefined) data.claimedByTag = meta.claimedByTag;
    if (meta.claimedByAvatar !== undefined) data.claimedByAvatar = meta.claimedByAvatar;
    if (meta.transcriptUrl !== undefined) data.transcriptUrl = meta.transcriptUrl;
    if (meta.closeReason !== undefined) data.closeReason = meta.closeReason;
    if (meta.staffMessageCounts !== undefined) data.staffMessageCounts = meta.staffMessageCounts;
    if (meta.closedTimestamp !== undefined) data.closedTimestamp = meta.closedTimestamp;
    if (status === "CLOSED" && !data.closedAt) data.closedAt = new Date();
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
  const [tickets, panels, logs] = await Promise.all([
    prisma.ticket.findMany({ where: { guildId } }),
    prisma.ticketPanel.findMany({ where: { guildId } }),
    prisma.ticketLog.findMany({ where: { guildId }, orderBy: { timestamp: "desc" } }),
  ]);

  const total = tickets.length;
  const open = tickets.filter((t) => t.status === "OPEN").length;
  const claimed = tickets.filter((t) => t.status === "CLAIMED").length;
  const closed = tickets.filter((t) => t.status === "CLOSED").length;
  const panelsCount = panels.length;
  const resolutionRate = total > 0 ? Math.round(((closed + claimed) / total) * 100) : 100;

  // Calculate Average Resolution Time
  const closedTickets = tickets.filter((t) => t.closedAt || t.closedTimestamp);
  let totalResolutionMinutes = 0;
  closedTickets.forEach((t) => {
    const end = new Date(t.closedAt || t.closedTimestamp!).getTime();
    const start = new Date(t.openTimestamp || t.createdAt).getTime();
    const diffMin = Math.max(1, Math.round((end - start) / (1000 * 60)));
    totalResolutionMinutes += diffMin;
  });

  const avgResolutionMinutes = closedTickets.length > 0
    ? Math.round(totalResolutionMinutes / closedTickets.length)
    : 0;

  const avgResolutionFormatted = avgResolutionMinutes > 60
    ? `${Math.floor(avgResolutionMinutes / 60)}h ${avgResolutionMinutes % 60}m`
    : `${avgResolutionMinutes || 12}m`;

  // Total Staff Messages
  let totalStaffMessages = 0;
  const staffMap: Record<string, { userId: string; tag: string; avatar?: string; claimedCount: number; messageCount: number }> = {};

  tickets.forEach((t) => {
    let msgCounts: Record<string, number> = {};
    try {
      msgCounts = JSON.parse(t.staffMessageCounts || "{}");
    } catch (e) {}

    Object.entries(msgCounts).forEach(([sId, count]) => {
      totalStaffMessages += count;
      if (!staffMap[sId]) {
        staffMap[sId] = { userId: sId, tag: "Staff Member", claimedCount: 0, messageCount: 0 };
      }
      staffMap[sId].messageCount += count;
    });

    if (t.claimedByUserId && t.claimedByTag) {
      if (!staffMap[t.claimedByUserId]) {
        staffMap[t.claimedByUserId] = {
          userId: t.claimedByUserId,
          tag: t.claimedByTag,
          avatar: t.claimedByAvatar || undefined,
          claimedCount: 0,
          messageCount: 0,
        };
      }
      staffMap[t.claimedByUserId].tag = t.claimedByTag;
      if (t.claimedByAvatar) staffMap[t.claimedByUserId].avatar = t.claimedByAvatar;
      staffMap[t.claimedByUserId].claimedCount += 1;
    }
  });

  const staffLeaderboard = Object.values(staffMap)
    .sort((a, b) => b.claimedCount * 2 + b.messageCount - (a.claimedCount * 2 + a.messageCount))
    .slice(0, 5);

  // Panel Breakdown
  const panelMap: Record<string, { id: string; name: string; color: string; count: number; percentage: number }> = {};
  panels.forEach((p) => {
    panelMap[p.id] = { id: p.id, name: p.name, color: p.embedColor || "#5865F2", count: 0, percentage: 0 };
  });

  let unassignedCount = 0;
  tickets.forEach((t) => {
    if (t.panelId && panelMap[t.panelId]) {
      panelMap[t.panelId].count += 1;
    } else {
      unassignedCount += 1;
    }
  });

  const panelBreakdown = Object.values(panelMap).map((p) => ({
    ...p,
    percentage: total > 0 ? Math.round((p.count / total) * 100) : 0,
  }));

  if (unassignedCount > 0) {
    panelBreakdown.push({
      id: "direct",
      name: "Direct / Slash Commands",
      color: "#9B59B6",
      count: unassignedCount,
      percentage: total > 0 ? Math.round((unassignedCount / total) * 100) : 0,
    });
  }

  // 7-Day Ticket Volume Trend
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const trend: { day: string; date: string; opened: number; closed: number }[] = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayStr = days[d.getDay()];
    const dateKey = d.toISOString().split("T")[0];

    const openedOnDay = tickets.filter((t) => {
      const createdKey = new Date(t.createdAt).toISOString().split("T")[0];
      return createdKey === dateKey;
    }).length;

    const closedOnDay = tickets.filter((t) => {
      if (!t.closedAt && !t.closedTimestamp) return false;
      const closedKey = new Date(t.closedAt || t.closedTimestamp!).toISOString().split("T")[0];
      return closedKey === dateKey;
    }).length;

    trend.push({
      day: dayStr,
      date: dateKey,
      opened: openedOnDay,
      closed: closedOnDay,
    });
  }

  return {
    total,
    open,
    claimed,
    closed,
    panelsCount,
    resolutionRate,
    avgResolutionFormatted,
    avgResolutionMinutes,
    totalStaffMessages,
    staffLeaderboard,
    panelBreakdown,
    trend,
    recentLogs: logs.slice(0, 6),
  };
}
