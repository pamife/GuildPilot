import { Client, GatewayIntentBits, Partials } from "discord.js";
import { broadcastEvent } from "../socket/socketManager";

export const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel, Partials.User],
});

export function isBotReady(): boolean {
  return discordClient.isReady();
}

discordClient.once("ready", (client) => {
  console.log(`[GuildPilot Bot] Logged in as ${client.user.tag}`);
  broadcastEvent("botStatusChange", {
    ready: true,
    tag: client.user.tag,
    id: client.user.id,
    ping: client.ws.ping,
  });
});

// Setup Discord Event Listeners for live updates
discordClient.on("guildUpdate", (oldGuild, newGuild) => {
  broadcastEvent("guildUpdate", { guildId: newGuild.id, name: newGuild.name, icon: newGuild.iconURL() });
});

discordClient.on("channelCreate", (channel) => {
  if ("guild" in channel) {
    broadcastEvent("channelCreate", { guildId: channel.guild.id, channelId: channel.id, name: channel.name, type: channel.type });
  }
});

discordClient.on("channelUpdate", (oldChannel, newChannel) => {
  if ("guild" in newChannel) {
    broadcastEvent("channelUpdate", { guildId: newChannel.guild.id, channelId: newChannel.id, name: newChannel.name });
  }
});

discordClient.on("channelDelete", (channel) => {
  if ("guild" in channel) {
    broadcastEvent("channelDelete", { guildId: channel.guild.id, channelId: channel.id });
  }
});

discordClient.on("roleCreate", (role) => {
  broadcastEvent("roleCreate", { guildId: role.guild.id, roleId: role.id, name: role.name });
});

discordClient.on("roleUpdate", (oldRole, newRole) => {
  broadcastEvent("roleUpdate", { guildId: newRole.guild.id, roleId: newRole.id, name: newRole.name });
});

discordClient.on("roleDelete", (role) => {
  broadcastEvent("roleDelete", { guildId: role.guild.id, roleId: role.id });
});

discordClient.on("emojiCreate", (emoji) => {
  broadcastEvent("emojiCreate", { guildId: emoji.guild.id, emojiId: emoji.id, name: emoji.name });
});

discordClient.on("emojiDelete", (emoji) => {
  broadcastEvent("emojiDelete", { guildId: emoji.guild.id, emojiId: emoji.id });
});

discordClient.on("stickerCreate", (sticker) => {
  if (sticker.guild) {
    broadcastEvent("stickerCreate", { guildId: sticker.guild.id, stickerId: sticker.id, name: sticker.name });
  }
});

discordClient.on("stickerDelete", (sticker) => {
  if (sticker.guild) {
    broadcastEvent("stickerDelete", { guildId: sticker.guild.id, stickerId: sticker.id });
  }
});

discordClient.on("inviteCreate", (invite) => {
  if (invite.guild) {
    broadcastEvent("inviteCreate", { guildId: invite.guild.id, code: invite.code });
  }
});

discordClient.on("inviteDelete", (invite) => {
  if (invite.guild) {
    broadcastEvent("inviteDelete", { guildId: invite.guild.id, code: invite.code });
  }
});

export async function initDiscordBot() {
  const token = process.env.DISCORD_TOKEN;
  if (!token || token === "your_bot_token_here") {
    console.warn("[GuildPilot Bot] DISCORD_TOKEN is missing or default. Bot will remain offline until configured.");
    return;
  }

  try {
    await discordClient.login(token);
  } catch (error) {
    console.error("[GuildPilot Bot] Failed to log in to Discord:", error);
  }
}
