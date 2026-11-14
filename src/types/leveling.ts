export interface LevelReward {
  level: number;
  roleId: string;
}

export interface LevelingConfig {
  enabled: boolean;
  minXp: number;
  maxXp: number;
  cooldownSeconds: number;
  excludedChannelIds: string[];
  excludeRelay: boolean;
  announce: boolean;
  announcementId: string | null;
  rewards: LevelReward[];
  highestOnly: boolean;
  prestigeEnabled: boolean;
  prestigeLevel: number;
}

export const MAX_XP = 2_000_000_000;

export function xpForLevel(level: number) {
  return 5 * level * (level + 9);
}

export function levelForXp(xp: number) {
  return Math.floor((Math.sqrt(81 + 4 * xp / 5) - 9) / 2);
}

export function levelProgress(xp: number) {
  const level = levelForXp(xp);
  const threshold = xpForLevel(level);
  return { level, current: xp - threshold, needed: xpForLevel(level + 1) - threshold };
}

export interface LevelingRow {
  userId: string;
  xp: number;
  level: number;
  prestige: number;
  revision: number;
}

export interface LevelingPage {
  page: number;
  pages: number;
  entries: (LevelingRow & { position: number; name: string })[];
}

export type Ranking = "xp" | "prestige";
