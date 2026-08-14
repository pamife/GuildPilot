import {
  Client,
  TextChannel,
  Guild,
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
            const styleNum = getButtonStyleNumber(btnData.style);
            const buttonPayload: any = {
              type: 2,
              style: styleNum,
              label: btnData.label ? String(btnData.label).substring(0, 80) : undefined,
              disabled: !!btnData.disabled,
            };

            if (styleNum === 5 && btnData.url && isValidUrl(btnData.url)) {
              buttonPayload.url = btnData.url.trim();
            } else {
              buttonPayload.custom_id = btnData.customId || `btn_section_${Date.now()}`;
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
          const styleNum = getButtonStyleNumber(btnData.style);
          const buttonPayload: any = {
            type: 2,
            style: styleNum,
            label: btnData.label ? String(btnData.label).substring(0, 80) : undefined,
            disabled: !!btnData.disabled,
          };

          if (styleNum === 5 && btnData.url && isValidUrl(btnData.url)) {
            buttonPayload.url = btnData.url.trim();
          } else {
            buttonPayload.custom_id = btnData.customId || `custom_btn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
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
        let style = ButtonStyle.Primary;
        if (btnData.style === "Secondary" || btnData.style === 2) style = ButtonStyle.Secondary;
        if (btnData.style === "Success" || btnData.style === 3) style = ButtonStyle.Success;
        if (btnData.style === "Danger" || btnData.style === 4) style = ButtonStyle.Danger;
        if (btnData.style === "Link" || btnData.style === 5) style = ButtonStyle.Link;

        btn.setStyle(style);
        if (btnData.label) btn.setLabel(btnData.label.substring(0, 80));

        if (style === ButtonStyle.Link && btnData.url && isValidUrl(btnData.url)) {
          btn.setURL(btnData.url.trim());
        } else {
          btn.setCustomId(btnData.customId || `custom_btn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
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
