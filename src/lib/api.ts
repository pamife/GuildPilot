import axios from "axios";

const getApiBaseUrl = () => {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const protocol = window.location.protocol;
    return `${protocol}//${host}:3001`;
  }
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return "http://localhost:3001";
};

export const api = axios.create({
  withCredentials: true,
  timeout: 5000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  config.baseURL = `${getApiBaseUrl()}/api`;
  return config;
});
