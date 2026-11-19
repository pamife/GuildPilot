import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { ChannelType, ComponentType, DiscordAPIError, MessageCreateOptions, MessageFlags, MessagePayload, PermissionFlagsBits, PermissionsBitField, RESTPostAPIChannelMessageJSONBody } from "discord.js";
import express from "express";
import jwt from "jsonwebtoken";
import { ChangelogContent, changelogDefaults, changelogLimits, newChangelog, newSection } from "../src/types/changelog";
import { CHANGELOG_PLUGIN } from "../src/types/plugins";

const guildA = "100000000000000001";
const guildB = "100000000000000002";
const admin = "100000000000000003";
const manager = "100000000000000004";
const outsider = "100000000000000005";
const owner = "100000000000000006";
const channelA = "100000000000000007";
const channelB = "100000000000000008";
const roleId = "100000000000000009";
const pingId = "100000000000000010";
const messageId = "100000000000000011";
const endpoint = `plugins/${CHANGELOG_PLUGIN}`;
const draft = (number: number) => number.toString(16).padStart(32, "0");

const settings = { ...changelogDefaults, channelId: channelA, roleId, autoPing: true, language: "de" as const, footer: "GuildPilot" };
const content: ChangelogContent = {
  ...newChangelog(settings),
  title: "Release @everyone", intro: "Server-Update @here", version: "v1.2.0",
  banner: "https://example.com/banner.png",
  sections: [{ ...newSection("features", "de"), entries: ["Tickets", `<@&${roleId}>`, `<@${admin}>`] }],
};

function discordError(code: number, status: number) {
  return new DiscordAPIError({ code, message: "Test Discord response" }, code, status, "POST", "https://discord.com/api", { files: undefined, body: undefined });
}

async function exercise() {
  const { discordClient } = await import("../src/backend/bot/client");
  const { getJwtSecret, restrictApplicationSession } = await import("../src/backend/middleware/authMiddleware");
  const { default: router } = await import("../src/backend/routes/plugins");
  const { buildChangelogAnnouncement } = await import("../src/backend/bot/changelogComponents");
  const { pluginDb } = await import("../src/backend/services/pluginService");
  process.env.ALLOWED_USER_ID = owner;
  process.env.JWT_SECRET = "plugin-test-secret";

  const maximum = buildChangelogAnnouncement({ ...content,
    sections: Array.from({ length: changelogLimits.sections }, () => content.sections[0]),
  }, new Date("2025-08-12T11:00:00Z"));
  assert.equal(maximum.components?.length, 1);

  Object.defineProperty(discordClient, "isReady", { value: () => true });
  const sent: RESTPostAPIChannelMessageJSONBody[] = [];
  const deleted: string[] = [];
  let problem: "reject" | "timeout" | "delete" | undefined;
  let mentionable = true;
  let maySend = true;
  let mayView = true;
  let authorized = true;
  let waitForSend: Promise<void> | undefined;
  let onAnnouncement: (() => void) | undefined;

  function seedGuild(guildId: string, channelId: string) {
    const role = { id: roleId, guild: { id: guildA }, name: "Release news", position: 1, get mentionable() { return mentionable; } };
    const channel = {
      id: channelId, guildId, name: "announcements", type: ChannelType.GuildAnnouncement, rawPosition: 1,
      permissionsFor: () => new PermissionsBitField([
        ...(maySend ? [PermissionFlagsBits.SendMessages] : []),
        ...(mayView ? [PermissionFlagsBits.ViewChannel] : []),
      ]),
      async send(options: MessageCreateOptions) {
        const body = MessagePayload.create({ client: discordClient } as never, options).resolveBody().body as RESTPostAPIChannelMessageJSONBody;
        sent.push(body);
        if (options.content) return { id: pingId, mentions: { roles: new Map([[roleId, role]]) } };
        onAnnouncement?.();
        await waitForSend;
        if (problem === "reject" || problem === "delete") throw discordError(50035, 400);
        if (problem === "timeout") throw new Error("Connection lost after request");
        return { id: messageId };
      },
      messages: {
        async delete(id: string) {
          if (problem === "delete") throw discordError(50013, 403);
          if (deleted.includes(id)) throw discordError(10008, 404);
          deleted.push(id);
        },
      },
    };
    const everyone = { id: guildId, name: "@everyone", position: 0 };
    const guild = {
      id: guildId, available: true, name: guildId, iconURL: () => null, memberCount: 10,
      channels: { fetch: async (id?: string) => id ? id === channelId ? channel : null : new Map([[channelId, channel]]) },
      roles: { fetch: async (id?: string) => id ? guildId === guildA && id === roleId ? role : null
        : new Map([...(guildId === guildA ? [[roleId, role] as const] : []), [guildId, everyone] as const]) },
      members: {
        cache: new Map(),
        fetchMe: async () => ({}),
        fetch: async (input: string | { user: string }) => {
          const id = typeof input === "string" ? input : input.user;
          if (id === outsider || id === owner) throw new Error("Not a member");
          const discordPermissions = id === admin && authorized ? PermissionFlagsBits.Administrator
            : id === manager && guildId === guildB ? PermissionFlagsBits.ManageGuild : 0n;
          return { permissions: new PermissionsBitField(discordPermissions) };
        },
      },
    };
    discordClient.guilds.cache.set(guildId, guild as never);
  }
  seedGuild(guildA, channelA);
  seedGuild(guildB, channelB);

  const app = express();
  app.use(restrictApplicationSession);
  app.use(express.json());
  app.use("/api/guilds", router);
  app.get("/api/guilds/:id", (_req, res) => res.send("Other feature"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/guilds`;
  const token = (id: string, scope?: string) => jwt.sign({ id, username: "Publisher", scope }, getJwtSecret());
  const call = (path: string, opts: { guild?: string; user?: string | null; scope?: string; method?: string; body?: unknown; origin?: string } = {}) => {
    const { guild = guildA, user = admin, scope = "staff", method = "GET", body, origin } = opts;
    return fetch(`${base}/${[guild, path].filter(Boolean).join("/")}`, {
      method, body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        ...(user ? { Authorization: `Bearer ${token(user, scope)}` } : {}),
        ...(origin ? { Origin: origin } : {}),
      },
    });
  };
  const item = (id: number) => `${endpoint}/changelogs/${draft(id)}`;
  const toggle = (enabled: boolean, guild = guildA) => call(endpoint, { guild, method: "PATCH", body: { enabled } });
  const save = (id: number, body = content, rev: number | null = null, guild = guildA) =>
    call(item(id), { guild, method: "PUT", body: { revision: rev, content: body } });
  const publish = (id: number, revision = 0, confirmed = true) =>
    call(`${item(id)}/publish`, { method: "POST", body: { revision, confirmed } });
  const remove = (id: number) => call(`${item(id)}/announcement`, { method: "DELETE", body: { confirmed: true } });

  try {
    assert.equal((await call("plugins", { user: null })).status, 401);
    assert.equal((await call("plugins", { user: outsider })).status, 403);
    assert.equal((await call("plugins", { user: owner })).status, 403);
    assert.equal((await call("plugins", { user: manager })).status, 403);
    assert.equal((await call("plugins", { user: manager, guild: guildB, scope: "plugins" })).status, 200);
    assert.equal((await call("", { user: manager, guild: guildB, scope: "plugins" })).status, 403);
    const accessible = await (await call("plugin-access", { guild: "", user: manager, scope: "plugins" })).json();
    assert.deepEqual(accessible.map((row: { id: string }) => row.id), [guildB]);
    assert.equal((await call(endpoint, { method: "PATCH", origin: "https://untrusted.example", body: { enabled: true } })).status, 403);
    assert.equal((await call(`${endpoint}/settings`)).status, 409);
    assert.equal((await toggle(true)).status, 200);
    assert.equal((await (await call("plugins", { guild: guildB })).json())[0].enabled, false);
    assert.equal((await call(`${endpoint}/settings`, { guild: guildB })).status, 409);
    assert.equal((await toggle(true, guildB)).status, 200);
    authorized = false;
    assert.equal((await call(`${endpoint}/settings`)).status, 403);
    authorized = true;

    assert.equal((await call(`${endpoint}/settings`, { method: "PUT", body: settings })).status, 200);
    assert.deepEqual(await (await call(`${endpoint}/settings`)).json(), settings);
    assert.deepEqual(await (await call(`${endpoint}/settings`, { guild: guildB })).json(), changelogDefaults);
    assert.deepEqual(await (await call(`${endpoint}/options`)).json(), {
      channels: [{ id: channelA, name: "announcements" }], roles: [{ id: roleId, name: "Release news" }],
    });
    assert.equal((await toggle(false)).status, 200);
    assert.equal((await save(1)).status, 409);
    assert.equal((await toggle(true)).status, 200);
    assert.deepEqual(await (await call(`${endpoint}/settings`)).json(), settings);

    assert.equal((await save(1, { ...content, banner: "javascript:invalid" })).status, 400);
    assert.equal((await save(1, { ...content, sections: Array(31).fill(content.sections[0]) })).status, 400);
    assert.equal((await save(1)).status, 200);
    assert.equal((await save(1)).status, 200);
    assert.equal((await save(1, { ...content, version: "v2" }, 0)).status, 200);
    assert.equal((await save(1, content, 0)).status, 409);
    const stored = await (await call(item(1))).json();
    assert.equal(stored.content.version, "v2");
    const reopened = new PrismaClient();
    try {
      const saved = await reopened.guildChangelog.findUniqueOrThrow({ where: { guildId_id: { guildId: guildA, id: draft(1) } } });
      assert.deepEqual(JSON.parse(saved.content), stored.content);
    } finally {
      await reopened.$disconnect();
    }
    assert.deepEqual(await (await call(`${endpoint}/changelogs?view=drafts`, { guild: guildB })).json(), { items: [], hasNext: false });
    assert.equal((await call(item(1), { guild: guildB })).status, 404);
    assert.equal((await publish(1, 1, false)).status, 400);

    assert.equal((await save(2, { ...content, sections: [{ ...content.sections[0], entries: Array(20).fill("*".repeat(300)) }] })).status, 200);
    assert.match((await (await publish(2)).json()).error, /4.000/);
    assert.equal((await save(3, { ...content, roleId: guildA })).status, 200);
    assert.match((await (await publish(3)).json()).error, /Ping-Rolle/);
    assert.equal((await save(4, { ...content, channelId: channelB })).status, 200);
    assert.match((await (await publish(4)).json()).error, /Zugriff/);
    maySend = false;
    assert.match((await (await publish(1, 1)).json()).error, /keine Nachrichten senden/);
    maySend = true;
    mayView = false;
    assert.match((await (await publish(1, 1)).json()).error, /nicht sehen/);
    mayView = true;
    mentionable = false;
    assert.match((await (await publish(1, 1)).json()).error, /nicht erwähnen/);
    mentionable = true;
    assert.equal(sent.length, 0);

    let release!: () => void;
    waitForSend = new Promise<void>((resolve) => { release = resolve; });
    const sending = new Promise<void>((resolve) => { onAnnouncement = resolve; });
    const first = publish(1, 1);
    await Promise.race([sending, first.then((response) => assert.fail(`Publish ended before Discord send started (${response.status}).`))]);
    try {
      assert.equal((await publish(1, 1)).status, 409);
      assert.equal((await save(1, content, 1)).status, 409);
      assert.equal((await call(item(1), { method: "DELETE", body: { revision: 1 } })).status, 409);
    } finally {
      release();
    }
    const published = await (await first).json();
    const again = await (await publish(1, 1)).json();
    assert.equal(again.messageId, messageId);
    assert.equal(published.status, "published");
    assert.equal(published.messageId, messageId);
    assert.equal(published.pingMessageId, pingId);
    assert.equal(published.publisherId, admin);
    assert.equal(published.channelId, channelA);
    assert.ok(Math.abs(Date.now() - Date.parse(published.publishedAt)) < 60_000);
    assert.equal(sent.length, 2);
    const [ping, announcement] = sent;
    assert.equal(ping.content, `<@&${roleId}>`);
    assert.equal(ping.flags, undefined);
    assert.deepEqual(ping.allowed_mentions, { parse: [], roles: [roleId], users: [], replied_user: false });
    assert.equal(announcement.content, undefined);
    assert.equal(announcement.flags, MessageFlags.IsComponentsV2);
    assert.deepEqual(announcement.allowed_mentions, { parse: [], roles: [], users: [], replied_user: false });
    assert.equal(announcement.enforce_nonce, true);
    assert.notEqual(announcement.nonce, ping.nonce);
    const [container] = announcement.components ?? [];
    assert.equal(container.type, ComponentType.Container);
    if (container.type !== ComponentType.Container) throw new Error("Expected a container");
    assert.equal(container.accent_color, 0x5865f2);
    assert.equal(container.components.filter(({ type }) => type === ComponentType.Separator).length, 2);
    assert.equal(container.components.some(({ type }) => type === ComponentType.MediaGallery), true);
    const text = container.components.filter((component) => component.type === ComponentType.TextDisplay).map(({ content }) => content).join("\n");
    assert.match(text, /Veröffentlicht am/);
    assert.match(text, /Tickets/);
    assert.doesNotMatch(text, /@everyone|@here|<@&?\d/);
    assert.deepEqual(await (await call(`${endpoint}/changelogs?view=history`, { guild: guildB })).json(), { items: [], hasNext: false });
    assert.equal((await remove(1)).status, 200);
    assert.equal((await remove(1)).status, 200);
    assert.deepEqual(deleted, [messageId, pingId]);
    assert.equal((await (await call(item(1))).json()).status, "deleted");

    assert.equal((await save(5)).status, 200);
    problem = "reject";
    deleted.length = 0;
    assert.equal((await publish(5)).status, 502);
    assert.deepEqual(deleted, [pingId]);
    assert.equal((await (await call(item(5))).json()).status, "draft");
    assert.equal((await save(6)).status, 200);
    problem = "delete";
    assert.equal((await publish(6)).status, 502);
    assert.equal((await (await call(item(6))).json()).status, "failed");
    problem = undefined;
    assert.equal((await remove(6)).status, 200);
    assert.equal((await save(7, { ...content, ping: false })).status, 200);
    problem = "timeout";
    assert.equal((await publish(7)).status, 409);
    assert.equal((await (await call(item(7))).json()).status, "publishing");
    const count = sent.length;
    assert.equal((await publish(7)).status, 409);
    assert.equal(sent.length, count);
    assert.equal((await call(item(2), { method: "DELETE", body: { revision: 0 } })).status, 204);
    assert.equal((await call(item(2))).status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await discordClient.destroy();
    await pluginDb.$disconnect();
  }
}

if (process.argv.includes("--exercise")) {
  exercise().catch((error) => { console.error(error); process.exitCode = 1; });
} else {
  const directory = mkdtempSync(join(tmpdir(), "guildpilot-plugins-"));
  const database = join(directory, "test.db");
  const env = { ...process.env, DATABASE_URL: `file:${database.replace(/\\/g, "/")}` };
  try {
    writeFileSync(database, "");
    for (const args of [
      [require.resolve("prisma/build/index.js"), "migrate", "deploy"],
      [require.resolve("tsx/cli"), __filename, "--exercise"],
    ]) {
      const result = spawnSync(process.execPath, args, { env, stdio: "inherit", timeout: 60_000 });
      if (result.error) throw result.error;
      assert.equal(result.status, 0);
    }
    console.log("Guild plugin and Changelog Publisher checks passed.");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
