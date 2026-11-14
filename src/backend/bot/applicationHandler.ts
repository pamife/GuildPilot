import {
  Client,
  CheckboxBuilder, ContainerBuilder, MediaGalleryBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  Interaction,
  InteractionReplyOptions,
  ButtonInteraction, ModalSubmitInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, LabelBuilder,
} from "discord.js";
import { getAppPanelById, getAppFormById, updateAppPanel, updateAppForm } from "../services/applicationService";
import { readStrings } from "../services/applicationAccess";
import { ApplicationError, appRow, requireApplicationReviewer, runApplicationReview, unknownDiscordMessage } from "../services/applicationReview";
import { handleApplicationDmInteraction, offerApplication, setupApplicationDmMessages } from "./applicationDm";

import { ApplicationActionRow, applicationMessage, applicationMessageEdit } from "./applicationComponents";
import { parseAndValidateEmoji } from "../utils/emojiValidator";

type PanelLayout = Pick<NonNullable<Awaited<ReturnType<typeof getAppPanelById>>>,
  "embedTitle" | "embedDescription" | "embedColor" | "embedAuthorName" | "embedAuthorUrl" |
  "embedAuthorIcon" | "thumbnail" | "image" | "footer" | "footerIcon" | "showTimestamp" | "embedFields" | "name">;

function addPanelText(container: ContainerBuilder, content: string, icon?: string | null) {
  const text = new TextDisplayBuilder().setContent(content);
  if (icon && /^https?:\/\//i.test(icon)) {
    container.addSectionComponents(new SectionBuilder().addTextDisplayComponents(text)
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(icon)));
  } else container.addTextDisplayComponents(text);
}

function panelContainer(panel: PanelLayout, fallback: string) {
  const container = new ContainerBuilder();
  if (/^#[a-f0-9]{6}$/i.test(panel.embedColor)) container.setAccentColor(Number.parseInt(panel.embedColor.slice(1), 16));
  const author = panel.embedAuthorName?.slice(0, 256);
  const authorText = author && panel.embedAuthorUrl && /^https?:\/\//i.test(panel.embedAuthorUrl)
    ? `[${author}](<${panel.embedAuthorUrl}>)` : author;
  if (authorText) addPanelText(container, authorText, panel.embedAuthorIcon);
  addPanelText(container, `## ${(panel.embedTitle || panel.name).slice(0, 256)}`, panel.thumbnail);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent((panel.embedDescription || fallback).slice(0, 4000)));
  let fields: unknown;
  try { fields = JSON.parse(panel.embedFields); } catch { fields = []; }
  if (Array.isArray(fields)) {
    const text = fields.filter(field => typeof field?.name === "string" && typeof field?.value === "string")
      .map(field => `**${field.name}**\n${field.value}`).join("\n\n");
    if (text) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text.slice(0, 4000)));
  }
  if (panel.image && /^https?:\/\//i.test(panel.image)) {
    container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(item => item.setURL(panel.image!)));
  }
  const footer = [panel.footer, panel.showTimestamp ? `<t:${Math.floor(Date.now() / 1000)}:f>` : ""].filter(Boolean).join(" · ");
  if (footer) addPanelText(container, `-# ${footer.slice(0, 2000)}`, panel.footerIcon);
  return container;
}

type FormPanelButton = { id: string; label: string; buttonColor: string; isOpen: boolean; emoji?: string | null };

function formButton(form: FormPanelButton) {
  const style = form.buttonColor === "Secondary" ? ButtonStyle.Secondary
    : form.buttonColor === "Success" ? ButtonStyle.Success
    : form.buttonColor === "Danger" ? ButtonStyle.Danger : ButtonStyle.Primary;
  const button = new ButtonBuilder().setCustomId(`app_apply:${form.id}`)
    .setLabel(form.label.slice(0, 80)).setStyle(style).setDisabled(!form.isOpen);
  const emoji = parseAndValidateEmoji(form.emoji ?? undefined);
  if (emoji) button.setEmoji(emoji);
  return button;
}

async function publishPanel(client: Client, panel: PanelLayout & { guildId: string; channelId: string | null; messageId: string | null },
  fallback: string, rows: ApplicationActionRow[]) {
  if (!panel.channelId) throw new Error("Panel target channel is missing.");
  const channel = await client.channels.fetch(panel.channelId);
  if (!channel || channel.isDMBased() || !channel.isSendable() || channel.guildId !== panel.guildId) {
    throw new Error("Could not access target channel on Discord.");
  }
  if (panel.messageId) {
    try {
      const existing = await channel.messages.fetch(panel.messageId);
      return await existing.edit(applicationMessageEdit(existing, panelContainer(panel, fallback), rows));
    } catch (error) {
      if (!unknownDiscordMessage(error)) throw error;
    }
  }
  return channel.send(applicationMessage(panelContainer(panel, fallback), rows));
}

export async function deployApplicationPanel(client: Client, panelId: string): Promise<string> {
  const panel = await getAppPanelById(panelId);
  if (!panel) throw new Error("Application panel not found.");
  const rows: ApplicationActionRow[] = [];
  if (panel.displayType === "dropdown") {
    for (let start = 0; start < Math.min(panel.forms.length, 125); start += 25) {
      const menu = new StringSelectMenuBuilder()
        .setCustomId(start ? `app_select_form:${panel.id}:${start}` : `app_select_form:${panel.id}`)
        .setPlaceholder("Select an application position…");
      for (const form of panel.forms.slice(start, start + 25)) {
        const option = new StringSelectMenuOptionBuilder().setLabel(form.name.slice(0, 100)).setValue(form.id)
          .setDescription((form.description || "Submit application for this position").slice(0, 100));
        const emoji = parseAndValidateEmoji(form.emoji || form.buttonEmoji || "📝");
        if (emoji) option.setEmoji(emoji);
        menu.addOptions(option);
      }
      rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
    }
  } else {
    // Leave room for the title, author and footer sections with thumbnail accessories.
    for (let start = 0; start < Math.min(panel.forms.length, 20); start += 5) {
      rows.push(appRow(...panel.forms.slice(start, start + 5).map(form => formButton({
        ...form, label: form.name, emoji: form.emoji || form.buttonEmoji,
      }))));
    }
  }
  const message = await publishPanel(client, panel, "Select an application position below.", rows);
  await updateAppPanel(panel.id, { messageId: message.id });
  return message.id;
}

export async function deployApplicationForm(client: Client, formId: string): Promise<string> {
  const form = await getAppFormById(formId);
  if (!form) throw new Error("Application form not found.");
  if (form.panelId) return deployApplicationPanel(client, form.panelId);
  const row = appRow(formButton({ ...form, label: form.buttonText || "Apply Now", emoji: form.emoji || form.buttonEmoji }));
  const message = await publishPanel(client, form, "Apply by direct message.", [row]);
  await updateAppForm(form.id, { messageId: message.id });
  return message.id;
}

const reviewLabels: Record<string, string> = {
  dm: "Send DM", accept: "Confirm acceptance", deny: "Confirm decline", progress: "Update status",
};

export function setupApplicationInteractions(client: Client) {
  setupApplicationDmMessages(client);
  client.on("interactionCreate", async (interaction: Interaction) => {
    try {
      if (interaction.isButton() && /^app_(dm|draft):/.test(interaction.customId)) {
        await handleApplicationDmInteraction(interaction);
      } else if (interaction.isStringSelectMenu() && interaction.customId.startsWith("app_select_form:")) {
        await offerApplication(interaction, interaction.values[0]);
      } else if (interaction.isButton() && interaction.customId.startsWith("app_apply:")) {
        await offerApplication(interaction, interaction.customId.split(":")[1]);
      } else if ((interaction.isButton() || interaction.isModalSubmit()) && /^app_(ctrl|review|modal):/.test(interaction.customId)) {
        await handleReviewInteraction(interaction);
      }
    } catch (error) {
      const content = error instanceof ApplicationError ? error.message : "The application action failed. Try again.";
      if (!(error instanceof ApplicationError)) console.error("[Applications] Interaction failed:", error);
      if (!(interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit())) return;
      const response: InteractionReplyOptions = { ...applicationMessage(content), flags: interaction.inGuild()
        ? [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral] : [MessageFlags.IsComponentsV2] };
      if (interaction.deferred || interaction.replied) {
        if (interaction.inGuild() && /^app_(apply|select_form|dm|review|ctrl|modal):/.test(interaction.customId)) {
          await interaction.editReply(applicationMessageEdit(interaction.webhook, content)).catch(console.error);
        } else {
          await interaction.followUp(response).catch(console.error);
        }
      } else await interaction.reply(response).catch(console.error);
    }
  });
}

async function handleReviewInteraction(interaction: ButtonInteraction | ModalSubmitInteraction) {
  if (!interaction.inGuild()) return;
  const [, action, id] = interaction.customId.split(":");
  const guildId = interaction.guildId;
  const channelId = interaction.channelId;
  if (interaction.isButton() && Object.hasOwn(reviewLabels, action)) {
    const { app } = await requireApplicationReviewer(guildId, id, interaction.user.id);
    if (![app.reviewChannelId, app.channelId, app.form?.targetChannelId].includes(channelId)) {
      throw new ApplicationError("This application is associated with a different channel.", 403);
    }
    const modal = new ModalBuilder().setCustomId(`app_modal:${action}:${id}`).setTitle(reviewLabels[action]);
    const input = (key: string, label: string, required: boolean, max: number, style = TextInputStyle.Short) =>
      new LabelBuilder().setLabel(label).setTextInputComponent(new TextInputBuilder()
        .setCustomId(key).setStyle(style).setRequired(required).setMaxLength(max));
    if (action === "dm") {
      modal.addLabelComponents(input("message", "Message to the applicant", true, 1500, TextInputStyle.Paragraph),
        new LabelBuilder().setLabel("Request a reply").setCheckboxComponent(new CheckboxBuilder().setCustomId("reply_requested")));
    } else if (action === "progress") {
      const steps = readStrings(app.form?.statusSteps);
      if (steps.length) {
        modal.addLabelComponents(new LabelBuilder().setLabel("Status step").setStringSelectMenuComponent(
          new StringSelectMenuBuilder().setCustomId("step_select").setRequired(true).addOptions(
            steps.map(step => ({ label: step, value: step, default: step === app.progressStep })),
          ),
        ));
      } else modal.addLabelComponents(input("step", "Status step", true, 100));
      modal.addLabelComponents(input("percent", "Progress (0 to 100)", true, 3));
    } else modal.addLabelComponents(input("reason", "Decision reason (optional)", false, 1500, TextInputStyle.Paragraph));
    await interaction.showModal(modal);
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  let input: Parameters<typeof runApplicationReview>[3] = { action };
  if (interaction.isModalSubmit()) {
    const fields = interaction.fields;
    if (action === "dm") {
      const replyRequested = fields.fields.has("reply_requested")
        ? fields.getCheckbox("reply_requested") : fields.getTextInputValue("reply").trim().toLowerCase() === "yes";
      input = { action, message: fields.getTextInputValue("message"), replyRequested };
    } else if (action === "progress") {
      const step = fields.fields.has("step_select")
        ? fields.getStringSelectValues("step_select")[0] : fields.getTextInputValue("step");
      input = { action, step, percent: fields.getTextInputValue("percent") };
    } else if (action === "accept" || action === "deny") {
      input = { action, reason: fields.getTextInputValue("reason") };
    } else throw new ApplicationError("Unknown review action.");
  }
  const result = await runApplicationReview(guildId, id, interaction.user.id, input, channelId ?? undefined);
  await interaction.editReply(applicationMessageEdit(interaction.webhook,
    [result.ticketUrl ? "The private ticket is open." : "Application updated.", ...result.warnings].join("\n"),
    result.ticketUrl ? [appRow(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Open ticket").setURL(result.ticketUrl))] : [],
  ));
}
