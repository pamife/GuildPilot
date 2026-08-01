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

// CORS setup for local web dashboard
app.use(
  cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
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
  res.redirect("http://localhost:3000");
});

// Base Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", name: "GuildPilot Backend", timestamp: new Date() });
});

// Initialize Socket.IO
initSocketIO(server);

// Start Server and Discord Client
server.listen(PORT, async () => {
  console.log(`[GuildPilot Backend] Running on http://localhost:${PORT}`);
  await initDiscordBot();
});
