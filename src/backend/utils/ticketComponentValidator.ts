import {
  TicketPanelComponentItem,
  TicketTypeConfig,
  TicketPanelData,
} from "../types/ticketComponentTypes";

export interface ValidationError {
  field?: string;
  componentId?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

function isValidUrl(str?: string | null): boolean {
  if (!str || !str.trim()) return false;
  try {
    const url = new URL(str.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validates a Discord Components V2 Ticket Panel configuration against official Discord API limits
 */
export function validateTicketPanelComponents(
  containerConfig: TicketPanelComponentItem[],
  ticketTypes: TicketTypeConfig[] = []
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(containerConfig)) {
    return {
      valid: false,
      errors: [{ message: "Die Komponenten-Konfiguration muss ein Array sein." }],
      warnings: [],
    };
  }

  // 1. Root Container limit (Discord max 10 top-level components)
  if (containerConfig.length > 10) {
    errors.push({
      message: `Der Container enthält ${containerConfig.length} Komponenten. Discord erlaubt maximal 10 Komponenten auf oberster Ebene. Bitte entferne mindestens ${containerConfig.length - 10} Komponenten.`,
    });
  }

  if (containerConfig.length === 0) {
    warnings.push("Das Panel enthält aktuell keine Komponenten. Es wird ein Standard-Platzhaltertext angezeigt.");
  }

  let actionRowCount = 0;
  const configuredTicketTypeIds = new Set(ticketTypes.map((t) => t.id));

  containerConfig.forEach((item, index) => {
    const pos = index + 1;
    if (!item || !item.type) {
      errors.push({
        componentId: (item as any)?.id,
        message: `Komponente an Position ${pos} hat keinen gültigen Typ.`,
      });
      return;
    }

    switch (item.type) {
      // 1. Text Display
      case "text": {
        const content = item.content || "";
        if (!content.trim()) {
          warnings.push(`Textfeld an Position ${pos} ist leer.`);
        } else if (content.length > 4000) {
          errors.push({
            componentId: item.id,
            message: `Textfeld an Position ${pos} überschreitet das Discord-Limit von 4000 Zeichen (aktuell: ${content.length} Zeichen).`,
          });
        }
        break;
      }

      // 2. Separator
      case "separator": {
        if (item.spacing !== undefined && (item.spacing < 0 || item.spacing > 2)) {
          warnings.push(`Trennlinie an Position ${pos} hat einen ungewöhnlichen Abstandswert (${item.spacing}).`);
        }
        break;
      }

      // 3. Media Gallery
      case "media_gallery": {
        const items = item.items || [];
        if (items.length === 0) {
          warnings.push(`Medien-Galerie an Position ${pos} enthält keine Bilder.`);
        } else if (items.length > 10) {
          errors.push({
            componentId: item.id,
            message: `Medien-Galerie an Position ${pos} enthält ${items.length} Bilder (maximal 10 Bilder erlaubt).`,
          });
        }

        items.forEach((m, mIdx) => {
          if (!m.url || !isValidUrl(m.url)) {
            errors.push({
              componentId: item.id,
              message: `Bild #${mIdx + 1} in der Medien-Galerie an Position ${pos} hat eine ungültige URL ("${m.url || ""}").`,
            });
          }
          if (m.description && m.description.length > 1024) {
            errors.push({
              componentId: item.id,
              message: `Bildbeschreibung für Bild #${mIdx + 1} an Position ${pos} überschreitet 1024 Zeichen.`,
            });
          }
        });
        break;
      }

      // 4. Section
      case "section": {
        const content = item.content || "";
        if (content.length > 2000) {
          errors.push({
            componentId: item.id,
            message: `Textinhalt der Section an Position ${pos} überschreitet das Limit von 2000 Zeichen (aktuell: ${content.length}).`,
          });
        }

        if (item.accessory) {
          if (item.accessory.type === "thumbnail") {
            if (!item.accessory.url || !isValidUrl(item.accessory.url)) {
              errors.push({
                componentId: item.id,
                message: `Thumbnail-Accessory in Section an Position ${pos} hat eine ungültige URL.`,
              });
            }
          } else if (item.accessory.type === "button") {
            const btn = item.accessory;
            if (!btn.label && !btn.emoji) {
              errors.push({
                componentId: item.id,
                message: `Button-Accessory in Section an Position ${pos} benötigt mindestens eine Beschriftung (Label) oder ein Emoji.`,
              });
            }
            if (btn.label && btn.label.length > 80) {
              errors.push({
                componentId: item.id,
                message: `Button-Label in Section an Position ${pos} überschreitet das Limit von 80 Zeichen.`,
              });
            }
            if (btn.style === "Link" || btn.style === 5 || btn.actionType === "LINK") {
              if (!btn.url || !isValidUrl(btn.url)) {
                errors.push({
                  componentId: item.id,
                  message: `Link-Button in Section an Position ${pos} benötigt eine gültige URL.`,
                });
              }
            } else if (btn.actionType === "CREATE_TICKET" && btn.ticketTypeId) {
              if (ticketTypes.length > 0 && !configuredTicketTypeIds.has(btn.ticketTypeId)) {
                warnings.push(
                  `Button in Section an Position ${pos} verweist auf Ticket-Typ "${btn.ticketTypeId}", der in den Ticket-Typen nicht definiert ist.`
                );
              }
            }
          }
        }
        break;
      }

      // 5. Action Row
      case "action_row": {
        actionRowCount++;
        if (item.rowType === "select" || item.selectMenu) {
          const sel = item.selectMenu;
          if (!sel) {
            errors.push({
              componentId: item.id,
              message: `Action Row an Position ${pos} ist als Auswahlmenü deklariert, enthält jedoch keine Select-Konfiguration.`,
            });
          } else {
            if (sel.type === "string_select" || !sel.type) {
              const options = sel.options || [];
              if (options.length === 0) {
                errors.push({
                  componentId: item.id,
                  message: `Auswahlmenü an Position ${pos} muss mindestens 1 Option enthalten.`,
                });
              } else if (options.length > 25) {
                errors.push({
                  componentId: item.id,
                  message: `Auswahlmenü an Position ${pos} enthält ${options.length} Optionen (maximal 25 erlaubt).`,
                });
              }

              options.forEach((opt, optIdx) => {
                if (!opt.label || !opt.label.trim()) {
                  errors.push({
                    componentId: item.id,
                    message: `Option #${optIdx + 1} im Auswahlmenü an Position ${pos} benötigt eine Beschriftung (Label).`,
                  });
                } else if (opt.label.length > 100) {
                  errors.push({
                    componentId: item.id,
                    message: `Label von Option #${optIdx + 1} an Position ${pos} überschreitet 100 Zeichen.`,
                  });
                }
                if (opt.description && opt.description.length > 100) {
                  errors.push({
                    componentId: item.id,
                    message: `Beschreibung von Option #${optIdx + 1} an Position ${pos} überschreitet 100 Zeichen.`,
                  });
                }
                if (opt.actionType === "CREATE_TICKET" && opt.ticketTypeId) {
                  if (ticketTypes.length > 0 && !configuredTicketTypeIds.has(opt.ticketTypeId)) {
                    warnings.push(
                      `Option "${opt.label}" verweist auf Ticket-Typ "${opt.ticketTypeId}", der nicht in den Ticket-Typen vorhanden ist.`
                    );
                  }
                }
              });
            }
          }
        } else {
          // Buttons
          const buttons = item.buttons || [];
          if (buttons.length === 0) {
            warnings.push(`Button-Reihe an Position ${pos} enthält aktuell keine Buttons.`);
          } else if (buttons.length > 5) {
            errors.push({
              componentId: item.id,
              message: `Button-Reihe an Position ${pos} enthält ${buttons.length} Buttons. Discord erlaubt maximal 5 Buttons pro Action Row.`,
            });
          }

          buttons.forEach((btn, bIdx) => {
            if (!btn.label && !btn.emoji) {
              errors.push({
                componentId: item.id,
                message: `Button #${bIdx + 1} an Position ${pos} benötigt mindestens eine Beschriftung oder ein Emoji.`,
              });
            }
            if (btn.label && btn.label.length > 80) {
              errors.push({
                componentId: item.id,
                message: `Label von Button #${bIdx + 1} an Position ${pos} überschreitet 80 Zeichen.`,
              });
            }
            if (btn.style === "Link" || btn.style === 5 || btn.actionType === "LINK") {
              if (!btn.url || !isValidUrl(btn.url)) {
                errors.push({
                  componentId: item.id,
                  message: `Link-Button #${bIdx + 1} an Position ${pos} benötigt eine gültige URL.`,
                });
              }
            } else if (btn.actionType === "CREATE_TICKET" && btn.ticketTypeId) {
              if (ticketTypes.length > 0 && !configuredTicketTypeIds.has(btn.ticketTypeId)) {
                warnings.push(
                  `Button "${btn.label || bIdx + 1}" verweist auf Ticket-Typ "${btn.ticketTypeId}", der nicht definiert ist.`
                );
              }
            }
          });
        }
        break;
      }
    }
  });

  if (actionRowCount > 5) {
    errors.push({
      message: `Das Panel enthält ${actionRowCount} Action Rows. Discord erlaubt maximal 5 Action Rows pro Nachricht.`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
