import { createHash } from "node:crypto";
import { Giveaway, GiveawayEntry, Prisma } from "@prisma/client";
import { Guild, GuildMember, User } from "discord.js";
import { entryDeadline, GiveawayConfig, Verification } from "../../../types/giveaways";
import { entryVerification, lookupMember, verifyEligibility } from "./eligibility";
import { Actor, auditGiveaway, configOf, db, enabled, getGiveaway, lockGiveaway, system, transaction, Tx } from "./store";
import { conflict, GiveawayInteractionError } from "./validation";

const open = ["ACTIVE", "PAUSED"];
const key = (giveawayId: string, userId: string) => ({ giveawayId_userId: { giveawayId, userId } });
const entryDelay = 7_000;

function ineligibleReply(config: GiveawayConfig, verification: Verification) {
  const { rules } = config;
  const reasons: Record<keyof Verification["checks"], string> = {
    member: "You must be a member of this server.",
    account: `Your Discord account must be at least ${rules.accountDays} ${rules.accountDays === 1 ? "day" : "days"} old.`,
    tenure: `You must have been on this server for at least ${rules.memberDays} ${rules.memberDays === 1 ? "day" : "days"}.`,
    required: rules.roleMatch === "ALL" ? "You need all of the required roles." : "You need at least one of the required roles.",
    excluded: "One of your roles is excluded from this giveaway.",
    manual: "Your entry has been excluded from this giveaway.",
  };
  const failed = (Object.keys(reasons) as (keyof typeof reasons)[])
    .filter(key => verification.checks[key].result === "FAILED");
  return ["You’re not eligible to enter this giveaway.", ...failed.map(key => reasons[key])].join(" ");
}

async function signals(tx: Tx, giveaway: Giveaway, userId: string) {
  const [attempts, documented] = await Promise.all([
    tx.giveawayAttempt.findUnique({ where: key(giveaway.id, userId) }),
    tx.giveawayCandidate.findFirst({ where: {
      userId, policy: "RULE_VIOLATION", giveawayId: { not: giveaway.id }, giveaway: { guildId: giveaway.guildId },
    }, select: { id: true } }),
  ]);
  return { attempts: attempts?.count ?? 0, documented: Boolean(documented) };
}

export async function participate(guild: Guild, giveawayId: string, messageId: string, user: User, action: "join" | "leave") {
  const before = await getGiveaway(guild.id, giveawayId);
  const start = new Date();
  if (user.bot || before.status !== "ACTIVE" || before.messageId !== messageId || start >= entryDeadline(before.endAt, configOf(before).rules)) {
    throw new GiveawayInteractionError("Entries are closed.");
  }
  const lookup = action === "join" ? await lookupMember(guild, user.id) : "UNAVAILABLE";
  return transaction(async tx => {
    const row = await lockGiveaway(tx, guild.id, giveawayId);
    const config = configOf(row);
    const now = new Date();
    if (row.status !== "ACTIVE" || row.messageId !== messageId || now >= entryDeadline(row.endAt, config.rules) || !await enabled(tx, guild.id)) {
      throw new GiveawayInteractionError("Entries are closed.");
    }
    const existing = await tx.giveawayEntry.findUnique({ where: key(row.id, user.id) });
    if (action === "leave") {
      if (!config.rules.withdraw || !existing || existing.withdrawnAt) {
        throw new GiveawayInteractionError("You don’t have an active entry you can withdraw.");
      }
      await tx.giveawayEntry.update({ where: key(row.id, user.id), data: { withdrawnAt: now } });
      await auditGiveaway(tx, row, user, "ENTRY_WITHDRAWN", { userId: user.id });
      await queueRefresh(tx, row);
      return "You withdrew your entry.";
    }
    let { attempts, documented } = await signals(tx, row, user.id);
    const duplicate = Boolean(existing && !existing.withdrawnAt);
    const verification = verifyEligibility(config, user.id, lookup, attempts, documented, existing?.exclusion, now);
    if (duplicate || verification.status === "INELIGIBLE" || verification.status === "EXCLUDED") {
      const attempt = await tx.giveawayAttempt.upsert({
        where: key(row.id, user.id), update: { count: { increment: 1 } },
        create: { giveawayId: row.id, userId: user.id, count: 1 },
      });
      attempts = attempt.count;
      if (duplicate && existing) await tx.giveawayEntry.update({
        where: key(row.id, user.id), data: entryVerification(verifyEligibility(config, user.id, lookup, attempts, documented, existing.exclusion, now)),
      });
      if (duplicate) return "You’ve already entered this giveaway.";
      return ineligibleReply(config, verification);
    }
    const profile = {
      username: user.username, displayName: typeof lookup === "object" ? lookup.displayName : user.globalName || user.username,
      avatar: user.displayAvatarURL({ size: 64 }), enteredAt: now, withdrawnAt: null, joinVerification: JSON.stringify(verification),
      ...entryVerification(verification),
    };
    await tx.giveawayEntry.upsert({
      where: key(row.id, user.id), update: profile, create: { giveawayId: row.id, userId: user.id, ...profile },
    });
    await auditGiveaway(tx, row, user, "ENTRY_JOINED", { userId: user.id, eligibility: verification.status });
    await queueRefresh(tx, row);
    return verification.status === "REVIEW"
      ? "Your entry was recorded. We’ll review any outstanding eligibility checks before the draw."
      : "You’ve entered the giveaway!";
  });
}

function queueRefresh(tx: Tx, row: Giveaway) {
  const next = new Date(Date.now() + entryDelay);
  return row.refreshAt && row.refreshAt <= next ? Promise.resolve() : tx.giveaway.update({
    where: { id: row.id }, data: { refreshAt: next },
  });
}

async function fresh(guild: Guild, row: Giveaway, entry: GiveawayEntry, config: GiveawayConfig, previous = false) {
  const [lookup, risk] = await Promise.all([lookupMember(guild, entry.userId), signals(db, row, entry.userId)]);
  return verifyEligibility(config, entry.userId, lookup, risk.attempts, risk.documented, entry.exclusion, new Date(),
    previous ? JSON.parse(entry.joinVerification) : undefined);
}

export async function syncMemberChange(guildId: string, userId: string, member: GuildMember | "LEFT") {
  const rows = await db.giveawayEntry.findMany({
    where: { userId, withdrawnAt: null, giveaway: { guildId, status: { in: open }, endAt: { gt: new Date() } } },
    select: { giveawayId: true },
  });
  for (const { giveawayId } of rows) await transaction(async tx => {
    const row = await lockGiveaway(tx, guildId, giveawayId);
    if (!open.includes(row.status) || row.endAt <= new Date()) return;
    const entry = await tx.giveawayEntry.findUniqueOrThrow({ where: key(row.id, userId) });
    if (entry.withdrawnAt) return;
    const { attempts, documented } = await signals(tx, row, userId);
    const verification = verifyEligibility(configOf(row), userId, member, attempts, documented, entry.exclusion);
    const user = member === "LEFT" ? null : member.user;
    await tx.giveawayEntry.update({ where: key(row.id, userId), data: {
      ...entryVerification(verification), displayName: member === "LEFT" ? undefined : member.displayName,
      username: user?.username, avatar: user?.displayAvatarURL({ size: 64 }),
    } });
  });
}

export async function participantAction(guild: Guild, giveawayId: string, userId: string, actor: Actor,
  action: "recheck" | "exclude" | "acknowledge", reason?: string) {
  const row = await getGiveaway(guild.id, giveawayId);
  const entry = await db.giveawayEntry.findUnique({ where: key(row.id, userId) });
  if (!entry || entry.withdrawnAt) conflict("Teilnahme nicht gefunden.");
  const config = configOf(row);
  const checked = action === "recheck" ? await fresh(guild, row, entry, config) : undefined;
  await transaction(async tx => {
    const current = await lockGiveaway(tx, row.guildId, row.id);
    const latest = await tx.giveawayEntry.findUniqueOrThrow({ where: key(row.id, userId) });
    const live = open.includes(current.status) && new Date() < current.endAt;
    const unresolved = current.status === "DRAW_PENDING" && latest.snapshotStatus === "REVIEW" && !latest.resolved;
    if ((!live && !unresolved) || latest.withdrawnAt) conflict("Diese Teilnahme ist für Änderungen gesperrt.");
    if (latest.verification !== entry.verification || latest.exclusion !== entry.exclusion ||
      latest.enteredAt.getTime() !== entry.enteredAt.getTime()) conflict("Die Teilnahme wurde inzwischen geändert.");
    let data: Prisma.GiveawayEntryUpdateInput;
    let event: string;
    if (action === "exclude") {
      const prior: Verification = JSON.parse(latest.verification);
      const excluded: Verification = { ...prior, status: "EXCLUDED", checks: { ...prior.checks, manual: { result: "FAILED", detail: reason! } } };
      data = { exclusion: reason, resolved: unresolved, ...entryVerification(excluded) };
      event = unresolved ? "UNVERIFIABLE_ENTRY_EXCLUDED" : "PARTICIPANT_EXCLUDED";
    } else if (action === "acknowledge") {
      if (!live) conflict("Offene Verifikationsfälle müssen erneut geprüft oder begründet ausgeschlossen werden.");
      data = { riskDecision: reason };
      event = "RISK_REVIEW_RECORDED";
    } else {
      data = { ...entryVerification(checked!), resolved: unresolved && checked!.status !== "REVIEW" };
      event = "ELIGIBILITY_RECHECKED";
    }
    await tx.giveawayEntry.update({ where: key(row.id, userId), data });
    if (unresolved) await tx.giveaway.update({ where: { id: row.id }, data: { nextWorkAt: new Date() } });
    await auditGiveaway(tx, current, actor, event, { userId, reason, before: JSON.parse(latest.verification), after: checked });
  });
}

export function snapshotLine(entry: Pick<GiveawayEntry, "userId" | "enteredAt" | "snapshot">) {
  return JSON.stringify([entry.userId, entry.enteredAt.toISOString(), JSON.parse(entry.snapshot!)]) + "\n";
}

export async function buildSnapshot(guild: Guild, row: Giveaway) {
  const config = configOf(row);
  const batch = await db.giveawayEntry.findMany({
    where: { giveawayId: row.id, withdrawnAt: null, snapshot: null }, orderBy: { userId: "asc" }, take: 12,
  });
  if (batch.length) {
    // Discord lookups stay outside the database transaction and Discord.js manages route rate limits.
    const checks = await Promise.all(batch.map(entry => fresh(guild, row, entry, config, true)));
    return transaction(async tx => {
      const current = await lockGiveaway(tx, row.guildId, row.id);
      if (current.status !== "ENDED") return;
      for (const [index, entry] of batch.entries()) {
        const value = checks[index];
        await tx.giveawayEntry.updateMany({
          where: { giveawayId: row.id, userId: entry.userId, snapshot: null },
          data: { ...entryVerification(value), snapshot: JSON.stringify(value), snapshotStatus: value.status },
        });
      }
    });
  }
  await transaction(async tx => {
    const current = await lockGiveaway(tx, row.guildId, row.id);
    if (current.status !== "ENDED") return;
    const digest = createHash("sha256");
    let count = 0;
    let eligible = 0;
    let unresolved = 0;
    let after = "";
    while (true) {
      const entries = await tx.giveawayEntry.findMany({
        where: { giveawayId: row.id, withdrawnAt: null, userId: { gt: after } },
        orderBy: { userId: "asc" }, take: 500,
        select: { userId: true, enteredAt: true, snapshot: true, snapshotStatus: true },
      });
      if (!entries.length) break;
      for (const entry of entries) {
        if (!entry.snapshot) conflict("Die Teilnahmeliste wird noch geprüft.");
        digest.update(snapshotLine(entry));
        eligible += Number(entry.snapshotStatus === "ELIGIBLE");
        unresolved += Number(entry.snapshotStatus === "REVIEW");
      }
      count += entries.length;
      after = entries[entries.length - 1].userId;
    }
    const snapshotHash = digest.digest("hex");
    const snapshotAt = new Date();
    await tx.giveaway.update({ where: { id: row.id }, data: { status: "DRAW_PENDING", snapshotHash, snapshotAt, nextWorkAt: snapshotAt } });
    await auditGiveaway(tx, row, system, "SNAPSHOT_SEALED", { snapshotHash, snapshotAt, count, eligible, unresolved, rules: config.rules });
  });
}

export async function verifyCandidate(guild: Guild, row: Giveaway, userId: string) {
  const entry = await db.giveawayEntry.findUniqueOrThrow({ where: key(row.id, userId) });
  return fresh(guild, row, entry, configOf(row), true);
}
