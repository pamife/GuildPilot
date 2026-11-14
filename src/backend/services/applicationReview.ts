import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, DiscordAPIError,
  Guild, GuildMember, OverwriteType, PermissionFlagsBits, RESTJSONErrorCodes, TextChannel,
} from "discord.js";
import { createHash } from "node:crypto";
import { applicationMessage, applicationMessageEdit } from "../bot/applicationComponents";
import { discordClient } from "../bot/client";
import { createApplicationTicket, postApplicationTicketWelcome } from "../bot/ticketHandler";
import { broadcastApplicationEvent } from "../socket/socketManager";
import { generateApplicationHtmlTranscript } from "./transcriptService";
import { getOpenApplicationTickets } from "./ticketService";
import { applicationDb as db, applicationMember, canReview, readStrings, reviewerRoles, serializeApplication } from "./applicationAccess";
import {
  ApplicationExecutor, decisionStatuses, getApplicationById, handleRoleAssignments, updateApplicationStatus,
} from "./applicationService";

export type ReviewedApplication = NonNullable<Awaited<ReturnType<typeof getApplicationById>>>;
export const appName = (app: ReviewedApplication) => app.formName || app.form?.name || "Application";
export const finalDecision = (app: ReviewedApplication) => Boolean(app.decidedAt || decisionStatuses.includes(app.status));
export const appButton = (id: string, label: string, style = ButtonStyle.Secondary) =>
  new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
export const appRow = (...buttons: ButtonBuilder[]) => new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

export class ApplicationError extends Error {
  constructor(message: string, readonly statusCode = 400) { super(message); }
}

export function splitApplicationText(text: string, limit = 1800): string[] {
  const parts: string[] = [];
  while (text.length > limit) {
    let end = text.lastIndexOf("\n", limit);
    if (end < limit / 2) end = limit;
    if (/[\uD800-\uDBFF]/.test(text[end - 1])) end--;
    parts.push(text.slice(0, end));
    text = text.slice(end);
  }
  if (text) parts.push(text);
  return parts;
}

export function unknownDiscordMessage(error: unknown) {
  return error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownMessage;
}

export function applicationFileUrl(app: ReviewedApplication, fileId: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || (process.env.DISCORD_REDIRECT_URI
    ? new URL(process.env.DISCORD_REDIRECT_URI).origin : "http://localhost:3001");
  return `${base.replace(/\/$/, "")}/api/guilds/${app.guildId}/applications/apps/${app.id}/files/${fileId}`;
}

export async function privateReviewChannel(guild: Guild, channelId: string, allowedRoleIds: string[]) {
  const [channel, roles, bot] = await Promise.all([
    guild.channels.fetch(channelId, { force: true }),
    guild.roles.fetch(),
    guild.members.fetchMe(),
  ]);
  if (channel?.type !== ChannelType.GuildText) throw new ApplicationError("Select a private server text channel for reviews.");
  const permissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory];
  if (!channel.permissionsFor(bot).has(permissions)) {
    throw new ApplicationError("The bot needs View Channel, Send Messages and Read Message History in the review channel.");
  }
  if (!channel.permissionOverwrites.cache.get(guild.id)?.deny.has(PermissionFlagsBits.ViewChannel)) {
    throw new ApplicationError("Deny View Channel for @everyone in the review channel.");
  }
  for (const overwrite of channel.permissionOverwrites.cache.values()) {
    if (overwrite.id === bot.id || !overwrite.allow.has(PermissionFlagsBits.ViewChannel)) continue;
    const role = roles.get(overwrite.id);
    const trusted = overwrite.type === OverwriteType.Role &&
      (allowedRoleIds.includes(overwrite.id) || role?.permissions.has(PermissionFlagsBits.ManageGuild) ||
        (role?.managed && role.tags?.botId === bot.id));
    if (!trusted) throw new ApplicationError("Only reviewer roles, server managers and the bot may have explicit access to the review channel.");
  }
  return channel;
}

export async function requireApplicationReviewer(guildId: string, id: string, userId: string) {
  const app = await getApplicationById(id);
  if (!app || app.guildId !== guildId) throw new ApplicationError("Application not found.", 404);
  const member = await applicationMember(guildId, userId);
  if (!member || !await canReview(member, app)) throw new ApplicationError("You do not have access to this application.", 403);
  return { app, member };
}

type Delivery = Record<string, { ok: boolean; at: string; error?: string }>;
function delivery(app: ReviewedApplication): Delivery { return JSON.parse(app.delivery); }

async function markDelivery(id: string, channel: string, ok: boolean, error?: string) {
  const app = await db.application.findUniqueOrThrow({ where: { id }, select: { delivery: true } });
  const data: Delivery = JSON.parse(app.delivery);
  data[channel] = { ok, at: new Date().toISOString(), error };
  await db.application.update({ where: { id }, data: { delivery: JSON.stringify(data) } });
}

async function deliver(id: string, channel: string, action: () => Promise<unknown>, error: string) {
  try {
    await action();
  } catch (cause) {
    const message = cause instanceof ApplicationError ? cause.message : error;
    console.warn(`[Applications] ${channel} delivery failed for ${id}:`, cause instanceof DiscordAPIError ? cause.code : (cause as Error).name);
    await markDelivery(id, channel, false, message);
    return message;
  }
  await markDelivery(id, channel, true);
}

function messageNonce(key: string) {
  return { nonce: createHash("sha256").update(key).digest("hex").slice(0, 24), enforceNonce: true };
}

export function reviewControls(app: ReviewedApplication) {
  const button = (action: string, title: string, style?: ButtonStyle) => appButton(`app_review:${action}:${app.id}`, title, style);
  const decided = finalDecision(app) || app.status === "CLOSED";
  return [appRow(button("dm", "Send DM"), button("accept", "Accept", ButtonStyle.Success).setDisabled(decided),
    button("deny", "Decline", ButtonStyle.Danger).setDisabled(decided),
    button("progress", "Update status"), button("ticket", "Open ticket"))];
}

function reviewHeader(app: ReviewedApplication, showDelivery = true) {
  const failed = Object.entries(delivery(app)).filter(([key, state]) => !state.ok && key !== "Review channel");
  const fields = [
    `**Application #${app.appNumber} · ${appName(app).slice(0, 180)}**`,
    `Applicant: ${app.userTag} (${app.userId})\nID: \`${app.id}\``,
    `**${app.status}**${app.progressStep ? ` · ${app.progressStep} · ${app.progressPercent}%` : ""}`,
    app.decidedAt ? `Decided by ${app.decisionByTag} · <t:${Math.floor(app.decidedAt.getTime() / 1000)}:f>` : "",
    app.decisionReason ? `Reason: ${app.decisionReason.slice(0, 700)}` : "",
    app.channelId ? `Linked channel: <#${app.channelId}>` : "",
    showDelivery && failed.length ? `Delivery failed: ${failed.map(([key]) => key).join(", ")}` : "",
    app.followups.length ? `Follow-ups: ${app.followups.filter(f => f.answeredAt).length} answered / ${app.followups.length} requested` : "",
  ];
  return fields.filter(Boolean).join("\n");
}

function reviewParts(app: ReviewedApplication) {
  const textParts = (text: string) => splitApplicationText(text).map(body => ({ body, rows: [] }));
  const fileLinks = (files: ReviewedApplication["files"]) => files.map(file => {
    const url = applicationFileUrl(app, file.id);
    return url.length <= 512 ? {
      body: file.name,
      rows: [appRow(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Download attachment").setURL(url))],
    } : { body: `${file.name} · <${url}>`, rows: [] };
  });
  const answers = app.answers.flatMap((answer, index) => {
    const files = app.files.filter(file => !file.followupId && file.position === (answer.position ?? index));
    const text = `**Question ${index + 1} — ${answer.questionLabel}**\n${answer.value || (files.length ? "" : "Skipped")}`;
    return [...textParts(text), ...fileLinks(files)];
  });
  const replies = app.followups.filter(followup => followup.answeredAt)
    .sort((a, b) => a.answeredAt!.getTime() - b.answeredAt!.getTime())
    .flatMap(followup => [
      ...textParts(`**Applicant reply**\nQuestion: ${followup.question}\n${followup.answer || ""}`),
      ...fileLinks(app.files.filter(file => file.followupId === followup.id)),
    ]);
  return [...answers, ...replies];
}

async function postReview(app: ReviewedApplication, guild: Guild, retry: boolean) {
  const targetId = app.form?.reviewChannelId || app.form?.targetChannelId || app.reviewChannelId;
  if (!targetId) return "Configure a private review channel for this form.";
  return deliver(app.id, "Review channel", async () => {
    const channelId = app.reviewChannelId && app.reviewMessageId ? app.reviewChannelId : targetId;
    const allowed = app.form || app.reviewerRoles == null
      ? await reviewerRoles(app.guildId, app.form?.reviewerRoles) : readStrings(app.reviewerRoles);
    let channel = await privateReviewChannel(guild, channelId, allowed).catch(error => {
      if (!retry || channelId === targetId) throw error;
      return privateReviewChannel(guild, targetId, allowed);
    });
    let messageId = app.reviewMessageId;
    let posted = app.reviewParts;
    const header = reviewHeader(app);
    const controls = reviewControls(app);
    if (messageId && channel.id !== channelId) messageId = null;
    if (messageId) {
      try {
        await channel.messages.edit(messageId, applicationMessageEdit(channel.messages, header, controls));
      } catch (error) {
        if (!unknownDiscordMessage(error)) throw error;
        messageId = null;
      }
    }
    if (!messageId) {
      if (app.reviewMessageId && !retry) throw new ApplicationError("Review message was deleted. Retry delivery from the web panel.");
      if (channelId !== targetId) channel = await privateReviewChannel(guild, targetId, allowed);
      const message = await channel.send({ ...applicationMessage(header, controls), ...messageNonce(`${app.id}:review:${app.reviewMessageId ?? "new"}:${channel.id}`) });
      messageId = message.id;
      posted = 0;
      await db.application.update({ where: { id: app.id }, data: {
        reviewChannelId: channel.id, reviewMessageId: messageId, reviewParts: 0,
      } });
    }
    const parts = reviewParts(app);
    for (let index = posted; index < parts.length; index++) {
      await channel.send({
        ...applicationMessage(`### Application #${app.appNumber} · Part ${index + 1}\n${parts[index].body}`, parts[index].rows),
        ...messageNonce(`${messageId}:part:${index}`),
      });
      await db.application.update({ where: { id: app.id }, data: { reviewParts: index + 1 } });
    }
  }, "Could not post or update the review messages. Check the review channel and retry delivery.");
}

async function refreshReview(appId: string, guild: Guild, retry = false) {
  const app = (await getApplicationById(appId))!;
  if (!app.formName && !app.reviewChannelId && !app.form?.reviewChannelId && !retry) return;
  const warning = await postReview(app, guild, retry);
  if (warning && delivery((await getApplicationById(appId))!)["Review channel"]?.error !== warning) {
    await markDelivery(appId, "Review channel", false, warning);
  }
  return warning;
}

export async function deliverApplicationSubmission(id: string, guild: Guild) {
  await serializeApplication(`review:${id}`, async () => {
    const app = (await getApplicationById(id))!;
    broadcastApplicationEvent(guild.id, "applicationSubmitted");
    await deliver(id, "Submission DM", async () => {
      const user = await discordClient.users.fetch(app.userId);
      await user.send({
        ...applicationMessage(`## ${guild.name} · Application #${app.appNumber}\nYour application is with the server team. I’ll message you here when there’s an update.`),
        ...messageNonce(`${id}:submitted`),
      });
    }, "Could not deliver the submission confirmation.");
    await refreshReview(id, guild, true);
    broadcastApplicationEvent(guild.id, "applicationUpdated");
  });
}

function validatedText(value: unknown, max: number, required = false) {
  if (value == null && !required) return "";
  if (typeof value !== "string" || value.trim().length > max || (required && !value.trim())) {
    throw new ApplicationError(`Enter ${required ? "1–" : "up to "}${max} characters.`);
  }
  return value.trim();
}

export const applicationStatuses: Record<string, string> = {
  claim: "CLAIMED", unclaim: "UNCLAIMED", accept: "ACCEPTED", deny: "DENIED",
  waitlist: "WAITLISTED", reopen: "PENDING", close: "CLOSED", request_info: "UNDER_REVIEW",
};

export async function runApplicationReview(guildId: string, appId: string, userId: string, input: {
  action: string; reason?: unknown; message?: unknown; replyRequested?: unknown; step?: unknown; percent?: unknown;
}, interactionChannelId?: string) {
  return serializeApplication(`review:${appId}`, async () => {
    const { app, member } = await requireApplicationReviewer(guildId, appId, userId);
    if (interactionChannelId && ![app.reviewChannelId, app.channelId, app.form?.targetChannelId].includes(interactionChannelId)) {
      throw new ApplicationError("This application is associated with a different channel.", 403);
    }
    const executor = { id: member.id, tag: member.user.tag, avatar: member.user.displayAvatarURL() };
    const guild = member.guild;
    const header = `${guild.name} · Application #${app.appNumber}`;
    const user = () => discordClient.users.fetch(app.userId);
    const warnings: string[] = [];
    const warn = (warning?: string) => { if (warning) warnings.push(warning); };
    let ticketUrl: string | undefined;

    if (input.action === "dm") {
      const body = validatedText(input.message, 1500, true);
      const followup = input.replyRequested === true ? await db.appFollowup.create({ data: {
        applicationId: app.id, question: body, requestedBy: member.id,
      } }) : undefined;
      warn(await deliver(app.id, "Team DM", async () => {
        await (await user()).send(applicationMessage(`## ${header}\n\n${body}`,
          followup ? [appRow(appButton(`app_dm:reply:${followup.id}`, "Reply", ButtonStyle.Primary))] : [],
        ));
      }, "Could not deliver the team’s DM."));
      if (followup && warnings.length) await db.appFollowup.delete({ where: { id: followup.id } });
      await recordReviewHistory(app, executor, warnings.length ? "DM_FAILED" : "DM_SENT", body);
    } else if (input.action === "progress") {
      const step = validatedText(input.step, 100, true);
      const percent = typeof input.percent === "number" ? input.percent
        : typeof input.percent === "string" && /^\d{1,3}$/.test(input.percent.trim()) ? Number(input.percent) : NaN;
      if (!Number.isInteger(percent) || percent < 0 || percent > 100) throw new ApplicationError("Enter a whole percentage from 0 to 100.");
      const steps = readStrings(app.form?.statusSteps);
      if (steps.length && !steps.includes(step)) throw new ApplicationError("Select a configured status step.");
      await db.application.update({ where: { id: app.id }, data: {
        progressStep: step, progressPercent: percent, history: { create: {
          status: "PROGRESS", actorId: executor.id, actorTag: executor.tag, details: `${step} · ${percent}%`,
        } },
      } });
      warn(await deliver(app.id, "Status DM", async () => {
        const dm = await (await user()).createDM();
        const body = `## ${header}\n${step} · ${percent}%`;
        if (app.statusDmId) {
          try {
            await dm.messages.edit(app.statusDmId, applicationMessageEdit(dm.messages, body));
            return;
          } catch (error) {
            if (!(error instanceof DiscordAPIError)) throw error;
          }
        }
        const message = await dm.send(applicationMessage(body));
        await db.application.update({ where: { id: app.id }, data: { statusDmId: message.id } });
      }, "Status saved. Discord could not deliver the DM."));
    } else if (input.action === "ticket") {
      const ticket = await openApplicationTicket(app, member);
      ticketUrl = ticket.channel.url;
      warn(ticket.warning);
      if (ticket.created || !delivery(app)["Ticket DM"]?.ok || app.channelId !== ticket.channel.id) {
        warn(await deliver(app.id, "Ticket DM", async () => {
          await (await user()).send(applicationMessage(`## ${header}\nYour private ticket is open.`, [
            appRow(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Open ticket").setURL(ticketUrl!)),
          ]));
        }, "The ticket is open. Discord could not send the applicant its link."));
      }
      if (ticket.created) await recordReviewHistory(app, executor, "TICKET_OPENED", `Ticket #${ticket.number}`);
    } else if (input.action === "transcript" || input.action === "close") {
      await saveApplicationTranscript(app, guild);
      if (input.action === "close") await updateApplicationStatus(app.id, "CLOSED", executor, validatedText(input.reason, 1500));
    } else if (input.action !== "retry_review" && Object.hasOwn(applicationStatuses, input.action)) {
      const reason = validatedText(input.reason, 1500);
      const status = applicationStatuses[input.action];
      const updated = await updateApplicationStatus(app.id, status, executor, reason);
      if (decisionStatuses.includes(status)) {
        warn(await deliver(app.id, "Role assignment", () => handleRoleAssignments(updated), "Could not assign all configured roles."));
      }
      if (decisionStatuses.includes(status) || status === "WAITLISTED") {
        const template = status === "ACCEPTED" ? app.form?.acceptMessage : status === "DENIED" ? app.form?.denyMessage : app.form?.waitlistMessage;
        const values: Record<string, string> = {
          user: app.userTag, user_id: app.userId, username: app.userTag, form_name: appName(app),
          app_number: String(app.appNumber), reason,
        };
        const custom = template?.replace(/\{(\w+)\}/g, (token, key: string) => values[key] ?? token).slice(0, 250);
        const message = `${header}\nYour application was ${status === "WAITLISTED" ? "placed on the waitlist" : status === "ACCEPTED" ? "accepted" : "declined"}.`
          + (custom ? `\n${custom}` : "") + (reason ? `\n\nReason: ${reason}` : "");
        warn(await deliver(app.id, "Decision DM", async () => {
          await (await user()).send(applicationMessage(`## ${message}`));
        }, "Decision saved. Discord could not deliver the DM."));
      }
    } else if (input.action !== "retry_review") {
      throw new ApplicationError("Unknown review action.");
    }
    warn(await refreshReview(app.id, guild, input.action === "retry_review"));
    broadcastApplicationEvent(guildId, "applicationUpdated");
    return { warnings, ticketUrl, application: await getApplicationById(app.id) };
  });
}

async function saveApplicationTranscript(app: ReviewedApplication, guild: Guild) {
  const channel = app.channelId ? await guild.channels.fetch(app.channelId).catch(() => null) : null;
  await generateApplicationHtmlTranscript(app, channel?.type === ChannelType.GuildText ? channel : null);
  await db.application.update({ where: { id: app.id }, data: {
    transcriptUrl: `/api/guilds/${app.guildId}/applications/transcripts/${app.id}/download`,
  } });
}

async function openApplicationTicket(app: ReviewedApplication, member: GuildMember) {
  const guild = member.guild;
  let channel: TextChannel | undefined;
  const tickets = await getOpenApplicationTickets(guild.id, app.id);
  let ticket = tickets[0];
  let created = false;
  for (const candidate of tickets) {
    const found = await guild.channels.fetch(candidate.channelId, { force: true }).catch(error => {
      if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownChannel) return null;
      throw error;
    });
    if (found?.type !== ChannelType.GuildText) continue;
    channel = found;
    ticket = candidate;
    break;
  }
  if (!channel) {
    const categoryId = app.form?.ticketCategoryId;
    if (!categoryId) throw new ApplicationError("Configure a ticket category for this form.");
    const applicant = await applicationMember(guild.id, app.userId);
    if (!applicant) throw new ApplicationError("The applicant is no longer a member of this server.");
    const roles = app.form ? await reviewerRoles(guild.id, app.form.reviewerRoles) : readStrings(app.reviewerRoles);
    const result = await createApplicationTicket(guild, applicant.user, app, categoryId, roles);
    channel = result.ticketChannel;
    ticket = result.ticket;
    created = true;
  }
  await db.application.update({ where: { id: app.id }, data: { channelId: channel.id } });
  const ticketChannel = channel;
  const warning = created || !delivery(app)["Ticket welcome"]?.ok || app.channelId !== channel.id
    ? await deliver(app.id, "Ticket welcome",
      () => postApplicationTicketWelcome(ticketChannel, ticket.id, app.userId, app.appNumber),
      "The ticket is open. Its welcome message could not be posted.")
    : undefined;
  return { channel, warning, created, number: ticket.ticketNumber };
}

export async function recordReviewHistory(app: ReviewedApplication, executor: ApplicationExecutor, status: string, details: string) {
  await db.appStatusHistory.create({ data: {
    applicationId: app.id, actorId: executor.id, actorTag: executor.tag, status, details,
  } });
}

export async function applicationReplyReceived(appId: string, guild: Guild) {
  await serializeApplication(`review:${appId}`, async () => {
    await refreshReview(appId, guild);
    broadcastApplicationEvent(guild.id, "applicationUpdated");
  });
}
