export const changelogLanguages = ["en", "de"] as const;
export type ChangelogLanguage = typeof changelogLanguages[number];

export const sectionPresets = {
  features: { emoji: "✨", en: "New Features", de: "Neue Funktionen" },
  improvements: { emoji: "🛠️", en: "Improvements", de: "Verbesserungen" },
  fixes: { emoji: "🐛", en: "Bug Fixes", de: "Fehlerbehebungen" },
  performance: { emoji: "⚡", en: "Performance", de: "Performance" },
  security: { emoji: "🔒", en: "Security", de: "Sicherheit" },
  changes: { emoji: "🔄", en: "Changes", de: "Änderungen" },
  removed: { emoji: "🗑️", en: "Removed", de: "Entfernt" },
  important: { emoji: "📢", en: "Important", de: "Wichtig" },
  custom: { emoji: "📝", en: "Custom Section", de: "Eigener Abschnitt" },
} satisfies Record<string, { emoji: string } & Record<ChangelogLanguage, string>>;

export type SectionType = keyof typeof sectionPresets;
export interface ChangelogSection {
  type: SectionType;
  title: string;
  emoji: string;
  description: string;
  entries: string[];
}

export interface ChangelogSettings {
  channelId: string | null;
  roleId: string | null;
  color: string;
  footer: string;
  language: ChangelogLanguage;
  autoPing: boolean;
}

export interface ChangelogContent extends Omit<ChangelogSettings, "autoPing"> {
  title: string;
  intro: string;
  version: string;
  banner: string;
  ping: boolean;
  sections: ChangelogSection[];
}

export const changelogDefaults: ChangelogSettings = {
  channelId: null, roleId: null, color: "#5865f2", footer: "", language: "en", autoPing: false,
};

export const changelogLimits = {
  title: 160, intro: 1200, version: 40, banner: 2048, footer: 240,
  sections: 30, sectionTitle: 100, emoji: 32, description: 600, entries: 20, entry: 300,
};

export function newChangelog(settings: ChangelogSettings): ChangelogContent {
  const { autoPing, ...defaults } = settings;
  return { ...defaults, title: "", intro: "", version: "", banner: "", ping: autoPing, sections: [] };
}

export function newSection(type: SectionType, language: ChangelogLanguage): ChangelogSection {
  const preset = sectionPresets[type];
  return { type, emoji: preset.emoji, title: preset[language], description: "", entries: [""] };
}

export function isBannerUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function changelogHeading({ title, version }: ChangelogContent) {
  return [title, version].filter(Boolean).join(" — ");
}

export function changelogDate(language: ChangelogLanguage, date: Date) {
  const formatted = new Intl.DateTimeFormat(language === "de" ? "de-DE" : "en-US", {
    dateStyle: "long", timeZone: "UTC",
  }).format(date);
  return language === "de" ? `📅 Veröffentlicht am ${formatted}` : `📅 Published on ${formatted}`;
}

export function discordText(text: string) {
  return text.replace(/[\\*_~`|>#[\]()]/g, "\\$&")
    .replace(/@(everyone|here)\b|<@/gi, (mention) => mention.replace("@", "@\u200b"));
}

export function changelogSectionText(section: ChangelogSection) {
  const heading = [section.emoji, section.title].filter(Boolean).join(" ");
  return [`### ${discordText(heading)}`, discordText(section.description),
    ...section.entries.map((entry) => `- ${discordText(entry)}`)].filter(Boolean).join("\n");
}

export function changelogPublishError(content: ChangelogContent): string | null {
  if (!content.title.trim()) return "Gib einen Titel ein.";
  if (!content.channelId) return "Wähle einen Ankündigungskanal.";
  if (content.ping && !content.roleId) return "Wähle eine Ping-Rolle oder deaktiviere den Ping.";
  if (content.banner && !isBannerUrl(content.banner)) return "Verwende für das Banner eine HTTPS-Bild-URL.";
  if (!content.sections.length) return "Füge mindestens einen Abschnitt hinzu.";
  for (const section of content.sections) {
    if (!section.title.trim() || !section.entries.length || section.entries.some((entry) => !entry.trim())) {
      return "Jeder Abschnitt braucht einen Titel und mindestens einen ausgefüllten Eintrag.";
    }
    if (changelogSectionText(section).length > 4000) {
      return `Der Abschnitt „${section.title}“ überschreitet Discords Limit von 4.000 Zeichen pro Text-Komponente.`;
    }
  }
  return null;
}

export type ChangelogStatus = "draft" | "publishing" | "published" | "failed" | "deleting" | "deleted";
export interface ChangelogSummary {
  id: string;
  title: string;
  version: string;
  status: ChangelogStatus;
  revision: number;
  updatedAt: string;
  channelId: string | null;
  channelName: string | null;
  messageId: string | null;
  pingMessageId: string | null;
  publishedAt: string | null;
  publisherId: string | null;
  publisherName: string | null;
}
export type ChangelogRecord = ChangelogSummary & { content: ChangelogContent };

export interface ChangelogPage {
  items: ChangelogSummary[];
  hasNext: boolean;
}

export interface ChangelogChoice { id: string; name: string }
export interface ChangelogOptions {
  channels: ChangelogChoice[];
  roles: ChangelogChoice[];
}
