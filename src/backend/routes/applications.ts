import { Router } from "express";
import fs from "fs";
import path from "path";
import { discordClient } from "../bot/client";
import {
  getApplicationStats,
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
  updateApplicationStatus,
  addApplicationNote,
  getApplicationSettings,
  updateApplicationSettings,
  getApplicationLogs,
} from "../services/applicationService";
import { deployApplicationFormEmbed } from "../bot/applicationHandler";
import { generateApplicationHtmlTranscript } from "../services/transcriptService";
import { TextChannel } from "discord.js";

const router = Router();

// Stats & Overview
router.get("/:guildId/applications/stats", async (req, res) => {
  try {
    const stats = await getApplicationStats(req.params.guildId);
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch application stats" });
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
    const form = await createAppForm(req.params.guildId, req.body);
    res.json(form);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create form" });
  }
});

router.patch("/:guildId/applications/forms/:formId", async (req, res) => {
  try {
    const form = await updateAppForm(req.params.formId, req.body);
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
    res.status(500).json({ error: err.message || "Failed to update form" });
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
    const question = await createAppQuestion(req.params.formId, req.body);
    res.json(question);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create question" });
  }
});

router.patch("/:guildId/applications/questions/:questionId", async (req, res) => {
  try {
    const question = await updateAppQuestion(req.params.questionId, req.body);
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

// Applications List & Actions
router.get("/:guildId/applications/apps", async (req, res) => {
  try {
    const { status, search, formId, reviewerId } = req.query as any;
    const apps = await getApplications(req.params.guildId, { status, search, formId, reviewerId });
    res.json(apps);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch applications" });
  }
});

router.get("/:guildId/applications/apps/:appId", async (req, res) => {
  try {
    const app = await getApplicationById(req.params.appId);
    if (!app) return res.status(404).json({ error: "Application not found" });
    res.json(app);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch application" });
  }
});

router.post("/:guildId/applications/apps/:appId/action", async (req, res) => {
  try {
    const { action, reason } = req.body;
    const app = await getApplicationById(req.params.appId);
    if (!app) return res.status(404).json({ error: "Application not found" });

    const executor = {
      id: "dashboard_user",
      tag: "Dashboard Administrator",
    };

    let updatedStatus = app.status;

    if (action === "claim") updatedStatus = "CLAIMED";
    else if (action === "unclaim") updatedStatus = "UNCLAIMED";
    else if (action === "accept") updatedStatus = "ACCEPTED";
    else if (action === "deny") updatedStatus = "DENIED";
    else if (action === "waitlist") updatedStatus = "WAITLISTED";
    else if (action === "reopen") updatedStatus = "PENDING";
    else if (action === "close") updatedStatus = "CLOSED";
    else if (action === "request_info") updatedStatus = "UNDER_REVIEW";

    const updatedApp = await updateApplicationStatus(app.id, updatedStatus, executor, { reason });

    // If action is transcript, generate HTML transcript file
    if (action === "transcript" || action === "close") {
      let channel: TextChannel | null = null;
      if (app.channelId) {
        channel = (await discordClient.channels.fetch(app.channelId).catch(() => null)) as TextChannel;
      }
      const filePath = await generateApplicationHtmlTranscript(updatedApp, channel);
      const transcriptUrl = `/api/guilds/${app.guildId}/applications/transcripts/${app.id}/download`;
      await updateApplicationStatus(app.id, updatedStatus, executor, { transcriptUrl });
    }

    res.json({ success: true, application: updatedApp });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to execute action" });
  }
});

router.post("/:guildId/applications/apps/:appId/notes", async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: "Note content required" });

    const author = {
      id: "dashboard_user",
      tag: "Dashboard Administrator",
    };

    const note = await addApplicationNote(req.params.appId, author, content.trim());
    res.json(note);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to add note" });
  }
});

// Transcript Download / Display
router.get("/:guildId/applications/transcripts/:appId/download", async (req, res) => {
  try {
    const { guildId, appId } = req.params;
    const app = await getApplicationById(appId);
    if (!app) return res.status(404).send("Application not found.");

    const TRANSCRIPTS_DIR = path.join(process.cwd(), "transcripts");
    let filePath = path.join(TRANSCRIPTS_DIR, `application-${appId}.html`);

    if (!fs.existsSync(filePath)) {
      let channel: TextChannel | null = null;
      if (app.channelId) {
        channel = (await discordClient.channels.fetch(app.channelId).catch(() => null)) as TextChannel;
      }
      filePath = await generateApplicationHtmlTranscript(app, channel);
    }

    if (req.query.download === "true") {
      return res.download(filePath, `application-${app.appNumber}-${app.userTag}.html`);
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(filePath);
  } catch (err: any) {
    res.status(500).send("Error generating/serving transcript.");
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
    const settings = await updateApplicationSettings(req.params.guildId, req.body);
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
