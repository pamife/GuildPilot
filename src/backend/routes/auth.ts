import { Router } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest, requireOwnerAuth } from "../middleware/authMiddleware";

const router = Router();

const getFrontendUrl = (req: any): string => {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
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

  if (!clientId || clientId === "your_client_id_here") {
    return res.redirect(`${getFrontendUrl(req)}?auth_warning=missing_discord_credentials`);
  }

  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
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
    const allowedUserId = process.env.ALLOWED_USER_ID;
    const jwtSecret = process.env.JWT_SECRET || "guildpilot_super_secret_local_key_change_me";

    // 1. Exchange code for access token
    const params = new URLSearchParams({
      client_id: clientId || "",
      client_secret: clientSecret || "",
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    });

    const tokenResponse = await axios.post("https://discord.com/api/oauth2/token", params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const accessToken = tokenResponse.data.access_token;

    // 2. Fetch User Profile
    const userResponse = await axios.get("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const user = userResponse.data;

    // 3. Verify single user owner ID constraint
    if (allowedUserId && allowedUserId !== "your_discord_user_id_here" && user.id !== allowedUserId) {
      return res.redirect(`${frontendUrl}?error=unauthorized_user`);
    }

    // 4. Issue JWT Cookie
    const payload = {
      id: user.id,
      username: `${user.username}${user.discriminator && user.discriminator !== '0' ? `#${user.discriminator}` : ''}`,
      avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null,
    };

    const token = jwt.sign(payload, jwtSecret, { expiresIn: "7d" });

    res.cookie("guildpilot_token", token, {
      httpOnly: true,
      secure: false, // Local dev
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(frontendUrl);
  } catch (error) {
    console.error("OAuth error:", error);
    res.redirect(`${frontendUrl}?error=oauth_failed`);
  }
});

router.get("/me", requireOwnerAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

router.post("/logout", (req, res) => {
  res.clearCookie("guildpilot_token");
  res.json({ success: true });
});

export default router;
