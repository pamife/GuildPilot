import { Prisma, PrismaClient } from "@prisma/client";
import type { AutoModSettings, ModerationSettings } from "../../types/moderation";

export const moderationDb = new PrismaClient();

const defaultRule = { enabled: false, action: "log" } as const;
export const defaultAutoMod: AutoModSettings = {
  flood: { ...defaultRule, exemptRoleIds: [], exemptChannelIds: [], threshold: 6, windowSeconds: 8 },
  repeat: { ...defaultRule, exemptRoleIds: [], exemptChannelIds: [], threshold: 3, windowSeconds: 20 },
  invites: { ...defaultRule, exemptRoleIds: [], exemptChannelIds: [], allowedCodes: [] },
};

export async function getModerationSettings(guildId: string): Promise<ModerationSettings> {
  const row = await moderationDb.moderationSettings.findUnique({ where: { guildId } });
  return {
    logChannelId: row?.logChannelId ?? null,
    reviewRoleIds: JSON.parse(row?.reviewRoleIds ?? "[]"),
    timeoutRoleIds: JSON.parse(row?.timeoutRoleIds ?? "[]"),
  };
}

export async function getAutoModSettings(guildId: string): Promise<AutoModSettings> {
  const row = await moderationDb.autoModSettings.findUnique({ where: { guildId } });
  return row ? JSON.parse(row.rules) : defaultAutoMod;
}

const operations = new Map<string, Promise<unknown>>();

export async function serializeModeration<T>(key: string, action: () => Promise<T>): Promise<T> {
  const previous = operations.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(action);
  operations.set(key, current);
  try {
    return await current;
  } finally {
    if (operations.get(key) === current) operations.delete(key);
  }
}

type NewCase = Pick<Prisma.ModerationCaseUncheckedCreateInput,
  "guildId" | "targetId" | "sourceId" | "action" | "reason" |
  "moderatorId" | "ruleIds" | "durationSeconds" | "reversesCaseNumber">;

export function reserveCase(data: NewCase) {
  // Reserve the source before any Discord side effect. The counter and case commit together.
  return serializeModeration("allocate-case", () => moderationDb.$transaction(async (tx) => {
    await tx.$executeRaw`INSERT OR IGNORE INTO "ModerationCaseSequence" ("guildId", "lastNumber") VALUES (${data.guildId}, 0)`;
    const existing = await tx.moderationCase.findUnique({ where: { sourceId: data.sourceId } });
    if (existing) return { record: existing, created: false };
    const sequence = await tx.moderationCaseSequence.update({
      where: { guildId: data.guildId },
      data: { lastNumber: { increment: 1 } },
    });
    const record = await tx.moderationCase.create({ data: { ...data, number: sequence.lastNumber } });
    return { record, created: true };
  }));
}

export function finishCase(
  sourceId: string,
  status: "succeeded" | "failed" | "message_missing",
  details: { timeoutUntil?: Date | null; error?: string } = {},
) {
  return moderationDb.moderationCase.update({ where: { sourceId }, data: { status, ...details } });
}
