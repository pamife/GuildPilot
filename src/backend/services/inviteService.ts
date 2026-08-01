import { TextChannel, VoiceChannel } from "discord.js";
import { discordClient, isBotReady } from "../bot/client";

export async function getGuildInvites(guildId: string) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const invites = await guild.invites.fetch();
  return invites.map((inv) => ({
    code: inv.code,
    url: inv.url,
    channelId: inv.channelId,
    channelName: inv.channel?.name || "Unknown Channel",
    inviter: inv.inviter ? { id: inv.inviter.id, username: inv.inviter.username, tag: inv.inviter.tag } : null,
    uses: inv.uses,
    maxUses: inv.maxUses,
    maxAge: inv.maxAge,
    temporary: inv.temporary,
    createdTimestamp: inv.createdTimestamp,
    expiresTimestamp: inv.expiresTimestamp,
  }));
}

export async function createInvite(
  guildId: string,
  data: {
    channelId: string;
    maxAge?: number;
    maxUses?: number;
    unique?: boolean;
    temporary?: boolean;
  }
) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const channel = guild.channels.cache.get(data.channelId) as TextChannel | VoiceChannel;
  if (!channel) throw new Error("Target channel not found.");

  const invite = await channel.createInvite({
    maxAge: data.maxAge ?? 86400, // default 24h
    maxUses: data.maxUses ?? 0,   // default unlimited
    unique: data.unique ?? true,
    temporary: data.temporary ?? false,
  });

  return {
    code: invite.code,
    url: invite.url,
    channelId: invite.channelId,
    uses: invite.uses,
    maxUses: invite.maxUses,
    maxAge: invite.maxAge,
    expiresTimestamp: invite.expiresTimestamp,
  };
}

export async function deleteInvite(guildId: string, code: string) {
  if (!isBotReady) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const invites = await guild.invites.fetch();
  const invite = invites.get(code);
  if (!invite) throw new Error("Invite not found.");

  await invite.delete();
  return { success: true, code };
}
