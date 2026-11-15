import type { ModerationCase } from "@prisma/client";
import {
  ActionRowBuilder, ButtonBuilder, ButtonInteraction, ChatInputCommandInteraction, Client,
  ContainerBuilder, DiscordAPIError, Events, Guild, ModalSubmitInteraction,
  Interaction, InteractionContextType, MessageFlags, ModalBuilder, RESTJSONErrorCodes,
  SlashCommandBuilder, TextInputBuilder, TextInputStyle,
} from "discord.js";
import type { ModerationAction } from "../../types/moderation";
import { authorizeAction, authorizePermission, executeModeration, ModerationError } from "../services/moderationActions";
export { canModerate, canLiftRecordedTimeout } from "../services/moderationActions";
import {
  moderationDb,
} from "../services/moderationService";
import { applicationMessage } from "./applicationComponents";
import { describeCase, moderationButton } from "./moderationLog";

const maxReasonLength = 450;
const maxTimeoutMinutes = 28 * 24 * 60;

function command(name: string, description: string) {
  return new SlashCommandBuilder().setName(name).setDescription(description).setContexts(InteractionContextType.Guild)
    .addUserOption(option => option.setName("user").setDescription("Target user").setRequired(true));
}

function withReason(builder: ReturnType<typeof command>) {
  return builder.addStringOption(option => option.setName("reason").setDescription("Reason for the action")
    .setMaxLength(maxReasonLength).setRequired(true));
}

function withDm(builder: ReturnType<typeof withReason>) {
  return builder.addBooleanOption(option => option.setName("dm").setDescription("Notify the user by direct message"));
}

export const moderationCommands = [
  withDm(withReason(command("warn", "Warn a server member"))),
  withDm(withReason(command("timeout", "Temporarily mute a server member"))
    .addIntegerOption(option => option.setName("minutes").setDescription("Timeout duration in minutes")
      .setMinValue(1).setMaxValue(maxTimeoutMinutes).setRequired(true))),
  withReason(command("untimeout", "Remove a server member's active timeout")),
  withDm(withReason(command("kick", "Kick a server member"))),
  withDm(withReason(command("ban", "Ban a user"))),
  new SlashCommandBuilder().setName("unban").setDescription("Unban a user by ID").setContexts(InteractionContextType.Guild)
    .addStringOption(o => o.setName("user_id").setDescription("Discord user ID").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true).setMaxLength(450)),
  new SlashCommandBuilder().setName("purge").setDescription("Delete up to 100 recent messages").setContexts(InteractionContextType.Guild)
    .addChannelOption(o => o.setName("channel").setDescription("Text channel").setRequired(true))
    .addIntegerOption(o => o.setName("count").setDescription("Maximum messages").setMinValue(1).setMaxValue(100).setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true).setMaxLength(450))
    .addUserOption(o => o.setName("user").setDescription("Optional author filter")),
  new SlashCommandBuilder().setName("slowmode").setDescription("Set or disable slowmode").setContexts(InteractionContextType.Guild)
    .addChannelOption(o => o.setName("channel").setDescription("Text channel").setRequired(true))
    .addIntegerOption(o => o.setName("seconds").setDescription("Seconds; 0 disables").setMinValue(0).setMaxValue(21600).setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true).setMaxLength(450)),
  command("cases", "Privately view a user's moderation history"),
];

type Operation = ModerationAction | "cases";
type ModInteraction = ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction;

async function authorize(guild: Guild, actorId: string, targetId: string, action: Operation) {
  if (action === "cases") return authorizePermission(guild, actorId, "cases");
  return authorizeAction(guild, actorId, targetId, action);
}

async function showHistory(guild: Guild, actorId: string, targetId: string, before?: number) {
  await authorize(guild, actorId, targetId, "cases");
  const records = await moderationDb.moderationCase.findMany({
    where: { guildId: guild.id, targetId, number: before ? { lt: before } : undefined },
    orderBy: { number: "desc" },
    take: 4,
  });
  const page = records.slice(0, 3);
  const row = new ActionRowBuilder<ButtonBuilder>();
  if (before) row.addComponents(moderationButton(`page:${actorId}:${targetId}:0`, "Newest"));
  if (records.length > page.length) {
    row.addComponents(moderationButton(`page:${actorId}:${targetId}:${page[page.length - 1].number}`, "Older"));
  }
  const history = new ContainerBuilder().addTextDisplayComponents(display =>
    display.setContent(`## Moderation history · <@${targetId}>`));
  for (const text of page.length ? page.map(describeCase) : ["No cases found."]) {
    history.addTextDisplayComponents(display => display.setContent(text));
  }
  return applicationMessage(history, row.components.length ? [row] : []);
}

async function moderate(guild: Guild, interaction: ModInteraction, targetId: string, action: ModerationAction,
  reason: string, minutes?: number, dm?: boolean, fromCase?: ModerationCase) {
  const slash = interaction.isChatInputCommand() ? interaction : null;
  const { record, notes } = await executeModeration(guild, interaction.user.id, {
    action, targetId, reason, requestId: `interaction:${interaction.id}`, dm,
    durationSeconds: action === "slowmode" ? slash?.options.getInteger("seconds") ?? 0 : minutes ? minutes * 60 : undefined,
    count: action === "purge" ? slash?.options.getInteger("count", true) : undefined,
    userFilter: action === "purge" ? slash?.options.getUser("user")?.id : undefined,
    reverseNumber: fromCase?.number,
  });
  await interaction.editReply(applicationMessage([describeCase(record), ...notes].join("\n\n")));
}

async function handleCaseControl(interaction: ModInteraction, guild: Guild, customId: string) {
  const [, control, value, targetId, before] = customId.split(":");
  if (interaction.isButton() && control === "page" && targetId && before) {
    if (interaction.user.id !== value) throw new ModerationError("Open your own history with /cases.");
    await interaction.deferUpdate();
    await interaction.editReply(await showHistory(guild, interaction.user.id, targetId, Number(before)));
    return;
  }

  if (!["history", "lift", "confirm"].includes(control) || !/^\d+$/.test(value)) return;
  if ((!interaction.isButton() && !interaction.isModalSubmit()) ||
      interaction.message?.author.id !== interaction.client.user.id) return;

  const opensModal = interaction.isButton() && control === "lift";
  if (!opensModal) await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const record = await moderationDb.moderationCase.findUnique({
    where: { guildId_number: { guildId: guild.id, number: Number(value) } },
  });
  if (!record) throw new ModerationError("This case is no longer available.");

  if (interaction.isButton() && control === "history") {
    await interaction.editReply(await showHistory(guild, interaction.user.id, record.targetId));
  } else if (opensModal && ["warn", "timeout", "ban", "slowmode"].includes(record.action)) {
    const reverse = { warn: "revoke_warn", timeout: "untimeout", ban: "unban", slowmode: "slowmode" }[record.action] as ModerationAction;
    await authorizeAction(guild, interaction.user.id, record.targetId, reverse);
    await authorizePermission(guild, interaction.user.id, "cases");
    const input = new TextInputBuilder().setCustomId("reason").setLabel("Reason for reversal")
      .setRequired(true).setMaxLength(maxReasonLength).setStyle(TextInputStyle.Paragraph);
    await interaction.showModal(new ModalBuilder().setCustomId(`mod:confirm:${record.number}`)
      .setTitle(`Reverse case #${record.number}`)
      .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input)));
  } else if (interaction.isModalSubmit() && control === "confirm") {
    const reverse = { warn: "revoke_warn", timeout: "untimeout", ban: "unban", slowmode: "slowmode" }[record.action] as ModerationAction;
    if (!reverse) throw new ModerationError("This case cannot be reversed.");
    await moderate(guild, interaction, record.targetId, reverse,
      interaction.fields.getTextInputValue("reason"), undefined, false, record);
  }
}

function handlesModeration(interaction: Interaction) {
  return (interaction.isChatInputCommand() && moderationCommands.some(command => command.name === interaction.commandName)) ||
    ((interaction.isButton() || interaction.isModalSubmit()) && interaction.customId.startsWith("mod:"));
}

export function setupModerationInteractions(client: Client) {
  client.on(Events.InteractionCreate, async interaction => {
    if (!handlesModeration(interaction) || !interaction.inCachedGuild()) return;
    if (!interaction.isChatInputCommand() && !interaction.isButton() && !interaction.isModalSubmit()) return;

    try {
      if (!interaction.isChatInputCommand()) {
        await handleCaseControl(interaction, interaction.guild, interaction.customId);
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const action = interaction.commandName as Operation;
      const targetId = action === "unban" ? interaction.options.getString("user_id", true) :
        action === "purge" || action === "slowmode" ? interaction.options.getChannel("channel", true).id :
        interaction.options.getUser("user", true).id;
      if (action === "cases") {
        await interaction.editReply(await showHistory(interaction.guild, interaction.user.id, targetId));
      } else {
        await moderate(interaction.guild, interaction, targetId, action, interaction.options.getString("reason", true),
          interaction.options.getInteger("minutes") ?? undefined, interaction.options.getBoolean("dm") ?? undefined);
      }
    } catch (error) {
      if (error instanceof DiscordAPIError &&
          (error.code === RESTJSONErrorCodes.InteractionHasAlreadyBeenAcknowledged ||
           error.code === RESTJSONErrorCodes.UnknownInteraction)) return;
      if (!(error instanceof ModerationError)) console.error("[Moderation] Interaction failed:", error);
      const text = error instanceof ModerationError ? error.message : "Could not confirm the moderation request. Check /cases before retrying.";
      const card = applicationMessage(text);
      const updatingHistory = interaction.isButton() && interaction.customId.startsWith("mod:page:");
      const reply = updatingHistory && interaction.deferred
        ? interaction.followUp({ ...card, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 })
        : interaction.deferred || interaction.replied
          ? interaction.editReply(card)
          : interaction.reply({ ...card, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
      await reply.catch(failure => console.warn("[Moderation] Could not report interaction error:", failure));
    }
  });
}
