"use client";

import React, { useState, useEffect } from "react";
import {
  Eye,
  ChevronDown,
  Code,
  Wand2,
  Copy,
  Check,
} from "lucide-react";
import { TicketPanelData } from "@/types/ticketComponentTypes";

interface DiscordSimulatorProps {
  panelData: TicketPanelData;
  setPanelData: React.Dispatch<React.SetStateAction<TicketPanelData>>;
  botStatus: { ready: boolean; tag: string; ping: number } | null;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export function DiscordSimulator({
  panelData,
  setPanelData,
  botStatus,
  showToast,
}: DiscordSimulatorProps) {
  const [previewTab, setPreviewTab] = useState<"visual" | "welcome" | "json">("visual");
  const [previewTicketTypeIdx, setPreviewTicketTypeIdx] = useState<number>(0);
  const [rawJsonText, setRawJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setRawJsonText(JSON.stringify(panelData, null, 2));
      setJsonError(null);
    } catch (e) {}
  }, [panelData]);

  const handleApplyJsonChanges = () => {
    try {
      const parsed = JSON.parse(rawJsonText);
      if (!parsed || typeof parsed !== "object") throw new Error("JSON must be an object.");
      setPanelData((prev) => ({
        ...prev,
        ...parsed,
        containerConfig: Array.isArray(parsed.containerConfig) ? parsed.containerConfig : (prev.containerConfig || []),
        ticketTypesConfig: Array.isArray(parsed.ticketTypesConfig) ? parsed.ticketTypesConfig : (prev.ticketTypesConfig || []),
      }));
      setJsonError(null);
      showToast("✅ JSON payload successfully applied to Designer!", "success");
    } catch (err: any) {
      setJsonError(err.message || "Invalid JSON syntax.");
      showToast("Invalid JSON syntax: " + err.message, "error");
    }
  };

  const currentPreviewType = panelData.ticketTypesConfig[previewTicketTypeIdx] || panelData.ticketTypesConfig[0];

  return (
    <div className="w-1/2 flex flex-col bg-[#050507] overflow-hidden">
      {/* Simulator Header */}
      <div className="p-3.5 border-b border-[#18181b] bg-[#0c0d12] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            Live Discord Client Simulator
          </span>
        </div>

        <div className="flex items-center gap-1 bg-[#14151b] p-1 rounded-lg border border-[#27272a]">
          <button
            type="button"
            onClick={() => setPreviewTab("visual")}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
              previewTab === "visual" ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            Panel Vorschau
          </button>
          <button
            type="button"
            onClick={() => setPreviewTab("welcome")}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
              previewTab === "welcome" ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            Ticket-Kanal Vorschau
          </button>
          <button
            type="button"
            onClick={() => setPreviewTab("json")}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
              previewTab === "json" ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            Direktes JSON
          </button>
        </div>
      </div>

      {/* Simulator Body */}
      <div className="flex-1 p-6 overflow-y-auto flex items-start justify-center bg-[#313338]/30">
        {previewTab === "visual" ? (
          /* LIVE COMPONENTS V2 PANEL SIMULATOR */
          <div className="w-full max-w-xl bg-[#313338] rounded-xl p-4 shadow-2xl border border-[#2b2d31] space-y-3 font-sans">
            <div className="flex items-start gap-3 select-none">
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white text-xs shrink-0 shadow">
                GP
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white hover:underline cursor-pointer">
                    {botStatus?.tag?.split("#")[0] || "GuildPilot Bot"}
                  </span>
                  <span className="bg-[#5865F2] text-[10px] text-white px-1 py-0.2 rounded font-bold uppercase tracking-wide">
                    APP
                  </span>
                  <span className="text-[11px] text-zinc-400">Heute um 12:00</span>
                </div>

                {/* ROOT CONTAINER (Type 17) */}
                <div
                  className={`mt-2 rounded-lg bg-[#2b2d31] p-3.5 border-l-4 shadow-md space-y-3 transition-all ${
                    panelData.spoiler ? "blur-sm hover:blur-none transition-all cursor-pointer" : ""
                  }`}
                  style={{ borderColor: panelData.accentColor || "#5865F2" }}
                >
                  {panelData.containerConfig.map((block, bIdx) => (
                    <div key={block.id || bIdx} className="space-y-2">
                      {/* 1. Text Display */}
                      {block.type === "text" && (
                        <div className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">
                          {block.content?.split("\n").map((line, lIdx) => {
                            if (line.startsWith("# ")) {
                              return <h1 key={lIdx} className="text-lg font-bold text-white my-1">{line.replace("# ", "")}</h1>;
                            }
                            if (line.startsWith("### ")) {
                              return <h3 key={lIdx} className="text-sm font-bold text-white my-1">{line.replace("### ", "")}</h3>;
                            }
                            if (line.startsWith("> ")) {
                              return <blockquote key={lIdx} className="border-l-2 border-zinc-500 pl-2 text-zinc-400 italic my-1">{line.replace("> ", "")}</blockquote>;
                            }
                            return <p key={lIdx}>{line}</p>;
                          })}
                        </div>
                      )}

                      {/* 2. Section */}
                      {block.type === "section" && (
                        <div className="w-full flex items-center justify-between gap-4 bg-[#1e1f22]/50 p-2.5 rounded-lg border border-[#2b2d31]">
                          <div className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed flex-1 min-w-0 pr-2">
                            {block.content}
                          </div>
                          {block.accessory && (
                            <div className="ml-auto shrink-0 flex items-center justify-end">
                              {block.accessory.type === "thumbnail" && block.accessory.url && (
                                <img
                                  src={block.accessory.url}
                                  alt="Thumbnail"
                                  className="w-14 h-14 rounded-lg object-cover border border-[#2b2d31] shadow-sm"
                                />
                              )}
                              {block.accessory.type === "button" && (
                                <button
                                  className={`px-3.5 py-1.5 rounded text-xs font-semibold shadow transition-all flex items-center gap-1.5 whitespace-nowrap ${
                                    block.accessory.style === "Success"
                                      ? "bg-[#23A55A] text-white"
                                      : block.accessory.style === "Danger"
                                      ? "bg-[#F23F43] text-white"
                                      : block.accessory.style === "Secondary"
                                      ? "bg-[#4e5058] text-white"
                                      : "bg-[#5865F2] text-white"
                                  }`}
                                >
                                  {block.accessory.emoji && <span>{block.accessory.emoji}</span>}
                                  <span>{block.accessory.label || "Ticket öffnen"}</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 3. Action Row */}
                      {block.type === "action_row" && (
                        <div>
                          {block.rowType === "select" || block.selectMenu ? (
                            <div className="w-full p-2.5 rounded bg-[#1e1f22] border border-[#2b2d31] flex items-center justify-between text-xs text-zinc-300">
                              <span>{block.selectMenu?.placeholder || "Wähle eine Kategorie..."}</span>
                              <ChevronDown className="w-4 h-4 text-zinc-400" />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap pt-1">
                              {(block.buttons || []).map((btn, btnIdx) => (
                                <button
                                  key={btn.id || btnIdx}
                                  className={`px-3.5 py-1.5 rounded text-xs font-semibold shadow transition-all flex items-center gap-1.5 ${
                                    btn.style === "Success"
                                      ? "bg-[#23A55A] text-white"
                                      : btn.style === "Danger"
                                      ? "bg-[#F23F43] text-white"
                                      : btn.style === "Secondary"
                                      ? "bg-[#4e5058] text-white"
                                      : "bg-[#5865F2] text-white"
                                  }`}
                                >
                                  {btn.emoji && <span>{btn.emoji}</span>}
                                  <span>{btn.label || "Ticket erstellen"}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 4. Separator */}
                      {block.type === "separator" && (
                        <div className={`my-2 ${block.divider !== false ? "border-b border-[#3f4147]" : "h-2"}`} />
                      )}

                      {/* 5. Media Gallery */}
                      {block.type === "media_gallery" && block.items && block.items.length > 0 && (
                        <div className={`grid gap-2 my-2 ${block.items.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                          {block.items.map((m, mIdx) => (
                            m.url && (
                              <img
                                key={mIdx}
                                src={m.url}
                                alt=""
                                className="rounded-lg object-cover w-full max-h-48 border border-[#2b2d31]"
                              />
                            )
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : previewTab === "welcome" ? (
          /* LIVE TICKET CHANNEL SIMULATOR */
          <div className="w-full max-w-xl bg-[#313338] rounded-xl p-4 shadow-2xl border border-[#2b2d31] space-y-3 font-sans">
            <div className="flex items-center justify-between pb-2 border-b border-[#2b2d31]">
              <span className="text-xs font-bold text-zinc-300">
                Vorschau für Ticket-Typ:
              </span>
              <select
                value={previewTicketTypeIdx}
                onChange={(e) => setPreviewTicketTypeIdx(Number(e.target.value))}
                className="bg-[#1e1f22] border border-[#2b2d31] px-2 py-1 rounded text-xs text-white outline-none"
              >
                {panelData.ticketTypesConfig.map((t, idx) => (
                  <option key={t.id} value={idx}>
                    {t.emoji || "🎫"} {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white text-xs shrink-0 shadow">
                GP
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">GuildPilot Bot</span>
                  <span className="bg-[#5865F2] text-[10px] text-white px-1 py-0.2 rounded font-bold uppercase">APP</span>
                  <span className="text-[11px] text-zinc-400">Heute um 12:00</span>
                </div>

                <p className="text-xs text-indigo-300">@MaxMustermann @SupportTeam</p>

                {/* Welcome Embed */}
                <div
                  className="rounded-lg bg-[#2b2d31] p-3.5 border-l-4 shadow space-y-2"
                  style={{ borderColor: currentPreviewType?.welcomeColor || "#5865F2" }}
                >
                  <h3 className="text-sm font-bold text-white">
                    {currentPreviewType?.welcomeTitle || "👋 Welcome to your ticket!"}
                  </h3>
                  <p className="text-xs text-zinc-300 whitespace-pre-wrap">
                    {currentPreviewType?.welcomeDescription || "Support staff will be with you shortly."}
                  </p>

                  <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] text-zinc-400">
                    <div>
                      <span className="font-bold text-zinc-300 block">Creator</span>
                      @MaxMustermann
                    </div>
                    <div>
                      <span className="font-bold text-zinc-300 block">Ticket Type</span>
                      {currentPreviewType?.name || "General"}
                    </div>
                    <div>
                      <span className="font-bold text-zinc-300 block">Status</span>
                      <span className="text-emerald-400 font-bold">🟢 Open</span>
                    </div>
                  </div>
                </div>

                {/* Ticket Controls Row */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <button className="px-2.5 py-1 rounded bg-[#4e5058] text-white text-xs font-semibold flex items-center gap-1">
                    🔒 Close
                  </button>
                  <button className="px-2.5 py-1 rounded bg-[#5865F2] text-white text-xs font-semibold flex items-center gap-1">
                    👤 Claim
                  </button>
                  <button className="px-2.5 py-1 rounded bg-[#4e5058] text-white text-xs font-semibold flex items-center gap-1">
                    ➕ Add User
                  </button>
                  <button className="px-2.5 py-1 rounded bg-[#4e5058] text-white text-xs font-semibold flex items-center gap-1">
                    📄 Transcript
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* DIRECT JSON CODE EDITOR */
          <div className="w-full h-full flex flex-col bg-[#0e0f15] border border-[#27272a] rounded-xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-3 bg-[#050507] border-b border-[#27272a]">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono text-zinc-300">Ticket Panel Payload JSON</span>
                {jsonError ? (
                  <span className="text-[10px] bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded font-mono">
                    Syntax Error
                  </span>
                ) : (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-mono">
                    Valid JSON
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const parsed = JSON.parse(rawJsonText);
                      setRawJsonText(JSON.stringify(parsed, null, 2));
                      showToast("JSON formatiert.", "info");
                    } catch (e: any) {
                      setJsonError(e.message);
                    }
                  }}
                  className="px-2.5 py-1 rounded bg-[#18181b] hover:bg-[#27272a] text-zinc-300 text-xs font-semibold flex items-center gap-1 border border-[#27272a] cursor-pointer"
                >
                  <Wand2 className="w-3 h-3 text-amber-400" /> Format
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(rawJsonText);
                    showToast("JSON in die Zwischenablage kopiert!", "success");
                  }}
                  className="px-2.5 py-1 rounded bg-[#18181b] hover:bg-[#27272a] text-zinc-300 text-xs font-semibold flex items-center gap-1 border border-[#27272a] cursor-pointer"
                >
                  <Copy className="w-3 h-3 text-sky-400" /> Copy
                </button>
                <button
                  type="button"
                  onClick={handleApplyJsonChanges}
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" /> Apply JSON
                </button>
              </div>
            </div>

            <div className="flex-1 p-3 relative flex flex-col">
              <textarea
                value={rawJsonText}
                onChange={(e) => {
                  setRawJsonText(e.target.value);
                  try {
                    JSON.parse(e.target.value);
                    setJsonError(null);
                  } catch (err: any) {
                    setJsonError(err.message);
                  }
                }}
                placeholder="Ticket Panel JSON hier einfügen..."
                className="w-full flex-1 bg-[#090a0f] text-emerald-400 font-mono text-xs p-3 rounded-lg border border-[#27272a] focus:border-emerald-500 outline-none resize-none leading-relaxed"
                spellCheck={false}
              />
              {jsonError && (
                <div className="mt-2 p-2 bg-rose-950/40 border border-rose-800/60 rounded-lg text-rose-300 text-[11px] font-mono">
                  {jsonError}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
