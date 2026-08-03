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
app.use("/api/templates", templateRoutes);
app.use("/api/utilities", utilityRoutes);

// Root route: Redirect to Next.js Frontend Dashboard
app.get("/", (req, res) => {
  const host = req.headers.host ? req.headers.host.split(":")[0] : "localhost";
  res.redirect(`http://${host}:3000`);
});

// Base Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", name: "GuildPilot Backend", timestamp: new Date() });
});

// Initialize Socket.IO
initSocketIO(server);

// Start Server and Discord Client
server.listen(Number(PORT), "0.0.0.0", async () => {
  console.log(`[GuildPilot Backend] Running on http://0.0.0.0:${PORT}`);
  await initDiscordBot();
});
