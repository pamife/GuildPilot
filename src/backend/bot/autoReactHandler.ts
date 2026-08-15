import { Client, Message } from "discord.js";
import { getAutoReacts } from "../services/autoReactService";

/**
 * Extracts reaction-compatible identifier from custom or unicode emoji
 */
function parseEmojiIdentifier(emojiStr: string): string {
  if (!emojiStr) return "";
  const trimmed = emojiStr.trim();

  // Custom Discord emoji format: <:name:id> or <a:name:id>
  const match = trimmed.match(/<a?:[a-zA-Z0-9_]+:(\d+)>/);
  if (match) {
    return match[1]; // Return ID for custom emoji
  }

  // Name:ID format: name:123456789
  const nameIdMatch = trimmed.match(/^[a-zA-Z0-9_]+:(\d+)$/);
  if (nameIdMatch) {
    return nameIdMatch[1];
  }

  // If pure numeric ID
  if (/^\d{17,20}$/.test(trimmed)) {
    return trimmed;
  }

  // Unicode emoji e.g. 👍, 🔥
  return trimmed;
}

export function setupAutoReactInteractions(client: Client) {
  client.on("messageCreate", async (message: Message) => {
    try {
      if (!message.guild || !message.channel) return;
      if (message.author?.id === client.user?.id) return; // Don't react to own bot messages

      // Fetch all auto react rules for this guild
      const rules = await getAutoReacts(message.guild.id);
      if (!rules || rules.length === 0) return;

      const activeRules = rules.filter((r) => r.enabled);
      if (activeRules.length === 0) return;

      for (const rule of activeRules) {
        // Check ignoreBots
        if (rule.ignoreBots && message.author?.bot) {
          continue;
        }

        // Check channel matching
        let channelIds: string[] = [];
        try {
          channelIds = JSON.parse(rule.channelIds || "[]");
        } catch {
          channelIds = [];
        }

        // If specific channels configured, message must be in one of them
        if (channelIds.length > 0 && !channelIds.includes(message.channel.id)) {
          continue;
        }

        // Parse emojis
        let emojis: string[] = [];
        try {
          emojis = JSON.parse(rule.emojis || "[]");
        } catch {
          emojis = [];
        }

        if (!Array.isArray(emojis) || emojis.length === 0) continue;

        // Apply reactions sequentially
        for (const emojiItem of emojis) {
          if (!emojiItem) continue;
          const emojiId = parseEmojiIdentifier(emojiItem);
          if (!emojiId) continue;

          try {
            await message.react(emojiId);
          } catch (err: any) {
            console.warn(
              `[AutoReact] Failed to add reaction ${emojiItem} in #${message.channel.id}:`,
              err.message
            );
          }
        }
      }
    } catch (err: any) {
      console.error("[AutoReact] Error processing messageCreate:", err);
    }
  });
}
