import { io, Socket } from "socket.io-client";
import { getAuthToken } from "./api";

const getSocketUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }
  return "http://localhost:3001";
};


let socket: Socket | null = null;

export function getSocket(): Socket {
  const token = getAuthToken();
  if (!socket) {
    socket = io(getSocketUrl(), {
      autoConnect: true,
      withCredentials: true,
      auth: {
        token: token || undefined,
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      timeout: 5000,
    });
  } else if (token && socket.auth && (socket.auth as any).token !== token) {
    (socket.auth as any).token = token;
    if (socket.connected) {
      socket.disconnect().connect();
    }
  }

  if (!socket.connected) {
    socket.connect();
  }
  return socket;
}

