import { createHash, randomBytes } from "node:crypto";
import { Giveaway, Prisma } from "@prisma/client";
import { GiveawayClaimDelivery, GiveawayConfig, GiveawaySettings, giveawayDefaults } from "../../../types/giveaways";
import { GIVEAWAYS_PLUGIN } from "../../../types/plugins";
import { pluginDb, PluginError } from "../pluginService";
import { conflict } from "./validation";

export const db = pluginDb;
export const id = () => randomBytes(16).toString("hex");
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const configOf = (row: Pick<Giveaway, "config">): GiveawayConfig => JSON.parse(row.config);
export const claimDeliveryOf = (row: Pick<Giveaway, "claimDelivery">): GiveawayClaimDelivery | null =>
  row.claimDelivery ? JSON.parse(row.claimDelivery) : null;
export const settingsOf = (value?: string): GiveawaySettings => {
  const settings = JSON.parse(value ?? "{}");
  return { ...giveawayDefaults, ...settings, rules: { ...giveawayDefaults.rules, ...settings.rules } };
};
export type Tx = Prisma.TransactionClient;
export type Actor = { id: string; username: string };
export const system: Actor = { id: "system", username: "Scheduler" };

export async function transaction<T>(work: (tx: Tx) => Promise<T>) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(work, { timeout: 15_000 });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) ||
        !["P1008", "P2028", "P2034"].includes(error.code) || attempt >= 3) throw error;
      await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 55));
    }
  }
}

export function job(tx: Tx, guildId: string, giveawayId: string | null, kind: string, payload: object, key = id()) {
  return tx.giveawayJob.upsert({
    where: { id: key }, update: {},
    create: { id: key, guildId, giveawayId, kind, payload: JSON.stringify(payload) },
  });
}

export async function audit(tx: Tx, guildId: string, giveawayId: string | null, actor: Actor, event: string, detail: object = {}, notify = false) {
  const row = await tx.giveawayAudit.create({ data: { guildId, giveawayId, event, actor: actor.id, detail: JSON.stringify(detail) } });
  if (notify) {
    const config = await tx.guildPlugin.findUnique({ where: { guildId_pluginId: { guildId, pluginId: GIVEAWAYS_PLUGIN } } });
    const channelId = settingsOf(config?.config).auditChannelId;
    if (channelId) await job(tx, guildId, giveawayId, "AUDIT", { channelId, event, auditId: row.id });
  }
}

export function auditGiveaway(tx: Tx, giveaway: Giveaway, actor: Actor, event: string, detail: object = {}, notify = false) {
  return audit(tx, giveaway.guildId, giveaway.id, actor, event, detail, notify);
}

export async function activation(guildId: string, actor: Actor, enabled: boolean) {
  return transaction(async tx => {
    const key = { guildId_pluginId: { guildId, pluginId: GIVEAWAYS_PLUGIN } };
    const before = await tx.guildPlugin.findUnique({ where: key });
    const row = await tx.guildPlugin.upsert({
      where: key, update: { enabled }, create: { guildId, pluginId: GIVEAWAYS_PLUGIN, enabled },
    });
    if ((before?.enabled ?? false) !== enabled) {
      await tx.giveaway.updateMany({ where: { guildId, status: "ACTIVE", messageId: { not: null } }, data: {
        refreshAt: new Date(), revision: { increment: 1 },
      } });
      if (enabled) await tx.giveawayJob.updateMany({
        where: { guildId, kind: "ANNOUNCEMENT", doneAt: null, lockUntil: null },
        data: { runAt: new Date() },
      });
      await audit(tx, guildId, null, actor, enabled ? "PLUGIN_ENABLED" : "PLUGIN_DISABLED", { before: before?.enabled ?? false, enabled }, true);
    }
    return row;
  });
}

export async function saveSettings(guildId: string, actor: Actor, settings: GiveawaySettings) {
  return transaction(async tx => {
    const key = { guildId_pluginId: { guildId, pluginId: GIVEAWAYS_PLUGIN } };
    const before = await tx.guildPlugin.findUnique({ where: key });
    if (!before?.enabled) conflict("Giveaways ist für diesen Server deaktiviert.");
    await tx.guildPlugin.update({ where: key, data: { config: JSON.stringify(settings) } });
    await audit(tx, guildId, null, actor, "SETTINGS_CHANGED", { before: settingsOf(before?.config), after: settings }, true);
    return settings;
  });
}

export async function getGiveaway(guildId: string, giveawayId: string, tx: Tx = db) {
  const row = await tx.giveaway.findFirst({ where: { id: giveawayId, guildId } });
  if (!row) throw new PluginError(404, "Giveaway nicht gefunden.");
  return row;
}

export async function lockGiveaway(tx: Tx, guildId: string, giveawayId: string, revision?: number) {
  const locked = await tx.giveaway.updateMany({
    where: { id: giveawayId, guildId, revision },
    data: { revision: { increment: 1 } },
  });
  if (!locked.count) {
    await getGiveaway(guildId, giveawayId, tx);
    conflict("Das Giveaway wurde inzwischen geändert. Lade die aktuellen Daten.");
  }
  return getGiveaway(guildId, giveawayId, tx);
}

export async function enabled(tx: Tx, guildId: string) {
  return Boolean((await tx.guildPlugin.findUnique({ where: { guildId_pluginId: { guildId, pluginId: GIVEAWAYS_PLUGIN } } }))?.enabled);
}

export function publicGiveaway(row: Giveaway) {
  const { seed: _seed, claimDelivery: _claimDelivery, ...safe } = row;
  return { ...safe, config: configOf(row) };
}
