import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getAutoReacts(guildId: string) {
  return await prisma.autoReact.findMany({
    where: { guildId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAutoReactById(id: string) {
  return await prisma.autoReact.findUnique({
    where: { id },
  });
}

export async function createAutoReact(guildId: string, data: any) {
  const channelIds = Array.isArray(data.channelIds)
    ? JSON.stringify(data.channelIds)
    : data.channelIds || "[]";

  const emojis = Array.isArray(data.emojis)
    ? JSON.stringify(data.emojis)
    : data.emojis || "[]";

  return await prisma.autoReact.create({
    data: {
      guildId,
      name: data.name || "Auto Reaction",
      enabled: data.enabled ?? true,
      channelIds,
      emojis,
      ignoreBots: data.ignoreBots ?? true,
    },
  });
}

export async function updateAutoReact(id: string, data: any) {
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.enabled !== undefined) updateData.enabled = data.enabled;
  if (data.ignoreBots !== undefined) updateData.ignoreBots = data.ignoreBots;
  if (data.channelIds !== undefined) {
    updateData.channelIds = Array.isArray(data.channelIds)
      ? JSON.stringify(data.channelIds)
      : data.channelIds;
  }
  if (data.emojis !== undefined) {
    updateData.emojis = Array.isArray(data.emojis)
      ? JSON.stringify(data.emojis)
      : data.emojis;
  }

  return await prisma.autoReact.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteAutoReact(id: string) {
  return await prisma.autoReact.delete({
    where: { id },
  });
}

export async function toggleAutoReact(id: string) {
  const existing = await prisma.autoReact.findUnique({ where: { id } });
  if (!existing) throw new Error("AutoReact not found");
  return await prisma.autoReact.update({
    where: { id },
    data: { enabled: !existing.enabled },
  });
}
