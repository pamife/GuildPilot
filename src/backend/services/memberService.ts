import { ChannelType, GuildMember } from "discord.js";
import { discordClient, isBotReady } from "../bot/client";

export interface MemberDTO {
  id: string;
  user: {
    id: string;
    username: string;
    discriminator: string;
    globalName: string | null;
    bot: boolean;
    avatar: string | null;
    createdAt: string;
  };
  displayName: string;
  nickname: string | null;
  avatar: string | null;
  roles: Array<{
    id: string;
    name: string;
    color: string;
    position: number;
    managed: boolean;
  }>;
  highestRole: {
    id: string;
    name: string;
    color: string;
    position: number;
  };
  joinedAt: string | null;
  isOwner: boolean;
  isTimedOut: boolean;
  communicationDisabledUntil: string | null;
  premiumSince: string | null;
  voice: {
    channelId: string;
    channelName: string;
    mute: boolean;
    deaf: boolean;
    selfMute: boolean;
    selfDeaf: boolean;
  } | null;
  manageable: boolean;
  kickable: boolean;
  bannable: boolean;
  moderatable: boolean;
}

function formatMember(member: GuildMember, guildOwnerId: string): MemberDTO {
  const isTimedOut = member.isCommunicationDisabled();
  return {
    id: member.id,
    user: {
      id: member.user.id,
      username: member.user.username,
      discriminator: member.user.discriminator,
      globalName: member.user.globalName || null,
      bot: member.user.bot,
      avatar: member.user.displayAvatarURL({ size: 128 }),
      createdAt: member.user.createdAt.toISOString(),
    },
    displayName: member.displayName,
    nickname: member.nickname,
    avatar: member.displayAvatarURL({ size: 128 }),
    roles: member.roles.cache
      .filter((r) => r.id !== member.guild.id)
      .map((r) => ({
        id: r.id,
        name: r.name,
        color: r.hexColor === "#000000" ? "#99aab5" : r.hexColor,
        position: r.position,
        managed: r.managed,
      }))
      .sort((a, b) => b.position - a.position),
    highestRole: {
      id: member.roles.highest.id,
      name: member.roles.highest.name,
      color: member.roles.highest.hexColor === "#000000" ? "#99aab5" : member.roles.highest.hexColor,
      position: member.roles.highest.position,
    },
    joinedAt: member.joinedAt ? member.joinedAt.toISOString() : null,
    isOwner: member.id === guildOwnerId,
    isTimedOut,
    communicationDisabledUntil: member.communicationDisabledUntil
      ? member.communicationDisabledUntil.toISOString()
      : null,
    premiumSince: member.premiumSince ? member.premiumSince.toISOString() : null,
    voice: member.voice.channel
      ? {
          channelId: member.voice.channel.id,
          channelName: member.voice.channel.name,
          mute: member.voice.serverMute || false,
          deaf: member.voice.serverDeaf || false,
          selfMute: member.voice.selfMute || false,
          selfDeaf: member.voice.selfDeaf || false,
        }
      : null,
    manageable: member.manageable,
    kickable: member.kickable,
    bannable: member.bannable,
    moderatable: member.moderatable,
  };
}

export async function getGuildMembers(
  guildId: string,
  options?: { query?: string; roleId?: string; limit?: number }
) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId) || (await discordClient.guilds.fetch(guildId).catch(() => null));
  if (!guild) throw new Error("Guild not found.");

  // Fetch all guild members or search
  let membersCollection;
  if (options?.query && options.query.trim().length > 0) {
    try {
      membersCollection = await guild.members.search({ query: options.query.trim(), limit: options?.limit || 100 });
    } catch {
      membersCollection = guild.members.cache;
    }
  } else {
    try {
      membersCollection = await guild.members.fetch({ limit: options?.limit || 1000 });
    } catch {
      membersCollection = guild.members.cache;
    }
  }

  let list = Array.from(membersCollection.values());

  // Filter by role if provided
  if (options?.roleId && options.roleId !== "all") {
    list = list.filter((m) => m.roles.cache.has(options.roleId!));
  }

  // Filter query in memory if query was passed and search wasn't enough
  if (options?.query && options.query.trim().length > 0) {
    const q = options.query.toLowerCase().trim();
    list = list.filter(
      (m) =>
        m.user.username.toLowerCase().includes(q) ||
        (m.nickname && m.nickname.toLowerCase().includes(q)) ||
        (m.displayName && m.displayName.toLowerCase().includes(q)) ||
        m.user.id.includes(q)
    );
  }

  return list.map((m) => formatMember(m, guild.ownerId));
}

export async function getGuildMember(guildId: string, memberId: string) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const member = await guild.members.fetch(memberId);
  if (!member) throw new Error("Member not found.");

  return formatMember(member, guild.ownerId);
}

export async function updateMemberNickname(guildId: string, memberId: string, nickname: string | null) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const member = await guild.members.fetch(memberId);
  if (!member) throw new Error("Member not found.");

  const cleanNick = nickname && nickname.trim().length > 0 ? nickname.trim() : null;
  await member.setNickname(cleanNick, "Updated via GuildPilot Dashboard");

  return formatMember(member, guild.ownerId);
}

export async function updateMemberRoles(guildId: string, memberId: string, roleIds: string[]) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const member = await guild.members.fetch(memberId);
  if (!member) throw new Error("Member not found.");

  // Keep managed roles and roles that are higher than bot's highest role
  const botHighestPosition = guild.members.me?.roles.highest.position || 0;
  const unmanageableRoles = member.roles.cache
    .filter((r) => r.managed || r.position >= botHighestPosition)
    .map((r) => r.id);

  // Unique merged role IDs
  const finalRoleIds = Array.from(new Set([...roleIds, ...unmanageableRoles]));

  await member.roles.set(finalRoleIds, "Updated via GuildPilot Dashboard");

  return formatMember(member, guild.ownerId);
}

export async function addRoleToMember(guildId: string, memberId: string, roleId: string) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const member = await guild.members.fetch(memberId);
  if (!member) throw new Error("Member not found.");

  await member.roles.add(roleId, "Added via GuildPilot Dashboard");
  return formatMember(member, guild.ownerId);
}

export async function removeRoleFromMember(guildId: string, memberId: string, roleId: string) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const member = await guild.members.fetch(memberId);
  if (!member) throw new Error("Member not found.");

  await member.roles.remove(roleId, "Removed via GuildPilot Dashboard");
  return formatMember(member, guild.ownerId);
}

export async function timeoutMember(
  guildId: string,
  memberId: string,
  durationMinutes: number,
  reason?: string
) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const member = await guild.members.fetch(memberId);
  if (!member) throw new Error("Member not found.");

  if (durationMinutes <= 0) {
    await member.timeout(null, reason || "Timeout removed via GuildPilot Dashboard");
  } else {
    const ms = durationMinutes * 60 * 1000;
    await member.timeout(ms, reason || "Timed out via GuildPilot Dashboard");
  }

  return formatMember(member, guild.ownerId);
}

export async function kickMember(guildId: string, memberId: string, reason?: string) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const member = await guild.members.fetch(memberId);
  if (!member) throw new Error("Member not found.");

  await member.kick(reason || "Kicked via GuildPilot Dashboard");
  return { success: true, memberId };
}

export async function banMember(
  guildId: string,
  memberId: string,
  deleteMessageSeconds: number = 0,
  reason?: string
) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  await guild.members.ban(memberId, {
    deleteMessageSeconds: deleteMessageSeconds,
    reason: reason || "Banned via GuildPilot Dashboard",
  });

  return { success: true, memberId };
}

export async function unbanMember(guildId: string, userId: string, reason?: string) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  await guild.members.unban(userId, reason || "Unbanned via GuildPilot Dashboard");
  return { success: true, userId };
}

export async function getGuildBans(guildId: string) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const bans = await guild.bans.fetch();
  return Array.from(bans.values()).map((b) => ({
    user: {
      id: b.user.id,
      username: b.user.username,
      discriminator: b.user.discriminator,
      globalName: b.user.globalName,
      avatar: b.user.displayAvatarURL({ size: 128 }),
      bot: b.user.bot,
    },
    reason: b.reason || "Kein Grund angegeben",
  }));
}

export async function sendMemberDM(guildId: string, memberId: string, message: string) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const member = await guild.members.fetch(memberId);
  if (!member) throw new Error("Member not found.");

  await member.send({ content: message });
  return { success: true, memberId };
}

export async function manageMemberVoice(
  guildId: string,
  memberId: string,
  action: "disconnect" | "mute" | "unmute" | "deaf" | "undeaf" | "move",
  targetChannelId?: string
) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const member = await guild.members.fetch(memberId);
  if (!member) throw new Error("Member not found.");
  if (!member.voice.channel) throw new Error("Nutzer ist in keinem Sprachkanal.");

  if (action === "disconnect") {
    await member.voice.disconnect("Disconnected via GuildPilot Dashboard");
  } else if (action === "mute") {
    await member.voice.setMute(true, "Muted via GuildPilot Dashboard");
  } else if (action === "unmute") {
    await member.voice.setMute(false, "Unmuted via GuildPilot Dashboard");
  } else if (action === "deaf") {
    await member.voice.setDeaf(true, "Deafened via GuildPilot Dashboard");
  } else if (action === "undeaf") {
    await member.voice.setDeaf(false, "Undeafened via GuildPilot Dashboard");
  } else if (action === "move" && targetChannelId) {
    await member.voice.setChannel(targetChannelId, "Moved via GuildPilot Dashboard");
  }

  return formatMember(member, guild.ownerId);
}

export async function executeBulkMemberAction(
  guildId: string,
  data: {
    memberIds: string[];
    action: "addRole" | "removeRole" | "timeout" | "removeTimeout" | "kick";
    roleId?: string;
    durationMinutes?: number;
    reason?: string;
  }
) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const results = {
    total: data.memberIds.length,
    successful: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const memberId of data.memberIds) {
    try {
      const member = await guild.members.fetch(memberId).catch(() => null);
      if (!member) {
        results.failed++;
        results.errors.push(`Member ${memberId} nicht gefunden.`);
        continue;
      }

      if (data.action === "addRole" && data.roleId) {
        await member.roles.add(data.roleId, data.reason || "Bulk action via Dashboard");
      } else if (data.action === "removeRole" && data.roleId) {
        await member.roles.remove(data.roleId, data.reason || "Bulk action via Dashboard");
      } else if (data.action === "timeout" && data.durationMinutes) {
        await member.timeout(data.durationMinutes * 60 * 1000, data.reason || "Bulk timeout via Dashboard");
      } else if (data.action === "removeTimeout") {
        await member.timeout(null, data.reason || "Bulk timeout removed via Dashboard");
      } else if (data.action === "kick") {
        await member.kick(data.reason || "Bulk kick via Dashboard");
      }
      results.successful++;
    } catch (err: any) {
      results.failed++;
      results.errors.push(`Fehler bei ${memberId}: ${err.message}`);
    }
  }

  return results;
}
