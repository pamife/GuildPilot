import assert from "node:assert/strict";
import { mkdtempSync, openSync, closeSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { ChannelType, Collection, ComponentType, MessageFlags, PermissionsBitField } from "discord.js";

const directory = process.env.APPLICATION_TEST_DIR;
const guildId = "200000000000000001";
const userId = "200000000000000002";
const reviewerId = "200000000000000003";
const reviewerRole = "200000000000000004";
const reviewChannelId = "200000000000000005";
const ticketCategoryId = "200000000000000006";
const startChannelId = "200000000000000007";
const applicantDms: any[] = [];
const reviewMessages = new Map<string, any>();
const tickets = new Map<string, any>();
let sequence = 210000000000000000n;
const nextId = () => String(++sequence);
let dmsClosed = false;
let editFails = false;
let reviewFails = false;
let assigned = 0;
let ticketMentions = 0;

function apply(id: string, action = "apply", guild = true, messageId = "") {
  const replies: any[] = [];
  const edits: any[] = [];
  return {
    customId: `app_dm:${action}:${id}`, id: nextId(), user: applicant, message: { id: messageId },
    guildId: guild ? guildId : null, inGuild: () => guild, isButton: () => true, webhook: {},
    channel: { type: ChannelType.DM }, deferReply: async () => {}, deferUpdate: async () => {},
    editReply: async (value: any) => {
      const edited = serializeEdit(value);
      edits.push(edited);
      const original = !guild && applicantDms.find(message => message.id === messageId);
      if (original) Object.assign(original, edited);
      replies.push(edited);
    },
    followUp: async (value: any) => { replies.push(value); },
    replies, edits,
  };
}

const applicant: any = {
  id: userId, username: "candidate", tag: "candidate", createdAt: new Date(),
  displayAvatarURL: () => "", send: async (payload: any) => {
    if (dmsClosed) throw new Error("DM disabled");
    const message = { ...payload, id: nextId() };
    applicantDms.push(message);
    return message;
  },
  createDM: async () => ({
    send: applicant.send,
    messages: { edit: async (id: string, payload: any) => {
      if (editFails) {
        const { DiscordAPIError } = await import("discord.js");
        throw new DiscordAPIError({ message: "Unknown Message", code: 10008 }, 10008, 404, "PATCH", "", {});
      }
      Object.assign(applicantDms.find(message => message.id === id), serializeEdit(payload));
    } },
  }),
};

const roles = new Collection<string, any>([[reviewerRole, { permissions: new PermissionsBitField() }]]);
const channels = new Map<string, any>();
const members = new Map<string, any>();
const bot = { id: "200000000000000008" };
const guild: any = {
  id: guildId, name: "Application test guild", available: true,
  roles: { everyone: { id: guildId }, fetch: async () => roles },
  members: { fetch: async ({ user }: any) => {
    const member = members.get(user);
    if (!member) throw new Error("Not a member");
    return member;
  }, fetchMe: async () => bot },
  client: { user: bot },
  channels: {
    fetch: async (id: string) => channels.get(id) ?? tickets.get(id),
    create: async () => {
      const id = nextId();
      const entries = new Collection();
      const channel = { id, type: ChannelType.GuildText, url: `https://discord.com/channels/${guildId}/${id}`, client: { user: bot },
        messages: { fetch: async () => entries }, send: async (message: any) => {
          ticketMentions++;
          assert.deepEqual(message.allowedMentions, { parse: [], users: [userId] });
          assertV2(message);
          assert.match(messageText(message), new RegExp(`<@${userId}>`));
          const deserialize = (entry: any): any => ({
            ...entry, customId: entry.custom_id, components: entry.components?.map(deserialize),
          });
          entries.set(nextId(), { author: bot, components: message.components.map((row: any) => deserialize(row.toJSON())) });
        } };
      tickets.set(id, channel);
      return channel;
    },
  },
};

function serializeEdit(payload: any) {
  payload.target.client ??= { options: {} };
  const { body } = payload.resolveBody();
  assert.equal(body.content, null);
  assert.deepEqual(body.embeds, []);
  return { ...body, allowedMentions: payload.options.allowedMentions, components: payload.options.components };
}

function assertV2(message: any) {
  assert.ok(message.flags & MessageFlags.IsComponentsV2);
  assert.ok(message.content == null);
  assert.ok(!message.embeds?.length);
  assert.equal(message.components[0].toJSON().type, ComponentType.Container);
}

function componentList(message: any): any[] {
  const flatten = (entry: any): any[] => [entry, ...(entry.components || []).flatMap(flatten)];
  return message.components.flatMap((component: any) => flatten(component.toJSON()));
}

function messageText(message: any) {
  assertV2(message);
  return componentList(message).filter((entry: any) => entry.type === ComponentType.TextDisplay)
    .map((entry: any) => entry.content).join("\n");
}

function button(message: any, label: string) {
  const item = componentList(message).find((component: any) => component.label === label);
  assert.ok(item, `missing ${label}`);
  return item.custom_id;
}

async function exercise(phase: string) {
  const { discordClient } = await import("../src/backend/bot/client");
  const { applicationDb: db } = await import("../src/backend/services/applicationAccess");
  const { handleApplicationDmInteraction: click, setupApplicationDmMessages, deployApplicationDmPanel } = await import("../src/backend/bot/applicationDm");
  const { deployApplicationPanel, setupApplicationInteractions } = await import("../src/backend/bot/applicationHandler");
  const { runApplicationReview } = await import("../src/backend/services/applicationReview");
  const { applicationFilePath } = await import("../src/backend/services/applicationFiles");
  const { getApplicationById } = await import("../src/backend/services/applicationService");
  const { default: router } = await import("../src/backend/routes/applications");
  const { restrictApplicationSession } = await import("../src/backend/middleware/authMiddleware");
  const { initSocketIO } = await import("../src/backend/socket/socketManager");

  discordClient.guilds.cache.set(guildId, guild);
  discordClient.users.fetch = (async () => applicant) as typeof discordClient.users.fetch;
  members.set(userId, { id: userId, guild, user: applicant, permissions: new PermissionsBitField(),
    roles: { cache: new Collection(), add: async () => { assigned++; } } });
  const reviewerUser = { id: reviewerId, tag: "reviewer", displayAvatarURL: () => "" };
  members.set(reviewerId, { id: reviewerId, guild, user: reviewerUser, permissions: new PermissionsBitField(), roles: { cache: roles } });
  channels.set(ticketCategoryId, { id: ticketCategoryId, type: ChannelType.GuildCategory });
  channels.set(reviewChannelId, { id: reviewChannelId, type: ChannelType.GuildText,
    permissionOverwrites: { cache: new Collection([[guildId, {
      id: guildId, allow: new PermissionsBitField(), deny: new PermissionsBitField(PermissionsBitField.Flags.ViewChannel),
    }]]) },
    permissionsFor: (subject: any) => new PermissionsBitField(subject.id === guildId ? 0n : PermissionsBitField.Flags.Administrator),
    send: async (payload: any) => {
      if (reviewFails) throw new Error("Channel unavailable");
      const message = { ...payload, id: nextId() };
      reviewMessages.set(message.id, message);
      return message;
    }, messages: { edit: async (id: string, payload: any) => Object.assign(reviewMessages.get(id)!, serializeEdit(payload)) },
  });
  channels.set(startChannelId, { id: startChannelId, type: ChannelType.GuildText, send: async (payload: any) => {
    assert.equal(payload.flags, 32768);
    assert.equal(payload.components[0].toJSON().components[1].components[0].label, "Apply");
    return { id: nextId() };
  } });
  global.fetch = async () => new Response("file");
  const intake = new (await import("discord.js")).Client({ intents: [] });
  setupApplicationDmMessages(intake);
  const onMessage = intake.listeners("messageCreate")[0];

  const sendMessage = async (content: string, ids: string[] = []) => {
    const attachments = new Collection(ids.map(id => [id, { id, name: `${id}.png`, size: 4, url: `https://cdn.discordapp.com/attachments/test/${id}` }]));
    await onMessage({ content, id: nextId(), author: applicant, channel: { type: ChannelType.DM }, attachments });
  };
  const press = async (label: string, message = applicantDms.at(-1)) => {
    const interaction = apply("", "start", false, message.id);
    interaction.customId = button(message, label);
    await click(interaction as any);
    return interaction;
  };

  if (phase === "before") {
    const legacy = await getApplicationById("legacy-app");
    assert.equal(legacy?.form?.name, "Legacy form");
    assert.equal(legacy?.answers[0].value, "Existing response");
    const form = await db.appForm.create({ data: {
      id: "original", name: "Existing form", guildId, cooldownHours: 0, dmPanelChannelId: startChannelId,
      reviewerRoles: JSON.stringify([reviewerRole]), reviewChannelId, statusSteps: '["Interview scheduled"]',
      ticketCategoryId, acceptedRoles: JSON.stringify([reviewerRole]),
      questions: { create: [{ id: "original-question", label: "First question", order: 0 }, { label: "Optional question", order: 1, required: false }] },
    } });
    const panelId = await deployApplicationDmPanel(form.id);
    const legacyPanel = await db.appPanel.create({ data: {
      guildId, channelId: startChannelId, messageId: "legacy-message", name: "Legacy start panel",
      embedTitle: "Application choices", embedDescription: "Pick a form", thumbnail: "https://cdn.discordapp.com/example.png",
    } });
    await db.appForm.update({ where: { id: form.id }, data: { panelId: legacyPanel.id } });
    const existingMessage = { id: legacyPanel.messageId, edit: async (payload: any) => {
      const message = serializeEdit(payload);
      assert.match(messageText(message), /Application choices/);
      assert.ok(componentList(message).some(item => item.type === ComponentType.StringSelect));
      return existingMessage;
    } };
    const channel = channels.get(startChannelId);
    Object.assign(channel, { guildId, isDMBased: () => false, isSendable: () => true, messages: { fetch: async () => existingMessage } });
    discordClient.channels.fetch = (async () => channel) as typeof discordClient.channels.fetch;
    assert.equal(await deployApplicationPanel(discordClient, legacyPanel.id), existingMessage.id);
    dmsClosed = true;
    const blocked = apply(form.id, "apply", true, panelId);
    await click(blocked as any);
    assert.match(messageText(blocked.replies[0]), /could not deliver/);
    assert.equal(button(blocked.replies[0], "Try again"), "app_dm:retry:original");
    assert.equal(await db.appDmDraft.count(), 0);
    dmsClosed = false;
    await click(apply(form.id, "retry") as any);
    await press("Start application");
    assert.match(messageText(applicantDms.at(-1)), /Question 1 of 2/);
    await sendMessage("A".repeat(2000), [nextId(), nextId()]);
    await sendMessage("B".repeat(2000), [nextId()]);
    assert.equal(await db.appFile.count(), 3);
    await db.appQuestion.update({ where: { id: "original-question" }, data: { label: "Edited after start", order: 2 } });
    await db.$disconnect();
    return;
  }

  sequence += 10000n;
  const draft = await db.appDmDraft.findFirstOrThrow();
  assert.match(draft.questions, /First question/);
  assert.doesNotMatch(draft.questions, /Edited after start/);
  const clickDraft = async (action: string, revision: number, page?: number) => {
    const interaction = apply("", "start", false);
    interaction.customId = `app_draft:${action}:${draft.id}:${revision}${page === undefined ? "" : `:${page}`}`;
    return click(interaction as any);
  };

  const another = await db.appForm.create({ data: { name: "Other form", guildId, questions: { create: { label: "Other question" } } } });
  await click(apply(another.id, "start", false) as any);
  assert.equal(button(applicantDms.at(-1), "Continue draft"), `app_draft:resume:${draft.id}:0`);
  await clickDraft("pause", 0);
  await click(apply(another.id, "start", false) as any);
  await press("Pause draft");
  await clickDraft("resume", 1);
  await sendMessage("After restart");
  await press("Next question");
  await press("Skip question");
  assert.match(messageText(applicantDms.at(-1)), /Review · Question 2 of 2/);
  await press("Edit this answer");
  await sendMessage("An optional answer");
  await press("Next question");
  reviewFails = true;
  const submit = applicantDms.at(-1);
  const submitId = button(submit, "Submit application");
  const submitClick = async () => {
    const interaction = apply("", "start", false, submit.id);
    interaction.customId = submitId;
    await click(interaction as any);
    return interaction;
  };
  await db.appForm.update({ where: { id: draft.formId }, data: { isOpen: false } });
  await assert.rejects(submitClick(), /currently closed/);
  assert.equal(button(submit, "Submit application"), submitId);
  await db.appForm.update({ where: { id: draft.formId }, data: { isOpen: true } });
  const clicks = await Promise.all(Array.from({ length: 10 }, submitClick));
  assert.equal(clicks.flatMap(interaction => interaction.edits).length, 1);
  assert.equal(clicks.flatMap(interaction => interaction.replies).length, 1);
  assert.match(messageText(submit), /submitted/);
  assert.ok(!componentList(submit).some(component => component.type === ComponentType.Button));
  const lateClick = await submitClick();
  assert.equal(lateClick.replies.length, lateClick.edits.length);
  const app = await db.application.findUniqueOrThrow({ where: { id: draft.id } });
  assert.equal(await db.application.count({ where: { id: app.id } }), 1);
  assert.equal(await db.appDmDraft.count({ where: { id: draft.id } }), 0);
  const review = (action: string, values = {}) => runApplicationReview(guildId, app.id, reviewerId, { action, ...values });
  for (let attempt = 0; attempt < 40; attempt++) {
    const stored = (await getApplicationById(app.id))!;
    if (JSON.parse(stored.delivery)["Review channel"]) break;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.equal(JSON.parse((await getApplicationById(app.id))!.delivery)["Review channel"].ok, false);
  assert.equal(applicantDms.filter(message => messageText(message).includes("I’ll message you here")).length, 1);
  reviewFails = false;
  await review("retry_review");
  const initial = (await getApplicationById(app.id))!;
  assert.equal(initial.answers[0].questionLabel, "First question");
  assert.match(initial.answers[0].value, /After restart/);
  assert.equal(initial.answers[1].value, "An optional answer");
  assert.equal(initial.files.length, 3);
  assert.ok(reviewMessages.size >= 8);
  assert.ok([...reviewMessages.values()].every(message => messageText(message).length <= 2000 && !message.allowedMentions.parse.length));
  const downloads = [...reviewMessages.values()].flatMap(componentList).filter(entry => entry.label === "Download attachment");
  assert.equal(downloads.length, 3);
  assert.ok(downloads.every(entry => initial.files.some(file => entry.url.endsWith(`/files/${file.id}`))));
  const fs = await import("node:fs/promises");
  assert.equal(await fs.readFile(applicationFilePath(initial.files[0].id), "utf8"), "file");
  const controlId = initial.reviewMessageId;
  const interactions = new (await import("discord.js")).Client({ intents: [] });
  setupApplicationInteractions(interactions);
  const onInteraction = interactions.listeners("interactionCreate")[0];
  for (const [action, expected] of [["dm", ComponentType.Checkbox], ["accept", ComponentType.TextInput], ["progress", ComponentType.StringSelect]]) {
    let modal: any;
    await onInteraction({
      customId: `app_review:${action}:${app.id}`, guildId, channelId: reviewChannelId,
      user: reviewerUser, inGuild: () => true, isButton: () => true, isStringSelectMenu: () => false,
      showModal: async (builder: any) => { modal = builder.toJSON(); },
    });
    assert.ok(modal.components.every((entry: any) => entry.type === ComponentType.Label));
    assert.ok(modal.components.some((entry: any) => entry.component.type === expected));
  }
  const decisions = await Promise.allSettled([review("accept", { reason: "Welcome" }), review("deny")]);
  assert.equal(decisions.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(assigned, 1);

  const express = (await import("express")).default;
  const { createServer } = await import("node:http");
  const jwt = (await import("jsonwebtoken")).default;
  const { io } = await import("socket.io-client");
  process.env.JWT_SECRET = "application-local-test";
  const token = jwt.sign({ id: reviewerId, username: "reviewer", scope: "applications" }, process.env.JWT_SECRET);
  const web = express();
  web.use(restrictApplicationSession, express.json());
  web.use("/api/guilds", router);
  const http = createServer(web);
  const socketServer = initSocketIO(http);
  await new Promise<void>(resolve => http.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(http.address() as any).port}`;
  const request = (path: string, init: RequestInit = {}) => nativeFetch(url + path, { ...init, headers: {
    "Authorization": `Bearer ${token}`, "Content-Type": "application/json", ...init.headers,
  } });
  const socket = io(url, { auth: { token }, transports: ["websocket"] });
  try {
    await new Promise<void>(resolve => socket.once("connect", resolve));
    socket.emit("joinApplicationGuild", { guildId });
    for (let i = 0; i < 20 && !socketServer.sockets.adapter.rooms.has(`applications:${guildId}`); i++) {
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    const updated = new Promise<void>(resolve => socket.once("applicationUpdated", resolve));
    const path = `/api/guilds/${guildId}/applications/apps/${app.id}`;
    assert.deepEqual((await (await request(`/api/guilds/${guildId}/applications/apps`)).json()).map((item: any) => item.id), [app.id]);
    assert.equal((await request("/api/guilds/other/tickets/stats")).status, 403);
    assert.equal((await request(`${path}/files/${initial.files[0].id}`)).status, 200);
    assert.equal((await nativeFetch(url + `${path}/files/${initial.files[0].id}`)).status, 401);
    const outsider = jwt.sign({ id: userId, username: "candidate", scope: "applications" }, process.env.JWT_SECRET);
    assert.equal((await request(`${path}/files/${initial.files[0].id}`, { headers: { Authorization: `Bearer ${outsider}` } })).status, 403);
    const progress = (percent: number) => request(`${path}/action`, { method: "POST", body: JSON.stringify({ action: "progress", step: "Interview scheduled", percent }) });
    const response = await progress(60);
    assert.equal(response.status, 200, await response.clone().text());
    await Promise.race([updated, new Promise((_, reject) => setTimeout(() => reject(new Error("No socket update")), 2000))]);
    const first = await db.application.findUniqueOrThrow({ where: { id: app.id } });
    assert.equal(first.progressPercent, 60);
    assert.match(messageText(reviewMessages.get(controlId!)), /Interview scheduled · 60%/);
    const existingDm = applicantDms.find(message => message.id === first.statusDmId);
    Object.assign(existingDm, { flags: 0, content: "Old progress message", embeds: [{}], components: [] });
    await progress(70);
    assert.equal((await db.application.findUniqueOrThrow({ where: { id: app.id } })).statusDmId, first.statusDmId);
    assert.match(messageText(existingDm), /70%/);
    editFails = true;
    await progress(80);
    assert.notEqual((await db.application.findUniqueOrThrow({ where: { id: app.id } })).statusDmId, first.statusDmId);
    dmsClosed = true;
    const delivery = await (await progress(90)).json();
    assert.match(delivery.warnings[0], /Status saved/);
    assert.equal(delivery.application.progressPercent, 90);
    dmsClosed = false;
    const opened = await Promise.all([review("ticket"), review("ticket")]);
    assert.equal(opened[0].ticketUrl, opened[1].ticketUrl);
    assert.equal(tickets.size, 1);
    assert.equal(ticketMentions, 1);
    await review("dm", { message: "Can you clarify?", replyRequested: true });
    const teamDm = applicantDms.at(-1);
    await click(apply(another.id, "start", false) as any);
    await sendMessage("Still part of the other draft");
    assert.equal(await db.appFollowup.count({ where: { answeredAt: { not: null } } }), 0);
    await press("Reply", teamDm);
    assert.match(messageText(applicantDms.at(-1)), /active draft/);
    await press("Pause draft");
    await press("Reply", teamDm);
    await sendMessage("This belongs to the submitted application");
    assert.equal((await db.appFollowup.findFirstOrThrow({ where: { applicationId: app.id } })).answer,
      "This belongs to the submitted application");
    assert.equal((await db.application.findUniqueOrThrow({ where: { id: app.id } })).reviewMessageId, controlId);
  } finally {
    socket.disconnect();
    await new Promise<void>(resolve => socketServer.close(() => resolve()));
    await db.$disconnect();
  }
}

async function seedBeforeMigration() {
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  try {
    for (const directory of ["0_init", "20261114000000_relay_count", "20261114010000_leveling", "20261114020000_ticket_closed_category"]) {
      const sql = readFileSync(join(__dirname, "../prisma/migrations", directory, "migration.sql"), "utf8");
      for (const statement of sql.split(";").map(value => value.trim()).filter(Boolean)) await db.$executeRawUnsafe(statement);
    }
    await db.$executeRaw`INSERT INTO "AppForm" ("id", "guildId", "name", "updatedAt") VALUES ('legacy-form', ${guildId}, 'Legacy form', CURRENT_TIMESTAMP)`;
    await db.$executeRaw`INSERT INTO "AppQuestion" ("id", "formId", "label", "updatedAt") VALUES ('legacy-question', 'legacy-form', 'Legacy question', CURRENT_TIMESTAMP)`;
    await db.$executeRaw`INSERT INTO "Application" ("id", "appNumber", "guildId", "formId", "userId", "userTag", "updatedAt")
      VALUES ('legacy-app', 4, ${guildId}, 'legacy-form', ${userId}, 'Candidate', CURRENT_TIMESTAMP)`;
    await db.$executeRaw`INSERT INTO "AppAnswer" ("id", "applicationId", "questionLabel", "questionType", "value")
      VALUES ('legacy-answer', 'legacy-app', 'Legacy question', 'SHORT_TEXT', 'Existing response')`;
  } finally { await db.$disconnect(); }
}

const nativeFetch = global.fetch;
if (directory) {
  const phase = process.argv[2];
  (phase === "seed" ? seedBeforeMigration() : exercise(phase))
    .then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
} else {
  const scratch = mkdtempSync(join(tmpdir(), "guildpilot-applications-"));
  closeSync(openSync(join(scratch, "test.db"), "wx"));
  const env = { ...process.env, APPLICATION_TEST_DIR: scratch, DATABASE_URL: `file:${join(scratch, "test.db").replace(/\\/g, "/")}` };
  const run = (args: string[], cwd = scratch) => {
    const child = spawnSync(process.execPath, args, { env, cwd, stdio: "inherit" });
    if (child.error) throw child.error;
    assert.equal(child.status, 0);
  };
  try {
    const root = join(__dirname, "..");
    const prisma = join(root, "node_modules/prisma/build/index.js");
    const tsx = join(root, "node_modules/tsx/dist/cli.mjs");
    run([tsx, __filename, "seed"]);
    for (const migration of ["0_init", "20261114000000_relay_count", "20261114010000_leveling", "20261114020000_ticket_closed_category"]) {
      run([prisma, "migrate", "resolve", "--applied", migration], root);
    }
    run([prisma, "migrate", "deploy"], root);
    for (const phase of ["before", "after"]) run([tsx, __filename, phase]);
    console.log("Application DM and review integration checks passed.");
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
