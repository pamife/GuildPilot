import axios from "axios";

const getApiBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  return "http://localhost:3001";
};

export const api = axios.create({
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  config.baseURL = `${getApiBaseUrl()}/api`;
  return config;
});
