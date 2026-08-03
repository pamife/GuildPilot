import { io, Socket } from "socket.io-client";

const getSocketUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  return "http://localhost:3001";
};

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(getSocketUrl(), {
      autoConnect: true,
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      timeout: 5000,
    });
  }
  if (!socket.connected) {
    socket.connect();
  }
  return socket;
}
