import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder,
  MessageCreateOptions, MessageFlags, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder,
} from "discord.js";
import { discordText } from "../../types/changelog";
import { entryDeadline, GiveawayConfig, giveawayCopy, unix } from "../../types/giveaways";

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
  const status = row.status === "CANCELLED" ? "Abgesagt" : row.publishedRound ? "Ergebnis veröffentlicht"
    : row.status === "PAUSED" ? "Pausiert" : acceptsEntries ? "Teilnahme offen" : "Teilnahme geschlossen";
  ui.text([
    `🎁 **Preis** · ${discordText(config.prize)}`,
    `🏆 **Gewinnerplätze** · ${config.winnerCount}`,
    `👥 **Teilnahmen** · ${count.toLocaleString("de")}`,
    `⏰ **Ende** · <t:${ends}:F> (<t:${ends}:R>)`,
    config.rules.entryBufferMinutes > 0 ? `🚪 **Teilnahmeschluss** · <t:${unix(entryDeadline(row.endAt, config.rules))}:F>` : "",
    `**${status}**`,
  ].filter(Boolean).join("\n"));
  if (requirements.length) ui.text(`**Teilnahmebedingungen**\n${requirements.map(item => `• ${item}`).join("\n")}`);
  for (const text of details) ui.text(discordText(text));
  if (acceptsEntries) {
    const buttons = [action(`gp-gw:join:${row.id}`, config.buttonLabel.replace(/@(everyone|here)/gi, "@\u200b$1"), ButtonStyle.Primary, config.buttonEmoji)];
    if (config.rules.withdraw) buttons.push(action(`gp-gw:leave:${row.id}`, "Teilnahme zurückziehen", ButtonStyle.Secondary));
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
  ui.text(round > 1 ? "-# 🎊 AKTUALISIERTE GEWINNERLISTE" : "-# 🎊 GIVEAWAY BEENDET");
  ui.text(`# 🏆 ${discordText(config.title)}`);
  if (config.image) ui.gallery([config.image]);
  ui.separator();
  ui.text(`**🎁 Preis** · ${discordText(config.prize)}\n**👥 Teilnahmen** · ${count.toLocaleString("de")}\n\n**Bestätigte Gewinner**\n${users.length ? users.map(id => `• <@${id}>`).join("\n") : "Es konnte kein Gewinn vergeben werden."}`);
  const buttons: ButtonBuilder[] = [];
  if (config.claimsEnabled && users.length) buttons.push(action(`gp-gw:public-claim:${giveawayId}`, "Preis abholen", ButtonStyle.Primary, "🎁"));
  if (url) buttons.push(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Zum Giveaway").setURL(url));
  if (buttons.length) ui.buttons(...buttons);
  ui.text(`-# ${reference}`);
  return { ...ui.message(), allowedMentions: { ...safeMentions, users: newlyAnnounced } };
}

export function winnerDm(config: GiveawayConfig, guildName: string, reference: string,
  claim?: { token: string; deadline: Date }, extension = false) {
  const ui = components(config.color);
  ui.text(extension ? "# ⏰ Deine Abholfrist wurde verlängert" : "# 🎉 Herzlichen Glückwunsch!");
  ui.text(`**${discordText(config.title)}** · ${discordText(guildName)}\n🎁 **Dein Preis** · ${discordText(config.prize)}`);
  if (claim) {
    ui.separator();
    ui.text(`Hole deinen Preis bis <t:${unix(claim.deadline)}:F> (<t:${unix(claim.deadline)}:R>) ab.`);
    ui.buttons(action(`gp-gw:claim:${claim.token}`, "Preis abholen", ButtonStyle.Primary),
      action(`gp-gw:decline:${claim.token}`, "Preis ablehnen", ButtonStyle.Secondary));
  }
  ui.text(`-# ${reference}`);
  return ui.message();
}
