import {
  ChannelType, DiscordAPIError, Guild, PermissionFlagsBits, TextChannel, NewsChannel,
} from "discord.js";
import {
  ChangelogContent, ChangelogSection, ChangelogSettings, SectionType, changelogLimits as limits, isBannerUrl, sectionPresets,
} from "../../types/changelog";
import { PluginError } from "./pluginService";

export type ChangelogChannel = TextChannel | NewsChannel;

function invalid(message: string): never {
  throw new PluginError(400, message);
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("Ungültige Changelog-Daten.");
  return value as Record<string, unknown>;
}

function text(value: unknown, limit: number, label: string, singleLine = false) {
  if (typeof value !== "string" || value.length > limit) invalid(`${label} darf höchstens ${limit} Zeichen haben.`);
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (singleLine && normalized.includes("\n")) invalid(`${label} muss einzeilig sein.`);
  return normalized;
}

export function snowflake(value: unknown): value is string {
  return typeof value === "string" && /^\d{17,20}$/.test(value);
}

function readId(value: unknown, label: string) {
  if (value !== null && !snowflake(value)) invalid(`Ungültige Auswahl für ${label}.`);
  return value;
}

function boolean(value: unknown, label: string) {
  if (typeof value !== "boolean") invalid(`Ungültige Einstellung für ${label}.`);
  return value;
}

function parseDefaults(value: Record<string, unknown>): Omit<ChangelogSettings, "autoPing"> {
  const { color, language } = value;
  if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)) invalid("Wähle eine gültige Akzentfarbe.");
  if (language !== "en" && language !== "de") invalid("Wähle Deutsch oder Englisch.");
  return {
    channelId: readId(value.channelId, "Ankündigungskanal"),
    roleId: readId(value.roleId, "Ping-Rolle"),
    color, language, footer: text(value.footer, limits.footer, "Fußzeile", true),
  };
}

export function parseChangelogSettings(input: unknown): ChangelogSettings {
  const value = object(input);
  const settings = parseDefaults(value);
  const autoPing = boolean(value.autoPing, "automatischen Ping");
  if (autoPing && !settings.roleId) invalid("Wähle eine Standardrolle für den automatischen Ping.");
  return { ...settings, autoPing };
}

function parseSection(input: unknown): ChangelogSection {
  const value = object(input);
  if (typeof value.type !== "string" || !Object.hasOwn(sectionPresets, value.type)) invalid("Unbekannter Abschnittstyp.");
  if (!Array.isArray(value.entries) || value.entries.length > limits.entries) {
    invalid(`Pro Abschnitt sind bis zu ${limits.entries} Einträge möglich.`);
  }
  return {
    type: value.type as SectionType,
    title: text(value.title, limits.sectionTitle, "Abschnittstitel", true),
    emoji: text(value.emoji, limits.emoji, "Abschnitts-Emoji", true),
    description: text(value.description, limits.description, "Abschnittsbeschreibung"),
    entries: value.entries.map((entry) => text(entry, limits.entry, "Eintrag", true)),
  };
}

export function parseChangelog(input: unknown): ChangelogContent {
  const value = object(input);
  const banner = text(value.banner, limits.banner, "Banner-URL", true);
  if (banner && !isBannerUrl(banner)) invalid("Verwende für das Banner eine HTTPS-Bild-URL.");
  if (!Array.isArray(value.sections) || value.sections.length > limits.sections) {
    invalid(`Pro Changelog sind bis zu ${limits.sections} Abschnitte möglich.`);
  }
  return {
    ...parseDefaults(value),
    banner,
    title: text(value.title, limits.title, "Titel", true),
    intro: text(value.intro, limits.intro, "Einleitung"),
    version: text(value.version, limits.version, "Versionsnummer", true),
    ping: boolean(value.ping, "Rollenping"),
    sections: value.sections.map(parseSection),
  };
}

export function isChangelogChannel(channel: { type: ChannelType } | null): channel is ChangelogChannel {
  return channel?.type === ChannelType.GuildText || channel?.type === ChannelType.GuildAnnouncement;
}

export function discordCode(error: unknown, code: number) {
  return error instanceof DiscordAPIError && Number(error.code) === code;
}

export async function fetchChangelogChannel(guild: Guild, id: string) {
  const channel = await guild.channels.fetch(id, { force: true }).catch((error) => {
    if (discordCode(error, 50001) || discordCode(error, 50013)) return null;
    throw error;
  });
  if (!isChangelogChannel(channel) || channel.guildId !== guild.id) {
    invalid("Der Bot hat keinen Zugriff auf diesen Text- oder Ankündigungskanal.");
  }
  return channel;
}

export async function validateDestination(guild: Guild, channelId: string | null, roleId: string | null, ping: boolean) {
  const role = roleId && roleId !== guild.id ? await guild.roles.fetch(roleId, { force: true }).catch((error) => {
    if (discordCode(error, 10011)) return null;
    throw error;
  }) : null;
  if (roleId && (!role || role.guild.id !== guild.id)) invalid("Wähle eine vorhandene Ping-Rolle von diesem Server.");
  const channel = channelId ? await fetchChangelogChannel(guild, channelId).catch((error) => {
    if (discordCode(error, 10003)) invalid("Dieser Ankündigungskanal ist nicht mehr verfügbar.");
    throw error;
  }) : null;
  if (!channel) return null;

  const bot = await guild.members.fetchMe({ force: true });
  const permissions = channel.permissionsFor(bot);
  if (!permissions.has(PermissionFlagsBits.ViewChannel)) invalid("Der Bot kann diesen Kanal nicht sehen.");
  if (!permissions.has(PermissionFlagsBits.SendMessages)) invalid("Der Bot darf in diesem Kanal keine Nachrichten senden.");
  if (ping && role && !role.mentionable && !permissions.has(PermissionFlagsBits.MentionEveryone)) {
    invalid("Der Bot darf diese Rolle im gewählten Kanal nicht erwähnen. Mach die Rolle erwähnbar oder erlaube dem Bot, Rollen zu erwähnen.");
  }
  return channel;
}
