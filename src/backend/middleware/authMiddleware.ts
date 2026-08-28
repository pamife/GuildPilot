import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { PermissionsBitField } from "discord.js";
import { discordClient, isBotReady } from "../bot/client";

export const OWNER_DISCORD_ID = "821748338898501693";

export interface AuthUser {
  id: string;
  username: string;
  avatar: string | null;
  role: "OWNER" | "USER";
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function isOwner(userId?: string | null): boolean {
  if (!userId) return false;
  const configuredOwnerId = process.env.ALLOWED_USER_ID || process.env.OWNER_ID;
  return (
    userId === OWNER_DISCORD_ID ||
    (Boolean(configuredOwnerId) &&
      configuredOwnerId !== "your_discord_user_id_here" &&
      userId === configuredOwnerId)
  );
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === "guildpilot_super_secret_local_key_change_me") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("[SECURITY CRITICAL] In Production Mode, JWT_SECRET must be set to a secure secret.");
    }
    return "guildpilot_super_secret_local_key_change_me";
  }
  return secret;
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
    };

    const role: "OWNER" | "USER" = isOwner(decoded.id) ? "OWNER" : "USER";

    return {
      id: decoded.id,
      username: decoded.username,
      avatar: decoded.avatar,
      role,
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

/**
 * Middleware: Requires global OWNER privileges (Discord ID: 821748338898501693)
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


