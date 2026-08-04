import {
  Client,
  Interaction,
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
  TextDisplayBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  SectionBuilder,
} from "discord.js";
import { getSelfRolePanelById, updateSelfRolePanel } from "../services/selfRoleService";
import { parseAndValidateEmoji } from "../utils/emojiValidator";

// Helper to validate URLs for Discord media items
function isValidUrl(str?: string | null): boolean {
  if (!str || !str.trim()) return false;
  try {
    const url = new URL(str.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (e) {
    return false;
  }
}

// Helper function to build Discord Components V2 payload using official discord.js builders
export async function buildSelfRoleEmbedAndComponents(guild: Guild, panel: any) {
  // Fetch guild roles & members quickly with 2-second timeout
  try {
    await guild.roles.fetch();
    const fetchPromise = guild.members.fetch().catch(() => null);
    const timeoutPromise = new Promise((res) => setTimeout(res, 2000));
    await Promise.race([fetchPromise, timeoutPromise]);
  } catch (e) {
    // Continue even if member fetch fails
  }

  const rawActionRows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
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
        let memberCount = role ? role.members.size : 0;
        if (memberCount === 0 && role && guild.members.cache.size > 0) {
          memberCount = guild.members.cache.filter((m) => m.roles.cache.has(role.id)).size;
        }

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
      rawActionRows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));
    } else {
      // Button display mode (max 5 buttons per ActionRow, max 5 rows = 25 buttons total)
      let currentRow = new ActionRowBuilder<ButtonBuilder>();

      options.slice(0, 25).forEach((opt: any, idx: number) => {
        if (idx > 0 && idx % 5 === 0) {
          rawActionRows.push(currentRow);
          currentRow = new ActionRowBuilder<ButtonBuilder>();
        }

        const role = guild.roles.cache.get(opt.roleId);
        let memberCount = role ? role.members.size : 0;
        if (memberCount === 0 && role && guild.members.cache.size > 0) {
          memberCount = guild.members.cache.filter((m) => m.roles.cache.has(role.id)).size;
        }

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
        rawActionRows.push(currentRow);
      }
    }
  }

  // BUILD DISCORD COMPONENTS V2
  // Using official discord.js Component Builders:
  // MediaGalleryBuilder, SeparatorBuilder, TextDisplayBuilder, ActionRowBuilder
  const v2Components: any[] = [];

  // 1. Media Gallery Component (if image URL is provided)
  if (isValidUrl(panel.image)) {
    const mediaItem = new MediaGalleryItemBuilder().setURL(panel.image.trim());
    const mediaGallery = new MediaGalleryBuilder().addItems(mediaItem);
    v2Components.push(mediaGallery);

    // 2. Separator Component
    v2Components.push(new SeparatorBuilder());
  }

  // 3. Text Display Component
  let textContent = "";
  if (panel.embedTitle && panel.embedTitle.trim()) {
    textContent += `# ${panel.embedTitle.trim()}\n`;
  }
  if (panel.embedDescription && panel.embedDescription.trim()) {
    textContent += `${panel.embedDescription.trim()}\n`;
  }
  if (panel.footer && panel.footer.trim()) {
    textContent += `\n*${panel.footer.trim()}*`;
  }

  if (!textContent.trim()) {
    textContent = `🔔 **${panel.name || "Self Roles"}**`;
  }

  const textDisplay = new TextDisplayBuilder().setContent(textContent.trim());
  v2Components.push(textDisplay);

  // 4. Action Row Components
  rawActionRows.forEach((row) => {
    v2Components.push(row);
  });

  return {
    components: v2Components,
    flags: MessageFlags.IsComponentsV2 as any,
  };
}

// Deploy or Update Live Discord Panel Message
export async function deploySelfRolePanelEmbed(client: Client, guildId: string, panelId: string) {
  const panel = await getSelfRolePanelById(panelId);
  if (!panel) throw new Error("Self-Role-Panel in der Datenbank nicht gefunden.");
  if (!panel.channelId) throw new Error("Kein Discord-Textkanal ausgewählt! Bitte wähle im Tab 'Allgemein & Kanal' einen Kanal aus.");

  const guild = client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
  if (!guild) throw new Error("Discord-Server (Guild) vom Bot nicht gefunden. Ist der Bot online?");

  const channel = (await guild.channels.fetch(panel.channelId).catch(() => null)) as TextChannel;
  if (!channel || !channel.isTextBased()) throw new Error("Der gewählte Discord-Kanal wurde nicht gefunden oder ist kein Textkanal.");

  const { components, flags } = await buildSelfRoleEmbedAndComponents(guild, panel);

  const payload: any = {
    components: components as any,
    flags: flags,
  };

  let message;
  if (panel.messageId) {
    try {
      const existingMessage = await channel.messages.fetch(panel.messageId);
      if (existingMessage) {
        message = await existingMessage.edit(payload);
      }
    } catch (e) {
      console.warn("[SelfRole] Vorherige Nachricht konnte nicht bearbeitet werden, erstelle neue Nachricht.");
    }
  }

  if (!message) {
    try {
      message = await channel.send(payload);
    } catch (sendErr: any) {
      if (sendErr.code === 50013) {
        throw new Error(`Der Bot hat keine Berechtigung 'Nachrichten senden' im Kanal #${channel.name}.`);
      } else if (sendErr.code === 50001) {
        throw new Error(`Der Bot hat keinen Zugriff auf den Kanal #${channel.name}.`);
      } else {
        throw new Error(`Discord API Fehler: ${sendErr.message || sendErr}`);
      }
    }
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
    const guild = client.guilds.cache.get(panel.guildId) || (await client.guilds.fetch(panel.guildId).catch(() => null));
    if (!guild) return;

    const channel = (await guild.channels.fetch(panel.channelId).catch(() => null)) as TextChannel;
    if (!channel) return;

    const existingMessage = await channel.messages.fetch(panel.messageId).catch(() => null);
    if (!existingMessage) return;

    const { components, flags } = await buildSelfRoleEmbedAndComponents(guild, panel);
    await existingMessage.edit({
      components: components as any,
      flags: flags,
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
