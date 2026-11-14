import { Router } from "express";
import fs from "fs";
import path from "path";
import { discordClient } from "../bot/client";
import {
  getApplicationStats,
  getAppPanels,
  getAppPanelById,
  createAppPanel,
  updateAppPanel,
  deleteAppPanel,
  getAppForms,
  getAppFormById,
  createAppForm,
  updateAppForm,
  deleteAppForm,
  getAppQuestions,
  createAppQuestion,
  updateAppQuestion,
  deleteAppQuestion,
  reorderAppQuestions,
  duplicateAppQuestion,
  getApplications,
  getApplicationById,
  addApplicationNote,
  getApplicationSettings,
  updateApplicationSettings,
  getApplicationLogs,
} from "../services/applicationService";
import { deployApplicationPanelEmbed, deployApplicationFormEmbed } from "../bot/applicationHandler";
import { generateApplicationHtmlTranscript } from "../services/transcriptService";
import { AuthenticatedRequest, requireAuth } from "../middleware/authMiddleware";
import { GuildMember, ChannelType } from "discord.js";
import { applicationDb as db, applicationGuildAccess, applicationGuildsFor, applicationMember, managesApplications, reviewerRoles, reviewAccessFilter } from "../services/applicationAccess";
import { ApplicationError, privateReviewChannel, requireApplicationReviewer, runApplicationReview } from "../services/applicationReview";
import { deployApplicationDmPanel } from "../bot/applicationDm";
import { applicationFilePath } from "../services/applicationFiles";
import { broadcastApplicationEvent } from "../socket/socketManager";

const router = Router();

const base = "/:guildId/applications";
const reviewPath = `${base}/apps/:appId`;

function failure(res: import("express").Response, error: unknown) {
  if (error instanceof ApplicationError) return res.status(error.statusCode).json({ error: error.message });
  console.error("[Applications] Dashboard request failed:", error);
  return res.status(500).json({ error: "The application request failed." });
}

router.get("/application-access", requireAuth, async (req: AuthenticatedRequest, res) => {
  try { res.json(await applicationGuildsFor(req.user!.id)); }
  catch (error) { failure(res, error); }
});

router.use(base, requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const member = await applicationMember(req.params.guildId, req.user!.id);
    if (!member || !await applicationGuildAccess(member)) throw new ApplicationError("You do not have access to this server’s Application Center.", 403);
    res.locals.member = member;
    next();
  } catch (error) { failure(res, error); }
});

router.get(`${base}/access`, (_req, res) => {
  res.json({ manage: managesApplications(res.locals.member) });
});

router.get(`${base}/apps`, async (req, res) => {
  try {
    const filters = Object.fromEntries(["status", "search", "formId", "reviewerId"]
      .flatMap(key => typeof req.query[key] === "string" ? [[key, req.query[key]]] : []));
    res.json(await getApplications(req.params.guildId, { ...filters, access: await reviewAccessFilter(res.locals.member) }));
  } catch (error) { failure(res, error); }
});

router.param("appId", async (req: AuthenticatedRequest, res, next, id) => {
  try {
    res.locals.application = (await requireApplicationReviewer(req.params.guildId, id, req.user!.id)).app;
    next();
  } catch (error) { failure(res, error); }
});

router.get(reviewPath, (_req, res) => res.json(res.locals.application));

router.get(`${reviewPath}/files/:fileId`, (req, res) => {
  const app: NonNullable<Awaited<ReturnType<typeof getApplicationById>>> = res.locals.application;
  const file = app.files.find(item => item.id === req.params.fileId);
  if (!file) return res.status(404).json({ error: "Attachment not found." });
  res.set({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Type": "application/octet-stream" });
  res.download(applicationFilePath(file.id), file.name, error => {
    if (error && !res.headersSent) res.status(404).json({ error: "Attachment unavailable." });
  });
});

router.post(`${reviewPath}/action`, async (req: AuthenticatedRequest, res) => {
  try {
    if (typeof req.body?.action !== "string") throw new ApplicationError("Choose a review action.");
    res.json(await runApplicationReview(req.params.guildId, req.params.appId, req.user!.id, req.body));
  } catch (error) { failure(res, error); }
});

router.post(`${reviewPath}/notes`, async (req: AuthenticatedRequest, res) => {
  try {
    const member: GuildMember = res.locals.member;
    const content = req.body?.content;
    if (typeof content !== "string" || !content.trim() || content.length > 2000) {
      throw new ApplicationError("Enter an internal note of 1–2000 characters.");
    }
    const note = await addApplicationNote(req.params.appId, { id: member.id, tag: member.user.tag, avatar: member.user.displayAvatarURL() }, content.trim());
    broadcastApplicationEvent(req.params.guildId, "applicationUpdated");
    res.json(note);
  } catch (error) { failure(res, error); }
});

router.get(`${base}/transcripts/:appId/download`, async (req, res) => {
  try {
    const app: NonNullable<Awaited<ReturnType<typeof getApplicationById>>> = res.locals.application;
    let filePath = path.resolve("transcripts", `application-${app.id}.html`);
    if (!fs.existsSync(filePath)) {
      const channel = app.channelId ? await res.locals.member.guild.channels.fetch(app.channelId).catch(() => null) : null;
      filePath = await generateApplicationHtmlTranscript(app, channel?.type === ChannelType.GuildText ? channel : null);
    }
    res.set({ "Cache-Control": "private, no-store", "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src https:" });
    if (req.query.download === "true") return res.download(filePath, `application-${app.appNumber}.html`);
    res.type("html").sendFile(path.resolve(filePath));
  } catch (error) { failure(res, error); }
});

router.use(base, (req, res, next) => {
  if (managesApplications(res.locals.member)) return next();
  return res.status(403).json({ error: "You need Manage Server to configure the Application Center." });
});

router.get(`${base}/configuration-options`, async (_req, res) => {
  try {
    const member: GuildMember = res.locals.member;
    const [channels, roles] = await Promise.all([member.guild.channels.fetch(), member.guild.roles.fetch()]);
    res.json({
      channels: channels.filter(channel => Boolean(channel)).map(channel => ({
        id: channel!.id, name: channel!.name, type: channel!.type,
      })),
      roles: roles.filter(role => role.id !== member.guild.id).map(role => ({ id: role.id, name: role.name })),
    });
  } catch (error) { failure(res, error); }
});

router.param("panelId", async (req, res, next, id) => {
  try {
    if (!await db.appPanel.findUnique({ where: { id, guildId: req.params.guildId } })) throw new ApplicationError("Panel not found.", 404);
    next();
  } catch (error) { failure(res, error); }
});

router.param("formId", async (req, res, next, id) => {
  try {
    if (!await db.appForm.findUnique({ where: { id, guildId: req.params.guildId } })) throw new ApplicationError("Form not found.", 404);
    next();
  } catch (error) { failure(res, error); }
});

router.param("questionId", async (req, res, next, id) => {
  try {
    if (!await db.appQuestion.findFirst({ where: { id, form: { guildId: req.params.guildId } } })) throw new ApplicationError("Question not found.", 404);
    next();
  } catch (error) { failure(res, error); }
});

function fields(body: Record<string, unknown>, allowed: string[]) {
  return Object.fromEntries(allowed.filter(key => Object.hasOwn(body, key)).map(key => [key, body[key]]));
}

const formFields = `name description emoji category panelId buttonText buttonEmoji buttonColor displayType
  targetChannelId categoryId reviewerRoles applicantRoles acceptedRoles deniedRoles cooldownHours maxActiveApps isOpen
  dmPanelTitle dmPanelDescription dmPanelChannelId reviewChannelId ticketCategoryId statusSteps channelId
  dmTitle dmDescription dmColor dmAuthorName dmAuthorIcon dmThumbnail dmImage dmFooter dmFooterIcon
  embedTitle embedDescription embedColor embedAuthorName embedAuthorIcon embedAuthorUrl thumbnail image footer footerIcon showTimestamp embedFields
  welcomeTitle welcomeDescription welcomeColor welcomeAuthorName welcomeAuthorIcon welcomeThumbnail welcomeImage welcomeFooter welcomeFooterIcon
  acceptMessage acceptEmbedTitle acceptEmbedDescription acceptEmbedColor denyMessage denyEmbedTitle denyEmbedDescription denyEmbedColor
  waitlistMessage waitlistEmbedTitle waitlistEmbedDescription waitlistEmbedColor`.split(/\s+/);

const panelFields = [...formFields.filter(key => !["panelId","reviewerRoles","applicantRoles","acceptedRoles","deniedRoles","statusSteps",
  "dmPanelTitle","dmPanelDescription","dmPanelChannelId","reviewChannelId","ticketCategoryId","isOpen","cooldownHours","maxActiveApps",
  "targetChannelId","categoryId","emoji","category","buttonText","buttonEmoji","buttonColor"].includes(key)),
  "acceptEmbedColor", "denyEmbedColor"].filter(key => !["acceptMessage","acceptEmbedTitle","acceptEmbedDescription",
  "denyMessage","denyEmbedTitle","denyEmbedDescription","waitlistMessage","waitlistEmbedTitle","waitlistEmbedDescription","waitlistEmbedColor"].includes(key));

async function formConfig(member: GuildMember, body: Record<string, unknown>, current?: Awaited<ReturnType<typeof getAppFormById>>) {
  const data = fields(body, formFields);
  const guild = member.guild;
  if (data.panelId && !await db.appPanel.findFirst({ where: { id: String(data.panelId), guildId: guild.id } })) {
    throw new ApplicationError("Select an application panel from this server.");
  }
  for (const key of ["dmPanelChannelId", "reviewChannelId", "ticketCategoryId", "targetChannelId", "categoryId", "channelId", "panelId"]) {
    if (data[key] === "") data[key] = null;
    if (data[key] != null && typeof data[key] !== "string") throw new ApplicationError("Invalid channel or panel selection.");
    if (!data[key] || key === "panelId") continue;
    const channel = await guild.channels.fetch(String(data[key]), { force: true }).catch(() => null);
    const valid = key === "ticketCategoryId" || key === "categoryId" ? channel?.type === ChannelType.GuildCategory
      : channel?.type === ChannelType.GuildText || (["dmPanelChannelId", "channelId"].includes(key) && channel?.type === ChannelType.GuildAnnouncement);
    if (!valid) throw new ApplicationError("Select a matching channel or category from this server.");
  }
  for (const key of ["reviewerRoles", "applicantRoles", "acceptedRoles", "deniedRoles"]) {
    if (!(key in data)) continue;
    const ids = data[key];
    const roles = await guild.roles.fetch();
    if (!Array.isArray(ids) || !ids.every(id => typeof id === "string" && id !== guild.id && roles.has(id))) {
      throw new ApplicationError("Select roles from this server.");
    }
  }
  if ("statusSteps" in data) {
    const steps = data.statusSteps;
    if (!Array.isArray(steps) || steps.length > 25 || !steps.every(step => typeof step === "string" && step.trim() && step.trim().length <= 100)) {
      throw new ApplicationError("Enter up to 25 status steps of at most 100 characters each.");
    }
    data.statusSteps = [...new Set(steps.map(step => step.trim()))];
  }
  const reviewChannelId = "reviewChannelId" in data ? data.reviewChannelId : current?.reviewChannelId;
  if (typeof reviewChannelId === "string") {
    const roles = Array.isArray(data.reviewerRoles) ? JSON.stringify(data.reviewerRoles) : current?.reviewerRoles;
    await privateReviewChannel(guild, reviewChannelId, await reviewerRoles(guild.id, roles));
    if (reviewChannelId === ("dmPanelChannelId" in data ? data.dmPanelChannelId : current?.dmPanelChannelId)) {
      throw new ApplicationError("Use separate channels for the start panel and reviews.");
    }
  }
  return data;
}

// Stats & Overview
router.get("/:guildId/applications/stats", async (req, res) => {
  try {
    const stats = await getApplicationStats(req.params.guildId);
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch application stats" });
  }
});

// Panels CRUD & Deploy
router.get("/:guildId/applications/panels", async (req, res) => {
  try {
    const panels = await getAppPanels(req.params.guildId);
    res.json(panels);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch panels" });
  }
});

router.get("/:guildId/applications/panels/:panelId", async (req, res) => {
  try {
    const panel = await getAppPanelById(req.params.panelId);
    if (!panel) return res.status(404).json({ error: "Panel not found" });
    res.json(panel);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch panel" });
  }
});

router.post("/:guildId/applications/panels", async (req, res) => {
  try {
    const panel = await createAppPanel(req.params.guildId, fields(req.body, panelFields));
    res.json(panel);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create panel" });
  }
});

router.patch("/:guildId/applications/panels/:panelId", async (req, res) => {
  try {
    const panel = await updateAppPanel(req.params.panelId, fields(req.body, panelFields));
    let syncedLive = false;
    if (panel.messageId && panel.channelId) {
      try {
        await deployApplicationPanelEmbed(discordClient, panel.id);
        syncedLive = true;
      } catch (syncErr) {
        console.warn(`[Application System] Live sync error for panel ${panel.id}:`, syncErr);
      }
    }
    res.json({ ...panel, syncedLive });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update panel" });
  }
});

router.delete("/:guildId/applications/panels/:panelId", async (req, res) => {
  try {
    const result = await deleteAppPanel(req.params.panelId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete panel" });
  }
});

router.post("/:guildId/applications/panels/:panelId/deploy", async (req, res) => {
  try {
    const messageId = await deployApplicationPanelEmbed(discordClient, req.params.panelId);
    await updateAppPanel(req.params.panelId, { messageId });
    res.json({ success: true, messageId });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to deploy panel embed" });
  }
});

// Forms CRUD & Deploy
router.get("/:guildId/applications/forms", async (req, res) => {
  try {
    const forms = await getAppForms(req.params.guildId);
    res.json(forms);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch forms" });
  }
});

router.get("/:guildId/applications/forms/:formId", async (req, res) => {
  try {
    const form = await getAppFormById(req.params.formId);
    if (!form) return res.status(404).json({ error: "Form not found" });
    res.json(form);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch form" });
  }
});

router.post("/:guildId/applications/forms", async (req, res) => {
  try {
    const form = await createAppForm(req.params.guildId, await formConfig(res.locals.member, req.body));
    res.json(form);
  } catch (err: any) {
    failure(res, err);
  }
});

router.patch("/:guildId/applications/forms/:formId", async (req, res) => {
  try {
    const form = await updateAppForm(req.params.formId, await formConfig(res.locals.member, req.body, await getAppFormById(req.params.formId)));
    let syncedLive = false;
    if (form.messageId && form.channelId) {
      try {
        await deployApplicationFormEmbed(discordClient, form.id);
        syncedLive = true;
      } catch (syncErr) {
        console.warn(`[Application System] Live sync error for form ${form.id}:`, syncErr);
      }
    }
    res.json({ ...form, syncedLive });
  } catch (err: any) {
    failure(res, err);
  }
});

router.delete("/:guildId/applications/forms/:formId", async (req, res) => {
  try {
    const result = await deleteAppForm(req.params.formId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete form" });
  }
});

router.post("/:guildId/applications/forms/:formId/deploy", async (req, res) => {
  try {
    const messageId = await deployApplicationFormEmbed(discordClient, req.params.formId);
    await updateAppForm(req.params.formId, { messageId });
    res.json({ success: true, messageId });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to deploy application embed" });
  }
});

router.post(`${base}/forms/:formId/dm-panel`, async (req, res) => {
  try {
    const messageId = await deployApplicationDmPanel(req.params.formId);
    res.json({ messageId });
  } catch (error) { failure(res, error); }
});

const questionFields = ["label", "type", "placeholder", "required", "options", "minLength", "maxLength",
  "validationRegex", "validationError", "helpText", "order"];

// Questions CRUD & Reordering
router.get("/:guildId/applications/forms/:formId/questions", async (req, res) => {
  try {
    const questions = await getAppQuestions(req.params.formId);
    res.json(questions);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch questions" });
  }
});

router.post("/:guildId/applications/forms/:formId/questions", async (req, res) => {
  try {
    const question = await createAppQuestion(req.params.formId, fields(req.body, questionFields));
    res.json(question);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create question" });
  }
});

router.patch("/:guildId/applications/questions/:questionId", async (req, res) => {
  try {
    const question = await updateAppQuestion(req.params.questionId, fields(req.body, questionFields));
    res.json(question);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update question" });
  }
});

router.delete("/:guildId/applications/questions/:questionId", async (req, res) => {
  try {
    const result = await deleteAppQuestion(req.params.questionId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete question" });
  }
});

router.put("/:guildId/applications/forms/:formId/questions/reorder", async (req, res) => {
  try {
    const { questionIds } = req.body;
    if (!Array.isArray(questionIds)) return res.status(400).json({ error: "questionIds must be an array" });
    const questions = await reorderAppQuestions(req.params.formId, questionIds);
    res.json(questions);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to reorder questions" });
  }
});

router.post("/:guildId/applications/questions/:questionId/duplicate", async (req, res) => {
  try {
    const copy = await duplicateAppQuestion(req.params.questionId);
    res.json(copy);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to duplicate question" });
  }
});

// Settings & Logs
router.get("/:guildId/applications/settings", async (req, res) => {
  try {
    const settings = await getApplicationSettings(req.params.guildId);
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch settings" });
  }
});

router.patch("/:guildId/applications/settings", async (req, res) => {
  try {
    const settings = await updateApplicationSettings(req.params.guildId, fields(req.body, ["defaultReviewerRoles", "defaultCategoryId", "archiveCategoryId", "logChannelId", "transcriptStorage", "defaultCooldownHours", "maxAppsPerUser", "autoCloseHours", "autoArchive", "timezone"]));
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update settings" });
  }
});

router.get("/:guildId/applications/logs", async (req, res) => {
  try {
    const logs = await getApplicationLogs(req.params.guildId);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch logs" });
  }
});

export default router;
