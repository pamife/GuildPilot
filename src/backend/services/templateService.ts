import { ChannelType, GuildChannel, TextChannel, ForumChannel, GuildChannelTypes } from "discord.js";
import { PrismaClient } from "@prisma/client";
import { discordClient, isBotReady } from "../bot/client";
import { getGuildChannels } from "./channelService";
import { getGuildRoles } from "./roleService";

const prisma = new PrismaClient();

export async function saveServerTemplate(guildId: string, name: string, description?: string) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const channels = await getGuildChannels(guildId);
  const roles = await getGuildRoles(guildId);

  const structure = {
    guildName: guild.name,
    categories: channels.filter((c) => c.type === ChannelType.GuildCategory),
    textChannels: channels.filter((c) => c.type === ChannelType.GuildText),
    voiceChannels: channels.filter((c) => c.type === ChannelType.GuildVoice),
    forumChannels: channels.filter((c) => c.type === ChannelType.GuildForum),
    roles: roles.filter((r) => !r.managed && r.name !== "@everyone"),
  };

  const template = await prisma.template.create({
    data: {
      name,
      description: description || `Template saved from ${guild.name}`,
      guildId,
      structure: JSON.stringify(structure),
    },
  });

  return template;
}

export async function getTemplates() {
  const templates = await prisma.template.findMany({
    orderBy: { createdAt: "desc" },
  });
  return templates.map((t) => ({
    ...t,
    structure: JSON.parse(t.structure),
  }));
}

export async function deleteTemplate(templateId: string) {
  await prisma.template.delete({ where: { id: templateId } });
  return { success: true, id: templateId };
}

export async function applyTemplate(guildId: string, templateId: string) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template) throw new Error("Template not found.");

  const structure = JSON.parse(template.structure);

  // 1. Create Roles
  const createdRolesMap = new Map<string, string>();
  if (structure.roles && Array.isArray(structure.roles)) {
    for (const r of structure.roles) {
      try {
        const newRole = await guild.roles.create({
          name: r.name,
          color: r.color,
          hoist: r.hoist,
          mentionable: r.mentionable,
          permissions: r.permissions ? BigInt(r.permissions) : undefined,
        });
        createdRolesMap.set(r.id, newRole.id);
      } catch (err) {
        console.error(`Failed to recreate role ${r.name}`, err);
      }
    }
  }

  // 2. Create Categories & Map IDs
  const categoryMap = new Map<string, string>();
  if (structure.categories && Array.isArray(structure.categories)) {
    for (const cat of structure.categories) {
      try {
        const newCat = await guild.channels.create({
          name: cat.name,
          type: ChannelType.GuildCategory,
        });
        categoryMap.set(cat.id, newCat.id);
      } catch (err) {
        console.error(`Failed to recreate category ${cat.name}`, err);
      }
    }
  }

  // 3. Create Text, Voice & Forum channels
  const allChannelsToCreate = [
    ...(structure.textChannels || []),
    ...(structure.voiceChannels || []),
    ...(structure.forumChannels || []),
  ];

  for (const ch of allChannelsToCreate) {
    try {
      const parentId = ch.parentId ? categoryMap.get(ch.parentId) : undefined;
      await guild.channels.create({
        name: ch.name,
        type: ch.type as GuildChannelTypes,
        parent: parentId,
        topic: ch.topic || undefined,
        nsfw: ch.nsfw || false,
        rateLimitPerUser: ch.slowmode || 0,
      });
    } catch (err) {
      console.error(`Failed to recreate channel ${ch.name}`, err);
    }
  }

  return { success: true, guildId, templateName: template.name };
}

export async function duplicateChannel(guildId: string, channelId: string) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const channel = guild.channels.cache.get(channelId);
  if (!channel) throw new Error("Channel not found.");

  const isText = channel.type === ChannelType.GuildText;
  const isForum = channel.type === ChannelType.GuildForum;

  const duplicated = await guild.channels.create({
    name: `${channel.name}-copy`,
    type: channel.type as GuildChannelTypes,
    parent: channel.parentId || undefined,
    topic: isText || isForum ? (channel as TextChannel | ForumChannel).topic || undefined : undefined,
    nsfw: isText || isForum ? (channel as TextChannel | ForumChannel).nsfw : undefined,
    rateLimitPerUser: isText || isForum ? (channel as TextChannel | ForumChannel).rateLimitPerUser || undefined : undefined,
  });

  return {
    id: duplicated.id,
    name: duplicated.name,
    type: duplicated.type,
  };
}

export async function duplicateCategory(guildId: string, categoryId: string) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const category = guild.channels.cache.get(categoryId);
  if (!category || category.type !== ChannelType.GuildCategory) throw new Error("Category not found.");

  const newCategory = await guild.channels.create({
    name: `${category.name} Copy`,
    type: ChannelType.GuildCategory,
  });

  // Duplicate child channels inside this category
  const children = guild.channels.cache.filter((c) => c.parentId === categoryId);
  for (const [, child] of children) {
    const isText = child.type === ChannelType.GuildText;
    const isForum = child.type === ChannelType.GuildForum;

    await guild.channels.create({
      name: child.name,
      type: child.type as GuildChannelTypes,
      parent: newCategory.id,
      topic: isText || isForum ? (child as TextChannel | ForumChannel).topic || undefined : undefined,
      nsfw: isText || isForum ? (child as TextChannel | ForumChannel).nsfw : undefined,
      rateLimitPerUser: isText || isForum ? (child as TextChannel | ForumChannel).rateLimitPerUser || undefined : undefined,
    });
  }

  return {
    id: newCategory.id,
    name: newCategory.name,
  };
}
