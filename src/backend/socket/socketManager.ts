import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { isBotReady, discordClient } from "../bot/client";
import { collectHostMetrics } from "../services/hostMonitorService";
import { getLatestUpdate } from "../services/updateService";

let io: SocketIOServer | null = null;
let telemetryTimer: NodeJS.Timeout | null = null;

export function initSocketIO(server: HTTPServer) {
  io = new SocketIOServer(server, {
    pingInterval: 10000,
    pingTimeout: 5000,
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", async (socket) => {
    console.log(`[GuildPilot Socket] Client connected: ${socket.id}`);

    // Send immediate bot status to newly connected client
    socket.emit("botStatusChange", {
      ready: isBotReady(),
      tag: discordClient.user?.tag || "TheGodGen Bot",
      id: discordClient.user?.id,
      ping: discordClient.ws?.ping || 0,
    });

    // Send immediate initial host metrics
    try {
      const initialMetrics = await collectHostMetrics();
      socket.emit("hostMetricsUpdate", initialMetrics);
    } catch (e) {
      // Ignore initial metric error
    }

    // Send unread update notification if available
    try {
      const latestUpdate = getLatestUpdate();
      if (latestUpdate && latestUpdate.unread) {
        socket.emit("updateNotification", latestUpdate);
      }
    } catch (e) {
      // Ignore update error
    }

    socket.on("disconnect", () => {
      console.log(`[GuildPilot Socket] Client disconnected: ${socket.id}`);
    });
  });

  // Start periodic telemetry broadcast every 1000ms
  if (!telemetryTimer) {
    telemetryTimer = setInterval(async () => {
      if (io && io.sockets.sockets.size > 0) {
        const metrics = await collectHostMetrics();
        io.emit("hostMetricsUpdate", metrics);
      }
    }, 1000);
  }

  return io;
}

export function broadcastEvent(eventName: string, payload: any) {
  if (io) {
    io.emit(eventName, payload);
  }
}
