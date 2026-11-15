import { Router } from "express";
import { moderationRoute } from "./moderation";
import { moderationDb as db } from "../services/moderationService";
import { authorizePermission, hasModerationPermission, ModerationError } from "../services/moderationActions";
import { getModerationSettings } from "../services/moderationService";
import { getReviewSettings, parseReviewSettings, reviewChannel, runGeminiReview } from "../services/geminiReviewService";
import { privateModLogChannel } from "../bot/moderationLog";
import { hasMessageContentIntent } from "../bot/client";
const router = Router();
const path = '/:guildId/gemini';
router.get(`${path}/settings`, ...moderationRoute('settings', async (req, res, guild) => {
  res.json({ ...await getReviewSettings(guild.id), configured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL) });
}));
router.put(`${path}/settings`, ...moderationRoute('settings', async (req, res, guild) => {
  const config = parseReviewSettings(req.body);
  if (config.enabled && (!config.channelIds.length || !config.rules.trim())) throw new ModerationError('Select channels and supply server rules before enabling reviews.');
  if (config.enabled && !hasMessageContentIntent) throw new ModerationError('Message Content Intent is unavailable. Enable it and restart the bot.');
  for (const channelId of config.channelIds) await reviewChannel(guild, channelId, { ...config, enabled: true });
  if (config.reviewChannelId) await privateModLogChannel(guild, config.reviewChannelId);
  const existing = await getReviewSettings(guild.id);
  const data = { ...config, channelIds: JSON.stringify(config.channelIds), channelRules: JSON.stringify(config.channelRules) };
  await db.geminiSettings.upsert({ where: { guildId: guild.id }, create: { guildId: guild.id, ...data, nextRunAt: config.enabled ? new Date(Date.now() + 3600000) : null },
    update: { ...data, nextRunAt: config.enabled && !existing.enabled ? new Date(Date.now() + 3600000) : undefined } });
  res.json({ ...await getReviewSettings(guild.id), configured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL) });
}));
router.get(path, ...moderationRoute('review', async (req, res, guild) => {
  const settings = await getReviewSettings(guild.id);
  const page = Math.floor(Math.max(1, Math.min(100000, Number(req.query.page) || 1)));
  const status = ['open', 'reviewed', 'false_positive'].includes(String(req.query.status)) ? String(req.query.status) : undefined;
  const where = { guildId: guild.id, status };
  const [items, total, cursors] = await Promise.all([db.geminiHint.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * 25, take: 25 }), db.geminiHint.count({ where }), db.geminiCursor.findMany({ where: { guildId: guild.id } })]);
  const actor = await guild.members.fetch({ user: req.user!.id, force: true });
  const canReadCases = hasModerationPermission(actor, 'cases', await getModerationSettings(guild.id));
  const cases = canReadCases ? await db.moderationCase.findMany({ where: { guildId: guild.id, reviewId: { in: items.map(i => i.id) } }, select: { number: true, reviewId: true } }) : [];
  res.json({ items: items.map(item => ({ ...item, references: JSON.parse(item.references), cases: cases.filter(c => c.reviewId === item.id).map(c => c.number) })), total, page,
    status: { enabled: settings.enabled, configured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL), lastSuccessAt: settings.lastSuccessAt, nextRunAt: settings.nextRunAt, error: settings.error, cursors } });
}));
router.post(`${path}/run`, ...moderationRoute('review', async (req, res, guild) => {
  if (!hasMessageContentIntent) throw new ModerationError('Message Content Intent is unavailable.');
  res.json(await runGeminiReview(guild));
}));
router.patch(`${path}/hints/:hintId`, ...moderationRoute('review', async (req, res, guild) => {
  const hint = await db.geminiHint.findFirst({ where: { guildId: guild.id, id: req.params.hintId } });
  if (!hint) throw new ModerationError('Hint not found.', 404);
  const status = req.body.status;
  if (status !== undefined && !['open', 'reviewed', 'false_positive'].includes(status)) throw new ModerationError('Invalid review status.');
  const assignedTo = req.body.assignedTo;
  if (assignedTo !== undefined && assignedTo !== null) {
    if (typeof assignedTo !== 'string') throw new ModerationError('Invalid assignee.');
    await authorizePermission(guild, assignedTo, 'review');
  }
  const updated = await db.$transaction(async tx => {
    const result = await tx.geminiHint.update({ where: { id: hint.id }, data: { status, assignedTo, updatedBy: req.user!.id } });
    await tx.auditLog.create({ data: { guildId: guild.id, action: 'GEMINI_REVIEW', details: JSON.stringify({ hintId: hint.id, actorId: req.user!.id, status: result.status, assignedTo: result.assignedTo }) } });
    return result;
  });
  res.json({ id: updated.id, status: updated.status, assignedTo: updated.assignedTo });
}));
export default router;
