export interface ModerationSettings {
  logChannelId: string | null;
  reviewRoleIds: string[];
  timeoutRoleIds: string[];
}

export type AutoModAction = "log" | "delete";
export type AutoModRuleId = "flood" | "repeat" | "invites";

export interface AutoModRule {
  enabled: boolean;
  action: AutoModAction;
  exemptRoleIds: string[];
  exemptChannelIds: string[];
}

export type SpamRule = AutoModRule & { threshold: number; windowSeconds: number };

export interface AutoModSettings {
  flood: SpamRule;
  repeat: SpamRule;
  invites: AutoModRule & { allowedCodes: string[] };
}

export const autoModRuleIds = ["flood", "repeat", "invites"] as const;

export const autoModRuleLabels: Record<AutoModRuleId, string> = {
  flood: "Nachrichtenflut",
  repeat: "Wiederholte Nachrichten",
  invites: "Discord-Einladungslinks",
};
