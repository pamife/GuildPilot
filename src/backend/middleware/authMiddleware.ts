import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    avatar: string | null;
  };
}

export function requireOwnerAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const allowedUserId = process.env.ALLOWED_USER_ID;
  const jwtSecret = process.env.JWT_SECRET || "guildpilot_super_secret_local_key_change_me";

  // If in dev mode without configured ALLOWED_USER_ID, populate mock owner user for seamless testing
  if (!allowedUserId || allowedUserId === "your_discord_user_id_here") {
    req.user = {
      id: "owner_local_dev",
      username: "GuildPilot Owner (Dev Mode)",
      avatar: null,
    };
    return next();
  }

  const token = req.cookies?.guildpilot_token || req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Unauthorized. Please log in with Discord." });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as { id: string; username: string; avatar: string | null };
    
    if (decoded.id !== allowedUserId) {
      return res.status(403).json({ error: "Forbidden. Access is restricted to the bot owner." });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired session token." });
  }
}
