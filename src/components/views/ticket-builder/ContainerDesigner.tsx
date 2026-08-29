"use client";

import React from "react";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Image as ImageIcon,
  Type,
  Split,
  MousePointerClick,
  Palette,
  ListFilter,
  Sliders,
} from "lucide-react";
import {
  TicketPanelData,
  TicketPanelComponentItem,
  SelectOptionItem,
} from "@/types/ticketComponentTypes";
import { PRESET_COLORS } from "./types";

interface ContainerDesignerProps {
  panelData: TicketPanelData;
  setPanelData: React.Dispatch<React.SetStateAction<TicketPanelData>>;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export function ContainerDesigner({
  panelData,
  setPanelData,
  showToast,
}: ContainerDesignerProps) {
  const addComponentBlock = (type: TicketPanelComponentItem["type"], extraType?: string) => {
    if (panelData.containerConfig.length >= 10) {
      showToast("Discord Limit: Maximal 10 Komponenten pro Container erlaubt.", "info");
      return;
    }

    const newId = "block-" + Date.now();
    let newBlock: TicketPanelComponentItem;

    if (type === "text") {
      newBlock = {
        id: newId,
        type: "text",
        content: "### Neuer Informationsbereich\nBeschreibe Support-Richtlinien oder erstelle Hilfetexte.",
      };
    } else if (type === "separator") {
      newBlock = { id: newId, type: "separator", divider: true };
    } else if (type === "media_gallery") {
      newBlock = {
        id: newId,
        type: "media_gallery",
        items: [{ url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600", description: "" }],
      };
    } else if (type === "section") {
      if (extraType === "thumbnail") {
        newBlock = {
          id: newId,
          type: "section",
          content: "### Support-Kategorie mit Thumbnail\nText auf der linken Seite, Bild auf der rechten Seite.",
          accessory: {
            type: "thumbnail",
            url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=150",
          },
        };
      } else {
        newBlock = {
          id: newId,
          type: "section",
          content: "### 1-Klick Support Ticket\nKlicke rechts auf den Button, um direkt ein Ticket zu öffnen.",
          accessory: {
            type: "button",
            style: "Primary",
            label: "Ticket öffnen",
            emoji: "🎫",
            actionType: "CREATE_TICKET",
            ticketTypeId: panelData.ticketTypesConfig[0]?.id || "general",
          },
        };
      }
    } else if (type === "action_row") {
      if (extraType === "select") {
        newBlock = {
          id: newId,
          type: "action_row",
          rowType: "select",
          selectMenu: {
            id: "sel-" + Date.now(),
            type: "string_select",
            placeholder: "Wähle einen Ticket-Bereich...",
            options: panelData.ticketTypesConfig.map((t) => ({
              label: t.label || t.name,
              value: t.id,
              description: t.description,
              emoji: t.emoji,
              actionType: "CREATE_TICKET",
              ticketTypeId: t.id,
            })),
          },
        };
      } else {
        newBlock = {
          id: newId,
          type: "action_row",
          rowType: "buttons",
          buttons: [
            {
              id: "btn-" + Date.now(),
              style: "Primary",
              label: "Ticket öffnen",
              emoji: "📩",
              actionType: "CREATE_TICKET",
              ticketTypeId: panelData.ticketTypesConfig[0]?.id || "general",
            },
          ],
        };
      }
    } else {
      newBlock = { id: newId, type: "text", content: "Neue Komponente" };
    }

    setPanelData((prev) => ({
      ...prev,
      containerConfig: [...prev.containerConfig, newBlock],
    }));
  };

  const removeComponentBlock = (index: number) => {
    setPanelData((prev) => ({
      ...prev,
      containerConfig: prev.containerConfig.filter((_, i) => i !== index),
    }));
  };

  const moveComponentBlock = (index: number, direction: "up" | "down") => {
    const list = [...panelData.containerConfig];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;
    setPanelData((prev) => ({ ...prev, containerConfig: list }));
  };

  const updateBlock = (index: number, patch: Partial<TicketPanelComponentItem>) => {
    setPanelData((prev) => {
      const next = [...prev.containerConfig];
      next[index] = { ...next[index], ...patch } as any;
      return { ...prev, containerConfig: next };
    });
  };

  return (
    <div className="space-y-5">
      {/* Root Container Style Options */}
      <div className="p-4 rounded-xl bg-[#0e0f15] border border-[#27272a] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-300 flex items-center gap-2">
            <Palette className="w-4 h-4 text-indigo-400" /> Container Akzentfarbe & Spoiler
          </span>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={!!panelData.spoiler}
              onChange={(e) => setPanelData({ ...panelData, spoiler: e.target.checked })}
              className="rounded border-[#27272a] bg-[#14151b] text-indigo-600 focus:ring-0 cursor-pointer"
            />
            <span>Spoiler Container</span>
          </label>
        </div>

        <div className="flex items-center gap-2 flex-wrap pt-1">
          {PRESET_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => setPanelData({ ...panelData, accentColor: c.hex })}
              className={`w-6 h-6 rounded-full border transition-all ${
                panelData.accentColor === c.hex ? "scale-125 border-white ring-2 ring-indigo-500" : "border-white/20 hover:scale-110"
              }`}
              style={{ backgroundColor: c.hex }}
              title={c.name}
            />
          ))}
          <div className="flex items-center gap-1.5 ml-2">
            <input
              type="color"
              value={panelData.accentColor || "#5865F2"}
              onChange={(e) => setPanelData({ ...panelData, accentColor: e.target.value })}
              className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
            />
            <input
              type="text"
              value={panelData.accentColor || "#5865F2"}
              onChange={(e) => setPanelData({ ...panelData, accentColor: e.target.value })}
              className="w-24 bg-[#14151b] border border-[#27272a] px-2 py-1 rounded text-xs font-mono text-white outline-none"
            />
          </div>
        </div>
      </div>

      {/* Component Toolbar (+ Add Blocks) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Discord V2 Komponenten ({panelData.containerConfig.length} / 10)
          </span>
          <span className="text-[11px] text-zinc-500 font-mono">Container Type 17</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => addComponentBlock("text")}
            className="p-2.5 rounded-xl bg-[#0e0f15] hover:bg-[#151722] border border-[#27272a] hover:border-indigo-500/40 text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-white group-hover:text-indigo-400">
              <Type className="w-3.5 h-3.5" /> + Text Display
            </div>
            <p className="text-[10px] text-zinc-500">Überschrift & Markdown</p>
          </button>

          <button
            type="button"
            onClick={() => addComponentBlock("section", "button")}
            className="p-2.5 rounded-xl bg-[#0e0f15] hover:bg-[#151722] border border-[#27272a] hover:border-indigo-500/40 text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-white group-hover:text-indigo-400">
              <Split className="w-3.5 h-3.5" /> + Section (Button)
            </div>
            <p className="text-[10px] text-zinc-500">Text links, Button rechts</p>
          </button>

          <button
            type="button"
            onClick={() => addComponentBlock("section", "thumbnail")}
            className="p-2.5 rounded-xl bg-[#0e0f15] hover:bg-[#151722] border border-[#27272a] hover:border-indigo-500/40 text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-white group-hover:text-indigo-400">
              <ImageIcon className="w-3.5 h-3.5" /> + Section (Thumbnail)
            </div>
            <p className="text-[10px] text-zinc-500">Text links, Bild rechts</p>
          </button>

          <button
            type="button"
            onClick={() => addComponentBlock("action_row", "buttons")}
            className="p-2.5 rounded-xl bg-[#0e0f15] hover:bg-[#151722] border border-[#27272a] hover:border-indigo-500/40 text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-white group-hover:text-indigo-400">
              <MousePointerClick className="w-3.5 h-3.5" /> + Buttons Row
            </div>
            <p className="text-[10px] text-zinc-500">Bis zu 5 Buttons</p>
          </button>

          <button
            type="button"
            onClick={() => addComponentBlock("action_row", "select")}
            className="p-2.5 rounded-xl bg-[#0e0f15] hover:bg-[#151722] border border-[#27272a] hover:border-indigo-500/40 text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-white group-hover:text-indigo-400">
              <ListFilter className="w-3.5 h-3.5" /> + Select Menu
            </div>
            <p className="text-[10px] text-zinc-500">Dropdown-Auswahlmenü</p>
          </button>

          <button
            type="button"
            onClick={() => addComponentBlock("separator")}
            className="p-2.5 rounded-xl bg-[#0e0f15] hover:bg-[#151722] border border-[#27272a] hover:border-indigo-500/40 text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-white group-hover:text-indigo-400">
              <Sliders className="w-3.5 h-3.5" /> + Trennlinie
            </div>
            <p className="text-[10px] text-zinc-500">Optische Trennlinie</p>
          </button>
        </div>
      </div>

      {/* Component Blocks List */}
      <div className="space-y-3 pt-2">
        {panelData.containerConfig.map((block, idx) => (
          <div
            key={block.id || idx}
            className="rounded-xl bg-[#0e0f15] border border-[#27272a] overflow-hidden shadow-md"
          >
            {/* Block Header */}
            <div className="p-3 bg-[#12131a] border-b border-[#1f2029] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1b1c26] text-zinc-400">
                  #{idx + 1}
                </span>
                <span className="text-xs font-bold text-white uppercase tracking-wide">
                  {block.type === "text" && "Text Display (Type 10)"}
                  {block.type === "section" && `Section (Type 9) • ${block.accessory?.type === "thumbnail" ? "Thumbnail" : "Button"}`}
                  {block.type === "action_row" && `Action Row (Type 1) • ${block.rowType === "select" || block.selectMenu ? "Select Menu" : "Buttons"}`}
                  {block.type === "separator" && "Separator (Type 14)"}
                  {block.type === "media_gallery" && "Media Gallery (Type 12)"}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveComponentBlock(idx, "up")}
                  disabled={idx === 0}
                  className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                  title="Nach oben verschieben"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveComponentBlock(idx, "down")}
                  disabled={idx === panelData.containerConfig.length - 1}
                  className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                  title="Nach unten verschieben"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeComponentBlock(idx)}
                  className="p-1 text-zinc-400 hover:text-rose-400 cursor-pointer"
                  title="Löschen"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Block Body */}
            <div className="p-4 space-y-3">
              {/* 1. Text Display Editor */}
              {block.type === "text" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-zinc-400">Textinhalt (Markdown unterstützt)</label>
                    <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                      <span>Platzhalter: <code>{"{user}"}</code>, <code>{"{server}"}</code></span>
                    </div>
                  </div>
                  <textarea
                    rows={3}
                    value={block.content || ""}
                    onChange={(e) => updateBlock(idx, { content: e.target.value })}
                    placeholder="# Große Überschrift&#10;Dein formatierter Text hier..."
                    className="w-full bg-[#14151b] border border-[#27272a] p-3 rounded-lg text-xs text-white outline-none focus:border-indigo-500 leading-relaxed font-mono"
                  />
                </div>
              )}

              {/* 2. Section Editor */}
              {block.type === "section" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-zinc-400 block mb-1">Textinhalt der Section (Links)</label>
                    <textarea
                      rows={2}
                      value={block.content || ""}
                      onChange={(e) => updateBlock(idx, { content: e.target.value })}
                      placeholder="Section Beschreibung..."
                      className="w-full bg-[#14151b] border border-[#27272a] p-2.5 rounded-lg text-xs text-white outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Accessory Editor */}
                  <div className="p-3 bg-[#14151b] rounded-lg border border-[#27272a] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-zinc-300">Accessory Element (Rechtsbündig)</span>
                      <select
                        value={block.accessory?.type || "button"}
                        onChange={(e) =>
                          updateBlock(idx, {
                            accessory: {
                              ...block.accessory,
                              type: e.target.value as any,
                              style: "Primary",
                              label: "Ticket öffnen",
                              actionType: "CREATE_TICKET",
                            },
                          })
                        }
                        className="bg-[#0e0f15] border border-[#27272a] px-2 py-1 rounded text-xs text-white outline-none"
                      >
                        <option value="button">Button (Aktion)</option>
                        <option value="thumbnail">Thumbnail (Bild)</option>
                      </select>
                    </div>

                    {block.accessory?.type === "thumbnail" ? (
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">Thumbnail Bild URL</label>
                        <input
                          type="text"
                          value={block.accessory?.url || ""}
                          onChange={(e) =>
                            updateBlock(idx, {
                              accessory: { ...block.accessory, type: "thumbnail", url: e.target.value },
                            })
                          }
                          placeholder="https://images.unsplash.com/..."
                          className="w-full bg-[#0e0f15] border border-[#27272a] px-3 py-1.5 rounded-lg text-xs text-white outline-none"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-4">
                          <label className="text-[10px] text-zinc-400 block mb-1">Label</label>
                          <input
                            type="text"
                            value={block.accessory?.label || ""}
                            onChange={(e) =>
                              updateBlock(idx, {
                                accessory: { ...block.accessory, type: "button", label: e.target.value },
                              })
                            }
                            placeholder="Button Label"
                            className="w-full bg-[#0e0f15] border border-[#27272a] px-2.5 py-1.5 rounded-lg text-xs text-white outline-none"
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="text-[10px] text-zinc-400 block mb-1">Stil</label>
                          <select
                            value={block.accessory?.style || "Primary"}
                            onChange={(e) =>
                              updateBlock(idx, {
                                accessory: { ...block.accessory, type: "button", style: e.target.value as any },
                              })
                            }
                            className="w-full bg-[#0e0f15] border border-[#27272a] px-2.5 py-1.5 rounded-lg text-xs text-white outline-none"
                          >
                            <option value="Primary">Primary (Blau)</option>
                            <option value="Secondary">Secondary (Grau)</option>
                            <option value="Success">Success (Grün)</option>
                            <option value="Danger">Danger (Rot)</option>
                            <option value="Link">Link (URL)</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] text-zinc-400 block mb-1">Emoji</label>
                          <input
                            type="text"
                            value={block.accessory?.emoji || ""}
                            onChange={(e) =>
                              updateBlock(idx, {
                                accessory: { ...block.accessory, type: "button", emoji: e.target.value },
                              })
                            }
                            placeholder="📩"
                            className="w-full bg-[#0e0f15] border border-[#27272a] px-2.5 py-1.5 rounded-lg text-xs text-center text-white outline-none"
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="text-[10px] text-zinc-400 block mb-1">Ticket-Typ</label>
                          <select
                            value={block.accessory?.ticketTypeId || panelData.ticketTypesConfig[0]?.id || ""}
                            onChange={(e) =>
                              updateBlock(idx, {
                                accessory: { ...block.accessory, type: "button", ticketTypeId: e.target.value },
                              })
                            }
                            className="w-full bg-[#0e0f15] border border-[#27272a] px-2.5 py-1.5 rounded-lg text-xs text-white outline-none"
                          >
                            {panelData.ticketTypesConfig.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.emoji || "🎫"} {t.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 3. Action Row Editor */}
              {block.type === "action_row" && (
                <div className="space-y-3">
                  {block.rowType === "select" || block.selectMenu ? (
                    /* SELECT MENU */
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 block mb-1">Menü-Typ</label>
                          <select
                            value={block.selectMenu?.type || "string_select"}
                            onChange={(e) =>
                              updateBlock(idx, {
                                selectMenu: {
                                  ...block.selectMenu,
                                  id: block.selectMenu?.id || "sel-" + Date.now(),
                                  type: e.target.value as any,
                                },
                              })
                            }
                            className="w-full bg-[#14151b] border border-[#27272a] px-3 py-1.5 rounded-lg text-xs text-white outline-none"
                          >
                            <option value="string_select">String Select (Optionen mit Ticket-Typen)</option>
                            <option value="channel_select">Channel Select</option>
                            <option value="role_select">Role Select</option>
                            <option value="user_select">User Select</option>
                            <option value="mentionable_select">Mentionable Select</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 block mb-1">Platzhalter-Text</label>
                          <input
                            type="text"
                            value={block.selectMenu?.placeholder || ""}
                            onChange={(e) =>
                              updateBlock(idx, {
                                selectMenu: {
                                  ...block.selectMenu,
                                  id: block.selectMenu?.id || "sel-" + Date.now(),
                                  type: block.selectMenu?.type || "string_select",
                                  placeholder: e.target.value,
                                },
                              })
                            }
                            placeholder="Wähle eine Kategorie..."
                            className="w-full bg-[#14151b] border border-[#27272a] px-3 py-1.5 rounded-lg text-xs text-white outline-none"
                          />
                        </div>
                      </div>

                      {(!block.selectMenu?.type || block.selectMenu.type === "string_select") && (
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold uppercase text-zinc-400">
                              Dropdown-Optionen ({block.selectMenu?.options?.length || 0} / 25)
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const nextOptions: SelectOptionItem[] = [
                                  ...(block.selectMenu?.options || []),
                                  {
                                    label: `Option ${(block.selectMenu?.options?.length || 0) + 1}`,
                                    value: `opt_${Date.now()}`,
                                    description: "Beschreibung",
                                    emoji: "📌",
                                    actionType: "CREATE_TICKET",
                                    ticketTypeId: panelData.ticketTypesConfig[0]?.id || "general",
                                  },
                                ];
                                updateBlock(idx, {
                                  selectMenu: {
                                    ...block.selectMenu,
                                    id: block.selectMenu?.id || "sel-" + Date.now(),
                                    type: "string_select",
                                    options: nextOptions,
                                  },
                                });
                              }}
                              className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" /> Option hinzufügen
                            </button>
                          </div>

                          <div className="space-y-2">
                            {(block.selectMenu?.options || []).map((opt, oIdx) => (
                              <div
                                key={oIdx}
                                className="p-2.5 bg-[#14151b] rounded-lg border border-[#27272a] space-y-2"
                              >
                                <div className="grid grid-cols-12 gap-2 items-center">
                                  <div className="col-span-1">
                                    <input
                                      type="text"
                                      value={opt.emoji || ""}
                                      onChange={(e) => {
                                        const nextOpt = [...(block.selectMenu?.options || [])];
                                        nextOpt[oIdx] = { ...nextOpt[oIdx], emoji: e.target.value };
                                        updateBlock(idx, {
                                          selectMenu: {
                                            ...block.selectMenu,
                                            id: block.selectMenu?.id || "sel-" + Date.now(),
                                            type: "string_select",
                                            options: nextOpt,
                                          },
                                        });
                                      }}
                                      placeholder="📌"
                                      className="w-full bg-[#0e0f15] border border-[#27272a] p-1.5 rounded text-xs text-center text-white outline-none"
                                    />
                                  </div>
                                  <div className="col-span-4">
                                    <input
                                      type="text"
                                      value={opt.label}
                                      onChange={(e) => {
                                        const nextOpt = [...(block.selectMenu?.options || [])];
                                        nextOpt[oIdx] = { ...nextOpt[oIdx], label: e.target.value };
                                        updateBlock(idx, {
                                          selectMenu: {
                                            ...block.selectMenu,
                                            id: block.selectMenu?.id || "sel-" + Date.now(),
                                            type: "string_select",
                                            options: nextOpt,
                                          },
                                        });
                                      }}
                                      placeholder="Label"
                                      className="w-full bg-[#0e0f15] border border-[#27272a] px-2.5 py-1.5 rounded text-xs text-white outline-none"
                                    />
                                  </div>
                                  <div className="col-span-3">
                                    <select
                                      value={opt.actionType || "CREATE_TICKET"}
                                      onChange={(e) => {
                                        const nextOpt = [...(block.selectMenu?.options || [])];
                                        nextOpt[oIdx] = { ...nextOpt[oIdx], actionType: e.target.value as any };
                                        updateBlock(idx, {
                                          selectMenu: {
                                            ...block.selectMenu,
                                            id: block.selectMenu?.id || "sel-" + Date.now(),
                                            type: "string_select",
                                            options: nextOpt,
                                          },
                                        });
                                      }}
                                      className="w-full bg-[#0e0f15] border border-[#27272a] px-2 py-1.5 rounded text-xs text-white outline-none"
                                    >
                                      <option value="CREATE_TICKET">Ticket erstellen</option>
                                      <option value="EPHEMERAL_REPLY">Info senden</option>
                                    </select>
                                  </div>
                                  <div className="col-span-3">
                                    <select
                                      value={opt.ticketTypeId || panelData.ticketTypesConfig[0]?.id || ""}
                                      onChange={(e) => {
                                        const nextOpt = [...(block.selectMenu?.options || [])];
                                        nextOpt[oIdx] = { ...nextOpt[oIdx], ticketTypeId: e.target.value };
                                        updateBlock(idx, {
                                          selectMenu: {
                                            ...block.selectMenu,
                                            id: block.selectMenu?.id || "sel-" + Date.now(),
                                            type: "string_select",
                                            options: nextOpt,
                                          },
                                        });
                                      }}
                                      className="w-full bg-[#0e0f15] border border-[#27272a] px-2 py-1.5 rounded text-xs text-white outline-none"
                                    >
                                      {panelData.ticketTypesConfig.map((t) => (
                                        <option key={t.id} value={t.id}>
                                          {t.emoji} {t.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="col-span-1 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextOpt = (block.selectMenu?.options || []).filter((_, i) => i !== oIdx);
                                        updateBlock(idx, {
                                          selectMenu: {
                                            ...block.selectMenu,
                                            id: block.selectMenu?.id || "sel-" + Date.now(),
                                            type: "string_select",
                                            options: nextOpt,
                                          },
                                        });
                                      }}
                                      className="p-1 text-zinc-400 hover:text-rose-400 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                <input
                                  type="text"
                                  value={opt.description || ""}
                                  onChange={(e) => {
                                    const nextOpt = [...(block.selectMenu?.options || [])];
                                    nextOpt[oIdx] = { ...nextOpt[oIdx], description: e.target.value };
                                    updateBlock(idx, {
                                      selectMenu: {
                                        ...block.selectMenu,
                                        id: block.selectMenu?.id || "sel-" + Date.now(),
                                        type: "string_select",
                                        options: nextOpt,
                                      },
                                    });
                                  }}
                                  placeholder="Option Beschreibung"
                                  className="w-full bg-[#0e0f15] border border-[#27272a] px-2.5 py-1 rounded text-[11px] text-zinc-300 outline-none"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* BUTTONS ROW */
                    <div className="space-y-3">
                      <div className="space-y-2">
                        {(block.buttons || []).map((btn, bIdx) => (
                          <div
                            key={btn.id || bIdx}
                            className="p-2.5 bg-[#14151b] rounded-lg border border-[#27272a] grid grid-cols-12 gap-2 items-center"
                          >
                            <div className="col-span-1">
                              <input
                                type="text"
                                value={btn.emoji || ""}
                                onChange={(e) => {
                                  const nextBtns = [...(block.buttons || [])];
                                  nextBtns[bIdx] = { ...nextBtns[bIdx], emoji: e.target.value };
                                  updateBlock(idx, { buttons: nextBtns });
                                }}
                                placeholder="📩"
                                className="w-full bg-[#0e0f15] border border-[#27272a] p-1.5 rounded text-xs text-center text-white outline-none"
                              />
                            </div>
                            <div className="col-span-3">
                              <input
                                type="text"
                                value={btn.label}
                                onChange={(e) => {
                                  const nextBtns = [...(block.buttons || [])];
                                  nextBtns[bIdx] = { ...nextBtns[bIdx], label: e.target.value };
                                  updateBlock(idx, { buttons: nextBtns });
                                }}
                                placeholder="Label"
                                className="w-full bg-[#0e0f15] border border-[#27272a] px-2.5 py-1.5 rounded text-xs text-white outline-none"
                              />
                            </div>
                            <div className="col-span-2">
                              <select
                                value={btn.style}
                                onChange={(e) => {
                                  const nextBtns = [...(block.buttons || [])];
                                  nextBtns[bIdx] = { ...nextBtns[bIdx], style: e.target.value as any };
                                  updateBlock(idx, { buttons: nextBtns });
                                }}
                                className="w-full bg-[#0e0f15] border border-[#27272a] px-2 py-1.5 rounded text-xs text-white outline-none"
                              >
                                <option value="Primary">Primary (Blau)</option>
                                <option value="Secondary">Secondary (Grau)</option>
                                <option value="Success">Success (Grün)</option>
                                <option value="Danger">Danger (Rot)</option>
                                <option value="Link">Link (URL)</option>
                              </select>
                            </div>
                            <div className="col-span-3">
                              <select
                                value={btn.actionType || "CREATE_TICKET"}
                                onChange={(e) => {
                                  const nextBtns = [...(block.buttons || [])];
                                  nextBtns[bIdx] = { ...nextBtns[bIdx], actionType: e.target.value as any };
                                  updateBlock(idx, { buttons: nextBtns });
                                }}
                                className="w-full bg-[#0e0f15] border border-[#27272a] px-2 py-1.5 rounded text-xs text-white outline-none"
                              >
                                <option value="CREATE_TICKET">Ticket erstellen</option>
                                <option value="CLOSE_TICKET">Ticket schließen</option>
                                <option value="CLAIM_TICKET">Ticket claimen</option>
                                <option value="EPHEMERAL_REPLY">Info senden</option>
                                <option value="LINK">Link öffnen</option>
                              </select>
                            </div>
                            <div className="col-span-2">
                              <select
                                value={btn.ticketTypeId || panelData.ticketTypesConfig[0]?.id || ""}
                                onChange={(e) => {
                                  const nextBtns = [...(block.buttons || [])];
                                  nextBtns[bIdx] = { ...nextBtns[bIdx], ticketTypeId: e.target.value };
                                  updateBlock(idx, { buttons: nextBtns });
                                }}
                                className="w-full bg-[#0e0f15] border border-[#27272a] px-2 py-1.5 rounded text-xs text-white outline-none"
                              >
                                {panelData.ticketTypesConfig.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.emoji} {t.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="col-span-1 flex justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  const nextBtns = (block.buttons || []).filter((_, i) => i !== bIdx);
                                  updateBlock(idx, { buttons: nextBtns });
                                }}
                                className="p-1 text-zinc-400 hover:text-rose-400 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {(block.buttons || []).length < 5 && (
                        <button
                          type="button"
                          onClick={() => {
                            const nextBtns = [
                              ...(block.buttons || []),
                              {
                                id: "btn-" + Date.now(),
                                style: "Primary" as const,
                                label: "Button",
                                emoji: "📩",
                                actionType: "CREATE_TICKET" as const,
                                ticketTypeId: panelData.ticketTypesConfig[0]?.id || "general",
                              },
                            ];
                            updateBlock(idx, { buttons: nextBtns });
                          }}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Button hinzufügen (max. 5)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 4. Separator */}
              {block.type === "separator" && (
                <div className="flex items-center justify-between p-2 bg-[#14151b] rounded-lg text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                    <input
                      type="checkbox"
                      checked={block.divider !== false}
                      onChange={(e) => updateBlock(idx, { divider: e.target.checked })}
                      className="rounded bg-[#0e0f15] border-[#27272a] text-indigo-600 cursor-pointer"
                    />
                    <span>Optische Trennlinie zeichnen</span>
                  </label>
                  <span className="text-[10px] text-zinc-500 font-mono">Separator Type 14</span>
                </div>
              )}

              {/* 5. Media Gallery */}
              {block.type === "media_gallery" && (
                <div className="space-y-2.5">
                  <label className="text-[11px] font-bold text-zinc-400 block">Bilder-URLs der Galerie</label>
                  {(block.items || []).map((m, mIdx) => (
                    <div key={mIdx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={m.url || ""}
                        onChange={(e) => {
                          const nextItems = [...(block.items || [])];
                          nextItems[mIdx] = { ...nextItems[mIdx], url: e.target.value };
                          updateBlock(idx, { items: nextItems });
                        }}
                        placeholder="https://images.unsplash.com/..."
                        className="flex-1 bg-[#14151b] border border-[#27272a] px-3 py-1.5 rounded-lg text-xs text-white outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const nextItems = (block.items || []).filter((_, i) => i !== mIdx);
                          updateBlock(idx, { items: nextItems });
                        }}
                        className="p-1.5 text-zinc-400 hover:text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {(block.items || []).length < 4 && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextItems = [...(block.items || []), { url: "", description: "" }];
                        updateBlock(idx, { items: nextItems });
                      }}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Weiteres Bild hinzufügen
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
