import {
  Client,
  GuildMember,
  TextChannel,
  AttachmentBuilder,
  User,
} from "discord.js";
import { getWelcomeSetting, getLeaveSetting } from "../services/welcomeService";
import { generateGreetingCard } from "../services/welcomeCardGenerator";

function replacePlaceholders(
  template: string,
  data: {
    userMention: string;
    username: string;
    serverName: string;
    memberCount: number;
  }
): string {
  if (!template) return "";
  return template
    .replace(/\{user\}/gi, data.userMention)
    .replace(/\{username\}/gi, data.username)
    .replace(/\{server\}/gi, data.serverName)
    .replace(/\{guild\}/gi, data.serverName)
    .replace(/\{memberCount\}/gi, String(data.memberCount))
    .replace(/\{count\}/gi, String(data.memberCount))
    .replace(/\{memberOrdinal\}/gi, `#${data.memberCount}`);
}

export function setupWelcomeInteractions(client: Client) {
  // 1. Member Joined Server Event
  client.on("guildMemberAdd", async (member: GuildMember) => {
    try {
      const guild = member.guild;
      const setting = await getWelcomeSetting(guild.id);

      // Auto-assign roles if configured
      if (setting.autoRoles) {
        try {
          const roleIds: string[] = JSON.parse(setting.autoRoles || "[]");
          if (Array.isArray(roleIds) && roleIds.length > 0) {
            await member.roles.add(roleIds).catch((err) => {
              console.warn(
                `[Welcome] Failed to assign auto-roles to ${member.user.tag}:`,
                err.message
              );
            });
          }
        } catch (e) {
          console.warn("[Welcome] Error parsing autoRoles JSON:", e);
        }
      }

      // Check if welcome message is enabled
      if (!setting.enabled || !setting.channelId) return;

      const channel = (await guild.channels
        .fetch(setting.channelId)
        .catch(() => null)) as TextChannel | null;
      if (!channel || !channel.isTextBased()) return;

      const placeholderData = {
        userMention: `<@${member.id}>`,
        username: member.user.username,
        serverName: guild.name,
        memberCount: guild.memberCount,
      };

      const messageContent = replacePlaceholders(
        setting.messageText || "Welcome {user} to **{server}**!",
        placeholderData
      );

      const files: AttachmentBuilder[] = [];

      if (setting.sendCard) {
        const cardTitle = replacePlaceholders(
          setting.cardTitle || "Welcome @{username}",
          placeholderData
        );
        const cardSubtitle = replacePlaceholders(
          setting.cardSubtitle || "Member #{memberCount}",
          placeholderData
        );

        const cardBuffer = await generateGreetingCard({
          avatarUrl: member.user.displayAvatarURL({ extension: "png", size: 256 }),
          username: member.user.username,
          memberCount: guild.memberCount,
          serverName: guild.name,
          title: cardTitle,
          subtitle: cardSubtitle,
          avatarRingColor: setting.avatarRingColor || "#00d2d3",
          cardBgColor: setting.cardBgColor || "#1e1f22",
          cardBorderColor: setting.cardBorderColor || "#2b2d31",
          cardBgImage: setting.cardBgImage,
          mode: "welcome",
        });

        files.push(new AttachmentBuilder(cardBuffer, { name: "welcome.png" }));
      }

      // Send to Welcome Channel
      await channel.send({
        content: messageContent,
        files: files.length > 0 ? files : undefined,
      });

      // Optional DM to member
      if (setting.sendDm && setting.dmText) {
        try {
          const dmContent = replacePlaceholders(setting.dmText, placeholderData);
          await member.send({ content: dmContent });
        } catch {
          // Closed DMs are common, ignore silently
        }
      }
    } catch (error: any) {
      console.error("[Welcome] Error in guildMemberAdd event:", error);
    }
  });

  // 2. Member Left Server Event (Goodbye / Bye)
  client.on("guildMemberRemove", async (member) => {
    try {
      const guild = member.guild;
      const setting = await getLeaveSetting(guild.id);

      if (!setting.enabled || !setting.channelId) return;

      const channel = (await guild.channels
        .fetch(setting.channelId)
        .catch(() => null)) as TextChannel | null;
      if (!channel || !channel.isTextBased()) return;

      const placeholderData = {
        userMention: `@${member.user?.username || "Member"}`,
        username: member.user?.username || "Member",
        serverName: guild.name,
        memberCount: guild.memberCount,
      };

      const messageContent = replacePlaceholders(
        setting.messageText || "**{username}** has left the server. We will miss you!",
        placeholderData
      );

      const files: AttachmentBuilder[] = [];

      if (setting.sendCard) {
        const cardTitle = replacePlaceholders(
          setting.cardTitle || "Goodbye @{username}",
          placeholderData
        );
        const cardSubtitle = replacePlaceholders(
          setting.cardSubtitle || "Left {server} • {memberCount} members remain",
          placeholderData
        );

        const cardBuffer = await generateGreetingCard({
          avatarUrl: member.user?.displayAvatarURL({ extension: "png", size: 256 }),
          username: member.user?.username || "Member",
          memberCount: guild.memberCount,
          serverName: guild.name,
          title: cardTitle,
          subtitle: cardSubtitle,
          avatarRingColor: setting.avatarRingColor || "#f43f5e",
          cardBgColor: setting.cardBgColor || "#1e1f22",
          cardBorderColor: setting.cardBorderColor || "#2b2d31",
          cardBgImage: setting.cardBgImage,
          mode: "leave",
        });

        files.push(new AttachmentBuilder(cardBuffer, { name: "goodbye.png" }));
      }

      await channel.send({
        content: messageContent,
        files: files.length > 0 ? files : undefined,
      });
    } catch (error: any) {
      console.error("[Leave] Error in guildMemberRemove event:", error);
    }
  });
}

/**
 * Sends a test welcome message using current or provided settings to test in Discord.
 */
export async function sendTestWelcome(
  client: Client,
  guildId: string,
  customSettings?: any,
  targetUser?: User
) {
  const guild = await client.guilds.fetch(guildId);
  if (!guild) throw new Error("Guild not found");

  const setting = customSettings || (await getWelcomeSetting(guildId));
  const channelId = setting.channelId;
  if (!channelId) throw new Error("No welcome channel configured");

  const channel = (await guild.channels.fetch(channelId).catch(() => null)) as TextChannel | null;
  if (!channel || !channel.isTextBased())
    throw new Error("Target channel not found or bot lacks permission");

  const testUser = targetUser || client.user!;
  const placeholderData = {
    userMention: `<@${testUser.id}>`,
    username: testUser.username,
    serverName: guild.name,
    memberCount: guild.memberCount,
  };

  const messageContent = replacePlaceholders(
    setting.messageText || "Welcome {user} to **{server}**!",
    placeholderData
  );

  const files: AttachmentBuilder[] = [];

  if (setting.sendCard !== false) {
    const cardTitle = replacePlaceholders(
      setting.cardTitle || "Welcome @{username}",
      placeholderData
    );
    const cardSubtitle = replacePlaceholders(
      setting.cardSubtitle || "Member #{memberCount}",
      placeholderData
    );

    const cardBuffer = await generateGreetingCard({
      avatarUrl: testUser.displayAvatarURL({ extension: "png", size: 256 }),
      username: testUser.username,
      memberCount: guild.memberCount,
      serverName: guild.name,
      title: cardTitle,
      subtitle: cardSubtitle,
      avatarRingColor: setting.avatarRingColor || "#00d2d3",
      cardBgColor: setting.cardBgColor || "#1e1f22",
      cardBorderColor: setting.cardBorderColor || "#2b2d31",
      cardBgImage: setting.cardBgImage,
      mode: "welcome",
    });

    files.push(new AttachmentBuilder(cardBuffer, { name: "welcome-test.png" }));
  }

  await channel.send({
    content: messageContent,
    files: files.length > 0 ? files : undefined,
  });

  return { success: true, channelName: channel.name };
}

/**
 * Sends a test leave message to test in Discord.
 */
export async function sendTestLeave(
  client: Client,
  guildId: string,
  customSettings?: any,
  targetUser?: User
) {
  const guild = await client.guilds.fetch(guildId);
  if (!guild) throw new Error("Guild not found");

  const setting = customSettings || (await getLeaveSetting(guildId));
  const channelId = setting.channelId;
  if (!channelId) throw new Error("No goodbye channel configured");

  const channel = (await guild.channels.fetch(channelId).catch(() => null)) as TextChannel | null;
  if (!channel || !channel.isTextBased())
    throw new Error("Target channel not found or bot lacks permission");

  const testUser = targetUser || client.user!;
  const placeholderData = {
    userMention: `@${testUser.username}`,
    username: testUser.username,
    serverName: guild.name,
    memberCount: guild.memberCount,
  };

  const messageContent = replacePlaceholders(
    setting.messageText || "**{username}** has left the server. We will miss you!",
    placeholderData
  );

  const files: AttachmentBuilder[] = [];

  if (setting.sendCard !== false) {
    const cardTitle = replacePlaceholders(
      setting.cardTitle || "Goodbye @{username}",
      placeholderData
    );
    const cardSubtitle = replacePlaceholders(
      setting.cardSubtitle || "Left {server} • {memberCount} members remain",
      placeholderData
    );

    const cardBuffer = await generateGreetingCard({
      avatarUrl: testUser.displayAvatarURL({ extension: "png", size: 256 }),
      username: testUser.username,
      memberCount: guild.memberCount,
      serverName: guild.name,
      title: cardTitle,
      subtitle: cardSubtitle,
      avatarRingColor: setting.avatarRingColor || "#f43f5e",
      cardBgColor: setting.cardBgColor || "#1e1f22",
      cardBorderColor: setting.cardBorderColor || "#2b2d31",
      cardBgImage: setting.cardBgImage,
      mode: "leave",
    });

    files.push(new AttachmentBuilder(cardBuffer, { name: "goodbye-test.png" }));
  }

  await channel.send({
    content: messageContent,
    files: files.length > 0 ? files : undefined,
  });

  return { success: true, channelName: channel.name };
}
