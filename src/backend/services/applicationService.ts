import { Prisma } from "@prisma/client";
import { discordClient } from "../bot/client";
import { applicationDb as prisma, readStrings, reviewerRoles } from "./applicationAccess";


// ==========================================
// PANELS, FORMS & QUESTIONS
// ==========================================

export async function getAppPanels(guildId: string) {
  return await prisma.appPanel.findMany({
    where: { guildId },
    include: {
      forms: {
        include: {
          questions: { orderBy: { order: "asc" } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAppPanelById(panelId: string) {
  return await prisma.appPanel.findUnique({
    where: { id: panelId },
    include: {
      forms: {
        include: {
          questions: { orderBy: { order: "asc" } },
        },
      },
    },
  });
}

export async function createAppPanel(guildId: string, data: any) {
  return await prisma.appPanel.create({
    data: {
      guildId,
      name: data.name || "Application Center Panel",
      description: data.description || "",
      displayType: data.displayType || "dropdown",
      embedTitle: data.embedTitle || "📝 Application Center",
      embedDescription: data.embedDescription || "Select an application position from the dropdown menu below to submit your application.",
      embedColor: data.embedColor || "#5865F2",
      thumbnail: data.thumbnail || null,
      image: data.image || null,
      footer: data.footer || "GuildPilot Applications System",
      welcomeTitle: data.welcomeTitle || "👋 Application Submitted!",
      welcomeDescription: data.welcomeDescription || "Your application has been received.",
      welcomeColor: data.welcomeColor || "#5865F2",
      acceptEmbedColor: data.acceptEmbedColor || "#23A55A",
      denyEmbedColor: data.denyEmbedColor || "#F23F43",
      welcomeThumbnail: data.welcomeThumbnail || null,
      welcomeImage: data.welcomeImage || null,
      welcomeFooter: data.welcomeFooter || "GuildPilot Applications System",
      channelId: data.channelId || null,
    },
    include: { forms: true },
  });
}

export async function updateAppPanel(panelId: string, data: any) {
  const payload = { ...data };
  delete payload.id;
  delete payload.guildId;
  delete payload.forms;

  return await prisma.appPanel.update({
    where: { id: panelId },
    data: payload,
    include: { forms: true },
  });
}

export async function deleteAppPanel(panelId: string) {
  return await prisma.appPanel.delete({
    where: { id: panelId },
  });
}

export async function getAppForms(guildId: string) {
  return await prisma.appForm.findMany({
    where: { guildId },
    include: {
      panel: true,
      questions: {
        orderBy: { order: "asc" },
      },
      _count: {
        select: { applications: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAppFormById(formId: string) {
  return await prisma.appForm.findUnique({
    where: { id: formId },
    include: {
      panel: true,
      questions: {
        orderBy: { order: "asc" },
      },
    },
  });
}

export async function createAppForm(guildId: string, data: any) {
  return await prisma.appForm.create({
    data: {
      guildId,
      panelId: data.panelId || null,
      name: data.name || "Untitled Application Form",
      description: data.description || "",
      emoji: data.emoji || "📝",
      category: data.category || "General",
      displayType: data.displayType || "dropdown",
      embedTitle: data.embedTitle || "📝 Application Form",
      embedDescription: data.embedDescription || "Click the button below to submit your application.",
      embedColor: data.embedColor || "#5865F2",
      thumbnail: data.thumbnail || null,
      image: data.image || null,
      footer: data.footer || "GuildPilot Applications System",
      buttonText: data.buttonText || "Apply Now",
      buttonEmoji: data.buttonEmoji || "📝",
      buttonColor: data.buttonColor || "Primary",
      targetChannelId: data.targetChannelId || null,
      dmPanelTitle: data.dmPanelTitle || null,
      dmPanelDescription: data.dmPanelDescription || null,
      dmPanelChannelId: data.dmPanelChannelId || null,
      reviewChannelId: data.reviewChannelId || null,
      ticketCategoryId: data.ticketCategoryId || null,
      statusSteps: JSON.stringify(data.statusSteps || []),
      channelId: data.channelId || null,
      categoryId: data.categoryId || null,
      reviewerRoles: JSON.stringify(data.reviewerRoles || []),
      applicantRoles: JSON.stringify(data.applicantRoles || []),
      acceptedRoles: JSON.stringify(data.acceptedRoles || []),
      deniedRoles: JSON.stringify(data.deniedRoles || []),
      cooldownHours: Number(data.cooldownHours ?? 24),
      maxActiveApps: Number(data.maxActiveApps) || 1,
      isOpen: data.isOpen !== undefined ? Boolean(data.isOpen) : true,
    },
    include: {
      questions: true,
    },
  });
}

export async function updateAppForm(formId: string, data: any) {
  const payload: any = { ...data };
  if (Array.isArray(data.statusSteps)) payload.statusSteps = JSON.stringify(data.statusSteps);
  if (Array.isArray(data.reviewerRoles)) payload.reviewerRoles = JSON.stringify(data.reviewerRoles);
  if (Array.isArray(data.applicantRoles)) payload.applicantRoles = JSON.stringify(data.applicantRoles);
  if (Array.isArray(data.acceptedRoles)) payload.acceptedRoles = JSON.stringify(data.acceptedRoles);
  if (Array.isArray(data.deniedRoles)) payload.deniedRoles = JSON.stringify(data.deniedRoles);
  if (data.cooldownHours !== undefined) payload.cooldownHours = Number(data.cooldownHours);
  if (data.maxActiveApps !== undefined) payload.maxActiveApps = Number(data.maxActiveApps);
  if (data.isOpen !== undefined) payload.isOpen = Boolean(data.isOpen);

  delete payload.id;
  delete payload.guildId;
  delete payload.questions;
  delete payload._count;

  return await prisma.appForm.update({
    where: { id: formId },
    data: payload,
    include: {
      questions: {
        orderBy: { order: "asc" },
      },
    },
  });
}

export async function deleteAppForm(formId: string) {
  const form = await prisma.appForm.findUniqueOrThrow({ where: { id: formId } });
  const roles = await reviewerRoles(form.guildId, form.reviewerRoles);
  return prisma.$transaction(async db => {
    await db.application.updateMany({ where: { formId, formName: null }, data: { formName: form.name } });
    await db.application.updateMany({ where: { formId }, data: { reviewerRoles: JSON.stringify(roles) } });
    return db.appForm.delete({ where: { id: formId } });
  });
}

export async function getAppQuestions(formId: string) {
  return await prisma.appQuestion.findMany({
    where: { formId },
    orderBy: { order: "asc" },
  });
}

export async function createAppQuestion(formId: string, data: any) {
  const existingCount = await prisma.appQuestion.count({ where: { formId } });
  return await prisma.appQuestion.create({
    data: {
      formId,
      label: data.label || "New Question",
      type: data.type || "SHORT_TEXT",
      placeholder: data.placeholder || "",
      required: data.required !== undefined ? Boolean(data.required) : true,
      options: JSON.stringify(data.options || []),
      minLength: data.minLength ? Number(data.minLength) : null,
      maxLength: data.maxLength ? Number(data.maxLength) : null,
      validationRegex: data.validationRegex || null,
      validationError: data.validationError || null,
      helpText: data.helpText || null,
      order: data.order !== undefined ? Number(data.order) : existingCount,
    },
  });
}

export async function updateAppQuestion(questionId: string, data: any) {
  const payload: any = { ...data };
  if (Array.isArray(data.options)) payload.options = JSON.stringify(data.options);
  if (data.required !== undefined) payload.required = Boolean(data.required);
  if (data.minLength !== undefined) payload.minLength = data.minLength ? Number(data.minLength) : null;
  if (data.maxLength !== undefined) payload.maxLength = data.maxLength ? Number(data.maxLength) : null;
  if (data.order !== undefined) payload.order = Number(data.order);

  delete payload.id;
  delete payload.formId;

  return await prisma.appQuestion.update({
    where: { id: questionId },
    data: payload,
  });
}

export async function deleteAppQuestion(questionId: string) {
  return await prisma.appQuestion.delete({
    where: { id: questionId },
  });
}

export async function reorderAppQuestions(formId: string, questionIds: string[]) {
  const updates = questionIds.map((id, index) =>
    prisma.appQuestion.update({
      where: { id, formId },
      data: { order: index },
    })
  );
  await prisma.$transaction(updates);
  return await getAppQuestions(formId);
}

export async function duplicateAppQuestion(questionId: string) {
  const original = await prisma.appQuestion.findUnique({ where: { id: questionId } });
  if (!original) throw new Error("Question not found");

  const existingCount = await prisma.appQuestion.count({ where: { formId: original.formId } });

  return await prisma.appQuestion.create({
    data: {
      formId: original.formId,
      label: `${original.label} (Copy)`,
      type: original.type,
      placeholder: original.placeholder,
      required: original.required,
      options: original.options,
      minLength: original.minLength,
      maxLength: original.maxLength,
      validationRegex: original.validationRegex,
      validationError: original.validationError,
      helpText: original.helpText,
      order: existingCount,
    },
  });
}

// ==========================================
// APPLICATIONS WORKFLOW
// ==========================================

const applicationDetails = {
  form: { include: { panel: true } },
  answers: { orderBy: { position: "asc" } },
  notes: { orderBy: { createdAt: "desc" } },
  history: { orderBy: { timestamp: "desc" } },
  files: { select: { id: true, name: true, size: true, position: true, followupId: true } },
  followups: { orderBy: { requestedAt: "asc" } },
} satisfies Prisma.ApplicationInclude;

export async function getApplications(
  guildId: string,
  filters?: { status?: string; search?: string; formId?: string; reviewerId?: string; access?: Prisma.ApplicationWhereInput }
) {
  const where: Prisma.ApplicationWhereInput = { guildId, AND: filters?.access };

  if (filters?.status && filters.status !== "ALL") {
    where.status = filters.status;
  }

  if (filters?.formId && filters.formId !== "ALL") {
    where.formId = filters.formId;
  }

  if (filters?.reviewerId && filters.reviewerId !== "ALL") {
    where.claimedByUserId = filters.reviewerId;
  }

  if (filters?.search && filters.search.trim() !== "") {
    const q = filters.search.trim();
    where.OR = [
      { userTag: { contains: q } },
      { userId: { contains: q } },
      { claimedByTag: { contains: q } },
      { decisionReason: { contains: q } },
    ];
  }

  return await prisma.application.findMany({
    where,
    include: applicationDetails,
    orderBy: { createdAt: "desc" },
  });
}

export async function getApplicationById(appId: string) {
  return prisma.application.findUnique({ where: { id: appId }, include: applicationDetails });
}

export async function checkUserCanApply(guildId: string, formId: string, userId: string, db: Prisma.TransactionClient = prisma) {
  const form = await db.appForm.findUnique({ where: { id: formId, guildId } });
  if (!form?.isOpen) return { canApply: false, reason: "This application form is currently closed." };

  const where = { guildId, formId, userId };
  const active = await db.application.count({
    where: { ...where, status: { in: ["PENDING", "UNDER_REVIEW", "CLAIMED", "WAITLISTED"] } },
  });
  if (active >= form.maxActiveApps) {
    return { canApply: false, reason: "You have reached the limit for active applications on this form." };
  }

  const last = await db.application.findFirst({ where, orderBy: { createdAt: "desc" } });
  const remaining = last ? form.cooldownHours - (Date.now() - last.createdAt.getTime()) / 3_600_000 : 0;
  if (remaining > 0) return { canApply: false, reason: `Please wait ${Math.ceil(remaining)} hour(s) before applying again.` };
  return { canApply: true };
}

export async function createApplicationSubmission(
  db: Prisma.TransactionClient,
  data: Omit<Prisma.ApplicationUncheckedCreateInput, "appNumber">,
) {
  const last = await db.application.findFirst({
    where: { guildId: data.guildId }, orderBy: { appNumber: "desc" }, select: { appNumber: true },
  });
  const appNumber = (last?.appNumber ?? 0) + 1;
  return db.application.create({ data: { ...data, appNumber }, include: applicationDetails });
}

export type ApplicationExecutor = { id: string; tag: string; avatar?: string };

export const decisionStatuses = ["ACCEPTED", "DENIED"];

export async function updateApplicationStatus(
  appId: string,
  newStatus: string,
  executor: ApplicationExecutor,
  reason?: string,
) {
  return prisma.$transaction(async db => {
    const app = await db.application.findUniqueOrThrow({ where: { id: appId } });
    const decision = decisionStatuses.includes(newStatus);
    if (app.status === "CLOSED" && newStatus !== "PENDING" ||
        (app.decidedAt || decisionStatuses.includes(app.status)) && newStatus !== "CLOSED") {
      throw new Error("This application already has a final decision or is closed.");
    }
    const status = newStatus === "UNCLAIMED" ? "PENDING" : newStatus;
    const claim = newStatus === "CLAIMED";
    const unclaim = newStatus === "UNCLAIMED";
    const now = new Date();
    const updated = await db.application.update({
      where: { id: appId, status: app.status },
      data: {
        status,
        decisionReason: decision ? reason || null : undefined,
        decisionById: decision ? executor.id : undefined,
        decisionByTag: decision ? executor.tag : undefined,
        decidedAt: decision ? now : undefined,
        reviewedAt: claim || decision || status === "WAITLISTED" ? app.reviewedAt ?? now : undefined,
        closedAt: status === "CLOSED" ? now : status === "PENDING" ? null : undefined,
        claimedByUserId: claim ? executor.id : unclaim ? null : undefined,
        claimedByTag: claim ? executor.tag : unclaim ? null : undefined,
        claimedByAvatar: claim ? executor.avatar : unclaim ? null : undefined,
        history: { create: {
          status: newStatus, fromStatus: app.status, toStatus: status,
          actorId: executor.id, actorTag: executor.tag, details: reason || `Status changed to ${status}`,
        } },
      },
      include: applicationDetails,
    });
    await db.appLog.create({ data: {
      guildId: app.guildId, applicationId: appId, action: newStatus,
      executorId: executor.id, executorTag: executor.tag, details: reason || `Status changed to ${status}`,
    } });
    return updated;
  });
}

export async function handleRoleAssignments(app: NonNullable<Awaited<ReturnType<typeof getApplicationById>>>) {
  const byStatus = app.status === "ACCEPTED" ? app.form?.acceptedRoles : app.form?.deniedRoles;
  const roles = readStrings(byStatus).filter(id => id !== app.guildId);
  if (!roles.length) return;
  const guild = discordClient.guilds.cache.get(app.guildId);
  if (!guild) throw new Error("Server unavailable");
  const member = await guild.members.fetch({ user: app.userId, force: true });
  for (const id of roles) {
    if (!member.roles.cache.has(id)) await member.roles.add(id, "Application decision");
  }
}

export async function addApplicationNote(
  appId: string,
  author: { id: string; tag: string; avatar?: string },
  content: string
) {
  const note = await prisma.appNote.create({
    data: {
      applicationId: appId,
      authorId: author.id,
      authorTag: author.tag,
      authorAvatar: author.avatar || null,
      content,
    },
  });

  const app = await prisma.application.findUnique({ where: { id: appId } });
  if (app) {
    await createAppLog({
      guildId: app.guildId,
      applicationId: appId,
      action: "NOTE_ADDED",
      executorId: author.id,
      executorTag: author.tag,
      details: content.substring(0, 100),
    });
  }

  return note;
}

// ==========================================
// STATS & SETTINGS
// ==========================================

export async function getApplicationStats(guildId: string) {
  const [totalForms, totalApps, pending, underReview, claimed, accepted, denied, waitlisted, closed] =
    await Promise.all([
      prisma.appForm.count({ where: { guildId } }),
      prisma.application.count({ where: { guildId } }),
      prisma.application.count({ where: { guildId, status: "PENDING" } }),
      prisma.application.count({ where: { guildId, status: "UNDER_REVIEW" } }),
      prisma.application.count({ where: { guildId, status: "CLAIMED" } }),
      prisma.application.count({ where: { guildId, status: "ACCEPTED" } }),
      prisma.application.count({ where: { guildId, status: "DENIED" } }),
      prisma.application.count({ where: { guildId, status: "WAITLISTED" } }),
      prisma.application.count({ where: { guildId, status: "CLOSED" } }),
    ]);

  const activeApps = pending + underReview + claimed + waitlisted;
  const pendingReviews = pending + underReview;

  // Applications today
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const appsToday = await prisma.application.count({
    where: {
      guildId,
      createdAt: { gte: startOfDay },
    },
  });

  // Calculate Average Review Time (in minutes)
  const completedApps = await prisma.application.findMany({
    where: {
      guildId,
      reviewedAt: { not: null },
    },
    select: { submittedAt: true, reviewedAt: true },
  });

  let totalDurationMs = 0;
  completedApps.forEach((a) => {
    if (a.reviewedAt) {
      totalDurationMs += new Date(a.reviewedAt).getTime() - new Date(a.submittedAt).getTime();
    }
  });

  const avgReviewTimeMinutes = completedApps.length > 0 ? Math.round(totalDurationMs / (completedApps.length * 1000 * 60)) : 0;

  // Calculate Acceptance & Denial Rates
  const totalDecided = accepted + denied;
  const acceptanceRate = totalDecided > 0 ? Math.round((accepted / totalDecided) * 100) : 0;
  const denialRate = totalDecided > 0 ? Math.round((denied / totalDecided) * 100) : 0;

  // Reviewer Leaderboard
  const reviewersData = await prisma.application.groupBy({
    by: ["claimedByUserId", "claimedByTag"],
    where: {
      guildId,
      claimedByUserId: { not: null },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 5,
  });

  const topReviewers = reviewersData.map((r) => ({
    userId: r.claimedByUserId,
    tag: r.claimedByTag || "Unknown Reviewer",
    count: r._count.id,
  }));

  // Daily submissions trend (last 7 days)
  const daysTrend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);

    const nextD = new Date(d);
    nextD.setDate(nextD.getDate() + 1);

    const dayCount = await prisma.application.count({
      where: {
        guildId,
        createdAt: { gte: d, lt: nextD },
      },
    });

    const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
    daysTrend.push({ day: dayName, date: d.toISOString().split("T")[0], count: dayCount });
  }

  // Recent activity logs
  const recentActivity = await prisma.appLog.findMany({
    where: { guildId },
    orderBy: { timestamp: "desc" },
    take: 10,
  });

  return {
    totalForms,
    totalApps,
    activeApps,
    pendingReviews,
    accepted,
    denied,
    waitlisted,
    closed,
    appsToday,
    avgReviewTimeMinutes,
    acceptanceRate,
    denialRate,
    topReviewers,
    daysTrend,
    recentActivity,
  };
}

export async function getApplicationSettings(guildId: string) {
  let settings = await prisma.appSettings.findUnique({
    where: { guildId },
  });

  if (!settings) {
    settings = await prisma.appSettings.create({
      data: {
        guildId,
        defaultReviewerRoles: "[]",
        defaultCooldownHours: 24,
        maxAppsPerUser: 1,
        autoCloseHours: 0,
        autoArchive: false,
        timezone: "UTC",
      },
    });
  }

  return {
    ...settings,
    defaultReviewerRoles: JSON.parse(settings.defaultReviewerRoles || "[]"),
  };
}

export async function updateApplicationSettings(guildId: string, data: any) {
  const payload: any = { ...data };
  if (Array.isArray(data.defaultReviewerRoles)) {
    payload.defaultReviewerRoles = JSON.stringify(data.defaultReviewerRoles);
  }

  delete payload.id;
  delete payload.guildId;

  const settings = await prisma.appSettings.upsert({
    where: { guildId },
    update: payload,
    create: {
      guildId,
      ...payload,
      defaultReviewerRoles: payload.defaultReviewerRoles || "[]",
    },
  });

  return {
    ...settings,
    defaultReviewerRoles: JSON.parse(settings.defaultReviewerRoles || "[]"),
  };
}

export async function createAppLog(data: {
  guildId: string;
  applicationId?: string;
  action: string;
  executorId: string;
  executorTag: string;
  details?: string;
}) {
  return await prisma.appLog.create({
    data: {
      guildId: data.guildId,
      applicationId: data.applicationId || null,
      action: data.action,
      executorId: data.executorId,
      executorTag: data.executorTag,
      details: data.details || null,
    },
  });
}

export async function getApplicationLogs(guildId: string) {
  return await prisma.appLog.findMany({
    where: { guildId },
    orderBy: { timestamp: "desc" },
    take: 50,
  });
}
