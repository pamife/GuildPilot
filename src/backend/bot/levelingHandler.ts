import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, ComponentType, ContainerBuilder,
  escapeMarkdown, Events, Guild, InteractionContextType, MessageFlags, MessageType,
  PermissionFlagsBits, SectionBuilder, SlashCommandBuilder, TextDisplayBuilder, ThumbnailBuilder,
} from "discord.js";
import { levelProgress, Ranking } from "../../types/leveling";
import { awardChatXp, getLeaderboard, getLevelingConfig, getRank, prestigeMember } from "../services/levelingService";
import { needsRewardSync, syncLevelRewards } from "./levelingRewards";

export function levelingCard(text: string) {
  return new ContainerBuilder().setAccentColor(0x5865f2).addTextDisplayComponents((display) => display.setContent(text));
}

function command(name: string, description: string) {
  return new SlashCommandBuilder().setName(name).setDescription(description).setContexts(InteractionContextType.Guild);
}

export const levelingCommands = [
  command("rank", "Show a member's level and server rank")
    .addUserOption((option) => option.setName("member").setDescription("Member to look up")),
  command("leaderboard", "Show the server leaderboard")
    .addStringOption((option) => option.setName("ranking").setDescription("Leaderboard to show")
      .addChoices({ name: "Active XP", value: "xp" }, { name: "Prestige", value: "prestige" })),
  command("prestige", "Reset your active level and earn a prestige point"),
];

const componentsV2 = MessageFlags.IsComponentsV2;
const privateCard = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
const mentions = { parse: [] as never[] };

function button(id: string, label: string, style = ButtonStyle.Secondary) {
  return new ButtonBuilder().setCustomId(`leveling:${id}`).setLabel(label).setStyle(style);
}

async function leaderboardCard(guild: Guild, ranking: Ranking, requestedPage: number) {
  const { entries, page, pages } = await getLeaderboard(guild.id, ranking, requestedPage);
  const lines = entries.map((row) => ranking === "prestige"
    ? `**${row.position}.** <@${row.userId}> · Prestige ${row.prestige}`
    : `**${row.position}.** <@${row.userId}> · Level ${row.level} · ${row.xp.toLocaleString("en")} XP`);
  const title = ranking === "prestige" ? "Prestige leaderboard" : "XP leaderboard";
  const container = levelingCard(`## ${title}\n${lines.join("\n") || "No ranked members yet."}\n\nPage ${page} of ${pages}`);
  if (pages > 1) {
    container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
      button(`page:${ranking}:${page - 1}`, "Previous").setDisabled(page <= 1),
      button(`page:${ranking}:${page + 1}`, "Next").setDisabled(page >= pages),
    ));
  }
  return container;
}

export function setupLevelingInteractions(client: Client) {
  client.on(Events.MessageCreate, async (message) => {
    if (!message.inGuild() || message.author.bot || message.webhookId
      || (message.type !== MessageType.Default && message.type !== MessageType.Reply)) return;
    try {
      const award = await awardChatXp({
        guildId: message.guildId, channelId: message.channelId, userId: message.author.id,
        parentId: message.channel.isThread() ? message.channel.parentId : null,
        messageId: message.id, timestamp: message.createdAt,
      });
      if (!award) return;

      if (award.settings.rewards.length && (!message.member
        || needsRewardSync(message.member, award.settings.rewards, award.level, award.settings.highestOnly))) {
        try {
          await syncLevelRewards(message.member ?? await message.guild.members.fetch(message.author.id));
        } catch (error) {
          console.warn("[Leveling] Could not sync reward roles:", error);
        }
      }
      if (award.settings.announce && award.level > award.previousLevel) {
        const channel = award.settings.announcementId
          ? await message.guild.channels.fetch(award.settings.announcementId) : message.channel;
        if (!channel?.isSendable()) throw new Error("The level-up channel is unavailable.");
        const permissions = channel.permissionsFor(await message.guild.members.fetchMe());
        const send = channel.isThread() ? PermissionFlagsBits.SendMessagesInThreads : PermissionFlagsBits.SendMessages;
        if (!permissions?.has([PermissionFlagsBits.ViewChannel, send])) {
          throw new Error(`The bot cannot view or send messages in level-up channel ${channel.id}.`);
        }
        await channel.send({
          flags: componentsV2, allowedMentions: mentions,
          components: [levelingCard(`<@${message.author.id}> reached **Level ${award.level}**!`)],
        });
      }
    } catch (error) {
      console.error("[Leveling] Could not process chat message:", error);
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.guild || !interaction.inCachedGuild()) return;
    const guild = interaction.guild;
    try {
      if (interaction.isButton() && interaction.customId.startsWith("leveling:page:")) {
        if (interaction.message.interactionMetadata?.user.id !== interaction.user.id) {
          await interaction.reply({ flags: privateCard, components: [levelingCard("Use /leaderboard to open your own page.")] });
          return;
        }
        const [, , ranking, page] = interaction.customId.split(":");
        if ((ranking !== "xp" && ranking !== "prestige") || !/^\d+$/.test(page)) return;
        await interaction.deferUpdate();
        await interaction.editReply({ components: [await leaderboardCard(guild, ranking, Number(page))], allowedMentions: mentions });
        return;
      }
      if (!interaction.isChatInputCommand() || !["rank", "leaderboard", "prestige"].includes(interaction.commandName)) return;
      const isPrestige = interaction.commandName === "prestige";
      await interaction.deferReply(isPrestige ? { flags: MessageFlags.Ephemeral } : {});
      const settings = await getLevelingConfig(guild.id);
      if (!settings.enabled) {
        await interaction.editReply({ flags: componentsV2, components: [levelingCard("Leveling is disabled on this server.")] });
        return;
      }

      if (interaction.commandName === "leaderboard") {
        const ranking = interaction.options.getString("ranking") === "prestige" ? "prestige" : "xp";
        await interaction.editReply({ flags: componentsV2, components: [await leaderboardCard(guild, ranking, 1)], allowedMentions: mentions });
        return;
      }

      if (!isPrestige) {
        const user = interaction.options.getUser("member") ?? interaction.user;
        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member || member.user.bot) {
          await interaction.editReply({ flags: componentsV2, components: [levelingCard("Choose a human member of this server.")] });
          return;
        }
        const rank = await getRank(guild.id, member.id);
        const { level, current, needed } = levelProgress(rank.xp);
        const filled = Math.floor(10 * current / needed);
        const card = new ContainerBuilder().setAccentColor(0x5865f2).addSectionComponents(
          new SectionBuilder().setThumbnailAccessory(new ThumbnailBuilder({ media: { url: member.displayAvatarURL({ size: 128 }) } }))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
              `## ${escapeMarkdown(member.displayName)}\nLevel **${level}** · Server rank **${rank.position ? "#" + rank.position : "Unranked"}** · Prestige **${rank.prestige}**\n`
              + `${"▰".repeat(filled)}${"▱".repeat(10 - filled)} · ${current} / ${needed} XP\n${rank.xp.toLocaleString("en")} total XP`
            )),
        );
        await interaction.editReply({ flags: componentsV2, components: [card], allowedMentions: mentions });
        return;
      }

      const rank = await getRank(guild.id, interaction.user.id);
      if (!settings.prestigeEnabled || levelProgress(rank.xp).level < settings.prestigeLevel) {
        const text = settings.prestigeEnabled ? `Prestige requires Level ${settings.prestigeLevel}.` : "Prestige is disabled on this server.";
        await interaction.editReply({ flags: componentsV2, components: [levelingCard(text)] });
        return;
      }
      const prompt = await interaction.editReply({
        flags: componentsV2,
        components: [levelingCard("## Confirm prestige\nYour active XP and level will reset to 0. You will gain one permanent prestige point.")
          .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
            button("prestige", "Confirm prestige", ButtonStyle.Danger), button("cancel", "Cancel"),
          ))],
      });
      const click = await prompt.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (item) => item.user.id === interaction.user.id,
        time: 60_000,
      }).catch(() => null);
      if (!click) {
        await interaction.editReply({ components: [levelingCard("Prestige confirmation expired.")] });
        return;
      }
      await click.deferUpdate();
      let result = "Prestige cancelled.";
      if (click.customId === "leveling:prestige") {
        result = "Prestige requirements changed or this prestige was already applied.";
        if (await prestigeMember(guild.id, interaction.user.id, rank.prestige)) {
          result = `Prestige **${rank.prestige + 1}** earned. Your active level is now 0.`;
          try {
            await syncLevelRewards(await guild.members.fetch(interaction.user.id));
          } catch (error) {
            console.warn("[Leveling] Prestige role sync failed:", error);
            result += "\nReward roles could not be updated. Ask a server admin to check the bot's permissions and role hierarchy.";
          }
        }
      }
      await click.editReply({ components: [levelingCard(result)] });
    } catch (error) {
      console.error("[Leveling] Interaction failed:", error);
      if (interaction.isRepliable() && (interaction.deferred || interaction.replied)) {
        await interaction.editReply({ flags: componentsV2, components: [levelingCard("Leveling could not complete this request.")] }).catch(() => {});
      }
    }
  });
}
