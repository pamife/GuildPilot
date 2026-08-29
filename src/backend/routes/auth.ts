import { Router } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import {
  AuthenticatedRequest,
  requireAuth,
  isOwner,
  getJwtSecret,
  OWNER_DISCORD_ID,
} from "../middleware/authMiddleware";

const router = Router();
const prisma = new PrismaClient();

const getFrontendUrl = (req: any): string => {
  const queryReturnTo = req.query?.return_to as string;
  if (queryReturnTo && (queryReturnTo.startsWith("http://") || queryReturnTo.startsWith("https://"))) {
    return queryReturnTo.replace(/\/$/, "");
  }
  const cookieReturnTo = req.cookies?.oauth_return_to;
  if (cookieReturnTo && (cookieReturnTo.startsWith("http://") || cookieReturnTo.startsWith("https://"))) {
    return cookieReturnTo.replace(/\/$/, "");
  }
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/$/, "");
  if (req.headers?.referer) {
    try {
      const parsed = new URL(req.headers.referer);
      return parsed.origin;
    } catch {}
  }
  const host = req.headers.host ? req.headers.host.split(":")[0] : "localhost";
  const protocol = req.headers["x-forwarded-proto"] || "http";
  return `${protocol}://${host}:3000`;
};

const getRedirectUri = (req: any): string => {
  if (process.env.DISCORD_REDIRECT_URI) return process.env.DISCORD_REDIRECT_URI;
  const host = req.headers.host || "localhost:3001";
  const protocol = req.headers["x-forwarded-proto"] || "http";
  return `${protocol}://${host}/api/auth/callback`;
};

router.get("/login", (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = encodeURIComponent(getRedirectUri(req));
  const scope = encodeURIComponent("identify guilds");
  const returnTo = (req.query.return_to as string) || getFrontendUrl(req);

  // Return-To URL für Callback in sicherem temporären Cookie speichern
  if (returnTo) {
    res.cookie("oauth_return_to", returnTo, {
      maxAge: 10 * 60 * 1000,
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    });
  }

  if (!clientId || clientId === "your_client_id_here") {
    return res.redirect(`${returnTo}?auth_warning=missing_discord_credentials`);
  }

  const state = encodeURIComponent(Buffer.from(JSON.stringify({ returnTo })).toString("base64"));
  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}&prompt=consent`;
  res.redirect(url);
});


router.get("/callback", async (req, res) => {
  const { code } = req.query;
  const frontendUrl = getFrontendUrl(req);

  if (!code || typeof code !== "string") {
    return res.redirect(`${frontendUrl}?error=no_code`);
  }

  try {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const redirectUri = getRedirectUri(req);
    const jwtSecret = getJwtSecret();

    // 1. Code gegen Discord-Access-Token eintauschen
    const params = new URLSearchParams({
      client_id: clientId || "",
      client_secret: clientSecret || "",
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    });

    const tokenResponse = await axios.post("https://discord.com/api/oauth2/token", params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 10000,
    });

    const accessToken = tokenResponse.data.access_token;
    const refreshToken = tokenResponse.data.refresh_token || null;

    // 2. Discord-Profil des Benutzers laden
    const userResponse = await axios.get("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10000,
    });

    const discordUser = userResponse.data;
    const isUserOwner = isOwner(discordUser.id);
    const role = isUserOwner ? "OWNER" : "USER";

    const formattedUsername = `${discordUser.username}${
      discordUser.discriminator && discordUser.discriminator !== "0"
        ? `#${discordUser.discriminator}`
        : ""
    }`;
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : null;

    // 3. Benutzer in der Datenbank speichern / aktualisieren
    try {
      await prisma.user.upsert({
        where: { discordId: discordUser.id },
        create: {
          discordId: discordUser.id,
          username: formattedUsername,
          discriminator: discordUser.discriminator || "0",
          avatar: avatarUrl,
          role,
          accessToken,
          refreshToken,
          lastLoginAt: new Date(),
        },
        update: {
          username: formattedUsername,
          discriminator: discordUser.discriminator || "0",
          avatar: avatarUrl,
          role,
          accessToken,
          refreshToken,
          lastLoginAt: new Date(),
        },
      });
    } catch (dbErr) {
      console.warn("[Auth] User DB sync non-fatal error:", dbErr);
    }

    // 4. JWT Token ausstellen
    const payload = {
      id: discordUser.id,
      username: formattedUsername,
      avatar: avatarUrl,
      role,
    };

    const token = jwt.sign(payload, jwtSecret, { expiresIn: "7d" });

    // Target Frontend URL aus State oder Cookie ermitteln
    let targetFrontend = frontendUrl;
    if (req.query.state && typeof req.query.state === "string") {
      try {
        const decodedState = JSON.parse(Buffer.from(decodeURIComponent(req.query.state), "base64").toString("utf-8"));
        if (decodedState?.returnTo && (decodedState.returnTo.startsWith("http://") || decodedState.returnTo.startsWith("https://"))) {
          targetFrontend = decodedState.returnTo.replace(/\/$/, "");
        }
      } catch (e) {}
    }
    if (req.cookies?.oauth_return_to && (req.cookies.oauth_return_to.startsWith("http://") || req.cookies.oauth_return_to.startsWith("https://"))) {
      targetFrontend = req.cookies.oauth_return_to.replace(/\/$/, "");
    }
    res.clearCookie("oauth_return_to", { path: "/" });

    const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";

    res.cookie("guildpilot_token", token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    // Weiterleitung zum Frontend (mit Token als Query-Param zur Ausfallsicherheit für Netlify)
    res.redirect(`${targetFrontend}?auth=success&token=${encodeURIComponent(token)}`);
  } catch (error: any) {
    console.error("[OAuth] Callback error:", error.response?.data || error.message);
    res.redirect(`${frontendUrl}?error=oauth_failed`);
  }
});


router.get("/me", requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({
    user: req.user,
    isOwner: req.user?.role === "OWNER" || isOwner(req.user?.id),
  });
});

router.post("/logout", (req, res) => {
  res.clearCookie("guildpilot_token", { path: "/" });
  res.json({ success: true });
});

export default router;

