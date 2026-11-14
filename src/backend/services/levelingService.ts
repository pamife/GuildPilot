import { randomInt } from "node:crypto";
import { LevelingSettings, Prisma, PrismaClient } from "@prisma/client";
import { LevelingConfig, LevelReward, MAX_XP, Ranking, levelForXp } from "../../types/leveling";

const prisma = new PrismaClient();
let pendingAward = Promise.resolve();
const defaults: LevelingConfig = {
  enabled: false, minXp: 15, maxXp: 25, cooldownSeconds: 60,
  excludedChannelIds: [], excludeRelay: true, announce: false, announcementId: null,
  rewards: [], highestOnly: false, prestigeEnabled: false, prestigeLevel: 50,
};

function config(settings: LevelingSettings | null): LevelingConfig {
  if (!settings) return defaults;
  const { guildId, excludedChannelIds, rewards, ...values } = settings;
  return { ...values, excludedChannelIds: JSON.parse(excludedChannelIds), rewards: JSON.parse(rewards) };
}

export async function getLevelingConfig(guildId: string) {
  return config(await prisma.levelingSettings.findUnique({ where: { guildId } }));
}

export async function saveLevelingConfig(guildId: string, settings: LevelingConfig) {
  const data = { ...settings, excludedChannelIds: JSON.stringify(settings.excludedChannelIds), rewards: JSON.stringify(settings.rewards) };
  return config(await prisma.levelingSettings.upsert({ where: { guildId }, update: data, create: { guildId, ...data } }));
}

function memberKey(guildId: string, userId: string) {
  return { guildId_userId: { guildId, userId } };
}

export function getLevelingMember(guildId: string, userId: string) {
  return prisma.levelingMember.findUnique({ where: memberKey(guildId, userId) });
}

export function awardChatXp(message: {
  guildId: string; userId: string; channelId: string; parentId?: string | null; messageId: string; timestamp: Date;
}) {
  // Keep gateway events in arrival order and avoid competing SQLite transactions.
  const award = pendingAward.then(() => processChatXp(message));
  pendingAward = award.then(() => undefined, () => undefined);
  return award;
}

async function processChatXp(message: {
  guildId: string; userId: string; channelId: string; parentId?: string | null; messageId: string; timestamp: Date;
}) {
  const { guildId, userId, channelId, parentId, messageId, timestamp } = message;
  // Avoid opening a write transaction for every message in a disabled guild.
  if (!(await getLevelingConfig(guildId)).enabled) return null;

  return prisma.$transaction(async (tx) => {
    // Take the SQLite write lock before reading the balance and cooldown.
    const inserted = await tx.$executeRaw`INSERT OR IGNORE INTO "LevelingMessage" ("messageId") VALUES (${messageId})`;
    if (!inserted) return null;

    const settings = config(await tx.levelingSettings.findUnique({ where: { guildId } }));
    if (!settings.enabled || settings.excludedChannelIds.includes(channelId)
      || (parentId && settings.excludedChannelIds.includes(parentId))) return null;

    if (settings.excludeRelay) {
      const relay = await tx.countingGame.findUnique({ where: { guildId } });
      if (relay && (relay.channelId === channelId || relay.channelId === parentId)) return null;
    }

    const where = memberKey(guildId, userId);
    const previous = await tx.levelingMember.findUnique({ where });
    const elapsed = previous?.lastAwardAt ? timestamp.getTime() - previous.lastAwardAt.getTime() : Infinity;
    if (elapsed < settings.cooldownSeconds * 1000) return null;

    const xp = Math.min(MAX_XP, (previous?.xp ?? 0) + randomInt(settings.minXp, settings.maxXp + 1));
    const level = levelForXp(xp);
    const values = { xp, level, lastAwardAt: timestamp };
    await tx.levelingMember.upsert({
      where,
      create: { guildId, userId, ...values, revision: 1 },
      update: { ...values, revision: { increment: 1 } },
    });
    return { level, previousLevel: previous?.level ?? 0, settings };
  });
}

export async function setMemberXp(guildId: string, userId: string, xp: number, revision: number) {
  const level = levelForXp(xp);
  if (revision === 0) {
    const created = await prisma.$executeRaw`INSERT OR IGNORE INTO "LevelingMember"
      ("guildId", "userId", "xp", "level", "revision") VALUES (${guildId}, ${userId}, ${xp}, ${level}, 1)`;
    return created === 1;
  }
  const { count } = await prisma.levelingMember.updateMany({
    where: { guildId, userId, revision },
    data: { xp, level, revision: { increment: 1 } },
  });
  return count === 1;
}

export async function prestigeMember(guildId: string, userId: string, expectedPrestige: number) {
  const count = await prisma.$executeRaw`UPDATE "LevelingMember"
    SET "xp" = 0, "level" = 0, "prestige" = "prestige" + 1, "revision" = "revision" + 1
    WHERE "guildId" = ${guildId} AND "userId" = ${userId} AND "prestige" = ${expectedPrestige}
      AND EXISTS (SELECT 1 FROM "LevelingSettings" AS s WHERE s."guildId" = ${guildId}
        AND s."enabled" = 1 AND s."prestigeEnabled" = 1 AND "LevelingMember"."level" >= s."prestigeLevel")`;
  return count === 1;
}

function ahead(row: { userId: string; xp: number; prestige: number }, ranking: Ranking): Prisma.LevelingMemberWhereInput {
  return { OR: [{ [ranking]: { gt: row[ranking] } }, { [ranking]: row[ranking], userId: { lt: row.userId } }] };
}

export async function getRank(guildId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.levelingMember.findUnique({ where: memberKey(guildId, userId) });
    const position = row?.xp ? 1 + await tx.levelingMember.count({ where: { guildId, ...ahead(row, "xp") } }) : null;
    return { xp: row?.xp ?? 0, prestige: row?.prestige ?? 0, position };
  });
}

export async function getLeaderboard(guildId: string, ranking: Ranking, requestedPage: number, userIds?: string[]) {
  const where = { guildId, [ranking]: { gt: 0 }, userId: userIds ? { in: userIds } : undefined };
  const pageSize = 10;
  return prisma.$transaction(async (tx) => {
    const pages = Math.max(1, Math.ceil(await tx.levelingMember.count({ where }) / pageSize));
    const page = Math.max(1, Math.min(pages, requestedPage));
    const offset = (page - 1) * pageSize;
    const rows = await tx.levelingMember.findMany({
      where, orderBy: [{ [ranking]: "desc" }, { userId: "asc" }], skip: offset, take: pageSize,
    });
    const entries = await Promise.all(rows.map(async (row, index) => ({
      ...row,
      position: userIds ? 1 + await tx.levelingMember.count({ where: { guildId, ...ahead(row, ranking) } }) : offset + index + 1,
    })));
    return { page, pages, entries };
  });
}

export function desiredRewardIds(rewards: LevelReward[], level: number, highestOnly: boolean) {
  const earned = rewards.filter((reward) => reward.level <= level);
  const highest = Math.max(0, ...earned.map((reward) => reward.level));
  return new Set(earned.filter((reward) => !highestOnly || reward.level === highest).map((reward) => reward.roleId));
}
