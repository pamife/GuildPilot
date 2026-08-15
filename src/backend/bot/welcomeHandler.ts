import {
  Client,
  GuildMember,
  TextChannel,
  AttachmentBuilder,
  User,
  PartialGuildMember,
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
  console.log("[Welcome] 🛠️ Setting up Welcome & Goodbye event listeners...");

  // 1. Member Joined Server Event
  client.on("guildMemberAdd", async (member: GuildMember) => {
    try {
      const guild = member.guild;
      console.log(
        `[Welcome] 🔔 Member joined: ${member.user?.tag || member.id} in ${guild.name} (${guild.id})`
      );

      const setting = await getWelcomeSetting(guild.id);
      console.log(
        `[Welcome] Config for ${guild.name}: enabled=${setting.enabled}, channelId=${setting.channelId}`
      );

      // Auto-assign roles if configured
      if (setting.autoRoles) {
        try {
          const roleIds: string[] = JSON.parse(setting.autoRoles || "[]");
          if (Array.isArray(roleIds) && roleIds.length > 0) {
            for (const rId of roleIds) {
              await member.roles.add(rId).catch((err) => {
                console.warn(
                  `[Welcome] Failed to assign auto-role ${rId} to ${member.user.tag}:`,
                  err.message
                );
              });
            }
          }
        } catch (e) {
          console.warn("[Welcome] Error parsing autoRoles JSON:", e);
        }
      }

      // Check if welcome message is enabled
      if (!setting.enabled) {
        console.log(`[Welcome] Welcome messages are disabled for ${guild.name}.`);
        return;
      }

      if (!setting.channelId) {
        console.warn(`[Welcome] Welcome message enabled, but no channelId configured for ${guild.name}.`);
        return;
      }

      const channel = (await guild.channels
        .fetch(setting.channelId)
        .catch((err) => {
          console.error(`[Welcome] Failed to fetch channel ${setting.channelId}:`, err.message);
          return null;
        })) as TextChannel | null;

      if (!channel || !channel.isTextBased()) {
        console.error(
          `[Welcome] Target channel ${setting.channelId} is invalid or not text-based.`
        );
        return;
      }

      const placeholderData = {
        userMention: `<@${member.id}>`,
        username: member.user?.username || member.displayName || "Member",
        serverName: guild.name,
        memberCount: guild.memberCount,
      };

      const messageContent = replacePlaceholders(
        setting.messageText || "Welcome {user} to **{server}**!",
        placeholderData
      );

      const files: AttachmentBuilder[] = [];

      if (setting.sendCard) {
        try {
          const cardTitle = replacePlaceholders(
            setting.cardTitle || "Welcome @{username}",
            placeholderData
          );
          const cardSubtitle = replacePlaceholders(
            setting.cardSubtitle || "Member #{memberCount}",
            placeholderData
          );

          const avatarUrl = member.user?.displayAvatarURL
            ? member.user.displayAvatarURL({ extension: "png", size: 256 })
            : null;

          const cardBuffer = await generateGreetingCard({
            avatarUrl,
            username: member.user?.username || member.displayName || "Member",
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
        } catch (cardErr: any) {
          console.error("[Welcome] Error generating welcome card:", cardErr.message);
        }
      }

      // Send to Welcome Channel
      await channel.send({
        content: messageContent,
        files: files.length > 0 ? files : undefined,
      });

      console.log(`[Welcome] ✅ Successfully sent welcome message for ${member.user?.tag} in #${channel.name}`);

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
      console.error("[Welcome] ❌ Error in guildMemberAdd event:", error);
    }
  });

  // 2. Member Left Server Event (Goodbye / Bye)
  client.on("guildMemberRemove", async (member: GuildMember | PartialGuildMember) => {
    try {
      const guild = member.guild;
      const username = member.user?.username || "Member";
      console.log(
        `[Leave] 🔔 Member left: ${username} (${member.id}) from ${guild.name} (${guild.id})`
      );

      const setting = await getLeaveSetting(guild.id);
      console.log(
        `[Leave] Config for ${guild.name}: enabled=${setting.enabled}, channelId=${setting.channelId}`
      );

      if (!setting.enabled) {
        console.log(`[Leave] Goodbye messages are disabled for ${guild.name}.`);
        return;
      }

      if (!setting.channelId) {
        console.warn(`[Leave] Goodbye message enabled, but no channelId configured for ${guild.name}.`);
        return;
      }

      const channel = (await guild.channels
        .fetch(setting.channelId)
        .catch((err) => {
          console.error(`[Leave] Failed to fetch channel ${setting.channelId}:`, err.message);
          return null;
        })) as TextChannel | null;

      if (!channel || !channel.isTextBased()) {
        console.error(
          `[Leave] Target channel ${setting.channelId} is invalid or not text-based.`
        );
        return;
      }

      const placeholderData = {
        userMention: `@${username}`,
        username: username,
        serverName: guild.name,
        memberCount: guild.memberCount,
      };

      const messageContent = replacePlaceholders(
        setting.messageText || "**{username}** has left the server. We will miss you!",
        placeholderData
      );

      const files: AttachmentBuilder[] = [];

      if (setting.sendCard) {
        try {
          const cardTitle = replacePlaceholders(
            setting.cardTitle || "Goodbye @{username}",
            placeholderData
          );
          const cardSubtitle = replacePlaceholders(
            setting.cardSubtitle || "Left {server} • {memberCount} members remain",
            placeholderData
          );

          const avatarUrl = member.user?.displayAvatarURL
            ? member.user.displayAvatarURL({ extension: "png", size: 256 })
            : null;

          const cardBuffer = await generateGreetingCard({
            avatarUrl,
            username: username,
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
        } catch (cardErr: any) {
          console.error("[Leave] Error generating leave card:", cardErr.message);
        }
      }

      await channel.send({
        content: messageContent,
        files: files.length > 0 ? files : undefined,
      });

      console.log(`[Leave] ✅ Successfully sent goodbye message for ${username} in #${channel.name}`);
    } catch (error: any) {
      console.error("[Leave] ❌ Error in guildMemberRemove event:", error);
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
    try {
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
    } catch (e: any) {
      console.error("[Welcome Test] Card error:", e);
    }
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
    try {
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
    } catch (e: any) {
      console.error("[Leave Test] Card error:", e);
    }
  }

  await channel.send({
    content: messageContent,
    files: files.length > 0 ? files : undefined,
  });

  return { success: true, channelName: channel.name };
}
