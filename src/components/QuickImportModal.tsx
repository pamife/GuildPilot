"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useToast } from "./ToastContainer";
import {
  X,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Ticket,
  ClipboardList,
  MessageSquareText,
  Sparkles,
  Smile,
  Shield,
  Layers,
  ChevronDown,
} from "lucide-react";

export type QuickImportModule = "tickets" | "applications" | "welcome" | "custom-messages" | "auto-react";

interface QuickImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetGuildId: string | null;
  guilds: any[];
  moduleType: QuickImportModule;
  onImportComplete: () => void;
}

export function QuickImportModal({
  isOpen,
  onClose,
  targetGuildId,
  guilds,
  moduleType,
  onImportComplete,
}: QuickImportModalProps) {
  const { showToast } = useToast();

  const availableSourceGuilds = guilds.filter((g) => g.id !== targetGuildId);

  const [selectedSourceGuildId, setSelectedSourceGuildId] = useState<string>("");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Selected item IDs for cloning
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [includeSettings, setIncludeSettings] = useState(true);
  const [includeWelcome, setIncludeWelcome] = useState(true);
  const [includeLeave, setIncludeLeave] = useState(true);

  // Reset & load default source guild when modal opens
  useEffect(() => {
    if (isOpen) {
      if (availableSourceGuilds.length > 0 && !selectedSourceGuildId) {
        setSelectedSourceGuildId(availableSourceGuilds[0].id);
      }
    }
  }, [isOpen, availableSourceGuilds]);

  // Load summary whenever selectedSourceGuildId changes
  useEffect(() => {
    if (!isOpen || !selectedSourceGuildId || !targetGuildId) return;

    const fetchSummary = async () => {
      setLoadingSummary(true);
      try {
        const res = await api.get(`/guilds/${targetGuildId}/clone/summary/${selectedSourceGuildId}`);
        setSummary(res.data);

        // Pre-select all available items for this module
        if (moduleType === "tickets") {
          setSelectedItemIds((res.data.tickets?.panels || []).map((p: any) => p.id));
        } else if (moduleType === "applications") {
          setSelectedItemIds((res.data.applications?.forms || []).map((f: any) => f.id));
        } else if (moduleType === "custom-messages") {
          setSelectedItemIds((res.data.customMessages || []).map((m: any) => m.id));
        } else if (moduleType === "auto-react") {
          setSelectedItemIds((res.data.autoReact || []).map((r: any) => r.id));
        }
      } catch (err: any) {
        showToast(err.response?.data?.error || "Failed to load source server data", "error");
      } finally {
        setLoadingSummary(false);
      }
    };

    fetchSummary();
  }, [isOpen, selectedSourceGuildId, targetGuildId, moduleType]);

  if (!isOpen) return null;

  const toggleItemSelection = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllItems = (allIds: string[]) => {
    if (selectedItemIds.length === allIds.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(allIds);
    }
  };

  const handleExecuteImport = async () => {
    if (!targetGuildId || !selectedSourceGuildId) return;

    setIsImporting(true);
    try {
      const clonePayload: any = {
        smartMapping: true,
      };

      if (moduleType === "tickets") {
        clonePayload.tickets = {
          enabled: true,
          includeSettings,
          panelIds: selectedItemIds,
        };
      } else if (moduleType === "applications") {
        clonePayload.applications = {
          enabled: true,
          includeSettings,
          formIds: selectedItemIds,
        };
      } else if (moduleType === "welcome") {
        clonePayload.welcome = {
          enabled: true,
          includeWelcome,
          includeLeave,
        };
      } else if (moduleType === "custom-messages") {
        clonePayload.customMessages = {
          enabled: true,
          messageIds: selectedItemIds,
        };
      } else if (moduleType === "auto-react") {
        clonePayload.autoReact = {
          enabled: true,
          ruleIds: selectedItemIds,
        };
      }

      const res = await api.post(`/guilds/${targetGuildId}/clone/${selectedSourceGuildId}`, clonePayload);

      showToast("Import completed successfully!", "success");
      onImportComplete();
      onClose();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Import failed", "error");
    } finally {
      setIsImporting(false);
    }
  };

  const getModuleTitle = () => {
    switch (moduleType) {
      case "tickets":
        return "Ticket System";
      case "applications":
        return "Applications System";
      case "welcome":
        return "Welcome & Goodbye Cards";
      case "custom-messages":
        return "Custom Messages & V2";
      case "auto-react":
        return "Auto Reactions";
    }
  };

  const getModuleIcon = () => {
    switch (moduleType) {
      case "tickets":
        return Ticket;
      case "applications":
        return ClipboardList;
      case "welcome":
        return Sparkles;
      case "custom-messages":
        return MessageSquareText;
      case "auto-react":
        return Smile;
    }
  };

  const IconComponent = getModuleIcon();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-[#0e0e12] border border-[#27272a] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1f1f23] bg-[#09090c]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Import {getModuleTitle()} from another Server
              </h3>
              <p className="text-xs text-zinc-400">
                Copy panels, configurations, and templates from another server directly into this one.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1f1f23] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1 text-sm">
          {/* Source Server Selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-2">
              Select Source Server
            </label>
            {availableSourceGuilds.length === 0 ? (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                No other Discord servers found where the bot is installed.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableSourceGuilds.map((g) => {
                  const isSelected = g.id === selectedSourceGuildId;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSelectedSourceGuildId(g.id)}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? "bg-indigo-600/20 border-indigo-500 text-white shadow-sm"
                          : "bg-[#141419] border-[#27272a] hover:border-zinc-500 text-zinc-300"
                      }`}
                    >
                      {g.icon ? (
                        <img src={g.icon} alt="" className="w-8 h-8 rounded-full shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                          {g.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="truncate">
                        <p className="font-semibold text-xs truncate">{g.name}</p>
                        <p className="text-[10px] text-zinc-400">{g.memberCount} members</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Module-Specific Item Pickers */}
          {loadingSummary ? (
            <div className="p-8 text-center text-zinc-400 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              <p className="text-xs">Loading items from source server...</p>
            </div>
          ) : summary ? (
            <div className="space-y-4">
              {/* TICKETS MODULE */}
              {moduleType === "tickets" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Available Ticket Panels ({summary.tickets?.panels?.length || 0})
                    </label>
                    {summary.tickets?.panels?.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          selectAllItems(summary.tickets.panels.map((p: any) => p.id))
                        }
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                      >
                        {selectedItemIds.length === summary.tickets.panels.length
                          ? "Deselect All"
                          : "Select All"}
                      </button>
                    )}
                  </div>

                  {summary.tickets?.panels?.length === 0 ? (
                    <p className="text-xs text-zinc-500 p-3 bg-[#141419] rounded-xl text-center">
                      No ticket panels found on this source server.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                      {summary.tickets.panels.map((p: any) => {
                        const isChecked = selectedItemIds.includes(p.id);
                        return (
                          <div
                            key={p.id}
                            onClick={() => toggleItemSelection(p.id)}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                              isChecked
                                ? "bg-indigo-600/10 border-indigo-500/40 text-white"
                                : "bg-[#141419] border-[#27272a] hover:border-zinc-600 text-zinc-300"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                              />
                              <div>
                                <p className="font-semibold text-xs">{p.name}</p>
                                <p className="text-[10px] text-zinc-400">
                                  Button: "{p.buttonText}" • {p.reasonsCount} reasons • {p.questionsCount} questions
                                </p>
                              </div>
                            </div>
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: p.embedColor || "#5865F2" }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {summary.tickets?.hasSettings && (
                    <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#141419] border border-[#27272a] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeSettings}
                        onChange={(e) => setIncludeSettings(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                      <div>
                        <p className="text-xs font-semibold text-zinc-200">
                          Also copy Ticket System Settings
                        </p>
                        <p className="text-[10px] text-zinc-400">
                          Copies naming format, transcript preferences, and delete delays.
                        </p>
                      </div>
                    </label>
                  )}
                </div>
              )}

              {/* APPLICATIONS MODULE */}
              {moduleType === "applications" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Available Application Forms ({summary.applications?.forms?.length || 0})
                    </label>
                    {summary.applications?.forms?.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          selectAllItems(summary.applications.forms.map((f: any) => f.id))
                        }
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                      >
                        {selectedItemIds.length === summary.applications.forms.length
                          ? "Deselect All"
                          : "Select All"}
                      </button>
                    )}
                  </div>

                  {summary.applications?.forms?.length === 0 ? (
                    <p className="text-xs text-zinc-500 p-3 bg-[#141419] rounded-xl text-center">
                      No application forms found on this source server.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                      {summary.applications.forms.map((f: any) => {
                        const isChecked = selectedItemIds.includes(f.id);
                        return (
                          <div
                            key={f.id}
                            onClick={() => toggleItemSelection(f.id)}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                              isChecked
                                ? "bg-indigo-600/10 border-indigo-500/40 text-white"
                                : "bg-[#141419] border-[#27272a] hover:border-zinc-600 text-zinc-300"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                              />
                              <div>
                                <p className="font-semibold text-xs">
                                  {f.emoji || "📝"} {f.name}
                                </p>
                                <p className="text-[10px] text-zinc-400">
                                  Category: {f.category || "General"} • {f.questionsCount} questions
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {summary.applications?.hasSettings && (
                    <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#141419] border border-[#27272a] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeSettings}
                        onChange={(e) => setIncludeSettings(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                      <div>
                        <p className="text-xs font-semibold text-zinc-200">
                          Also copy Application Global Settings
                        </p>
                        <p className="text-[10px] text-zinc-400">
                          Copies default cooldown hours, max active applications, and timezone.
                        </p>
                      </div>
                    </label>
                  )}
                </div>
              )}

              {/* WELCOME MODULE */}
              {moduleType === "welcome" && (
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
                    Welcome & Goodbye Cards Configuration
                  </label>

                  <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#141419] border border-[#27272a] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeWelcome}
                      onChange={(e) => setIncludeWelcome(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <p className="text-xs font-semibold text-zinc-200">
                        Copy Welcome Card & DM Settings
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        {summary.welcome?.welcomeConfigured
                          ? `Title: "${summary.welcome.welcomeCardTitle}" • Enabled: ${summary.welcome.welcomeEnabled ? "Yes" : "No"}`
                          : "Not configured on source server"}
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#141419] border border-[#27272a] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeLeave}
                      onChange={(e) => setIncludeLeave(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <p className="text-xs font-semibold text-zinc-200">
                        Copy Goodbye Card Settings
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        {summary.welcome?.leaveConfigured
                          ? `Title: "${summary.welcome.leaveCardTitle}" • Enabled: ${summary.welcome.leaveEnabled ? "Yes" : "No"}`
                          : "Not configured on source server"}
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* CUSTOM MESSAGES MODULE */}
              {moduleType === "custom-messages" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Available Custom Messages ({summary.customMessages?.length || 0})
                    </label>
                    {summary.customMessages?.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          selectAllItems(summary.customMessages.map((m: any) => m.id))
                        }
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                      >
                        {selectedItemIds.length === summary.customMessages.length
                          ? "Deselect All"
                          : "Select All"}
                      </button>
                    )}
                  </div>

                  {summary.customMessages?.length === 0 ? (
                    <p className="text-xs text-zinc-500 p-3 bg-[#141419] rounded-xl text-center">
                      No custom messages found on this source server.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                      {summary.customMessages.map((m: any) => {
                        const isChecked = selectedItemIds.includes(m.id);
                        return (
                          <div
                            key={m.id}
                            onClick={() => toggleItemSelection(m.id)}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                              isChecked
                                ? "bg-indigo-600/10 border-indigo-500/40 text-white"
                                : "bg-[#141419] border-[#27272a] hover:border-zinc-600 text-zinc-300"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                              />
                              <div>
                                <p className="font-semibold text-xs">{m.name}</p>
                                <p className="text-[10px] text-zinc-400">
                                  Mode: {m.mode} • {m.description || "No description"}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* AUTO REACT MODULE */}
              {moduleType === "auto-react" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Available Auto React Rules ({summary.autoReact?.length || 0})
                    </label>
                    {summary.autoReact?.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          selectAllItems(summary.autoReact.map((r: any) => r.id))
                        }
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                      >
                        {selectedItemIds.length === summary.autoReact.length
                          ? "Deselect All"
                          : "Select All"}
                      </button>
                    )}
                  </div>

                  {summary.autoReact?.length === 0 ? (
                    <p className="text-xs text-zinc-500 p-3 bg-[#141419] rounded-xl text-center">
                      No auto-react rules found on this source server.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                      {summary.autoReact.map((r: any) => {
                        const isChecked = selectedItemIds.includes(r.id);
                        return (
                          <div
                            key={r.id}
                            onClick={() => toggleItemSelection(r.id)}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                              isChecked
                                ? "bg-indigo-600/10 border-indigo-500/40 text-white"
                                : "bg-[#141419] border-[#27272a] hover:border-zinc-600 text-zinc-300"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                              />
                              <div>
                                <p className="font-semibold text-xs">{r.name}</p>
                                <p className="text-[10px] text-zinc-400">
                                  Emojis: {r.emojis?.join(" ") || "None"} • Enabled: {r.enabled ? "Yes" : "No"}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-[#1f1f23] bg-[#09090c]">
          <p className="text-[11px] text-zinc-400">
            Roles & Channels will be matched by name automatically.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={isImporting || availableSourceGuilds.length === 0}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Importing...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" /> Start Import
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
