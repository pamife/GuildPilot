export interface ModerationSettings {
  logChannelId: string | null;
  reviewRoleIds: string[];
  timeoutRoleIds: string[];
  permissions?: Partial<Record<ModerationPermission, string[]>>;
  dmDefault?: boolean;
}

export const moderationPermissions = ["cases", "warn", "timeout", "kick", "ban", "chat", "review", "settings"] as const;
export type ModerationPermission = typeof moderationPermissions[number];
export type ModerationAction = "warn" | "revoke_warn" | "timeout" | "untimeout" | "kick" | "ban" | "unban" | "purge" | "slowmode";

export type AutoModAction = "log" | "delete";
export type AutoModRuleId = typeof autoModRuleIds[number];

export interface AutoModRule {
  enabled: boolean;
  action: AutoModAction;
  exemptRoleIds: string[];
  exemptChannelIds: string[];
}

export type SpamRule = AutoModRule & { threshold: number; windowSeconds: number; escalation?: { enabled: boolean; hits: number; windowSeconds: number; timeoutSeconds: number } };

export interface AutoModSettings {
  flood: SpamRule;
  repeat: SpamRule;
  invites: AutoModRule & { allowedCodes: string[] };
  mentions: AutoModRule & { threshold: number; everyone: boolean };
  words: AutoModRule & { words: string[]; wholeWord: boolean };
  domains: AutoModRule & { domains: string[]; allowedDomains: string[]; subdomains: boolean };
}

export const autoModRuleIds = ["flood", "repeat", "invites", "mentions", "words", "domains"] as const;

export const autoModRuleLabels: Record<AutoModRuleId, string> = {
  flood: "Nachrichtenflut",
  repeat: "Wiederholte Nachrichten",
  invites: "Discord-Einladungslinks",
  mentions: "Mention-Spam",
  words: "Wortfilter",
  domains: "Domainfilter",
};
