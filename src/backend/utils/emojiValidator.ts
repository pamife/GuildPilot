import { parseEmoji } from "discord.js";

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
 * Validates and converts emoji input into a valid Discord emoji object or Unicode string.
 * Rejects invalid plain text strings (e.g. "ping", "news") and unmapped markdown shortcodes.
 */
export function parseAndValidateEmoji(
  emojiInput?: string | null
): { name?: string; id?: string; animated?: boolean } | null {
  if (!emojiInput || typeof emojiInput !== "string") return null;
  let trimmed = emojiInput.trim();
  if (!trimmed) return null;

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

  // 4. Reject plain ASCII text or unmapped shortcodes (e.g. "ping", "news", ":unmapped:")
  const isPlainAscii = /^[:a-zA-Z0-9_\-\s]+$/.test(trimmed);
  if (isPlainAscii) {
    return null; // Return null so setEmoji is NOT called with invalid text or markdown
  }

  // 5. Try parseEmoji from discord.js
  try {
    const parsed = parseEmoji(trimmed);
    if (!parsed || !parsed.name) return null;

    if (parsed.id) {
      return { id: parsed.id, name: parsed.name, animated: Boolean(parsed.animated) };
    }

    const nameIsPlainAscii = /^[:a-zA-Z0-9_\-\s]+$/.test(parsed.name);
    if (nameIsPlainAscii) {
      return null;
    }

    return { name: parsed.name };
  } catch (e) {
    return null;
  }
}
