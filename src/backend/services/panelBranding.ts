const footerFields = ["footer", "dmFooter", "welcomeFooter"] as const;

type PanelFooters = Partial<Record<(typeof footerFields)[number], string | null>>;

// Rebrand stored defaults on read without rewriting SQLite tables or custom text.
const legacyFooters = new Map([
  ["GuildPilot Applications System", "pa_mife Applications System"],
  ["GuildPilot Application System", "pa_mife Application System"],
  ["GuildPilot Self Roles", "pa_mife Self Roles"],
  ["GuildPilot Ticket Engine", "pa_mife Ticket Engine"],
  ["TheGodGen Ticket Engine", "pa_mife Ticket Engine"],
]);

export function withBrandedPanelFooters<T extends PanelFooters>(panel: T): T {
  const branded = { ...panel };
  for (const field of footerFields) {
    const footer = panel[field];
    const replacement = footer ? legacyFooters.get(footer) : undefined;
    if (replacement) branded[field] = replacement;
  }
  return branded;
}
