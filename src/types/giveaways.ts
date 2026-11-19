export const giveawayStatuses = [
  "DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "ENDED", "DRAW_PENDING", "WINNER_REVIEW",
  "AWAITING_CLAIM", "COMPLETED", "CANCELLED", "FAILED",
] as const;
export type GiveawayStatus = typeof giveawayStatuses[number];

export const claimStatuses = ["PENDING", "CLAIMED", "FULFILLED", "DECLINED", "EXPIRED", "CANCELLED"] as const;
export type ClaimStatus = typeof claimStatuses[number];

export const rejectionPolicies = {
  INELIGIBLE: "Berechtigung fehlt",
  LEFT: "Server verlassen",
  DECLINED: "Preis abgelehnt",
  EXPIRED: "Abholfrist abgelaufen",
  RULE_VIOLATION: "Verstoß gegen veröffentlichte Regeln",
  CORRECTION: "Dokumentierte administrative Korrektur",
} as const;
export type RejectionPolicy = keyof typeof rejectionPolicies;

export const checkLabels = {
  member: "Servermitgliedschaft",
  account: "Kontoalter",
  tenure: "Mitgliedschaftsdauer",
  required: "Benötigte Rollen",
  excluded: "Ausgeschlossene Rollen",
  manual: "Manueller Ausschluss",
} as const;

export interface Verification {
  status: "ELIGIBLE" | "INELIGIBLE" | "REVIEW" | "EXCLUDED";
  risk: "LOW" | "MEDIUM" | "HIGH" | "REQUIRES_REVIEW";
  signals: string[];
  checks: Record<keyof typeof checkLabels, { result: "PASSED" | "FAILED" | "UNKNOWN" | "ERROR"; detail: string }>;
  checkedAt: string;
  accountDays: number;
  memberDays: number | null;
  membership: "PRESENT" | "LEFT" | "UNKNOWN";
}

export interface GiveawayRules {
  requiredRoles: string[];
  excludedRoles: string[];
  roleMatch: "ALL" | "ANY";
  accountDays: number;
  memberDays: number;
  requireMember: boolean;
  recheck: boolean;
  withdraw: boolean;
  entryBufferMinutes: number;
}

export interface GiveawaySettings {
  channelId: string | null;
  winnerChannelId: string | null;
  pingRoleId: string | null;
  auditChannelId: string | null;
  color: string;
  timezone: string;
  durationHours: number;
  winnerCount: number;
  autoFinalize: boolean;
  dmWinners: boolean;
  claimsEnabled: boolean;
  claimHours: number;
  autoReplaceExpired: boolean;
  notifyClaims: boolean;
  riskAccountDays: number;
  riskMemberDays: number;
  riskAttempts: number;
  rules: GiveawayRules;
}

export interface GiveawayConfig extends GiveawaySettings {
  title: string;
  prize: string;
  prizeDescription: string;
  sponsor: string;
  information: string;
  terms: string;
  titleOverride: string;
  description: string;
  image: string;
  banner: string;
  footer: string;
  buttonLabel: string;
  buttonEmoji: string;
  branding: string;
}

export const appearanceKeys = ["color", "titleOverride", "description", "image", "banner", "footer", "buttonLabel", "buttonEmoji", "branding"] as const;
export const defaultGiveawayButtonLabel = "Enter Giveaway";

export const giveawayDefaults: GiveawaySettings = {
  channelId: null, winnerChannelId: null, pingRoleId: null, auditChannelId: null,
  color: "#34d399", timezone: "Europe/Berlin", durationHours: 48, winnerCount: 1, autoFinalize: false,
  dmWinners: true, claimsEnabled: false, claimHours: 48, autoReplaceExpired: false, notifyClaims: false,
  riskAccountDays: 7, riskMemberDays: 2, riskAttempts: 5,
  rules: {
    requiredRoles: [], excludedRoles: [], roleMatch: "ALL", accountDays: 0, memberDays: 0,
    requireMember: true, recheck: true, withdraw: true, entryBufferMinutes: 0,
  },
};

export function newGiveaway(settings: GiveawaySettings): GiveawayConfig {
  return {
    ...settings, title: "", prize: "", prizeDescription: "", sponsor: "", information: "", terms: "",
    titleOverride: "", description: "", image: "", banner: "", footer: "", buttonLabel: defaultGiveawayButtonLabel,
    buttonEmoji: "🎉", branding: "Discord Giveaway",
  };
}

export const unix = (date: Date | string) => Math.floor(new Date(date).getTime() / 1000);

export function entryDeadline(end: Date, rules: GiveawayRules) {
  return new Date(end.getTime() - rules.entryBufferMinutes * 60_000);
}

export function giveawayRequirements(rules: GiveawayRules) {
  return [
    rules.requireMember && "Be a member of the server when winners are drawn.",
    rules.accountDays > 0 && `Minimum Discord account age: ${rules.accountDays} ${rules.accountDays === 1 ? "day" : "days"}`,
    rules.memberDays > 0 && `Minimum server membership: ${rules.memberDays} ${rules.memberDays === 1 ? "day" : "days"}`,
    rules.requiredRoles.length > 0 && `${rules.roleMatch === "ALL" ? "All required roles" : "At least one of these roles"}: ${rules.requiredRoles.map(id => `<@&${id}>`).join(", ")}`,
    rules.excludedRoles.length > 0 && `Excluded roles: ${rules.excludedRoles.map(id => `<@&${id}>`).join(", ")}`,
  ].filter((value): value is string => Boolean(value));
}

export function giveawayCopy(config: GiveawayConfig) {
  return {
    heading: config.titleOverride || config.title,
    lead: [config.description, config.prizeDescription].filter(Boolean),
    details: [config.sponsor && `Sponsor: ${config.sponsor}`, config.information, config.terms].filter(Boolean),
    requirements: giveawayRequirements(config.rules),
  };
}
