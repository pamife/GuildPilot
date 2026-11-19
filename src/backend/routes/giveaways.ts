import { NextFunction, Request, Response, Router } from "express";
import { GIVEAWAYS_PLUGIN } from "../../types/plugins";
import { discordClient } from "../bot/client";
import { entryAnnouncement } from "../bot/giveawayComponents";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { snowflake } from "../services/changelogValidation";
import { PluginError } from "../services/pluginService";
import { manageClaim } from "../services/giveaways/claims";
import { acceptShortage, drawInitial, publishResults, replaceCandidate, reviewCandidate } from "../services/giveaways/drawing";
import { createGiveaway, editAppearance, editGiveaway, lifecycle, lifecycleActions, LifecycleAction } from "../services/giveaways/lifecycle";
import { participantAction } from "../services/giveaways/participants";
import { analytics, auditList, details, filters, list, listViews, participantDetail, participants, transparency } from "../services/giveaways/queries";
import { audit, configOf, db, enabled, getGiveaway, saveSettings, settingsOf, transaction } from "../services/giveaways/store";
import { conflict, date, integer, invalid, object, options, parseConfig, parseId, parseSettings, policy, reason, string, validateConfig } from "../services/giveaways/validation";

const router = Router({ mergeParams: true });

function endpoint(handler: (request: AuthenticatedRequest, response: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => void handler(req, res).catch(next);
}

function guild(req: Request) {
  const found = discordClient.guilds.cache.get(req.params.guildId);
  if (!found?.available) throw new PluginError(503, "Der Bot ist nicht mit diesem Server verbunden.");
  return found;
}

const giveId = (req: Request) => parseId(req.params.giveawayId);
const version = (body: Record<string, unknown>) => integer(body.revision, "Version", 0, 2_147_483_647);
const timing = (body: Record<string, unknown>) => ({ startAt: date(body.startAt), endAt: date(body.endAt) });
const queryText = (value: unknown) => value === undefined ? "" : string(value, "Suchbegriff", 120);

function page(req: Request) {
  const value = req.query.page;
  return value === undefined ? 1 : integer(typeof value === "string" && /^\d+$/.test(value) ? Number(value) : null, "Seite", 1, 1_000_000);
}

function confirm(body: Record<string, unknown>) {
  if (body.confirmed !== true) invalid("Bestätige zuerst diese Aktion.");
}

router.get("/settings", endpoint(async (req, res) => {
  const row = await db.guildPlugin.findUnique({
    where: { guildId_pluginId: { guildId: req.params.guildId, pluginId: GIVEAWAYS_PLUGIN } },
  });
  res.json({ enabled: row?.enabled ?? false, settings: settingsOf(row?.config) });
}));
router.put("/settings", endpoint(async (req, res) => {
  const settings = parseSettings(req.body);
  await validateConfig(guild(req), settings);
  res.json(await saveSettings(req.params.guildId, req.user!, settings));
}));
router.get("/options", endpoint(async (req, res) => res.json(await options(guild(req)))));
router.get("/analytics", endpoint(async (req, res) => res.json(await analytics(req.params.guildId))));
router.get("/audit", endpoint(async (req, res) => {
  const event = queryText(req.query.event) || undefined;
  const giveawayId = req.query.giveawayId === undefined ? undefined : parseId(req.query.giveawayId);
  res.json(await auditList(req.params.guildId, page(req), event, giveawayId));
}));

router.get("/items", endpoint(async (req, res) => {
  const view = req.query.view ?? "all";
  if (typeof view !== "string" || (view !== "all" && !Object.hasOwn(listViews, view))) invalid("Ungültige Ansicht.");
  res.json(await list(req.params.guildId, view, page(req), queryText(req.query.search)));
}));
router.post("/preview", endpoint(async (req, res) => {
  const body = object(req.body);
  const config = parseConfig(body.config);
  const endAt = date(body.endAt);
  res.json(entryAnnouncement(config, { id: "0".repeat(32), status: "ACTIVE", endAt, publishedRound: 0, commitment: "Preview" }, 0, "Preview", true));
}));
router.post("/items", endpoint(async (req, res) => {
  const body = object(req.body);
  const config = parseConfig(body.config);
  await validateConfig(guild(req), config);
  const row = await createGiveaway(req.params.guildId, req.user!, config, timing(body), parseId(body.requestId));
  res.status(201).json(row);
}));
router.get("/items/:giveawayId", endpoint(async (req, res) => res.json(await details(req.params.guildId, giveId(req)))));
router.put("/items/:giveawayId", endpoint(async (req, res) => {
  const body = object(req.body);
  const config = parseConfig(body.config);
  await validateConfig(guild(req), config);
  res.json(await editGiveaway(req.params.guildId, giveId(req), req.user!, version(body), config, timing(body)));
}));
router.put("/items/:giveawayId/appearance", endpoint(async (req, res) => {
  const body = object(req.body);
  res.json(await editAppearance(req.params.guildId, giveId(req), req.user!, version(body), parseConfig(body.config)));
}));
router.post("/items/:giveawayId/lifecycle/:action", endpoint(async (req, res) => {
  const body = object(req.body);
  const action = req.params.action as LifecycleAction;
  if (!lifecycleActions.includes(action)) invalid("Unbekannte Statusaktion.");
  if (["cancel", "end", "publish"].includes(action)) confirm(body);
  if (action === "publish" || action === "schedule") {
    await validateConfig(guild(req), configOf(await getGiveaway(req.params.guildId, giveId(req))), true);
  }
  await lifecycle(req.params.guildId, giveId(req), req.user!, version(body), action, action === "extend" ? date(body.endAt) : undefined);
  res.sendStatus(204);
}));
router.get("/items/:giveawayId/participants", endpoint(async (req, res) => {
  const filter = req.query.filter ?? "all";
  if (typeof filter !== "string" || !Object.hasOwn(filters, filter)) invalid("Unbekannter Teilnehmerfilter.");
  res.json(await participants(req.params.guildId, giveId(req), filter as keyof typeof filters, page(req), queryText(req.query.search)));
}));
router.get("/items/:giveawayId/participants/:userId", endpoint(async (req, res) => {
  if (!snowflake(req.params.userId)) invalid("Ungültige Discord-ID.");
  const item = await participantDetail(req.params.guildId, giveId(req), req.params.userId);
  if (!item) throw new PluginError(404, "Teilnahme nicht gefunden.");
  res.json(item);
}));
router.post("/items/:giveawayId/participants/:userId/:action", endpoint(async (req, res) => {
  const { userId, action } = req.params;
  if (!snowflake(userId) || (action !== "recheck" && action !== "exclude" && action !== "acknowledge")) invalid("Ungültige Teilnahmeaktion.");
  await participantAction(guild(req), giveId(req), userId, req.user!, action, action === "recheck" ? undefined : reason(req.body?.reason));
  res.sendStatus(204);
}));
router.post("/items/:giveawayId/draw", endpoint(async (req, res) => {
  const body = object(req.body);
  await drawInitial(req.params.guildId, giveId(req), req.user!, version(body));
  res.sendStatus(204);
}));
router.post("/items/:giveawayId/candidates/:candidateId/:action", endpoint(async (req, res) => {
  const body = object(req.body);
  const candidateId = parseId(req.params.candidateId);
  const { action } = req.params;
  if (action === "replace") {
    const result = await replaceCandidate(guild(req), giveId(req), candidateId, req.user!, reason(body.reason), policy(body.policy), version(body));
    return res.json(result);
  }
  if (action !== "approve" && action !== "reject" && action !== "recheck") invalid("Ungültige Gewinneraktion.");
  const result = await reviewCandidate(guild(req), giveId(req), candidateId, req.user!, action, version(body),
    action === "reject" ? reason(body.reason) : undefined, action === "reject" ? policy(body.policy) : undefined);
  res.json(result);
}));
router.post("/items/:giveawayId/shortage", endpoint(async (req, res) => {
  const body = object(req.body);
  await acceptShortage(req.params.guildId, giveId(req), req.user!, version(body), reason(body.reason));
  res.sendStatus(204);
}));
router.post("/items/:giveawayId/results", endpoint(async (req, res) => {
  const body = object(req.body);
  confirm(body);
  const result = await publishResults(guild(req), giveId(req), req.user!, version(body));
  res.status(result.queued ? 202 : 409).json(result.queued ? result : { error: "Die abschließende Prüfung erfordert eine manuelle Entscheidung." });
}));
router.post("/items/:giveawayId/claims/:claimId/:action", endpoint(async (req, res) => {
  const body = object(req.body);
  const { action } = req.params;
  if (action !== "extend" && action !== "fulfill" && action !== "cancel") invalid("Ungültige Abholaktion.");
  if (action !== "extend") confirm(body);
  await manageClaim(req.params.guildId, giveId(req), parseId(req.params.claimId), req.user!, action,
    action === "extend" ? date(body.deadline) : undefined,
    action === "cancel" ? reason(body.notes) : string(body.notes ?? "", "Notizen", 1000, 0, true));
  res.sendStatus(204);
}));
router.post("/items/:giveawayId/jobs/:jobId/retry", endpoint(async (req, res) => {
  const giveawayId = giveId(req);
  const jobId = string(req.params.jobId, "Zustell-ID", 96, 1);
  await getGiveaway(req.params.guildId, giveawayId);
  const updated = await db.giveawayJob.updateMany({
    where: { id: jobId, giveawayId, guildId: req.params.guildId, doneAt: null, error: { not: null },
      OR: [{ lockUntil: null }, { lockUntil: { lt: new Date() } }] },
    data: { runAt: new Date() },
  });
  if (!updated.count) conflict("Die Zustellung läuft bereits oder wurde abgeschlossen.");
  res.sendStatus(204);
}));
router.get("/items/:giveawayId/transparency", endpoint(async (req, res) =>
  res.json(await transparency(req.params.guildId, giveId(req), req.query.redacted === "true"))));

router.get("/templates", endpoint(async (req, res) => {
  const where = { guildId: req.params.guildId };
  const [rows, total] = await Promise.all([
    db.giveawayTemplate.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], skip: (page(req) - 1) * 25, take: 25 }),
    db.giveawayTemplate.count({ where }),
  ]);
  res.json({ items: rows.map(row => ({ ...row, config: configOf(row) })), total, pages: Math.max(1, Math.ceil(total / 25)) });
}));
router.put("/templates/:templateId", endpoint(async (req, res) => {
  const body = object(req.body);
  const guildId = req.params.guildId;
  const templateId = parseId(req.params.templateId);
  const name = string(body.name, "Vorlagenname", 120, 1);
  const config = parseConfig(body.config);
  await validateConfig(guild(req), config);
  const saved = await transaction(async tx => {
    if (!await enabled(tx, guildId)) conflict("Giveaways ist für diesen Server deaktiviert.");
    const before = await tx.giveawayTemplate.findUnique({ where: { id: templateId } });
    if (before && before.guildId !== guildId) throw new PluginError(404, "Vorlage nicht gefunden.");
    const data = { name, config: JSON.stringify(config) };
    const item = await tx.giveawayTemplate.upsert({ where: { id: templateId }, update: data, create: { id: templateId, guildId, ...data } });
    await audit(tx, guildId, null, req.user!, before ? "TEMPLATE_UPDATED" : "TEMPLATE_CREATED",
      { templateId, before: before?.name, after: name });
    return item;
  });
  res.json({ ...saved, config: configOf(saved) });
}));
router.delete("/templates/:templateId", endpoint(async (req, res) => {
  confirm(object(req.body));
  const guildId = req.params.guildId;
  const templateId = parseId(req.params.templateId);
  await transaction(async tx => {
    const template = await tx.giveawayTemplate.findFirst({ where: { id: templateId, guildId } });
    if (!template) throw new PluginError(404, "Vorlage nicht gefunden.");
    await tx.giveawayTemplate.delete({ where: { id: template.id } });
    await audit(tx, guildId, null, req.user!, "TEMPLATE_DELETED", { templateId, name: template.name });
  });
  res.sendStatus(204);
}));

export default router;
