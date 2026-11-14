import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AddressInfo } from "node:net";
import express from "express";
import jwt from "jsonwebtoken";
import { PermissionFlagsBits } from "discord.js";
import { PrismaClient } from "@prisma/client";
import { levelForXp, levelProgress, MAX_XP, xpForLevel } from "../src/types/leveling";

const guildId = "111111111111111111";
const userId = "222222222222222222";
const discordAdmin = "333333333333333333";
const appOwner = "444444444444444444";
const chat = "555555555555555555";
const excluded = "666666666666666666";
const relay = "777777777777777777";
const now = Date.UTC(2026, 10, 14);

async function exercise(phase: string) {
  const { awardChatXp, getLevelingConfig, getLevelingMember, saveLevelingConfig, setMemberXp,
    prestigeMember, getRank, getLeaderboard, desiredRewardIds } = await import("../src/backend/services/levelingService");
  const { getCountingStats, processCountingMessage, setCountingChannel } = await import("../src/backend/services/countingService");
  const post = (messageId: string, seconds = 0, channelId = chat, parentId?: string, server = guildId) =>
    awardChatXp({ guildId: server, userId, messageId, channelId, parentId, timestamp: new Date(now + seconds * 1000) });

  if (phase === "seed-relay") {
    const prisma = new PrismaClient();
    try {
      for (const directory of ["0_init", "20261114000000_relay_count"]) {
        const sql = readFileSync(join(__dirname, "../prisma/migrations", directory, "migration.sql"), "utf8");
        for (const query of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
          await prisma.$executeRawUnsafe(query);
        }
      }
    } finally {
      await prisma.$disconnect();
    }
    await setCountingChannel(guildId, relay);
    assert.equal((await processCountingMessage({ guildId, channelId: relay, messageId: "count-1", playerId: userId, content: "1" }))?.outcome, "valid");
    return;
  }

  if (phase === "award") {
    assert.equal((await getCountingStats(guildId)).nextNumber, "2");
    const defaults = await getLevelingConfig(guildId);
    assert.deepEqual([defaults.enabled, defaults.minXp, defaults.maxXp, defaults.cooldownSeconds, defaults.excludeRelay], [false, 15, 25, 60, true]);
    assert.equal(await post("disabled"), null);
    await saveLevelingConfig(guildId, {
      ...defaults, enabled: true, minXp: 200, maxXp: 200, excludedChannelIds: [excluded],
      prestigeEnabled: true, prestigeLevel: 2,
    });
    assert.equal(await post("excluded", 0, excluded), null);
    assert.equal(await post("thread", 0, chat, excluded), null);
    assert.equal(await post("relay", 0, relay), null);
    const concurrent = await Promise.all([post("first"), post("first"), post("cooldown")]);
    assert.equal(concurrent.filter(Boolean).length, 1);
    assert.equal(concurrent.find(Boolean)?.level, 3);
    assert.equal((await getLevelingMember(guildId, userId))?.xp, 200);
    await saveLevelingConfig("other", { ...defaults, enabled: true, minXp: 15, maxXp: 15 });
    assert.ok(await post("other", 0, chat, undefined, "other"));
    return;
  }

  assert.equal(await post("first", 60), null);
  assert.equal(await post("cooldown", 60), null);
  assert.equal(await post("after-restart", 59), null);
  assert.ok(await post("cooldown-elapsed", 60));
  const active = (await getLevelingMember(guildId, userId))!;
  assert.equal(active.xp, 400);
  assert.equal(await setMemberXp(guildId, userId, 100, active.revision - 1), false);
  assert.equal((await getRank(guildId, userId)).position, 1);

  const rewards = [{ level: 1, roleId: "one" }, { level: 3, roleId: "three" }, { level: 5, roleId: "five" }];
  assert.deepEqual([...desiredRewardIds(rewards, 4, false)], ["one", "three"]);
  assert.deepEqual([...desiredRewardIds(rewards, 4, true)], ["three"]);
  assert.deepEqual([...desiredRewardIds(rewards, 0, true)], []);
  assert.equal((await Promise.all([prestigeMember(guildId, userId, 0), prestigeMember(guildId, userId, 0)])).filter(Boolean).length, 1);
  assert.deepEqual(await getRank(guildId, userId), { xp: 0, prestige: 1, position: null });
  assert.equal((await getLeaderboard(guildId, "xp", 1)).entries.length, 0);
  assert.equal((await getLeaderboard(guildId, "prestige", 1)).entries[0].prestige, 1);
  assert.equal(await prestigeMember(guildId, userId, 1), false);
  assert.equal(await post("after-prestige", 61), null);

  for (let level = 1; level <= levelForXp(MAX_XP); level++) {
    const threshold = xpForLevel(level);
    assert.equal(levelForXp(threshold - 1), level - 1);
    assert.deepEqual(levelProgress(threshold), { level, current: 0, needed: xpForLevel(level + 1) - threshold });
  }
  await exercisePanel();
}

async function exercisePanel() {
  const { discordClient } = await import("../src/backend/bot/client");
  const { default: levelingRoutes } = await import("../src/backend/routes/leveling");
  const { default: countingRoutes } = await import("../src/backend/routes/counting");
  const { getLevelingConfig, saveLevelingConfig } = await import("../src/backend/services/levelingService");
  const secret = "isolated-leveling-test";
  process.env.JWT_SECRET = secret;
  process.env.ALLOWED_USER_ID = appOwner;
  Object.defineProperty(discordClient, "isReady", { value: () => true });

  const firstRole = "811111111111111111";
  const highestRole = "822222222222222222";
  const unrelatedRole = "833333333333333333";
  const held = new Set([unrelatedRole]);
  const rewardRoles = new Map([firstRole, highestRole].map((id) => [id, { id, managed: false }]));
  const guild = {
    id: guildId,
    available: true,
    roles: { fetch: async () => rewardRoles },
    members: {
      fetchMe: async () => ({
        permissions: { has: (flag: bigint) => flag === PermissionFlagsBits.ManageRoles },
        roles: { highest: { comparePositionTo: () => 1 } },
      }),
      fetch: async ({ user }: { user: string }) => {
        if (user === userId) return member;
        if (user === discordAdmin) return { permissions: { has: (flag: bigint) => flag === PermissionFlagsBits.ManageGuild } };
        throw new Error("Not a guild member");
      },
    },
  };
  const member = {
    id: userId, guild, user: { bot: false }, displayName: "Test member", permissions: { has: () => false },
    roles: { cache: held, add: async (id: string) => held.add(id), remove: async (id: string) => held.delete(id) },
  };
  Object.defineProperty(discordClient.guilds.cache, "get", { value: (id: string) => id === guildId ? guild : undefined });
  const app = express();
  app.use(express.json());
  app.use("/api/guilds", countingRoutes, levelingRoutes);
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const port = (server.address() as AddressInfo).port;
    const call = (route: string, user?: string, body?: object, method = "PUT") => fetch(
      `http://127.0.0.1:${port}/api/guilds/${guildId}/${route}`, {
        method: body ? method : "GET",
        body: body ? JSON.stringify(body) : undefined,
        headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${jwt.sign({ id: user }, secret)}` } : {}) },
      },
    );
    assert.equal((await call("leveling")).status, 401);
    assert.equal((await call("leveling", appOwner, {})).status, 403);
    assert.equal((await call("counting/reset", userId, { confirmed: true }, "POST")).status, 403);
    assert.equal((await call("leveling", discordAdmin)).status, 200);
    assert.equal((await call("leveling", discordAdmin, { enabled: true })).status, 400);
    const config = await getLevelingConfig(guildId);
    const rewards = [{ level: 1, roleId: firstRole }, { level: 5, roleId: highestRole }];
    assert.equal((await call("leveling", discordAdmin, {
      ...config, excludedChannelIds: [], rewards: [{ level: 1, roleId: unrelatedRole }],
    })).status, 400);
    assert.equal((await call("leveling", discordAdmin, { ...config, excludedChannelIds: [], rewards })).status, 200);
    const route = `leveling/members/${userId}`;
    const response = await call(route, discordAdmin);
    assert.equal(response.status, 200);
    const { revision } = await response.json();
    assert.equal((await call(route, discordAdmin, { xp: 500, revision })).status, 400);
    assert.equal((await call(route, discordAdmin, { xp: 500, revision, confirmed: true })).status, 200);
    assert.deepEqual([...held], [unrelatedRole, firstRole, highestRole]);
    assert.equal((await call(route, discordAdmin, { xp: 600, revision, confirmed: true })).status, 409);
    await saveLevelingConfig(guildId, { ...config, rewards, highestOnly: true });
    assert.equal((await call(route, discordAdmin, { xp: 500, revision: revision + 1, confirmed: true })).status, 200);
    assert.deepEqual([...held], [unrelatedRole, highestRole]);
    assert.equal((await call(route, discordAdmin, { xp: 0, revision: revision + 2, confirmed: true })).status, 200);
    assert.deepEqual([...held], [unrelatedRole]);
    assert.equal((await call("counting/reset", discordAdmin, { confirmed: true }, "POST")).status, 204);
    const stats = await (await call("counting", discordAdmin)).json();
    assert.equal(stats.nextNumber, "1");
    assert.equal(stats.record, "1");
  } finally {
    server.close();
  }
}

function run(args: string[], env: NodeJS.ProcessEnv) {
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (result.error) throw result.error;
  assert.equal(result.status, 0);
}

const phase = process.argv[2];
if (phase) {
  exercise(phase).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
} else {
  const directory = mkdtempSync(join(tmpdir(), "guildpilot-leveling-"));
  const env = { ...process.env, DATABASE_URL: `file:${join(directory, "test.db").replace(/\\/g, "/")}` };
  try {
    const tsx = require.resolve("tsx/cli");
    run([tsx, __filename, "seed-relay"], env);
    const prisma = require.resolve("prisma/build/index.js");
    run([prisma, "migrate", "resolve", "--applied", "0_init"], env);
    run([prisma, "migrate", "resolve", "--applied", "20261114000000_relay_count"], env);
    run([prisma, "migrate", "deploy"], env);
    run([tsx, __filename, "award"], env);
    run([tsx, __filename, "restart"], env);
    console.log("Leveling, prestige and Relay Count checks passed.");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
