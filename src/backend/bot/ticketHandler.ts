import {
  Client,
  Guild,
  User,
  Interaction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  ChatInputCommandInteraction,
  Message,
  ChannelType,
  PermissionFlagsBits,
  OverwriteType,
  DiscordAPIError,
  RESTJSONErrorCodes,
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
  InteractionContextType,
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
import { countingCommand } from "./countingHandler";
import { levelingCommands } from "./levelingHandler";

// Register Slash Commands globally for bot
export async function registerSlashCommands(client: Client) {
  if (!client.isReady()) return;

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

  const closeRequestCommand = new SlashCommandBuilder()
    .setName("closerequest")
    .setDescription("Ask the ticket creator to confirm closing this ticket")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option.setName("reason").setDescription("Reason for requesting closure").setMaxLength(1024)
    );

  try {
    const results = await Promise.allSettled([ticketCommand, closeRequestCommand, countingCommand, ...levelingCommands].map((command) =>
      client.application.commands.create(command.toJSON())
    ));
    for (const result of results) {
      if (result.status === "rejected") {
        console.error("[TheGodGen Bot] Failed to register slash command:", result.reason);
      } else {
        console.log(`[TheGodGen Bot] Registered /${result.value.name}`);
      }
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

        await updateTicketStatus(ticket.id, undefined, {
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
      if (interaction.isRepliable() && !interaction.replied) {
        const content = err instanceof ClosedTicketCategoryError
          ? err.message
          : "❌ An error occurred while processing this ticket action.";
        if (interaction.deferred) {
          await interaction.editReply({ content }).catch(() => {});
        } else {
          await interaction.reply({ content, ephemeral: true }).catch(() => {});
        }
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
function readTicketConfig(value: string | null | undefined): unknown[] {
  try {
    const parsed: unknown = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function requireTicketSupport(
  interaction: ButtonInteraction | ChatInputCommandInteraction | ModalSubmitInteraction,
  ticket: Awaited<ReturnType<typeof getTicketByChannelId>>
) {
  if (!ticket || ticket.guildId !== interaction.guildId || ticket.channelId !== interaction.channelId) {
    await interaction.reply({ content: "❌ This action is only available in the associated ticket channel.", ephemeral: true });
    return false;
  }

  const member = interaction.member;
  if (member && interaction.user.id !== ticket.userId) {
    const isManager = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
    if (isManager) return true;

    const settings = await getTicketSettings(ticket.guildId);
    const panel = ticket.panel;
    const supportRoles = new Set([
      ...readTicketConfig(settings.defaultSupportRoles),
      ...readTicketConfig(panel?.supportRoles),
      ...readTicketConfig(ticket.applicationRoles ?? undefined),
    ]);
    for (const config of [...readTicketConfig(panel?.ticketTypesConfig), ...readTicketConfig(panel?.reasons)]) {
      const roles = (config as { supportRoles?: string[] } | null)?.supportRoles;
      if (Array.isArray(roles)) roles.forEach((roleId) => supportRoles.add(roleId));
    }
    const memberRoleIds = Array.isArray(member.roles) ? member.roles : member.roles.cache.keys();
    if (interaction.channel?.type === ChannelType.GuildText) {
      for (const roleId of memberRoleIds) {
        const overwrite = interaction.channel.permissionOverwrites.cache.get(roleId);
        if (supportRoles.has(roleId) && overwrite?.type === OverwriteType.Role && overwrite.allow.has(PermissionFlagsBits.ManageChannels)) {
          return true;
        }
      }
    }
  }

  await interaction.reply({ content: "❌ Only support staff can perform this action on someone else’s ticket.", ephemeral: true });
  return false;
}

async function handleSlashCommandInteraction(interaction: ChatInputCommandInteraction) {
  if (interaction.commandName !== "ticket" && interaction.commandName !== "closerequest") return;

  const ticket = await getTicketByChannelId(interaction.channelId);
  if (interaction.commandName === "closerequest") {
    return handleCloseRequest(interaction, ticket);
  }

  const subcommand = interaction.options.getSubcommand();

  if (!ticket && subcommand !== "create") {
    return interaction.reply({ content: "❌ This command can only be used inside a ticket channel.", ephemeral: true });
  }

  if (subcommand === "add") {
    if (!await requireTicketSupport(interaction, ticket)) return;
    if (ticket?.status === "CLOSED") {
      return interaction.reply({ content: "❌ Reopen this ticket before adding members.", ephemeral: true });
    }
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
    if (!await requireTicketSupport(interaction, ticket)) return;
    const targetUser = interaction.options.getUser("user", true);
    const channel = interaction.channel as TextChannel;
    if (channel && ticket) {
      if (targetUser.id === ticket.userId || targetUser.id === interaction.client.user.id) {
        return interaction.reply({ content: "❌ The ticket creator and the bot cannot be removed.", ephemeral: true });
      }
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
    await handleTicketClaim(interaction, ticket!.id);
  } else if (subcommand === "reopen") {
    await handleTicketReopen(interaction, ticket!.id);
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
  } else if (customId.startsWith("ticket_close_request:")) {
    await handleCloseRequestConfirmation(interaction, customId.split(":")[1]);
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

  const typeSupportRoles = Array.isArray(selectedReason?.supportRoles) ? selectedReason.supportRoles : [];
  const configuredSupportRoles = typeSupportRoles.length > 0
    ? typeSupportRoles
    : [
        ...(Array.isArray(panel.supportRoles) ? panel.supportRoles : readTicketConfig(panel.supportRoles)),
        ...readTicketConfig(settings.defaultSupportRoles),
      ];
  const allSupportRoles = Array.from(new Set<string>(
    configuredSupportRoles.filter((id: unknown): id is string => typeof id === "string" && id !== interaction.guildId)
  ));
  const additionalRoles: string[] = selectedReason?.additionalRoles || [];
  const allAllowedRoles = Array.from(new Set([...allSupportRoles, ...additionalRoles])).filter((id) => id !== interaction.guildId);

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

  const { ticketChannel, ticket: ticketRecord } = await createPrivateTicket(
    interaction.guild, interaction.user, channelName, categoryId, allSupportRoles, allAllowedRoles, panel.id,
  );

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
    .setDescription(welcomeDesc.substring(0, 4096))
    .setTimestamp();

  if (welcomeColorHex !== "none") welcomeEmbed.setColor(welcomeColorHex as `#${string}`);

  if (selectedReason?.name || selectedReason?.label) {
    welcomeEmbed.addFields({
      name: "Ticket Type",
      value: `${selectedReason.emoji || "🎫"} ${selectedReason.name || selectedReason.label}`.substring(0, 1024),
    });
  }

  const answeredQuestions = formAnswers?.filter(({ answer }) => answer.trim()) ?? [];
  if (answeredQuestions.length > 0) {
    const answerLimit = Math.floor(1024 / answeredQuestions.length) - 55;
    const formattedAnswers = answeredQuestions.map(({ label, answer }) => {
      const trimmed = answer.trim();
      const abbreviated = trimmed.length > answerLimit ? `${trimmed.substring(0, answerLimit - 1)}…` : trimmed;
      // Keep backticks inside the answer from ending the inline code span.
      const code = abbreviated.replace(/`/g, "`\u200b");
      const formattedCode = code.length > answerLimit ? `${code.substring(0, answerLimit - 2)}\u200b…` : code;
      return `**${label.substring(0, 45)}**\n\`\`${formattedCode}\`\``;
    });

    welcomeEmbed.addFields({ name: "Answers", value: formattedAnswers.join("\n\n") });
  }

  const welcomeThumbnail = selectedReason?.welcomeThumbnail || panel.welcomeThumbnail;
  const welcomeImage = selectedReason?.welcomeImage || panel.welcomeImage;
  const welcomeFooter = selectedReason?.welcomeFooter || panel.welcomeFooter;

  if (welcomeThumbnail && isValidUrl(welcomeThumbnail)) welcomeEmbed.setThumbnail(welcomeThumbnail.trim());
  if (welcomeImage && isValidUrl(welcomeImage)) welcomeEmbed.setImage(welcomeImage.trim());
  if (welcomeFooter) welcomeEmbed.setFooter({ text: welcomeFooter });



  // Supporter role mentions
  const supportPings = allSupportRoles.map((r) => `<@&${r}>`).join(" ");

  await ticketChannel.send({
    content: `${interaction.user} ${supportPings}`.trim(),
    embeds: [welcomeEmbed],
    components: [ticketControlRow(ticketRecord.id)],
  });

  const successContent = `✅ Ticket created successfully! Head over to ${ticketChannel}.`;
  if (interaction.deferred) {
    await interaction.editReply({ content: successContent });
  } else {
    await interaction.reply({ content: successContent, ephemeral: true });
  }
}

async function createPrivateTicket(
  guild: Guild, user: User, channelName: string, categoryId: string | undefined,
  allSupportRoles: string[], allAllowedRoles: string[], panelId?: string, applicationId?: string,
) {
  const permissionOverwrites: import("discord.js").OverwriteResolvable[] = [
    {
      id: guild.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: guild.client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
      ],
    },
    {
      id: user.id,
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
          ...(allSupportRoles.includes(roleId) ? [PermissionFlagsBits.ManageChannels] : []),
        ],
      });
    }
  });

  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: categoryId,
    permissionOverwrites,
  });

  const ticket = await createTicketRecord({
    guildId: guild.id, panelId, channelId: ticketChannel.id,
    userId: user.id, userTag: user.tag, userAvatar: user.displayAvatarURL({ extension: "png" }),
    categoryId, applicationId, applicationRoles: applicationId ? allSupportRoles : undefined,
  }).catch(async error => {
    await ticketChannel.delete("Ticket record could not be saved").catch(console.error);
    throw error;
  });
  return { ticketChannel, ticket };
}

function ticketControlRow(ticketId: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ticket_close:${ticketId}`).setLabel("Close").setEmoji("🔒").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket_claim:${ticketId}`).setLabel("Claim").setEmoji("👤").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`ticket_adduser:${ticketId}`).setLabel("Add User").setEmoji("➕").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket_remuser:${ticketId}`).setLabel("Remove User").setEmoji("➖").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket_transcript:${ticketId}`).setLabel("Transcript").setEmoji("📄").setStyle(ButtonStyle.Secondary)
  );
}

export async function createApplicationTicket(guild: Guild, user: User, application: {
  id: string; appNumber: number;
}, categoryId: string, reviewerIds: string[]) {
  const category = await guild.channels.fetch(categoryId, { force: true });
  if (category?.type !== ChannelType.GuildCategory) throw new Error("The configured ticket category is unavailable.");
  const roles = (await guild.roles.fetch());
  const supportRoles = reviewerIds.filter(id => id !== guild.id && roles.has(id));
  return createPrivateTicket(guild, user, `application-${application.appNumber}`, category.id,
    supportRoles, supportRoles, undefined, application.id);
}

export async function postApplicationTicketWelcome(channel: TextChannel, ticketId: string, userId: string, appNumber: number) {
  const existing = await channel.messages.fetch({ limit: 20 });
  if (existing.some(msg => msg.author.id === channel.client.user.id && msg.components.some(row =>
    "components" in row && row.components.some(component => "customId" in component && component.customId === `ticket_close:${ticketId}`)
  ))) return;
  await channel.send({
    content: `<@${userId}> This ticket is linked to application #${appNumber}.`,
    allowedMentions: { parse: [], users: [userId] },
    components: [ticketControlRow(ticketId)],
    nonce: ticketId.replace(/-/g, "").slice(0, 24), enforceNonce: true,
  });
}

async function handleCloseRequest(
  interaction: ChatInputCommandInteraction,
  ticket: Awaited<ReturnType<typeof getTicketByChannelId>>
) {
  if (!await requireTicketSupport(interaction, ticket) || !ticket) return;
  if (ticket.status === "CLOSED" || interaction.channel?.type !== ChannelType.GuildText) {
    return interaction.reply({ content: "This command requires an open ticket channel.", ephemeral: true });
  }

  const reason = interaction.options.getString("reason")?.trim() || "Resolved";
  const embed = new EmbedBuilder()
    .setTitle("Ticket Closure Requested")
    .setDescription(`<@${interaction.user.id}> requested to close this ticket.`)
    .addFields({ name: "Reason", value: reason })
    .setColor("#FEE75C");
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_close_request:${ticket.id}`)
      .setLabel("Confirm Closure")
      .setStyle(ButtonStyle.Danger)
  );

  await interaction.reply({
    content: `<@${ticket.userId}>, please confirm if your ticket can be closed.`,
    allowedMentions: { users: [ticket.userId] },
    embeds: [embed],
    components: [row],
  });
}

async function handleCloseRequestConfirmation(interaction: ButtonInteraction, ticketId: string) {
  await interaction.deferReply({ ephemeral: true });
  const channel = interaction.channel;
  const ticket = await getTicketByChannelId(interaction.channelId);
  if (!ticket || ticket.id !== ticketId || ticket.guildId !== interaction.guildId || channel?.type !== ChannelType.GuildText) {
    return interaction.editReply("This request must be confirmed in its ticket channel.");
  }
  if (interaction.user.id !== ticket.userId) {
    return interaction.editReply("Only the ticket creator can confirm this request.");
  }
  if (ticket.status === "CLOSED") {
    return interaction.editReply("This ticket is already closed.");
  }
  const lastClosedAt = ticket.closedTimestamp ?? ticket.closedAt;
  if (lastClosedAt && lastClosedAt.getTime() >= interaction.message.createdTimestamp) {
    return interaction.editReply("This request has expired. Staff can send a new one with /closerequest.");
  }

  const reason = interaction.message.embeds[0]?.fields.find((field) => field.name === "Reason")?.value || "Resolved";
  if (!await closeTicket(ticket, channel, interaction.user, reason)) {
    return interaction.editReply("This ticket is already closed or is being closed.");
  }

  await interaction.message.edit({ components: [] }).catch((error) => {
    console.error("[TicketHandler] Failed to disable the confirmed closure request:", error);
  });
  await interaction.editReply("Ticket closed.");
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

  await closeTicket(ticket, interaction.channel as TextChannel | null, interaction.user, closeReason, interaction);
}

const closedCategoryName = "Closed Tickets";
const pendingClosedCategories = new Map<string, Promise<string>>();
const closingTickets = new Set<string>();

export class ClosedTicketCategoryError extends Error {}

async function getClosedCategoryId(channel: TextChannel, configuredId: string | null): Promise<string> {
  const { guild } = channel;
  if (configuredId) {
    const category = await guild.channels.fetch(configuredId, { force: true }).catch((error) => {
      if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownChannel) return null;
      throw error;
    });
    if (category?.type !== ChannelType.GuildCategory || category.guild.id !== guild.id) {
      throw new ClosedTicketCategoryError("The configured closed ticket category is unavailable. Update it in the ticket settings.");
    }
    if (channel.parentId !== category.id && category.children.cache.size >= 50) {
      throw new ClosedTicketCategoryError("The configured closed ticket category is full. Free up space or choose another category.");
    }
    return category.id;
  }

  const pending = pendingClosedCategories.get(guild.id);
  if (pending) return pending;

  const resolveCategory = (async () => {
    const channels = await guild.channels.fetch();
    const existing = channels.find((channel) =>
      channel?.type === ChannelType.GuildCategory && channel.name === closedCategoryName && channel.children.cache.size < 50
    );
    if (existing) return existing.id;

    const category = await guild.channels.create({
      name: closedCategoryName,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }],
    });
    return category.id;
  })().finally(() => pendingClosedCategories.delete(guild.id));

  pendingClosedCategories.set(guild.id, resolveCategory);
  return resolveCategory;
}

export async function closeTicket(
  ticket: NonNullable<Awaited<ReturnType<typeof getTicketByChannelId>>>,
  channel: TextChannel | null,
  actor: { id: string; tag: string },
  closeReason: string,
  interaction?: ButtonInteraction | ChatInputCommandInteraction
) {
  if (closingTickets.has(ticket.id)) {
    await interaction?.editReply({ content: "This ticket is already being closed." });
    return false;
  }

  closingTickets.add(ticket.id);
  try {
    const current = await getTicketByChannelId(ticket.channelId);
    if (!current || current.id !== ticket.id || current.status === "CLOSED") {
      await interaction?.editReply({ content: "This ticket is already closed or unavailable." });
      return false;
    }
    await executeTicketClose(current, channel, actor, closeReason, interaction);
    return true;
  } finally {
    closingTickets.delete(ticket.id);
  }
}

async function executeTicketClose(
  ticket: NonNullable<Awaited<ReturnType<typeof getTicketByChannelId>>>,
  channel: TextChannel | null,
  actor: { id: string; tag: string },
  closeReason: string,
  interaction?: ButtonInteraction | ChatInputCommandInteraction
) {
  const settings = await getTicketSettings(ticket.guildId);
  const originalCategoryId = channel ? channel.parentId : ticket.categoryId;
  if (channel) {
    const closedCategoryId = await getClosedCategoryId(channel, settings.closedCategoryId);
    const creatorOverwrite = channel.permissionOverwrites.cache.get(ticket.userId);
    const previousSend = creatorOverwrite?.allow.has(PermissionFlagsBits.SendMessages)
      ? true
      : creatorOverwrite?.deny.has(PermissionFlagsBits.SendMessages) ? false : null;

    await channel.permissionOverwrites.edit(ticket.userId, { SendMessages: false });
    if (channel.parentId !== closedCategoryId) {
      try {
        await channel.setParent(closedCategoryId, { lockPermissions: false });
      } catch (error) {
        await channel.permissionOverwrites.edit(ticket.userId, { SendMessages: previousSend }).catch((rollbackError) => {
          console.error("[TicketHandler] Failed to restore ticket permissions:", rollbackError);
        });
        throw error;
      }
    }
  }

  const now = new Date();

  await updateTicketStatus(ticket.id, "CLOSED", {
    closedByUserId: actor.id,
    closedByTag: actor.tag,
    closeReason,
    closedTimestamp: now,
    categoryId: originalCategoryId,
  });

  await createTicketLog({
    guildId: ticket.guildId,
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    action: "CLOSED",
    executorId: actor.id,
    executorTag: actor.tag,
    details: `Ticket #${ticket.ticketNumber} closed by ${actor.tag} (Reason: ${closeReason})`,
  });

  const closedEmbed = new EmbedBuilder()
    .setTitle(`Ticket #${ticket.ticketNumber} Closed`)
    .setDescription(`Closed by <@${actor.id}>.\nUse the buttons below to reopen or permanently delete.`)
    .setColor("#ED4245")
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ticket_reopen:${ticket.id}`).setLabel("Reopen").setEmoji("🔓").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ticket_transcript:${ticket.id}`).setLabel("Transcript").setEmoji("📄").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket_delete:${ticket.id}`).setLabel("Delete").setEmoji("🗑").setStyle(ButtonStyle.Danger)
  );

  const message = { embeds: [closedEmbed], components: [row] };
  if (interaction) {
    await interaction.editReply(message);
  } else if (channel) {
    await channel.send(message).catch((error) => {
      console.error("[TicketHandler] Error posting ticket close message:", error);
    });
  }

  // Post Ticket Log Embed to Log Channel matching attached screenshot!
  const guild = interaction?.guild ?? channel?.guild;
  if (settings.logChannelId && guild) {
    const logChannel = (await guild.channels.fetch(settings.logChannelId).catch(() => null)) as TextChannel;
    if (logChannel && logChannel.isTextBased()) {
      await sendTicketCloseLogEmbed(logChannel, ticket, actor, closeReason, now);
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

async function handleTicketClaim(interaction: ButtonInteraction | ChatInputCommandInteraction, ticketId: string) {
  const ticket = await getTicketById(ticketId);
  if (!await requireTicketSupport(interaction, ticket) || !ticket) return;
  if (ticket.status !== "OPEN") {
    return interaction.reply({ content: "❌ Only open, unclaimed tickets can be claimed.", ephemeral: true });
  }

  await interaction.deferReply();

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

async function handleTicketReopen(interaction: ButtonInteraction | ChatInputCommandInteraction, ticketId: string) {
  const ticket = await getTicketById(ticketId);
  if (!await requireTicketSupport(interaction, ticket) || !ticket) return;
  if (ticket.status !== "CLOSED") {
    return interaction.reply({ content: "❌ Only closed tickets can be reopened.", ephemeral: true });
  }

  const channel = interaction.channel;
  if (channel?.type !== ChannelType.GuildText) {
    return interaction.reply({ content: "❌ The ticket channel is unavailable.", ephemeral: true });
  }

  await interaction.deferReply();
  await reopenTicket(ticket, channel, interaction.user);

  const reopenEmbed = new EmbedBuilder()
    .setDescription(`🔓 Ticket reopened by ${interaction.user}.`)
    .setColor("#57F287");

  await interaction.editReply({ embeds: [reopenEmbed] });
}

export async function reopenTicket(
  ticket: NonNullable<Awaited<ReturnType<typeof getTicketById>>>,
  channel: TextChannel,
  actor: { id: string; tag: string }
) {
  const originalCategory = ticket.categoryId
    ? await channel.guild.channels.fetch(ticket.categoryId).catch((error) => {
        if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownChannel) return null;
        throw error;
      })
    : null;
  const destination = originalCategory?.type === ChannelType.GuildCategory ? originalCategory.id : null;
  const closedCategoryId = channel.parentId;
  if (closedCategoryId !== destination) {
    await channel.setParent(destination, { lockPermissions: false });
  }
  try {
    await channel.permissionOverwrites.edit(ticket.userId, { SendMessages: true, ViewChannel: true });
  } catch (error) {
    if (closedCategoryId !== destination) {
      await channel.setParent(closedCategoryId, { lockPermissions: false }).catch((rollbackError) => {
        console.error("[TicketHandler] Failed to restore closed ticket category:", rollbackError);
      });
    }
    throw error;
  }

  await updateTicketStatus(ticket.id, "OPEN");
  await createTicketLog({
    guildId: ticket.guildId,
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    action: "REOPENED",
    executorId: actor.id,
    executorTag: actor.tag,
    details: `Ticket #${ticket.ticketNumber} reopened by ${actor.tag}`,
  });
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
  const ticket = await getTicketById(ticketId);
  if (!await requireTicketSupport(interaction, ticket)) return;
  if (ticket?.status === "CLOSED") {
    return interaction.reply({ content: "❌ Reopen this ticket before adding members.", ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId(`ticket_adduser_modal:${ticketId}`)
    .setTitle("Add User to Ticket");

  const userInput = new TextInputBuilder()
    .setCustomId("user_id")
    .setLabel("Discord User ID")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("e.g. 123456789012345678")
    .setRequired(true);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(userInput);
  modal.addComponents(row);

  await interaction.showModal(modal);
}

async function handleTicketRemUserPrompt(interaction: ButtonInteraction, ticketId: string) {
  if (!await requireTicketSupport(interaction, await getTicketById(ticketId))) return;

  const modal = new ModalBuilder()
    .setCustomId(`ticket_remuser_modal:${ticketId}`)
    .setTitle("Remove User from Ticket");

  const userInput = new TextInputBuilder()
    .setCustomId("user_id")
    .setLabel("Discord User ID")
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
      answer: interaction.fields.getTextInputValue(`q_${idx}`),
    }));

    await handleTicketOpen(interaction, panel, selectedReason, formAnswers);
  } else if (customId.startsWith("ticket_adduser_modal:")) {
    const ticketId = customId.split(":")[1];
    const userIdInput = interaction.fields.getTextInputValue("user_id").trim();
    const channel = interaction.channel as TextChannel;
    const ticket = await getTicketById(ticketId);

    if (!await requireTicketSupport(interaction, ticket)) return;
    if (ticket?.status === "CLOSED") {
      return interaction.reply({ content: "❌ Reopen this ticket before adding members.", ephemeral: true });
    }

    if (channel && ticket) {
      const member = /^\d{17,20}$/.test(userIdInput)
        ? await channel.guild.members.fetch(userIdInput).catch(() => null)
        : null;
      if (!member) return interaction.reply({ content: "❌ Enter the Discord ID of a server member.", ephemeral: true });
      await channel.permissionOverwrites.edit(member, {
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

    if (!await requireTicketSupport(interaction, ticket)) return;

    if (channel && ticket) {
      const overwrite = channel.permissionOverwrites.cache.get(userIdInput);
      if (overwrite?.type !== OverwriteType.Member || userIdInput === ticket.userId || userIdInput === interaction.client.user.id) {
        return interaction.reply({ content: "❌ This member cannot be removed from the ticket.", ephemeral: true });
      }
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
