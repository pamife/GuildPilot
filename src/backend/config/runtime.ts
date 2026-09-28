export const isDockerDeployment = process.env.DOCKER_DEPLOYMENT === "true";

export function getAllowedOrigins(): string[] {
  const configuredOrigins = [
    process.env.FRONTEND_URL,
    ...(process.env.CORS_ORIGINS || "").split(","),
  ]
    .map((value) => value?.trim().replace(/\/$/, ""))
    .filter((value): value is string => Boolean(value));

  if (process.env.NODE_ENV !== "production") {
    configuredOrigins.push("http://localhost:3000", "http://127.0.0.1:3000");
  }

  return [...new Set(configuredOrigins)];
}

export function isAllowedOrigin(origin?: string | null): boolean {
  if (!origin) return false;
  return getAllowedOrigins().includes(origin.replace(/\/$/, ""));
}
