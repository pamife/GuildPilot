import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import { initSocketIO } from "./socket/socketManager";
import { initDiscordBot } from "./bot/client";

import authRoutes from "./routes/auth";
import guildRoutes from "./routes/guilds";
import channelRoutes from "./routes/channels";
import roleRoutes from "./routes/roles";
import emojiStickerRoutes from "./routes/emojisStickers";
import inviteRoutes from "./routes/invites";
import templateRoutes from "./routes/templates";
import utilityRoutes from "./routes/utilities";
import hostServerRoutes from "./routes/hostServer";
import ticketRoutes from "./routes/tickets";
import applicationRoutes from "./routes/applications";
import selfRoleRoutes from "./routes/selfRoles";
import customMessageRoutes from "./routes/customMessages";
import welcomeRoutes from "./routes/welcome";
import autoReactRoutes from "./routes/autoReact";
import serverCloneRoutes from "./routes/serverClone";
import memberRoutes from "./routes/members";
import backupRoutes from "./routes/backups";

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;

// CORS setup for web dashboard & Cloudflare Tunnel
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  process.env.NEXT_PUBLIC_API_URL,
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Allow origin for tunneled requests
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Mount API Routes
app.use("/api/auth", authRoutes);
app.use("/api/guilds", guildRoutes);
app.use("/api/guilds", channelRoutes);
app.use("/api/guilds", roleRoutes);
app.use("/api/guilds", emojiStickerRoutes);
app.use("/api/guilds", inviteRoutes);
app.use("/api/guilds", ticketRoutes);
app.use("/api/guilds", applicationRoutes);
app.use("/api/guilds", selfRoleRoutes);
app.use("/api/guilds", customMessageRoutes);
app.use("/api/guilds", welcomeRoutes);
app.use("/api/guilds", autoReactRoutes);
app.use("/api/guilds", serverCloneRoutes);
app.use("/api/guilds", memberRoutes);
app.use("/api/backups", backupRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/utilities", utilityRoutes);
app.use("/api/host-server", hostServerRoutes);

// Root route: Redirect to Next.js Frontend Dashboard
app.get("/", (req, res) => {
  const host = req.headers.host ? req.headers.host.split(":")[0] : "localhost";
  res.redirect(`http://${host}:3000`);
});

import { initHourlyRestartScheduler } from "./services/hourlyRestartService";

// Base Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", name: "GuildPilot Backend", timestamp: new Date() });
});

// Initialize Socket.IO
initSocketIO(server);

process.on("uncaughtException", (err) => {
  console.error("[GuildPilot Server] Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[GuildPilot Server] Unhandled Rejection at:", promise, "reason:", reason);
});

const HOST = process.env.HOST || "127.0.0.1";

// Security Startup Verification
function verifySecurityConfiguration() {
  const jwtSecret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  if (!jwtSecret || jwtSecret === "guildpilot_super_secret_local_key_change_me" || jwtSecret === "test") {
    if (isProd) {
      console.error(
        "\n=================================================================" +
        "\n[SECURITY CRITICAL ERROR] Production startup aborted!" +
        "\nJWT_SECRET must be set to a secure, long random string in .env." +
        "\n=================================================================\n"
      );
      process.exit(1);
    } else {
      console.warn(
        "[Security Warning] Using development/weak JWT_SECRET. Remember to set a strong secret for public deployment!"
      );
    }
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const token = process.env.DISCORD_TOKEN;
  if (!clientId || clientId === "your_client_id_here" || !token || token === "your_bot_token_here") {
    console.warn("[Configuration Warning] Discord Client ID or Bot Token is not properly set in .env.");
  }
}

// Start Server, Discord Client, and Hourly Restart Scheduler
server.listen(Number(PORT), HOST, async () => {
  verifySecurityConfiguration();
  console.log(`[GuildPilot Backend] Running securely on http://${HOST}:${PORT}`);
  initHourlyRestartScheduler();
  await initDiscordBot();
});

