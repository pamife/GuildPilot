import { randomBytes } from "node:crypto";
import { Giveaway, Prisma } from "@prisma/client";
import { appearanceKeys, GiveawayConfig, entryDeadline } from "../../../types/giveaways";
import { Actor, Tx, auditGiveaway, configOf, db, enabled, hash, id, job, lockGiveaway, publicGiveaway, system, transaction } from "./store";
import { conflict, invalid } from "./validation";

export type Timing = { startAt: Date; endAt: Date };
const editable = ["DRAFT", "SCHEDULED", "FAILED"];
const open = ["ACTIVE", "PAUSED"];

export function checkTiming(config: GiveawayConfig, timing: Timing) {
  if (entryDeadline(timing.endAt, config.rules) <= timing.startAt) invalid("Der Teilnahmeschluss muss nach dem Start liegen.");
  if (timing.endAt.getTime() - timing.startAt.getTime() > 366 * 86_400_000) invalid("Ein Giveaway darf höchstens 366 Tage dauern.");
}

export async function createGiveaway(guildId: string, actor: Actor, config: GiveawayConfig, timing: Timing, giveawayId = id()) {
  checkTiming(config, timing);
  const seed = randomBytes(32).toString("hex");
  return transaction(async tx => {
    if (!await enabled(tx, guildId)) conflict("Giveaways ist für diesen Server deaktiviert.");
    const existing = await tx.giveaway.findUnique({ where: { id: giveawayId } });
    if (existing) {
      if (existing.guildId !== guildId || existing.creatorId !== actor.id ||
        existing.config !== JSON.stringify(config) || existing.startAt.getTime() !== timing.startAt.getTime() ||
        existing.endAt.getTime() !== timing.endAt.getTime()) conflict("Diese Anfrage-ID wurde bereits verwendet.");
      return publicGiveaway(existing);
    }
    const row = await tx.giveaway.create({ data: {
      id: giveawayId, guildId, creatorId: actor.id, creatorName: actor.username, config: JSON.stringify(config),
      ...timing, seed, commitment: hash(seed),
    } });
    await auditGiveaway(tx, row, actor, "GIVEAWAY_CREATED", { config, ...timing, commitment: row.commitment });
    return publicGiveaway(row);
  });
}

async function assertNoAnnouncement(tx: Tx, row: Giveaway) {
  if (await tx.giveawayJob.findFirst({ where: { giveawayId: row.id, kind: "ANNOUNCEMENT", doneAt: null } })) {
    conflict("Die Discord-Veröffentlichung läuft. Details findest du im Zustellstatus.");
  }
}

export async function editGiveaway(guildId: string, giveawayId: string, actor: Actor, revision: number, config: GiveawayConfig, timing: Timing) {
  checkTiming(config, timing);
  return transaction(async tx => {
    const row = await lockGiveaway(tx, guildId, giveawayId, revision);
    if (!await enabled(tx, guildId)) conflict("Giveaways ist für diesen Server deaktiviert.");
    if (!editable.includes(row.status) || row.messageId) conflict("Die veröffentlichten Teilnahmebedingungen sind gesperrt.");
    await assertNoAnnouncement(tx, row);
    if (row.status === "SCHEDULED" && timing.startAt <= new Date()) invalid("Die neue Startzeit muss in der Zukunft liegen.");
    const data = { config: JSON.stringify(config), ...timing, error: null, status: row.status === "FAILED" ? "DRAFT" : row.status };
    const updated = await tx.giveaway.update({ where: { id: row.id }, data });
    const before = configOf(row);
    await auditGiveaway(tx, row, actor, "GIVEAWAY_EDITED", {
      before: { config: before, startAt: row.startAt, endAt: row.endAt }, after: { config, ...timing },
    });
    if (JSON.stringify(before.rules) !== JSON.stringify(config.rules)) {
      await auditGiveaway(tx, row, actor, "ELIGIBILITY_POLICY_CHANGED", { before: before.rules, after: config.rules });
    }
    return publicGiveaway(updated);
  });
}

export async function editAppearance(guildId: string, giveawayId: string, actor: Actor, revision: number, config: GiveawayConfig) {
  return transaction(async tx => {
    const row = await lockGiveaway(tx, guildId, giveawayId, revision);
    if (!await enabled(tx, guildId)) conflict("Giveaways ist für diesen Server deaktiviert.");
    if (!open.includes(row.status) || row.endAt <= new Date()) conflict("Die Gestaltung ist nach dem Ende gesperrt.");
    const before = configOf(row);
    const after = { ...before };
    for (const key of appearanceKeys) after[key] = config[key];
    const updated = await tx.giveaway.update({ where: { id: row.id }, data: { config: JSON.stringify(after), refreshAt: new Date() } });
    await auditGiveaway(tx, row, actor, "GIVEAWAY_APPEARANCE_CHANGED", {
      before: Object.fromEntries(appearanceKeys.map(key => [key, before[key]])),
      after: Object.fromEntries(appearanceKeys.map(key => [key, after[key]])),
    });
    return publicGiveaway(updated);
  });
}

async function enqueueAnnouncement(tx: Tx, row: Giveaway) {
  if (await tx.giveawayJob.findFirst({ where: { giveawayId: row.id, kind: "ANNOUNCEMENT", doneAt: null } })) return;
  await job(tx, row.guildId, row.id, "ANNOUNCEMENT", {}, `announcement-${row.id}-${row.revision}`);
}

export async function closeGiveaway(tx: Tx, row: Giveaway, actor: Actor, now = new Date()) {
  if (!open.includes(row.status)) conflict("Dieses Giveaway ist nicht offen.");
  const closedAt = row.endAt < now ? row.endAt : now;
  await tx.giveaway.update({ where: { id: row.id }, data: { status: "ENDED", closedAt, refreshAt: now, nextWorkAt: now, error: null } });
  await auditGiveaway(tx, row, actor, "GIVEAWAY_ENDED", { before: row.status, closedAt, participationClosedAt:
    entryDeadline(row.endAt, configOf(row).rules) < closedAt ? entryDeadline(row.endAt, configOf(row).rules) : closedAt }, true);
}

export const lifecycleActions = ["schedule", "publish", "pause", "resume", "end", "cancel", "extend"] as const;
export type LifecycleAction = typeof lifecycleActions[number];

export async function lifecycle(guildId: string, giveawayId: string, actor: Actor, revision: number, action: LifecycleAction, endAt?: Date) {
  return transaction(async tx => {
    const row = await lockGiveaway(tx, guildId, giveawayId, revision);
    const now = new Date();
    const config = configOf(row);
    if (!await enabled(tx, guildId) && ["schedule", "publish", "resume", "extend"].includes(action)) {
      conflict("Giveaways ist für diesen Server deaktiviert.");
    }
    let data: Prisma.GiveawayUpdateInput;
    let event: string;
    switch (action) {
      case "schedule":
      case "publish": {
        if (!editable.includes(row.status) || row.messageId) conflict("Dieses Giveaway wurde bereits veröffentlicht.");
        await assertNoAnnouncement(tx, row);
        if (!config.channelId) invalid("Wähle einen Ankündigungskanal.");
        const startAt = action === "publish" ? now : row.startAt;
        if (action === "schedule" && startAt <= now) invalid("Die Startzeit muss in der Zukunft liegen.");
        checkTiming(config, { startAt, endAt: row.endAt });
        data = { status: "SCHEDULED", startAt, error: null };
        event = action === "schedule" ? "GIVEAWAY_SCHEDULED" : "PUBLICATION_REQUESTED";
        if (action === "publish") await enqueueAnnouncement(tx, row);
        break;
      }
      case "pause":
      case "resume":
        if ((action === "pause" ? row.status !== "ACTIVE" : row.status !== "PAUSED") || entryDeadline(row.endAt, config.rules) <= now) {
          conflict("Die Teilnahme ist bereits geschlossen oder der Status lässt diese Aktion nicht zu.");
        }
        data = { status: action === "pause" ? "PAUSED" : "ACTIVE", refreshAt: now };
        event = action === "pause" ? "GIVEAWAY_PAUSED" : "GIVEAWAY_RESUMED";
        break;
      case "end":
        await closeGiveaway(tx, row, actor, now);
        return;
      case "cancel":
        if (![...editable, ...open, "ENDED", "DRAW_PENDING", "WINNER_REVIEW"].includes(row.status) || row.publication > row.publishedRound || row.publishedRound > 0) {
          conflict("Dieses Giveaway kann derzeit nicht storniert werden.");
        }
        await assertNoAnnouncement(tx, row);
        data = { status: "CANCELLED", nextWorkAt: null, refreshAt: row.messageId ? now : null };
        event = "GIVEAWAY_CANCELLED";
        break;
      case "extend":
        if (!open.includes(row.status) || row.endAt <= now || !endAt || endAt <= row.endAt) {
          conflict("Nur offene Giveaways lassen sich auf eine spätere Endzeit verlängern.");
        }
        checkTiming(config, { startAt: row.startAt, endAt });
        data = { endAt, refreshAt: now };
        event = "GIVEAWAY_EXTENDED";
        break;
    }
    await tx.giveaway.update({ where: { id: row.id }, data });
    await auditGiveaway(tx, row, actor, event, { before: row.status, after: data }, action === "cancel");
  });
}

export async function advanceLifecycle(row: Giveaway) {
  await transaction(async tx => {
    const current = await lockGiveaway(tx, row.guildId, row.id);
    const now = new Date();
    if (open.includes(current.status) && current.endAt <= now) return closeGiveaway(tx, current, system, now);
    if (current.status !== "SCHEDULED" || current.startAt > now) return;
    const pending = await tx.giveawayJob.findFirst({ where: { giveawayId: current.id, kind: "ANNOUNCEMENT", doneAt: null } });
    if (pending) return;
    if (entryDeadline(current.endAt, configOf(current).rules) <= now) {
      await tx.giveaway.update({ where: { id: current.id }, data: {
        status: "FAILED", error: "Das Teilnahmefenster ist vor der Veröffentlichung abgelaufen.",
      } });
      await auditGiveaway(tx, current, system, "SCHEDULE_MISSED", {}, true);
    } else if (await enabled(tx, current.guildId)) {
      await enqueueAnnouncement(tx, current);
    }
  });
}

export async function dueLifecycle() {
  const now = new Date();
  return db.giveaway.findMany({
    where: { OR: [
      { status: { in: open }, endAt: { lte: now } },
      { status: "SCHEDULED", startAt: { lte: now } },
    ] },
    orderBy: { updatedAt: "asc" }, take: 30,
  });
}
