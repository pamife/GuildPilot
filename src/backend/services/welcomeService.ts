import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getWelcomeSetting(guildId: string) {
  let setting = await prisma.welcomeSetting.findUnique({
    where: { guildId },
  });

  if (!setting) {
    setting = await prisma.welcomeSetting.create({
      data: {
        guildId,
        enabled: false,
        messageText: "Welcome {user} to **{server}**!",
        cardTitle: "Welcome @{username}",
        cardSubtitle: "Member #{memberCount}",
        avatarRingColor: "#00d2d3",
        cardBgColor: "#1e1f22",
        cardBorderColor: "#2b2d31",
        sendCard: true,
        sendDm: false,
        dmText: "Welcome to {server}, {user}!",
        autoRoles: "[]",
      },
    });
  }

  return setting;
}

export async function updateWelcomeSetting(guildId: string, data: any) {
  const updateData: any = { ...data };
  if (updateData.autoRoles && typeof updateData.autoRoles !== "string") {
    updateData.autoRoles = JSON.stringify(updateData.autoRoles);
  }

  return await prisma.welcomeSetting.upsert({
    where: { guildId },
    update: updateData,
    create: {
      guildId,
      ...updateData,
    },
  });
}

export async function getLeaveSetting(guildId: string) {
  let setting = await prisma.leaveSetting.findUnique({
    where: { guildId },
  });

  if (!setting) {
    setting = await prisma.leaveSetting.create({
      data: {
        guildId,
        enabled: false,
        messageText: "**{username}** has left the server. We will miss you!",
        cardTitle: "Goodbye @{username}",
        cardSubtitle: "Left {server} • {memberCount} members remain",
        avatarRingColor: "#f43f5e",
        cardBgColor: "#1e1f22",
        cardBorderColor: "#2b2d31",
        sendCard: true,
      },
    });
  }

  return setting;
}

export async function updateLeaveSetting(guildId: string, data: any) {
  return await prisma.leaveSetting.upsert({
    where: { guildId },
    update: data,
    create: {
      guildId,
      ...data,
    },
  });
}
