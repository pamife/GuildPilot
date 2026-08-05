import { parseEmoji } from "discord.js";

const ALLOWED_UNICODE_EMOJIS = [
  "📢", "🔄", "👀", "🌐", "🎉", "🎁", "🔔", "⭐️", "📩", "🛠️",
  "📜", "⬆️", "✅", "❌", "⚙️", "🔗", "🛡️", "🎫", "📝", "📋",
  "📌", "🔒", "🔓", "➕", "➖", "🗑️", "📄", "✨", "🚀", "💡",
  "❤️", "🔥", "👍", "🎮", "💬", "🏆", "💎"
];

const EMOJI_SHORTCODES: Record<string, string> = {
  ":envelope:": "📩",
  "envelope": "📩",
  ":news:": "📢",
  "news": "📢",
  ":tools:": "🛠️",
  "tools": "🛠️",
  ":updates:": "🔄",
  "updates": "🔄",
  ":eyes:": "👀",
  "eyes": "👀",
  ":leaks:": "👀",
  "leaks": "👀",
  ":scroll:": "📜",
  "scroll": "📜",
  ":polls:": "📜",
  "polls": "📜",
  ":star:": "⭐️",
  "star": "⭐️",
  ":events:": "🎉",
  "events": "🎉",
  ":gift:": "🎁",
  "gift": "🎁",
  ":giveaways:": "🎁",
  "giveaways": "🎁",
  ":bell:": "🔔",
  "bell": "🔔",
  ":ping:": "🔔",
  "ping": "🔔",
  ":pings:": "🔔",
  "pings": "🔔",
  ":announcement:": "📢",
  ":announcements:": "📢",
  "announcement": "📢",
  "announcements": "📢",
  ":party:": "🎉",
  "party": "🎉",
  ":world:": "🌐",
  "world": "🌐",
  ":social:": "🌐",
  "social": "🌐",
  ":refresh:": "🔄",
  "refresh": "🔄",
  ":reload:": "🔄",
  "reload": "🔄",
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
 * Strictly returns ONLY a valid single Unicode emoji (e.g. "🌐", "🎉", "🎁") or valid custom emoji ID.
 * Returns null if the emoji is invalid, string name, or unparseable text.
 */
export function parseAndValidateEmoji(
  emojiInput?: string | null
): { name?: string; id?: string; animated?: boolean } | null {
  if (!emojiInput || typeof emojiInput !== "string") {
    return null;
  }
  let trimmed = emojiInput.trim();
  if (!trimmed) {
    return null;
  }

  // 1. Custom Emoji check: <:name:123456789012345678> or <a:name:123456789012345678>
  const customMatch = /^<a?:([a-zA-Z0-9_]+):(\d{17,20})>$/.exec(trimmed);
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

  // 3. Shortcode / keyword lookup (e.g. :giveaways: -> 🎁, giveaways -> 🎁, :events: -> 🎉, social -> 🌐)
  const lower = trimmed.toLowerCase();
  if (EMOJI_SHORTCODES[lower]) {
    return { name: EMOJI_SHORTCODES[lower] };
  }

  // 4. Try matching single Unicode emoji character inside the input string
  const unicodeMatch = trimmed.match(/\p{Extended_Pictographic}/u);
  if (unicodeMatch && unicodeMatch[0]) {
    return { name: unicodeMatch[0] };
  }

  // 5. Check if trimmed string is in ALLOWED_UNICODE_EMOJIS list
  if (ALLOWED_UNICODE_EMOJIS.includes(trimmed)) {
    return { name: trimmed };
  }

  // Fallback: If invalid text string or unmapped text, return null so setEmoji() is NOT called
  return null;
}
