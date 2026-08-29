"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Plus,
  Trash2,
  ChevronRight,
  ListOrdered,
  MessageCircle,
} from "lucide-react";
import {
  TicketPanelData,
  TicketTypeConfig,
  IntakeQuestionItem,
} from "@/types/ticketComponentTypes";
import { Channel } from "./types";

interface TicketTypesManagerProps {
  panelData: TicketPanelData;
  setPanelData: React.Dispatch<React.SetStateAction<TicketPanelData>>;
  categoryChannels: Channel[];
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export function TicketTypesManager({
  panelData,
  setPanelData,
  categoryChannels,
  showToast,
}: TicketTypesManagerProps) {
  const [expandedTypeIdx, setExpandedTypeIdx] = useState<number | null>(0);

  const addTicketType = () => {
    const newTypeId = "type_" + Date.now();
    const newType: TicketTypeConfig = {
      id: newTypeId,
      name: `Ticket Typ ${panelData.ticketTypesConfig.length + 1}`,
      label: `Ticket Typ ${panelData.ticketTypesConfig.length + 1}`,
      emoji: "🎫",
      description: "Beschreibung für diesen Support-Bereich",
      namingFormat: "ticket-{username}",
      welcomeTitle: `👋 Willkommen im Support-Ticket!`,
      welcomeDescription: `Willkommen {user}! Ein Supporter wird dir in Kürze zur Seite stehen. Nutze die Buttons unten zur Verwaltung.`,
      welcomeColor: "#5865F2",
      questions: [],
    };

    setPanelData((prev) => ({
      ...prev,
      ticketTypesConfig: [...prev.ticketTypesConfig, newType],
    }));
    setExpandedTypeIdx(panelData.ticketTypesConfig.length);
  };

  const updateTicketType = (index: number, patch: Partial<TicketTypeConfig>) => {
    setPanelData((prev) => {
      const next = [...prev.ticketTypesConfig];
      next[index] = { ...next[index], ...patch };
      return { ...prev, ticketTypesConfig: next };
    });
  };

  const removeTicketType = (index: number) => {
    if (panelData.ticketTypesConfig.length <= 1) {
      showToast("Das Panel benötigt mindestens einen Ticket-Typ.", "info");
      return;
    }
    setPanelData((prev) => ({
      ...prev,
      ticketTypesConfig: prev.ticketTypesConfig.filter((_, i) => i !== index),
    }));
  };

  const addIntakeQuestion = (typeIdx: number) => {
    const currentType = panelData.ticketTypesConfig[typeIdx];
    if (!currentType) return;
    const currentQuestions = currentType.questions || [];
    if (currentQuestions.length >= 5) {
      showToast("Discord Limit: Maximal 5 Intake-Fragen pro Modal erlaubt.", "info");
      return;
    }

    const newQ: IntakeQuestionItem = {
      id: "q_" + Date.now(),
      label: `Frage ${currentQuestions.length + 1}`,
      placeholder: "Antwort hier eingeben...",
      style: "short",
      required: true,
    };

    updateTicketType(typeIdx, { questions: [...currentQuestions, newQ] });
  };

  const removeIntakeQuestion = (typeIdx: number, qIdx: number) => {
    const currentType = panelData.ticketTypesConfig[typeIdx];
    if (!currentType) return;
    const nextQ = (currentType.questions || []).filter((_, i) => i !== qIdx);
    updateTicketType(typeIdx, { questions: nextQ });
  };

  const updateIntakeQuestion = (typeIdx: number, qIdx: number, patch: Partial<IntakeQuestionItem>) => {
    const currentType = panelData.ticketTypesConfig[typeIdx];
    if (!currentType) return;
    const nextQ = [...(currentType.questions || [])];
    nextQ[qIdx] = { ...nextQ[qIdx], ...patch };
    updateTicketType(typeIdx, { questions: nextQ });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" /> Ticket-Typen Konfigurator
          </h3>
          <p className="text-xs text-zinc-400">
            Jeder Ticket-Typ kann eine eigene Kategorie, Supporter-Rollen, Intake-Fragen und Willkommensnachrichten haben.
          </p>
        </div>
        <button
          type="button"
          onClick={addTicketType}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Ticket-Typ hinzufügen
        </button>
      </div>

      <div className="space-y-3">
        {panelData.ticketTypesConfig.map((t, tIdx) => {
          const isExpanded = expandedTypeIdx === tIdx;
          return (
            <div
              key={t.id || tIdx}
              className="rounded-2xl bg-[#0e0f15] border border-[#27272a] overflow-hidden shadow-lg"
            >
              {/* Header */}
              <div
                onClick={() => setExpandedTypeIdx(isExpanded ? null : tIdx)}
                className="p-4 bg-[#12131a] flex items-center justify-between cursor-pointer hover:bg-[#161722] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{t.emoji || "🎫"}</span>
                  <div>
                    <h4 className="text-sm font-bold text-white">{t.name || t.label}</h4>
                    <p className="text-[11px] text-zinc-400">{t.description || "Keine Beschreibung"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1b1c26] text-zinc-400 border border-[#27272a]">
                    {t.questions?.length || 0} Fragen
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTicketType(tIdx);
                    }}
                    className="p-1.5 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-[#27272a] cursor-pointer"
                    title="Typ löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className={`w-4 h-4 text-zinc-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="p-5 space-y-4 border-t border-[#1f2029]">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-zinc-400 block mb-1">Name / Label</label>
                      <input
                        type="text"
                        value={t.name}
                        onChange={(e) => updateTicketType(tIdx, { name: e.target.value, label: e.target.value })}
                        className="w-full bg-[#14151b] border border-[#27272a] px-3 py-2 rounded-lg text-xs text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-zinc-400 block mb-1">Emoji</label>
                      <input
                        type="text"
                        value={t.emoji || ""}
                        onChange={(e) => updateTicketType(tIdx, { emoji: e.target.value })}
                        placeholder="🎫"
                        className="w-full bg-[#14151b] border border-[#27272a] px-3 py-2 rounded-lg text-xs text-center text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-zinc-400 block mb-1">Zielkategorie (Discord)</label>
                      <select
                        value={t.categoryId || ""}
                        onChange={(e) => updateTicketType(tIdx, { categoryId: e.target.value })}
                        className="w-full bg-[#14151b] border border-[#27272a] px-3 py-2 rounded-lg text-xs text-white outline-none"
                      >
                        <option value="">Standard-Kategorie</option>
                        {categoryChannels.map((c) => (
                          <option key={c.id} value={c.id}>
                            📁 {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-zinc-400 block mb-1">Kanalnamens-Format</label>
                      <input
                        type="text"
                        value={t.namingFormat || "ticket-{username}"}
                        onChange={(e) => updateTicketType(tIdx, { namingFormat: e.target.value })}
                        placeholder="ticket-{username}"
                        className="w-full bg-[#14151b] border border-[#27272a] px-3 py-2 rounded-lg text-xs font-mono text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-zinc-400 block mb-1">Beschreibung</label>
                      <input
                        type="text"
                        value={t.description || ""}
                        onChange={(e) => updateTicketType(tIdx, { description: e.target.value })}
                        placeholder="Beschreibung für Dropdown..."
                        className="w-full bg-[#14151b] border border-[#27272a] px-3 py-2 rounded-lg text-xs text-white outline-none"
                      />
                    </div>
                  </div>

                  {/* Intake Modal Questions Builder */}
                  <div className="p-4 bg-[#14151b] rounded-xl border border-[#27272a] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <ListOrdered className="w-3.5 h-3.5" /> Intake Fragen (Discord Modal vor Ticket-Öffnung)
                      </span>
                      {(t.questions || []).length < 5 && (
                        <button
                          type="button"
                          onClick={() => addIntakeQuestion(tIdx)}
                          className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Frage hinzufügen
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {(t.questions || []).length === 0 ? (
                        <p className="text-xs text-zinc-500 py-2">
                          Keine Fragen hinterlegt. Das Ticket wird beim Klick direkt geöffnet.
                        </p>
                      ) : (
                        t.questions?.map((q, qIdx) => (
                          <div
                            key={q.id || qIdx}
                            className="p-3 bg-[#0e0f15] rounded-lg border border-[#27272a] grid grid-cols-12 gap-2 items-center"
                          >
                            <div className="col-span-5">
                              <label className="text-[10px] text-zinc-400 block mb-1">Fragetext / Label</label>
                              <input
                                type="text"
                                value={q.label}
                                onChange={(e) => updateIntakeQuestion(tIdx, qIdx, { label: e.target.value })}
                                placeholder="z.B. Welches Betriebssystem nutzt du?"
                                className="w-full bg-[#14151b] border border-[#27272a] px-2.5 py-1.5 rounded text-xs text-white outline-none"
                              />
                            </div>
                            <div className="col-span-4">
                              <label className="text-[10px] text-zinc-400 block mb-1">Platzhalter</label>
                              <input
                                type="text"
                                value={q.placeholder || ""}
                                onChange={(e) => updateIntakeQuestion(tIdx, qIdx, { placeholder: e.target.value })}
                                placeholder="Antwort hier eingeben..."
                                className="w-full bg-[#14151b] border border-[#27272a] px-2.5 py-1.5 rounded text-xs text-white outline-none"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="text-[10px] text-zinc-400 block mb-1">Typ</label>
                              <select
                                value={q.style}
                                onChange={(e) => updateIntakeQuestion(tIdx, qIdx, { style: e.target.value as any })}
                                className="w-full bg-[#14151b] border border-[#27272a] px-2 py-1.5 rounded text-xs text-white outline-none"
                              >
                                <option value="short">Kurztext</option>
                                <option value="paragraph">Absatz</option>
                              </select>
                            </div>
                            <div className="col-span-1 flex justify-end">
                              <button
                                type="button"
                                onClick={() => removeIntakeQuestion(tIdx, qIdx)}
                                className="p-1 text-zinc-400 hover:text-rose-400 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Welcome Message Customizer per Ticket Type */}
                  <div className="p-4 bg-[#14151b] rounded-xl border border-[#27272a] space-y-3">
                    <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                      <MessageCircle className="w-3.5 h-3.5" /> Willkommensnachricht in eröffnetem Ticket
                    </span>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">Titel</label>
                        <input
                          type="text"
                          value={t.welcomeTitle || ""}
                          onChange={(e) => updateTicketType(tIdx, { welcomeTitle: e.target.value })}
                          placeholder="👋 Willkommen im Ticket!"
                          className="w-full bg-[#0e0f15] border border-[#27272a] px-2.5 py-1.5 rounded-lg text-xs text-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">Farbe</label>
                        <input
                          type="text"
                          value={t.welcomeColor || "#5865F2"}
                          onChange={(e) => updateTicketType(tIdx, { welcomeColor: e.target.value })}
                          placeholder="#5865F2"
                          className="w-full bg-[#0e0f15] border border-[#27272a] px-2.5 py-1.5 rounded-lg text-xs font-mono text-white outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 block mb-1">Beschreibung</label>
                      <textarea
                        rows={2}
                        value={t.welcomeDescription || ""}
                        onChange={(e) => updateTicketType(tIdx, { welcomeDescription: e.target.value })}
                        placeholder="Willkommen {user}! Ein Supporter hilft dir in Kürze..."
                        className="w-full bg-[#0e0f15] border border-[#27272a] p-2.5 rounded-lg text-xs text-white outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
