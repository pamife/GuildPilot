import type { ModerationCase } from "@prisma/client";
import {
  ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, Client,
  ContainerBuilder, DiscordAPIError, escapeMarkdown, Events, Guild, GuildMember, ModalSubmitInteraction,
  Interaction, InteractionContextType, MessageFlags, ModalBuilder, PermissionFlagsBits, RESTJSONErrorCodes,
  SlashCommandBuilder, TextInputBuilder, TextInputStyle,
} from "discord.js";
import type { ModerationSettings } from "../../types/moderation";
import {
  finishCase, getModerationSettings, moderationDb, reserveCase, serializeModeration,
} from "../services/moderationService";
import { applicationMessage } from "./applicationComponents";
import { describeCase, moderationButton, publishModerationCase } from "./moderationLog";

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
  command("cases", "Privately view a user's moderation history"),
];

type Operation = "warn" | "timeout" | "untimeout" | "cases";
type ModInteraction = ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction;

class ModerationError extends Error {}

export function canModerate(
  actor: GuildMember, target: GuildMember | null, action: Operation, settings: ModerationSettings,
) {
  const timeout = action === "timeout" || action === "untimeout";
  const permission = timeout ? PermissionFlagsBits.ModerateMembers : PermissionFlagsBits.ManageMessages;
  const roles = timeout ? settings.timeoutRoleIds : settings.reviewRoleIds;
  if (!actor.permissions.has(permission)) return false;
  if (!actor.permissions.has(PermissionFlagsBits.Administrator) &&
      !roles.some(id => id !== actor.guild.id && actor.roles.cache.has(id))) return false;

  if (!target) return action === "cases";
  if (actor.id === target.id) return action === "cases";
  if (target.id === actor.guild.ownerId) return false;
  return actor.id === actor.guild.ownerId || actor.roles.highest.comparePositionTo(target.roles.highest) > 0;
}

export function canLiftRecordedTimeout(record: ModerationCase, latest: ModerationCase | null, currentUntil: number) {
  return record.action === "timeout" && record.status === "succeeded" &&
    latest?.number === record.number && record.timeoutUntil?.getTime() === currentUntil &&
    currentUntil > Date.now();
}

function latestRecordedTimeout(guildId: string, targetId: string) {
  return moderationDb.moderationCase.findFirst({
    where: { guildId, targetId, action: "timeout", status: { in: ["pending", "succeeded"] } },
    orderBy: { number: "desc" },
  });
}

async function fetchTarget(guild: Guild, id: string, action: Operation) {
  try {
    return await guild.members.fetch({ user: id, force: true });
  } catch (error) {
    if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownMember) {
      if (action === "cases") return null;
      throw new ModerationError("This user is no longer a server member.");
    }
    throw error;
  }
}

async function authorize(guild: Guild, actorId: string, targetId: string, action: Operation) {
  const [settings, actor, target] = await Promise.all([
    getModerationSettings(guild.id),
    guild.members.fetch({ user: actorId, force: true }),
    fetchTarget(guild, targetId, action),
  ]);
  if (!canModerate(actor, target, action, settings)) {
    throw new ModerationError("You need the configured moderator role, Discord permission and sufficient role hierarchy.");
  }
  if ((action === "timeout" || action === "untimeout") && target) {
    const bot = await guild.members.fetchMe({ force: true });
    if (target.id === bot.id || !target.moderatable) {
      throw new ModerationError("The bot cannot manage this timeout. Check Moderate Members and the bot's role hierarchy.");
    }
  }
  return { settings, target };
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

async function moderate(
  guild: Guild, interaction: ModInteraction, targetId: string, action: Exclude<Operation, "cases">,
  reasonInput: string, minutes?: number, dm = false, fromCase?: ModerationCase,
) {
  const reason = reasonInput.trim();
  if (!reason || reason.length > maxReasonLength) throw new ModerationError("Enter a valid reason.");
  if (action === "timeout" && (!minutes || !Number.isInteger(minutes) || minutes < 1 || minutes > maxTimeoutMinutes)) {
    throw new ModerationError("Choose a timeout from 1 minute to 28 days.");
  }

  return serializeModeration(`member:${guild.id}:${targetId}`, async () => {
    const sourceId = `interaction:${interaction.id}`;
    if (await moderationDb.moderationCase.findUnique({ where: { sourceId } })) return;
    const { settings, target } = await authorize(guild, interaction.user.id, targetId, action);
    if (!target) throw new ModerationError("This user is no longer a server member.");
    let reversesCaseNumber: number | undefined;

    if (action === "untimeout") {
      const latest = await latestRecordedTimeout(guild.id, targetId);
      const currentUntil = target.communicationDisabledUntilTimestamp ?? 0;
      if (fromCase && !canLiftRecordedTimeout(fromCase, latest, currentUntil)) {
        throw new ModerationError("This case no longer owns the active timeout. Use /untimeout for the current timeout.");
      }
      if (currentUntil <= Date.now()) throw new ModerationError("This member has no active timeout.");
      if (latest && canLiftRecordedTimeout(latest, latest, currentUntil)) reversesCaseNumber = latest.number;
    }

    const { created } = await reserveCase({
      sourceId, guildId: guild.id, targetId, action, reason, moderatorId: interaction.user.id,
      durationSeconds: minutes ? minutes * 60 : undefined, reversesCaseNumber,
    });
    if (!created) return;

    let timeoutUntil: Date | null = null;
    let discordError: string | undefined;
    try {
      if (action !== "warn") {
        const updated = await target.timeout(minutes ? minutes * 60_000 : null, reason);
        timeoutUntil = updated.communicationDisabledUntil;
      }
    } catch (error) {
      console.warn(`[Moderation] Discord rejected ${action} for ${guild.id}/${targetId}:`, error);
      discordError = "Discord could not confirm the timeout change. Check the member's current timeout and the bot's permissions.";
    }

    const record = await finishCase(sourceId, discordError ? "failed" : "succeeded", { timeoutUntil, error: discordError });
    const logError = await publishModerationCase(guild, record, settings);
    const notes = [logError];
    if (dm && !discordError) {
      try {
        const actionText = action === "warn" ? "You received a warning." : `You received a ${minutes}-minute timeout.`;
        await target.send(applicationMessage(
          `## Moderation in ${escapeMarkdown(guild.name)}\n${actionText}\nReason: ${escapeMarkdown(reason)}`,
        ));
      } catch {
        notes.push("The action was applied, but the user's DM could not be delivered.");
      }
    }
    await interaction.editReply(applicationMessage([describeCase(record), ...notes.filter(Boolean)].join("\n\n")));
  });
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
  } else if (opensModal && record.action === "timeout") {
    const [{ target }, latest] = await Promise.all([
      authorize(guild, interaction.user.id, record.targetId, "untimeout"),
      latestRecordedTimeout(guild.id, record.targetId),
    ]);
    if (!canLiftRecordedTimeout(record, latest, target?.communicationDisabledUntilTimestamp ?? 0)) {
      throw new ModerationError("This case no longer owns the active timeout.");
    }
    const input = new TextInputBuilder().setCustomId("reason").setLabel("Reason for removing the timeout")
      .setRequired(true).setMaxLength(maxReasonLength).setStyle(TextInputStyle.Paragraph);
    await interaction.showModal(new ModalBuilder().setCustomId(`mod:confirm:${record.number}`)
      .setTitle(`Remove timeout #${record.number}`)
      .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input)));
  } else if (interaction.isModalSubmit() && control === "confirm" && record.action === "timeout") {
    await moderate(guild, interaction, record.targetId, "untimeout",
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
      const targetId = interaction.options.getUser("user", true).id;
      if (action === "cases") {
        await interaction.editReply(await showHistory(interaction.guild, interaction.user.id, targetId));
      } else {
        await moderate(interaction.guild, interaction, targetId, action, interaction.options.getString("reason", true),
          interaction.options.getInteger("minutes") ?? undefined, interaction.options.getBoolean("dm") ?? false);
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
