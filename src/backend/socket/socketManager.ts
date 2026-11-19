import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import { isBotReady, discordClient } from "../bot/client";
import { collectHostMetrics } from "../services/hostMonitorService";
import { getLatestUpdate } from "../services/updateService";
import {
  AuthUser,
  isOwner,
  getJwtSecret,
  checkUserGuildPermission,
} from "../middleware/authMiddleware";
import { getAllowedOrigins } from "../config/runtime";
import { applicationGuildAccess, applicationMember } from "../services/applicationAccess";

let io: SocketIOServer | null = null;
let telemetryTimer: NodeJS.Timeout | null = null;

function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(";").forEach((cookieStr) => {
    const parts = cookieStr.split("=");
    const name = parts.shift()?.trim();
    if (name) {
      list[name] = decodeURIComponent(parts.join("=").trim());
    }
  });
  return list;
}

function extractSocketUser(socket: Socket): AuthUser | null {
  try {
    let token = socket.handshake.auth?.token;

    if (!token && socket.handshake.headers.cookie) {
      const parsedCookies = parseCookies(socket.handshake.headers.cookie);
      token = parsedCookies.guildpilot_token;
    }


    if (!token && socket.handshake.headers.authorization) {
      token = socket.handshake.headers.authorization.replace(/^Bearer\s+/i, "");
    }

    if (!token) return null;

    const jwtSecret = getJwtSecret();
    const decoded = jwt.verify(token, jwtSecret) as {
      id: string;
      username: string;
      avatar: string | null;
      scope?: AuthUser["scope"];
    };

    const role: "OWNER" | "USER" = isOwner(decoded.id) ? "OWNER" : "USER";

    return {
      id: decoded.id,
      username: decoded.username,
      avatar: decoded.avatar,
      role,
      scope: decoded.scope,
    };
  } catch (e) {
    return null;
  }
}

export function initSocketIO(server: HTTPServer) {
  io = new SocketIOServer(server, {
    pingInterval: 10000,
    pingTimeout: 5000,
    cors: {
      origin: (origin, callback) => {
        if (!origin || getAllowedOrigins().includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error("Origin is not allowed by Socket.IO CORS"));
      },
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", async (socket) => {
    const user = extractSocketUser(socket);
    socket.data.user = user;

    console.log(
      `[GuildPilot Socket] Client verbunden: ${socket.id} (User: ${
        user ? `${user.username} [${user.role}]` : "Anonym"
      })`
    );

    // 1. Öffentliche Bot-Statusinformationen an Client senden
    socket.emit("botStatusChange", {
      ready: isBotReady(),
      tag: discordClient.user?.tag || "pa_mife",
      id: discordClient.user?.id,
      ping: discordClient.ws?.ping || 0,
    });

    // 2. Wenn OWNER eingeloggt ist: Dem geschützten Telemetrie-Raum beitreten
    if (user && isOwner(user.id)) {
      socket.join("owner-room");

      try {
        const initialMetrics = await collectHostMetrics();
        socket.emit("hostMetricsUpdate", initialMetrics);
      } catch (e) {}

      try {
        const latestUpdate = getLatestUpdate();
        if (latestUpdate && latestUpdate.unread) {
          socket.emit("updateNotification", latestUpdate);
        }
      } catch (e) {}
    }

    // 3. Client fordert Beitritt zu einem Server-Kanal an
    socket.on("joinGuild", async (payload: { guildId: string }) => {
      const guildId = payload?.guildId;
      if (!guildId) return;

      const currentUser = socket.data.user;
      if (!currentUser) {
        socket.emit("guildJoinError", { guildId, error: "Unauthorized" });
        return;
      }

      if (currentUser.scope) return;
      const perm = await checkUserGuildPermission(currentUser.id, guildId);
      if (perm.allowed) {
        socket.join(`guild:${guildId}`);
        socket.emit("guildJoined", { guildId });
      } else {
        socket.emit("guildJoinError", {
          guildId,
          error: perm.reason || "Forbidden. Kein Zugriff auf diesen Server.",
        });
      }
    });

    socket.on("joinApplicationGuild", async (payload: { guildId: string }) => {
      const guildId = payload?.guildId;
      if (!user || user.scope === "plugins" || typeof guildId !== "string" || !/^\d{16,22}$/.test(guildId)) return;
      try {
        const member = await applicationMember(guildId, user.id);
        if (member && await applicationGuildAccess(member)) await socket.join(`applications:${guildId}`);
      } catch (error) {
        console.warn("[Applications] Could not join application updates:", error);
      }
    });
    socket.on("leaveApplicationGuild", (payload: { guildId: string }) => {
      if (typeof payload?.guildId === "string") void socket.leave(`applications:${payload.guildId}`);
    });

    // 4. Client verlässt Server-Kanal
    socket.on("leaveGuild", (payload: { guildId: string }) => {
      const guildId = payload?.guildId;
      if (guildId) {
        socket.leave(`guild:${guildId}`);
      }
    });

    socket.on("disconnect", () => {
      console.log(`[GuildPilot Socket] Client getrennt: ${socket.id}`);
    });
  });

  // Periodischer Telemetrie-Broadcast: AUSSCHLIESSLICH an den "owner-room"
  if (!telemetryTimer) {
    telemetryTimer = setInterval(async () => {
      if (io && io.sockets.adapter.rooms.get("owner-room")?.size) {
        try {
          const metrics = await collectHostMetrics();
          io.to("owner-room").emit("hostMetricsUpdate", metrics);
        } catch (e) {}
      }
    }, 1000);
  }

  return io;
}

/**
 * Sendet ein Event an alle Clients in einem bestimmten Guild-Raum (und an den Owner)
 */
export function broadcastGuildEvent(guildId: string, eventName: string, payload: any) {
  if (io) {
    io.to(`guild:${guildId}`).to("owner-room").emit(eventName, payload);
  }
}

export function broadcastApplicationEvent(guildId: string, event: "applicationSubmitted" | "applicationUpdated") {
  // Payload-free invalidation. HTTP rechecks membership and per-form roles on every read.
  io?.to(`applications:${guildId}`).emit(event, { guildId });
}

/**
 * Sendet ein Event ausschließlich an den verifizierten Owner
 */
export function broadcastOwnerEvent(eventName: string, payload: any) {
  if (io) {
    io.to("owner-room").emit(eventName, payload);
  }
}

/**
 * Globaler Event-Broadcast (z. B. für Bot-Status)
 */
export function broadcastEvent(eventName: string, payload: any) {
  if (io) {
    io.emit(eventName, payload);
  }
}

