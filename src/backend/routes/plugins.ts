import { NextFunction, Request, Response, Router } from "express";
import { PermissionFlagsBits } from "discord.js";
import { changelogDefaults } from "../../types/changelog";
import { CHANGELOG_PLUGIN, PluginDefinition, plugins } from "../../types/plugins";
import { discordClient } from "../bot/client";
import { AuthenticatedRequest, requireAuth, requireManageServer, requireTrustedMutation } from "../middleware/authMiddleware";
import { deleteAnnouncement, deleteDraft, getChangelog, listChangelogs, publishChangelog, saveChangelog } from "../services/changelogService";
import { isChangelogChannel, parseChangelog, parseChangelogSettings, snowflake, validateDestination } from "../services/changelogValidation";
import { getGuildPlugin, listGuildPlugins, PluginError, saveGuildPlugin } from "../services/pluginService";
import { getUserManageableGuilds } from "../services/guildService";

const permissions = { "manage-server": requireManageServer } satisfies Record<PluginDefinition["permission"], typeof requireManageServer>;

function endpoint(handler: (req: AuthenticatedRequest, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res).catch(next);
  };
}

function guild(req: Request) {
  const guild = discordClient.guilds.cache.get(req.params.guildId);
  if (!guild?.available) throw new PluginError(503, "Der Bot ist nicht mit diesem Server verbunden.");
  return guild;
}

function draftId(req: Request) {
  if (!/^[a-f0-9]{32}$/.test(req.params.id)) throw new PluginError(400, "Ungültige Changelog-ID.");
  return req.params.id;
}

function revision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 2147483647) {
    throw new PluginError(400, "Ungültige Changelog-Version.");
  }
  return value;
}

function confirm(req: Request) {
  if (req.body?.confirmed !== true) throw new PluginError(400, "Bestätige zuerst diese Aktion.");
}

const changelog = Router({ mergeParams: true });
changelog.get("/settings", endpoint(async (req, res) => {
  res.json({ ...changelogDefaults, ...JSON.parse(res.locals.pluginConfig) });
}));
changelog.put("/settings", endpoint(async (req, res) => {
  const settings = parseChangelogSettings(req.body);
  await validateDestination(guild(req), settings.channelId, settings.roleId, settings.autoPing);
  await saveGuildPlugin(req.params.guildId, CHANGELOG_PLUGIN, { config: JSON.stringify(settings) });
  res.json(settings);
}));
changelog.get("/options", endpoint(async (req, res) => {
  const server = guild(req);
  const [channels, roles, bot] = await Promise.all([server.channels.fetch(), server.roles.fetch(), server.members.fetchMe()]);
  res.json({
    channels: [...channels.values()].filter(isChangelogChannel)
      .filter((channel) => channel.permissionsFor(bot).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]))
      .sort((a, b) => a.rawPosition - b.rawPosition).map(({ id, name }) => ({ id, name })),
    roles: [...roles.values()].filter(({ id }) => id !== server.id)
      .sort((a, b) => b.position - a.position).map(({ id, name }) => ({ id, name })),
  });
}));
changelog.get("/changelogs", endpoint(async (req, res) => {
  const page = typeof req.query.page === "string" ? Number(req.query.page) : 1;
  if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000) throw new PluginError(400, "Ungültige Seite.");
  if (req.query.view !== "drafts" && req.query.view !== "history") throw new PluginError(400, "Ungültige Ansicht.");
  res.json(await listChangelogs(req.params.guildId, req.query.view === "drafts", page));
}));
changelog.get("/changelogs/:id", endpoint(async (req, res) => {
  res.json(await getChangelog(req.params.guildId, draftId(req)));
}));
changelog.put("/changelogs/:id", endpoint(async (req, res) => {
  const id = draftId(req);
  const draftRevision = req.body?.revision === null ? null : revision(req.body?.revision);
  const content = parseChangelog(req.body?.content);
  res.json(await saveChangelog(req.params.guildId, id, draftRevision, content));
}));
changelog.delete("/changelogs/:id", endpoint(async (req, res) => {
  await deleteDraft(req.params.guildId, draftId(req), revision(req.body?.revision));
  res.sendStatus(204);
}));
changelog.post("/changelogs/:id/publish", endpoint(async (req, res) => {
  confirm(req);
  res.json(await publishChangelog(guild(req), draftId(req), revision(req.body?.revision), req.user!));
}));
changelog.delete("/changelogs/:id/announcement", endpoint(async (req, res) => {
  confirm(req);
  res.json(await deleteAnnouncement(guild(req), draftId(req)));
}));

const features: Partial<Record<string, Router>> = { [CHANGELOG_PLUGIN]: changelog };
const catalog = Router({ mergeParams: true });
catalog.get("/", requireManageServer, endpoint(async (req, res) => {
  res.json(await listGuildPlugins(req.params.guildId));
}));
for (const plugin of plugins) {
  const path = `/${plugin.id}`;
  catalog.use(path, permissions[plugin.permission]);
  catalog.patch(path, endpoint(async (req, res) => {
    if (typeof req.body?.enabled !== "boolean") throw new PluginError(400, "Ungültiger Plugin-Status.");
    const row = await saveGuildPlugin(req.params.guildId, plugin.id, { enabled: req.body.enabled });
    res.json({ ...plugin, enabled: row.enabled });
  }));

  const feature = features[plugin.id];
  if (feature) catalog.use(path, (req, res, next) => {
    void getGuildPlugin(req.params.guildId, plugin.id).then((row) => {
      if (!row?.enabled) throw new PluginError(409, `${plugin.name} ist für diesen Server deaktiviert.`);
      res.locals.pluginConfig = row.config;
      next();
    }).catch(next);
  }, feature);
}

const router = Router();
router.get("/plugin-access", requireAuth, endpoint(async (req, res) => {
  res.set("Cache-Control", "no-store").json(await getUserManageableGuilds(req.user!.id, { fresh: true }));
}));
router.use("/:guildId/plugins", requireAuth, requireTrustedMutation, (req, res, next) => {
  if (!snowflake(req.params.guildId)) return res.status(400).json({ error: "Ungültige Server-ID." });
  res.set("Cache-Control", "no-store");
  next();
}, catalog);
router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof PluginError) return res.status(error.status).json({ error: error.message });
  console.error("[Plugins] Request failed:", error);
  return res.status(502).json({ error: "Die Plugin-Anfrage konnte nicht abgeschlossen werden. Versuche es erneut." });
});

export default router;
