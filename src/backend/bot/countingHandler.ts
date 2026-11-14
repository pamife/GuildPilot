import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  Client,
  ComponentType,
  ContainerBuilder,
  DiscordAPIError,
  DiscordjsError,
  GatewayIntentBits,
  Guild,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  RESTJSONErrorCodes,
  SlashCommandBuilder,
} from "discord.js";
import {
  getCountingStats,
  processCountingMessage,
  resetCountingRun,
  setCountingChannel,
} from "../services/countingService";
import { broadcastGuildEvent } from "../socket/socketManager";

export const countingCommand = new SlashCommandBuilder()
  .setName("counting")
  .setDescription("Play and manage Relay Count")
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) => sub.setName("setup").setDescription("Set the counting channel")
    .addChannelOption((option) => option.setName("channel").setDescription("Relay Count text channel")
      .addChannelTypes(ChannelType.GuildText).setRequired(true)))
  .addSubcommand((sub) => sub.setName("stats").setDescription("Show the current run, record and Relay Save"))
  .addSubcommand((sub) => sub.setName("reset").setDescription("Reset the current run after confirmation"));

export async function countingChannelError(guild: Guild, channelId: string): Promise<string | null> {
  if (!guild.client.options.intents.has(GatewayIntentBits.MessageContent)) {
    return "Enable Message Content Intent in the Discord Developer Portal and restart the bot.";
  }

  const channel = await guild.channels.fetch(channelId, { force: true }).catch((error: unknown) => {
    if ((error instanceof DiscordAPIError &&
      (error.code === RESTJSONErrorCodes.UnknownChannel || error.code === RESTJSONErrorCodes.MissingAccess)) ||
      (error instanceof DiscordjsError && error.code === "GuildChannelUnowned")) {
      return null;
    }
    throw error;
  });
  if (!channel || channel.type !== ChannelType.GuildText) return "Choose a server text channel the bot can view.";
  const permissions = channel.permissionsFor(await guild.members.fetchMe());
  const required = {
    "View Channel": PermissionFlagsBits.ViewChannel,
    "Send Messages": PermissionFlagsBits.SendMessages,
    "Read Message History": PermissionFlagsBits.ReadMessageHistory,
    "Add Reactions": PermissionFlagsBits.AddReactions,
  };
  const missing = Object.entries(required).filter(([, flag]) => !permissions?.has(flag)).map(([name]) => name);
  return missing.length ? `Missing bot permissions in <#${channelId}>: ${missing.join(", ")}.` : null;
}

export function notifyCountingChanged(guildId: string) {
  broadcastGuildEvent(guildId, "countingChanged", { guildId });
}

function card(text: string) {
  return new ContainerBuilder()
    .setAccentColor(0x5865f2)
    .addTextDisplayComponents((display) => display.setContent(text));
}

async function handleCountingCommand(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild;
  if (!guild) return;
  const subcommand = interaction.options.getSubcommand();
  const flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
  if (subcommand !== "stats" && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ flags, components: [card("You need Manage Server to do that.")] });
    return;
  }

  if (subcommand === "reset") {
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("counting:confirm").setLabel("Reset run").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("counting:cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary),
    );
    const response = await interaction.reply({
      flags,
      components: [card("## Reset Relay Count?\nThe next number will be 1. The server record will be kept.")
        .addActionRowComponents(buttons)],
      withResponse: true,
    });
    const prompt = response.resource?.message ?? await interaction.fetchReply();
    const button = await prompt.awaitMessageComponent({
      componentType: ComponentType.Button,
      filter: (click) => click.user.id === interaction.user.id,
      time: 60_000,
    }).catch(() => null);

    let text = "Reset confirmation expired.";
    if (button) {
      await button.deferUpdate();
      if (!button.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        text = "You need Manage Server to reset the run.";
      } else if (button.customId === "counting:confirm") {
        const reset = await resetCountingRun(guild.id);
        if (reset) notifyCountingChanged(guild.id);
        text = reset ? "Relay Count was reset. The next number is **1**." : "Relay Count is not set up yet.";
      } else {
        text = "Reset cancelled.";
      }
    }
    await interaction.editReply({ components: [card(text)] });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  let text: string;
  if (subcommand === "setup") {
    const { id } = interaction.options.getChannel("channel", true);
    const error = await countingChannelError(guild, id);
    if (error) {
      text = error;
    } else {
      const game = await setCountingChannel(guild.id, id);
      notifyCountingChanged(guild.id);
      text = `## Relay Count\nCounting channel · <#${id}>\nNext number · **${game.nextNumber}**`;
    }
  } else {
    const game = await getCountingStats(guild.id);
    const save = game.saveStatus === "available"
      ? `Relay progress · **${game.relayProgress}/5**`
      : `Relay Save · **${game.saveStatus === "charged" ? "Ready" : "Used this run"}**`;
    text = game.channelId
      ? `## Relay Count\nChannel · <#${game.channelId}>\nNext number · **${game.nextNumber}**\nServer record · **${game.record}**\n${save}`
      : "## Relay Count\nNo counting channel is configured.";
  }
  await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [card(text)] });
}

export function setupCountingInteractions(client: Client) {
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== "counting") return;
    try {
      await handleCountingCommand(interaction);
    } catch (error) {
      console.error("[Relay Count] Command failed:", error);
      const components = [card("Relay Count could not complete that action. Please try again.")];
      const reply = interaction.deferred || interaction.replied
        ? interaction.editReply({ components, flags: MessageFlags.IsComponentsV2 })
        : interaction.reply({ components, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
      await reply.catch((err) => console.warn("[Relay Count] Failed to report command error:", err));
    }
  });

  client.on("messageCreate", async (message) => {
    if (!message.guildId || message.channel.type !== ChannelType.GuildText ||
      message.author.bot || message.webhookId || message.system) return;

    try {
      const result = await processCountingMessage({
        guildId: message.guildId,
        channelId: message.channelId,
        messageId: message.id,
        playerId: message.author.id,
        content: message.content,
      });
      if (!result) return;
      notifyCountingChanged(message.guildId);

      const valid = result.outcome === "valid" || result.outcome === "earned";
      const effects: Promise<unknown>[] = [message.react(valid ? "✅" : "❌")];
      const notice = {
        valid: null,
        earned: "🤝 Five counters, one clean relay. Your next mistake is covered.",
        saved: `🛟 Relay Save used! The next number is still **${result.nextNumber}**.`,
        reset: "❌ The run ended. Start again at **1**.",
      }[result.outcome];

      if (notice) {
        effects.push(message.channel.send({
          flags: MessageFlags.IsComponentsV2,
          components: [card(notice)],
        }));
      }
      for (const effect of await Promise.allSettled(effects)) {
        if (effect.status === "rejected") console.warn("[Relay Count] Discord feedback failed:", effect.reason);
      }
    } catch (error) {
      console.error("[Relay Count] Failed to process message:", error);
    }
  });
}
