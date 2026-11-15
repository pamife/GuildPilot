import { Router, RequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { PermissionFlagsBits as P } from "discord.js";
import { discordClient, hasMessageContentIntent } from "../bot/client";
import { privateModLogChannel } from "../bot/moderationLog";
import { AuthenticatedRequest, requireAuth } from "../middleware/authMiddleware";
import { isAllowedOrigin } from "../config/runtime";
import { getAutoModSettings, getModerationSettings, moderationDb as db } from "../services/moderationService";
import { authorizePermission, executeModeration, moderationAccess, ModerationError } from "../services/moderationActions";
import { parseAutoMod, parseSettings, snowflake } from "../services/moderationValidation";
import { createAutoModDetector } from "../bot/autoModHandler";
import { applicationGuildsFor } from "../services/applicationAccess";
import type { ModerationPermission } from "../../types/moderation";

const router = Router();
export const moderationCsrf: RequestHandler = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.headers.origin ? !isAllowedOrigin(req.headers.origin) : Boolean(req.cookies?.guildpilot_token) || !req.headers.authorization?.startsWith("Bearer ")) {
    return res.status(403).json({ error: "Untrusted or missing request origin." });
  }
  next();
};
export function moderationRoute(permission: ModerationPermission | "access", handler: (req: AuthenticatedRequest, res: Parameters<RequestHandler>[1], guild: NonNullable<ReturnType<typeof discordClient.guilds.cache.get>>) => Promise<unknown>): RequestHandler[] {
  return [requireAuth, moderationCsrf, async (req: AuthenticatedRequest, res) => {
    try {
      const guild = discordClient.guilds.cache.get(req.params.guildId);
      if (!guild?.available) throw new ModerationError("The bot is not connected to this server.", 503);
      if (permission === "access") {
        if (!(await moderationAccess(guild, req.user!.id)).length) throw new ModerationError("No moderation access in this server.", 403);
      } else await authorizePermission(guild, req.user!.id, permission);
      await handler(req, res, guild);
    } catch (error) {
      res.status(error instanceof ModerationError ? error.status : 503).json({ error: error instanceof ModerationError ? error.message : "Request could not be completed. Check bot connection and permissions." });
    }
  }];
}
export async function moderationGuildsFor(userId: string) {
  const guilds = [];
  for (const guild of discordClient.guilds.cache.values()) {
    if (guild.available && (await moderationAccess(guild, userId)).length) guilds.push({ id: guild.id, name: guild.name, icon: guild.iconURL(), memberCount: guild.memberCount });
  }
  return guilds;
}
router.get("/moderation-access", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const [moderation, applications] = await Promise.all([moderationGuildsFor(req.user!.id), applicationGuildsFor(req.user!.id)]);
    res.json([...new Map([...applications, ...moderation].map(guild => [guild.id, guild])).values()]);
  } catch { res.status(503).json({ error: "Could not verify moderation access." }); }
});
const path = "/:guildId/moderation";
router.get(`${path}/access`, ...moderationRoute("access", async (req, res, guild) => {
  const permissions = await moderationAccess(guild, req.user!.id);
  const [channels, roles, bot] = await Promise.all([guild.channels.fetch(), guild.roles.fetch(), guild.members.fetchMe({ force: true })]);
  const actor = await guild.members.fetch({ user: req.user!.id, force: true });
  res.json({ permissions, dmDefault: (await getModerationSettings(guild.id)).dmDefault,
    channels: [...channels.values()].filter(c => c && c.permissionsFor(actor)?.has(P.ViewChannel)).map(c => ({ id: c!.id, name: c!.name, type: c!.type })),
    roles: [...roles.values()].map(role => ({ id: role.id, name: role.name })),
    missingBotPermissions: ["ManageMessages", "ModerateMembers", "KickMembers", "BanMembers", "ManageChannels", "ViewAuditLog"].filter(name => !bot.permissions.has(P[name as keyof typeof P])),
    hasMessageContentIntent,
  });
}));
router.get(path, ...moderationRoute("settings", async (req, res, guild) => { res.json(await getModerationSettings(guild.id)); }));
router.put(path, ...moderationRoute("settings", async (req, res, guild) => {
  const settings = parseSettings(req.body);
  const roles = await guild.roles.fetch();
  if ([...settings.reviewRoleIds, ...settings.timeoutRoleIds, ...Object.values(settings.permissions ?? {}).flat()].some(id => id === guild.id || !roles.has(id))) throw new ModerationError("Choose roles from this server other than @everyone.");
  if (settings.logChannelId) await privateModLogChannel(guild, settings.logChannelId);
  const data = { ...settings, reviewRoleIds: JSON.stringify(settings.reviewRoleIds), timeoutRoleIds: JSON.stringify(settings.timeoutRoleIds), permissions: JSON.stringify(settings.permissions) };
  await db.moderationSettings.upsert({ where: { guildId: guild.id }, create: { guildId: guild.id, ...data }, update: data });
  res.json(await getModerationSettings(guild.id));
}));
router.get(`${path}/members`, ...moderationRoute("access", async (req, res, guild) => {
  const query = String(req.query.q ?? "").trim().slice(0, 100);
  if (!query) return res.json([]);
  const members = snowflake.test(query) ? [await guild.members.fetch({ user: query, force: true }).catch(() => null)] : [...(await guild.members.search({ query, limit: 20 })).values()];
  res.json(members.filter(Boolean).map(member => ({ id: member!.id, name: member!.displayName, username: member!.user.username })));
}));
router.post(`${path}/actions`, ...moderationRoute("access", async (req, res, guild) => {
  res.json(await executeModeration(guild, req.user!.id, req.body));
}));
router.get(`${path}/cases`, ...moderationRoute("cases", async (req, res, guild) => {
  const page = Math.floor(Math.max(1, Math.min(100000, Number(req.query.page) || 1)));
  const where: Prisma.ModerationCaseWhereInput = { guildId: guild.id };
  for (const key of ["targetId", "action", "status"] as const) if (typeof req.query[key] === "string" && req.query[key]) where[key] = req.query[key] as string;
  if (req.query.source === "automod") where.moderatorId = null;
  if (req.query.source === "manual") where.moderatorId = { not: null };
  if (req.query.source === "review") where.reviewId = { not: null };
  if (typeof req.query.q === "string" && req.query.q) where.reason = { contains: req.query.q.slice(0, 100) };
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  if ((from && !Number.isFinite(from.getTime())) || (to && !Number.isFinite(to.getTime()))) throw new ModerationError("Invalid date filter.");
  if (from || to) where.createdAt = { gte: from, lte: to };
  const [items, total] = await Promise.all([db.moderationCase.findMany({ where, orderBy: { number: "desc" }, skip: (page - 1) * 25, take: 25 }), db.moderationCase.count({ where })]);
  res.json({ items, total, page });
}));
router.get(`${path}/cases/:number`, ...moderationRoute("cases", async (req, res, guild) => {
  const number = Number(req.params.number);
  if (!Number.isSafeInteger(number) || number < 1) throw new ModerationError("Invalid case number.");
  const record = await db.moderationCase.findUnique({ where: { guildId_number: { guildId: guild.id, number } } });
  if (!record) throw new ModerationError("Case not found.", 404);
  const history = await db.moderationCase.findMany({ where: { guildId: guild.id, OR: [{ reversesCaseNumber: number }, { number: record.reversesCaseNumber ?? -1 }] }, orderBy: { number: "asc" } });
  res.json({ record, history });
}));
router.get("/:guildId/automod", ...moderationRoute("settings", async (req, res, guild) => { res.json(await getAutoModSettings(guild.id)); }));
router.put("/:guildId/automod", ...moderationRoute("settings", async (req, res, guild) => {
  const settings = parseAutoMod(req.body);
  const [roles, channels] = await Promise.all([guild.roles.fetch(), guild.channels.fetch()]);
  if (Object.values(settings).some(rule => rule.exemptRoleIds.some((id: string) => id === guild.id || !roles.has(id)) || rule.exemptChannelIds.some((id: string) => !channels.has(id)))) throw new ModerationError("Invalid exception roles or channels.");
  const rules = JSON.stringify(settings);
  await db.autoModSettings.upsert({ where: { guildId: guild.id }, create: { guildId: guild.id, rules }, update: { rules } });
  res.json(settings);
}));
router.post("/:guildId/automod/preview", ...moderationRoute("settings", async (req, res, guild) => {
  const settings = parseAutoMod(req.body.settings);
  const detect = createAutoModDetector();
  if (!Array.isArray(req.body.messages) || req.body.messages.length > 50 || !req.body.messages.every((v: unknown) => typeof v === "string" && v.length <= 4000)) throw new ModerationError("Provide up to 50 test messages.");
  res.json(req.body.messages.map((content: string, index: number) => detect(settings, { guildId: guild.id, channelId: String(req.body.channelId ?? ""), parentId: null, userId: req.user!.id,
    roleIds: new Set<string>(Array.isArray(req.body.roleIds) ? req.body.roleIds : []), messageId: String(index), content, timestamp: Date.now() + index * 100 })));
}));
export default router;
