import { parseEmoji } from "discord.js";

const ALLOWED_UNICODE_EMOJIS = [
  "📢", "🔄", "👀", "🌐", "🎉", "🎁", "🔔", "⭐️", "📩", "🛠️",
  "📜", "⬆️", "✅", "❌", "⚙️", "🔗", "🛡️", "🎫", "📝", "📋",
  "📌", "🔒", "🔓", "➕", "➖", "🗑️", "📄", "✨", "🚀", "💡",
  "❤️", "🔥", "👍", "🎮", "💬", "🏆", "💎"
];

const EMOJI_SHORTCODES: Record<string, string> = {
  ":envelope:": "📩",
  ":news:": "📩",
  ":tools:": "🛠️",
  ":updates:": "🛠️",
  ":eyes:": "👀",
  ":leaks:": "👀",
  ":scroll:": "📜",
  ":polls:": "📜",
  ":star:": "⭐️",
  ":events:": "⭐️",
  ":gift:": "🎁",
  ":giveaways:": "🎁",
  ":bell:": "🔔",
  ":ping:": "🔔",
  ":pings:": "🔔",
  ":announcement:": "📢",
  ":announcements:": "📢",
  ":party:": "🎉",
  ":world:": "🌐",
  ":refresh:": "🔄",
  ":reload:": "🔄",
  ":arrow_up:": "⬆️",
  ":up:": "⬆️",
  ":check:": "✅",
  ":x:": "❌",
  ":gear:": "⚙️",
  ":link:": "🔗",
  ":shield:": "🛡️",
  ":ticket:": "🎫",
  ":memo:": "📝",
  ":app:": "📝",
  ":form:": "📋",
  ":claim:": "📌",
  ":close:": "🔒",
  ":lock:": "🔒",
  ":unlock:": "🔓",
  ":plus:": "➕",
  ":minus:": "➖",
  ":trash:": "🗑️",
  ":file:": "📄",
};

/**
 * Validates and converts emoji input into a guaranteed valid Discord emoji object or Unicode emoji string.
 * Completely replaces any invalid text strings, markdown shortcodes, or unparsed values with a guaranteed valid Unicode emoji (e.g. "🔄" or "📢").
 */
export function parseAndValidateEmoji(
  emojiInput?: string | null
): { name?: string; id?: string; animated?: boolean } {
  if (!emojiInput || typeof emojiInput !== "string") {
    return { name: "📢" };
  }
  let trimmed = emojiInput.trim();
  if (!trimmed) {
    return { name: "📢" };
  }

  // 1. Custom Emoji check: <:name:123456789012345678> or <a:name:123456789012345678>
  const customMatch = /^<a?:([a-zA-Z0-9_]+):(\d+)>$/.exec(trimmed);
  if (customMatch) {
    return {
      name: customMatch[1],
      id: customMatch[2],
      animated: trimmed.startsWith("<a:"),
    };
  }

  // 2. Numeric ID check (17-20 digits)
  if (/^\d{17,20}$/.test(trimmed)) {
    return { id: trimmed };
  }

  // 3. Shortcode lookup (e.g. :ping: -> 🔔)
  const lower = trimmed.toLowerCase();
  if (EMOJI_SHORTCODES[lower]) {
    trimmed = EMOJI_SHORTCODES[lower];
  }

  // 4. Check if trimmed string is in guaranteed Unicode emoji list or Extended Pictographic regex
  if (ALLOWED_UNICODE_EMOJIS.includes(trimmed) || /\p{Extended_Pictographic}/u.test(trimmed)) {
    return { name: trimmed };
  }

  // 5. Try parseEmoji from discord.js
  try {
    const parsed = parseEmoji(trimmed);
    if (parsed && parsed.name) {
      if (parsed.id) {
        return { id: parsed.id, name: parsed.name, animated: Boolean(parsed.animated) };
      }
      const isPlainAscii = /^[:a-zA-Z0-9_\-\s]+$/.test(parsed.name);
      if (!isPlainAscii) {
        return { name: parsed.name };
      }
    }
  } catch (e) {}

  // Fallback: If invalid text string or unmapped markdown string, replace with guaranteed valid Unicode emoji
  return { name: "🔄" };
}
