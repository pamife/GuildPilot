import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder,
  MessageCreateOptions, MessageFlags, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder,
} from "discord.js";
import { discordText } from "../../types/changelog";
import { defaultGiveawayButtonLabel, entryDeadline, GiveawayConfig, giveawayCopy, unix } from "../../types/giveaways";

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
    message(): MessageCreateOptions {
      return { flags: MessageFlags.IsComponentsV2, components: [container.toJSON()], allowedMentions: safeMentions };
    },
  };
}

function action(id: string, label: string, style: ButtonStyle.Primary | ButtonStyle.Secondary, emoji?: string) {
  const button = new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
  if (emoji) button.setEmoji(emoji);
  return button;
}

export function deliveryReference(key: string) { return `GP · ${key}`; }

export function entryAnnouncement(config: GiveawayConfig, row: {
  id: string; status: string; endAt: Date; commitment: string; publishedRound: number;
}, count: number, reference: string, acceptsEntries: boolean) {
  const ui = components(config.color);
  const { heading, lead, details, requirements } = giveawayCopy(config);
  const ends = unix(row.endAt);
  if (config.branding) ui.text(`-# 🎉 ${discordText(config.branding)}`);
  ui.text(`# 🎁 ${discordText(heading)}`);
  for (const text of lead) ui.text(discordText(text));
  const media = [...new Set([config.banner, config.image].filter(Boolean))];
  if (media.length) ui.gallery(media);
  ui.separator();
  const status = row.status === "CANCELLED" ? "Cancelled" : row.publishedRound ? "Results announced"
    : row.status === "PAUSED" ? "Paused" : acceptsEntries ? "Entries open" : "Entries closed";
  ui.text([
    `🎁 **Prize** · ${discordText(config.prize)}`,
    `🏆 **Winner slots** · ${config.winnerCount}`,
    `👥 **Entries** · ${entryCount.format(count)}`,
    `⏰ **Ends** · <t:${ends}:F> (<t:${ends}:R>)`,
    config.rules.entryBufferMinutes > 0 ? `🚪 **Entry deadline** · <t:${unix(entryDeadline(row.endAt, config.rules))}:F>` : "",
    `**${status}**`,
  ].filter(Boolean).join("\n"));
  if (requirements.length) ui.text(`**Entry requirements**\n${requirements.map(item => `• ${item}`).join("\n")}`);
  for (const text of details) ui.text(discordText(text));
  if (acceptsEntries) {
    const label = config.buttonLabel === "Teilnehmen" ? defaultGiveawayButtonLabel : config.buttonLabel;
    const buttons = [action(`gp-gw:join:${row.id}`, label.replace(/@(everyone|here)/gi, "@\u200b$1"), ButtonStyle.Primary, config.buttonEmoji)];
    if (config.rules.withdraw) buttons.push(action(`gp-gw:leave:${row.id}`, "Withdraw Entry", ButtonStyle.Secondary));
    ui.separator();
    ui.buttons(...buttons);
  }
  if (config.footer) ui.text(`-# ${discordText(config.footer)}`);
  ui.text(`-# SHA-256 · ${row.commitment}\n-# ${reference}`);
  return ui.message();
}

export function resultsAnnouncement(config: GiveawayConfig, giveawayId: string, users: string[], newlyAnnounced: string[], count: number,
  url: string | null, reference: string, round: number) {
  const ui = components(config.color);
  ui.text(round > 1 ? "-# 🎊 UPDATED WINNERS" : "-# 🎊 GIVEAWAY ENDED");
  ui.text(`# 🏆 ${discordText(config.title)}`);
  if (config.image) ui.gallery([config.image]);
  ui.separator();
  ui.text(`**🎁 Prize** · ${discordText(config.prize)}\n**👥 Entries** · ${entryCount.format(count)}\n\n**Confirmed winners**\n${users.length ? users.map(id => `• <@${id}>`).join("\n") : "No prizes were awarded."}`);
  const buttons: ButtonBuilder[] = [];
  if (config.claimsEnabled && users.length) buttons.push(action(`gp-gw:public-claim:${giveawayId}`, "Claim Prize", ButtonStyle.Primary, "🎁"));
  if (url) buttons.push(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("View Giveaway").setURL(url));
  if (buttons.length) ui.buttons(...buttons);
  ui.text(`-# ${reference}`);
  return { ...ui.message(), allowedMentions: { ...safeMentions, users: newlyAnnounced } };
}

export function winnerDm(config: GiveawayConfig, guildName: string, reference: string,
  claim?: { token: string; deadline: Date }, extension = false) {
  const ui = components(config.color);
  ui.text(extension ? "# ⏰ Your claim deadline has been extended" : "# 🎉 Congratulations!");
  ui.text(`**${discordText(config.title)}** · ${discordText(guildName)}\n🎁 **Your prize** · ${discordText(config.prize)}`);
  if (claim) {
    ui.separator();
    ui.text(`Claim your prize by <t:${unix(claim.deadline)}:F> (<t:${unix(claim.deadline)}:R>).`);
    ui.buttons(action(`gp-gw:claim:${claim.token}`, "Claim Prize", ButtonStyle.Primary),
      action(`gp-gw:decline:${claim.token}`, "Decline Prize", ButtonStyle.Secondary));
  }
  ui.text(`-# ${reference}`);
  return ui.message();
}
