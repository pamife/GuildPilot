import { autoModRuleIds, AutoModSettings, moderationPermissions, ModerationSettings } from "../../types/moderation";
import { defaultAutoMod } from "./moderationService";
import { ModerationError } from "./moderationActions";
export const snowflake = /^\d{17,20}$/;
export function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ModerationError("Expected an object.");
  return input as Record<string, unknown>;
}
export function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new ModerationError(`Choose an integer from ${min} to ${max}.`);
  return value;
}
export function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new ModerationError("Expected true or false.");
  return value;
}
export function strings(value: unknown, pattern = snowflake, limit = 250): string[] {
  if (!Array.isArray(value) || value.length > limit || !value.every(item => typeof item === "string" && pattern.test(item))) throw new ModerationError("Invalid list values.");
  return [...new Set(value)];
}
export function parseSettings(value: unknown): ModerationSettings {
  const input = object(value);
  if (input.logChannelId !== null && (typeof input.logChannelId !== "string" || !snowflake.test(input.logChannelId))) throw new ModerationError("Invalid log channel.");
  const permissions: ModerationSettings["permissions"] = {};
  for (const [key, roles] of Object.entries(object(input.permissions ?? {}))) {
    if (!moderationPermissions.includes(key as typeof moderationPermissions[number])) throw new ModerationError("Unknown permission.");
    permissions[key as typeof moderationPermissions[number]] = strings(roles);
  }
  return { logChannelId: input.logChannelId, reviewRoleIds: strings(input.reviewRoleIds), timeoutRoleIds: strings(input.timeoutRoleIds), permissions, dmDefault: boolean(input.dmDefault ?? false) };
}
export function parseAutoMod(value: unknown): AutoModSettings {
  const input = { ...defaultAutoMod, ...object(value) };
  const result = structuredClone(defaultAutoMod);
  for (const id of autoModRuleIds) {
    const rule = object(input[id]);
    if (rule.action !== "log" && rule.action !== "delete") throw new ModerationError("Invalid rule action.");
    Object.assign(result[id], { enabled: boolean(rule.enabled), action: rule.action,
      exemptRoleIds: strings(rule.exemptRoleIds), exemptChannelIds: strings(rule.exemptChannelIds) });
    if (id === "flood" || id === "repeat") {
      Object.assign(result[id], { threshold: integer(rule.threshold, 2, 50), windowSeconds: integer(rule.windowSeconds, 1, 120) });
      if (rule.escalation) {
        const escalation = object(rule.escalation);
        result[id].escalation = { enabled: boolean(escalation.enabled), hits: integer(escalation.hits, 2, 50),
          windowSeconds: integer(escalation.windowSeconds, 10, 3600), timeoutSeconds: integer(escalation.timeoutSeconds, 60, 3600) };
      }
    }
    if (id === "invites") result.invites.allowedCodes = strings(rule.allowedCodes, /^[a-zA-Z0-9-]{1,64}$/);
    if (id === "mentions") Object.assign(result.mentions, { threshold: integer(rule.threshold, 1, 50), everyone: boolean(rule.everyone) });
    if (id === "words") Object.assign(result.words, { words: strings(rule.words, /^.{1,100}$/u), wholeWord: boolean(rule.wholeWord) });
    if (id === "domains") {
      const domains = (v: unknown) => strings(v, /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/).map(host => new URL(`https://${host}`).hostname.toLowerCase());
      Object.assign(result.domains, { domains: domains(rule.domains), allowedDomains: domains(rule.allowedDomains), subdomains: boolean(rule.subdomains) });
    }
  }
  return result;
}
