import { createHmac, randomBytes } from "node:crypto";
import { Giveaway, GiveawayCandidate } from "@prisma/client";
import { Guild } from "discord.js";
import { RejectionPolicy, Verification } from "../../../types/giveaways";
import { verifyCandidate } from "./participants";
import { Actor, Tx, auditGiveaway, claimDeliveryOf, configOf, db, getGiveaway, hash, id, job, lockGiveaway, system, transaction } from "./store";
import { conflict, invalid } from "./validation";

export const algorithm = "hmac-sha256-rejection-v1";

export function selectUsers(ordered: string[], count: number, seed: string, domain: string) {
  const pool = [...ordered];
  const range = 1n << 256n;
  let counter = 0;
  for (let index = 0; index < Math.min(count, pool.length); index++) {
    const remaining = BigInt(pool.length - index);
    const ceiling = range - range % remaining;
    let value: bigint;
    do {
      const digest = createHmac("sha256", Buffer.from(seed, "hex")).update(`${domain}:${counter++}`).digest("hex");
      value = BigInt(`0x${digest}`);
    } while (value >= ceiling);
    const next = index + Number(value % remaining);
    [pool[index], pool[next]] = [pool[next], pool[index]];
  }
  return pool.slice(0, count);
}

async function remainingPool(tx: Tx, giveawayId: string, seen: string[] = []) {
  return tx.giveawayEntry.findMany({
    where: {
      giveawayId, withdrawnAt: null, userId: { notIn: seen },
      OR: [{ snapshotStatus: "ELIGIBLE" }, { snapshotStatus: "REVIEW", resolved: true, eligibility: "ELIGIBLE" }],
    },
    orderBy: { userId: "asc" },
    select: { userId: true, verification: true },
  });
}

async function draw(tx: Tx, row: Giveaway, actor: Actor, slots: number[], previous?: GiveawayCandidate, reason?: string) {
  const prior = await tx.giveawayCandidate.findMany({ where: { giveawayId: row.id }, select: { userId: true } });
  const pool = await remainingPool(tx, row.id, prior.map(item => item.userId));
  if (previous && !pool.length) {
    await tx.giveaway.update({ where: { id: row.id }, data: { status: "WINNER_REVIEW", nextWorkAt: null, shortageAccepted: false } });
    await auditGiveaway(tx, row, actor, "REPLACEMENT_UNAVAILABLE", { previous: previous.userId, slot: previous.slot, reason }, true);
    return false;
  }
  const eligible = pool.map(entry => entry.userId);
  const poolHash = hash(JSON.stringify(eligible));
  const drawIndex = await tx.giveawayDraw.count({ where: { giveawayId: row.id } });
  const seed = drawIndex === 0 ? row.seed : randomBytes(32).toString("hex");
  const drawId = id();
  const candidates = selectUsers(eligible, slots.length, seed, `${row.id}:${drawIndex}:${poolHash}`);
  await tx.giveawayDraw.create({ data: {
    id: drawId, giveawayId: row.id, drawIndex, algorithm, seed, poolHash, poolSize: eligible.length, actor: actor.id, reason,
  } });
  const eligibility = new Map(pool.map(entry => [entry.userId, entry.verification]));
  await auditGiveaway(tx, row, actor, previous ? "REPLACEMENT_DRAWN" : "DRAW_STARTED", {
    drawId, drawIndex, algorithm, poolHash, count: pool.length, previous: previous?.userId, reason,
  });
  for (const [index, userId] of candidates.entries()) {
    await tx.giveawayCandidate.create({ data: {
      id: id(), giveawayId: row.id, drawId, slot: slots[index], userId, verification: eligibility.get(userId)!,
      replacesId: previous?.id,
    } });
    await auditGiveaway(tx, row, actor, "WINNER_SELECTED", { drawId, userId, slot: slots[index], replaces: previous?.userId });
  }
  await tx.giveaway.update({ where: { id: row.id }, data: {
    status: "WINNER_REVIEW", poolHash: row.poolHash ?? poolHash,
    nextWorkAt: configOf(row).autoFinalize && candidates.length === slots.length ? new Date() : null, shortageAccepted: false,
  } });
  return true;
}

export async function drawInitial(guildId: string, giveawayId: string, actor: Actor, revision?: number) {
  return transaction(async tx => {
    const row = await lockGiveaway(tx, guildId, giveawayId, revision);
    if (row.status !== "DRAW_PENDING" || !row.snapshotHash) conflict("Die Teilnahmeliste ist noch nicht bereit oder es wurde bereits gezogen.");
    const unresolved = await tx.giveawayEntry.count({ where: { giveawayId, snapshotStatus: "REVIEW", resolved: false } });
    if (unresolved) {
      if (actor.id === system.id) {
        await tx.giveaway.update({ where: { id: row.id }, data: { nextWorkAt: null } });
        return;
      }
      conflict(`${unresolved} offene Verifikationsfälle müssen geprüft oder begründet ausgeschlossen werden.`);
    }
    const count = configOf(row).winnerCount;
    await draw(tx, row, actor, Array.from({ length: count }, (_, index) => index + 1));
  });
}

async function getCandidate(row: Giveaway, candidateId: string, tx: Tx = db) {
  const candidate = await tx.giveawayCandidate.findFirst({ where: { id: candidateId, giveawayId: row.id }, include: { claim: true } });
  if (!candidate) conflict("Kandidat nicht gefunden.");
  return candidate;
}

function assertReview(row: Giveaway) {
  if (row.status !== "WINNER_REVIEW" || row.publication > row.publishedRound) conflict("Die private Gewinnerprüfung ist geschlossen.");
}

function validateRejection(policy: RejectionPolicy, verification: Verification, claimStatus?: string) {
  if (policy === "INELIGIBLE" && verification.status !== "INELIGIBLE" && verification.status !== "EXCLUDED") {
    invalid("Es liegt kein fehlgeschlagener Berechtigungscheck vor.");
  }
  if (policy === "LEFT" && verification.membership !== "LEFT") invalid("Der Serveraustritt wurde nicht bestätigt.");
  if (policy === "DECLINED" && claimStatus !== "DECLINED") invalid("Es liegt keine Ablehnung des Preises vor.");
  if (policy === "EXPIRED" && claimStatus !== "EXPIRED") invalid("Die Abholung ist noch nicht abgelaufen.");
}

export async function reviewCandidate(guild: Guild, giveawayId: string, candidateId: string, actor: Actor,
  action: "approve" | "recheck" | "reject", revision: number, reason?: string, policy?: RejectionPolicy) {
  const before = await getGiveaway(guild.id, giveawayId);
  assertReview(before);
  const candidate = await getCandidate(before, candidateId);
  if (candidate.announcedAt || candidate.status === "REJECTED") conflict("Diese Entscheidung ist abgeschlossen.");
  const verification = await verifyCandidate(guild, before, candidate.userId);
  if (action === "reject") validateRejection(policy!, verification, candidate.claim?.status);
  const valid = verification.status === "ELIGIBLE";
  await transaction(async tx => {
    const row = await lockGiveaway(tx, guild.id, giveawayId, revision);
    assertReview(row);
    const current = await getCandidate(row, candidateId, tx);
    if (current.announcedAt || current.status === "REJECTED") conflict("Diese Entscheidung ist abgeschlossen.");
    const status = action === "reject" ? "REJECTED" : valid && (action === "approve" || current.status === "APPROVED") ? "APPROVED" : "PENDING";
    await tx.giveawayCandidate.update({ where: { id: candidateId }, data: {
      status, verification: JSON.stringify(verification), reviewedBy: actor.id, reviewedAt: new Date(), reason, policy,
    } });
    await tx.giveaway.update({ where: { id: row.id }, data: { nextWorkAt: null, shortageAccepted: false } });
    const event = action === "reject" ? "WINNER_REJECTED" : action === "approve" && valid ? "WINNER_APPROVED" : "WINNER_RECHECKED";
    await auditGiveaway(tx, row, actor, event, { userId: current.userId, candidateId, before: current.status, after: status, verification, reason, policy }, action === "reject");
  });
  return { approved: action === "approve" && valid };
}

export async function replaceCandidate(guild: Guild, giveawayId: string, candidateId: string, actor: Actor,
  reason: string, policy: RejectionPolicy, revision?: number) {
  const before = await getGiveaway(guild.id, giveawayId);
  const candidate = await getCandidate(before, candidateId);
  const verification = candidate.announcedAt && ["LEFT", "INELIGIBLE"].includes(policy)
    ? await verifyCandidate(guild, before, candidate.userId) : JSON.parse(candidate.verification) as Verification;
  return transaction(async tx => {
    const row = await lockGiveaway(tx, guild.id, giveawayId, revision);
    const current = await getCandidate(row, candidateId, tx);
    if (row.publication > row.publishedRound || !["WINNER_REVIEW", "AWAITING_CLAIM", "COMPLETED"].includes(row.status)) conflict("Ein Ersatz ist in diesem Status nicht möglich.");
    if (await tx.giveawayCandidate.findFirst({ where: { giveawayId, replacesId: candidateId } })) conflict("Für diese Person wurde bereits Ersatz gezogen.");
    const latest = await tx.giveawayCandidate.findFirst({
      where: { giveawayId, slot: current.slot }, orderBy: { draw: { drawIndex: "desc" } },
    });
    if (latest?.id !== current.id) conflict("Dieser Platz wurde bereits neu besetzt.");
    if (!current.announcedAt && current.status !== "REJECTED") conflict("Lehne den Kandidaten mit einer Begründung ab.");
    if (current.claim?.claimedAt && claimDeliveryOf(row)?.codes[current.slot - 1]) {
      conflict("Der Code für diesen Gewinnerplatz wurde bereits beansprucht. Bei einer Ersatzziehung würde derselbe Code erneut vergeben.");
    }
    if (current.announcedAt && (current.status !== "APPROVED" || ["FULFILLED", "CANCELLED"].includes(current.claim?.status ?? ""))) conflict("Dieser Gewinn ist abgeschlossen.");
    if (current.announcedAt) {
      validateRejection(policy, verification, current.claim?.status);
      await tx.giveawayCandidate.update({ where: { id: candidateId }, data: {
        status: "REJECTED", reason, policy, verification: JSON.stringify(verification), reviewedBy: actor.id, reviewedAt: new Date(),
      } });
      if (current.claim && ["PENDING", "CLAIMED"].includes(current.claim.status)) {
        await tx.giveawayClaim.update({ where: { id: current.claim.id }, data: { status: "CANCELLED" } });
        await auditGiveaway(tx, row, actor, "CLAIM_CANCELLED", { claimId: current.claim.id, reason });
      }
      await auditGiveaway(tx, row, actor, "WINNER_REJECTED", { userId: current.userId, reason, policy, verification }, true);
    } else if (policy !== current.policy) invalid("Für diesen Ersatz gilt der dokumentierte Ablehnungsgrund.");
    const replaced = await draw(tx, row, actor, [current.slot], current, reason);
    return { replaced };
  });
}

async function noFurtherCandidates(tx: Tx, row: Giveaway) {
  const previous = await tx.giveawayCandidate.findMany({ where: { giveawayId: row.id }, select: { userId: true } });
  return (await remainingPool(tx, row.id, previous.map(item => item.userId))).length === 0;
}

export async function acceptShortage(guildId: string, giveawayId: string, actor: Actor, revision: number, reason: string) {
  await transaction(async tx => {
    const row = await lockGiveaway(tx, guildId, giveawayId, revision);
    assertReview(row);
    const occupied = await tx.giveawayCandidate.count({ where: { giveawayId, status: { not: "REJECTED" } } });
    if (occupied >= configOf(row).winnerCount || !await noFurtherCandidates(tx, row)) conflict("Es sind noch genügend berechtigte Kandidaten verfügbar.");
    await tx.giveaway.update({ where: { id: row.id }, data: { shortageAccepted: true } });
    await auditGiveaway(tx, row, actor, "WINNER_SHORTAGE_ACCEPTED", { occupied, requested: configOf(row).winnerCount, reason }, true);
  });
}

export async function publishResults(guild: Guild, giveawayId: string, actor: Actor, revision: number) {
  const before = await getGiveaway(guild.id, giveawayId);
  if (before.publication > before.publishedRound) return { queued: true };
  assertReview(before);
  const candidates = await db.giveawayCandidate.findMany({ where: { giveawayId, status: { not: "REJECTED" } }, orderBy: { slot: "asc" } });
  const auto = actor.id === system.id;
  if (!auto && candidates.some(candidate => candidate.status !== "APPROVED")) conflict("Jeder Kandidat muss vor der Veröffentlichung freigegeben sein.");
  const fresh = await Promise.all(candidates.map(async candidate => ({
    candidate, verification: candidate.announcedAt ? JSON.parse(candidate.verification) as Verification : await verifyCandidate(guild, before, candidate.userId),
  })));
  return transaction(async tx => {
    const row = await lockGiveaway(tx, guild.id, giveawayId, revision);
    assertReview(row);
    const config = configOf(row);
    if (candidates.length < config.winnerCount && !row.shortageAccepted) {
      if (!auto) conflict("Bestätige zuerst die fehlenden Gewinnerplätze.");
      await tx.giveaway.update({ where: { id: row.id }, data: { nextWorkAt: null } });
      return { queued: false };
    }
    for (const { candidate, verification } of fresh) {
      if (candidate.announcedAt) continue;
      const approved = verification.status === "ELIGIBLE" && (!auto || verification.risk !== "HIGH");
      await tx.giveawayCandidate.update({ where: { id: candidate.id }, data: {
        verification: JSON.stringify(verification), status: approved ? "APPROVED" : "PENDING",
        reviewedAt: new Date(), reviewedBy: candidate.reviewedBy ?? actor.id,
      } });
      await auditGiveaway(tx, row, actor, auto && approved ? "WINNER_APPROVED" : "FINAL_ELIGIBILITY_CHECK",
        { userId: candidate.userId, candidateId: candidate.id, verification, approved });
    }
    if (fresh.some(({ candidate, verification }) => !candidate.announcedAt &&
      (verification.status !== "ELIGIBLE" || (auto && verification.risk === "HIGH")))) {
      await tx.giveaway.update({ where: { id: row.id }, data: { nextWorkAt: null, error: "Die abschließende Prüfung erfordert eine manuelle Entscheidung." } });
      return { queued: false };
    }
    const round = row.publication + 1;
    const ids = candidates.map(candidate => candidate.id);
    await tx.giveaway.update({ where: { id: row.id }, data: { publication: round, nextWorkAt: null, error: null } });
    await job(tx, row.guildId, row.id, "RESULT", {
      round, candidateIds: ids, channelId: config.winnerChannelId ?? config.channelId,
    }, `result-${row.id}-${round}`);
    await auditGiveaway(tx, row, actor, "WINNERS_PUBLICATION_QUEUED", { round, candidates: candidates.map(candidate => candidate.userId) }, true);
    return { queued: true };
  });
}
