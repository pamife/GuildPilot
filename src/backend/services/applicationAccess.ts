import { PrismaClient } from "@prisma/client";
import { GuildMember, PermissionFlagsBits } from "discord.js";
import { discordClient } from "../bot/client";
import { isOwner } from "../middleware/authMiddleware";

export const applicationDb = new PrismaClient();
export const noMentions = { parse: [] as [], repliedUser: false };

export function readStrings(value: string | null | undefined): string[] {
  try {
    const parsed: unknown = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

export async function applicationMember(guildId: string, userId: string) {
  const guild = discordClient.guilds.cache.get(guildId);
  return guild?.available ? guild.members.fetch({ user: userId, force: true }).catch(() => null) : null;
}

export function managesApplications(member: GuildMember) {
  return isOwner(member.id) || member.permissions.has(PermissionFlagsBits.ManageGuild);
}

export async function reviewerRoles(guildId: string, formRoles?: string | null) {
  const configured = readStrings(formRoles).filter(id => id !== guildId);
  if (configured.length) return configured;
  const settings = await applicationDb.appSettings.findUnique({ where: { guildId } });
  return readStrings(settings?.defaultReviewerRoles).filter(id => id !== guildId);
}

export async function canReview(member: GuildMember, app: {
  guildId: string;
  reviewerRoles?: string | null;
  form?: { reviewerRoles: string } | null;
}) {
  if (member.guild.id !== app.guildId) return false;
  if (managesApplications(member)) return true;
  const roles = app.form || app.reviewerRoles == null
    ? await reviewerRoles(app.guildId, app.form?.reviewerRoles)
    : readStrings(app.reviewerRoles);
  return roles.some(id => id !== app.guildId && member.roles.cache.has(id));
}

export async function applicationGuildAccess(member: GuildMember) {
  if (managesApplications(member)) return true;
  const guildId = member.guild.id;
  const [forms, detached, defaults] = await Promise.all([
    applicationDb.appForm.findMany({ where: { guildId }, select: { reviewerRoles: true } }),
    applicationDb.application.findMany({ where: { guildId, formId: null }, distinct: ["reviewerRoles"], select: { reviewerRoles: true } }),
    reviewerRoles(guildId),
  ]);
  const hasRole = (roles: string[]) => roles.some(id => id !== guildId && member.roles.cache.has(id));
  return forms.some(form => {
    const configured = readStrings(form.reviewerRoles).filter(id => id !== guildId);
    return hasRole(configured.length ? configured : defaults);
  }) || detached.some(app => hasRole(app.reviewerRoles == null ? defaults : readStrings(app.reviewerRoles)));
}

export async function reviewAccessFilter(member: GuildMember) {
  if (managesApplications(member)) return {};
  const guildId = member.guild.id;
  const [forms, detached, defaults] = await Promise.all([
    applicationDb.appForm.findMany({ where: { guildId }, select: { id: true, reviewerRoles: true } }),
    applicationDb.application.findMany({ where: { guildId, formId: null }, select: { id: true, reviewerRoles: true } }),
    reviewerRoles(guildId),
  ]);
  const hasRole = (roles: string[]) => roles.some(id => id !== guildId && member.roles.cache.has(id));
  return { OR: [
    { formId: { in: forms.filter(form => {
      const roles = readStrings(form.reviewerRoles).filter(id => id !== guildId);
      return hasRole(roles.length ? roles : defaults);
    }).map(form => form.id) } },
    { id: { in: detached.filter(app => hasRole(app.reviewerRoles == null ? defaults : readStrings(app.reviewerRoles))).map(app => app.id) } },
  ] };
}

export async function applicationGuildsFor(userId: string) {
  const guilds = await Promise.all([...discordClient.guilds.cache.keys()].map(async id => {
    const member = await applicationMember(id, userId);
    if (!member || !await applicationGuildAccess(member)) return null;
    return { id, name: member.guild.name, icon: member.guild.iconURL(), memberCount: member.guild.memberCount,
      ownerId: member.guild.ownerId };
  }));
  return guilds.filter(guild => guild !== null);
}

const operations = new Map<string, Promise<unknown>>();

// Discord and Express share one backend process. Serialize side effects by resource.
export async function serializeApplication<T>(key: string, action: () => Promise<T>): Promise<T> {
  const previous = operations.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(action);
  operations.set(key, current);
  try {
    return await current;
  } finally {
    if (operations.get(key) === current) operations.delete(key);
  }
}
