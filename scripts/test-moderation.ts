import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ChannelType, Client, Events, GuildMember, Message, MessageFlags, MessageType, PermissionsBitField,
} from "discord.js";

const guildId = "111111111111111111";
const logId = "222222222222222222";
const reviewRole = "333333333333333333";
const timeoutRole = "444444444444444444";
const channelId = "555555555555555555";
const moderatorId = "666666666666666666";
const targetId = "777777777777777777";
const otherId = "888888888888888888";
const botId = "999999999999999999";
const ownerId = "100000000000000000";
const { ManageMessages, ModerateMembers, Administrator, ViewChannel, SendMessages } = PermissionsBitField.Flags;

async function exercise() {
  const { defaultAutoMod, getAutoModSettings, moderationDb: db } =
    await import("../src/backend/services/moderationService");
  const { createAutoModDetector, inviteCodes } = await import("../src/backend/bot/autoModHandler");
  const { canModerate, setupModerationInteractions } = await import("../src/backend/bot/moderationHandler");
  const { handleGuildMessage } = await import("../src/backend/bot/guildMessageHandler");
  const { getCountingStats, setCountingChannel } = await import("../src/backend/services/countingService");
  const { getLevelingConfig, getLevelingMember, saveLevelingConfig } =
    await import("../src/backend/services/levelingService");

  const moderatorSettings = { logChannelId: logId, reviewRoleIds: [reviewRole], timeoutRoleIds: [timeoutRole] };
  const published: string[] = [];
  const everyone = { id: guildId };
  let publicLog = false;
  let timeoutUntil: Date | null = null;
  let timeoutCalls = 0;
  const logChannel = {
    type: ChannelType.GuildText,
    permissionsFor: (subject: { id: string }) => new PermissionsBitField(
      subject.id === guildId ? (publicLog ? ViewChannel : 0n) : ViewChannel | SendMessages),
    send: async (data: unknown) => { published.push(JSON.stringify(data)); },
  };
  const members = new Map<string, GuildMember>();
  const guild = {
    id: guildId, ownerId, name: "Guild", roles: { everyone },
    channels: { fetch: async (id: string) => id === logId ? logChannel : null },
    members: { fetch: async ({ user }: { user: string }) => members.get(user), fetchMe: async () => members.get(botId) },
  };
  function member(id: string, position: number, permissions: bigint, roles: string[]) {
    const value = {
      id, guild, permissions: new PermissionsBitField(permissions),
      roles: {
        highest: { position, comparePositionTo: (role: { position: number }) => position - role.position },
        cache: new Map(roles.map(role => [role, {}])),
      },
      moderatable: true,
      get communicationDisabledUntilTimestamp() { return timeoutUntil?.getTime() ?? null; },
      timeout: async (ms: number | null) => {
        timeoutCalls++;
        timeoutUntil = ms ? new Date(Date.now() + ms) : null;
        return { communicationDisabledUntil: timeoutUntil };
      },
      send: async () => { throw new Error("DMs closed"); },
    } as unknown as GuildMember;
    members.set(id, value);
    return value;
  }
  member(botId, 10, Administrator, []);
  const target = member(targetId, 1, 0n, []);
  member(otherId, 1, 0n, []);
  const review = member(moderatorId, 3, ManageMessages, [reviewRole]);
  assert.equal(canModerate(review, target, "warn", moderatorSettings), true);
  assert.equal(canModerate(review, target, "cases", moderatorSettings), true);
  assert.equal(canModerate(review, target, "timeout", moderatorSettings), false);
  const timeoutRoleOnly = member(moderatorId, 3, ManageMessages | ModerateMembers, [timeoutRole]);
  assert.equal(canModerate(timeoutRoleOnly, target, "warn", moderatorSettings), false);
  assert.equal(canModerate(timeoutRoleOnly, target, "timeout", moderatorSettings), true);
  const noDiscordPermission = member(moderatorId, 3, 0n, [timeoutRole, reviewRole]);
  assert.equal(canModerate(noDiscordPermission, target, "timeout", moderatorSettings), false);
  const lowAdmin = member(moderatorId, 1, Administrator, []);
  assert.equal(canModerate(lowAdmin, target, "cases", moderatorSettings), false);
  const moderator = member(moderatorId, 3, ManageMessages | ModerateMembers, [timeoutRole, reviewRole]);
  assert.equal(canModerate(moderator, member(ownerId, 0, Administrator, []), "warn", moderatorSettings), false);

  const { flood, repeat, invites } = defaultAutoMod;
  assert.deepEqual(await getAutoModSettings(guildId), defaultAutoMod);
  assert.ok(Object.values(defaultAutoMod).every(rule => !rule.enabled));
  assert.deepEqual(inviteCodes("<https://discord.gg/Good> discord.com/invite/Bad discordapp.com/invite/Old"),
    ["Good", "Bad", "Old"]);
  assert.deepEqual(inviteCodes("fake-discord.gg/Bad example.org/discord.gg/Bad"), []);
  const detect = createAutoModDetector();
  const inviteRule = { ...defaultAutoMod, flood, repeat, invites: { ...invites, enabled: true, action: "delete" as const,
    allowedCodes: ["Good"], exemptChannelIds: [logId], exemptRoleIds: [reviewRole] } };
  const sample = { guildId, channelId, parentId: null, userId: targetId, roleIds: new Set<string>(),
    messageId: "1", content: "discord.gg/Bad", timestamp: 1000 };
  assert.deepEqual(detect(inviteRule, { ...sample, content: "discord.gg/Good" }).matches, []);
  assert.deepEqual(detect(inviteRule, { ...sample, roleIds: new Set([reviewRole]) }).matches, []);
  assert.deepEqual(detect(inviteRule, { ...sample, channelId: logId }).matches, []);
  assert.deepEqual(detect(inviteRule, { ...sample, parentId: logId }).matches, []);
  assert.deepEqual(detect(inviteRule, sample), { matches: ["invites"], shouldDelete: true });

  const spam = { ...defaultAutoMod, flood: { ...flood, enabled: true, threshold: 2, windowSeconds: 2 },
    repeat: { ...repeat, enabled: true, threshold: 2, windowSeconds: 2 }, invites };
  const firstSample = { ...sample, content: "Hello WORLD ", timestamp: 5000 };
  assert.deepEqual(detect(spam, firstSample).matches, []);
  assert.deepEqual(detect(spam, firstSample).matches, []);
  assert.deepEqual(detect(spam, { ...firstSample, messageId: "2", content: "hello  world" }).matches,
    ["flood", "repeat"]);
  assert.deepEqual(detect(spam, { ...firstSample, messageId: "3", timestamp: 8000 }).matches, []);

  try {
    await db.moderationSettings.create({ data: { ...moderatorSettings, guildId,
      reviewRoleIds: JSON.stringify([reviewRole]), timeoutRoleIds: JSON.stringify([timeoutRole]) } });
    const client = new Client({ intents: [] });
    setupModerationInteractions(client);
    const listener = client.listeners(Events.InteractionCreate)[0];
    function interaction({ id, action, customId, actor = moderatorId, kind = "slash", dm = false }: {
      id: string; action?: string; customId?: string; actor?: string; kind?: "slash" | "button" | "modal"; dm?: boolean;
    }) {
      const replies: string[] = [];
      const flags: number[] = [];
      let modal = "";
      const event = {
        id, guild, user: { id: actor }, client: { user: { id: botId } },
        commandName: action, customId, message: { author: { id: botId } },
        inCachedGuild: () => true, isChatInputCommand: () => kind === "slash",
        isButton: () => kind === "button", isModalSubmit: () => kind === "modal",
        options: { getUser: () => ({ id: targetId }), getString: () => "A reason",
          getBoolean: () => dm, getInteger: () => action === "timeout" ? 5 : null },
        fields: { getTextInputValue: () => "Reviewed the evidence" },
        deferred: false, replied: false,
        deferReply: async ({ flags: value }: { flags: number }) => { event.deferred = true; flags.push(value); },
        editReply: async (data: unknown) => { replies.push(JSON.stringify(data)); },
        reply: async (data: unknown) => { replies.push(JSON.stringify(data)); },
        showModal: async (data: unknown) => { modal = JSON.stringify(data); },
      };
      return { run: () => listener(event), replies, flags, modal: () => modal };
    }

    const denied = interaction({ id: "denied", actor: otherId, action: "warn" });
    await denied.run();
    assert.match(denied.replies[0], /configured moderator role/);
    assert.equal(await db.moderationCase.count(), 0);

    const warn = interaction({ id: "warn", action: "warn", dm: true });
    await warn.run();
    await warn.run();
    assert.match(warn.replies[0], /DM could not be delivered/);
    assert.equal(await db.moderationCase.count(), 1);
    assert.equal(published.length, 1);
    assert.match(published[0], /View history/);
    assert.equal(JSON.parse(published[0]).flags, MessageFlags.IsComponentsV2);

    const history = interaction({ id: "cases", action: "cases" });
    await history.run();
    assert.deepEqual(history.flags, [MessageFlags.Ephemeral]);
    assert.match(history.replies[0], /#1/);
    const deniedButton = interaction({ id: "no-history", customId: "mod:history:1", actor: otherId, kind: "button" });
    await deniedButton.run();
    assert.match(deniedButton.replies[0], /configured moderator role/);
    assert.doesNotMatch(deniedButton.replies[0], /A reason/);

    await interaction({ id: "old-timeout", action: "timeout" }).run();
    const oldButton = interaction({ id: "old-button", customId: "mod:lift:2", kind: "button" });
    await oldButton.run();
    assert.match(oldButton.modal(), /mod:confirm:2/);
    await interaction({ id: "new-timeout", action: "timeout" }).run();
    const oldModal = interaction({ id: "old-confirm", customId: "mod:confirm:2", kind: "modal" });
    await oldModal.run();
    assert.match(oldModal.replies[0], /no longer owns/);
    assert.equal(timeoutCalls, 2);
    const lift = interaction({ id: "lift", customId: "mod:confirm:3", kind: "modal" });
    await lift.run();
    await lift.run();
    assert.equal(timeoutCalls, 3);
    const lifted = await db.moderationCase.findUniqueOrThrow({ where: { sourceId: "interaction:lift" } });
    assert.deepEqual([lifted.action, lifted.reversesCaseNumber, lifted.reason, lifted.moderatorId],
      ["untimeout", 3, "Reviewed the evidence", moderatorId]);

    publicLog = true;
    const noPublicLog = interaction({ id: "private", action: "warn" });
    await noPublicLog.run();
    assert.match(noPublicLog.replies[0], /mod-log card could not be sent/);
    assert.equal(published.length, 4);
    publicLog = false;

    await setCountingChannel(guildId, channelId);
    await saveLevelingConfig(guildId, {
      ...await getLevelingConfig(guildId), enabled: true, cooldownSeconds: 0, minXp: 10, maxXp: 10, excludeRelay: false,
    });
    const saveRules = async (settings: typeof defaultAutoMod) => {
      const rules = JSON.stringify(settings);
      await db.autoModSettings.upsert({ where: { guildId }, create: { guildId, rules }, update: { rules } });
    };
    let deletes = 0;
    let reactions = 0;
    let time = Date.now();
    function message(id: string, userId: string, content: string, rejectDelete = false) {
      time += 100;
      return {
        id, guildId, guild, channelId, channel: { type: ChannelType.GuildText, isThread: () => false, send: async () => {} },
        type: MessageType.Default, author: { id: userId, bot: false }, member: members.get(userId),
        inGuild: () => true, content, createdAt: new Date(time), createdTimestamp: time,
        delete: async () => { deletes++; if (rejectDelete) throw new Error("Missing permissions"); },
        react: async () => { reactions++; },
      } as unknown as Message;
    }

    await saveRules({ ...spam, repeat: { ...spam.repeat, enabled: false } });
    await handleGuildMessage(message("normal", targetId, "Hello"));
    await handleGuildMessage(message("log-only", targetId, "1"));
    assert.equal(deletes, 0);
    assert.equal((await db.moderationCase.findUniqueOrThrow({ where: { sourceId: "message:log-only" } })).action, "auto_log");
    assert.equal((await getCountingStats(guildId)).nextNumber, "2");
    assert.equal((await getLevelingMember(guildId, targetId))?.xp, 20);

    await saveRules({ ...spam, repeat: { ...spam.repeat, action: "delete" } });
    await handleGuildMessage(message("first-two", otherId, "2"));
    const duplicateHit = message("delete-once", otherId, "2");
    const beforeHit = published.length;
    await Promise.all([handleGuildMessage(duplicateHit), handleGuildMessage(duplicateHit)]);
    assert.equal(deletes, 1);
    assert.equal(published.length, beforeHit + 1);
    const hit = await db.moderationCase.findUniqueOrThrow({ where: { sourceId: "message:delete-once" } });
    assert.deepEqual([hit.ruleIds, hit.action, hit.status], ["flood, repeat", "auto_delete", "succeeded"]);
    assert.equal((await getCountingStats(guildId)).nextNumber, "3");
    assert.equal((await getLevelingMember(guildId, otherId))?.xp, 10);
    assert.equal(reactions, 2);

    await saveRules({ ...spam, flood: { ...spam.flood, action: "delete" } });
    await handleGuildMessage(message("delete-failed", targetId, "3", true));
    const failed = await db.moderationCase.findUniqueOrThrow({ where: { sourceId: "message:delete-failed" } });
    assert.equal(failed.status, "failed");
    assert.match(published.at(-1)!, /Action failed/);
    assert.equal((await getCountingStats(guildId)).nextNumber, "4");
    assert.equal((await getLevelingMember(guildId, targetId))?.xp, 30);
    console.log("Moderation and AutoMod integration checks passed.");
  } finally {
    await db.$disconnect();
  }
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), "guildpilot-moderation-"));
  const previousUrl = process.env.DATABASE_URL;
  const dbPath = join(dir, "test.db");
  writeFileSync(dbPath, "");
  process.env.DATABASE_URL = `file:${dbPath.replaceAll("\\", "/")}`;
  try {
    const migration = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
      env: process.env, stdio: "inherit",
    });
    if (migration.error) throw migration.error;
    assert.equal(migration.status, 0);
    // Let SQLite release all file handles before deleting the temporary database on Windows.
    const tests = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", __filename, "--exercise"], {
      env: process.env, stdio: "inherit",
    });
    if (tests.error) throw tests.error;
    assert.equal(tests.status, 0);
  } finally {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    rmSync(dir, { recursive: true, force: true });
  }
}

const run = process.argv.includes("--exercise") ? exercise : main;
run().catch(error => { console.error(error); process.exitCode = 1; });
