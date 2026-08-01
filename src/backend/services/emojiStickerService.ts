import { discordClient, isBotReady } from "../bot/client";

export async function getGuildEmojis(guildId: string) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const emojis = await guild.emojis.fetch();
  return emojis.map((e) => ({
    id: e.id,
    name: e.name,
    url: e.url,
    animated: e.animated,
    managed: e.managed,
    requiresColons: e.requiresColons,
  }));
}

export async function createEmoji(guildId: string, name: string, image: string) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const emoji = await guild.emojis.create({ attachment: image, name });
  return {
    id: emoji.id,
    name: emoji.name,
    url: emoji.url,
    animated: emoji.animated,
  };
}

export async function updateEmoji(guildId: string, emojiId: string, name: string) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const emoji = guild.emojis.cache.get(emojiId);
  if (!emoji) throw new Error("Emoji not found.");

  const updated = await emoji.edit({ name });
  return {
    id: updated.id,
    name: updated.name,
    url: updated.url,
  };
}

export async function deleteEmoji(guildId: string, emojiId: string) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const emoji = guild.emojis.cache.get(emojiId);
  if (!emoji) throw new Error("Emoji not found.");

  await emoji.delete();
  return { success: true, emojiId };
}

export async function getGuildStickers(guildId: string) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const stickers = await guild.stickers.fetch();
  return stickers.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    tags: s.tags,
    url: s.url,
  }));
}

export async function createSticker(guildId: string, name: string, description: string, tags: string, file: string) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const sticker = await guild.stickers.create({
    file,
    name,
    description,
    tags,
  });

  return {
    id: sticker.id,
    name: sticker.name,
    description: sticker.description,
    tags: sticker.tags,
    url: sticker.url,
  };
}

export async function deleteSticker(guildId: string, stickerId: string) {
  if (!isBotReady()) throw new Error("Discord Bot is not connected.");
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) throw new Error("Guild not found.");

  const sticker = guild.stickers.cache.get(stickerId);
  if (!sticker) throw new Error("Sticker not found.");

  await sticker.delete();
  return { success: true, stickerId };
}
