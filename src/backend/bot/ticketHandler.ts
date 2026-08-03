import {
  Client,
  Interaction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  ChannelType,
  PermissionFlagsBits,
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
  Role,
  AttachmentBuilder,
} from "discord.js";
import {
  getTicketPanelById,
  getTicketByChannelId,
  getTicketById,
  createTicketRecord,
  updateTicketStatus,
  deleteTicketRecord,
  createTicketLog,
  getTicketSettings,
} from "../services/ticketService";
import { generateHtmlTranscript } from "../services/transcriptService";

export function setupTicketInteractions(client: Client) {
  client.on("interactionCreate", async (interaction: Interaction) => {
    try {
      if (interaction.isButton()) {
        await handleButtonInteraction(interaction);
      } else if (interaction.isStringSelectMenu()) {
        await handleSelectMenuInteraction(interaction);
      } else if (interaction.isModalSubmit()) {
        await handleModalInteraction(interaction);
      }
    } catch (err) {
      console.error("[TicketHandler] Error handling interaction:", err);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ An error occurred while processing this ticket action.",
          ephemeral: true,
        }).catch(() => {});
      }
    }
  });
}

// Deploy interactive panel embed to Discord channel
export async function deployTicketPanelEmbed(client: Client, panelId: string): Promise<string> {
  const panel = await getTicketPanelById(panelId);
  if (!panel || !panel.channelId) {
    throw new Error("Panel or target channel missing.");
  }

  const channel = (await client.channels.fetch(panel.channelId).catch(() => null)) as TextChannel;
  if (!channel) {
    throw new Error(`Target channel ${panel.channelId} not found.`);
  }

  const embed = new EmbedBuilder()
    .setTitle(panel.embedTitle || panel.name)
    .setDescription(panel.embedDescription || "Click the button below or choose a reason to open a ticket.")
    .setColor((panel.embedColor as `#${string}`) || "#5865F2");

  if (panel.thumbnail) embed.setThumbnail(panel.thumbnail);
  if (panel.image) embed.setImage(panel.image);
  if (panel.footer) embed.setFooter({ text: panel.footer });

  const components: any[] = [];

  // Parse multi-reasons
  const reasons: any[] = JSON.parse(panel.reasons || "[]");

  if (reasons.length > 0) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`ticket_select_reason:${panel.id}`)
      .setPlaceholder("Select a ticket reason...");

    reasons.forEach((r: any) => {
      const option = new StringSelectMenuOptionBuilder()
        .setLabel(r.label || "Support Reason")
        .setValue(r.value || r.label.toLowerCase().replace(/[^a-z0-9]/g, "_"))
        .setDescription(r.description || "Open ticket for this reason");
      if (r.emoji) option.setEmoji(r.emoji);
      selectMenu.addOptions(option);
    });

    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));
  }

  // Button option
  let style = ButtonStyle.Primary;
  if (panel.buttonColor === "Secondary") style = ButtonStyle.Secondary;
  if (panel.buttonColor === "Success") style = ButtonStyle.Success;
  if (panel.buttonColor === "Danger") style = ButtonStyle.Danger;

  const button = new ButtonBuilder()
    .setCustomId(`ticket_open:${panel.id}`)
    .setLabel(panel.buttonText || "Create Ticket")
    .setStyle(style);

  if (panel.buttonEmoji) {
    button.setEmoji(panel.buttonEmoji);
  }

  components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(button));

  const message = await channel.send({
    embeds: [embed],
    components,
  });

  return message.id;
}

async function handleButtonInteraction(interaction: ButtonInteraction) {
  const customId = interaction.customId;

  if (customId.startsWith("ticket_open:")) {
    const panelId = customId.split(":")[1];
    await triggerTicketProcess(interaction, panelId);
  } else if (customId.startsWith("ticket_close:")) {
    const ticketId = customId.split(":")[1];
    await handleTicketClosePrompt(interaction, ticketId);
  } else if (customId.startsWith("ticket_close_confirm:")) {
    const ticketId = customId.split(":")[1];
    await handleTicketCloseExecute(interaction, ticketId);
  } else if (customId.startsWith("ticket_claim:")) {
    const ticketId = customId.split(":")[1];
    await handleTicketClaim(interaction, ticketId);
  } else if (customId.startsWith("ticket_reopen:")) {
    const ticketId = customId.split(":")[1];
    await handleTicketReopen(interaction, ticketId);
  } else if (customId.startsWith("ticket_delete:")) {
    const ticketId = customId.split(":")[1];
    await handleTicketDelete(interaction, ticketId);
  } else if (customId.startsWith("ticket_adduser:")) {
    const ticketId = customId.split(":")[1];
    await handleTicketAddUserPrompt(interaction, ticketId);
  } else if (customId.startsWith("ticket_remuser:")) {
    const ticketId = customId.split(":")[1];
    await handleTicketRemUserPrompt(interaction, ticketId);
  } else if (customId.startsWith("ticket_transcript:")) {
    const ticketId = customId.split(":")[1];
    await handleTicketTranscript(interaction, ticketId);
  }
}

async function handleSelectMenuInteraction(interaction: StringSelectMenuInteraction) {
  const customId = interaction.customId;
  if (customId.startsWith("ticket_select_reason:")) {
    const panelId = customId.split(":")[1];
    const selectedValue = interaction.values[0];
    await triggerTicketProcess(interaction, panelId, selectedValue);
  }
}

// Determines whether to prompt intake modal questions or create ticket directly
async function triggerTicketProcess(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  panelId: string,
  selectedValue?: string
) {
  const panel = await getTicketPanelById(panelId);
  if (!panel) {
    return interaction.reply({ content: "❌ Ticket panel configuration not found.", ephemeral: true });
  }

  // Parse questions
  const globalQuestions: any[] = JSON.parse(panel.questions || "[]");
  const reasons: any[] = JSON.parse(panel.reasons || "[]");
  const selectedReason = reasons.find((r) => r.value === selectedValue || r.label === selectedValue);
  const reasonQuestions: any[] = selectedReason?.questions || [];

  const allQuestions = [...globalQuestions, ...reasonQuestions].slice(0, 5); // Max 5 modal questions per Discord limit

  if (allQuestions.length > 0) {
    // Show Modal Form to ask user pre-ticket questions
    const modal = new ModalBuilder()
      .setCustomId(`ticket_intake_modal:${panel.id}:${selectedValue || "default"}`)
      .setTitle(panel.embedTitle?.substring(0, 45) || "Ticket Information");

    allQuestions.forEach((q: any, idx: number) => {
      const textInput = new TextInputBuilder()
        .setCustomId(`q_${idx}`)
        .setLabel(q.label.substring(0, 45))
        .setStyle(q.style === "paragraph" ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setPlaceholder(q.placeholder ? q.placeholder.substring(0, 100) : "Enter your answer...")
        .setRequired(q.required !== undefined ? Boolean(q.required) : true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(textInput));
    });

    return interaction.showModal(modal);
  }

  // If no questions, proceed directly to create ticket
  await interaction.deferReply({ ephemeral: true });
  await handleTicketOpen(interaction, panel, selectedReason);
}

async function handleTicketOpen(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  panel: any,
  selectedReason?: any,
  formAnswers?: Array<{ label: string; answer: string }>
) {
  if (!interaction.guild) return;

  const settings = await getTicketSettings(interaction.guild.id);

  // Check allowed roles
  const allowedRoles: string[] = JSON.parse(panel.allowedRoles || "[]");
  if (allowedRoles.length > 0) {
    const hasRole = interaction.member && "roles" in interaction.member &&
      (interaction.member.roles as any).cache.some((r: Role) => allowedRoles.includes(r.id));
    if (!hasRole) {
      const msg = "❌ You do not have permission to open tickets from this panel.";
      return interaction.deferred ? interaction.editReply({ content: msg }) : interaction.reply({ content: msg, ephemeral: true });
    }
  }

  // Parse support roles
  const supportRoles: string[] = JSON.parse(panel.supportRoles || "[]");
  const defaultSupportRoles: string[] = JSON.parse(settings.defaultSupportRoles || "[]");
  const reasonSupportRoles: string[] = selectedReason?.supportRoles || [];
  const allSupportRoles = Array.from(new Set([...supportRoles, ...defaultSupportRoles, ...reasonSupportRoles]));

  // Naming format
  let channelName = settings.namingFormat || "ticket-{username}";
  channelName = channelName.replace("{username}", interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, ""));
  if (channelName.includes("{number}")) {
    const count = (await getTicketByChannelId(interaction.channelId || "").then((t) => t?.ticketNumber || 1)) || 1;
    channelName = channelName.replace("{number}", String(count).padStart(4, "0"));
  }

  // Target category
  const categoryId = selectedReason?.categoryId || panel.categoryId || settings.defaultCategoryId || undefined;

  // Build permission overwrites
  const permissionOverwrites: any[] = [
    {
      id: interaction.guild.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
  ];

  allSupportRoles.forEach((roleId) => {
    permissionOverwrites.push({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ManageChannels,
      ],
    });
  });

  // Create ticket channel
  const ticketChannel = await interaction.guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: categoryId,
    permissionOverwrites,
  });

  // Record ticket in DB
  const ticketRecord = await createTicketRecord({
    guildId: interaction.guild.id,
    panelId: panel.id,
    channelId: ticketChannel.id,
    userId: interaction.user.id,
    userTag: interaction.user.tag,
    userAvatar: interaction.user.displayAvatarURL({ extension: "png" }),
    categoryId: categoryId,
  });

  // Build custom welcome embed with assets & form answers
  const welcomeTitle = panel.welcomeTitle || `Support Ticket #${ticketRecord.ticketNumber}`;
  let welcomeDesc = panel.welcomeDescription || `Welcome ${interaction.user}! A member of our support team will be with you shortly.`;

  const welcomeEmbed = new EmbedBuilder()
    .setTitle(welcomeTitle)
    .setDescription(welcomeDesc)
    .setColor((panel.welcomeColor as `#${string}`) || "#5865F2")
    .addFields(
      { name: "Creator", value: `${interaction.user.tag}`, inline: true },
      { name: "Panel", value: `${panel.name}`, inline: true },
      { name: "Status", value: "🟢 Open", inline: true }
    )
    .setTimestamp();

  if (selectedReason) {
    welcomeEmbed.addFields({
      name: "Reason",
      value: `${selectedReason.emoji || "📌"} ${selectedReason.label}`,
      inline: false,
    });
  }

  // Include Form Answers if intake questions were answered
  if (formAnswers && formAnswers.length > 0) {
    const formattedAnswers = formAnswers
      .map((fa) => `**${fa.label}**:\n${fa.answer}`)
      .join("\n\n");

    welcomeEmbed.addFields({
      name: "📋 Submitted Intake Form",
      value: formattedAnswers.substring(0, 1024),
      inline: false,
    });
  }

  if (panel.welcomeThumbnail) welcomeEmbed.setThumbnail(panel.welcomeThumbnail);
  if (panel.welcomeImage) welcomeEmbed.setImage(panel.welcomeImage);
  if (panel.welcomeFooter) welcomeEmbed.setFooter({ text: panel.welcomeFooter });

  // Control buttons row
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ticket_close:${ticketRecord.id}`).setLabel("Close").setEmoji("🔒").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket_claim:${ticketRecord.id}`).setLabel("Claim").setEmoji("👤").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`ticket_adduser:${ticketRecord.id}`).setLabel("Add User").setEmoji("➕").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket_remuser:${ticketRecord.id}`).setLabel("Remove User").setEmoji("➖").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket_transcript:${ticketRecord.id}`).setLabel("Transcript").setEmoji("📄").setStyle(ButtonStyle.Secondary)
  );

  const supportPings = allSupportRoles.map((r) => `<@&${r}>`).join(" ");

  await ticketChannel.send({
    content: `${interaction.user} ${supportPings}`.trim(),
    embeds: [welcomeEmbed],
    components: [row1],
  });

  const successContent = `✅ Ticket created! Head over to ${ticketChannel}.`;
  if (interaction.deferred) {
    await interaction.editReply({ content: successContent });
  } else {
    await interaction.reply({ content: successContent, ephemeral: true });
  }
}

async function handleTicketClosePrompt(interaction: ButtonInteraction, ticketId: string) {
  const settings = await getTicketSettings(interaction.guildId || "");

  if (settings.closeConfirmation) {
    const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`ticket_close_confirm:${ticketId}`).setLabel("Yes, Close Ticket").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("cancel_close").setLabel("Cancel").setStyle(ButtonStyle.Secondary)
    );

    return interaction.reply({
      content: "⚠️ Are you sure you want to close this support ticket?",
      components: [confirmRow],
      ephemeral: true,
    });
  }

  await handleTicketCloseExecute(interaction, ticketId);
}

async function handleTicketCloseExecute(interaction: ButtonInteraction, ticketId: string) {
  await interaction.deferReply();

  const ticket = await getTicketById(ticketId);
  if (!ticket) {
    return interaction.editReply({ content: "❌ Ticket record not found." });
  }

  const channel = interaction.channel as TextChannel;
  if (channel) {
    await channel.permissionOverwrites.edit(ticket.userId, {
      SendMessages: false,
    }).catch(() => {});
  }

  await updateTicketStatus(ticket.id, "CLOSED", {
    closedByUserId: interaction.user.id,
    closedByTag: interaction.user.tag,
  });

  await createTicketLog({
    guildId: ticket.guildId,
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    action: "CLOSED",
    executorId: interaction.user.id,
    executorTag: interaction.user.tag,
    details: `Ticket #${ticket.ticketNumber} closed by ${interaction.user.tag}`,
  });

  const closedEmbed = new EmbedBuilder()
    .setTitle(`Ticket #${ticket.ticketNumber} Closed`)
    .setDescription(`Closed by ${interaction.user}.\nUse the buttons below to reopen or permanently delete.`)
    .setColor("#ED4245")
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ticket_reopen:${ticket.id}`).setLabel("Reopen").setEmoji("🔓").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ticket_transcript:${ticket.id}`).setLabel("Transcript").setEmoji("📄").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket_delete:${ticket.id}`).setLabel("Delete").setEmoji("🗑").setStyle(ButtonStyle.Danger)
  );

  await interaction.editReply({
    embeds: [closedEmbed],
    components: [row],
  });
}

async function handleTicketClaim(interaction: ButtonInteraction, ticketId: string) {
  await interaction.deferReply();

  const ticket = await getTicketById(ticketId);
  if (!ticket) {
    return interaction.editReply({ content: "❌ Ticket not found." });
  }

  await updateTicketStatus(ticket.id, "CLAIMED", {
    claimedByUserId: interaction.user.id,
    claimedByTag: interaction.user.tag,
    claimedByAvatar: interaction.user.displayAvatarURL({ extension: "png" }),
  });

  const channel = interaction.channel as TextChannel;
  if (channel) {
    await channel.permissionOverwrites.edit(interaction.user.id, {
      SendMessages: true,
      ViewChannel: true,
    }).catch(() => {});
  }

  await createTicketLog({
    guildId: ticket.guildId,
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    action: "CLAIMED",
    executorId: interaction.user.id,
    executorTag: interaction.user.tag,
    details: `Ticket #${ticket.ticketNumber} claimed by ${interaction.user.tag}`,
  });

  const claimEmbed = new EmbedBuilder()
    .setDescription(`👤 Ticket claimed by ${interaction.user}.`)
    .setColor("#57F287");

  await interaction.editReply({ embeds: [claimEmbed] });
}

async function handleTicketReopen(interaction: ButtonInteraction, ticketId: string) {
  await interaction.deferReply();

  const ticket = await getTicketById(ticketId);
  if (!ticket) {
    return interaction.editReply({ content: "❌ Ticket not found." });
  }

  const channel = interaction.channel as TextChannel;
  if (channel) {
    await channel.permissionOverwrites.edit(ticket.userId, {
      SendMessages: true,
      ViewChannel: true,
    }).catch(() => {});
  }

  await updateTicketStatus(ticket.id, "OPEN");

  await createTicketLog({
    guildId: ticket.guildId,
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    action: "REOPENED",
    executorId: interaction.user.id,
    executorTag: interaction.user.tag,
    details: `Ticket #${ticket.ticketNumber} reopened by ${interaction.user.tag}`,
  });

  const reopenEmbed = new EmbedBuilder()
    .setDescription(`🔓 Ticket reopened by ${interaction.user}.`)
    .setColor("#57F287");

  await interaction.editReply({ embeds: [reopenEmbed] });
}

async function handleTicketDelete(interaction: ButtonInteraction, ticketId: string) {
  const settings = await getTicketSettings(interaction.guildId || "");
  const delay = settings.deleteDelaySeconds || 5;

  await interaction.reply({
    content: `🗑 Ticket will be deleted in **${delay} seconds**...`,
  });

  const channel = interaction.channel as TextChannel;
  const ticket = await getTicketById(ticketId);

  if (ticket && channel) {
    try {
      const filePath = await generateHtmlTranscript(channel, {
        number: ticket.ticketNumber,
        creatorTag: ticket.userTag,
      });

      if (settings.logChannelId && interaction.guild) {
        const logChannel = (await interaction.guild.channels.fetch(settings.logChannelId).catch(() => null)) as TextChannel;
        if (logChannel && logChannel.isTextBased()) {
          const attachment = new AttachmentBuilder(filePath, { name: `transcript-ticket-${ticket.ticketNumber}.html` });
          await logChannel.send({
            content: `📄 **Transcript for Ticket #${ticket.ticketNumber}** (User: ${ticket.userTag})`,
            files: [attachment],
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.error("[TicketHandler] Transcript generation failed on delete:", e);
    }
  }

  setTimeout(async () => {
    if (ticket) {
      await createTicketLog({
        guildId: ticket.guildId,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        action: "DELETED",
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
        details: `Ticket #${ticket.ticketNumber} channel deleted`,
      });
      await deleteTicketRecord(ticket.id).catch(() => {});
    }
    if (channel) {
      await channel.delete().catch(() => {});
    }
  }, delay * 1000);
}

async function handleTicketAddUserPrompt(interaction: ButtonInteraction, ticketId: string) {
  const modal = new ModalBuilder()
    .setCustomId(`ticket_adduser_modal:${ticketId}`)
    .setTitle("Add User to Ticket");

  const userInput = new TextInputBuilder()
    .setCustomId("user_id")
    .setLabel("User ID or Tag")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("e.g. 123456789012345678")
    .setRequired(true);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(userInput);
  modal.addComponents(row);

  await interaction.showModal(modal);
}

async function handleTicketRemUserPrompt(interaction: ButtonInteraction, ticketId: string) {
  const modal = new ModalBuilder()
    .setCustomId(`ticket_remuser_modal:${ticketId}`)
    .setTitle("Remove User from Ticket");

  const userInput = new TextInputBuilder()
    .setCustomId("user_id")
    .setLabel("User ID or Tag")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("e.g. 123456789012345678")
    .setRequired(true);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(userInput);
  modal.addComponents(row);

  await interaction.showModal(modal);
}

async function handleTicketTranscript(interaction: ButtonInteraction, ticketId: string) {
  await interaction.deferReply({ ephemeral: true });

  const ticket = await getTicketById(ticketId);
  const channel = interaction.channel as TextChannel;

  if (!ticket || !channel) {
    return interaction.editReply({ content: "❌ Ticket or channel not found." });
  }

  const filePath = await generateHtmlTranscript(channel, {
    number: ticket.ticketNumber,
    creatorTag: ticket.userTag,
  });

  const attachment = new AttachmentBuilder(filePath, { name: `transcript-ticket-${ticket.ticketNumber}.html` });

  await interaction.editReply({
    content: `📄 HTML Transcript generated for Ticket #${ticket.ticketNumber}!`,
    files: [attachment],
  });
}

async function handleModalInteraction(interaction: ModalSubmitInteraction) {
  const customId = interaction.customId;

  if (customId.startsWith("ticket_intake_modal:")) {
    await interaction.deferReply({ ephemeral: true });

    const parts = customId.split(":");
    const panelId = parts[1];
    const selectedValue = parts[2] === "default" ? undefined : parts[2];

    const panel = await getTicketPanelById(panelId);
    if (!panel) {
      return interaction.editReply({ content: "❌ Ticket panel not found." });
    }

    const globalQuestions: any[] = JSON.parse(panel.questions || "[]");
    const reasons: any[] = JSON.parse(panel.reasons || "[]");
    const selectedReason = reasons.find((r) => r.value === selectedValue || r.label === selectedValue);
    const reasonQuestions: any[] = selectedReason?.questions || [];

    const allQuestions = [...globalQuestions, ...reasonQuestions].slice(0, 5);

    const formAnswers = allQuestions.map((q: any, idx: number) => ({
      label: q.label,
      answer: interaction.fields.getTextInputValue(`q_${idx}`) || "N/A",
    }));

    await handleTicketOpen(interaction, panel, selectedReason, formAnswers);
  } else if (customId.startsWith("ticket_adduser_modal:")) {
    const ticketId = customId.split(":")[1];
    const userIdInput = interaction.fields.getTextInputValue("user_id").trim();
    const channel = interaction.channel as TextChannel;
    const ticket = await getTicketById(ticketId);

    if (channel && ticket) {
      await channel.permissionOverwrites.edit(userIdInput, {
        ViewChannel: true,
        SendMessages: true,
      });

      await createTicketLog({
        guildId: ticket.guildId,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        action: "USER_ADDED",
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
        details: `User ${userIdInput} added to ticket`,
      });

      await interaction.reply({ content: `✅ Added user ${userIdInput} to ticket.` });
    }
  } else if (customId.startsWith("ticket_remuser_modal:")) {
    const ticketId = customId.split(":")[1];
    const userIdInput = interaction.fields.getTextInputValue("user_id").trim();
    const channel = interaction.channel as TextChannel;
    const ticket = await getTicketById(ticketId);

    if (channel && ticket) {
      await channel.permissionOverwrites.delete(userIdInput);

      await createTicketLog({
        guildId: ticket.guildId,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        action: "USER_REMOVED",
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
        details: `User ${userIdInput} removed from ticket`,
      });

      await interaction.reply({ content: `✅ Removed user ${userIdInput} from ticket.` });
    }
  }
}
