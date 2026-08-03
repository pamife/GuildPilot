import { PermissionsBitField, Role } from "discord.js";
import { discordClient, isBotReady } from "../bot/client";

export async function getGuildRoles(guildId: string) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  let roles = guild.roles.cache;
  if (roles.size === 0) {
    roles = await guild.roles.fetch().catch(() => guild.roles.cache);
  }

  return roles
    .map((r) => ({
      id: r.id,
      name: r.name,
      color: r.hexColor,
      hoist: r.hoist,
      position: r.position,
      permissions: r.permissions.bitfield.toString(),
      managed: r.managed,
      mentionable: r.mentionable,
      icon: r.iconURL(),
      memberCount: r.name === "@everyone" ? guild.memberCount : r.members.size,
    }))
    .sort((a, b) => b.position - a.position);
}

export async function createRole(
  guildId: string,
  data: {
    name: string;
    color?: string;
    hoist?: boolean;
    mentionable?: boolean;
    permissions?: string;
  }
) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const newRole = await guild.roles.create({
    name: data.name,
    color: data.color as any,
    hoist: data.hoist,
    mentionable: data.mentionable,
    permissions: data.permissions ? BigInt(data.permissions) : undefined,
  });

  return {
    id: newRole.id,
    name: newRole.name,
    color: newRole.hexColor,
    position: newRole.position,
    permissions: newRole.permissions.bitfield.toString(),
    memberCount: 0,
  };
}

export async function updateRole(
  guildId: string,
  roleId: string,
  data: {
    name?: string;
    color?: string;
    hoist?: boolean;
    mentionable?: boolean;
    permissions?: string;
    position?: number;
  }
) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const role = guild.roles.cache.get(roleId);
  if (!role) throw new Error("Role not found.");

  const editPayload: any = {};
  if (data.name !== undefined) editPayload.name = data.name;
  if (data.color !== undefined) editPayload.color = data.color;
  if (data.hoist !== undefined) editPayload.hoist = data.hoist;
  if (data.mentionable !== undefined) editPayload.mentionable = data.mentionable;
  if (data.permissions !== undefined) editPayload.permissions = BigInt(data.permissions);
  if (data.position !== undefined) editPayload.position = data.position;

  const updated = await role.edit(editPayload);

  return {
    id: updated.id,
    name: updated.name,
    color: updated.hexColor,
    position: updated.position,
    permissions: updated.permissions.bitfield.toString(),
  };
}

export async function reorderRoles(guildId: string, rolePositions: Array<{ id: string; position: number }>) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  await guild.roles.setPositions(rolePositions.map((r) => ({ role: r.id, position: r.position })));
  return { success: true };
}

export async function deleteRole(guildId: string, roleId: string) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const role = guild.roles.cache.get(roleId);
  if (!role) throw new Error("Role not found.");

  await role.delete();
  return { success: true, roleId };
}
