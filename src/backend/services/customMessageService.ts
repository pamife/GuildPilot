import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getCustomMessages(guildId: string) {
  return await prisma.customMessage.findMany({
    where: { guildId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getCustomMessageById(id: string) {
  return await prisma.customMessage.findUnique({
    where: { id },
  });
}

export async function createCustomMessage(guildId: string, data: any) {
  return await prisma.customMessage.create({
    data: {
      guildId,
      name: data.name || "Untitled Custom Message",
      description: data.description || null,
      mode: data.mode || "components_v2",
      channelId: data.channelId || null,
      messageId: data.messageId || null,
      content: data.content || null,
      flags: data.flags !== undefined ? data.flags : 32768,
      accentColor: data.accentColor || "#5865F2",
      spoiler: !!data.spoiler,
      containerConfig: typeof data.containerConfig === "object" ? JSON.stringify(data.containerConfig) : (data.containerConfig || "[]"),
      embedConfig: typeof data.embedConfig === "object" ? JSON.stringify(data.embedConfig) : (data.embedConfig || "{}"),
      componentsConfig: typeof data.componentsConfig === "object" ? JSON.stringify(data.componentsConfig) : (data.componentsConfig || "[]"),
    },
  });
}

export async function updateCustomMessage(id: string, data: any) {
  const updateData: any = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.mode !== undefined) updateData.mode = data.mode;
  if (data.channelId !== undefined) updateData.channelId = data.channelId;
  if (data.messageId !== undefined) updateData.messageId = data.messageId;
  if (data.content !== undefined) updateData.content = data.content;
  if (data.flags !== undefined) updateData.flags = data.flags;
  if (data.accentColor !== undefined) updateData.accentColor = data.accentColor;
  if (data.spoiler !== undefined) updateData.spoiler = !!data.spoiler;
  if (data.containerConfig !== undefined) {
    updateData.containerConfig = typeof data.containerConfig === "object" ? JSON.stringify(data.containerConfig) : data.containerConfig;
  }
  if (data.embedConfig !== undefined) {
    updateData.embedConfig = typeof data.embedConfig === "object" ? JSON.stringify(data.embedConfig) : data.embedConfig;
  }
  if (data.componentsConfig !== undefined) {
    updateData.componentsConfig = typeof data.componentsConfig === "object" ? JSON.stringify(data.componentsConfig) : data.componentsConfig;
  }
  if (data.lastSentAt !== undefined) updateData.lastSentAt = data.lastSentAt;

  return await prisma.customMessage.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteCustomMessage(id: string) {
  return await prisma.customMessage.delete({
    where: { id },
  });
}

export async function duplicateCustomMessage(id: string) {
  const existing = await getCustomMessageById(id);
  if (!existing) throw new Error("Custom message not found");

  return await prisma.customMessage.create({
    data: {
      guildId: existing.guildId,
      name: `${existing.name} (Copy)`,
      description: existing.description,
      mode: existing.mode,
      channelId: existing.channelId,
      messageId: null,
      content: existing.content,
      flags: existing.flags,
      accentColor: existing.accentColor,
      spoiler: existing.spoiler,
      containerConfig: existing.containerConfig,
      embedConfig: existing.embedConfig,
      componentsConfig: existing.componentsConfig,
    },
  });
}
