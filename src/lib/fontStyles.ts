// Utility helper for Discord Aesthetic Font Transformers & Symbol Generators

const CHAR_MAPS: Record<string, [string, string]> = {
  boldSans: [
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    "𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵",
  ],
  smallCaps: [
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "ᴀʙᴄᴅᴇғɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢABCDEFGHIJKLMNOPQRSTUVWXYZ",
  ],
  serifItalic: [
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "𝑎𝑏𝑐𝑑𝑒𝑓𝑔ℎ𝑖𝑗𝑘𝑙𝑚𝑛𝑜𝑝𝑞𝑟𝑠𝑡𝑢𝑣𝑤𝑥𝑦𝑧𝐴𝐵𝐶𝐷𝐸𝐹𝐺𝐻𝐼𝐽𝐾𝐿𝑀𝑁𝑂𝑃𝑄𝑅𝑆𝑇𝑈𝑉𝑊𝑋𝑌𝑍",
  ],
  monospace: [
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    "𝚐𝚎𝚗𝚎𝚛𝚊𝚕𝚌𝚑𝚊𝚝ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  ],
  circled: [
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ",
  ],
};

export function transformFont(text: string, style: "normal" | "boldSans" | "smallCaps" | "serifItalic" | "circled"): string {
  if (style === "normal" || !CHAR_MAPS[style]) return text;

  const [from, to] = CHAR_MAPS[style];
  let result = "";

  for (const char of text) {
    const idx = Array.from(from).indexOf(char);
    if (idx !== -1) {
      result += Array.from(to)[idx];
    } else {
      result += char;
    }
  }

  return result;
}

export const DISCORD_SYMBOL_PRESETS = [
  { label: "Chat", prefix: "💬・", symbol: "💬" },
  { label: "Notice", prefix: "📢・", symbol: "📢" },
  { label: "Rules", prefix: "📌・", symbol: "📌" },
  { label: "Thick Line", prefix: "┃・", symbol: "┃" },
  { label: "Thin Line", prefix: "┆ ", symbol: "┆" },
  { label: "Spiral", prefix: "🌀・", symbol: "🌀" },
  { label: "Blossom", prefix: "🌸・", symbol: "🌸" },
  { label: "Sparkles", prefix: "✨・", symbol: "✨" },
  { label: "Gaming", prefix: "🎮・", symbol: "🎮" },
  { label: "Music", prefix: "🎵・", symbol: "🎵" },
  { label: "Bot", prefix: "🤖・", symbol: "🤖" },
  { label: "Category", prefix: "📁・", symbol: "📁" },
];

export const FONT_STYLE_PRESETS = [
  { id: "normal", name: "Normal", sample: "general-chat" },
  { id: "boldSans", name: "Bold Sans", sample: "𝗴𝗲𝗻𝗲𝗿𝗮𝗹-𝗰𝗵𝗮𝘁" },
  { id: "smallCaps", name: "Small Caps", sample: "ɢᴇɴᴇʀᴀʟ-ᴄʜᴀᴛ" },
  { id: "serifItalic", name: "Italic", sample: "𝑔𝑒𝑛𝑒𝑟𝑎𝑙-𝑐ℎ𝑎𝑡" },
  { id: "circled", name: "Circled", sample: "ⓖⓔⓝⓔⓡⓐⓛ-ⓒⓗⓐⓣ" },
];
