import { Guild, GuildMember, PermissionFlagsBits } from "discord.js";
import { desiredRewardIds, getLevelingConfig, getLevelingMember } from "../services/levelingService";
import { LevelReward } from "../../types/leveling";

const pending = new Map<string, Promise<void>>();

export async function validateRewardRoles(guild: Guild, roleIds: string[]) {
  if (!roleIds.length) return;
  const [bot, roles] = await Promise.all([guild.members.fetchMe({ force: true }), guild.roles.fetch()]);
  if (!bot.permissions.has(PermissionFlagsBits.ManageRoles)) throw new Error("The bot needs Manage Roles for level rewards.");
  for (const id of roleIds) {
    const role = roles.get(id);
    if (!role || role.id === guild.id || role.managed || bot.roles.highest.comparePositionTo(role) <= 0) {
      throw new Error(`Reward role ${role?.name ?? id} must exist and be assignable below the bot's highest role.`);
    }
  }
}

function rewardChanges(member: GuildMember, rewards: LevelReward[], level: number, highestOnly: boolean) {
  const desired = desiredRewardIds(rewards, level, highestOnly);
  const configured = [...new Set(rewards.map(({ roleId }) => roleId))];
  return {
    add: [...desired].filter((roleId) => !member.roles.cache.has(roleId)),
    remove: configured.filter((roleId) => member.roles.cache.has(roleId) && !desired.has(roleId)),
  };
}

export function needsRewardSync(member: GuildMember, rewards: LevelReward[], level: number, highestOnly: boolean) {
  const { add, remove } = rewardChanges(member, rewards, level, highestOnly);
  return add.length > 0 || remove.length > 0;
}

export function syncLevelRewards(member: GuildMember) {
  const { guild, id } = member;
  const key = `${guild.id}:${id}`;
  const operation = (pending.get(key) ?? Promise.resolve()).catch(() => {}).then(async () => {
    const [settings, progress] = await Promise.all([getLevelingConfig(guild.id), getLevelingMember(guild.id, id)]);
    if (!settings.rewards.length) return;
    const current = await guild.members.fetch({ user: id, force: true });
    const { add, remove } = rewardChanges(current, settings.rewards, progress?.level ?? 0, settings.highestOnly);
    await validateRewardRoles(guild, [...add, ...remove]);
    // Use single-role Discord endpoints to preserve unrelated concurrent role changes.
    for (const roleId of add) await current.roles.add(roleId, "Leveling reward");
    for (const roleId of remove) await current.roles.remove(roleId, "Leveling reward");
  });
  pending.set(key, operation);
  return operation.finally(() => {
    if (pending.get(key) === operation) pending.delete(key);
  });
}
