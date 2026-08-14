import {
  Client,
  TextChannel,
  Guild,
  GuildMember,
  Interaction,
  MessageFlags,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { getCustomMessageById, updateCustomMessage } from "../services/customMessageService";
import { parseAndValidateEmoji } from "../utils/emojiValidator";

function isValidUrl(str?: string | null): boolean {
  if (!str || !str.trim()) return false;
  try {
    const url = new URL(str.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (e) {
    return false;
  }
}

function hexToInt(hexStr?: string | null): number | undefined {
  if (!hexStr) return undefined;
  const clean = hexStr.replace("#", "").trim();
  const num = parseInt(clean, 16);
  return isNaN(num) ? undefined : num;
}

function getButtonStyleNumber(styleName?: string | number): number {
  if (typeof styleName === "number") return styleName;
  switch (styleName) {
    case "Primary":
    case "1":
      return 1; // Blurple
    case "Secondary":
    case "2":
      return 2; // Grey
    case "Success":
    case "3":
      return 3; // Green
    case "Danger":
    case "4":
      return 4; // Red
    case "Link":
    case "5":
      return 5; // URL link
    default:
      return 1;
  }
}

/**
 * Builds an official Discord Components V2 payload adhering strictly to Discord API rules:
 * Rule 1: Never mix Components V1 and Components V2 patterns.
 * Rule 6: IS_COMPONENTS_V2 (flag 32768 / 1 << 15) is set for the message.
 * Rule 7: Content, embeds and V2 components are kept separate.
 * Rule 9: Construct exact raw Discord API v10 payloads for V2 components.
 */
export function buildComponentsV2Payload(data: any) {
  const containerComponents: any[] = [];
  const messageDbId = data.id || "temp";

  // Parse items from containerConfig
  let items: any[] = [];
  try {
    if (typeof data.containerConfig === "string") {
      items = JSON.parse(data.containerConfig || "[]");
    } else if (Array.isArray(data.containerConfig)) {
      items = data.containerConfig;
    }
  } catch (e) {
    items = [];
  }

  // Process up to 10 root-level container children (Discord API limit)
  for (const item of items.slice(0, 10)) {
    if (!item || !item.type) continue;

    switch (item.type) {
      // 1. Text Display Component (Type 10)
      case "text":
      case 10: {
        const textContent = (item.content || "").trim();
        if (textContent) {
          containerComponents.push({
            type: 10,
            content: textContent.substring(0, 4000),
          });
        }
        break;
      }

      // 2. Separator Component (Type 14)
      case "separator":
      case 14: {
        const separatorPayload: any = { type: 14 };
        if (item.spacing !== undefined) {
          separatorPayload.spacing = Number(item.spacing);
        }
        if (item.divider !== undefined) {
          separatorPayload.divider = !!item.divider;
        }
        containerComponents.push(separatorPayload);
        break;
      }

      // 3. Media Gallery Component (Type 12)
      case "media_gallery":
      case 12: {
        const galleryItems = Array.isArray(item.items) ? item.items : [];
        const validGalleryItems: any[] = [];

        for (const m of galleryItems.slice(0, 10)) {
          if (m && m.url && isValidUrl(m.url)) {
            const mediaItem: any = {
              media: { url: m.url.trim() },
            };
            if (m.description) {
              mediaItem.description = String(m.description).substring(0, 1024);
            }
            if (m.spoiler) {
              mediaItem.spoiler = true;
            }
            validGalleryItems.push(mediaItem);
          }
        }

        if (validGalleryItems.length > 0) {
          containerComponents.push({
            type: 12,
            items: validGalleryItems,
          });
        }
        break;
      }

      // 4. Section Component (Type 9)
      case "section":
      case 9: {
        const sectionComponents: any[] = [];
        const sectionText = (item.content || "").trim();
        if (sectionText) {
          sectionComponents.push({
            type: 10,
            content: sectionText.substring(0, 2000),
          });
        }

        const sectionPayload: any = {
          type: 9,
          components: sectionComponents,
        };

        // Section Accessory (Thumbnail Type 11 or Button Type 2)
        if (item.accessory) {
          if (item.accessory.type === "thumbnail" || item.accessory.type === 11) {
            if (item.accessory.url && isValidUrl(item.accessory.url)) {
              sectionPayload.accessory = {
                type: 11,
                media: { url: item.accessory.url.trim() },
                spoiler: !!item.accessory.spoiler,
              };
            }
          } else if (item.accessory.type === "button" || item.accessory.type === 2) {
            const btnData = item.accessory;
            const isLink = btnData.style === "Link" || btnData.style === 5 || btnData.actionType === "LINK";
            const styleNum = isLink ? 5 : getButtonStyleNumber(btnData.style);
            const btnId = btnData.id || `sec_btn_${item.id || Date.now()}`;

            const buttonPayload: any = {
              type: 2,
              style: styleNum,
              label: btnData.label ? String(btnData.label).substring(0, 80) : undefined,
              disabled: !!btnData.disabled,
            };

            if (isLink && btnData.url && isValidUrl(btnData.url)) {
              buttonPayload.url = btnData.url.trim();
            } else {
              buttonPayload.custom_id = `cmsg_btn:${messageDbId}:${btnId}`;
            }

            if (btnData.emoji) {
              const parsedEmoji = parseAndValidateEmoji(btnData.emoji);
              if (parsedEmoji) buttonPayload.emoji = parsedEmoji;
            }

            sectionPayload.accessory = buttonPayload;
          }
        }

        if (sectionComponents.length > 0 || sectionPayload.accessory) {
          containerComponents.push(sectionPayload);
        }
        break;
      }

      // 5. Action Row Component (Type 1)
      case "action_row":
      case 1: {
        const buttons = Array.isArray(item.buttons) ? item.buttons : [];
        const validButtons: any[] = [];

        for (const btnData of buttons.slice(0, 5)) {
          const isLink = btnData.style === "Link" || btnData.style === 5 || btnData.actionType === "LINK";
          const styleNum = isLink ? 5 : getButtonStyleNumber(btnData.style);
          const btnId = btnData.id || `btn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

          const buttonPayload: any = {
            type: 2,
            style: styleNum,
            label: btnData.label ? String(btnData.label).substring(0, 80) : undefined,
            disabled: !!btnData.disabled,
          };

          if (isLink && btnData.url && isValidUrl(btnData.url)) {
            buttonPayload.url = btnData.url.trim();
          } else {
            buttonPayload.custom_id = `cmsg_btn:${messageDbId}:${btnId}`;
          }

          if (btnData.emoji) {
            const parsedEmoji = parseAndValidateEmoji(btnData.emoji);
            if (parsedEmoji) buttonPayload.emoji = parsedEmoji;
          }

          validButtons.push(buttonPayload);
        }

        if (validButtons.length > 0) {
          containerComponents.push({
            type: 1,
            components: validButtons,
          });
        }
        break;
      }
    }
  }

  // If container is empty, add a default placeholder text display
  if (containerComponents.length === 0) {
    const fallbackText = data.content || (data.name ? `# ${data.name}` : "Hello from GuildPilot!");
    containerComponents.push({
      type: 10,
      content: fallbackText,
    });
  }

  // Build Root Container (Type 17)
  const containerPayload: any = {
    type: 17,
    components: containerComponents,
  };

  if (data.accentColor) {
    const colorInt = hexToInt(data.accentColor);
    if (colorInt !== undefined) {
      containerPayload.accent_color = colorInt;
    }
  }

  if (data.spoiler) {
    containerPayload.spoiler = true;
  }

  return {
    components: [containerPayload],
    flags: MessageFlags.IsComponentsV2 as any, // 32768
  };
}

/**
 * Builds Classic Embed & ActionRow payload (Legacy mode without V2 flag)
 */
export function buildClassicEmbedPayload(data: any) {
  let embedConfig: any = {};
  const messageDbId = data.id || "temp";

  try {
    if (typeof data.embedConfig === "string") {
      embedConfig = JSON.parse(data.embedConfig || "{}");
    } else if (typeof data.embedConfig === "object") {
      embedConfig = data.embedConfig || {};
    }
  } catch (e) {
    embedConfig = {};
  }

  const embed = new EmbedBuilder();
  let hasEmbedData = false;

  if (embedConfig.title && embedConfig.title.trim()) {
    embed.setTitle(embedConfig.title.trim().substring(0, 256));
    hasEmbedData = true;
  }
  if (embedConfig.description && embedConfig.description.trim()) {
    embed.setDescription(embedConfig.description.trim().substring(0, 4096));
    hasEmbedData = true;
  }
  if (embedConfig.color) {
    const colorInt = hexToInt(embedConfig.color);
    if (colorInt !== undefined) embed.setColor(colorInt);
  } else if (data.accentColor) {
    const colorInt = hexToInt(data.accentColor);
    if (colorInt !== undefined) embed.setColor(colorInt);
  }
  if (embedConfig.url && isValidUrl(embedConfig.url)) {
    embed.setURL(embedConfig.url.trim());
  }
  if (embedConfig.authorName && embedConfig.authorName.trim()) {
    embed.setAuthor({
      name: embedConfig.authorName.trim().substring(0, 256),
      iconURL: isValidUrl(embedConfig.authorIcon) ? embedConfig.authorIcon.trim() : undefined,
      url: isValidUrl(embedConfig.authorUrl) ? embedConfig.authorUrl.trim() : undefined,
    });
    hasEmbedData = true;
  }
  if (embedConfig.thumbnail && isValidUrl(embedConfig.thumbnail)) {
    embed.setThumbnail(embedConfig.thumbnail.trim());
    hasEmbedData = true;
  }
  if (embedConfig.image && isValidUrl(embedConfig.image)) {
    embed.setImage(embedConfig.image.trim());
    hasEmbedData = true;
  }
  if (embedConfig.footerText && embedConfig.footerText.trim()) {
    embed.setFooter({
      text: embedConfig.footerText.trim().substring(0, 2048),
      iconURL: isValidUrl(embedConfig.footerIcon) ? embedConfig.footerIcon.trim() : undefined,
    });
    hasEmbedData = true;
  }
  if (embedConfig.showTimestamp) {
    embed.setTimestamp();
  }

  if (Array.isArray(embedConfig.fields)) {
    for (const field of embedConfig.fields.slice(0, 25)) {
      if (field && field.name && field.value) {
        embed.addFields({
          name: field.name.substring(0, 256),
          value: field.value.substring(0, 1024),
          inline: !!field.inline,
        });
        hasEmbedData = true;
      }
    }
  }

  // Process Action Rows / Buttons
  const actionRows: ActionRowBuilder<ButtonBuilder>[] = [];
  let rowsConfig: any[] = [];
  try {
    if (typeof data.componentsConfig === "string") {
      rowsConfig = JSON.parse(data.componentsConfig || "[]");
    } else if (Array.isArray(data.componentsConfig)) {
      rowsConfig = data.componentsConfig;
    }
  } catch (e) {
    rowsConfig = [];
  }

  for (const rowData of rowsConfig.slice(0, 5)) {
    const buttons = Array.isArray(rowData.buttons) ? rowData.buttons : [];
    if (buttons.length > 0) {
      const row = new ActionRowBuilder<ButtonBuilder>();
      for (const btnData of buttons.slice(0, 5)) {
        const btn = new ButtonBuilder();
        const isLink = btnData.style === "Link" || btnData.style === 5 || btnData.actionType === "LINK";
        let style = ButtonStyle.Primary;
        if (btnData.style === "Secondary" || btnData.style === 2) style = ButtonStyle.Secondary;
        if (btnData.style === "Success" || btnData.style === 3) style = ButtonStyle.Success;
        if (btnData.style === "Danger" || btnData.style === 4) style = ButtonStyle.Danger;
        if (isLink) style = ButtonStyle.Link;

        btn.setStyle(style);
        if (btnData.label) btn.setLabel(btnData.label.substring(0, 80));

        if (isLink && btnData.url && isValidUrl(btnData.url)) {
          btn.setURL(btnData.url.trim());
        } else {
          const btnId = btnData.id || `btn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          btn.setCustomId(`cmsg_btn:${messageDbId}:${btnId}`);
        }

        if (btnData.emoji) {
          const parsedEmoji = parseAndValidateEmoji(btnData.emoji);
          if (parsedEmoji) btn.setEmoji(parsedEmoji);
        }
        if (btnData.disabled) btn.setDisabled(true);

        row.addComponents(btn);
      }
      if (row.components.length > 0) {
        actionRows.push(row);
      }
    }
  }

  const payload: any = {};
  if (data.content && data.content.trim()) {
    payload.content = data.content.trim();
  }
  if (hasEmbedData) {
    payload.embeds = [embed];
  }
  if (actionRows.length > 0) {
    payload.components = actionRows;
  }

  if (!payload.content && (!payload.embeds || payload.embeds.length === 0)) {
    payload.content = data.name || "Custom message from GuildPilot";
  }

  return payload;
}

/**
 * Builds the complete Discord API payload based on message configuration mode
 */
export function buildCustomMessagePayload(data: any) {
  if (data.mode === "components_v2" || !data.mode) {
    return buildComponentsV2Payload(data);
  } else {
    return buildClassicEmbedPayload(data);
  }
}

/**
 * Sends or updates a custom message in a Discord channel
 */
export async function deployCustomMessage(
  client: Client,
  guildId: string,
  messageIdOrData: string | any,
  targetChannelId?: string
) {
  const isId = typeof messageIdOrData === "string";
  let messageRecord: any = null;

  if (isId) {
    messageRecord = await getCustomMessageById(messageIdOrData);
    if (!messageRecord) throw new Error("Custom message not found in database.");
  } else {
    messageRecord = messageIdOrData;
  }

  const channelId = targetChannelId || messageRecord.channelId;
  if (!channelId) {
    throw new Error("No target Discord channel selected. Please choose a channel.");
  }

  // 1. Fetch Guild
  const guild = client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
  if (!guild) {
    throw new Error("Discord server (guild) not found. Is the bot connected?");
  }

  // 2. Fetch Channel
  const channel = (await guild.channels.fetch(channelId).catch(() => null)) as TextChannel;
  if (!channel || !channel.isTextBased()) {
    throw new Error("The target channel was not found or is not a text-based channel.");
  }

  // 3. Build Payload
  const payload = buildCustomMessagePayload(messageRecord);

  let sentMessage;
  const existingMessageId = messageRecord.messageId;

  if (existingMessageId && (!targetChannelId || targetChannelId === messageRecord.channelId)) {
    try {
      const existingMessage = await channel.messages.fetch(existingMessageId).catch(() => null);
      if (existingMessage) {
        sentMessage = await existingMessage.edit(payload);
      }
    } catch (e) {
      console.warn("[CustomMessage] Editing existing message failed, creating new message:", e);
    }
  }

  if (!sentMessage) {
    try {
      sentMessage = await channel.send(payload);
    } catch (sendErr: any) {
      console.error("[CustomMessage] Error sending message:", sendErr?.rawError || sendErr?.message || sendErr);
      if (sendErr.code === 50013) {
        throw new Error(`The bot is missing permissions to send messages in #${channel.name}.`);
      } else if (sendErr.code === 50001) {
        throw new Error(`The bot does not have access to view channel #${channel.name}.`);
      } else {
        throw new Error(`Discord API Error: ${sendErr.rawError?.message || sendErr.message || sendErr}`);
      }
    }
  }

  // 4. Update database record if persistent
  if (isId && messageRecord.id) {
    messageRecord = await updateCustomMessage(messageRecord.id, {
      channelId: channel.id,
      messageId: sentMessage.id,
      lastSentAt: new Date(),
    });
  }

  return {
    success: true,
    messageId: sentMessage.id,
    channelId: channel.id,
    channelName: channel.name,
    message: messageRecord,
  };
}

/**
 * Handles button interactions configured on Custom Messages
 * Supports: EPHEMERAL_REPLY, ROLE_TOGGLE, ROLE_ADD, ROLE_REMOVE, SEND_DM, etc.
 */
export async function handleCustomMessageInteraction(client: Client, interaction: Interaction) {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith("cmsg_btn:")) return;

  const parts = interaction.customId.split(":");
  const messageDbId = parts[1];
  const btnId = parts[2];

  const member = interaction.member as GuildMember;
  if (!member || !interaction.guild) return;

  try {
    const customMessage = await getCustomMessageById(messageDbId);
    if (!customMessage) {
      await interaction.reply({
        content: "ℹ️ Button action clicked.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Find the button in containerConfig or componentsConfig
    let targetButton: any = null;

    if (customMessage.mode === "components_v2" || !customMessage.mode) {
      const containerItems: any[] = typeof customMessage.containerConfig === "string"
        ? JSON.parse(customMessage.containerConfig || "[]")
        : (customMessage.containerConfig || []);

      for (const item of containerItems) {
        if (item.type === "action_row" && Array.isArray(item.buttons)) {
          const found = item.buttons.find((b: any) => b.id === btnId || b.customId === btnId);
          if (found) {
            targetButton = found;
            break;
          }
        } else if (item.type === "section" && item.accessory?.type === "button") {
          if (item.accessory.id === btnId || item.accessory.customId === btnId || `sec_btn_${item.id}` === btnId) {
            targetButton = item.accessory;
            break;
          }
        }
      }
    } else {
      const rows: any[] = typeof customMessage.componentsConfig === "string"
        ? JSON.parse(customMessage.componentsConfig || "[]")
        : (customMessage.componentsConfig || []);

      for (const row of rows) {
        if (Array.isArray(row.buttons)) {
          const found = row.buttons.find((b: any) => b.id === btnId || b.customId === btnId);
          if (found) {
            targetButton = found;
            break;
          }
        }
      }
    }

    if (!targetButton) {
      await interaction.reply({
        content: "✅ Action processed.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Extract actions list (supports both new multi-action `actions` array and legacy single `actionData`)
    let actionsList: any[] = [];
    if (Array.isArray(targetButton.actions) && targetButton.actions.length > 0) {
      actionsList = targetButton.actions;
    } else if (targetButton.actionData) {
      actionsList = [{ ...targetButton.actionData, actionType: targetButton.actionType || targetButton.actionData.actionType || "EPHEMERAL_REPLY" }];
    } else if (targetButton.actionType) {
      actionsList = [{ actionType: targetButton.actionType, ephemeralText: targetButton.responseMessage }];
    }

    if (actionsList.length === 0) {
      await interaction.reply({
        content: "✅ Action processed.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const ephemeralMessages: string[] = [];
    let linkedReplyPayload: any = null;

    for (const act of actionsList) {
      const type = act.actionType;

      // 1. Role Toggle & Role Add (auto-toggles if user already has the role)
      if ((type === "ROLE_TOGGLE" || type === "ROLE_ADD") && act.roleId) {
        const role = interaction.guild.roles.cache.get(act.roleId) || (await interaction.guild.roles.fetch(act.roleId).catch(() => null));
        if (role) {
          const hasRole = member.roles.cache.has(act.roleId);
          if (hasRole) {
            await member.roles.remove(act.roleId).catch(console.error);
            const msg = (act.roleRemoveMessage || "❌ Role {role} removed!")
              .replace("{role}", `<@&${act.roleId}>`)
              .replace("{user}", `<@${member.id}>`);
            ephemeralMessages.push(msg);
          } else {
            await member.roles.add(act.roleId).catch(console.error);
            const msg = (act.roleAddMessage || "✅ Role {role} added!")
              .replace("{role}", `<@&${act.roleId}>`)
              .replace("{user}", `<@${member.id}>`);
            ephemeralMessages.push(msg);
          }
        }
      }

      // 2. Role Remove
      else if (type === "ROLE_REMOVE" && act.roleId) {
        const role = interaction.guild.roles.cache.get(act.roleId) || (await interaction.guild.roles.fetch(act.roleId).catch(() => null));
        if (role) {
          await member.roles.remove(act.roleId).catch(console.error);
          const msg = (act.roleRemoveMessage || "❌ Role {role} removed!")
            .replace("{role}", `<@&${act.roleId}>`)
            .replace("{user}", `<@${member.id}>`);
          ephemeralMessages.push(msg);
        }
      }

      // 3. Send DM
      else if (type === "SEND_DM" && (act.dmText || act.targetCustomMessageId)) {
        if (act.targetCustomMessageId) {
          const linkedMsg = await getCustomMessageById(act.targetCustomMessageId);
          if (linkedMsg) {
            const payload = linkedMsg.mode === "embed"
              ? buildClassicEmbedPayload(linkedMsg)
              : buildCustomMessagePayload(linkedMsg);
            try {
              await interaction.user.send(payload);
              ephemeralMessages.push("📩 Sent you the requested message in your DMs!");
            } catch {
              ephemeralMessages.push("⚠️ Could not send DM. Please enable server DMs in Discord settings.");
            }
          }
        } else if (act.dmText) {
          const dmContent = act.dmText
            .replace("{user}", `<@${interaction.user.id}>`)
            .replace("{username}", interaction.user.username);

          try {
            await interaction.user.send({ content: dmContent });
            ephemeralMessages.push("📩 Sent you a direct message (DM)!");
          } catch (dmErr) {
            ephemeralMessages.push("⚠️ Could not send DM. Please enable server direct messages in your Discord settings.");
          }
        }
      }

      // 4. Ephemeral Reply (Custom text OR Linked Saved Custom Message!)
      else if (type === "EPHEMERAL_REPLY" || type === "REPLY") {
        if (act.targetCustomMessageId) {
          const linkedMsg = await getCustomMessageById(act.targetCustomMessageId);
          if (linkedMsg) {
            const rawPayload = linkedMsg.mode === "embed"
              ? buildClassicEmbedPayload(linkedMsg)
              : buildCustomMessagePayload(linkedMsg);

            linkedReplyPayload = {
              ...rawPayload,
              flags: (rawPayload.flags || 0) | MessageFlags.Ephemeral,
            };
          }
        } else {
          const text = (act.ephemeralText || act.content || "✅ Button action executed successfully!")
            .replace("{user}", `<@${interaction.user.id}>`)
            .replace("{username}", interaction.user.username)
            .replace("{server}", interaction.guild.name);
          ephemeralMessages.push(text);
        }
      }
    }

    if (linkedReplyPayload) {
      if (ephemeralMessages.length > 0 && linkedReplyPayload.components) {
        // Optionally prepend role confirmation note in linked payload if possible
      }
      await interaction.reply(linkedReplyPayload);
      return;
    }

    const finalResponse = ephemeralMessages.length > 0
      ? ephemeralMessages.join("\n")
      : "✅ Action processed successfully!";

    await interaction.reply({
      content: finalResponse,
      flags: MessageFlags.Ephemeral,
    });
  } catch (err: any) {
    console.error("[CustomMessage Interaction] Error:", err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ An error occurred processing this button action.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

export function setupCustomMessageInteractions(client: Client) {
  client.on("interactionCreate", async (interaction) => {
    try {
      await handleCustomMessageInteraction(client, interaction);
    } catch (err) {
      console.error("[CustomMessage] Interaction listener error:", err);
    }
  });
}
