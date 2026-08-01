import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";

let io: SocketIOServer | null = null;

export function initSocketIO(server: HTTPServer) {
  io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`[GuildPilot Socket] Client connected: ${socket.id}`);

    socket.on("disconnect", () => {
      console.log(`[GuildPilot Socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function broadcastEvent(eventName: string, payload: any) {
  if (io) {
    io.emit(eventName, payload);
  }
}
