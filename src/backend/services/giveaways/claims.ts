import { Giveaway } from "@prisma/client";
import { Guild } from "discord.js";
import { replaceCandidate } from "./drawing";
import { Actor, Tx, auditGiveaway, claimDeliveryOf, configOf, db, id, job, lockGiveaway, system, transaction } from "./store";
import { conflict, GiveawayInteractionError } from "./validation";

export async function resolveStatus(tx: Tx, row: Giveaway) {
  const outstanding = await tx.giveawayClaim.count({
    where: { candidate: { giveawayId: row.id, status: "APPROVED" }, status: { in: ["PENDING", "CLAIMED"] } },
  });
  return outstanding ? "AWAITING_CLAIM" : "COMPLETED";
}

async function statusAfterClaim(tx: Tx, row: Giveaway) {
  if (["COMPLETED", "AWAITING_CLAIM"].includes(row.status)) {
    const status = await resolveStatus(tx, row);
    await tx.giveaway.update({ where: { id: row.id }, data: { status } });
  }
}

export async function finishPublication(tx: Tx, row: Giveaway, candidateIds: string[], round: number, messageId: string) {
  if (row.publishedRound >= round) return;
  if (row.publication !== round) conflict("Unerwartete Veröffentlichungsrunde.");
  const config = configOf(row);
  const now = new Date();
  const fresh = await tx.giveawayCandidate.findMany({
    where: { giveawayId: row.id, id: { in: candidateIds }, announcedAt: null, status: "APPROVED" },
  });
  for (const candidate of fresh) {
    await tx.giveawayCandidate.update({ where: { id: candidate.id }, data: { announcedAt: now } });
    const claim = config.claimsEnabled ? await tx.giveawayClaim.create({ data: {
      id: id(), candidateId: candidate.id, guildId: row.guildId, token: id(),
      deadline: new Date(now.getTime() + config.claimHours * 3_600_000),
    } }) : null;
    if (config.dmWinners) await job(tx, row.guildId, row.id, "DM", {
      candidateId: candidate.id, claimId: claim?.id, userId: candidate.userId,
    }, `dm-${candidate.id}`);
  }
  await tx.giveaway.update({ where: { id: row.id }, data: {
    status: await resolveStatus(tx, row), resultId: messageId, publishedRound: round, error: null, refreshAt: now,
  } });
  await auditGiveaway(tx, row, system, "WINNERS_ANNOUNCED", { round, messageId, candidateIds, newlyAnnounced: fresh.map(item => item.userId) }, true);
}

export async function respondToClaim(token: string, actor: Actor, action: "claim" | "decline", guildId?: string, messageId?: string) {
  return transaction(async tx => {
    const found = await tx.giveawayClaim.findUnique({ where: { token }, include: { candidate: true } });
    if (!found || found.candidate.userId !== actor.id || (guildId && found.guildId !== guildId)) {
      throw new GiveawayInteractionError("This prize claim is unavailable.");
    }
    const row = await lockGiveaway(tx, found.guildId, found.candidate.giveawayId);
    if (!found.candidate.announcedAt || (guildId && messageId !== row.resultId)) {
      throw new GiveawayInteractionError("This prize claim is unavailable.");
    }
    return updateResponse(tx, row, found.id, actor, action);
  });
}

export async function respondToPublicClaim(guildId: string, giveawayId: string, messageId: string, actor: Actor) {
  return transaction(async tx => {
    const row = await lockGiveaway(tx, guildId, giveawayId);
    if (row.resultId !== messageId) throw new GiveawayInteractionError("Use the latest winner announcement.");
    const found = await tx.giveawayClaim.findFirst({ where: {
      guildId, candidate: { giveawayId, userId: actor.id, announcedAt: { not: null }, status: "APPROVED" },
    } });
    if (!found) throw new GiveawayInteractionError("You don’t have a prize to claim for this giveaway.");
    return updateResponse(tx, row, found.id, actor, "claim");
  });
}

async function updateResponse(tx: Tx, row: Giveaway, claimId: string, actor: Actor, action: "claim" | "decline") {
  const found = await tx.giveawayClaim.findUniqueOrThrow({ where: { id: claimId }, include: { candidate: true } });
  if (found.status === "CLAIMED" && action === "claim") return "You’ve already claimed this prize.";
  if (found.status !== "PENDING" || found.deadline <= new Date() || found.candidate.status !== "APPROVED") {
    throw new GiveawayInteractionError("This prize claim is closed or has expired.");
  }
  const status = action === "claim" ? "CLAIMED" : "DECLINED";
  await tx.giveawayClaim.update({ where: { id: claimId }, data: { status, claimedAt: action === "claim" ? new Date() : null } });
  const delivery = action === "claim" ? claimDeliveryOf(row) : null;
  if (delivery) await job(tx, row.guildId, row.id, "CLAIM_DM", { claimId }, `claim-dm-${claimId}`);
  await auditGiveaway(tx, row, actor, action === "claim" ? "CLAIM_SUBMITTED" : "CLAIM_DECLINED",
    { claimId, userId: actor.id, before: found.status, after: status }, configOf(row).notifyClaims);
  await statusAfterClaim(tx, row);
  if (action === "decline") return "You declined the prize.";
  return delivery ? "Your claim is confirmed. Check your DMs for your prize details."
    : "Your claim is confirmed. The server team can now deliver your prize.";
}

export async function manageClaim(guildId: string, giveawayId: string, claimId: string, actor: Actor,
  action: "extend" | "fulfill" | "cancel", deadline?: Date, notes?: string) {
  await transaction(async tx => {
    const row = await lockGiveaway(tx, guildId, giveawayId);
    const claim = await tx.giveawayClaim.findFirst({ where: { id: claimId, guildId, candidate: { giveawayId, status: "APPROVED" } } });
    if (!claim || !["PENDING", "CLAIMED", "EXPIRED"].includes(claim.status)) conflict("Diese Abholung ist bereits abgeschlossen.");
    const now = new Date();
    if (action === "extend" && (!deadline || deadline <= now || deadline <= claim.deadline || deadline.getTime() > now.getTime() + 366 * 86_400_000 ||
      !["PENDING", "EXPIRED"].includes(claim.status))) conflict("Wähle eine spätere, gültige Abholfrist.");
    if (action === "fulfill" && claim.status !== "CLAIMED") conflict("Der Gewinner muss die Abholung zuerst bestätigen.");
    const data = action === "extend" ? { deadline, status: "PENDING" }
      : action === "fulfill" ? { status: "FULFILLED", fulfilledAt: now, notes } : { status: "CANCELLED", notes };
    await tx.giveawayClaim.update({ where: { id: claim.id }, data });
    await statusAfterClaim(tx, row);
    await auditGiveaway(tx, row, actor, action === "extend" ? "CLAIM_EXTENDED" : action === "fulfill" ? "PRIZE_FULFILLED" : "CLAIM_CANCELLED",
      { claimId, before: { status: claim.status, deadline: claim.deadline }, after: data }, true);
    if (action === "extend" && configOf(row).dmWinners) {
      await job(tx, guildId, row.id, "DM", { candidateId: claim.candidateId, claimId, extension: true });
    }
  });
}

export async function expireClaims() {
  const due = await db.giveawayClaim.findMany({
    where: { status: "PENDING", deadline: { lte: new Date() } }, take: 50,
    orderBy: { deadline: "asc" }, include: { candidate: true },
  });
  for (const claim of due) await transaction(async tx => {
    const row = await lockGiveaway(tx, claim.guildId, claim.candidate.giveawayId);
    const result = await tx.giveawayClaim.updateMany({
      where: { id: claim.id, status: "PENDING", deadline: { lte: new Date() } }, data: { status: "EXPIRED" },
    });
    if (!result.count) return;
    await statusAfterClaim(tx, row);
    await auditGiveaway(tx, row, system, "CLAIM_EXPIRED", { claimId: claim.id, userId: claim.candidate.userId }, true);
    if (configOf(row).autoReplaceExpired) await job(tx, row.guildId, row.id, "EXPIRED_REPLACEMENT", { candidateId: claim.candidateId },
      `expired-${claim.id}-${claim.deadline.getTime()}`);
  });
}

export async function replaceExpired(guild: Guild, giveawayId: string, candidateId: string) {
  const latest = await db.giveawayCandidate.findFirst({ where: { id: candidateId, giveawayId, status: "APPROVED", claim: { status: "EXPIRED" } } });
  if (!latest) return;
  await replaceCandidate(guild, giveawayId, candidateId, system, "Automatischer Ersatz nach Ablauf der konfigurierten Abholfrist.", "EXPIRED");
}
