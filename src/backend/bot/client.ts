import { Client, GatewayIntentBits, Partials } from "discord.js";
import { broadcastEvent } from "../socket/socketManager";
import { setupTicketInteractions } from "./ticketHandler";
import { setupApplicationInteractions } from "./applicationHandler";

export let hasMessageContentIntent = true;

export let discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.User, Partials.Message],
});

export function isBotReady(): boolean {
  return discordClient && discordClient.isReady();
}

function registerClientEvents(client: Client) {
  client.once("ready", (c) => {
    console.log(`[TheGodGen Bot] Logged in as ${c.user.tag}`);
    setupTicketInteractions(c);
    setupApplicationInteractions(c);
    broadcastEvent("botStatusChange", {
      ready: true,
      tag: c.user.tag,
      id: c.user.id,
      ping: c.ws.ping,
    });
  });

  client.on("invalidated", () => {
    console.warn("[TheGodGen Bot] Session invalidated. Connection lost.");
    broadcastEvent("botStatusChange", { ready: false, error: "Session invalidated" });
  });

  // Setup Discord Event Listeners for live updates
  client.on("guildUpdate", (oldGuild, newGuild) => {
    broadcastEvent("guildUpdate", { guildId: newGuild.id, name: newGuild.name, icon: newGuild.iconURL() });
  });

  client.on("channelCreate", (channel) => {
    if ("guild" in channel) {
      broadcastEvent("channelCreate", { guildId: channel.guild.id, channelId: channel.id, name: channel.name, type: channel.type });
    }
  });

  client.on("channelUpdate", (oldChannel, newChannel) => {
    if ("guild" in newChannel) {
      broadcastEvent("channelUpdate", { guildId: newChannel.guild.id, channelId: newChannel.id, name: newChannel.name });
    }
  });

  client.on("channelDelete", (channel) => {
    if ("guild" in channel) {
      broadcastEvent("channelDelete", { guildId: channel.guild.id, channelId: channel.id });
    }
  });

  client.on("roleCreate", (role) => {
    broadcastEvent("roleCreate", { guildId: role.guild.id, roleId: role.id, name: role.name });
  });

  client.on("roleUpdate", (oldRole, newRole) => {
    broadcastEvent("roleUpdate", { guildId: newRole.guild.id, roleId: newRole.id, name: newRole.name });
  });

  client.on("roleDelete", (role) => {
    broadcastEvent("roleDelete", { guildId: role.guild.id, roleId: role.id });
  });

  client.on("emojiCreate", (emoji) => {
    broadcastEvent("emojiCreate", { guildId: emoji.guild.id, emojiId: emoji.id, name: emoji.name });
  });

  client.on("emojiDelete", (emoji) => {
    broadcastEvent("emojiDelete", { guildId: emoji.guild.id, emojiId: emoji.id });
  });

  client.on("stickerCreate", (sticker) => {
    if (sticker.guild) {
      broadcastEvent("stickerCreate", { guildId: sticker.guild.id, stickerId: sticker.id, name: sticker.name });
    }
  });

  client.on("stickerDelete", (sticker) => {
    if (sticker.guild) {
      broadcastEvent("stickerDelete", { guildId: sticker.guild.id, stickerId: sticker.id });
    }
  });

  client.on("inviteCreate", (invite) => {
    if (invite.guild) {
      broadcastEvent("inviteCreate", { guildId: invite.guild.id, code: invite.code });
    }
  });

  client.on("inviteDelete", (invite) => {
    if (invite.guild) {
      broadcastEvent("inviteDelete", { guildId: invite.guild.id, code: invite.code });
    }
  });
}

registerClientEvents(discordClient);

export async function initDiscordBot() {
  const token = process.env.DISCORD_TOKEN;
  if (!token || token === "your_bot_token_here" || token.trim() === "") {
    console.warn("[TheGodGen Bot] DISCORD_TOKEN is missing or default in .env file.");
    broadcastEvent("botStatusChange", { ready: false, error: "DISCORD_TOKEN missing in .env" });
    return;
  }

  try {
    console.log("[TheGodGen Bot] Attempting connection to Discord Gateway...");
    await discordClient.login(token);
  } catch (error: any) {
    console.error("[TheGodGen Bot] Login error:", error.message || error);

    // Handle DisallowedGatewayIntents error by falling back to standard non-privileged intents
    if (error.code === "DisallowedGatewayIntents" || error.message?.includes("intents")) {
      console.warn("[TheGodGen Bot] Privileged MessageContent intent disallowed by Discord portal. Retrying with standard intents...");
      hasMessageContentIntent = false;

      try {
        discordClient = new Client({
          intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildEmojisAndStickers,
            GatewayIntentBits.GuildInvites,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.GuildMessages,
          ],
          partials: [Partials.Channel, Partials.User],
        });

        registerClientEvents(discordClient);
        await discordClient.login(token);
      } catch (fallbackError: any) {
        console.error("[TheGodGen Bot] Fallback login failed:", fallbackError.message || fallbackError);
        broadcastEvent("botStatusChange", { ready: false, error: fallbackError.message });
      }
    } else {
      broadcastEvent("botStatusChange", { ready: false, error: error.message });
    }
  }
}
