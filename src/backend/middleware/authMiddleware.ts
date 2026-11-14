import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { PermissionFlagsBits, PermissionsBitField } from "discord.js";
import { discordClient, isBotReady } from "../bot/client";

export interface AuthUser {
  id: string;
  username: string;
  avatar: string | null;
  role: "OWNER" | "USER";
  scope?: "applications";
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function isOwner(userId?: string | null): boolean {
  if (!userId) return false;
  const configuredOwnerId = process.env.ALLOWED_USER_ID || process.env.OWNER_ID;
  return Boolean(
    configuredOwnerId &&
      configuredOwnerId !== "your_discord_user_id_here" &&
      userId === configuredOwnerId
  );
}

import crypto from "crypto";

let runtimeFallbackSecret: string | null = null;

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.trim() !== "") {
    return secret;
  }

  if (!runtimeFallbackSecret) {
    runtimeFallbackSecret = crypto.randomBytes(32).toString("hex");
    console.warn(
      "[Security Warning] Using generated runtime JWT secret. Set JWT_SECRET in .env for persistent login sessions."
    );
  }
  return runtimeFallbackSecret;
}


/**
 * Extracts and verifies JWT from Cookie or Authorization header
 */
export function extractAuthUser(req: Request): AuthUser | null {
  const token =
    req.cookies?.guildpilot_token ||
    req.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (!token) return null;

  try {
    const jwtSecret = getJwtSecret();
    const decoded = jwt.verify(token, jwtSecret) as {
      id: string;
      username: string;
      avatar: string | null;
      role?: string;
      scope?: "applications";
    };

    const role: "OWNER" | "USER" = isOwner(decoded.id) ? "OWNER" : "USER";

    return {
      id: decoded.id,
      username: decoded.username,
      avatar: decoded.avatar,
      role,
      scope: decoded.scope,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Middleware: Requires valid authentication (Owner or regular User)
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const user = extractAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized. Please log in with Discord." });
  }
  req.user = user;
  next();
}

export function restrictApplicationSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const user = extractAuthUser(req);
  if (user?.scope !== "applications") return next();
  if (/^\/api\/auth\/(me|logout)\/?$/.test(req.path) ||
      /^\/api\/guilds\/(application-access\/?$|\d{16,22}\/applications(?:\/|$))/.test(req.path)) return next();
  return res.status(403).json({ error: "This session is limited to the Application Center." });
}

/**
 * Middleware: Requires the owner configured through ALLOWED_USER_ID.
 */
export function requireOwner(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const user = req.user || extractAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized. Please log in with Discord." });
  }

  req.user = user;

  if (!isOwner(user.id)) {
    return res.status(403).json({
      error: "Forbidden. Access is strictly restricted to the bot owner.",
    });
  }

  next();
}

// Backward compatibility alias
export const requireOwnerAuth = requireOwner;

/**
 * Helper to verify whether a given user has permission to manage a Discord server
 */
export async function checkUserGuildPermission(
  userId: string,
  guildId: string
): Promise<{ allowed: boolean; reason?: string }> {
  // Global Owner bypass
  if (isOwner(userId)) {
    return { allowed: true };
  }

  if (!isBotReady()) {
    return { allowed: false, reason: "Discord Bot is not connected." };
  }

  const guild =
    discordClient.guilds.cache.get(guildId) ||
    (await discordClient.guilds.fetch(guildId).catch(() => null));

  if (!guild) {
    return { allowed: false, reason: "Discord server not found or bot is not a member." };
  }

  // Guild Owner check
  if (guild.ownerId === userId) {
    return { allowed: true };
  }

  // Guild Member permission check
  try {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
      return { allowed: false, reason: "You are not a member of this Discord server." };
    }

    const hasAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);
    const hasManageGuild = member.permissions.has(PermissionsBitField.Flags.ManageGuild);

    if (hasAdmin || hasManageGuild) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: "You need 'Manage Server' or 'Administrator' permission on this Discord server.",
    };
  } catch (err: any) {
    return { allowed: false, reason: err.message || "Failed to verify server permissions." };
  }
}

export function extractGuildId(req: Request, paramName?: string): string | null {
  if (paramName && req.params?.[paramName]) return req.params[paramName];
  if (req.params?.id) return req.params.id;
  if (req.params?.guildId) return req.params.guildId;
  if (req.params?.targetGuildId) return req.params.targetGuildId;
  if (req.body?.guildId) return req.body.guildId;
  if (typeof req.query?.guildId === "string") return req.query.guildId;

  // Robuster URL-Regex-Fallback (z. B. /api/guilds/123456/...)
  const match = req.originalUrl?.match(/\/api\/guilds\/([a-zA-Z0-9_-]+)/);
  if (match && match[1] && match[1] !== "clone") {
    return match[1];
  }

  return null;
}

/**
 * Middleware factory: Requires the user to have permission for the specific guildId
 * @param paramName Parameter name in req.params (defaults to 'id' or 'guildId')
 */
export function requireGuildAccess(paramName?: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user || extractAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized. Please log in with Discord." });
    }
    req.user = user;

    // Resolve guildId from params, body, query or URL
    const guildId = extractGuildId(req, paramName);

    if (!guildId) {
      return res.status(400).json({ error: "Guild ID is required for this action." });
    }

    const perm = await checkUserGuildPermission(user.id, guildId);
    if (!perm.allowed) {
      return res.status(403).json({
        error: perm.reason || "Forbidden. You do not have permission to manage this server.",
      });
    }

    next();
  };
}

export async function requireManageServer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const guild = discordClient.guilds.cache.get(req.params.guildId);
  if (!discordClient.isReady() || !guild?.available) {
    return res.status(503).json({ error: "The bot is not connected to this server." });
  }

  try {
    const member = await guild.members.fetch({ user: req.user!.id, force: true });
    if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return next();
  } catch (error) {
    console.warn("[Guild Access] Failed to verify Manage Server permission:", error);
  }
  return res.status(403).json({ error: "You need Manage Server to do that." });
}
