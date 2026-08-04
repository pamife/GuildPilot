import {
  Client,
  Interaction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextChannel,
  GuildMember,
  Guild,
  MessageFlags,
  parseEmoji,
} from "discord.js";
import { getSelfRolePanelById, updateSelfRolePanel } from "../services/selfRoleService";

// Helper to safely parse and validate emojis to avoid Discord API COMPONENT_INVALID_EMOJI error
function parseAndValidateEmoji(emojiStr?: string | null) {
  if (!emojiStr || typeof emojiStr !== "string") return null;
  const trimmed = emojiStr.trim();
  if (!trimmed) return null;

  try {
    const parsed = parseEmoji(trimmed);
    if (!parsed || !parsed.name) return null;

    // Custom emoji with ID (e.g. <:name:1234567890>)
    if (parsed.id) {
      return { id: parsed.id, name: parsed.name, animated: Boolean(parsed.animated) };
    }

    // Unicode emoji: Check that name is NOT plain ASCII (e.g. "updates" or ":updates:")
    const isPlainAscii = /^[\x00-\x7F]+$/.test(parsed.name);
    if (isPlainAscii) {
      return null; // Reject plain text names which are invalid unicode emojis
    }

    return { name: parsed.name };
  } catch (e) {
    return null;
  }
}

// Helper function to build Discord Embed and Components (Buttons or Dropdown)
export async function buildSelfRoleEmbedAndComponents(guild: Guild, panel: any) {
  // Fetch guild roles quickly (does not hang like members.fetch)
  try {
    await guild.roles.fetch();
  } catch (e) {
    // Continue even if role fetch fails
  }

  const embed = new EmbedBuilder();

  if (panel.embedTitle) embed.setTitle(panel.embedTitle);
  if (panel.embedDescription) embed.setDescription(panel.embedDescription);
  embed.setColor((panel.embedColor as any) || "#5865F2");

  if (panel.embedAuthorName) {
    embed.setAuthor({
      name: panel.embedAuthorName,
      iconURL: panel.embedAuthorIcon || undefined,
      url: panel.embedAuthorUrl || undefined,
    });
  }

  if (panel.thumbnail) embed.setThumbnail(panel.thumbnail);
  if (panel.image) embed.setImage(panel.image);

  if (panel.footer) {
    embed.setFooter({
      text: panel.footer,
      iconURL: panel.footerIcon || undefined,
    });
  }

  if (panel.showTimestamp) {
    embed.setTimestamp();
  }

  // Parse embed fields
  if (panel.embedFields) {
    try {
      const fields = typeof panel.embedFields === "string" ? JSON.parse(panel.embedFields) : panel.embedFields;
      if (Array.isArray(fields) && fields.length > 0) {
        embed.addFields(
          fields.map((f: any) => ({
            name: f.name || "\u200B",
            value: f.value || "\u200B",
            inline: Boolean(f.inline),
          }))
        );
      }
    } catch (e) {
      console.error("Error parsing embed fields for panel:", panel.id, e);
    }
  }

  const components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
  const options = panel.options || [];

  if (options.length > 0) {
    if (panel.displayType === "dropdown") {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`selfrole_select:${panel.id}`)
        .setPlaceholder(panel.placeholderText || "Select roles...")
        .setMinValues(0)
        .setMaxValues(panel.multiSelect ? Math.min(options.length, 25) : 1);

      const selectOptions = options.slice(0, 25).map((opt: any) => {
        const role = guild.roles.cache.get(opt.roleId);
        const memberCount = role ? role.members.size : 0;
        const roleName = opt.roleName || role?.name || "Unknown Role";
        const baseLabel = opt.label || roleName;
        const finalLabel = opt.showMemberCount ? `${baseLabel} (${memberCount})` : baseLabel;

        const selectOption = new StringSelectMenuOptionBuilder()
          .setLabel(finalLabel.substring(0, 100))
          .setValue(opt.id);

        if (opt.description) {
          selectOption.setDescription(opt.description.substring(0, 100));
        }

        if (opt.emoji) {
          const validEmoji = parseAndValidateEmoji(opt.emoji);
          if (validEmoji) {
            try {
              selectOption.setEmoji(validEmoji);
            } catch (e) {}
          }
        }

        return selectOption;
      });

      selectMenu.addOptions(selectOptions);
      components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));
    } else {
      // Button display mode (max 5 buttons per ActionRow, max 5 rows = 25 buttons total)
      let currentRow = new ActionRowBuilder<ButtonBuilder>();

      options.slice(0, 25).forEach((opt: any, idx: number) => {
        if (idx > 0 && idx % 5 === 0) {
          components.push(currentRow);
          currentRow = new ActionRowBuilder<ButtonBuilder>();
        }

        const role = guild.roles.cache.get(opt.roleId);
        const memberCount = role ? role.members.size : 0;
        const roleName = opt.roleName || role?.name || "Unknown Role";
        const baseLabel = opt.label || roleName;
        const finalLabel = opt.showMemberCount ? `${baseLabel} (${memberCount})` : baseLabel;

        let style = ButtonStyle.Secondary;
        if (opt.buttonColor === "Primary") style = ButtonStyle.Primary;
        if (opt.buttonColor === "Success") style = ButtonStyle.Success;
        if (opt.buttonColor === "Danger") style = ButtonStyle.Danger;

        const button = new ButtonBuilder()
          .setCustomId(`selfrole_toggle:${panel.id}:${opt.id}`)
          .setLabel(finalLabel.substring(0, 80))
          .setStyle(style);

        if (opt.emoji) {
          const validEmoji = parseAndValidateEmoji(opt.emoji);
          if (validEmoji) {
            try {
              button.setEmoji(validEmoji);
            } catch (e) {}
          }
        }

        currentRow.addComponents(button);
      });

      if (currentRow.components.length > 0) {
        components.push(currentRow);
      }
    }
  }

  return { embed, components };
}

// Deploy or Update Live Discord Panel Message
export async function deploySelfRolePanelEmbed(client: Client, guildId: string, panelId: string) {
  const panel = await getSelfRolePanelById(panelId);
  if (!panel) throw new Error("Self role panel not found");
  if (!panel.channelId) throw new Error("No target channel configured for panel");

  const guild = client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId));
  if (!guild) throw new Error("Guild not found on Discord client");

  const channel = (await guild.channels.fetch(panel.channelId)) as TextChannel;
  if (!channel || !channel.isTextBased()) throw new Error("Target channel not found or not text-based");

  const { embed, components } = await buildSelfRoleEmbedAndComponents(guild, panel);

  let message;
  if (panel.messageId) {
    try {
      const existingMessage = await channel.messages.fetch(panel.messageId);
      if (existingMessage) {
        message = await existingMessage.edit({
          embeds: [embed],
          components: components as any,
        });
      }
    } catch (e) {
      console.warn("Could not fetch or edit existing message, posting a new message instead.");
    }
  }

  if (!message) {
    message = await channel.send({
      embeds: [embed],
      components: components as any,
    });
  }

  // Update panel database record with messageId and channelId
  const updated = await updateSelfRolePanel(panel.id, {
    channelId: channel.id,
    messageId: message.id,
  });

  return { messageId: message.id, channelId: channel.id, panel: updated };
}

// Refresh panel message (e.g. update count badges)
export async function refreshSelfRolePanelMessage(client: Client, panelId: string) {
  const panel = await getSelfRolePanelById(panelId);
  if (!panel || !panel.channelId || !panel.messageId) return;

  try {
    const guild = client.guilds.cache.get(panel.guildId) || (await client.guilds.fetch(panel.guildId));
    if (!guild) return;

    const channel = (await guild.channels.fetch(panel.channelId)) as TextChannel;
    if (!channel) return;

    const existingMessage = await channel.messages.fetch(panel.messageId);
    if (!existingMessage) return;

    const { embed, components } = await buildSelfRoleEmbedAndComponents(guild, panel);
    await existingMessage.edit({
      embeds: [embed],
      components: components as any,
    });
  } catch (e) {
    console.error("Error refreshing self role panel message:", e);
  }
}

// Handle Bot Interaction (Button Clicks or String Select Dropdowns)
export async function handleSelfRoleInteraction(client: Client, interaction: Interaction) {
  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
  if (!interaction.customId.startsWith("selfrole_")) return;

  const member = interaction.member as GuildMember;
  if (!member || !interaction.guild) return;

  const parts = interaction.customId.split(":");
  const actionType = parts[0];
  const panelId = parts[1];

  const panel = await getSelfRolePanelById(panelId);
  if (!panel) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ This self role panel no longer exists.",
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  const isEphemeral = panel.ephemeralResponse !== false;

  if (interaction.isButton() && actionType === "selfrole_toggle") {
    const optionId = parts[2];
    const option = (panel.options || []).find((o) => o.id === optionId);
    if (!option) {
      await interaction.reply({
        content: "❌ Role option not found.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check required roles
    if (option.requiredRoles) {
      try {
        const required: string[] = typeof option.requiredRoles === "string" ? JSON.parse(option.requiredRoles) : option.requiredRoles;
        if (required.length > 0) {
          const hasRequired = required.some((reqRoleId) => member.roles.cache.has(reqRoleId));
          if (!hasRequired) {
            await interaction.reply({
              content: "⚠️ You do not meet the role requirements to select this role.",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
        }
      } catch (e) {
        // Ignore json parse error
      }
    }

    const targetRoleId = option.roleId;
    const hasRole = member.roles.cache.has(targetRoleId);
    const roleObj = interaction.guild.roles.cache.get(targetRoleId);
    const roleName = option.label || option.roleName || roleObj?.name || "Role";

    if (hasRole) {
      // Remove role
      await member.roles.remove(targetRoleId);
      const removeMsg = (panel.removeRoleMessage || "❌ Removed role {role}!")
        .replace("{role}", `<@&${targetRoleId}>`)
        .replace("{user}", `<@${member.id}>`);

      await interaction.reply({
        content: removeMsg,
        flags: isEphemeral ? MessageFlags.Ephemeral : undefined,
      });
    } else {
      // Add role
      // Check multiSelect and exclusiveGroup
      if (!panel.multiSelect || option.exclusiveGroup) {
        const rolesToRemove: string[] = [];

        (panel.options || []).forEach((o) => {
          if (o.id !== option.id && member.roles.cache.has(o.roleId)) {
            if (!panel.multiSelect) {
              rolesToRemove.push(o.roleId);
            } else if (option.exclusiveGroup && o.exclusiveGroup === option.exclusiveGroup) {
              rolesToRemove.push(o.roleId);
            }
          }
        });

        if (rolesToRemove.length > 0) {
          await member.roles.remove(rolesToRemove);
        }
      }

      await member.roles.add(targetRoleId);
      const addMsg = (panel.addRoleMessage || "✅ Added role {role}!")
        .replace("{role}", `<@&${targetRoleId}>`)
        .replace("{user}", `<@${member.id}>`);

      await interaction.reply({
        content: addMsg,
        flags: isEphemeral ? MessageFlags.Ephemeral : undefined,
      });
    }

    // Refresh live message counts in background if any option shows member count
    if ((panel.options || []).some((o) => o.showMemberCount)) {
      setTimeout(() => {
        refreshSelfRolePanelMessage(client, panel.id);
      }, 1000);
    }
  } else if (interaction.isStringSelectMenu() && actionType === "selfrole_select") {
    const selectedOptionIds = interaction.values;
    const options = panel.options || [];

    const selectedOptions = options.filter((o) => selectedOptionIds.includes(o.id));
    const unselectedOptions = options.filter((o) => !selectedOptionIds.includes(o.id));

    const addedRoles: string[] = [];
    const removedRoles: string[] = [];

    // Remove unselected roles
    for (const opt of unselectedOptions) {
      if (member.roles.cache.has(opt.roleId)) {
        await member.roles.remove(opt.roleId);
        removedRoles.push(opt.roleId);
      }
    }

    // Add selected roles
    for (const opt of selectedOptions) {
      if (!member.roles.cache.has(opt.roleId)) {
        await member.roles.add(opt.roleId);
        addedRoles.push(opt.roleId);
      }
    }

    let resultMsg = "✅ Updated your roles!";
    if (addedRoles.length > 0 && removedRoles.length > 0) {
      resultMsg = `✅ Added ${addedRoles.map((r) => `<@&${r}>`).join(", ")} and removed ${removedRoles.map((r) => `<@&${r}>`).join(", ")}.`;
    } else if (addedRoles.length > 0) {
      resultMsg = `✅ Granted: ${addedRoles.map((r) => `<@&${r}>`).join(", ")}.`;
    } else if (removedRoles.length > 0) {
      resultMsg = `❌ Removed: ${removedRoles.map((r) => `<@&${r}>`).join(", ")}.`;
    }

    await interaction.reply({
      content: resultMsg,
      flags: isEphemeral ? MessageFlags.Ephemeral : undefined,
    });

    if (options.some((o) => o.showMemberCount)) {
      setTimeout(() => {
        refreshSelfRolePanelMessage(client, panel.id);
      }, 1000);
    }
  }
}

export function setupSelfRoleInteractions(client: Client) {
  client.on("interactionCreate", async (interaction) => {
    try {
      await handleSelfRoleInteraction(client, interaction);
    } catch (err) {
      console.error("[SelfRole] Error handling interaction:", err);
    }
  });
}

