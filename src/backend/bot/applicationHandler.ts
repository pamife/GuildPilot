import {
  Client,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  TextChannel,
  ChannelType,
  PermissionFlagsBits,
  Interaction,
  GuildMember,
} from "discord.js";
import {
  getAppFormById,
  getAppForms,
  checkUserCanApply,
  createApplicationSubmission,
  updateApplicationStatus,
  getApplicationById,
  addApplicationNote,
  getApplicationSettings,
} from "../services/applicationService";
import { generateApplicationHtmlTranscript } from "../services/transcriptService";
import { broadcastEvent } from "../socket/socketManager";

export async function deployApplicationFormEmbed(client: Client, formId: string): Promise<string> {
  const form = await getAppFormById(formId);
  if (!form) throw new Error("Application form not found");
  if (!form.channelId) throw new Error("Target channel ID is not configured for this form");

  const channel = (await client.channels.fetch(form.channelId).catch(() => null)) as TextChannel;
  if (!channel || !channel.isTextBased()) throw new Error("Could not access target channel on Discord");

  // Fetch all forms associated with this channel to build dropdown menu
  const allFormsInChannel = await getAppForms(form.guildId);
  const channelForms = allFormsInChannel.filter((f) => f.channelId === form.channelId && f.isOpen);

  const embed = new EmbedBuilder()
    .setTitle(form.embedTitle || form.name)
    .setDescription(form.embedDescription || "Select an application position from the dropdown menu below to submit your application.")
    .setColor((form.embedColor as any) || "#5865F2");

  if (form.thumbnail) embed.setThumbnail(form.thumbnail);
  if (form.image) embed.setImage(form.image);
  if (form.footer) embed.setFooter({ text: form.footer });

  const components: any[] = [];

  // Dropdown Select Menu Mode (like Ticket System reasons/dropdown)
  if (form.displayType === "dropdown" || channelForms.length > 1) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`app_select_form:${form.id}`)
      .setPlaceholder("Select an application position...");

    const formsToInclude = channelForms.length > 0 ? channelForms : [form];

    formsToInclude.forEach((f) => {
      const option = new StringSelectMenuOptionBuilder()
        .setLabel(f.name.substring(0, 100))
        .setValue(f.id)
        .setDescription((f.description || "Submit application for this position").substring(0, 100));

      if (f.buttonEmoji) option.setEmoji(f.buttonEmoji);
      selectMenu.addOptions(option);
    });

    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));
  } else {
    // Single Button Mode
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

    if (form.buttonEmoji) button.setEmoji(form.buttonEmoji);

    components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(button));
  }

  if (form.messageId) {
    const existingMsg = await channel.messages.fetch(form.messageId).catch(() => null);
    if (existingMsg) {
      await existingMsg.edit({ embeds: [embed], components });
      return existingMsg.id;
    }
  }

  const newMsg = await channel.send({ embeds: [embed], components });
  return newMsg.id;
}

export function setupApplicationInteractions(client: Client) {
  client.on("interactionCreate", async (interaction: Interaction) => {
    try {
      // 1. Handle Dropdown Select Menu Selection (like Ticket System dropdown)
      if (interaction.isStringSelectMenu() && interaction.customId.startsWith("app_select_form:")) {
        const selectedFormId = interaction.values[0];
        await triggerApplicationModal(interaction, selectedFormId);
      }

      // 2. Handle Apply Button Click
      if (interaction.isButton() && interaction.customId.startsWith("app_apply:")) {
        const formId = interaction.customId.split(":")[1];
        await triggerApplicationModal(interaction, formId);
      }

      // 3. Handle Modal Submission
      if (interaction.isModalSubmit() && interaction.customId.startsWith("app_modal_submit:")) {
        await interaction.deferReply({ ephemeral: true });
        const formId = interaction.customId.split(":")[1];
        const form = await getAppFormById(formId);
        if (!form) return interaction.editReply({ content: "❌ Application form not found." });

        const member = interaction.member as GuildMember;
        const accountAge = interaction.user.createdAt.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
        const joinDate = member?.joinedAt
          ? member.joinedAt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
          : "Unknown";

        const currentRoles = member?.roles?.cache?.map((r) => r.name).filter((n) => n !== "@everyone") || [];

        // Extract answers
        const answers: any[] = [];
        form.questions.slice(0, 5).forEach((q) => {
          const value = interaction.fields.getTextInputValue(`q_${q.id}`);
          answers.push({
            questionId: q.id,
            questionLabel: q.label,
            questionType: q.type,
            value: value || "N/A",
          });
        });

        // Save to DB
        const app = await createApplicationSubmission({
          guildId: interaction.guildId!,
          formId: form.id,
          userId: interaction.user.id,
          userTag: interaction.user.tag,
          userAvatar: interaction.user.displayAvatarURL(),
          accountAge,
          joinDate,
          currentRoles,
          answers,
        });

        // Create Application Channel or send to Target Review Channel
        let channelId: string | null = null;
        const guild = interaction.guild!;
        const settings = await getApplicationSettings(interaction.guildId!);
        const targetCatId = form.categoryId || settings.defaultCategoryId;

        if (targetCatId) {
          try {
            const chName = `app-${app.appNumber}-${interaction.user.username.substring(0, 10)}`;
            const newChannel = await guild.channels.create({
              name: chName,
              type: ChannelType.GuildText,
              parent: targetCatId,
              permissionOverwrites: [
                {
                  id: guild.id,
                  deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                  id: interaction.user.id,
                  allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                },
              ],
            });

            channelId = newChannel.id;

            // Send Welcome Embed + Application Review Embed in Channel
            await postApplicationChannelWelcome(newChannel, app, form);
          } catch (chErr) {
            console.warn("[App System] Application channel creation error:", chErr);
          }
        } else if (form.targetChannelId) {
          const targetCh = (await guild.channels.fetch(form.targetChannelId).catch(() => null)) as TextChannel;
          if (targetCh && targetCh.isTextBased()) {
            await postApplicationChannelWelcome(targetCh, app, form);
          }
        }

        if (channelId) {
          await updateApplicationStatus(app.id, "PENDING", { id: app.userId, tag: app.userTag }, { channelId });
        }

        // Broadcast Socket.IO event for live dashboard update
        broadcastEvent("applicationSubmitted", { guildId: app.guildId, appId: app.id, appNumber: app.appNumber });

        // DM Applicant confirmation
        try {
          await interaction.user.send(
            `✅ **Application Submitted!** Your application for **${form.name}** has been received (App #${app.appNumber}). Staff will review it shortly.`
          );
        } catch (dmErr) {}

        await interaction.editReply({
          content: `✅ **Application Submitted Successfully!** (App #${app.appNumber}). Staff have been notified.`,
        });
      }

      // 4. Handle In-Channel Reviewer Control Buttons
      if (interaction.isButton() && interaction.customId.startsWith("app_ctrl:")) {
        const parts = interaction.customId.split(":");
        const action = parts[1];
        const appId = parts[2];

        const app = await getApplicationById(appId);
        if (!app) return interaction.reply({ content: "❌ Application not found.", ephemeral: true });

        const executor = {
          id: interaction.user.id,
          tag: interaction.user.tag,
          avatar: interaction.user.displayAvatarURL(),
        };

        if (action === "claim") {
          await updateApplicationStatus(appId, "CLAIMED", executor);
          await interaction.reply({ content: `📌 Application #${app.appNumber} claimed by ${interaction.user.tag}` });
        } else if (action === "accept") {
          await updateApplicationStatus(appId, "ACCEPTED", executor, { reason: "Approved via Discord Channel Controls" });
          await interaction.reply({ content: `✅ **Application #${app.appNumber} ACCEPTED** by ${interaction.user.tag}` });
          const user = await client.users.fetch(app.userId).catch(() => null);
          if (user) await user.send(`🎉 **Congratulations!** Your application #${app.appNumber} for **${app.form?.name || "Server"}** was **ACCEPTED**!`).catch(() => null);
        } else if (action === "deny") {
          await updateApplicationStatus(appId, "DENIED", executor, { reason: "Denied via Discord Channel Controls" });
          await interaction.reply({ content: `❌ **Application #${app.appNumber} DENIED** by ${interaction.user.tag}` });
          const user = await client.users.fetch(app.userId).catch(() => null);
          if (user) await user.send(`❌ Your application #${app.appNumber} for **${app.form?.name || "Server"}** was **DENIED**.`).catch(() => null);
        } else if (action === "waitlist") {
          await updateApplicationStatus(appId, "WAITLISTED", executor);
          await interaction.reply({ content: `⏳ Application #${app.appNumber} placed on **WAITLIST** by ${interaction.user.tag}` });
        } else if (action === "close") {
          const ch = interaction.channel as TextChannel;
          const filePath = await generateApplicationHtmlTranscript(app, ch);
          const transcriptUrl = `/api/guilds/${app.guildId}/applications/transcripts/${app.id}/download`;
          await updateApplicationStatus(appId, "CLOSED", executor, { transcriptUrl });

          await interaction.reply({ content: `🔒 Application closed. HTML Transcript: [Download](${transcriptUrl})` });
        } else if (action === "transcript") {
          const ch = interaction.channel as TextChannel;
          const filePath = await generateApplicationHtmlTranscript(app, ch);
          const transcriptUrl = `/api/guilds/${app.guildId}/applications/transcripts/${app.id}/download`;
          await interaction.reply({ content: `📄 **HTML Transcript Ready**: [View/Download](${transcriptUrl})`, ephemeral: true });
        }

        broadcastEvent("applicationUpdated", { guildId: app.guildId, appId: app.id });
      }
    } catch (err: any) {
      console.error("[Application Handler] Interaction error:", err);
    }
  });
}

async function triggerApplicationModal(interaction: any, formId: string) {
  const form = await getAppFormById(formId);
  if (!form) {
    return interaction.reply({ content: "❌ This application form no longer exists.", ephemeral: true });
  }

  const canApplyResult = await checkUserCanApply(interaction.guildId!, formId, interaction.user.id);
  if (!canApplyResult.canApply) {
    return interaction.reply({ content: `❌ ${canApplyResult.reason}`, ephemeral: true });
  }

  if (!form.questions || form.questions.length === 0) {
    return interaction.reply({
      content: "⚠️ No intake questions have been configured for this form yet.",
      ephemeral: true,
    });
  }

  const questionsToPresent = form.questions.slice(0, 5);

  const modal = new ModalBuilder()
    .setCustomId(`app_modal_submit:${form.id}`)
    .setTitle(form.name.substring(0, 45));

  const rows: ActionRowBuilder<TextInputBuilder>[] = [];

  questionsToPresent.forEach((q) => {
    const style = q.type === "PARAGRAPH" ? TextInputStyle.Paragraph : TextInputStyle.Short;

    const textInput = new TextInputBuilder()
      .setCustomId(`q_${q.id}`)
      .setLabel(q.label.substring(0, 45))
      .setStyle(style)
      .setRequired(q.required);

    if (q.placeholder) textInput.setPlaceholder(q.placeholder.substring(0, 100));
    if (q.minLength) textInput.setMinLength(q.minLength);
    if (q.maxLength) textInput.setMaxLength(q.maxLength);

    rows.push(new ActionRowBuilder<TextInputBuilder>().addComponents(textInput));
  });

  modal.addComponents(...rows);
  await interaction.showModal(modal);
}

async function postApplicationChannelWelcome(channel: TextChannel, app: any, form: any) {
  // Welcome Embed (like Ticket System Welcome Embed)
  const welcomeEmbed = new EmbedBuilder()
    .setTitle(form.welcomeTitle || `👋 Application #${app.appNumber} — ${form.name}`)
    .setDescription(form.welcomeDescription || `Welcome <@${app.userId}>! Reviewers will inspect your answers shortly.`)
    .setColor((form.welcomeColor as any) || "#5865F2");

  if (form.welcomeThumbnail) welcomeEmbed.setThumbnail(form.welcomeThumbnail);
  if (form.welcomeImage) welcomeEmbed.setImage(form.welcomeImage);
  if (form.welcomeFooter) welcomeEmbed.setFooter({ text: form.welcomeFooter });

  const answersFields = app.answers.map((a: any) => ({
    name: `❓ ${a.questionLabel}`,
    value: a.value.substring(0, 1024),
  }));

  const detailsEmbed = new EmbedBuilder()
    .setTitle(`📋 Applicant Information & Details`)
    .setDescription(`Submitted by **${app.userTag}** (<@${app.userId}>)`)
    .setColor("#5865F2")
    .addFields(
      { name: "👤 Applicant ID", value: app.userId, inline: true },
      { name: "📅 Account Created", value: app.accountAge || "N/A", inline: true },
      { name: "📥 Server Joined", value: app.joinDate || "N/A", inline: true },
      ...answersFields
    )
    .setFooter({ text: `GuildPilot Applications System • Status: PENDING` })
    .setTimestamp();

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`app_ctrl:claim:${app.id}`).setLabel("Claim").setStyle(ButtonStyle.Primary).setEmoji("📌"),
    new ButtonBuilder().setCustomId(`app_ctrl:accept:${app.id}`).setLabel("Accept").setStyle(ButtonStyle.Success).setEmoji("✅"),
    new ButtonBuilder().setCustomId(`app_ctrl:deny:${app.id}`).setLabel("Deny").setStyle(ButtonStyle.Danger).setEmoji("❌"),
    new ButtonBuilder().setCustomId(`app_ctrl:waitlist:${app.id}`).setLabel("Waitlist").setStyle(ButtonStyle.Secondary).setEmoji("⏳"),
    new ButtonBuilder().setCustomId(`app_ctrl:close:${app.id}`).setLabel("Close").setStyle(ButtonStyle.Secondary).setEmoji("🔒")
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`app_ctrl:transcript:${app.id}`).setLabel("Transcript").setStyle(ButtonStyle.Secondary).setEmoji("📄")
  );

  await channel.send({ embeds: [welcomeEmbed, detailsEmbed], components: [row1, row2] });
}
