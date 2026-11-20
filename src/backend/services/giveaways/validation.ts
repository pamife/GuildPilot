import { Guild, PermissionFlagsBits } from "discord.js";
import { isBannerUrl } from "../../../types/changelog";
import { GiveawayClaimDelivery, GiveawayConfig, GiveawayRules, GiveawaySettings, rejectionPolicies, RejectionPolicy } from "../../../types/giveaways";
import { discordCode, isChangelogChannel, snowflake, validateDestination } from "../changelogValidation";
import { PluginError } from "../pluginService";

export function invalid(message: string): never { throw new PluginError(400, message); }
export function conflict(message: string): never { throw new PluginError(409, message); }

export class GiveawayInteractionError extends Error {}

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("Ungültige Eingabe.");
  return value as Record<string, unknown>;
}

export function string(value: unknown, name: string, max: number, min = 0, multiline = false) {
  if (typeof value !== "string" || value.length > max) invalid(`${name}: höchstens ${max} Zeichen.`);
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (normalized.length < min) invalid(`${name}: mindestens ${min} Zeichen.`);
  if ((!multiline && normalized.includes("\n")) || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(normalized)) invalid(`${name} enthält ungültige Zeichen.`);
  return normalized;
}

export function integer(value: unknown, name: string, min: number, max: number) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    invalid(`${name}: ganze Zahl zwischen ${min} und ${max} erforderlich.`);
  }
  return value;
}

function boolean(value: unknown, name: string) {
  if (typeof value !== "boolean") invalid(`Ungültige Einstellung für ${name}.`);
  return value;
}

function optionalId(value: unknown) {
  if (value !== null && !snowflake(value)) invalid("Ungültiger Kanal oder ungültige Rolle.");
  return value;
}

function roles(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 10 || !value.every(snowflake)) invalid("Wähle höchstens zehn gültige Rollen pro Regel.");
  return [...new Set(value)].sort();
}

function parseRules(input: unknown): GiveawayRules {
  const data = object(input);
  const requiredRoles = roles(data.requiredRoles);
  const excludedRoles = roles(data.excludedRoles);
  if (requiredRoles.some(role => excludedRoles.includes(role))) invalid("Dieselbe Rolle kann nicht benötigt und ausgeschlossen sein.");
  if (data.roleMatch !== "ALL" && data.roleMatch !== "ANY") invalid("Ungültige Rollenregel.");
  return {
    requiredRoles, excludedRoles, roleMatch: data.roleMatch,
    accountDays: integer(data.accountDays, "Kontoalter", 0, 3650),
    memberDays: integer(data.memberDays, "Mitgliedschaftsdauer", 0, 3650),
    requireMember: boolean(data.requireMember, "Servermitgliedschaft"),
    recheck: boolean(data.recheck, "erneute Prüfung"),
    withdraw: boolean(data.withdraw, "Austritt"),
    entryBufferMinutes: integer(data.entryBufferMinutes, "Vorlauf für Teilnahmeschluss", 0, 1440),
  };
}

export function parseSettings(input: unknown): GiveawaySettings {
  const data = object(input);
  if (typeof data.color !== "string" || !/^#[a-f\d]{6}$/i.test(data.color)) invalid("Ungültige Akzentfarbe.");
  const timezone = string(data.timezone, "Zeitzone", 64, 1);
  try { new Intl.DateTimeFormat("de", { timeZone: timezone }); } catch { invalid("Ungültige IANA-Zeitzone."); }
  return {
    channelId: optionalId(data.channelId), winnerChannelId: optionalId(data.winnerChannelId),
    pingRoleId: optionalId(data.pingRoleId), auditChannelId: optionalId(data.auditChannelId),
    color: data.color, timezone, rules: parseRules(data.rules),
    durationHours: integer(data.durationHours, "Dauer in Stunden", 1, 8760),
    winnerCount: integer(data.winnerCount, "Gewinnerzahl", 1, 20),
    autoFinalize: boolean(data.autoFinalize, "automatische Veröffentlichung"),
    dmWinners: boolean(data.dmWinners, "Gewinner-DMs"),
    claimsEnabled: boolean(data.claimsEnabled, "Preisabholung"),
    claimHours: integer(data.claimHours, "Abholfrist", 1, 8760),
    autoReplaceExpired: boolean(data.autoReplaceExpired, "automatischer Ersatz"),
    notifyClaims: boolean(data.notifyClaims, "Abholbenachrichtigungen"),
    riskAccountDays: integer(data.riskAccountDays, "Hinweis für junges Konto", 0, 3650),
    riskMemberDays: integer(data.riskMemberDays, "Hinweis für neuen Serverbeitritt", 0, 3650),
    riskAttempts: integer(data.riskAttempts, "Hinweis für wiederholte Versuche", 0, 100),
  };
}

function image(value: unknown) {
  const url = string(value, "Bild-URL", 1000);
  if (url && !isBannerUrl(url)) invalid("Verwende eine HTTPS-Bild-URL.");
  return url;
}

export function parseConfig(input: unknown): GiveawayConfig {
  const data = object(input);
  const buttonEmoji = string(data.buttonEmoji, "Button-Emoji", 32);
  if (buttonEmoji && (!/\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(buttonEmoji) ||
      !/^[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\u200d\ufe0f\u20e3#*0-9\u{e0020}-\u{e007f}]+$/u.test(buttonEmoji) ||
      [...new Intl.Segmenter().segment(buttonEmoji)].length !== 1)) invalid("Verwende ein Unicode-Emoji oder lasse das Feld leer.");
  return {
    ...parseSettings(data), title: string(data.title, "Titel", 120, 1), prize: string(data.prize, "Preis", 120, 1),
    prizeDescription: string(data.prizeDescription, "Preisbeschreibung", 550, 0, true),
    description: string(data.description, "Einleitung", 550, 0, true),
    sponsor: string(data.sponsor, "Sponsor", 120), information: string(data.information, "Weitere Informationen", 360, 0, true),
    terms: string(data.terms, "Regeln", 500, 0, true), titleOverride: string(data.titleOverride, "Ankündigungstitel", 120),
    image: image(data.image), banner: image(data.banner), footer: string(data.footer, "Fußzeile", 150),
    buttonLabel: string(data.buttonLabel, "Button-Text", 70, 1), buttonEmoji,
    branding: string(data.branding, "Branding", 100),
  };
}

export function parseClaimDelivery(input: unknown, config: GiveawayConfig): GiveawayClaimDelivery | null {
  if (input == null) return null;
  const data = object(input);
  const note = string(data.note, "Private Abholnachricht", 1000, 0, true);
  if (!Array.isArray(data.codes) || data.codes.length > config.winnerCount) invalid("Gib höchstens einen Code pro Gewinnerplatz ein.");
  const codes = data.codes.map(value => string(value, "Preiscode", 160, 1));
  if (codes.some(code => /[`\t]/.test(code))) invalid("Preiscodes dürfen keine Backticks oder Tabulatoren enthalten.");
  if (new Set(codes).size !== codes.length) invalid("Jeder Gewinnerplatz benötigt einen eigenen Code.");
  if (codes.length && codes.length !== config.winnerCount) invalid("Gib für jeden Gewinnerplatz einen eigenen Code ein.");
  if (!note && !codes.length) return null;
  if (!config.claimsEnabled) invalid("Aktiviere die Preisabholung für die private Abholnachricht.");
  return { note, codes };
}

export function date(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) invalid("Datum als ISO-Zeitstempel in UTC erforderlich.");
  const result = new Date(value);
  if (!Number.isFinite(result.getTime()) || result.toISOString() !== value) invalid("Ungültiges Datum.");
  return result;
}

export function parseId(value: unknown) {
  if (typeof value !== "string" || !/^[a-f\d]{32}$/.test(value)) invalid("Ungültige Giveaway-ID.");
  return value;
}

export function reason(value: unknown) { return string(value, "Begründung", 750, 8, true); }

export function policy(value: unknown): RejectionPolicy {
  if (typeof value !== "string" || !Object.hasOwn(rejectionPolicies, value)) invalid("Wähle einen Grund aus der Richtlinie.");
  return value as RejectionPolicy;
}

export async function validateConfig(guild: Guild, settings: GiveawaySettings, required = false) {
  if (required && !settings.channelId) invalid("Wähle einen Ankündigungskanal.");
  const roleIds = [...settings.rules.requiredRoles, ...settings.rules.excludedRoles];
  await Promise.all([
    validateDestination(guild, settings.channelId, settings.pingRoleId, Boolean(settings.pingRoleId)),
    ...[...new Set([settings.channelId, settings.winnerChannelId, settings.auditChannelId].filter((id): id is string => Boolean(id)))].map(async id => {
      const channel = await validateDestination(guild, id, null, false);
      const bot = await guild.members.fetchMe();
      if (!channel?.permissionsFor(bot).has(PermissionFlagsBits.ReadMessageHistory)) {
        invalid("Der Bot benötigt Nachrichtenverlauf lesen in allen Giveaway-Kanälen.");
      }
      if (id === settings.auditChannelId) {
        const everyone = guild.roles.everyone;
        if (channel.permissionsFor(everyone).has(PermissionFlagsBits.ViewChannel)) invalid("Wähle einen privaten Audit-Kanal.");
      }
    }),
    ...roleIds.map(async id => {
      if (id === guild.id || !await guild.roles.fetch(id, { force: true }).catch(error => {
        if (discordCode(error, 10011)) return null;
        throw error;
      })) invalid("Die Teilnahmebedingungen müssen Rollen dieses Servers verwenden.");
    }),
  ]);
  if (settings.notifyClaims && !settings.auditChannelId) invalid("Abholbenachrichtigungen benötigen einen privaten Audit-Kanal.");
}

export async function options(guild: Guild) {
  const [channels, roles, bot] = await Promise.all([guild.channels.fetch(), guild.roles.fetch(), guild.members.fetchMe()]);
  return {
    channels: [...channels.values()].filter(isChangelogChannel).filter(channel =>
      channel.permissionsFor(bot).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory])
    ).sort((a, b) => a.rawPosition - b.rawPosition).map(({ id, name }) => ({ id, name })),
    roles: [...roles.values()].filter(role => role.id !== guild.id).sort((a, b) => b.position - a.position)
      .map(({ id, name }) => ({ id, name })),
  };
}
