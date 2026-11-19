import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ButtonInteraction, ChannelType, Client, Collection, ComponentType, DiscordAPIError, Events, Guild, GuildMember, InteractionEditReplyOptions, MessageCreateOptions,
  MessageFlags, MessagePayload, PermissionFlagsBits, PermissionsBitField, RESTPostAPIChannelMessageJSONBody, SnowflakeUtil, User,
} from "discord.js";
import express from "express";
import jwt from "jsonwebtoken";
import { giveawayDefaults, newGiveaway } from "../src/types/giveaways";

const guildId = "100000000000000001";
const otherGuildId = "100000000000000002";
const manager = "100000000000000003";
const outsider = "100000000000000004";
const channelId = "100000000000000005";
const botId = "100000000000000006";
const requiredRole = "100000000000000007";
const excludedRole = "100000000000000008";

const day = 86_400_000;
const when = (offset: number) => new Date(Date.now() + offset);
const discordError = (code: number, status: number) =>
  new DiscordAPIError({ code, message: "Test Discord response" }, code, status, "GET", "https://discord.com/api", { files: undefined, body: undefined });

function fakeDiscord(client: Client) {
  let failSendAfterReceipt = false;
  const users = new Map<string, { member: GuildMember; unavailable?: boolean; left?: boolean }>();
  const sent = new Collection<string, any>();
  const dm = new Collection<string, any>();
  let edited: MessageCreateOptions | undefined;
  const fakeChannel = (store: typeof sent) => ({
    id: channelId, guildId, type: ChannelType.GuildText, name: "giveaways", rawPosition: 1,
    permissionsFor: () => new PermissionsBitField([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]),
    messages: {
      fetch: async ({ before, limit }: { before?: string; limit: number }) =>
        new Collection([...store.entries()].reverse().filter(([id]) => !before || id < before).slice(0, limit)),
      edit: async (_id: string, options: MessageCreateOptions) => { edited = options; },
    },
    async send(options: MessageCreateOptions) {
      const body = MessagePayload.create({ client } as never, options).resolveBody().body as RESTPostAPIChannelMessageJSONBody;
      const id = SnowflakeUtil.generate().toString();
      const content = JSON.stringify(body);
      const message = { id, author: { id: botId }, content: body.content ?? "", components: body.components ?? [],
        createdTimestamp: Date.now(), body, options, contentJson: content };
      store.set(id, message);
      if (failSendAfterReceipt) { failSendAfterReceipt = false; throw new Error("Socket closed after Discord accepted the message"); }
      return message;
    },
  });
  const channel = fakeChannel(sent);
  const dmChannel = fakeChannel(dm);
  const roles = new Map([requiredRole, excludedRole].map(id => [id, { id, guild: { id: guildId }, name: id, position: 1, mentionable: true }]));
  const seedGuild = (id: string) => {
    const guild = {
      id, name: "Giveaway test", available: true, client,
      channels: { fetch: async (id?: string) => id ? id === channelId ? channel : null : new Map([[channelId, channel]]) },
      roles: { everyone: { id }, fetch: async (id?: string) => id ? roles.get(id) ?? null : roles },
      members: { fetchMe: async () => ({}), fetch: async ({ user }: { user: string }) => {
        if (user === manager) return { permissions: new PermissionsBitField(PermissionFlagsBits.ManageGuild) };
        const record = users.get(user);
        if (record?.unavailable) throw new Error("Temporary upstream failure");
        if (!record || record.left) throw discordError(10007, 404);
        return record.member;
      } },
    } as unknown as Guild;
    client.guilds.cache.set(id, guild);
    return guild;
  };
  Object.defineProperty(client, "isReady", { value: () => true });
  Object.defineProperty(client, "user", { value: { id: botId } });
  const guild = seedGuild(guildId);
  seedGuild(otherGuildId);
  Object.defineProperty(client.users, "createDM", { value: async () => dmChannel });
  function member(name: string, roleIds = [requiredRole], age = 40) {
    const id = SnowflakeUtil.generate({ timestamp: when(-age * day).getTime() }).toString();
    const user = { id, username: name, bot: false, displayAvatarURL: () => null } as unknown as User;
    users.set(id, { member: { user, displayName: name, joinedTimestamp: when(-10 * day).getTime(),
      roles: { cache: new Collection(roleIds.map(id => [id, roles.get(id)])) } } as unknown as GuildMember });
    return user;
  }
  return { guild, member, users, sent, dm, failNextSend: () => { failSendAfterReceipt = true; }, lastEdit: () => edited };
}

async function run() {
  const { discordClient } = await import("../src/backend/bot/client");
  const { default: router } = await import("../src/backend/routes/plugins");
  const { db, hash, system } = await import("../src/backend/services/giveaways/store");
  const claims = await import("../src/backend/services/giveaways/claims");
  const drawing = await import("../src/backend/services/giveaways/drawing");
  const { verifyEligibility } = await import("../src/backend/services/giveaways/eligibility");
  const { processJob, refreshAnnouncement } = await import("../src/backend/services/giveaways/delivery");
  const { advanceLifecycle } = await import("../src/backend/services/giveaways/lifecycle");
  const { buildSnapshot, participate, syncMemberChange } = await import("../src/backend/services/giveaways/participants");
  const { setupGiveaways } = await import("../src/backend/bot/giveawayHandler");
  const fake = fakeDiscord(discordClient);
  const interactionClient = new Client({ intents: [] });
  setupGiveaways(interactionClient);
  const handleButton = interactionClient.listeners(Events.InteractionCreate)[0];
  async function pressInfo(customId: string, messageId: string, userId: string, guild: Guild | null = fake.guild) {
    const replies: InteractionEditReplyOptions[] = [];
    let deferred = false;
    const interaction = {
      isButton: () => true, customId, message: { id: messageId }, user: { id: userId },
      guild, guildId: guild?.id ?? null,
      get deferred() { return deferred; },
      async deferReply({ flags }: { flags: number }) {
        assert.equal(flags, MessageFlags.Ephemeral);
        deferred = true;
      },
      async editReply(options: InteractionEditReplyOptions) { replies.push(options); },
    } as unknown as ButtonInteraction;
    await handleButton(interaction);
    assert.equal(replies.length, 1);
    return replies[0];
  }
  const app = express();
  app.use(express.json());
  app.use("/api/guilds", router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/guilds`;
  async function call(path: string, options: { method?: string; body?: object; guild?: string; user?: string | null; origin?: string } = {}) {
    const user = options.user === undefined ? manager : options.user;
    const auth = user ? { Authorization: `Bearer ${jwt.sign({ id: user, username: "Manager" }, process.env.JWT_SECRET!)}` } : {};
    return fetch(`${base}/${options.guild ?? guildId}/plugins/giveaways${path}`, {
      method: options.method ?? "GET",
      headers: { ...auth, "Content-Type": "application/json", ...(options.origin ? { Origin: options.origin } : {}) } as HeadersInit,
      body: options.body && JSON.stringify(options.body),
    });
  }
  async function expect(path: string, status: number, options?: Parameters<typeof call>[1]) {
    const response = await call(path, options);
    const data = await response.text();
    assert.equal(response.status, status, `${path}: ${data}`);
    return data ? JSON.parse(data) : null;
  }
  const config = { ...newGiveaway(giveawayDefaults), title: "Community @everyone", prize: "Nitro",
    description: "A prize for our community.", terms: "One entry per person.",
    channelId, pingRoleId: requiredRole, dmWinners: true, claimsEnabled: true, riskAttempts: 1,
    rules: { ...giveawayDefaults.rules, requiredRoles: [requiredRole], excludedRoles: [excludedRole], accountDays: 15, memberDays: 2 },
  };
  const giveawayId = "a".repeat(32);
  const path = `/items/${giveawayId}`;
  const row = (id = giveawayId) => db.giveaway.findUniqueOrThrow({ where: { id } });
  async function post(endpoint: string, status: number, body: object = {}) {
    return expect(`${path}${endpoint}`, status, { method: "POST", body: { revision: (await row()).revision, ...body } });
  }
  const alpha = fake.member("alpha");
  const beta = fake.member("beta");
  const gamma = fake.member("gamma");
  const unknown = fake.member("unknown");
  const altRole = fake.member("wrong role", [excludedRole]);
  const newAccount = fake.member("too new", [requiredRole], 1);

  try {
    assert.equal((await expect("/settings", 200)).enabled, false);
    await expect("/settings", 401, { user: null });
    await expect("/settings", 403, { user: outsider });
    await expect("", 403, { method: "PATCH", body: { enabled: true }, origin: "https://outside.invalid" });
    const payload = { requestId: giveawayId, config, startAt: when(day).toISOString(), endAt: when(2 * day).toISOString() };
    await expect("/items", 409, { method: "POST", body: payload });
    await expect("", 200, { method: "PATCH", body: { enabled: true } });
    assert.equal((await expect("/settings", 200, { guild: otherGuildId })).enabled, false);
    await expect("/settings", 200, { method: "PUT", body: config });
    const settings = await expect("/settings", 200);
    assert.equal(settings.settings.channelId, channelId);
    assert.equal(settings.settings.autoFinalize, false);
    await expect("/settings", 400, { method: "PUT", body: { ...config, timezone: "Bad/Zone" } });
    await expect("/settings", 400, { method: "PUT", body: { ...config, pingRoleId: guildId } });
    const preview = await expect("/preview", 200, { method: "POST", body: payload });
    assert.equal(preview.flags, MessageFlags.IsComponentsV2);
    assert.equal(preview.components[0].type, ComponentType.Container);
    assert.equal(preview.content, undefined);
    assert.deepEqual(preview.allowedMentions.parse, []);
    const previewText = JSON.stringify(preview.components);
    assert.doesNotMatch(previewText, /Entry requirements|One entry per person|A prize for our community/);
    assert.match(previewText, /gp-gw:info:/);
    assert.match(previewText, /Enter Giveaway/);
    assert.match(previewText, /Withdraw/);
    assert.match(JSON.stringify(preview.info.components), /Entry requirements/);
    assert.match(JSON.stringify(preview.info.components), /One entry per person/);
    const legacyPreview = await expect("/preview", 200, { method: "POST", body: {
      ...payload, config: { ...config, buttonLabel: "Teilnehmen" },
    } });
    assert.match(JSON.stringify(legacyPreview.components), /Enter Giveaway/);
    const customPreview = await expect("/preview", 200, { method: "POST", body: {
      ...payload, config: { ...config, buttonLabel: "Count Me In" },
    } });
    assert.match(JSON.stringify(customPreview.components), /Count Me In/);

    await expect("/items", 201, { method: "POST", body: payload });
    await expect("/items", 201, { method: "POST", body: payload });
    await expect("/items", 400, { method: "POST", body: { ...payload, endAt: payload.startAt } });
    await expect(path, 404, { guild: otherGuildId });
    await post("/lifecycle/schedule", 204);
    assert.equal((await row()).status, "SCHEDULED");
    await advanceLifecycle(await row());
    assert.equal(await db.giveawayJob.count({ where: { kind: "ANNOUNCEMENT" } }), 0);
    await db.giveaway.update({ where: { id: giveawayId }, data: { startAt: when(-60_000) } });
    // A new scheduler process obtains work from SQLite.
    await advanceLifecycle(await row());
    const announcement = await db.giveawayJob.findFirstOrThrow({ where: { giveawayId, kind: "ANNOUNCEMENT" } });
    await processJob(discordClient, announcement.id);
    await processJob(discordClient, announcement.id);
    const active = await row();
    assert.equal(active.status, "ACTIVE");
    assert.equal(fake.sent.size, 1);
    assert.equal(fake.sent.first().body.enforce_nonce, true);
    await expect(`${path}/appearance`, 200, { method: "PUT", body: {
      revision: active.revision, config: { ...config, winnerCount: 5, footer: "Neue Fußzeile" },
    } });
    const edited = (await expect(path, 200)).config;
    assert.equal(edited.winnerCount, 1);
    assert.equal(edited.footer, "Neue Fußzeile");
    const channelMessage = active.messageId!;
    const infoId = `gp-gw:info:${giveawayId}`;
    const publicInfo = await pressInfo(infoId, channelMessage, alpha.id);
    assert.equal(publicInfo.flags, MessageFlags.IsComponentsV2);
    assert.deepEqual(publicInfo.allowedMentions?.parse, []);
    assert.match(JSON.stringify(publicInfo.components), /A prize for our community/);
    assert.match(JSON.stringify(publicInfo.components), /Entry requirements/);
    assert.doesNotMatch(JSON.stringify(publicInfo.components), new RegExp(active.seed));
    assert.equal((await pressInfo(infoId, "other-message", alpha.id)).content, "These giveaway details are unavailable.");
    const otherGuild = discordClient.guilds.cache.get(otherGuildId)!;
    assert.equal((await pressInfo(infoId, channelMessage, alpha.id, otherGuild)).content, "We couldn’t complete this giveaway action.");
    const join = (user: User) => participate(fake.guild, giveawayId, channelMessage, user, "join");
    await assert.rejects(participate(fake.guild, giveawayId, "wrong", alpha, "join"), /Entries are closed/);
    const results = await Promise.all([join(alpha), join(alpha), join(alpha)]);
    assert.equal(results.filter(result => result.includes("already entered")).length, 2);
    assert.match(await join(altRole), /One of your roles is excluded/);
    assert.match(await join(newAccount), /Your Discord account must be at least 15 days old/);
    assert.equal(verifyEligibility(config, altRole.id, fake.users.get(altRole.id)!.member).checks.excluded.result, "FAILED");
    assert.equal(verifyEligibility(config, altRole.id, fake.users.get(altRole.id)!.member).checks.required.result, "FAILED");
    assert.equal(verifyEligibility(config, newAccount.id, fake.users.get(newAccount.id)!.member).checks.account.result, "FAILED");
    assert.equal(verifyEligibility(config, alpha.id, "LEFT").checks.member.result, "FAILED");
    assert.equal(verifyEligibility(config, alpha.id, "UNAVAILABLE").checks.member.result, "ERROR");
    assert.equal(verifyEligibility(config, alpha.id, fake.users.get(alpha.id)!.member, 5, true).risk, "HIGH");
    await join(beta);
    await join(gamma);
    fake.users.get(unknown.id)!.unavailable = true;
    assert.match(await join(unknown), /Your entry was recorded/);
    await syncMemberChange(guildId, gamma.id, "LEFT");
    assert.equal((await expect(`${path}/participants?filter=left`, 200)).total, 1);
    await syncMemberChange(guildId, gamma.id, fake.users.get(gamma.id)!.member);
    assert.equal(await participate(fake.guild, giveawayId, channelMessage, beta, "leave"), "You withdrew your entry.");
    assert.equal((await expect(`${path}/participants?filter=withdrawn`, 200)).total, 1);
    await join(beta);
    await refreshAnnouncement(fake.guild, await row());
    assert.match(JSON.stringify(fake.lastEdit()?.components), /Entries: 4/);

    await post("/lifecycle/pause", 204);
    await assert.rejects(join(alpha), /Entries are closed/);
    await post("/lifecycle/resume", 204);
    await expect("", 200, { method: "PATCH", body: { enabled: false } });
    await assert.rejects(join(alpha), /Entries are closed/);
    await expect("", 200, { method: "PATCH", body: { enabled: true } });

    await db.giveaway.update({ where: { id: giveawayId }, data: { endAt: when(-1_000) } });
    await advanceLifecycle(await row());
    assert.equal((await row()).status, "ENDED");
    await buildSnapshot(fake.guild, await row());
    await buildSnapshot(fake.guild, await row());
    assert.equal((await row()).status, "DRAW_PENDING");
    await post("/draw", 409);
    await post(`/participants/${unknown.id}/exclude`, 400);
    await post(`/participants/${unknown.id}/exclude`, 204, { reason: "Discord-Mitgliedschaft blieb in der Nachprüfung unbekannt." });
    assert.equal((await expect(path, 200)).unresolved, 0);
    await post("/draw", 204);
    await post("/draw", 409);
    assert.equal(fake.sent.size, 1, "Private drawing must never announce a winner");
    let detail = await expect(path, 200);
    assert.equal(detail.seed, undefined);
    assert.equal(detail.candidates.length, 1);
    const first = detail.candidates[0];
    await post("/results", 400);
    await post("/results", 409, { confirmed: true });
    await post(`/candidates/${first.id}/reject`, 400, { reason: "Dokumentierter Regelverstoß", policy: "INELIGIBLE" });
    await post(`/candidates/${first.id}/reject`, 200, { reason: "Verstoß gegen veröffentlichte Teilnahmebedingungen", policy: "RULE_VIOLATION" });
    assert.equal((await post(`/candidates/${first.id}/replace`, 200, {
      reason: "Ersatz wegen dokumentiertem Regelverstoß", policy: "RULE_VIOLATION",
    })).replaced, true);
    detail = await expect(path, 200);
    const winner = detail.candidates[1];
    assert.notEqual(winner.userId, first.userId);
    assert.equal(winner.replacesId, first.id);
    assert.equal((await post(`/candidates/${winner.id}/approve`, 200)).approved, true);
    assert.equal((await expect(`${path}/transparency`, 200)).draws[0].seed, null);
    await post("/results", 202, { confirmed: true });
    await post("/results", 202, { confirmed: true });
    const result = await db.giveawayJob.findFirstOrThrow({ where: { giveawayId, kind: "RESULT" } });
    fake.failNextSend();
    await processJob(discordClient, result.id);
    assert.equal((await row()).publishedRound, 0);
    assert.equal(fake.sent.size, 2);
    await post(`/jobs/${result.id}/retry`, 204);
    await Promise.all([processJob(discordClient, result.id), processJob(discordClient, result.id)]);
    assert.equal(fake.sent.size, 2, "Must recover the existing Discord message after a lost response");
    assert.equal((await row()).status, "AWAITING_CLAIM");
    assert.deepEqual(fake.sent.last().body.allowed_mentions.users, [winner.userId]);
    assert.match(JSON.stringify(fake.sent.last().body.components), /Confirmed winners/);
    assert.match(JSON.stringify(fake.sent.last().body.components), /Claim Prize/);
    assert.match(JSON.stringify(fake.sent.last().body.components), /gp-gw:info:/);
    const resultId = (await row()).resultId!;
    const resultsInfo = await pressInfo(infoId, resultId, outsider);
    assert.match(JSON.stringify(resultsInfo.components), /Original Giveaway/);
    assert.doesNotMatch(JSON.stringify(resultsInfo.components), /Your prize claim/);
    const personalResultsInfo = await pressInfo(infoId, resultId, winner.userId);
    assert.match(JSON.stringify(personalResultsInfo.components), /Your prize claim/);

    const evidence = await expect(`${path}/transparency`, 200);
    const summary = await expect(`${path}/transparency?redacted=true`, 200);
    assert.equal(summary.snapshot, undefined);
    assert.equal(summary.draws[0].seed, undefined);
    assert.equal(summary.participants, 4);
    assert.equal(hash(evidence.draws[0].seed), evidence.commitment);
    assert.equal(hash(evidence.snapshot.map((line: unknown) => JSON.stringify(line)).join("\n") + "\n"), evidence.snapshotHash);
    const users = evidence.eligibleOrder as string[];
    assert.deepEqual(drawing.selectUsers(users, 1, evidence.draws[0].seed, `${giveawayId}:0:${hash(JSON.stringify(users))}`), [first.userId]);
    assert.equal(new Set(drawing.selectUsers(users, 20, evidence.draws[0].seed, "unique")).size, users.length);
    const dm = await db.giveawayJob.findFirstOrThrow({ where: { kind: "DM", giveawayId } });
    await processJob(discordClient, dm.id);
    assert.equal(fake.dm.first().body.flags, MessageFlags.IsComponentsV2);
    assert.match(JSON.stringify(fake.dm.first().body.components), /Congratulations!/);
    assert.match(JSON.stringify(fake.dm.first().body.components), /Decline Prize/);
    const claim = await db.giveawayClaim.findUniqueOrThrow({ where: { candidateId: winner.id } });
    const dmInfoId = `gp-gw:dm-info:${winner.id}`;
    assert.match(JSON.stringify(fake.dm.first().body.components), new RegExp(dmInfoId));
    const dmInfo = await pressInfo(dmInfoId, fake.dm.first().id, winner.userId, null);
    assert.match(JSON.stringify(dmInfo.components), /Your prize claim/);
    assert.doesNotMatch(JSON.stringify(dmInfo.components), new RegExp(claim.token));
    assert.equal((await pressInfo(dmInfoId, fake.dm.first().id, outsider, null)).content, "These giveaway details are unavailable.");
    detail = await expect(path, 200);
    assert.equal(detail.candidates[1].claim.token, undefined);
    await assert.rejects(claims.respondToClaim(claim.token, { id: outsider, username: outsider }, "claim"), /This prize claim is unavailable/);
    await db.giveawayClaim.update({ where: { id: claim.id }, data: { deadline: when(-1_000) } });
    await claims.expireClaims();
    assert.equal((await db.giveawayClaim.findUniqueOrThrow({ where: { id: claim.id } })).status, "EXPIRED");
    await post(`/claims/${claim.id}/extend`, 204, { deadline: when(day).toISOString() });
    const actor = { id: winner.userId, username: "Winner" };
    assert.match(await claims.respondToClaim(claim.token, actor, "claim"), /Your claim is confirmed/);
    assert.match(await claims.respondToClaim(claim.token, actor, "claim"), /already claimed/);
    await post(`/claims/${claim.id}/fulfill`, 204, { confirmed: true, notes: "Übergabe erfolgt." });
    assert.equal((await row()).status, "COMPLETED");

    const metrics = await expect("/analytics", 200);
    assert.equal(metrics.status.COMPLETED, 1);
    assert.equal(metrics.days.at(-1).count, 4);
    assert.equal(metrics.claimRate, 1);
    assert.equal((await expect("/analytics", 200, { guild: otherGuildId })).total, 0);
    const audit = await expect("/audit?event=WINNER_REJECTED", 200);
    assert.equal(audit.total, 1);
    assert.equal(audit.items[0].actor, manager);
    await expect(`/templates/${"b".repeat(32)}`, 200, { method: "PUT", body: { name: "Vorlage", config } });
    assert.equal((await expect("/templates", 200, { guild: otherGuildId })).total, 0);

    const automatic = "c".repeat(32);
    const solo = fake.member("solo");
    await expect("/items", 201, { method: "POST", body: { ...payload, requestId: automatic,
      config: { ...config, autoFinalize: true, autoReplaceExpired: true, dmWinners: false } } });
    await expect(`/items/${automatic}/lifecycle/publish`, 204, {
      method: "POST", body: { revision: (await row(automatic)).revision, confirmed: true },
    });
    await processJob(discordClient, (await db.giveawayJob.findFirstOrThrow({ where: { kind: "ANNOUNCEMENT", giveawayId: automatic } })).id);
    await participate(fake.guild, automatic, (await row(automatic)).messageId!, solo, "join");
    await db.giveaway.update({ where: { id: automatic }, data: { endAt: when(-1000) } });
    await advanceLifecycle(await row(automatic));
    await buildSnapshot(fake.guild, await row(automatic));
    await buildSnapshot(fake.guild, await row(automatic));
    await drawing.drawInitial(guildId, automatic, system, (await row(automatic)).revision);
    assert.equal((await drawing.publishResults(fake.guild, automatic, system, (await row(automatic)).revision)).queued, true);
    await processJob(discordClient, (await db.giveawayJob.findFirstOrThrow({ where: { giveawayId: automatic, kind: "RESULT" } })).id);
    assert.equal(await db.giveawayJob.count({ where: { kind: "DM", giveawayId: automatic } }), 0);
    const autoClaim = await db.giveawayClaim.findFirstOrThrow({ where: { candidate: { giveawayId: automatic } } });
    await db.giveawayClaim.update({ where: { id: autoClaim.id }, data: { deadline: when(-1000) } });
    await claims.expireClaims();
    await processJob(discordClient, (await db.giveawayJob.findFirstOrThrow({ where: { giveawayId: automatic, kind: "EXPIRED_REPLACEMENT" } })).id);
    assert.equal((await row(automatic)).status, "WINNER_REVIEW");
    assert.equal(await db.giveawayAudit.count({ where: { giveawayId: automatic, event: "REPLACEMENT_UNAVAILABLE" } }), 1);

    console.log("Giveaways: authorization, lifecycle, verification, drawing, publication recovery, claims and analytics passed.");
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await db.$disconnect();
    interactionClient.destroy();
    discordClient.destroy();
  }
}

async function main() {
  const directory = mkdtempSync(join(tmpdir(), "guildpilot-giveaways-"));
  const database = join(directory, "tests.db");
  writeFileSync(database, "");
  process.env.DATABASE_URL = `file:${database.replaceAll("\\", "/")}`;
  process.env.JWT_SECRET = "isolated-giveaway-test-secret";
  try {
    const migration = spawnSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "deploy"], { stdio: "pipe", encoding: "utf8" });
    assert.equal(migration.status, 0, migration.stderr || migration.stdout);
    await run();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
