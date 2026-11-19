import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder,
  MessageCreateOptions, MessageFlags, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder,
} from "discord.js";
import { discordText } from "../../types/changelog";
import { defaultGiveawayButtonLabel, entryDeadline, GiveawayConfig, giveawayRequirements, unix } from "../../types/giveaways";

const entryCount = new Intl.NumberFormat("en-US");

export const safeMentions = { parse: [], roles: [], users: [], repliedUser: false } satisfies MessageCreateOptions["allowedMentions"];

function components(color: string) {
  const container = new ContainerBuilder().setAccentColor(Number.parseInt(color.slice(1), 16));
  return {
    text(value: string) { container.addTextDisplayComponents(new TextDisplayBuilder().setContent(value)); },
    separator() { container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)); },
    gallery(urls: string[]) {
      container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(urls.map(url => new MediaGalleryItemBuilder().setURL(url))));
    },
    buttons(...buttons: ButtonBuilder[]) {
      container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons));
    },
    message() {
      return { flags: MessageFlags.IsComponentsV2, components: [container.toJSON()], allowedMentions: safeMentions } satisfies MessageCreateOptions;
    },
  };
}

function action(id: string, label: string, style: ButtonStyle.Primary | ButtonStyle.Secondary, emoji?: string) {
  const button = new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
  if (emoji) button.setEmoji(emoji);
  return button;
}

export function deliveryReference(key: string) { return `GP · ${key}`; }

type GiveawayMessage = {
  id: string; status: string; endAt: Date; commitment: string; publishedRound: number;
};

function statusLine(row: GiveawayMessage, acceptsEntries: boolean) {
  if (row.status === "CANCELLED") return "Cancelled";
  if (row.publishedRound) return "Results announced";
  if (row.status === "PAUSED") return "Paused";
  return acceptsEntries ? "Entries open" : "Entries closed";
}

function infoButton(id: string, context: "info" | "dm-info" = "info") {
  return action(`gp-gw:${context}:${id}`, "Info", ButtonStyle.Secondary, "ℹ️");
}

export function entryAnnouncement(config: GiveawayConfig, row: GiveawayMessage, count: number, reference: string, acceptsEntries: boolean) {
  const ui = components(config.color);
  const deadline = unix(entryDeadline(row.endAt, config.rules));
  const timing = acceptsEntries ? `${config.rules.entryBufferMinutes > 0 ? "Entries close" : "Ends"} <t:${deadline}:R>` : statusLine(row, false);
  ui.text(`# 🎁 ${discordText(config.titleOverride || config.title)}\n**Prize:** ${discordText(config.prize)}`);
  ui.text(`-# ${timing} · Entries: ${entryCount.format(count)} · Winner slots: ${config.winnerCount}`);
  if (config.banner) ui.gallery([config.banner]);
  const buttons = [infoButton(row.id)];
  if (acceptsEntries) {
    const label = config.buttonLabel === "Teilnehmen" ? defaultGiveawayButtonLabel : config.buttonLabel;
    buttons.unshift(action(`gp-gw:join:${row.id}`, label.replace(/@(everyone|here)/gi, "@\u200b$1"), ButtonStyle.Primary, config.buttonEmoji));
    if (config.rules.withdraw) buttons.push(action(`gp-gw:leave:${row.id}`, "Withdraw", ButtonStyle.Secondary));
  }
  ui.buttons(...buttons);
  ui.text(`-# Draw commitment: ||${row.commitment}||\n-# ${reference}`);
  return ui.message();
}

export function giveawayInfo(config: GiveawayConfig, row: GiveawayMessage, options: {
  count: number; acceptsEntries: boolean; originalUrl?: string | null; resultsUrl?: string | null;
  claim?: { status: string; deadline: Date } | null;
}) {
  const ui = components(config.color);
  const title = config.titleOverride || config.title;
  ui.text(`## ${discordText(title)}\n-# ${statusLine(row, options.acceptsEntries)}`);
  ui.text([
    `**Prize:** ${discordText(config.prize)}`,
    `**Winner slots:** ${config.winnerCount} · **Entries:** ${entryCount.format(options.count)}`,
    `**Scheduled end:** <t:${unix(row.endAt)}:F>`,
    config.rules.entryBufferMinutes > 0 ? `**Entry deadline:** <t:${unix(entryDeadline(row.endAt, config.rules))}:F>` : "",
    config.sponsor ? `**Sponsor:** ${discordText(config.sponsor)}` : "",
  ].filter(Boolean).join("\n"));
  if (config.image) ui.gallery([config.image]);
  for (const text of [config.description, config.prizeDescription, config.information]) {
    if (text) ui.text(discordText(text));
  }
  const requirements = giveawayRequirements(config.rules);
  if (requirements.length || config.terms) ui.separator();
  if (requirements.length) ui.text(`**Entry requirements**\n${requirements.map(item => `• ${item}`).join("\n")}`);
  if (config.terms) ui.text(`**Rules**\n${discordText(config.terms)}`);
  if (options.claim) {
    const claimStatus: Record<string, string> = {
      PENDING: `Claim by <t:${unix(options.claim.deadline)}:F>`, CLAIMED: "Claim confirmed", FULFILLED: "Prize delivered",
      DECLINED: "Prize declined", EXPIRED: "Claim expired", CANCELLED: "Claim cancelled",
    };
    const status = options.claim.status === "PENDING" && options.claim.deadline <= new Date() ? "EXPIRED" : options.claim.status;
    if (claimStatus[status]) ui.text(`**Your prize claim:** ${claimStatus[status]}`);
  }
  const links: ButtonBuilder[] = [];
  if (options.originalUrl) links.push(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Original Giveaway").setURL(options.originalUrl));
  if (options.resultsUrl) links.push(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Results").setURL(options.resultsUrl));
  if (links.length) ui.buttons(...links);
  const footer = [config.branding, config.footer].filter(Boolean).map(text => `-# ${discordText(text)}`);
  ui.text([...footer, `-# Draw commitment (SHA-256): \`${row.commitment}\``].join("\n"));
  return ui.message();
}

export function resultsAnnouncement(config: GiveawayConfig, giveawayId: string, users: string[], newlyAnnounced: string[], reference: string, round: number) {
  const ui = components(config.color);
  ui.text(`# 🏆 ${discordText(config.title)}\n-# ${round > 1 ? "Updated results" : "Giveaway results"}`);
  ui.text(`**Prize:** ${discordText(config.prize)}\n${users.length ? `**Confirmed winners:** ${users.map(id => `<@${id}>`).join(", ")}` : "No prizes were awarded."}`);
  const buttons = [infoButton(giveawayId)];
  if (config.claimsEnabled && users.length) buttons.unshift(action(`gp-gw:public-claim:${giveawayId}`, "Claim Prize", ButtonStyle.Primary));
  ui.buttons(...buttons);
  ui.text(`-# ${reference}`);
  return { ...ui.message(), allowedMentions: { ...safeMentions, users: newlyAnnounced } };
}

export function winnerDm(config: GiveawayConfig, guildName: string, reference: string, candidateId: string,
  claim?: { token: string; deadline: Date }, extension = false) {
  const ui = components(config.color);
  ui.text(`${extension ? "# ⏰ Claim deadline extended" : "# 🎉 Congratulations!"}\n-# ${discordText(config.title)} · ${discordText(guildName)}`);
  ui.text(`**Your prize:** ${discordText(config.prize)}${claim ? `\n**Claim by:** <t:${unix(claim.deadline)}:F>` : ""}`);
  const buttons = [infoButton(candidateId, "dm-info")];
  if (claim) {
    buttons.unshift(action(`gp-gw:claim:${claim.token}`, "Claim Prize", ButtonStyle.Primary));
    buttons.push(action(`gp-gw:decline:${claim.token}`, "Decline Prize", ButtonStyle.Secondary));
  }
  ui.buttons(...buttons);
  ui.text(`-# ${reference}`);
  return ui.message();
}
