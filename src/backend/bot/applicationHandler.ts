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
  PermissionFlagsBits,
  Interaction,
  Message,
} from "discord.js";
import {
  getAppPanelById,
  getAppFormById,
  checkUserCanApply,
  createApplicationSubmission,
  updateApplicationStatus,
  getApplicationById,
  getApplicationSettings,
  updateAppPanel,
  updateAppForm,
  getAppIntakeSession,
  createOrUpdateAppIntakeSession,
  deleteAppIntakeSession,
} from "../services/applicationService";
import { generateApplicationHtmlTranscript } from "../services/transcriptService";
import { broadcastEvent } from "../socket/socketManager";
import { parseAndValidateEmoji } from "../utils/emojiValidator";

function replacePlaceholders(text: string, app: any, form: any, reason?: string): string {
  if (!text) return "";
  return text
    .replace(/{user}/g, `<@${app.userId}>`)
    .replace(/{user_id}/g, app.userId)
    .replace(/{username}/g, app.userTag)
    .replace(/{form_name}/g, form?.name || "Application")
    .replace(/{app_number}/g, String(app.appNumber))
    .replace(/{reason}/g, reason || "No reason specified.");
}

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
  if (config.color) embed.setColor((config.color as any) || "#5865F2");

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
  const valid = parseAndValidateEmoji(emojiInput);
  if (!valid) return false;

  try {
    builder.setEmoji(valid);
    return true;
  } catch (err) {
    console.warn(`[App System] Skipping invalid emoji input: "${emojiInput}"`);
    return false;
  }
}

export async function deployApplicationPanelEmbed(client: Client, panelId: string): Promise<string> {
  const panel = await getAppPanelById(panelId);
  if (!panel || !panel.channelId) throw new Error("Panel or target channel missing.");

  const channel = (await client.channels.fetch(panel.channelId).catch(() => null)) as TextChannel;
  if (!channel || !channel.isTextBased()) throw new Error("Could not access target channel on Discord");

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
      message = await existingMsg.edit({ embeds: [embed], components });
      return existingMsg.id;
    }
  }

  if (!message) {
    message = await channel.send({ embeds: [embed], components });
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
  if (!channel || !channel.isTextBased()) throw new Error("Could not access target channel on Discord");

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
      await existingMsg.edit({ embeds: [embed], components: [row] });
      return existingMsg.id;
    }
  }

  const newMsg = await channel.send({ embeds: [embed], components: [row] });
  await updateAppForm(form.id, { messageId: newMsg.id });
  return newMsg.id;
}

export function setupApplicationInteractions(client: Client) {
  // 1. Interaction Listener (Dropdown Select Menu & Apply Buttons)
  client.on("interactionCreate", async (interaction: Interaction) => {
    try {
      if (interaction.isStringSelectMenu() && interaction.customId.startsWith("app_select_form:")) {
        const selectedFormId = interaction.values[0];
        await handleApplicationStartViaDM(interaction, selectedFormId);
      }

      if (interaction.isButton() && interaction.customId.startsWith("app_apply:")) {
        const formId = interaction.customId.split(":")[1];
        await handleApplicationStartViaDM(interaction, formId);
      }

      // Reviewer Control Buttons (Claim, Accept, Deny, Waitlist, Close, Transcript)
      if (interaction.isButton() && interaction.customId.startsWith("app_ctrl:")) {
        const parts = interaction.customId.split(":");
        const action = parts[1];
        const appId = parts[2];

        const app = await getApplicationById(appId);
        if (!app) return interaction.reply({ content: "❌ Application not found.", ephemeral: true });

        const form: any = (app as any).form || {};
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
          if (user) {
            const acceptMsgText = replacePlaceholders(
              form.acceptMessage || "🎉 Congratulations {user}! Your application for {form_name} (App #{app_number}) was ACCEPTED!",
              app,
              form
            );
            const acceptEmbed = buildEmbedHelper({
              title: replacePlaceholders(form.acceptEmbedTitle || "🎉 Application Accepted!", app, form),
              description: replacePlaceholders(form.acceptEmbedDescription || "Congratulations! Your application has been accepted by our staff team.", app, form),
              color: form.acceptEmbedColor || "#23A55A",
              showTimestamp: true,
            });

            await user.send({ content: acceptMsgText, embeds: [acceptEmbed] }).catch(() => null);
          }
        } else if (action === "deny") {
          await updateApplicationStatus(appId, "DENIED", executor, { reason: "Denied via Discord Channel Controls" });
          await interaction.reply({ content: `❌ **Application #${app.appNumber} DENIED** by ${interaction.user.tag}` });

          const user = await client.users.fetch(app.userId).catch(() => null);
          if (user) {
            const denyMsgText = replacePlaceholders(
              form.denyMessage || "❌ Hello {user}, your application for {form_name} (App #{app_number}) was DENIED.",
              app,
              form
            );
            const denyEmbed = buildEmbedHelper({
              title: replacePlaceholders(form.denyEmbedTitle || "❌ Application Decision", app, form),
              description: replacePlaceholders(form.denyEmbedDescription || "Thank you for applying. Unfortunately, your application was not accepted at this time.", app, form),
              color: form.denyEmbedColor || "#F23F43",
              showTimestamp: true,
            });

            await user.send({ content: denyMsgText, embeds: [denyEmbed] }).catch(() => null);
          }
        } else if (action === "waitlist") {
          await updateApplicationStatus(appId, "WAITLISTED", executor);
          await interaction.reply({ content: `⏳ Application #${app.appNumber} placed on **WAITLIST** by ${interaction.user.tag}` });

          const user = await client.users.fetch(app.userId).catch(() => null);
          if (user) {
            const waitlistMsgText = replacePlaceholders(
              form.waitlistMessage || "⏳ Hello {user}, your application for {form_name} (App #{app_number}) was placed on WAITLIST.",
              app,
              form
            );
            const waitlistEmbed = buildEmbedHelper({
              title: replacePlaceholders(form.waitlistEmbedTitle || "⏳ Application Waitlisted", app, form),
              description: replacePlaceholders(form.waitlistEmbedDescription || "Your application has been placed on our waitlist. We will contact you when a position opens up.", app, form),
              color: form.waitlistEmbedColor || "#F0B232",
              showTimestamp: true,
            });

            await user.send({ content: waitlistMsgText, embeds: [waitlistEmbed] }).catch(() => null);
          }
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

  // 2. DM Message Listener for Step-by-Step Question Responses
  client.on("messageCreate", async (message: Message) => {
    try {
      if (message.author.bot || message.guild) return; // Only process DMs from real users

      const session = await getAppIntakeSession(message.author.id);
      if (!session) return; // No active intake session for this user

      const form = await getAppFormById(session.formId);
      if (!form || !form.questions || form.questions.length === 0) {
        await deleteAppIntakeSession(message.author.id);
        await message.reply("❌ This application form is no longer available.");
        return;
      }

      const questions = form.questions;
      let answers: any[] = [];
      try {
        answers = JSON.parse(session.answers || "[]");
      } catch (e) {}

      const currentQ = questions[session.currentStep];
      if (currentQ) {
        answers.push({
          questionId: currentQ.id,
          questionLabel: currentQ.label,
          questionType: currentQ.type,
          value: message.content.trim(),
        });
      }

      const nextStep = session.currentStep + 1;

      if (nextStep < questions.length) {
        // Send Next Question in DM
        await createOrUpdateAppIntakeSession(message.author.id, session.guildId, session.formId, nextStep, answers);
        const nextQ = questions[nextStep];

        const nextEmbed = new EmbedBuilder()
          .setTitle(`❓ Question ${nextStep + 1} of ${questions.length}`)
          .setDescription(`**${nextQ.label}**\n\n_${nextQ.helpText || nextQ.placeholder || "Type your answer below in this chat..."}_`)
          .setColor("#5865F2")
          .setFooter({ text: `GuildPilot DM Intake • ${form.name}` });

        await message.reply({ embeds: [nextEmbed] });
      } else {
        // All Questions Answered! Complete Application Submission
        await deleteAppIntakeSession(message.author.id);

        let guild: any = null;
        if (session.guildId) {
          guild = await client.guilds.fetch(session.guildId).catch(() => null);
        }

        const member = guild ? await guild.members.fetch(message.author.id).catch(() => null) : null;
        const accountAge = message.author.createdAt.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
        const joinDate = member?.joinedAt
          ? member.joinedAt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
          : "Unknown";

        const currentRoles = member?.roles?.cache?.map((r: any) => r.name).filter((n: string) => n !== "@everyone") || [];

        // Save Application to DB
        const app = await createApplicationSubmission({
          guildId: session.guildId,
          formId: form.id,
          userId: message.author.id,
          userTag: message.author.tag,
          userAvatar: message.author.displayAvatarURL(),
          accountAge,
          joinDate,
          currentRoles,
          answers,
        });

        // Create Review Channel or send to Target Channel on Guild
        let channelId: string | null = null;
        if (guild) {
          const settings = await getApplicationSettings(guild.id);
          const targetCatId = form.categoryId || settings.defaultCategoryId;

          if (targetCatId) {
            try {
              const chName = `app-${app.appNumber}-${message.author.username.substring(0, 10)}`;
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
                    id: message.author.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                  },
                ],
              });

              channelId = newChannel.id;
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
        }

        if (channelId) {
          await updateApplicationStatus(app.id, "PENDING", { id: app.userId, tag: app.userTag }, { channelId });
        }

        // Broadcast Socket.IO event for live dashboard update
        broadcastEvent("applicationSubmitted", { guildId: app.guildId, appId: app.id, appNumber: app.appNumber });

        // Send Final Completion Embed to Applicant DM
        const completionEmbed = buildEmbedHelper({
          title: "🎉 Application Completed & Submitted!",
          description: `Thank you <@${message.author.id}>! Your application for **${form.name}** (App #${app.appNumber}) has been received.\n\nOur review team will inspect your answers shortly.`,
          color: "#23A55A",
          showTimestamp: true,
        });

        await message.reply({ embeds: [completionEmbed] });
      }
    } catch (dmError) {
      console.error("[App System] Error processing DM answer message:", dmError);
    }
  });
}

async function handleApplicationStartViaDM(interaction: any, formId: string) {
  const form = await getAppFormById(formId);
  if (!form) {
    return interaction.reply({ content: "❌ This application form no longer exists.", ephemeral: true });
  }

  const guildId = interaction.guildId;
  const canApplyResult = await checkUserCanApply(guildId, formId, interaction.user.id);
  if (!canApplyResult.canApply) {
    return interaction.reply({ content: `❌ ${canApplyResult.reason}`, ephemeral: true });
  }

  if (!form.questions || form.questions.length === 0) {
    return interaction.reply({
      content: "⚠️ No application questions have been configured for this form yet.",
      ephemeral: true,
    });
  }

  const guildName = interaction.guild?.name || "Server";

  // Start Step-by-Step DM Intake Session at Step 0
  await deleteAppIntakeSession(interaction.user.id);
  await createOrUpdateAppIntakeSession(interaction.user.id, guildId, form.id, 0, []);

  const firstQuestion = form.questions[0];

  // Welcome Embed
  const welcomeEmbed = buildEmbedHelper({
    title: form.dmTitle || `📝 Application Intake Started: ${form.name}`,
    description:
      form.dmDescription ||
      `Welcome <@${interaction.user.id}>!\n\nYou started an application for **${form.name}** on **${guildName}**.\n\nPlease answer each question sent below directly in this DM chat.`,
    color: form.dmColor || "#5865F2",
    authorName: form.dmAuthorName || undefined,
    authorIcon: form.dmAuthorIcon || undefined,
    thumbnail: form.dmThumbnail || undefined,
    image: form.dmImage || undefined,
    footer: form.dmFooter || `GuildPilot Application System • ${guildName}`,
    footerIcon: form.dmFooterIcon || undefined,
    showTimestamp: true,
  });

  // Question 1 Prompt Embed
  const q1Embed = new EmbedBuilder()
    .setTitle(`❓ Question 1 of ${form.questions.length}`)
    .setDescription(`**${firstQuestion.label}**\n\n_${firstQuestion.helpText || firstQuestion.placeholder || "Type your answer below in this chat..."}_`)
    .setColor("#5865F2")
    .setFooter({ text: `GuildPilot DM Intake • ${form.name}` });

  try {
    await interaction.user.send({ embeds: [welcomeEmbed, q1Embed] });

    await interaction.reply({
      content: `📩 **Step-by-Step DM Intake Started!** We sent Question 1 for **${form.name}** to your Discord DMs. Please reply directly in DM chat to answer!`,
      ephemeral: true,
    });
  } catch (dmErr) {
    await deleteAppIntakeSession(interaction.user.id);
    await interaction.reply({
      content: `❌ **Direct Messages (DMs) Blocked!** The bot could not send you a DM. Please enable *"Allow direct messages from server members"* in your Discord Privacy Settings for this server and try again.`,
      ephemeral: true,
    });
  }
}

async function postApplicationChannelWelcome(channel: TextChannel, app: any, form: any) {
  const welcomeEmbed = buildEmbedHelper({
    title: form.welcomeTitle || `👋 Application #${app.appNumber} — ${form.name}`,
    description: form.welcomeDescription || `Welcome <@${app.userId}>! Reviewers will inspect your answers shortly.`,
    color: form.welcomeColor || "#5865F2",
    authorName: form.welcomeAuthorName || undefined,
    authorIcon: form.welcomeAuthorIcon || undefined,
    thumbnail: form.welcomeThumbnail || undefined,
    image: form.welcomeImage || undefined,
    footer: form.welcomeFooter || "GuildPilot Applications System",
    footerIcon: form.welcomeFooterIcon || undefined,
    showTimestamp: true,
  });

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
    .setFooter({ text: `GuildPilot Application System • Status: PENDING` })
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
