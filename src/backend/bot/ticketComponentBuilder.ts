import {
  MessageFlags,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { parseAndValidateEmoji } from "../utils/emojiValidator";
import {
  TicketPanelComponentItem,
  TicketTypeConfig,
  ButtonComponentItem,
  SelectMenuComponentItem,
  ButtonStyleType,
} from "../types/ticketComponentTypes";

function isValidUrl(str?: string | null): boolean {
  if (!str || !str.trim()) return false;
  try {
    const url = new URL(str.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function hexToInt(hexStr?: string | null): number | undefined {
  if (!hexStr) return undefined;
  const clean = hexStr.replace("#", "").trim();
  const num = parseInt(clean, 16);
  return isNaN(num) ? undefined : num;
}

function getButtonStyleNumber(styleName?: ButtonStyleType | number | string): number {
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

function getSelectMenuTypeNumber(typeStr?: string): number {
  switch (typeStr) {
    case "string_select":
    case "3":
      return 3;
    case "user_select":
    case "5":
      return 5;
    case "role_select":
    case "6":
      return 6;
    case "mentionable_select":
    case "7":
      return 7;
    case "channel_select":
    case "8":
      return 8;
    default:
      return 3;
  }
}

/**
 * Automatically converts a legacy TicketPanel (with embedTitle, reasons, etc.)
 * to modern Discord Components V2 format.
 */
export function convertLegacyPanelToComponentsV2(panel: any) {
  const panelId = panel.id || "temp";
  const containerItems: TicketPanelComponentItem[] = [];

  // Parse legacy reasons
  let legacyReasons: any[] = [];
  try {
    if (typeof panel.reasons === "string") {
      legacyReasons = JSON.parse(panel.reasons || "[]");
    } else if (Array.isArray(panel.reasons)) {
      legacyReasons = panel.reasons;
    }
  } catch {
    legacyReasons = [];
  }

  // Parse legacy global questions
  let legacyQuestions: any[] = [];
  try {
    if (typeof panel.questions === "string") {
      legacyQuestions = JSON.parse(panel.questions || "[]");
    } else if (Array.isArray(panel.questions)) {
      legacyQuestions = panel.questions;
    }
  } catch {
    legacyQuestions = [];
  }

  // 1. Header / Section with thumbnail
  const title = panel.embedTitle || panel.name || "Support Ticket";
  const desc = panel.embedDescription || "Select a ticket reason or click below to open a ticket.";
  const headerContent = `# 🎫 ${title}\n${desc}`;

  if (panel.thumbnail && isValidUrl(panel.thumbnail)) {
    containerItems.push({
      id: "sec-header",
      type: "section",
      content: headerContent,
      accessory: {
        type: "thumbnail",
        url: panel.thumbnail.trim(),
      },
    });
  } else {
    containerItems.push({
      id: "txt-header",
      type: "text",
      content: headerContent,
    });
  }

  // 2. Banner Media Gallery if image exists
  if (panel.image && isValidUrl(panel.image)) {
    containerItems.push({
      id: "media-banner",
      type: "media_gallery",
      items: [{ url: panel.image.trim() }],
    });
  }

  // 3. Separator
  containerItems.push({
    id: "sep-divider",
    type: "separator",
    divider: true,
  });

  // Convert reasons to TicketTypeConfig
  const ticketTypes: TicketTypeConfig[] = legacyReasons.map((r: any, idx: number) => ({
    id: r.value || `type_${idx + 1}`,
    name: r.label || `Ticket Type ${idx + 1}`,
    label: r.label || `Ticket Type ${idx + 1}`,
    emoji: r.emoji || "🎫",
    description: r.description || "",
    categoryId: r.categoryId || panel.categoryId || undefined,
    supportRoles: r.supportRoles || [],
    questions: r.questions && r.questions.length > 0 ? r.questions : legacyQuestions,
    welcomeTitle: panel.welcomeTitle,
    welcomeDescription: panel.welcomeDescription,
    welcomeColor: panel.welcomeColor,
    welcomeThumbnail: panel.welcomeThumbnail,
    welcomeImage: panel.welcomeImage,
    welcomeFooter: panel.welcomeFooter,
  }));

  // 4. Action Row (Select Menu if reasons exist, otherwise Button)
  if (ticketTypes.length > 0) {
    containerItems.push({
      id: "row-select",
      type: "action_row",
      rowType: "select",
      selectMenu: {
        id: "sel-reasons",
        type: "string_select",
        placeholder: "Select a ticket reason...",
        options: ticketTypes.map((t) => ({
          label: t.label,
          value: t.id,
          description: t.description,
          emoji: t.emoji,
          actionType: "CREATE_TICKET",
          ticketTypeId: t.id,
        })),
      },
    });
  } else {
    containerItems.push({
      id: "row-button",
      type: "action_row",
      rowType: "buttons",
      buttons: [
        {
          id: "btn-open",
          style: (panel.buttonColor as ButtonStyleType) || "Primary",
          label: panel.buttonText || "Create Ticket",
          emoji: panel.buttonEmoji || "📩",
          actionType: "CREATE_TICKET",
          ticketTypeId: "default",
        },
      ],
    });
  }

  return {
    ...panel,
    layoutMode: "components_v2",
    accentColor: panel.embedColor || "#5865F2",
    spoiler: false,
    containerConfig: containerItems,
    ticketTypesConfig: ticketTypes,
  };
}

/**
 * Builds the official Discord API Components V2 payload for a Ticket Panel
 * adhering strictly to Discord API rules:
 * - Flags: 32768 (MessageFlags.IsComponentsV2)
 * - Container Component (Type 17)
 * - Text Display (Type 10), Separator (Type 14), Media Gallery (Type 12)
 * - Section (Type 9) with Thumbnail (Type 11) or Button (Type 2)
 * - Action Row (Type 1) with Buttons (Type 2) or Select Menus (Types 3, 5, 6, 7, 8)
 */
export function buildTicketComponentsV2Payload(panelData: any) {
  const panelId = panelData.id || "temp";
  const containerComponents: any[] = [];

  let items: TicketPanelComponentItem[] = [];
  try {
    if (typeof panelData.containerConfig === "string") {
      items = JSON.parse(panelData.containerConfig || "[]");
    } else if (Array.isArray(panelData.containerConfig)) {
      items = panelData.containerConfig;
    }
  } catch {
    items = [];
  }

  // If container is completely empty or not migrated yet, convert on the fly
  if (items.length === 0) {
    const converted = convertLegacyPanelToComponentsV2(panelData);
    items = converted.containerConfig;
  }

  // Process up to 10 root-level container children (Discord API limit)
  for (const item of items.slice(0, 10)) {
    if (!item || !item.type) continue;

    switch (item.type) {
      // 1. Text Display Component (Type 10)
      case "text": {
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
      case "separator": {
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
      case "media_gallery": {
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
      case "section": {
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
          if (item.accessory.type === "thumbnail") {
            if (item.accessory.url && isValidUrl(item.accessory.url)) {
              sectionPayload.accessory = {
                type: 11,
                media: { url: item.accessory.url.trim() },
                spoiler: !!item.accessory.spoiler,
              };
            }
          } else if (item.accessory.type === "button") {
            const btnData = item.accessory;
            const isLink = btnData.style === "Link" || btnData.style === 5 || btnData.actionType === "LINK";
            const styleNum = isLink ? 5 : getButtonStyleNumber(btnData.style);
            const action = btnData.actionType || "CREATE_TICKET";
            const typeId = btnData.ticketTypeId || "default";
            const btnId = btnData.customId || `sec_btn_${item.id || Date.now()}`;

            const buttonPayload: any = {
              type: 2,
              style: styleNum,
              label: btnData.label ? String(btnData.label).substring(0, 80) : undefined,
              disabled: !!btnData.disabled,
            };

            if (isLink && btnData.url && isValidUrl(btnData.url)) {
              buttonPayload.url = btnData.url.trim();
            } else {
              buttonPayload.custom_id = `tkt_act:${panelId}:${action}:${typeId}:${btnId}`;
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
      case "action_row": {
        if (item.rowType === "select" || item.selectMenu) {
          const selData = item.selectMenu;
          if (selData) {
            const selTypeNum = getSelectMenuTypeNumber(selData.type);
            const selId = selData.id || `sel_${Date.now()}`;

            const selectPayload: any = {
              type: selTypeNum,
              custom_id: `tkt_sel:${panelId}:${selData.actionType || "SELECT"}:${selId}`,
              placeholder: selData.placeholder ? String(selData.placeholder).substring(0, 150) : undefined,
              min_values: selData.minValues !== undefined ? Number(selData.minValues) : undefined,
              max_values: selData.maxValues !== undefined ? Number(selData.maxValues) : undefined,
              disabled: !!selData.disabled,
            };

            if (selTypeNum === 3) {
              // String Select Options
              const options = Array.isArray(selData.options) ? selData.options : [];
              const validOptions: any[] = [];

              for (const opt of options.slice(0, 25)) {
                if (!opt.label || !opt.label.trim()) continue;
                const optAction = opt.actionType || "CREATE_TICKET";
                const optTypeId = opt.ticketTypeId || opt.value || "default";

                // Value format encodes action and ticket type so interaction handler routes correctly
                const optValue = `tkt_opt:${optAction}:${optTypeId}:${opt.value || opt.label}`.substring(0, 100);

                const optionPayload: any = {
                  label: String(opt.label).substring(0, 100),
                  value: optValue,
                  description: opt.description ? String(opt.description).substring(0, 100) : undefined,
                  default: !!opt.default,
                };

                if (opt.emoji) {
                  const parsedEmoji = parseAndValidateEmoji(opt.emoji);
                  if (parsedEmoji) optionPayload.emoji = parsedEmoji;
                }

                validOptions.push(optionPayload);
              }

              if (validOptions.length > 0) {
                selectPayload.options = validOptions;
                containerComponents.push({
                  type: 1,
                  components: [selectPayload],
                });
              }
            } else if (selTypeNum === 8) {
              // Channel Select
              if (Array.isArray(selData.channelTypes) && selData.channelTypes.length > 0) {
                selectPayload.channel_types = selData.channelTypes;
              }
              containerComponents.push({
                type: 1,
                components: [selectPayload],
              });
            } else {
              // User (5), Role (6), Mentionable (7) Select
              containerComponents.push({
                type: 1,
                components: [selectPayload],
              });
            }
          }
        } else {
          // Buttons
          const buttons = Array.isArray(item.buttons) ? item.buttons : [];
          const validButtons: any[] = [];

          for (const btnData of buttons.slice(0, 5)) {
            const isLink = btnData.style === "Link" || btnData.style === 5 || btnData.actionType === "LINK";
            const styleNum = isLink ? 5 : getButtonStyleNumber(btnData.style);
            const action = btnData.actionType || "CREATE_TICKET";
            const typeId = btnData.ticketTypeId || "default";
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
              buttonPayload.custom_id = `tkt_act:${panelId}:${action}:${typeId}:${btnId}`;
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
        }
        break;
      }
    }
  }

  // Fallback if container is still empty
  if (containerComponents.length === 0) {
    containerComponents.push({
      type: 10,
      content: `# 🎫 ${panelData.name || "Support Ticket Panel"}\nClick below to open a ticket.`,
    });
    containerComponents.push({
      type: 1,
      components: [
        {
          type: 2,
          style: 1,
          label: "Create Ticket",
          emoji: { name: "📩" },
          custom_id: `tkt_act:${panelId}:CREATE_TICKET:default:btn_open`,
        },
      ],
    });
  }

  // Build Root Container (Type 17)
  const containerPayload: any = {
    type: 17,
    components: containerComponents,
  };

  const accentHex = panelData.accentColor || panelData.embedColor || "#5865F2";
  const colorInt = hexToInt(accentHex);
  if (colorInt !== undefined) {
    containerPayload.accent_color = colorInt;
  }

  if (panelData.spoiler) {
    containerPayload.spoiler = true;
  }

  return {
    components: [containerPayload],
    flags: MessageFlags.IsComponentsV2 as any, // 32768
  };
}

/**
 * Builds Classic Embed payload for legacy mode
 */
export function buildClassicTicketEmbedPayload(panel: any) {
  const embed = new EmbedBuilder()
    .setTitle(panel.embedTitle || panel.name || "Support Ticket")
    .setDescription(panel.embedDescription || "Click the button below or choose a reason to open a ticket.")
    .setColor((panel.embedColor as `#${string}`) || "#5865F2");

  if (panel.thumbnail && isValidUrl(panel.thumbnail)) embed.setThumbnail(panel.thumbnail.trim());
  if (panel.image && isValidUrl(panel.image)) embed.setImage(panel.image.trim());
  if (panel.footer) embed.setFooter({ text: panel.footer });

  const components: any[] = [];
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

  if (reasons.length > 0) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`ticket_select_reason:${panel.id}`)
      .setPlaceholder("Select a ticket reason...");

    reasons.forEach((r: any) => {
      const option = new StringSelectMenuOptionBuilder()
        .setLabel(r.label || "Support Reason")
        .setValue(r.value || r.label.toLowerCase().replace(/[^a-z0-9]/g, "_"))
        .setDescription(r.description || "Open ticket for this reason");
      if (r.emoji) {
        const parsedEmoji = parseAndValidateEmoji(r.emoji);
        if (parsedEmoji) option.setEmoji(parsedEmoji as any);
      }
      selectMenu.addOptions(option);
    });

    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));
  } else {
    let style = ButtonStyle.Primary;
    if (panel.buttonColor === "Secondary") style = ButtonStyle.Secondary;
    if (panel.buttonColor === "Success") style = ButtonStyle.Success;
    if (panel.buttonColor === "Danger") style = ButtonStyle.Danger;

    const button = new ButtonBuilder()
      .setCustomId(`ticket_open:${panel.id}`)
      .setLabel(panel.buttonText || "Create Ticket")
      .setStyle(style);

    if (panel.buttonEmoji) {
      const parsedEmoji = parseAndValidateEmoji(panel.buttonEmoji);
      if (parsedEmoji) button.setEmoji(parsedEmoji as any);
    }

    components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(button));
  }

  return {
    embeds: [embed],
    components,
  };
}

/**
 * Builds the complete Discord API payload for a Ticket Panel
 * based on layoutMode ("components_v2" vs "embed")
 */
export function buildTicketPanelPayload(panelData: any) {
  if (panelData.layoutMode === "embed") {
    return buildClassicTicketEmbedPayload(panelData);
  }
  return buildTicketComponentsV2Payload(panelData);
}
