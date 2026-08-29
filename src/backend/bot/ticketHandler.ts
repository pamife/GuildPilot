import {
  Client,
  Interaction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  ChatInputCommandInteraction,
  Message,
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
  SlashCommandBuilder,
  REST,
  Routes,
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
  getUserOpenTicketsCount,
} from "../services/ticketService";
import { generateHtmlTranscript } from "../services/transcriptService";
import { parseAndValidateEmoji } from "../utils/emojiValidator";
import { buildTicketPanelPayload } from "./ticketComponentBuilder";
import { TicketTypeConfig, TicketPanelComponentItem } from "../types/ticketComponentTypes";

// Register Slash Commands globally for bot
export async function registerSlashCommands(client: Client) {
  if (!client.user) return;

  const ticketCommand = new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Ticket Management Commands")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a user to the current ticket channel")
        .addUserOption((opt) => opt.setName("user").setDescription("User to add").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a user from the current ticket channel")
        .addUserOption((opt) => opt.setName("user").setDescription("User to remove").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("close")
        .setDescription("Close the current ticket channel")
        .addStringOption((opt) => opt.setName("reason").setDescription("Reason for closing ticket").setRequired(false))
    )
    .addSubcommand((sub) => sub.setName("claim").setDescription("Claim the current ticket"))
    .addSubcommand((sub) => sub.setName("reopen").setDescription("Reopen a closed ticket channel"))
    .addSubcommand((sub) => sub.setName("transcript").setDescription("Generate an HTML transcript for the ticket"));

  try {
    const token = process.env.DISCORD_TOKEN;
    if (token) {
      const rest = new REST({ version: "10" }).setToken(token);
      await rest.put(Routes.applicationCommands(client.user.id), {
        body: [ticketCommand.toJSON()],
      });
      console.log("[TheGodGen Bot] Successfully registered Slash Commands (/ticket)");
    }
  } catch (err: any) {
    console.error("[TheGodGen Bot] Failed to register Slash Commands:", err.message || err);
  }
}

function isValidUrl(str: string): boolean {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function setupTicketInteractions(client: Client) {
  registerSlashCommands(client);

  // Track staff message count in open ticket channels
  client.on("messageCreate", async (message: Message) => {
    try {
      if (message.author.bot || !message.guild || message.channel.type !== ChannelType.GuildText) return;

      const ticket = await getTicketByChannelId(message.channelId);
      if (!ticket || ticket.status === "CLOSED") return;

      const panel = ticket.panelId ? await getTicketPanelById(ticket.panelId) : null;
      const settings = await getTicketSettings(message.guild.id);

      const supportRoles: string[] = panel ? JSON.parse(panel.supportRoles || "[]") : [];
      const defaultSupportRoles: string[] = JSON.parse(settings.defaultSupportRoles || "[]");
      const allSupportRoles = Array.from(new Set([...supportRoles, ...defaultSupportRoles]));

      const isStaff =
        message.member &&
        ("roles" in message.member) &&
        (message.member.roles as any).cache.some((r: Role) => allSupportRoles.includes(r.id));

      if (isStaff || message.author.id !== ticket.userId) {
        const counts: Record<string, number> = JSON.parse(ticket.staffMessageCounts || "{}");
        const current = counts[message.author.id] || 0;
        counts[message.author.id] = current + 1;

        await updateTicketStatus(ticket.id, ticket.status as any, {
          staffMessageCounts: JSON.stringify(counts),
        });
      }
    } catch (e) {
      console.error("[TicketHandler] Message counter error:", e);
    }
  });

  client.on("interactionCreate", async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await handleSlashCommandInteraction(interaction);
      } else if (interaction.isButton()) {
        await handleButtonInteraction(interaction);
      } else if (interaction.isStringSelectMenu()) {
        await handleSelectMenuInteraction(interaction);
      } else if (interaction.isModalSubmit()) {
        await handleModalInteraction(interaction);
      }
    } catch (err) {
      console.error("[TicketHandler] Interaction error:", err);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ An error occurred while processing this ticket action.",
          ephemeral: true,
        }).catch(() => {});
      }
    }
  });
}

// Deploy interactive panel embed to Discord channel (supports Components V2 and Classic Embed)
export async function deployTicketPanelEmbed(client: Client, panelId: string): Promise<string> {
  const panel = await getTicketPanelById(panelId);
  if (!panel || !panel.channelId) {
    throw new Error("Panel or target channel missing.");
  }

  const channel = (await client.channels.fetch(panel.channelId).catch(() => null)) as TextChannel;
  if (!channel) {
    throw new Error(`Target channel ${panel.channelId} not found.`);
  }

  const payload = buildTicketPanelPayload(panel);

  let message: any = null;
  if (panel.messageId) {
    try {
      const existingMsg = await channel.messages.fetch(panel.messageId);
      if (existingMsg) {
        message = await existingMsg.edit(payload);
      }
    } catch (e) {
      // Deployed message was deleted or unreachable, fallback to creating a new message
    }
  }

  if (!message) {
    message = await channel.send(payload);
  }

  return message.id;
}

// Slash Command Handler
async function handleSlashCommandInteraction(interaction: ChatInputCommandInteraction) {
  if (interaction.commandName !== "ticket") return;

  const subcommand = interaction.options.getSubcommand();
  const ticket = await getTicketByChannelId(interaction.channelId);

  if (!ticket && subcommand !== "create") {
    return interaction.reply({ content: "❌ This command can only be used inside a ticket channel.", ephemeral: true });
  }

  if (subcommand === "add") {
    const targetUser = interaction.options.getUser("user", true);
    const channel = interaction.channel as TextChannel;
    if (channel && ticket) {
      await channel.permissionOverwrites.edit(targetUser.id, { ViewChannel: true, SendMessages: true });
      await createTicketLog({
        guildId: ticket.guildId,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        action: "USER_ADDED",
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
        details: `Added ${targetUser.tag} via /ticket add`,
      });
      await interaction.reply({ content: `✅ Added ${targetUser} to the ticket.` });
    }
  } else if (subcommand === "remove") {
    const targetUser = interaction.options.getUser("user", true);
    const channel = interaction.channel as TextChannel;
    if (channel && ticket) {
      await channel.permissionOverwrites.delete(targetUser.id);
      await createTicketLog({
        guildId: ticket.guildId,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        action: "USER_REMOVED",
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
        details: `Removed ${targetUser.tag} via /ticket remove`,
      });
      await interaction.reply({ content: `✅ Removed ${targetUser} from the ticket.` });
    }
  } else if (subcommand === "close") {
    const reason = interaction.options.getString("reason") || "Resolved";
    await handleTicketCloseExecute(interaction as any, ticket!.id, reason);
  } else if (subcommand === "claim") {
    await handleTicketClaim(interaction as any, ticket!.id);
  } else if (subcommand === "reopen") {
    await handleTicketReopen(interaction as any, ticket!.id);
  } else if (subcommand === "transcript") {
    await handleTicketTranscript(interaction as any, ticket!.id);
  }
}

async function handleButtonInteraction(interaction: ButtonInteraction) {
  const customId = interaction.customId;

  // Modern Discord Components V2 Ticket Actions (tkt_act:<panelId>:<action>:<ticketTypeId>:<componentId>)
  if (customId.startsWith("tkt_act:")) {
    const parts = customId.split(":");
    const panelId = parts[1];
    const action = parts[2];
    const ticketTypeId = parts[3];

    if (action === "CREATE_TICKET") {
      await triggerTicketProcess(interaction, panelId, ticketTypeId);
      return;
    }

    // Ticket management actions triggered inside a ticket channel
    const currentTicket = await getTicketByChannelId(interaction.channelId);

    if (action === "CLOSE_TICKET") {
      if (!currentTicket) {
        return interaction.reply({ content: "❌ This action can only be used inside an active ticket channel.", ephemeral: true });
      }
      await handleTicketClose(interaction, currentTicket.id);
    } else if (action === "CLAIM_TICKET") {
      if (!currentTicket) {
        return interaction.reply({ content: "❌ This action can only be used inside an active ticket channel.", ephemeral: true });
      }
      await handleTicketClaim(interaction, currentTicket.id);
    } else if (action === "REOPEN_TICKET") {
      if (!currentTicket) {
        return interaction.reply({ content: "❌ This action can only be used inside an active ticket channel.", ephemeral: true });
      }
      await handleTicketReopen(interaction, currentTicket.id);
    } else if (action === "DELETE_TICKET") {
      if (!currentTicket) {
        return interaction.reply({ content: "❌ This action can only be used inside an active ticket channel.", ephemeral: true });
      }
      await handleTicketDelete(interaction, currentTicket.id);
    } else if (action === "ADD_USER") {
      if (!currentTicket) {
        return interaction.reply({ content: "❌ This action can only be used inside an active ticket channel.", ephemeral: true });
      }
      await handleTicketAddUserPrompt(interaction, currentTicket.id);
    } else if (action === "REMOVE_USER") {
      if (!currentTicket) {
        return interaction.reply({ content: "❌ This action can only be used inside an active ticket channel.", ephemeral: true });
      }
      await handleTicketRemUserPrompt(interaction, currentTicket.id);
    } else if (action === "TRANSCRIPT") {
      if (!currentTicket) {
        return interaction.reply({ content: "❌ This action can only be used inside an active ticket channel.", ephemeral: true });
      }
      await handleTicketTranscript(interaction, currentTicket.id);
    } else if (action === "EPHEMERAL_REPLY") {
      await interaction.reply({
        content: `👋 Hello <@${interaction.user.id}>! If you need support or have questions, please use the ticket creation button above.`,
        ephemeral: true,
      });
    }
    return;
  }

  // Legacy Button Custom IDs (for backward compatibility)
  if (customId.startsWith("ticket_open:")) {
    const panelId = customId.split(":")[1];
    await triggerTicketProcess(interaction, panelId);
  } else if (customId.startsWith("ticket_close:")) {
    const ticketId = customId.split(":")[1];
    await handleTicketClose(interaction, ticketId);
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

  // Modern Discord Components V2 Select Menus (tkt_sel:<panelId>:<action>:<componentId>)
  if (customId.startsWith("tkt_sel:")) {
    const parts = customId.split(":");
    const panelId = parts[1];
    const selectedVal = interaction.values[0] || "";

    // Parse encoded value: tkt_opt:<action>:<ticketTypeId>:<value>
    if (selectedVal.startsWith("tkt_opt:")) {
      const optParts = selectedVal.split(":");
      const optAction = optParts[1];
      const optTypeId = optParts[2];

      if (optAction === "CREATE_TICKET") {
        await triggerTicketProcess(interaction, panelId, optTypeId);
        return;
      } else if (optAction === "EPHEMERAL_REPLY") {
        await interaction.reply({
          content: `ℹ️ Selected: **${optParts[3] || optTypeId}**`,
          ephemeral: true,
        });
        return;
      }
    }

    // Direct ticket type ID or value
    await triggerTicketProcess(interaction, panelId, selectedVal);
    return;
  }

  // Legacy Select Menu
  if (customId.startsWith("ticket_select_reason:")) {
    const panelId = customId.split(":")[1];
    const selectedValue = interaction.values[0];
    await triggerTicketProcess(interaction, panelId, selectedValue);
  }
}

async function triggerTicketProcess(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  panelId: string,
  selectedValue?: string
) {
  const panel = await getTicketPanelById(panelId);
  if (!panel) {
    return interaction.reply({ content: "❌ Ticket panel configuration not found.", ephemeral: true });
  }

  if (!interaction.guild) return;

  const settings = await getTicketSettings(interaction.guild.id);

  // Parse modern Ticket Types or legacy Reasons
  let ticketTypes: TicketTypeConfig[] = [];
  try {
    if (typeof panel.ticketTypesConfig === "string") {
      ticketTypes = JSON.parse(panel.ticketTypesConfig || "[]");
    } else if (Array.isArray(panel.ticketTypesConfig)) {
      ticketTypes = panel.ticketTypesConfig;
    }
  } catch {
    ticketTypes = [];
  }

  let reasons: any[] = [];
  try {
    if (typeof panel.reasons === "string") {
      reasons = JSON.parse(panel.reasons || "[]");
    } else if (Array.isArray(panel.reasons)) {
      reasons = panel.reasons;
    }
  } catch {
    reasons = [];
  }

  // Find target ticket type configuration
  let targetType: any = null;
  if (selectedValue && selectedValue !== "default") {
    targetType = ticketTypes.find(
      (t) => t.id === selectedValue || t.name === selectedValue || t.label === selectedValue
    );
    if (!targetType) {
      targetType = reasons.find((r) => r.value === selectedValue || r.label === selectedValue);
    }
  }

  if (!targetType && ticketTypes.length > 0) {
    targetType = ticketTypes[0];
  }

  // 1. Check Allowed Roles on Panel
  let allowedRoles: string[] = [];
  try {
    if (typeof panel.allowedRoles === "string") {
      allowedRoles = JSON.parse(panel.allowedRoles || "[]");
    } else if (Array.isArray(panel.allowedRoles)) {
      allowedRoles = panel.allowedRoles;
    }
  } catch {
    allowedRoles = [];
  }

  if (allowedRoles.length > 0) {
    const hasRole =
      interaction.member &&
      "roles" in interaction.member &&
      (interaction.member.roles as any).cache.some((r: Role) => allowedRoles.includes(r.id));
    if (!hasRole) {
      return interaction.reply({
        content: "❌ You do not have permission to open tickets from this panel.",
        ephemeral: true,
      });
    }
  }

  // 2. Check Max Open Tickets Limit per User
  const openCount = await getUserOpenTicketsCount(interaction.guild.id, interaction.user.id);
  const maxLimit = targetType?.maxTicketsPerUser || panel.maxOpenTickets || settings.maxTicketsPerUser || 1;

  if (openCount >= maxLimit) {
    return interaction.reply({
      content: `❌ You already have **${openCount} open ticket(s)** (Maximum allowed: ${maxLimit}). Please close your existing tickets before creating a new one.`,
      ephemeral: true,
    });
  }

  // 3. Check Intake Questions Modal
  const globalQuestions: any[] = typeof panel.questions === "string" ? JSON.parse(panel.questions || "[]") : (panel.questions || []);
  const typeQuestions: any[] = targetType?.questions || [];
  const targetQuestions = typeQuestions.length > 0 ? typeQuestions : globalQuestions;
  const allQuestions = targetQuestions.slice(0, 5);

  if (allQuestions.length > 0) {
    const typeKey = targetType?.id || targetType?.value || selectedValue || "default";
    const modalTitle = (targetType?.name || targetType?.label || panel.embedTitle || "Ticket Questions").substring(0, 45);

    const modal = new ModalBuilder()
      .setCustomId(`ticket_intake_modal:${panel.id}:${typeKey}`)
      .setTitle(modalTitle);

    allQuestions.forEach((q: any, idx: number) => {
      const textInput = new TextInputBuilder()
        .setCustomId(`q_${idx}`)
        .setLabel(String(q.label || `Question ${idx + 1}`).substring(0, 45))
        .setStyle(q.style === "paragraph" ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setPlaceholder(q.placeholder ? String(q.placeholder).substring(0, 100) : "Enter your answer...")
        .setRequired(q.required !== undefined ? Boolean(q.required) : true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(textInput));
    });

    return interaction.showModal(modal);
  }

  await interaction.deferReply({ ephemeral: true });
  await handleTicketOpen(interaction, panel, targetType);
}

async function handleTicketOpen(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  panel: any,
  selectedReason?: any,
  formAnswers?: Array<{ label: string; answer: string }>
) {
  if (!interaction.guild) return;

  const settings = await getTicketSettings(interaction.guild.id);

  // Supporter Roles & Additional Roles
  let panelSupportRoles: string[] = [];
  try {
    if (typeof panel.supportRoles === "string") {
      panelSupportRoles = JSON.parse(panel.supportRoles || "[]");
    } else if (Array.isArray(panel.supportRoles)) {
      panelSupportRoles = panel.supportRoles;
    }
  } catch {
    panelSupportRoles = [];
  }

  let defaultSupportRoles: string[] = [];
  try {
    if (typeof settings.defaultSupportRoles === "string") {
      defaultSupportRoles = JSON.parse(settings.defaultSupportRoles || "[]");
    } else if (Array.isArray(settings.defaultSupportRoles)) {
      defaultSupportRoles = settings.defaultSupportRoles;
    }
  } catch {
    defaultSupportRoles = [];
  }

  const reasonSupportRoles: string[] = selectedReason?.supportRoles || [];
  const additionalRoles: string[] = selectedReason?.additionalRoles || [];
  const allSupportRoles = Array.from(new Set([...panelSupportRoles, ...defaultSupportRoles, ...reasonSupportRoles]));
  const allAllowedRoles = Array.from(new Set([...allSupportRoles, ...additionalRoles]));

  // Channel Naming Format
  let channelName = selectedReason?.namingFormat || settings.namingFormat || "ticket-{username}";
  const cleanUsername = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, "");
  channelName = channelName.replace("{username}", cleanUsername || "user");

  if (channelName.includes("{number}")) {
    const count = (await getTicketByChannelId(interaction.channelId || "").then((t) => t?.ticketNumber || 1)) || 1;
    channelName = channelName.replace("{number}", String(count).padStart(4, "0"));
  }

  // Category Target
  const categoryId = selectedReason?.categoryId || panel.categoryId || settings.defaultCategoryId || undefined;

  // Build permission overwrites for creator and supporter/additional roles
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
        PermissionFlagsBits.EmbedLinks,
      ],
    },
  ];

  allAllowedRoles.forEach((roleId) => {
    if (roleId) {
      permissionOverwrites.push({
        id: roleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ManageChannels,
        ],
      });
    }
  });

  const ticketChannel = await interaction.guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: categoryId,
    permissionOverwrites,
  });

  const ticketRecord = await createTicketRecord({
    guildId: interaction.guild.id,
    panelId: panel.id,
    channelId: ticketChannel.id,
    userId: interaction.user.id,
    userTag: interaction.user.tag,
    userAvatar: interaction.user.displayAvatarURL({ extension: "png" }),
    categoryId: categoryId,
  });

  // Welcome Message Styling & Dynamic Placeholders
  const welcomeTitle = (
    selectedReason?.welcomeTitle ||
    panel.welcomeTitle ||
    `👋 Welcome to Ticket #${ticketRecord.ticketNumber}`
  )
    .replace("{user}", `<@${interaction.user.id}>`)
    .replace("{username}", interaction.user.username)
    .replace("{number}", String(ticketRecord.ticketNumber));

  const welcomeDesc = (
    selectedReason?.welcomeDescription ||
    panel.welcomeDescription ||
    `Welcome <@${interaction.user.id}>! A member of our support team will be with you shortly. Use the buttons below to manage this ticket.`
  )
    .replace("{user}", `<@${interaction.user.id}>`)
    .replace("{username}", interaction.user.username)
    .replace("{server}", interaction.guild.name)
    .replace("{number}", String(ticketRecord.ticketNumber));

  const welcomeColorHex = selectedReason?.welcomeColor || panel.welcomeColor || "#5865F2";

  const welcomeEmbed = new EmbedBuilder()
    .setTitle(welcomeTitle)
    .setDescription(welcomeDesc)
    .setColor((welcomeColorHex as `#${string}`) || "#5865F2")
    .addFields(
      { name: "Creator", value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
      { name: "Panel", value: `${panel.name}`, inline: true },
      { name: "Status", value: "🟢 Open", inline: true }
    )
    .setTimestamp();

  if (selectedReason?.name || selectedReason?.label) {
    welcomeEmbed.addFields({
      name: "Ticket Type",
      value: `${selectedReason.emoji || "🎫"} **${selectedReason.name || selectedReason.label}**`,
      inline: false,
    });
  }

  if (formAnswers && formAnswers.length > 0) {
    const formattedAnswers = formAnswers
      .map((fa) => `**${fa.label}**:\n${fa.answer}`)
      .join("\n\n");

    welcomeEmbed.addFields({
      name: "📋 Submitted Intake Information",
      value: formattedAnswers.substring(0, 1024),
      inline: false,
    });
  }

  const welcomeThumbnail = selectedReason?.welcomeThumbnail || panel.welcomeThumbnail;
  const welcomeImage = selectedReason?.welcomeImage || panel.welcomeImage;
  const welcomeFooter = selectedReason?.welcomeFooter || panel.welcomeFooter;

  if (welcomeThumbnail && isValidUrl(welcomeThumbnail)) welcomeEmbed.setThumbnail(welcomeThumbnail.trim());
  if (welcomeImage && isValidUrl(welcomeImage)) welcomeEmbed.setImage(welcomeImage.trim());
  if (welcomeFooter) welcomeEmbed.setFooter({ text: welcomeFooter });

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ticket_close:${ticketRecord.id}`).setLabel("Close").setEmoji("🔒").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket_claim:${ticketRecord.id}`).setLabel("Claim").setEmoji("👤").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`ticket_adduser:${ticketRecord.id}`).setLabel("Add User").setEmoji("➕").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket_remuser:${ticketRecord.id}`).setLabel("Remove User").setEmoji("➖").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket_transcript:${ticketRecord.id}`).setLabel("Transcript").setEmoji("📄").setStyle(ButtonStyle.Secondary)
  );

  // Supporter role mentions
  const supportPings = allSupportRoles.map((r) => `<@&${r}>`).join(" ");

  await ticketChannel.send({
    content: `${interaction.user} ${supportPings}`.trim(),
    embeds: [welcomeEmbed],
    components: [row1],
  });

  const successContent = `✅ Ticket created successfully! Head over to ${ticketChannel}.`;
  if (interaction.deferred) {
    await interaction.editReply({ content: successContent });
  } else {
    await interaction.reply({ content: successContent, ephemeral: true });
  }
}

async function handleTicketClose(interaction: ButtonInteraction, ticketId: string) {
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

// Executes ticket close and sends log message matching exact image attachment layout!
async function handleTicketCloseExecute(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
  ticketId: string,
  closeReason = "resolved"
) {
  if (interaction.deferred || interaction.replied) {
    // Already responded
  } else {
    await interaction.deferReply();
  }

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

  const now = new Date();

  await updateTicketStatus(ticket.id, "CLOSED", {
    closedByUserId: interaction.user.id,
    closedByTag: interaction.user.tag,
    closeReason,
    closedTimestamp: now,
  });

  await createTicketLog({
    guildId: ticket.guildId,
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    action: "CLOSED",
    executorId: interaction.user.id,
    executorTag: interaction.user.tag,
    details: `Ticket #${ticket.ticketNumber} closed by ${interaction.user.tag} (Reason: ${closeReason})`,
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

  // Post Ticket Log Embed to Log Channel matching attached screenshot!
  const settings = await getTicketSettings(ticket.guildId);
  if (settings.logChannelId && interaction.guild) {
    const logChannel = (await interaction.guild.channels.fetch(settings.logChannelId).catch(() => null)) as TextChannel;
    if (logChannel && logChannel.isTextBased()) {
      await sendTicketCloseLogEmbed(logChannel, ticket, interaction.user, closeReason, now);
    }
  }
}

// Sends ticket close embed matching the user's attachment screenshot!
async function sendTicketCloseLogEmbed(
  logChannel: TextChannel,
  ticket: any,
  closedBy: any,
  closeReason: string,
  closeDate: Date
) {
  try {
    const openDateStr = new Date(ticket.openTimestamp || ticket.createdAt).toLocaleString("de-DE", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const closeDateStr = closeDate.toLocaleString("de-DE", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const staffCounts: Record<string, number> = JSON.parse(ticket.staffMessageCounts || "{}");
    const staffList = Object.entries(staffCounts)
      .map(([userId, count]) => `[\` ${count} \`] - <@${userId}>`)
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle("Ticket Closed")
      .setColor("#FEE75C") // Gold border accent bar on left matching screenshot
      .addFields(
        { name: "Ticket Name", value: `\`${ticket.channelId ? `ticket-${ticket.ticketNumber}` : "ticket-closed"}\``, inline: true },
        { name: "Ticket Author", value: `<@${ticket.userId}>`, inline: true },
        { name: "Closed By", value: `<@${closedBy.id}>`, inline: true },
        { name: "Open Date", value: `\`${openDateStr}\``, inline: true },
        { name: "Close Date", value: `\`${closeDateStr}\``, inline: true },
        { name: "Ticket Close Reason", value: closeReason || "resolved", inline: false },
        {
          name: "Staff Message Count",
          value: staffList.length > 0 ? staffList : "[\` 1 \`] - <@" + closedBy.id + ">",
          inline: false,
        }
      );

    // Add View Transcript Button matching screenshot
    let components: any[] = [];
    if (ticket.channelId) {
      const channel = (await logChannel.guild.channels.fetch(ticket.channelId).catch(() => null)) as TextChannel;
      if (channel) {
        const filePath = await generateHtmlTranscript(
          channel,
          {
            number: ticket.ticketNumber,
            creatorTag: ticket.userTag,
          },
          ticket.id
        ).catch(() => null);

        if (filePath) {
          const downloadUrl = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/guilds/${ticket.guildId}/tickets/transcripts/${ticket.id}/download`;
          const btn = new ButtonBuilder()
            .setLabel("View Transcript 🔗")
            .setStyle(ButtonStyle.Link)
            .setURL(downloadUrl);
          components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(btn));
        }
      }
    }

    await logChannel.send({ embeds: [embed], components });
  } catch (e) {
    console.error("[TicketHandler] Error sending ticket close log embed:", e);
  }
}

async function handleTicketClaim(interaction: ButtonInteraction, ticketId: string) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply();
  }

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
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply();
  }

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
      const filePath = await generateHtmlTranscript(
        channel,
        {
          number: ticket.ticketNumber,
          creatorTag: ticket.userTag,
        },
        ticket.id
      );

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
      // We retain the ticket DB record so stats and Webpanel history persist even after channel deletion!
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
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true });
  }

  const ticket = await getTicketById(ticketId);
  const channel = interaction.channel as TextChannel;

  if (!ticket || !channel) {
    return interaction.editReply({ content: "❌ Ticket or channel not found." });
  }

  const filePath = await generateHtmlTranscript(
    channel,
    {
      number: ticket.ticketNumber,
      creatorTag: ticket.userTag,
    },
    ticket.id
  );

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

    let ticketTypes: any[] = [];
    try {
      if (typeof panel.ticketTypesConfig === "string") {
        ticketTypes = JSON.parse(panel.ticketTypesConfig || "[]");
      } else if (Array.isArray(panel.ticketTypesConfig)) {
        ticketTypes = panel.ticketTypesConfig;
      }
    } catch {
      ticketTypes = [];
    }

    let reasons: any[] = [];
    try {
      if (typeof panel.reasons === "string") {
        reasons = JSON.parse(panel.reasons || "[]");
      } else if (Array.isArray(panel.reasons)) {
        reasons = panel.reasons;
      }
    } catch {
      reasons = [];
    }

    let selectedReason: any = null;
    if (selectedValue && selectedValue !== "default") {
      selectedReason = ticketTypes.find(
        (t) => t.id === selectedValue || t.name === selectedValue || t.label === selectedValue
      );
      if (!selectedReason) {
        selectedReason = reasons.find((r) => r.value === selectedValue || r.label === selectedValue);
      }
    }
    if (!selectedReason && ticketTypes.length > 0) {
      selectedReason = ticketTypes[0];
    }

    const globalQuestions: any[] = typeof panel.questions === "string" ? JSON.parse(panel.questions || "[]") : (panel.questions || []);
    const reasonQuestions: any[] = selectedReason?.questions || [];
    const targetQuestions = reasonQuestions.length > 0 ? reasonQuestions : globalQuestions;
    const allQuestions = targetQuestions.slice(0, 5);

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
