import { PrismaClient } from "@prisma/client";
import { discordClient } from "../bot/client";
import { GuildMember, Role } from "discord.js";

const prisma = new PrismaClient();

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
      categoryId: data.categoryId || null,
      reviewerRoles: JSON.stringify(data.reviewerRoles || []),
      applicantRoles: JSON.stringify(data.applicantRoles || []),
      acceptedRoles: JSON.stringify(data.acceptedRoles || []),
      deniedRoles: JSON.stringify(data.deniedRoles || []),
      cooldownHours: Number(data.cooldownHours) || 24,
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
  return await prisma.appForm.delete({
    where: { id: formId },
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
      where: { id },
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
      helpText: original.helpText,
      order: existingCount,
    },
  });
}

// ==========================================
// APPLICATIONS WORKFLOW
// ==========================================

export async function getApplications(
  guildId: string,
  filters?: { status?: string; search?: string; formId?: string; reviewerId?: string }
) {
  const where: any = { guildId };

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
    include: {
      form: { select: { id: true, name: true, category: true } },
      answers: true,
      notes: { orderBy: { createdAt: "desc" } },
      history: { orderBy: { timestamp: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getApplicationById(appId: string) {
  return await prisma.application.findUnique({
    where: { id: appId },
    include: {
      form: true,
      answers: true,
      notes: { orderBy: { createdAt: "desc" } },
      history: { orderBy: { timestamp: "desc" } },
    },
  });
}

export async function checkUserCanApply(guildId: string, formId: string, userId: string) {
  const form = await getAppFormById(formId);
  if (!form) return { canApply: false, reason: "Application form not found." };
  if (!form.isOpen) return { canApply: false, reason: "This application form is currently closed." };

  // Check active applications count
  const activeAppsCount = await prisma.application.count({
    where: {
      guildId,
      formId,
      userId,
      status: { in: ["PENDING", "UNDER_REVIEW", "CLAIMED", "WAITLISTED"] },
    },
  });

  if (activeAppsCount >= form.maxActiveApps) {
    return {
      canApply: false,
      reason: `You already have ${activeAppsCount} active application(s) for this form (Maximum allowed: ${form.maxActiveApps}).`,
    };
  }

  // Check cooldown
  if (form.cooldownHours > 0) {
    const lastApp = await prisma.application.findFirst({
      where: { guildId, formId, userId },
      orderBy: { createdAt: "desc" },
    });

    if (lastApp) {
      const hoursPassed = (Date.now() - new Date(lastApp.createdAt).getTime()) / (1000 * 60 * 60);
      if (hoursPassed < form.cooldownHours) {
        const remainingHours = Math.ceil(form.cooldownHours - hoursPassed);
        return {
          canApply: false,
          reason: `You are on cooldown for this form. Please wait ${remainingHours} hour(s) before applying again.`,
        };
      }
    }
  }

  return { canApply: true };
}

export async function createApplicationSubmission(data: {
  guildId: string;
  formId: string;
  userId: string;
  userTag: string;
  userAvatar?: string;
  accountAge?: string;
  joinDate?: string;
  currentRoles?: string[];
  attachments?: string[];
  answers: { questionId?: string; questionLabel: string; questionType: string; value: string }[];
}) {
  const count = await prisma.application.count({ where: { guildId: data.guildId } });
  const appNumber = count + 1;

  const app = await prisma.application.create({
    data: {
      appNumber,
      guildId: data.guildId,
      formId: data.formId,
      userId: data.userId,
      userTag: data.userTag,
      userAvatar: data.userAvatar || null,
      accountAge: data.accountAge || "Unknown",
      joinDate: data.joinDate || "Unknown",
      currentRoles: JSON.stringify(data.currentRoles || []),
      attachments: JSON.stringify(data.attachments || []),
      status: "PENDING",
      submittedAt: new Date(),
      answers: {
        create: data.answers.map((ans) => ({
          questionId: ans.questionId || null,
          questionLabel: ans.questionLabel,
          questionType: ans.questionType,
          value: ans.value,
        })),
      },
      history: {
        create: {
          status: "PENDING",
          actorId: data.userId,
          actorTag: data.userTag,
          details: "Application submitted",
        },
      },
    },
    include: {
      form: true,
      answers: true,
      notes: true,
      history: true,
    },
  });

  await createAppLog({
    guildId: data.guildId,
    applicationId: app.id,
    action: "SUBMITTED",
    executorId: data.userId,
    executorTag: data.userTag,
    details: `Submitted application #${appNumber}`,
  });

  return app;
}

export async function updateApplicationStatus(
  appId: string,
  newStatus: string,
  executor: { id: string; tag: string; avatar?: string },
  details?: { reason?: string; channelId?: string; transcriptUrl?: string }
) {
  const app = await prisma.application.findUnique({
    where: { id: appId },
    include: { form: true },
  });

  if (!app) throw new Error("Application not found");

  const updateData: any = {
    status: newStatus,
    updatedAt: new Date(),
  };

  if (details?.reason !== undefined) {
    updateData.decisionReason = details.reason;
  }
  if (details?.channelId !== undefined) {
    updateData.channelId = details.channelId;
  }
  if (details?.transcriptUrl !== undefined) {
    updateData.transcriptUrl = details.transcriptUrl;
  }

  if (newStatus === "CLAIMED") {
    updateData.claimedByUserId = executor.id;
    updateData.claimedByTag = executor.tag;
    updateData.claimedByAvatar = executor.avatar || null;
    updateData.reviewedAt = new Date();
  } else if (newStatus === "UNCLAIMED") {
    updateData.claimedByUserId = null;
    updateData.claimedByTag = null;
    updateData.claimedByAvatar = null;
    updateData.status = "PENDING";
  } else if (["ACCEPTED", "DENIED", "WAITLISTED", "CLOSED"].includes(newStatus)) {
    if (!app.reviewedAt) {
      updateData.reviewedAt = new Date();
    }
    if (newStatus === "CLOSED") {
      updateData.closedAt = new Date();
    }
  }

  const updatedApp = await prisma.application.update({
    where: { id: appId },
    data: updateData,
    include: {
      form: true,
      answers: true,
      notes: true,
      history: true,
    },
  });

  // Track status history
  await prisma.appStatusHistory.create({
    data: {
      applicationId: appId,
      status: newStatus,
      actorId: executor.id,
      actorTag: executor.tag,
      details: details?.reason || `Status updated to ${newStatus}`,
    },
  });

  await createAppLog({
    guildId: app.guildId,
    applicationId: appId,
    action: newStatus,
    executorId: executor.id,
    executorTag: executor.tag,
    details: details?.reason || `Status changed to ${newStatus}`,
  });

  // Handle Automatic Role Assignments if ACCEPTED, DENIED, or WAITLISTED
  if (app.form) {
    try {
      await handleRoleAssignments(app.guildId, app.userId, newStatus, app.form);
    } catch (err) {
      console.warn(`[App System] Failed role automation for app ${appId}:`, err);
    }
  }

  return updatedApp;
}

async function handleRoleAssignments(guildId: string, userId: string, status: string, form: any) {
  if (!discordClient || !discordClient.isReady()) return;

  const guild = await discordClient.guilds.fetch(guildId).catch(() => null);
  if (!guild) return;

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;

  if (status === "ACCEPTED") {
    const acceptedRoleIds: string[] = JSON.parse(form.acceptedRoles || "[]");
    for (const rId of acceptedRoleIds) {
      if (rId && !member.roles.cache.has(rId)) {
        await member.roles.add(rId).catch(() => null);
      }
    }
  } else if (status === "DENIED") {
    const deniedRoleIds: string[] = JSON.parse(form.deniedRoles || "[]");
    for (const rId of deniedRoleIds) {
      if (rId && !member.roles.cache.has(rId)) {
        await member.roles.add(rId).catch(() => null);
      }
    }
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
