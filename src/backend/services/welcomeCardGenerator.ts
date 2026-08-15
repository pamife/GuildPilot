import { createCanvas, loadImage } from "@napi-rs/canvas";
import axios from "axios";

export interface CardOptions {
  avatarUrl?: string | null;
  username: string;
  memberCount?: number;
  serverName?: string;
  title?: string;
  subtitle?: string;
  avatarRingColor?: string;
  cardBgColor?: string;
  cardBorderColor?: string;
  cardBgImage?: string | null;
  mode?: "welcome" | "leave";
}

// Helper to round rectangle
function roundRect(
  ctx: any,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Generates a high-definition Discord Welcome / Goodbye card image matching the modern Discord aesthetic.
 */
export async function generateGreetingCard(options: CardOptions): Promise<Buffer> {
  const width = 720;
  const height = 280;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const ringColor = options.avatarRingColor || (options.mode === "leave" ? "#f43f5e" : "#00e5ff");
  const bgColor = options.cardBgColor || "#1e1f22";
  const borderColor = options.cardBorderColor || "#2b2d31";

  // 1. Draw Card Background with Rounded Corners
  const padding = 12;
  const cardX = padding;
  const cardY = padding;
  const cardW = width - padding * 2;
  const cardH = height - padding * 2;
  const cardRadius = 18;

  // Background Outer Fill
  ctx.fillStyle = "#111214";
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.clip();

  // Draw Card Inner Background
  if (options.cardBgImage && options.cardBgImage.trim() !== "") {
    try {
      const bgImg = await loadImage(options.cardBgImage);
      ctx.drawImage(bgImg, cardX, cardY, cardW, cardH);
      // Dark Overlay for readability
      ctx.fillStyle = "rgba(17, 18, 20, 0.75)";
      ctx.fillRect(cardX, cardY, cardW, cardH);
    } catch {
      ctx.fillStyle = bgColor;
      ctx.fillRect(cardX, cardY, cardW, cardH);
    }
  } else {
    // Subtle gradient background
    const bgGradient = ctx.createLinearGradient(0, cardY, 0, cardY + cardH);
    bgGradient.addColorStop(0, bgColor);
    bgGradient.addColorStop(1, "#18191c");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(cardX, cardY, cardW, cardH);
  }

  // Subtle ambient radial glow behind avatar
  const avatarCenterX = width / 2;
  const avatarCenterY = 95;
  const radialGlow = ctx.createRadialGradient(
    avatarCenterX,
    avatarCenterY,
    10,
    avatarCenterX,
    avatarCenterY,
    130
  );
  radialGlow.addColorStop(0, `${ringColor}22`);
  radialGlow.addColorStop(1, "transparent");
  ctx.fillStyle = radialGlow;
  ctx.fillRect(cardX, cardY, cardW, cardH);

  ctx.restore();

  // Draw Card Outline Stroke
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // 2. Render Avatar
  const avatarRadius = 52;
  let avatarLoaded = false;

  if (options.avatarUrl && options.avatarUrl.trim() !== "") {
    try {
      let avatarFetchUrl = options.avatarUrl;
      if (avatarFetchUrl.includes("cdn.discordapp.com")) {
        avatarFetchUrl = avatarFetchUrl.replace(/\.(webp|gif)/g, ".png");
        if (!avatarFetchUrl.includes("size=")) {
          avatarFetchUrl += (avatarFetchUrl.includes("?") ? "&" : "?") + "size=256";
        }
      }

      const imgBuffer = await axios
        .get(avatarFetchUrl, { responseType: "arraybuffer", timeout: 4000 })
        .then((res) => res.data);

      const avatarImg = await loadImage(imgBuffer);

      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(
        avatarImg,
        avatarCenterX - avatarRadius,
        avatarCenterY - avatarRadius,
        avatarRadius * 2,
        avatarRadius * 2
      );
      ctx.restore();
      avatarLoaded = true;
    } catch (err) {
      avatarLoaded = false;
    }
  }

  if (!avatarLoaded) {
    // Sleek Fallback Avatar with user initial
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fillStyle = "#5865F2";
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 42px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const initial = (options.username || "?").charAt(0).toUpperCase();
    ctx.fillText(initial, avatarCenterX, avatarCenterY);
    ctx.restore();
  }

  // 3. Render Avatar Glow & Glowing Ring Border
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + 3, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 4;
  ctx.shadowColor = ringColor;
  ctx.shadowBlur = 14;
  ctx.stroke();
  ctx.restore();

  // 4. Render Title ("Welcome @megaloblatt" or custom title)
  const titleText =
    options.title ||
    (options.mode === "leave"
      ? `Goodbye @${options.username}`
      : `Welcome @${options.username}`);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  let titleFontSize = 26;
  ctx.font = `bold ${titleFontSize}px sans-serif`;
  let titleWidth = ctx.measureText(titleText).width;
  const maxTextWidth = cardW - 60;

  while (titleWidth > maxTextWidth && titleFontSize > 16) {
    titleFontSize -= 1;
    ctx.font = `bold ${titleFontSize}px sans-serif`;
    titleWidth = ctx.measureText(titleText).width;
  }

  ctx.fillStyle = "#FFFFFF";
  ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillText(titleText, avatarCenterX, 202);
  ctx.restore();

  // 5. Render Subtitle ("Member #298" or custom subtitle)
  let subtitleText = options.subtitle;
  if (!subtitleText) {
    if (options.mode === "leave") {
      subtitleText = options.serverName
        ? `Left ${options.serverName}`
        : `${options.memberCount ? `${options.memberCount} members remain` : "Goodbye"}`;
    } else {
      subtitleText = options.memberCount ? `Member #${options.memberCount}` : `Welcome to the server!`;
    }
  }

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  let subFontSize = 16;
  ctx.font = `500 ${subFontSize}px sans-serif`;

  let subWidth = ctx.measureText(subtitleText).width;
  while (subWidth > maxTextWidth && subFontSize > 12) {
    subFontSize -= 1;
    ctx.font = `500 ${subFontSize}px sans-serif`;
    subWidth = ctx.measureText(subtitleText).width;
  }

  ctx.fillStyle = "#949BA4";
  ctx.fillText(subtitleText, avatarCenterX, 234);
  ctx.restore();

  return canvas.toBuffer("image/png");
}
