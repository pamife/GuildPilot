import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getSelfRolePanels(guildId: string) {
  return await prisma.selfRolePanel.findMany({
    where: { guildId },
    include: {
      options: {
        orderBy: { order: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSelfRolePanelById(panelId: string) {
  return await prisma.selfRolePanel.findUnique({
    where: { id: panelId },
    include: {
      options: {
        orderBy: { order: "asc" },
      },
    },
  });
}

export async function createSelfRolePanel(guildId: string, data: any) {
  const { options, ...panelData } = data;

  return await prisma.selfRolePanel.create({
    data: {
      ...panelData,
      guildId,
      options: {
        create: (options || []).map((opt: any, idx: number) => ({
          roleId: opt.roleId,
          roleName: opt.roleName || null,
          roleColor: opt.roleColor || null,
          label: opt.label || null,
          emoji: opt.emoji || null,
          buttonColor: opt.buttonColor || "Secondary",
          description: opt.description || null,
          showMemberCount: opt.showMemberCount !== undefined ? opt.showMemberCount : true,
          requiredRoles: Array.isArray(opt.requiredRoles) ? JSON.stringify(opt.requiredRoles) : (opt.requiredRoles || "[]"),
          exclusiveGroup: opt.exclusiveGroup || null,
          order: opt.order !== undefined ? opt.order : idx,
        })),
      },
    },
    include: {
      options: {
        orderBy: { order: "asc" },
      },
    },
  });
}

export async function updateSelfRolePanel(panelId: string, data: any) {
  const { options, ...panelData } = data;

  return await prisma.$transaction(async (tx) => {
    if (options && Array.isArray(options)) {
      await tx.selfRoleOption.deleteMany({
        where: { panelId },
      });

      await tx.selfRoleOption.createMany({
        data: options.map((opt: any, idx: number) => ({
          panelId,
          roleId: opt.roleId,
          roleName: opt.roleName || null,
          roleColor: opt.roleColor || null,
          label: opt.label || null,
          emoji: opt.emoji || null,
          buttonColor: opt.buttonColor || "Secondary",
          description: opt.description || null,
          showMemberCount: opt.showMemberCount !== undefined ? opt.showMemberCount : true,
          requiredRoles: Array.isArray(opt.requiredRoles) ? JSON.stringify(opt.requiredRoles) : (opt.requiredRoles || "[]"),
          exclusiveGroup: opt.exclusiveGroup || null,
          order: opt.order !== undefined ? opt.order : idx,
        })),
      });
    }

    return await tx.selfRolePanel.update({
      where: { id: panelId },
      data: panelData,
      include: {
        options: {
          orderBy: { order: "asc" },
        },
      },
    });
  });
}

export async function deleteSelfRolePanel(panelId: string) {
  return await prisma.selfRolePanel.delete({
    where: { id: panelId },
  });
}

export async function duplicateSelfRolePanel(panelId: string) {
  const existing = await getSelfRolePanelById(panelId);
  if (!existing) throw new Error("Panel not found");

  return await createSelfRolePanel(existing.guildId, {
    name: `${existing.name} (Copy)`,
    description: existing.description,
    displayType: existing.displayType,
    multiSelect: existing.multiSelect,
    placeholderText: existing.placeholderText,
    embedTitle: existing.embedTitle,
    embedDescription: existing.embedDescription,
    embedColor: existing.embedColor,
    embedAuthorName: existing.embedAuthorName,
    embedAuthorIcon: existing.embedAuthorIcon,
    embedAuthorUrl: existing.embedAuthorUrl,
    thumbnail: existing.thumbnail,
    image: existing.image,
    footer: existing.footer,
    footerIcon: existing.footerIcon,
    showTimestamp: existing.showTimestamp,
    embedFields: existing.embedFields,
    addRoleMessage: existing.addRoleMessage,
    removeRoleMessage: existing.removeRoleMessage,
    ephemeralResponse: existing.ephemeralResponse,
    channelId: null,
    messageId: null,
    options: existing.options.map((opt) => ({
      roleId: opt.roleId,
      roleName: opt.roleName,
      roleColor: opt.roleColor,
      label: opt.label,
      emoji: opt.emoji,
      buttonColor: opt.buttonColor,
      description: opt.description,
      showMemberCount: opt.showMemberCount,
      requiredRoles: opt.requiredRoles,
      exclusiveGroup: opt.exclusiveGroup,
      order: opt.order,
    })),
  });
}
