import {
  Client,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextChannel,
  ChannelType,
  Interaction,
  ButtonInteraction, ModalSubmitInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, LabelBuilder,
} from "discord.js";
import { getAppPanelById, getAppFormById, updateAppPanel, updateAppForm } from "../services/applicationService";
import { noMentions, readStrings } from "../services/applicationAccess";
import { ApplicationError, requireApplicationReviewer, runApplicationReview } from "../services/applicationReview";
import { handleApplicationDmInteraction, offerApplication, setupApplicationDmMessages } from "./applicationDm";

function buildEmbedHelper(config: {
  title?: string;
  description?: string;
  color?: string;
  authorName?: string;
  authorIcon?: string;
  authorUrl?: string;
  thumbnail?: string;
  image?: string;
  footer?: string;
  footerIcon?: string;
  showTimestamp?: boolean;
  fields?: any[];
}): EmbedBuilder {
  const embed = new EmbedBuilder();

  if (config.title) embed.setTitle(config.title);
  if (config.description) embed.setDescription(config.description);
  if (config.color && config.color !== "none") embed.setColor(config.color as `#${string}`);

  if (config.authorName) {
    embed.setAuthor({
      name: config.authorName,
      iconURL: config.authorIcon || undefined,
      url: config.authorUrl || undefined,
    });
  }

  if (config.thumbnail) embed.setThumbnail(config.thumbnail);
  if (config.image) embed.setImage(config.image);

  if (config.footer) {
    embed.setFooter({
      text: config.footer,
      iconURL: config.footerIcon || undefined,
    });
  }

  if (config.showTimestamp !== false) {
    embed.setTimestamp();
  }

  if (Array.isArray(config.fields) && config.fields.length > 0) {
    config.fields.forEach((f) => {
      if (f.name && f.value) {
        embed.addFields({ name: f.name, value: f.value, inline: Boolean(f.inline) });
      }
    });
  }

  return embed;
}

function safeSetEmoji(builder: any, emojiInput?: string | null): boolean {
  return false;
}

export async function deployApplicationPanelEmbed(client: Client, panelId: string): Promise<string> {
  const panel = await getAppPanelById(panelId);
  if (!panel || !panel.channelId) throw new Error("Panel or target channel missing.");

  const channel = (await client.channels.fetch(panel.channelId).catch(() => null)) as TextChannel;
  if (!channel || channel.guild?.id !== panel.guildId || !channel.isTextBased()) throw new Error("Could not access target channel on Discord");

  let parsedFields: any[] = [];
  try {
    parsedFields = JSON.parse(panel.embedFields || "[]");
  } catch (e) {}

  const embed = buildEmbedHelper({
    title: panel.embedTitle || panel.name,
    description: panel.embedDescription || "Select an application position from the dropdown menu below to submit your application.",
    color: panel.embedColor || "#5865F2",
    authorName: panel.embedAuthorName || undefined,
    authorIcon: panel.embedAuthorIcon || undefined,
    authorUrl: panel.embedAuthorUrl || undefined,
    thumbnail: panel.thumbnail || undefined,
    image: panel.image || undefined,
    footer: panel.footer || "GuildPilot Applications System",
    footerIcon: panel.footerIcon || undefined,
    showTimestamp: panel.showTimestamp !== false,
    fields: parsedFields,
  });

  const components: any[] = [];
  const forms: any[] = panel.forms || [];

  if (forms.length > 0) {
    if (panel.displayType === "dropdown") {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`app_select_form:${panel.id}`)
        .setPlaceholder("Select an application position...");

      forms.forEach((f: any) => {
        const option = new StringSelectMenuOptionBuilder()
          .setLabel(f.name.substring(0, 100))
          .setValue(f.id)
          .setDescription((f.description || "Submit application for this position").substring(0, 100));

        const hasEmoji = safeSetEmoji(option, f.emoji) || safeSetEmoji(option, f.buttonEmoji);
        if (!hasEmoji) {
          safeSetEmoji(option, "📝");
        }

        selectMenu.addOptions(option);
      });

      components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));
    } else {
      const row = new ActionRowBuilder<ButtonBuilder>();
      forms.slice(0, 5).forEach((f: any) => {
        const btnStyle =
          f.buttonColor === "Secondary"
            ? ButtonStyle.Secondary
            : f.buttonColor === "Success"
            ? ButtonStyle.Success
            : f.buttonColor === "Danger"
            ? ButtonStyle.Danger
            : ButtonStyle.Primary;

        const button = new ButtonBuilder()
          .setCustomId(`app_apply:${f.id}`)
          .setLabel(f.name.substring(0, 80))
          .setStyle(btnStyle)
          .setDisabled(!f.isOpen);

        safeSetEmoji(button, f.emoji) || safeSetEmoji(button, f.buttonEmoji);

        row.addComponents(button);
      });

      components.push(row);
    }
  }

  let message: any = null;
  if (panel.messageId) {
    const existingMsg = await channel.messages.fetch(panel.messageId).catch(() => null);
    if (existingMsg) {
      message = await existingMsg.edit({ embeds: [embed], components, allowedMentions: noMentions });
      return existingMsg.id;
    }
  }

  if (!message) {
    message = await channel.send({ embeds: [embed], components, allowedMentions: noMentions });
  }

  await updateAppPanel(panel.id, { messageId: message.id });
  return message.id;
}

export async function deployApplicationFormEmbed(client: Client, formId: string): Promise<string> {
  const form = await getAppFormById(formId);
  if (!form) throw new Error("Application form not found");

  if (form.panelId) {
    return await deployApplicationPanelEmbed(client, form.panelId);
  }

  if (!form.channelId) throw new Error("Target channel ID is not configured for this form");

  const channel = (await client.channels.fetch(form.channelId).catch(() => null)) as TextChannel;
  if (!channel || channel.guild?.id !== form.guildId || !channel.isTextBased()) throw new Error("Could not access target channel on Discord");

  let parsedFields: any[] = [];
  try {
    parsedFields = JSON.parse(form.embedFields || "[]");
  } catch (e) {}

  const embed = buildEmbedHelper({
    title: form.embedTitle || form.name,
    description: form.embedDescription || "Click the button below to submit your application.",
    color: form.embedColor || "#5865F2",
    authorName: form.embedAuthorName || undefined,
    authorIcon: form.embedAuthorIcon || undefined,
    authorUrl: form.embedAuthorUrl || undefined,
    thumbnail: form.thumbnail || undefined,
    image: form.image || undefined,
    footer: form.footer || "GuildPilot Applications System",
    footerIcon: form.footerIcon || undefined,
    showTimestamp: form.showTimestamp !== false,
    fields: parsedFields,
  });

  const btnStyle =
    form.buttonColor === "Secondary"
      ? ButtonStyle.Secondary
      : form.buttonColor === "Success"
      ? ButtonStyle.Success
      : form.buttonColor === "Danger"
      ? ButtonStyle.Danger
      : ButtonStyle.Primary;

  const button = new ButtonBuilder()
    .setCustomId(`app_apply:${form.id}`)
    .setLabel(form.buttonText || "Apply Now")
    .setStyle(btnStyle)
    .setDisabled(!form.isOpen);

  safeSetEmoji(button, form.emoji) || safeSetEmoji(button, form.buttonEmoji);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  if (form.messageId) {
    const existingMsg = await channel.messages.fetch(form.messageId).catch(() => null);
    if (existingMsg) {
      await existingMsg.edit({ embeds: [embed], components: [row], allowedMentions: noMentions });
      return existingMsg.id;
    }
  }

  const newMsg = await channel.send({ embeds: [embed], components: [row], allowedMentions: noMentions });
  await updateAppForm(form.id, { messageId: newMsg.id });
  return newMsg.id;
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
      const response = { content, allowedMentions: noMentions, flags: interaction.inGuild() ? MessageFlags.Ephemeral as const : undefined };
      if (interaction.deferred || interaction.replied) {
        if (interaction.inGuild() && /^app_(apply|select_form|dm|review|ctrl|modal):/.test(interaction.customId)) {
          await interaction.editReply({ content, components: [], allowedMentions: noMentions }).catch(console.error);
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
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder()
        .setCustomId(key).setLabel(label).setStyle(style).setRequired(required).setMaxLength(max));
    if (action === "dm") {
      modal.addComponents(input("message", "Message to the applicant", true, 1500, TextInputStyle.Paragraph),
        input("reply", "Require a reply? (yes or no)", false, 3));
    } else if (action === "progress") {
      const steps = readStrings(app.form?.statusSteps);
      if (steps.length) {
        modal.addComponents(new LabelBuilder().setLabel("Status step").setStringSelectMenuComponent(
          new StringSelectMenuBuilder().setCustomId("step_select").setRequired(true).addOptions(
            steps.map(step => ({ label: step, value: step, default: step === app.progressStep })),
          ),
        ));
      } else modal.addComponents(input("step", "Status step", true, 100));
      modal.addComponents(input("percent", "Progress (0 to 100)", true, 3));
    } else modal.addComponents(input("reason", "Decision reason (optional)", false, 1500, TextInputStyle.Paragraph));
    await interaction.showModal(modal);
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  let input: Parameters<typeof runApplicationReview>[3] = { action };
  if (interaction.isModalSubmit()) {
    const fields = interaction.fields;
    if (action === "dm") {
      const reply = fields.getTextInputValue("reply").trim().toLowerCase();
      if (reply && reply !== "yes" && reply !== "no") throw new ApplicationError("Enter yes or no to request a reply.");
      input = { action, message: fields.getTextInputValue("message"), replyRequested: reply === "yes" };
    } else if (action === "progress") {
      const step = fields.fields.has("step_select")
        ? fields.getStringSelectValues("step_select")[0] : fields.getTextInputValue("step");
      input = { action, step, percent: fields.getTextInputValue("percent") };
    } else if (action === "accept" || action === "deny") {
      input = { action, reason: fields.getTextInputValue("reason") };
    } else throw new ApplicationError("Unknown review action.");
  }
  const result = await runApplicationReview(guildId, id, interaction.user.id, input, channelId ?? undefined);
  await interaction.editReply({
    content: [result.ticketUrl ? `Ticket: ${result.ticketUrl}` : "Application updated.", ...result.warnings].join("\n"),
    allowedMentions: noMentions,
  });
}
