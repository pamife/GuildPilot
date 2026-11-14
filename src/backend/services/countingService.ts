import { CountingGame, PrismaClient } from "@prisma/client";
import type { CountingStats } from "../../types/counting";

const prisma = new PrismaClient();
const initialRun = {
  nextNumber: "1",
  lastPlayerId: null,
  recentPlayers: "[]",
  saveStatus: "available",
};

// SQLite has one writer. Queue game mutations in arrival order, including setup and manual resets.
let pendingWrite = Promise.resolve();
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = pendingWrite.then(operation);
  pendingWrite = result.then(() => undefined, () => undefined);
  return result;
}

function relayProgress(players: string[]): number {
  const distinct = new Set<string>();
  for (const player of [...players].reverse()) {
    if (distinct.has(player)) break;
    distinct.add(player);
  }
  return distinct.size;
}

function stats(game: CountingGame | null): CountingStats {
  const saveStatus = game?.saveStatus;
  return {
    channelId: game?.channelId ?? null,
    nextNumber: game?.nextNumber ?? "1",
    record: game?.record ?? "0",
    saveStatus: saveStatus === "charged" || saveStatus === "used" ? saveStatus : "available",
    relayProgress: game ? relayProgress(JSON.parse(game.recentPlayers)) : 0,
  };
}

export async function getCountingStats(guildId: string) {
  return stats(await prisma.countingGame.findUnique({ where: { guildId } }));
}

export function setCountingChannel(guildId: string, channelId: string) {
  return enqueue(async () => stats(await prisma.countingGame.upsert({
    where: { guildId },
    create: { guildId, channelId },
    update: { channelId },
  })));
}

export function resetCountingRun(guildId: string) {
  return enqueue(async () => {
    const { count } = await prisma.countingGame.updateMany({ where: { guildId }, data: initialRun });
    return count > 0;
  });
}

export function processCountingMessage(message: {
  guildId: string;
  channelId: string;
  messageId: string;
  playerId: string;
  content: string;
}) {
  const digits = message.content.trim();
  if (!/^[0-9]+$/.test(digits)) return Promise.resolve(null);
  const number = digits.replace(/^0+/, "");
  if (!number) return Promise.resolve(null);

  return enqueue(() => prisma.$transaction(async (tx) => {
    const where = { guildId: message.guildId };
    const game = await tx.countingGame.findUnique({ where });
    if (!game || game.channelId !== message.channelId) return null;

    const receipt = { messageId: message.messageId };
    if (await tx.countingMessage.findUnique({ where: receipt })) return null;
    await tx.countingMessage.create({ data: receipt });

    if (number !== game.nextNumber || message.playerId === game.lastPlayerId) {
      if (game.saveStatus === "charged") {
        await tx.countingGame.update({ where, data: { saveStatus: "used" } });
        return { outcome: "saved", nextNumber: game.nextNumber } as const;
      }
      await tx.countingGame.update({ where, data: initialRun });
      return { outcome: "reset", nextNumber: "1" } as const;
    }

    const players: string[] = JSON.parse(game.recentPlayers);
    const recentPlayers = [...players, message.playerId].slice(-5);
    const earned = game.saveStatus === "available" && relayProgress(recentPlayers) === 5;
    const current = BigInt(number);
    const nextNumber = (current + 1n).toString();
    await tx.countingGame.update({
      where,
      data: {
        nextNumber,
        record: current > BigInt(game.record) ? number : game.record,
        lastPlayerId: message.playerId,
        recentPlayers: JSON.stringify(recentPlayers),
        saveStatus: earned ? "charged" : game.saveStatus,
      },
    });
    return { outcome: earned ? "earned" : "valid", nextNumber } as const;
  }));
}
