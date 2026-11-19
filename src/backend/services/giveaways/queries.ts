import { Prisma } from "@prisma/client";
import { Giveaway, GiveawayEntry } from "@prisma/client";
import { configOf, db, getGiveaway, publicGiveaway } from "./store";
import { originalUrl } from "./delivery";
import { snapshotLine } from "./participants";

const pageSize = 25;
const paginate = (page: number) => ({ skip: (page - 1) * pageSize, take: pageSize });
const paged = <T>(items: T[], total: number) => ({ items, total, pages: Math.max(1, Math.ceil(total / pageSize)) });

export const listViews: Record<string, string[]> = {
  active: ["ACTIVE", "PAUSED"], scheduled: ["SCHEDULED"], review: ["ENDED", "DRAW_PENDING", "WINNER_REVIEW"],
  drafts: ["DRAFT"], history: ["AWAITING_CLAIM", "COMPLETED", "CANCELLED", "FAILED"],
};

export async function list(guildId: string, view: string, page: number, search: string) {
  const where: Prisma.GiveawayWhereInput = {
    guildId, status: listViews[view] ? { in: listViews[view] } : undefined,
    config: search ? { contains: search } : undefined,
  };
  const [rows, total] = await Promise.all([
    db.giveaway.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], ...paginate(page),
      include: { _count: { select: { entries: { where: { withdrawnAt: null } } } } },
    }),
    db.giveaway.count({ where }),
  ]);
  const valid = await db.giveawayEntry.groupBy({ by: ["giveawayId"], where: {
    giveawayId: { in: rows.map(row => row.id) }, withdrawnAt: null, eligibility: "ELIGIBLE",
  }, _count: true });
  const counts = new Map(valid.map(row => [row.giveawayId, row._count]));
  return paged(rows.map(row => ({
    ...publicGiveaway(row), participantCount: row._count.entries, validCount: counts.get(row.id) ?? 0,
  })), total);
}

const toEntry = ({ joinVerification: _joinVerification, ...entry }: GiveawayEntry) => ({
  ...entry, verification: JSON.parse(entry.verification), snapshot: entry.snapshot ? JSON.parse(entry.snapshot) : null,
});

export const filters = {
  all: {}, eligible: { eligibility: "ELIGIBLE" }, ineligible: { eligibility: "INELIGIBLE" },
  review: { OR: [{ eligibility: "REVIEW" }, { risk: { in: ["HIGH", "REQUIRES_REVIEW"] } }] },
  excluded: { eligibility: "EXCLUDED" }, left: { membership: "LEFT" },
  roles: { requiredCheck: "FAILED" }, account: { accountCheck: "FAILED" }, withdrawn: { withdrawnAt: { not: null } },
} satisfies Record<string, Prisma.GiveawayEntryWhereInput>;

export async function participants(guildId: string, giveawayId: string, filter: keyof typeof filters, page: number, search: string) {
  await getGiveaway(guildId, giveawayId);
  const where: Prisma.GiveawayEntryWhereInput = { giveawayId, AND: [
    filters[filter], ...(filter === "withdrawn" ? [] : [{ withdrawnAt: null }]),
    search ? { OR: [{ userId: { contains: search } }, { username: { contains: search } }, { displayName: { contains: search } }] } : {},
  ] };
  const [items, total] = await Promise.all([
    db.giveawayEntry.findMany({ where, orderBy: [{ enteredAt: "desc" }, { userId: "asc" }], ...paginate(page) }),
    db.giveawayEntry.count({ where }),
  ]);
  return paged(items.map(toEntry), total);
}

export async function participantDetail(guildId: string, giveawayId: string, userId: string) {
  await getGiveaway(guildId, giveawayId);
  const entry = await db.giveawayEntry.findUnique({ where: { giveawayId_userId: { giveawayId, userId } } });
  if (!entry) return null;
  const events = await db.giveawayAudit.findMany({
    where: { guildId, giveawayId, detail: { contains: `"userId":"${userId}"` } }, orderBy: { id: "desc" }, take: 50,
  });
  return { entry: toEntry(entry), events: events.map(withDetail) };
}

export async function details(guildId: string, giveawayId: string) {
  const row = await getGiveaway(guildId, giveawayId);
  const [groups, unresolved, candidates, jobs] = await Promise.all([
    db.giveawayEntry.groupBy({ by: ["eligibility"], where: { giveawayId, withdrawnAt: null }, _count: true }),
    db.giveawayEntry.count({ where: { giveawayId, snapshotStatus: "REVIEW", resolved: false } }),
    db.giveawayCandidate.findMany({ where: { giveawayId }, orderBy: [{ draw: { drawIndex: "asc" } }, { slot: "asc" }],
      include: { claim: { select: { id: true, status: true, deadline: true, claimedAt: true, fulfilledAt: true, notes: true } },
        draw: { select: { drawIndex: true, createdAt: true } } },
    }),
    db.giveawayJob.findMany({ where: { guildId, giveawayId },
      select: { id: true, kind: true, tries: true, runAt: true, doneAt: true, messageId: true, error: true },
      orderBy: { createdAt: "desc" }, take: 30,
    }),
  ]);
  const profiles = await db.giveawayEntry.findMany({
    where: { giveawayId, userId: { in: candidates.map(candidate => candidate.userId) } },
    select: { userId: true, username: true, displayName: true, avatar: true },
  });
  const profileByUser = new Map(profiles.map(profile => [profile.userId, profile]));
  return {
    ...publicGiveaway(row), originalUrl: originalUrl(row),
    resultUrl: row.resultId ? `https://discord.com/channels/${guildId}/${configOf(row).winnerChannelId ?? configOf(row).channelId}/${row.resultId}` : null,
    totals: Object.fromEntries(groups.map(group => [group.eligibility, group._count])), unresolved, jobs,
    candidates: candidates.map(candidate => ({
      ...candidate, verification: JSON.parse(candidate.verification), profile: profileByUser.get(candidate.userId),
    })),
  };
}

function withDetail<T extends { detail: string }>(row: T) { return { ...row, detail: JSON.parse(row.detail) }; }

export async function auditList(guildId: string, page: number, event?: string, giveawayId?: string) {
  const where = { guildId, giveawayId, event };
  const [events, items, total] = await Promise.all([
    db.giveawayAudit.groupBy({ by: ["event"], where: { guildId }, orderBy: { event: "asc" } }),
    db.giveawayAudit.findMany({ where, orderBy: { id: "desc" }, ...paginate(page) }),
    db.giveawayAudit.count({ where }),
  ]);
  return { ...paged(items.map(withDetail), total), events: events.map(item => item.event) };
}

export async function transparency(guildId: string, giveawayId: string, redacted = false) {
  const row = await getGiveaway(guildId, giveawayId);
  const [draws, entries] = await Promise.all([
    db.giveawayDraw.findMany({ where: { giveawayId }, orderBy: { drawIndex: "asc" }, include: {
      candidates: { orderBy: { slot: "asc" }, select: {
        id: true, userId: true, slot: true, status: true, policy: true, reason: true, replacesId: true,
        reviewedBy: true, reviewedAt: true, announcedAt: true,
      } },
    } }),
    db.giveawayEntry.findMany({ where: { giveawayId, withdrawnAt: null, snapshot: { not: null } }, orderBy: { userId: "asc" },
      select: { userId: true, enteredAt: true, snapshot: true, snapshotStatus: true, resolved: true, eligibility: true },
    }),
  ]);
  const reveal = (item: typeof draws[number]) => row.status === "CANCELLED" || item.candidates.some(candidate => candidate.announcedAt) ||
    (row.publishedRound > 0 && !item.candidates.some(candidate => !candidate.announcedAt && candidate.status !== "REJECTED"));
  const summary = {
    giveawayId, commitment: row.commitment, snapshotHash: row.snapshotHash, snapshotAt: row.snapshotAt, poolHash: row.poolHash,
    publishedRound: row.publishedRound,
  };
  if (redacted) return {
    ...summary,
    participants: entries.length,
    draws: draws.map(item => ({
      drawIndex: item.drawIndex, algorithm: item.algorithm, timestamp: item.createdAt, poolHash: item.poolHash,
      poolSize: item.poolSize, selected: item.candidates.length, rejected: item.candidates.filter(candidate => candidate.status === "REJECTED").length,
    })),
  };
  return {
    ...summary, policy: configOf(row).rules,
    snapshot: row.snapshotHash ? entries.map(entry => JSON.parse(snapshotLine(entry))) : [],
    eligibleOrder: entries.filter(entry => entry.snapshotStatus === "ELIGIBLE" ||
      (entry.snapshotStatus === "REVIEW" && entry.resolved && entry.eligibility === "ELIGIBLE")).map(entry => entry.userId),
    draws: draws.map(({ seed, ...draw }) => ({ ...draw, seed: reveal({ seed, ...draw }) ? seed : null })),
  };
}

export async function analytics(guildId: string) {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - 29);
  const [states, participants, unique, days, claims, failures] = await Promise.all([
    db.giveaway.groupBy({ by: ["status"], where: { guildId }, _count: true }),
    db.giveawayEntry.groupBy({ by: ["eligibility"], where: { giveaway: { guildId }, withdrawnAt: null }, _count: true }),
    db.$queryRaw<{ count: number }[]>`
      SELECT CAST(COUNT(DISTINCT e.userId) AS INT) as count FROM GiveawayEntry e
      JOIN Giveaway g ON g.id = e.giveawayId WHERE g.guildId = ${guildId} AND e.withdrawnAt IS NULL`,
    db.$queryRaw<{ day: string; count: number }[]>`
      SELECT strftime('%Y-%m-%d', e.enteredAt / 1000, 'unixepoch') AS day, CAST(COUNT(*) AS INT) AS count
      FROM GiveawayEntry e JOIN Giveaway g ON g.id = e.giveawayId
      WHERE g.guildId = ${guildId} AND e.enteredAt >= ${since.getTime()} AND e.withdrawnAt IS NULL GROUP BY day ORDER BY day`,
    db.giveawayClaim.groupBy({ by: ["status"], where: { guildId }, _count: true }),
    db.$queryRaw<{ checkName: string; count: number }[]>`
      SELECT j.key as checkName, CAST(COUNT(*) AS INT) AS count
      FROM GiveawayEntry e JOIN Giveaway g ON g.id = e.giveawayId,
      json_each(COALESCE(e.snapshot, e.verification), '$.checks') AS j
      WHERE g.guildId = ${guildId} AND e.withdrawnAt IS NULL AND json_extract(j.value, '$.result') = 'FAILED'
      GROUP BY j.key ORDER BY count DESC`,
  ]);
  const map = (items: { status: string; _count: number }[]): Record<string, number> =>
    Object.fromEntries(items.map(item => [item.status, item._count]));
  const status = map(states);
  const claimStatus = map(claims);
  const entries = Object.fromEntries(participants.map(group => [group.eligibility, group._count]));
  const total = states.reduce((sum, item) => sum + item._count, 0);
  const participantCount = participants.reduce((sum, item) => sum + item._count, 0);
  const claimCount = claims.reduce((sum, item) => sum + item._count, 0);
  const countsByDay = new Map(days.map(item => [item.day, Number(item.count)]));
  return {
    status, claimStatus, entries, total, participantCount, unique: Number(unique[0].count),
    average: total ? participantCount / total : 0, completionRate: total ? (status.COMPLETED ?? 0) / total : 0,
    claimRate: claimCount ? ((claimStatus.CLAIMED ?? 0) + (claimStatus.FULFILLED ?? 0)) / claimCount : 0,
    days: Array.from({ length: 30 }, (_, i) => {
      const day = new Date(since.getTime() + i * 86_400_000).toISOString().slice(0, 10);
      return { day, count: countsByDay.get(day) ?? 0 };
    }),
    failures: failures.map(item => ({ ...item, count: Number(item.count) })),
  };
}
