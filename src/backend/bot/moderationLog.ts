import type { ModerationCase } from "@prisma/client";
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, escapeMarkdown, Guild, PermissionFlagsBits,
} from "discord.js";
import type { ModerationSettings } from "../../types/moderation";
import { getModerationSettings, moderationDb } from "../services/moderationService";
import { applicationMessage } from "./applicationComponents";

export async function privateModLogChannel(guild: Guild, id: string) {
  const channel = await guild.channels.fetch(id, { force: true });
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error("Choose a server text channel.");
  }
  if (channel.permissionsFor(guild.roles.everyone).has(PermissionFlagsBits.ViewChannel)) {
    throw new Error("Deny View Channel for @everyone in the mod-log channel.");
  }
  const bot = await guild.members.fetchMe();
  if (!channel.permissionsFor(bot).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
    throw new Error("The bot needs View Channel and Send Messages in the mod-log channel.");
  }
  return channel;
}

const actions: Record<string, string> = {
  warn: "Warning",
  timeout: "Timeout",
  untimeout: "Timeout removed",
  auto_log: "AutoMod · Log only",
  auto_delete: "AutoMod · Delete and log",
};

export function moderationButton(customId: string, label: string, style = ButtonStyle.Secondary) {
  return new ButtonBuilder().setCustomId(`mod:${customId}`).setLabel(label).setStyle(style);
}

export function describeCase(record: ModerationCase) {
  const trigger = record.moderatorId ? `<@${record.moderatorId}>` : `AutoMod · ${record.ruleIds}`;
  const duration = record.durationSeconds ? ` · Duration: ${record.durationSeconds / 60} min` : "";
  const reversal = record.reversesCaseNumber ? ` · Reverses #${record.reversesCaseNumber}` : "";
  const outcome = record.status === "succeeded" ? "" : record.status === "pending"
    ? "\n**Outcome unconfirmed**"
    : `\n**Action failed:** ${escapeMarkdown(record.error ?? "Discord rejected the action.")}`;
  return [
    `**#${record.number} · ${(actions[record.action] ?? record.action)}** · <t:${Math.floor(record.createdAt.getTime() / 1000)}:f>`,
    `Trigger: ${trigger}${duration}${reversal}`,
    `Reason: ${escapeMarkdown(record.reason)}${outcome}`,
  ].join("\n");
}

export async function publishModerationCase(guild: Guild, record: ModerationCase, settings?: ModerationSettings) {
  try {
    const id = (settings ?? await getModerationSettings(guild.id)).logChannelId;
    if (!id) return "No mod-log channel is configured.";
    const channel = await privateModLogChannel(guild, id);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      moderationButton(`history:${record.number}`, "View history"),
    );
    if (["warn", "timeout", "ban", "slowmode"].includes(record.action) && record.status === "succeeded") {
      row.addComponents(moderationButton(`lift:${record.number}`, "Reverse case", ButtonStyle.Danger));
    }
    const target = ["purge", "slowmode"].includes(record.action) ? `<#${record.targetId}>` : `<@${record.targetId}>`;
    const sent = await channel.send(applicationMessage(`Target: ${target}\n${describeCase(record)}`, [row]));
    if (sent?.url) await moderationDb.moderationCase.update({ where: { guildId_number: { guildId: guild.id, number: record.number } }, data: { logMessageUrl: sent.url } });
  } catch (error) {
    console.warn(`[Moderation] Could not publish case ${guild.id}/${record.number}:`, error);
    return "The case was saved, but the mod-log card could not be sent. Check channel access and privacy.";
  }
}
