import { AppDmDraft, AppQuestion } from "@prisma/client";
import {
  ButtonInteraction, ButtonStyle, ChannelType, Client, ContainerBuilder, DiscordAPIError, GuildMember, Interaction,
  Message, MessageCreateOptions, MessageFlags, StringSelectMenuInteraction, TextDisplayBuilder, User,
} from "discord.js";
import { discordClient } from "./client";
import { applicationDb as db, applicationMember, noMentions, readStrings, reviewerRoles, serializeApplication } from "../services/applicationAccess";
import { removeApplicationFiles, storeApplicationFiles } from "../services/applicationFiles";
import {
  ApplicationError, appButton, appRow, applicationReplyReceived, deliverApplicationSubmission, privateReviewChannel,
  splitApplicationText, unknownDiscordMessage,
} from "../services/applicationReview";
import { checkUserCanApply, createApplicationSubmission, getAppFormById } from "../services/applicationService";

type Answers = Record<number, { messageId: string; text: string }[]>;
type Form = NonNullable<Awaited<ReturnType<typeof getAppFormById>>>;
type PanelClick = ButtonInteraction | StringSelectMenuInteraction;

async function checkApplicant(form: Form, userId: string) {
  const member = await applicationMember(form.guildId, userId);
  if (!member) throw new ApplicationError("You must be a member of this server to apply.");
  const roles = readStrings(form.applicantRoles).filter(id => id !== form.guildId);
  if (roles.length && !roles.some(id => member.roles.cache.has(id))) {
    throw new ApplicationError("You do not have one of the required applicant roles.");
  }
  return member;
}

function draftQuestions(draft: AppDmDraft): AppQuestion[] { return JSON.parse(draft.questions); }
function draftAnswers(draft: AppDmDraft): Answers { return JSON.parse(draft.answers); }
function answerText(answers: Answers, step: number) {
  return (answers[step] || []).map(entry => entry.text).filter(Boolean).join("\n");
}

function draftAction(draft: AppDmDraft, action: string, label: string, style?: ButtonStyle, page?: number) {
  return appButton(`app_draft:${action}:${draft.id}:${draft.revision}${page === undefined ? "" : `:${page}`}`, label, style);
}

function activeDraftActions(draft: AppDmDraft) {
  return appRow(draftAction(draft, "resume", "Continue draft", ButtonStyle.Primary), draftAction(draft, "pause", "Pause draft"));
}

async function send(user: User, payload: MessageCreateOptions) {
  return user.send({ ...payload, allowedMentions: noMentions });
}

export async function deployApplicationDmPanel(formId: string) {
  return serializeApplication(`panel:${formId}`, async () => {
    const form = await getAppFormById(formId);
    if (!form?.dmPanelChannelId || !form.reviewChannelId || !form.questions.length) {
      throw new ApplicationError("Choose a start channel and a private review channel and add at least one question.");
    }
    const guild = discordClient.guilds.cache.get(form.guildId);
    if (!guild) throw new ApplicationError("The bot is not connected to this server.");
    if (form.dmPanelChannelId === form.reviewChannelId) throw new ApplicationError("Choose a different channel for the public start panel.");
    await privateReviewChannel(guild, form.reviewChannelId, await reviewerRoles(guild.id, form.reviewerRoles));
    const channel = await guild.channels.fetch(form.dmPanelChannelId, { force: true });
    if (channel?.type !== ChannelType.GuildText && channel?.type !== ChannelType.GuildAnnouncement) {
      throw new ApplicationError("Select a server text or announcement channel for the start panel.");
    }
    const container = new ContainerBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `## ${(form.dmPanelTitle || form.name).trim()}\n${form.dmPanelDescription || form.description || "Apply by direct message."}`.slice(0, 3800),
      ))
      .addActionRowComponents(appRow(appButton(`app_dm:apply:${form.id}`, "Apply", ButtonStyle.Primary).setDisabled(!form.isOpen)));
    const payload = { components: [container], allowedMentions: noMentions };
    if (form.dmPanelMessageId && form.dmPanelPostedChannelId === channel.id) {
      try {
        return (await channel.messages.edit(form.dmPanelMessageId, payload)).id;
      } catch (error) {
        if (!unknownDiscordMessage(error)) throw error;
      }
    }
    const message = await channel.send({ ...payload, flags: MessageFlags.IsComponentsV2 });
    await db.appForm.update({ where: { id: form.id }, data: {
      dmPanelMessageId: message.id, dmPanelPostedChannelId: channel.id,
    } });
    if (form.dmPanelMessageId && form.dmPanelPostedChannelId) {
      const old = await guild.channels.fetch(form.dmPanelPostedChannelId).catch(() => null);
      if (old?.type === ChannelType.GuildText || old?.type === ChannelType.GuildAnnouncement) {
        await old.messages.delete(form.dmPanelMessageId).catch(() => undefined);
      }
    }
    return message.id;
  });
}

export async function offerApplication(interaction: PanelClick, formId: string, verifyPanel = false) {
  if (!interaction.inGuild()) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const form = await getAppFormById(formId);
  if (!form || form.guildId !== interaction.guildId || (verifyPanel && form.dmPanelMessageId !== interaction.message.id)) {
    throw new ApplicationError("This form is no longer available on this panel.");
  }
  const member = await checkApplicant(form, interaction.user.id);
  const check = await checkUserCanApply(form.guildId, form.id, interaction.user.id);
  if (!check.canApply) throw new ApplicationError(check.reason!);
  if (!form.questions.length) throw new ApplicationError("This form has no questions yet.");
  try {
    await send(interaction.user, {
      content: `**${member.guild.name} · ${form.name.slice(0, 180)}**\n${(form.dmDescription || "Choose Start application when you are ready.").slice(0, 1200)}`,
      components: [appRow(appButton(`app_dm:start:${form.id}`, "Start application", ButtonStyle.Primary),
        appButton(`app_dm:cancel:${form.id}`, "Cancel"))],
    });
  } catch (error) {
    const blocked = error instanceof DiscordAPIError && error.code === 50007;
    await interaction.editReply({
      content: blocked
        ? "Discord blocked the DM. Enable direct messages from server members in this server’s privacy settings, then try again."
        : "Discord could not deliver the DM. Try again in a moment.",
      components: [appRow(appButton(`app_dm:retry:${form.id}`, "Try again", ButtonStyle.Primary))],
    });
    return;
  }
  await interaction.editReply({ content: "Check your direct messages to start or continue your application." });
}

async function takeCursor(userId: string, sinceId: string, target: { draftId?: string; followupId?: string }) {
  await db.appDmCursor.upsert({
    where: { userId },
    create: { userId, sinceId, ...target },
    update: { sinceId, draftId: target.draftId ?? null, followupId: target.followupId ?? null },
  });
}

async function otherDraft(user: User, draftId: string) {
  const draft = await db.appDmDraft.findUniqueOrThrow({ where: { id: draftId } });
  const form = await getAppFormById(draft.formId);
  await send(user, {
    content: `You have an active draft for ${form?.name.slice(0, 180) || "another application"}. Continue it or pause it before starting another conversation.`,
    components: [activeDraftActions(draft)],
  });
}

async function activateDraft(interaction: ButtonInteraction, formId: string) {
  const user = interaction.user;
  const form = await getAppFormById(formId);
  if (!form) throw new ApplicationError("This form is no longer available.");
  await checkApplicant(form, user.id);
  const cursor = await db.appDmCursor.findUnique({ where: { userId: user.id } });
  let draft = await db.appDmDraft.findUnique({ where: { userId_formId: { userId: user.id, formId } } });
  if (cursor?.draftId && cursor.draftId !== draft?.id) return otherDraft(user, cursor.draftId);
  if (cursor?.followupId) throw new ApplicationError("Send your pending reply before starting an application.");
  if (!draft) {
    const check = await checkUserCanApply(form.guildId, form.id, user.id);
    if (!check.canApply) throw new ApplicationError(check.reason!);
    if (!form.questions.length) throw new ApplicationError("This form has no questions yet.");
    draft = await db.$transaction(async tx => {
      const legacy = await tx.appIntakeSession.findUnique({ where: { userId: user.id, formId } });
      const answers: Answers = {};
      if (legacy) {
        const old: { questionId?: string; value: string }[] = JSON.parse(legacy.answers);
        for (const answer of old) {
          const index = form.questions.findIndex(question => question.id === answer.questionId);
          if (index >= 0) answers[index] = [{ messageId: "", text: answer.value }];
        }
        await tx.appIntakeSession.delete({ where: { id: legacy.id } });
      }
      return tx.appDmDraft.create({ data: {
        userId: user.id, guildId: form.guildId, formId, questions: JSON.stringify(form.questions),
        answers: JSON.stringify(answers), step: Math.max(0, form.questions.findIndex((_, index) => !answers[index]?.length)),
      } });
    });
  }
  const prompt = await showDraft(user, draft);
  if (!cursor?.draftId) await takeCursor(user.id, prompt.id, { draftId: draft.id });
}

async function showDraft(user: User, draft: AppDmDraft, page = 0) {
  const questions = draftQuestions(draft);
  const q = questions[draft.step];
  if (q) {
    const options = readStrings(q.options);
    const prompt = [
      `**Question ${draft.step + 1} of ${questions.length}**`, q.label,
      q.helpText || q.placeholder, options.length ? `Options: ${options.join(", ")}` : "",
      q.type === "YES_NO" ? "Reply with Yes or No." : q.type === "DATE" ? "Use YYYY-MM-DD." : "",
      "Send one or more messages with your answer or attachments, then choose Next question.",
    ].filter(Boolean).join("\n\n");
    const buttons = [draftAction(draft, "next", "Next question", ButtonStyle.Primary)];
    if (!q.required) buttons.push(draftAction(draft, "skip", "Skip question"));
    buttons.push(draftAction(draft, "clear", "Clear answer"), draftAction(draft, "pause", "Pause draft"));
    const parts = splitApplicationText(prompt);
    for (const part of parts.slice(0, -1)) await send(user, { content: part });
    return send(user, { content: parts.at(-1), components: [appRow(...buttons)] });
  }
  const question = questions[page];
  if (!question) throw new ApplicationError("This question is unavailable.");
  const files = await db.appFile.findMany({ where: { draftId: draft.id, position: page }, select: { name: true } });
  const text = answerText(draftAnswers(draft), page);
  const content = [`**Review · Question ${page + 1} of ${questions.length}**`, question.label,
    text || (files.length ? "" : "Skipped"), ...files.map(file => `Attachment: ${file.name}`)].filter(Boolean).join("\n");
  const parts = splitApplicationText(content);
  for (const part of parts.slice(0, -1)) await send(user, { content: part });
  return send(user, { content: parts.at(-1), components: [
    appRow(draftAction(draft, "page", "Previous answer", ButtonStyle.Secondary, page - 1).setDisabled(page === 0),
      draftAction(draft, "page", "Next answer", ButtonStyle.Secondary, page + 1).setDisabled(page + 1 === questions.length),
      draftAction(draft, "edit", "Edit this answer", ButtonStyle.Secondary, page)),
    appRow(draftAction(draft, "submit", "Submit application", ButtonStyle.Success), draftAction(draft, "pause", "Pause draft")),
  ] });
}

function checkAnswer(question: AppQuestion, value: string, attachments: number) {
  if (!value.trim() && !attachments) throw new ApplicationError(question.required ? "Send an answer before continuing." : "Send an answer or choose Skip question.");
  if (question.minLength != null && value.trim().length < question.minLength) throw new ApplicationError(`Enter at least ${question.minLength} characters.`);
  if (question.maxLength != null && value.length > question.maxLength) throw new ApplicationError(`Keep the answer within ${question.maxLength} characters.`);
  const options = readStrings(question.options);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value) : null;
  if ((["MULTIPLE_CHOICE", "DROPDOWN"].includes(question.type) && options.length && !options.includes(value.trim())) ||
      (question.type === "YES_NO" && !/^(yes|no)$/i.test(value.trim())) ||
      (question.type === "NUMBER" && (!value.trim() || !Number.isFinite(Number(value)))) ||
      (question.type === "DATE" && (!date || !Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== value))) {
    throw new ApplicationError(question.validationError || "Send an answer in the requested format.");
  }
  if (question.validationRegex && !new RegExp(question.validationRegex).test(value)) {
    throw new ApplicationError(question.validationError || "This answer does not match the requested format.");
  }
}

async function submitDraft(draft: AppDmDraft, form: Form, member: GuildMember) {
  const questions = draftQuestions(draft);
  const answers = draftAnswers(draft);
  const roles = await reviewerRoles(form.guildId, form.reviewerRoles);
  return serializeApplication(`submit:${form.guildId}`, () => db.$transaction(async tx => {
    const check = await checkUserCanApply(form.guildId, form.id, member.id, tx);
    if (!check.canApply) throw new ApplicationError(check.reason!);
    const { user } = member;
    const app = await createApplicationSubmission(tx, {
      id: draft.id, guildId: form.guildId, formId: form.id, formName: form.name, userId: user.id,
      userTag: user.tag, userAvatar: user.displayAvatarURL(), accountAge: user.createdAt.toISOString().slice(0, 10),
      joinDate: member.joinedAt?.toISOString().slice(0, 10),
      currentRoles: JSON.stringify(member.roles.cache.filter(role => role.id !== form.guildId).map(role => role.name)),
      reviewerRoles: JSON.stringify(roles), reviewChannelId: form.reviewChannelId || form.targetChannelId,
      answers: { create: questions.map((q, position) => ({
        questionId: q.id, questionLabel: q.label, questionType: q.type, position, value: answerText(answers, position),
      })) },
      history: { create: { status: "PENDING", actorId: user.id, actorTag: user.tag, details: "Application submitted" } },
    });
    await tx.appLog.create({ data: { guildId: app.guildId, applicationId: app.id, action: "SUBMITTED",
      executorId: user.id, executorTag: user.tag, details: `Submitted application #${app.appNumber}` } });
    await tx.appFile.updateMany({ where: { draftId: draft.id }, data: { applicationId: app.id, draftId: null } });
    await tx.appDmCursor.delete({ where: { userId: user.id, draftId: draft.id } });
    await tx.appDmDraft.delete({ where: { id: draft.id, revision: draft.revision } });
    return app;
  }));
}

async function changeDraft(interaction: ButtonInteraction, action: string, id: string, revision: number, page: number) {
  const user = interaction.user;
  const draft = await db.appDmDraft.findUnique({ where: { id, userId: user.id } });
  if (!draft) {
    const submitted = await db.application.findUnique({ where: { id, userId: user.id }, select: { appNumber: true } });
    if (submitted) return `Application #${submitted.appNumber} is already submitted.`;
    throw new ApplicationError("This draft is no longer available.");
  }
  const form = await getAppFormById(draft.formId);
  if (!form) {
    await db.appDmCursor.deleteMany({ where: { userId: user.id, draftId: draft.id } });
    throw new ApplicationError("This form is no longer available. Your DM session has been released.");
  }
  const cursor = await db.appDmCursor.findUnique({ where: { userId: user.id } });
  if (action === "pause") {
    if (cursor?.draftId !== draft.id || draft.revision !== revision) throw new ApplicationError("Use the active draft controls to pause.");
    await db.$transaction([
      db.appDmCursor.delete({ where: { userId: user.id, draftId: draft.id } }),
      db.appDmDraft.update({ where: { id: draft.id }, data: { revision: { increment: 1 } } }),
    ]);
    return "Draft paused. Click Apply on its panel to resume.";
  }
  const member = await checkApplicant(form, user.id);
  if (action === "resume") {
    if (cursor?.draftId && cursor.draftId !== draft.id) { await otherDraft(user, cursor.draftId); return; }
    if (cursor?.followupId) throw new ApplicationError("Send your pending reply before resuming the draft.");
    const prompt = await showDraft(user, draft);
    if (!cursor?.draftId) await takeCursor(user.id, prompt.id, { draftId: draft.id });
    return;
  }
  if (cursor?.draftId !== draft.id) throw new ApplicationError("Click Apply again to resume this paused draft.");
  if (draft.revision !== revision) throw new ApplicationError("These controls are from an earlier question. Use the newest prompt.");
  const questions = draftQuestions(draft);
  const q = questions[draft.step];
  if (action === "submit" && !q) {
    const app = await submitDraft(draft, form, member);
    void deliverApplicationSubmission(app.id, member.guild).catch(error => console.error("[Applications] Submission delivery failed", error));
    return `Application #${app.appNumber} submitted.`;
  }
  if (action === "page" && !q) { await showDraft(user, draft, page); return; }
  const answers = draftAnswers(draft);
  const replace = action === "edit" && !q && Boolean(questions[page]);
  const skip = action === "skip" && q && !q.required;
  if (action === "next" && q) {
    const count = await db.appFile.count({ where: { draftId: draft.id, position: draft.step } });
    checkAnswer(q, answerText(answers, draft.step), count);
  } else if (!replace && !skip && !(action === "clear" && q)) {
    throw new ApplicationError("This action is unavailable for the current question.");
  }
  const clearPosition = replace ? page : draft.step;
  const clear = replace || skip || action === "clear";
  if (clear) delete answers[clearPosition];
  const [updated, removed] = await db.$transaction(async tx => {
    const files = clear ? await tx.appFile.findMany({ where: { draftId: draft.id, position: clearPosition } }) : [];
    if (files.length) await tx.appFile.deleteMany({ where: { id: { in: files.map(file => file.id) } } });
    await tx.appDmCursor.update({ where: { userId: user.id, draftId: draft.id }, data: { sinceId: interaction.id } });
    const data = await tx.appDmDraft.update({ where: { id: draft.id, revision }, data: {
      step: replace ? page : action === "clear" ? draft.step : draft.editing ? questions.length : draft.step + 1,
      editing: replace || (action === "clear" && draft.editing),
      answers: JSON.stringify(answers), revision: { increment: 1 },
    } });
    return [data, files] as const;
  });
  await removeApplicationFiles(removed);
  const prompt = await showDraft(user, updated, updated.step >= questions.length ? Math.min(draft.step, questions.length - 1) : 0);
  await db.appDmCursor.update({ where: { userId: user.id, draftId: draft.id }, data: { sinceId: prompt.id } });
}

async function activateReply(interaction: ButtonInteraction, id: string) {
  const user = interaction.user;
  const followup = await db.appFollowup.findUnique({ where: { id }, include: { application: true } });
  if (!followup || followup.application.userId !== user.id || followup.answeredAt) throw new ApplicationError("This reply request is no longer open.");
  const member = await applicationMember(followup.application.guildId, user.id);
  if (!member) throw new ApplicationError("You must be a member of the server to reply.");
  const cursor = await db.appDmCursor.findUnique({ where: { userId: user.id } });
  if (cursor?.draftId) return otherDraft(user, cursor.draftId);
  if (cursor?.followupId && cursor.followupId !== id) throw new ApplicationError("Finish or cancel your current reply first.");
  const prompt = await send(user, {
    content: `**${member.guild.name} · Application #${followup.application.appNumber}**\nSend your reply in a single message. You can include attachments.`,
    components: [appRow(appButton(`app_dm:cancelreply:${id}`, "Cancel reply"))],
  });
  await takeCursor(user.id, prompt.id, { followupId: id });
}

async function processDmMessage(message: Message) {
  const user = message.author;
  const cursor = await db.appDmCursor.findUnique({ where: { userId: user.id } });
  if (!cursor || BigInt(message.id) <= BigInt(cursor.sinceId) || (!message.content.trim() && !message.attachments.size)) return;
  const draft = cursor.draftId ? await db.appDmDraft.findUnique({ where: { id: cursor.draftId } }) : null;
  const followup = cursor.followupId ? await db.appFollowup.findUnique({
    where: { id: cursor.followupId, answeredAt: null }, include: { application: true },
  }) : null;
  if (draft && !draftQuestions(draft)[draft.step]) return;
  if (!draft && (!followup || followup.application.userId !== user.id)) return;
  const guildId = draft?.guildId ?? followup!.application.guildId;
  const member = await applicationMember(guildId, user.id);
  if (!member) throw new ApplicationError("The bot could not verify your server membership. Send your answer again when you have access.");
  const answers = draft ? draftAnswers(draft) : {};
  const entries = draft ? answers[draft.step] ?? [] : [];
  if (entries.some(entry => entry.messageId === message.id)) return;
  const files = await storeApplicationFiles(message.attachments.values()).catch(() => {
    throw new ApplicationError("An attachment could not be saved. Please resend the message.");
  });
  try {
    await db.$transaction(async tx => {
      if (draft) {
        answers[draft.step] = [...entries, { messageId: message.id, text: message.content }];
        await tx.appDmDraft.update({ where: { id: draft.id, revision: draft.revision }, data: { answers: JSON.stringify(answers) } });
        if (files.length) await tx.appFile.createMany({ data: files.map(file => ({ ...file, draftId: draft.id, position: draft.step })) });
      } else if (followup) {
        await tx.appFollowup.update({ where: { id: followup.id, answeredAt: null }, data: { answer: message.content, answeredAt: new Date() } });
        await tx.appDmCursor.delete({ where: { userId: user.id, followupId: followup.id } });
        await tx.appStatusHistory.create({ data: { applicationId: followup.applicationId, actorId: user.id,
          actorTag: user.tag, status: "REPLY_RECEIVED", details: "Applicant replied to a team message." } });
        if (files.length) await tx.appFile.createMany({ data: files.map(file => ({
          ...file, applicationId: followup.applicationId, followupId: followup.id, position: -1,
        })) });
      }
    });
  } catch (error) {
    await removeApplicationFiles(files);
    throw error;
  }
  if (followup) {
    void applicationReplyReceived(followup.applicationId, member.guild).catch(console.error);
    await send(user, { content: `Reply saved to application #${followup.application.appNumber}.` });
  }
}

export async function handleApplicationDmInteraction(interaction: Interaction) {
  if (!interaction.isButton()) return;
  const [kind, action, id, revision, page] = interaction.customId.split(":");
  if (kind !== "app_dm" && kind !== "app_draft") return;
  if (action === "apply" || action === "retry") return offerApplication(interaction, id, action === "apply");
  if (interaction.inGuild() || interaction.channel?.type !== ChannelType.DM) return;
  await interaction.deferUpdate();
  await serializeApplication(`dm:${interaction.user.id}`, async () => {
    if (kind === "app_draft") {
      const result = await changeDraft(interaction, action, id, Number(revision), Number(page));
      if (result) await interaction.followUp({ content: result, allowedMentions: noMentions });
    } else if (action === "start") {
      await activateDraft(interaction, id);
      await interaction.editReply({ components: [] });
    } else if (action === "cancel") {
      await interaction.editReply({ content: "Application invitation cancelled.", components: [] });
    } else if (action === "reply") {
      await activateReply(interaction, id);
    } else if (action === "cancelreply") {
      await db.appDmCursor.deleteMany({ where: { userId: interaction.user.id, followupId: id } });
      await interaction.editReply({ content: "Reply cancelled. You can use Reply again on the team’s message.", components: [] });
    }
  });
}

export function setupApplicationDmMessages(client: Client) {
  client.on("messageCreate", async message => {
    if (message.author.bot || message.channel.type !== ChannelType.DM) return;
    try {
      await serializeApplication(`dm:${message.author.id}`, () => processDmMessage(message));
    } catch (error) {
      console.warn("[Applications] DM intake error:", (error as Error).message);
      await send(message.author, { content: error instanceof ApplicationError
        ? error.message : "Your answer could not be saved. Please resend it." }).catch(() => undefined);
    }
  });
}
