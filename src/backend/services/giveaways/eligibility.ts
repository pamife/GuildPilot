import { Guild, GuildMember, SnowflakeUtil } from "discord.js";
import { GiveawayConfig, Verification } from "../../../types/giveaways";
import { discordCode } from "../changelogValidation";

export type MemberLookup = GuildMember | "LEFT" | "UNAVAILABLE";
const day = 86_400_000;

export async function lookupMember(guild: Guild, userId: string): Promise<MemberLookup> {
  try {
    return await guild.members.fetch({ user: userId, force: true });
  } catch (error) {
    return discordCode(error, 10007) ? "LEFT" : "UNAVAILABLE";
  }
}

export function verifyEligibility(config: GiveawayConfig, userId: string, lookup: MemberLookup, attempts = 0,
  documented = false, exclusion?: string | null, now = new Date(), entered?: Verification): Verification {
  const { rules } = config;
  const accountDays = Math.floor((now.getTime() - SnowflakeUtil.timestampFrom(userId)) / day);
  const member = typeof lookup === "object" ? lookup : null;
  const membership = member ? "PRESENT" : lookup === "LEFT" ? "LEFT" : "UNKNOWN";
  const memberDays = member?.joinedTimestamp != null ? Math.floor((now.getTime() - member.joinedTimestamp) / day) : null;
  const result = (passed: boolean, detail: string): Verification["checks"]["account"] => ({ result: passed ? "PASSED" : "FAILED", detail });
  const memberCheck = (required: boolean, evaluate: () => boolean, explanation: string): typeof checks.account => {
    if (!required) return result(true, "Keine Anforderung");
    if (lookup === "UNAVAILABLE") return { result: "ERROR", detail: "Discord-Mitgliedsdaten vorübergehend nicht verfügbar." };
    if (!member) return result(false, "Die Person ist nicht mehr auf dem Server.");
    return result(evaluate(), explanation);
  };
  const checks: Verification["checks"] = {
    member: memberCheck(rules.requireMember, () => true, "Mitgliedschaft bestätigt"),
    account: result(accountDays >= rules.accountDays, `${accountDays} Tage · mindestens ${rules.accountDays}`),
    tenure: memberCheck(rules.memberDays > 0, () => memberDays !== null && memberDays >= rules.memberDays,
      `${memberDays ?? "Unbekannt"} Tage · mindestens ${rules.memberDays}`),
    required: memberCheck(rules.requiredRoles.length > 0, () => rules.roleMatch === "ALL"
      ? rules.requiredRoles.every(id => member?.roles.cache.has(id)) : rules.requiredRoles.some(id => member?.roles.cache.has(id)),
    `${rules.requiredRoles.filter(id => member?.roles.cache.has(id)).length} von ${rules.requiredRoles.length} Rollen vorhanden · ${rules.roleMatch === "ALL" ? "alle" : "mindestens eine"} benötigt`),
    excluded: lookup === "LEFT" ? result(true, "Keine aktiven Serverrollen") : memberCheck(rules.excludedRoles.length > 0,
      () => !rules.excludedRoles.some(id => member?.roles.cache.has(id)), `${rules.excludedRoles.filter(id => member?.roles.cache.has(id)).length} ausgeschlossene Rollen vorhanden`),
    manual: result(!exclusion, exclusion || "Kein Ausschluss"),
  };
  if (member && memberDays === null && rules.memberDays > 0) checks.tenure = { result: "UNKNOWN", detail: "Discord hat kein Beitrittsdatum geliefert." };
  if (entered && !rules.recheck) {
    for (const key of ["account", "tenure", "required", "excluded"] as const) {
      if (entered.checks[key].result === "PASSED" || entered.checks[key].result === "FAILED") checks[key] = entered.checks[key];
    }
  }
  const values = Object.values(checks);
  const status = exclusion ? "EXCLUDED" : values.some(check => check.result === "FAILED") ? "INELIGIBLE"
    : lookup === "UNAVAILABLE" || values.some(check => check.result !== "PASSED") ? "REVIEW" : "ELIGIBLE";
  const signals = [
    config.riskAccountDays > accountDays && "Kürzlich erstelltes Konto",
    memberDays !== null && config.riskMemberDays > memberDays && "Kürzlicher Serverbeitritt",
    checks.required.result === "FAILED" && "Benötigte Rollen fehlen",
    checks.excluded.result === "FAILED" && "Ausgeschlossene Rolle vorhanden",
    membership === "LEFT" && "Server verlassen",
    attempts > 0 && "Wiederholter oder abgewiesener Teilnahmeversuch",
    config.riskAttempts > 0 && attempts >= config.riskAttempts && "Grenzwert für Teilnahmeversuche erreicht",
    documented && "Dokumentierter Regelverstoß bei einem früheren Giveaway",
  ].filter((signal): signal is string => Boolean(signal));
  const risk = status === "REVIEW" ? "REQUIRES_REVIEW" : documented || signals.length >= 3 ? "HIGH" : signals.length ? "MEDIUM" : "LOW";
  return { status, risk, signals, checks, checkedAt: now.toISOString(), accountDays, memberDays, membership };
}

export function entryVerification(value: Verification) {
  return {
    verification: JSON.stringify(value), eligibility: value.status, risk: value.risk,
    membership: value.membership, requiredCheck: value.checks.required.result, accountCheck: value.checks.account.result,
  };
}
