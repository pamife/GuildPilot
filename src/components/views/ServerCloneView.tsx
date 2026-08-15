"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useToast } from "../ToastContainer";
import {
  Download,
  Server,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Ticket,
  ClipboardList,
  MessageSquareText,
  Sparkles,
  Smile,
  Shield,
  FolderTree,
  Hash,
  Layers,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Zap,
  Sliders,
  Check,
} from "lucide-react";

interface GuildOption {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
}

interface ServerCloneViewProps {
  guilds: GuildOption[];
  selectedGuildId: string | null;
  onRefreshData: () => void;
  onNavigate?: (view: any) => void;
}

export function ServerCloneView({
  guilds,
  selectedGuildId,
  onRefreshData,
  onNavigate,
}: ServerCloneViewProps) {
  const { showToast } = useToast();

  const currentTargetGuild = guilds.find((g) => g.id === selectedGuildId);
  const availableSourceGuilds = guilds.filter((g) => g.id !== selectedGuildId);

  const [selectedSourceId, setSelectedSourceId] = useState<string>("");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [sourceSummary, setSourceSummary] = useState<any>(null);
  const [isCloning, setIsCloning] = useState(false);
  const [cloneResults, setCloneResults] = useState<any>(null);

  // Selected Modules & Items
  const [moduleTickets, setModuleTickets] = useState(true);
  const [ticketsIncludeSettings, setTicketsIncludeSettings] = useState(true);
  const [selectedTicketPanels, setSelectedTicketPanels] = useState<string[]>([]);

  const [moduleApplications, setModuleApplications] = useState(true);
  const [appsIncludeSettings, setAppsIncludeSettings] = useState(true);
  const [selectedAppForms, setSelectedAppForms] = useState<string[]>([]);

  const [moduleCustomMessages, setModuleCustomMessages] = useState(true);
  const [selectedCustomMessages, setSelectedCustomMessages] = useState<string[]>([]);

  const [moduleWelcome, setModuleWelcome] = useState(true);
  const [welcomeIncludeWelcome, setWelcomeIncludeWelcome] = useState(true);
  const [welcomeIncludeLeave, setWelcomeIncludeLeave] = useState(true);

  const [moduleAutoReact, setModuleAutoReact] = useState(true);
  const [selectedAutoReacts, setSelectedAutoReacts] = useState<string[]>([]);

  // Advanced Options
  const [createMissingRoles, setCreateMissingRoles] = useState(false);
  const [createMissingChannels, setCreateMissingChannels] = useState(false);
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    tickets: true,
    applications: true,
    customMessages: false,
    welcome: false,
    autoReact: false,
    advanced: false,
  });

  // Pick first available source guild by default
  useEffect(() => {
    if (availableSourceGuilds.length > 0 && !selectedSourceId) {
      setSelectedSourceId(availableSourceGuilds[0].id);
    }
  }, [availableSourceGuilds, selectedSourceId]);

  // Fetch summary when source guild changes
  const fetchSourceSummary = async () => {
    if (!selectedSourceId || !selectedGuildId) return;
    setLoadingSummary(true);
    try {
      const res = await api.get(`/guilds/${selectedGuildId}/clone/summary/${selectedSourceId}`);
      setSourceSummary(res.data);

      // Default select all items
      setSelectedTicketPanels((res.data.tickets?.panels || []).map((p: any) => p.id));
      setSelectedAppForms((res.data.applications?.forms || []).map((f: any) => f.id));
      setSelectedCustomMessages((res.data.customMessages || []).map((m: any) => m.id));
      setSelectedAutoReacts((res.data.autoReact || []).map((r: any) => r.id));
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to load source server inventory", "error");
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    fetchSourceSummary();
  }, [selectedSourceId, selectedGuildId]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Presets
  const applyPreset = (preset: "all" | "tickets" | "apps" | "welcome" | "messages" | "none") => {
    if (preset === "all") {
      setModuleTickets(true);
      setModuleApplications(true);
      setModuleCustomMessages(true);
      setModuleWelcome(true);
      setModuleAutoReact(true);
      if (sourceSummary) {
        setSelectedTicketPanels((sourceSummary.tickets?.panels || []).map((p: any) => p.id));
        setSelectedAppForms((sourceSummary.applications?.forms || []).map((f: any) => f.id));
        setSelectedCustomMessages((sourceSummary.customMessages || []).map((m: any) => m.id));
        setSelectedAutoReacts((sourceSummary.autoReact || []).map((r: any) => r.id));
      }
      showToast("Preset 'Full Server Clone' selected", "info");
    } else if (preset === "tickets") {
      setModuleTickets(true);
      setModuleApplications(false);
      setModuleCustomMessages(false);
      setModuleWelcome(false);
      setModuleAutoReact(false);
      if (sourceSummary) {
        setSelectedTicketPanels((sourceSummary.tickets?.panels || []).map((p: any) => p.id));
      }
      showToast("Preset 'Ticket System Only' selected", "info");
    } else if (preset === "apps") {
      setModuleTickets(false);
      setModuleApplications(true);
      setModuleCustomMessages(false);
      setModuleWelcome(false);
      setModuleAutoReact(false);
      if (sourceSummary) {
        setSelectedAppForms((sourceSummary.applications?.forms || []).map((f: any) => f.id));
      }
      showToast("Preset 'Applications Only' selected", "info");
    } else if (preset === "welcome") {
      setModuleTickets(false);
      setModuleApplications(false);
      setModuleCustomMessages(false);
      setModuleWelcome(true);
      setModuleAutoReact(false);
      showToast("Preset 'Welcome Cards Only' selected", "info");
    } else if (preset === "messages") {
      setModuleTickets(false);
      setModuleApplications(false);
      setModuleCustomMessages(true);
      setModuleWelcome(false);
      setModuleAutoReact(false);
      if (sourceSummary) {
        setSelectedCustomMessages((sourceSummary.customMessages || []).map((m: any) => m.id));
      }
      showToast("Preset 'Custom Messages Only' selected", "info");
    } else if (preset === "none") {
      setModuleTickets(false);
      setModuleApplications(false);
      setModuleCustomMessages(false);
      setModuleWelcome(false);
      setModuleAutoReact(false);
    }
  };

  const handleExecuteClone = async () => {
    if (!selectedGuildId || !selectedSourceId) return;

    setIsCloning(true);
    setCloneResults(null);
    try {
      const payload: any = {
        smartMapping: true,
        createMissingRoles,
        createMissingChannels,
      };

      if (moduleTickets) {
        payload.tickets = {
          enabled: true,
          includeSettings: ticketsIncludeSettings,
          panelIds: selectedTicketPanels,
        };
      }

      if (moduleApplications) {
        payload.applications = {
          enabled: true,
          includeSettings: appsIncludeSettings,
          formIds: selectedAppForms,
        };
      }

      if (moduleCustomMessages) {
        payload.customMessages = {
          enabled: true,
          messageIds: selectedCustomMessages,
        };
      }

      if (moduleWelcome) {
        payload.welcome = {
          enabled: true,
          includeWelcome: welcomeIncludeWelcome,
          includeLeave: welcomeIncludeLeave,
        };
      }

      if (moduleAutoReact) {
        payload.autoReact = {
          enabled: true,
          ruleIds: selectedAutoReacts,
        };
      }

      const res = await api.post(`/guilds/${selectedGuildId}/clone/${selectedSourceId}`, payload);
      setCloneResults(res.data.results);
      showToast("Server modules imported successfully!", "success");
      onRefreshData();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to clone modules", "error");
    } finally {
      setIsCloning(false);
    }
  };

  const selectedSourceGuild = guilds.find((g) => g.id === selectedSourceId);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Download className="w-5 h-5" />
            </div>
            Server Module Importer & Cloner
          </h2>
          <p className="text-sm text-zinc-400 mt-0.5">
            Pull and clone ticket systems, application forms, custom messages, welcome cards & reaction rules from any other server.
          </p>
        </div>

        {availableSourceGuilds.length > 0 && (
          <button
            onClick={fetchSourceSummary}
            disabled={loadingSummary}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#18181b] hover:bg-[#27272a] text-zinc-300 rounded-xl text-xs font-semibold transition-all border border-[#27272a] cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingSummary ? "animate-spin" : ""}`} />
            Refresh Inventory
          </button>
        )}
      </div>

      {/* Server Transfer Direction Header */}
      <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center bg-[#09090b] border border-[#1f1f23] rounded-2xl p-5 shadow-lg">
        {/* Source Server Selector */}
        <div className="md:col-span-5 space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block">
            SOURCE SERVER (Pull From)
          </label>

          {availableSourceGuilds.length === 0 ? (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              No other Discord server found. Add GuildPilot to another server first!
            </div>
          ) : (
            <select
              value={selectedSourceId}
              onChange={(e) => setSelectedSourceId(e.target.value)}
              className="w-full bg-[#121217] border border-[#27272a] focus:border-indigo-500 text-white rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none cursor-pointer"
            >
              {availableSourceGuilds.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.memberCount} members)
                </option>
              ))}
            </select>
          )}

          {selectedSourceGuild && (
            <div className="flex items-center gap-2.5 text-xs text-zinc-400 pt-1">
              {selectedSourceGuild.icon ? (
                <img src={selectedSourceGuild.icon} alt="" className="w-5 h-5 rounded-full" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-[9px]">
                  {selectedSourceGuild.name.substring(0, 2).toUpperCase()}
                </div>
              )}
              <span>{selectedSourceGuild.name}</span>
            </div>
          )}
        </div>

        {/* Direction Arrow */}
        <div className="md:col-span-1 flex justify-center py-2 md:py-0">
          <div className="p-3 rounded-full bg-[#121217] border border-[#27272a] text-indigo-400 shadow-md">
            <ArrowRight className="w-5 h-5" />
          </div>
        </div>

        {/* Target Server Display */}
        <div className="md:col-span-5 space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
            TARGET SERVER (Apply Into)
          </label>
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#121217] border border-emerald-500/30 text-white">
            <div className="flex items-center gap-3">
              {currentTargetGuild?.icon ? (
                <img src={currentTargetGuild.icon} alt="" className="w-7 h-7 rounded-full" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                  {currentTargetGuild?.name.substring(0, 2).toUpperCase() || "GP"}
                </div>
              )}
              <div>
                <p className="font-bold text-sm text-white">{currentTargetGuild?.name}</p>
                <p className="text-[10px] text-zinc-400">{currentTargetGuild?.memberCount} members</p>
              </div>
            </div>
            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md text-[10px] font-bold uppercase">
              Current Active Server
            </span>
          </div>
        </div>
      </div>

      {/* Preset Buttons */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
          Quick Import Presets
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyPreset("all")}
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-indigo-500/30 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" /> Full Server Clone (Everything)
          </button>
          <button
            type="button"
            onClick={() => applyPreset("tickets")}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#121217] hover:bg-[#1f1f28] text-zinc-300 hover:text-white rounded-xl text-xs font-semibold transition-all border border-[#27272a] cursor-pointer"
          >
            <Ticket className="w-3.5 h-3.5 text-indigo-400" /> Ticket System Only
          </button>
          <button
            type="button"
            onClick={() => applyPreset("apps")}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#121217] hover:bg-[#1f1f28] text-zinc-300 hover:text-white rounded-xl text-xs font-semibold transition-all border border-[#27272a] cursor-pointer"
          >
            <ClipboardList className="w-3.5 h-3.5 text-indigo-400" /> Applications Only
          </button>
          <button
            type="button"
            onClick={() => applyPreset("messages")}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#121217] hover:bg-[#1f1f28] text-zinc-300 hover:text-white rounded-xl text-xs font-semibold transition-all border border-[#27272a] cursor-pointer"
          >
            <MessageSquareText className="w-3.5 h-3.5 text-indigo-400" /> Custom Messages Only
          </button>
          <button
            type="button"
            onClick={() => applyPreset("welcome")}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#121217] hover:bg-[#1f1f28] text-zinc-300 hover:text-white rounded-xl text-xs font-semibold transition-all border border-[#27272a] cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Welcome Cards Only
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loadingSummary ? (
        <div className="p-12 text-center bg-[#09090b] border border-[#1f1f23] rounded-2xl text-zinc-400 shadow-lg flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <p className="font-semibold text-sm text-zinc-200">Analyzing source server configurations...</p>
          <p className="text-xs text-zinc-500">Scanning ticket panels, application forms, messages, and settings</p>
        </div>
      ) : sourceSummary ? (
        <div className="space-y-4">
          {/* ========================================================= */}
          {/* 1. TICKETS MODULE CARD */}
          {/* ========================================================= */}
          <div className="bg-[#09090b] border border-[#1f1f23] rounded-2xl overflow-hidden shadow-lg transition-all">
            <div className="p-4 bg-[#0d0d11] border-b border-[#1f1f23] flex items-center justify-between">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={moduleTickets}
                  onChange={(e) => setModuleTickets(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Ticket className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Ticket System</h3>
                    <p className="text-[11px] text-zinc-400">
                      {sourceSummary.tickets?.panels?.length || 0} Panels •{" "}
                      {sourceSummary.tickets?.categories?.length || 0} Categories • Settings:{" "}
                      {sourceSummary.tickets?.hasSettings ? "Configured" : "Default"}
                    </p>
                  </div>
                </div>
              </label>

              <button
                type="button"
                onClick={() => toggleSection("tickets")}
                className="p-1 text-zinc-400 hover:text-white rounded-lg"
              >
                {expandedSections.tickets ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {expandedSections.tickets && moduleTickets && (
              <div className="p-5 space-y-4 text-xs">
                {/* Setting toggle */}
                {sourceSummary.tickets?.hasSettings && (
                  <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#121217] border border-[#27272a] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ticketsIncludeSettings}
                      onChange={(e) => setTicketsIncludeSettings(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <p className="font-semibold text-zinc-200">Copy Ticket Settings</p>
                      <p className="text-[10px] text-zinc-400">
                        Copies ticket naming template, transcript storage, and delete confirmation rules.
                      </p>
                    </div>
                  </label>
                )}

                {/* Panel Picker */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-zinc-400 uppercase tracking-wider text-[10px]">
                      Ticket Panels ({sourceSummary.tickets?.panels?.length || 0})
                    </p>
                    {sourceSummary.tickets?.panels?.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedTicketPanels.length === sourceSummary.tickets.panels.length) {
                            setSelectedTicketPanels([]);
                          } else {
                            setSelectedTicketPanels(sourceSummary.tickets.panels.map((p: any) => p.id));
                          }
                        }}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold"
                      >
                        {selectedTicketPanels.length === sourceSummary.tickets.panels.length
                          ? "Deselect All"
                          : "Select All"}
                      </button>
                    )}
                  </div>

                  {sourceSummary.tickets?.panels?.length === 0 ? (
                    <p className="text-zinc-500 p-3 bg-[#121217] rounded-xl text-center">
                      No ticket panels found on source server.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {sourceSummary.tickets.panels.map((p: any) => {
                        const isChecked = selectedTicketPanels.includes(p.id);
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              setSelectedTicketPanels((prev) =>
                                prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                              );
                            }}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                              isChecked
                                ? "bg-indigo-600/10 border-indigo-500/40 text-white"
                                : "bg-[#121217] border-[#27272a] hover:border-zinc-600 text-zinc-300"
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
                </div>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* 2. APPLICATIONS MODULE CARD */}
          {/* ========================================================= */}
          <div className="bg-[#09090b] border border-[#1f1f23] rounded-2xl overflow-hidden shadow-lg transition-all">
            <div className="p-4 bg-[#0d0d11] border-b border-[#1f1f23] flex items-center justify-between">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={moduleApplications}
                  onChange={(e) => setModuleApplications(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <ClipboardList className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Applications System</h3>
                    <p className="text-[11px] text-zinc-400">
                      {sourceSummary.applications?.forms?.length || 0} Forms •{" "}
                      {sourceSummary.applications?.panels?.length || 0} Panels • Settings:{" "}
                      {sourceSummary.applications?.hasSettings ? "Configured" : "Default"}
                    </p>
                  </div>
                </div>
              </label>

              <button
                type="button"
                onClick={() => toggleSection("applications")}
                className="p-1 text-zinc-400 hover:text-white rounded-lg"
              >
                {expandedSections.applications ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {expandedSections.applications && moduleApplications && (
              <div className="p-5 space-y-4 text-xs">
                {/* Setting toggle */}
                {sourceSummary.applications?.hasSettings && (
                  <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#121217] border border-[#27272a] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={appsIncludeSettings}
                      onChange={(e) => setAppsIncludeSettings(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <p className="font-semibold text-zinc-200">Copy Application Global Settings</p>
                      <p className="text-[10px] text-zinc-400">
                        Copies default reviewer roles, default category and cooldown policies.
                      </p>
                    </div>
                  </label>
                )}

                {/* Form Picker */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-zinc-400 uppercase tracking-wider text-[10px]">
                      Application Forms ({sourceSummary.applications?.forms?.length || 0})
                    </p>
                    {sourceSummary.applications?.forms?.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedAppForms.length === sourceSummary.applications.forms.length) {
                            setSelectedAppForms([]);
                          } else {
                            setSelectedAppForms(sourceSummary.applications.forms.map((f: any) => f.id));
                          }
                        }}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold"
                      >
                        {selectedAppForms.length === sourceSummary.applications.forms.length
                          ? "Deselect All"
                          : "Select All"}
                      </button>
                    )}
                  </div>

                  {sourceSummary.applications?.forms?.length === 0 ? (
                    <p className="text-zinc-500 p-3 bg-[#121217] rounded-xl text-center">
                      No application forms found on source server.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {sourceSummary.applications.forms.map((f: any) => {
                        const isChecked = selectedAppForms.includes(f.id);
                        return (
                          <div
                            key={f.id}
                            onClick={() => {
                              setSelectedAppForms((prev) =>
                                prev.includes(f.id) ? prev.filter((id) => id !== f.id) : [...prev, f.id]
                              );
                            }}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                              isChecked
                                ? "bg-indigo-600/10 border-indigo-500/40 text-white"
                                : "bg-[#121217] border-[#27272a] hover:border-zinc-600 text-zinc-300"
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
                </div>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* 3. CUSTOM MESSAGES MODULE CARD */}
          {/* ========================================================= */}
          <div className="bg-[#09090b] border border-[#1f1f23] rounded-2xl overflow-hidden shadow-lg transition-all">
            <div className="p-4 bg-[#0d0d11] border-b border-[#1f1f23] flex items-center justify-between">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={moduleCustomMessages}
                  onChange={(e) => setModuleCustomMessages(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <MessageSquareText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Custom Messages & Components V2</h3>
                    <p className="text-[11px] text-zinc-400">
                      {sourceSummary.customMessages?.length || 0} Saved Messages & Layouts
                    </p>
                  </div>
                </div>
              </label>

              <button
                type="button"
                onClick={() => toggleSection("customMessages")}
                className="p-1 text-zinc-400 hover:text-white rounded-lg"
              >
                {expandedSections.customMessages ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {expandedSections.customMessages && moduleCustomMessages && (
              <div className="p-5 space-y-4 text-xs">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-zinc-400 uppercase tracking-wider text-[10px]">
                      Saved Custom Messages ({sourceSummary.customMessages?.length || 0})
                    </p>
                    {sourceSummary.customMessages?.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedCustomMessages.length === sourceSummary.customMessages.length) {
                            setSelectedCustomMessages([]);
                          } else {
                            setSelectedCustomMessages(sourceSummary.customMessages.map((m: any) => m.id));
                          }
                        }}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold"
                      >
                        {selectedCustomMessages.length === sourceSummary.customMessages.length
                          ? "Deselect All"
                          : "Select All"}
                      </button>
                    )}
                  </div>

                  {sourceSummary.customMessages?.length === 0 ? (
                    <p className="text-zinc-500 p-3 bg-[#121217] rounded-xl text-center">
                      No custom messages saved on source server.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {sourceSummary.customMessages.map((m: any) => {
                        const isChecked = selectedCustomMessages.includes(m.id);
                        return (
                          <div
                            key={m.id}
                            onClick={() => {
                              setSelectedCustomMessages((prev) =>
                                prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                              );
                            }}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                              isChecked
                                ? "bg-indigo-600/10 border-indigo-500/40 text-white"
                                : "bg-[#121217] border-[#27272a] hover:border-zinc-600 text-zinc-300"
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
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: m.accentColor || "#5865F2" }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* 4. WELCOME & GOODBYES CARD */}
          {/* ========================================================= */}
          <div className="bg-[#09090b] border border-[#1f1f23] rounded-2xl overflow-hidden shadow-lg transition-all">
            <div className="p-4 bg-[#0d0d11] border-b border-[#1f1f23] flex items-center justify-between">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={moduleWelcome}
                  onChange={(e) => setModuleWelcome(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Welcome & Goodbye Cards</h3>
                    <p className="text-[11px] text-zinc-400">
                      Welcome Card Design:{" "}
                      {sourceSummary.welcome?.welcomeConfigured ? "Configured" : "Default"} • Goodbye Card:{" "}
                      {sourceSummary.welcome?.leaveConfigured ? "Configured" : "Default"}
                    </p>
                  </div>
                </div>
              </label>

              <button
                type="button"
                onClick={() => toggleSection("welcome")}
                className="p-1 text-zinc-400 hover:text-white rounded-lg"
              >
                {expandedSections.welcome ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {expandedSections.welcome && moduleWelcome && (
              <div className="p-5 space-y-3 text-xs">
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#121217] border border-[#27272a] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={welcomeIncludeWelcome}
                    onChange={(e) => setWelcomeIncludeWelcome(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <p className="font-semibold text-zinc-200">Copy Welcome Card & DM Configuration</p>
                    <p className="text-[10px] text-zinc-400">
                      {sourceSummary.welcome?.welcomeConfigured
                        ? `Title: "${sourceSummary.welcome.welcomeCardTitle}" • Enabled: ${sourceSummary.welcome.welcomeEnabled ? "Yes" : "No"}`
                        : "Default styling will be applied"}
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#121217] border border-[#27272a] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={welcomeIncludeLeave}
                    onChange={(e) => setWelcomeIncludeLeave(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <p className="font-semibold text-zinc-200">Copy Goodbye Card Configuration</p>
                    <p className="text-[10px] text-zinc-400">
                      {sourceSummary.welcome?.leaveConfigured
                        ? `Title: "${sourceSummary.welcome.leaveCardTitle}" • Enabled: ${sourceSummary.welcome.leaveEnabled ? "Yes" : "No"}`
                        : "Default styling will be applied"}
                    </p>
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* 5. AUTO REACTIONS CARD */}
          {/* ========================================================= */}
          <div className="bg-[#09090b] border border-[#1f1f23] rounded-2xl overflow-hidden shadow-lg transition-all">
            <div className="p-4 bg-[#0d0d11] border-b border-[#1f1f23] flex items-center justify-between">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={moduleAutoReact}
                  onChange={(e) => setModuleAutoReact(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Smile className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Auto Reaction Rules</h3>
                    <p className="text-[11px] text-zinc-400">
                      {sourceSummary.autoReact?.length || 0} Auto Reaction Rules Configured
                    </p>
                  </div>
                </div>
              </label>

              <button
                type="button"
                onClick={() => toggleSection("autoReact")}
                className="p-1 text-zinc-400 hover:text-white rounded-lg"
              >
                {expandedSections.autoReact ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {expandedSections.autoReact && moduleAutoReact && (
              <div className="p-5 space-y-4 text-xs">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-zinc-400 uppercase tracking-wider text-[10px]">
                      Reaction Rules ({sourceSummary.autoReact?.length || 0})
                    </p>
                    {sourceSummary.autoReact?.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedAutoReacts.length === sourceSummary.autoReact.length) {
                            setSelectedAutoReacts([]);
                          } else {
                            setSelectedAutoReacts(sourceSummary.autoReact.map((r: any) => r.id));
                          }
                        }}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold"
                      >
                        {selectedAutoReacts.length === sourceSummary.autoReact.length
                          ? "Deselect All"
                          : "Select All"}
                      </button>
                    )}
                  </div>

                  {sourceSummary.autoReact?.length === 0 ? (
                    <p className="text-zinc-500 p-3 bg-[#121217] rounded-xl text-center">
                      No auto-reaction rules found on source server.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {sourceSummary.autoReact.map((r: any) => {
                        const isChecked = selectedAutoReacts.includes(r.id);
                        return (
                          <div
                            key={r.id}
                            onClick={() => {
                              setSelectedAutoReacts((prev) =>
                                prev.includes(r.id) ? prev.filter((id) => id !== r.id) : [...prev, r.id]
                              );
                            }}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                              isChecked
                                ? "bg-indigo-600/10 border-indigo-500/40 text-white"
                                : "bg-[#121217] border-[#27272a] hover:border-zinc-600 text-zinc-300"
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
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* ADVANCED SMART MAPPING OPTIONS */}
          {/* ========================================================= */}
          <div className="bg-[#09090b] border border-[#1f1f23] rounded-2xl overflow-hidden shadow-lg">
            <div
              onClick={() => toggleSection("advanced")}
              className="p-4 bg-[#0d0d11] border-b border-[#1f1f23] flex items-center justify-between cursor-pointer hover:bg-[#14141a] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Smart Discord Role & Channel Remapping</h3>
                  <p className="text-[11px] text-zinc-400">
                    Control how Discord roles and channel references from the source server are mapped.
                  </p>
                </div>
              </div>
              <button type="button" className="p-1 text-zinc-400 hover:text-white rounded-lg">
                {expandedSections.advanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {expandedSections.advanced && (
              <div className="p-5 space-y-3 text-xs">
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-300 text-xs">
                  <p className="font-semibold">Automatic Name Matching Enabled</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Roles and channels with matching names on the target server (e.g. <code>#tickets</code>, <code>@Support</code>, <code>#welcome</code>) will automatically be mapped.
                  </p>
                </div>

                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#121217] border border-[#27272a] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createMissingRoles}
                    onChange={(e) => setCreateMissingRoles(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <p className="font-semibold text-zinc-200">Auto-create missing Discord Roles</p>
                    <p className="text-[10px] text-zinc-400">
                      If a role referenced in support staff or reviewers does not exist on the target server, create it automatically.
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#121217] border border-[#27272a] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createMissingChannels}
                    onChange={(e) => setCreateMissingChannels(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <p className="font-semibold text-zinc-200">Auto-create missing Discord Channels & Categories</p>
                    <p className="text-[10px] text-zinc-400">
                      Creates categories and channels that don't exist on the target server.
                    </p>
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* CLONE EXECUTION BANNER */}
          {/* ========================================================= */}
          <div className="bg-[#09090b] border border-[#1f1f23] rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="font-bold text-sm text-white flex items-center gap-2">
                <Download className="w-4 h-4 text-indigo-400" />
                Ready to Import into {currentTargetGuild?.name}
              </p>
              <p className="text-xs text-zinc-400">
                Selected: {moduleTickets ? `${selectedTicketPanels.length} Ticket Panels, ` : ""}
                {moduleApplications ? `${selectedAppForms.length} Forms, ` : ""}
                {moduleCustomMessages ? `${selectedCustomMessages.length} Messages, ` : ""}
                {moduleWelcome ? "Welcome Settings, " : ""}
                {moduleAutoReact ? `${selectedAutoReacts.length} Auto Reactions` : ""}
              </p>
            </div>

            <button
              type="button"
              onClick={handleExecuteClone}
              disabled={isCloning || !selectedSourceId}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
            >
              {isCloning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Cloning Server Data...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" /> Start Server Import
                </>
              )}
            </button>
          </div>

          {/* CLONE RESULTS REPORT */}
          {cloneResults && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 shadow-lg space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-sm text-emerald-200">Import Completed Successfully!</h3>
                </div>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate("tickets")}
                    className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-lg transition-all"
                  >
                    View Ticket System →
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {cloneResults.tickets && (
                  <div className="p-2.5 bg-[#09090b] rounded-xl border border-emerald-500/20">
                    <p className="font-bold text-white">{cloneResults.tickets.panelsCloned} Panels</p>
                    <p className="text-[10px] text-zinc-400">Tickets imported</p>
                  </div>
                )}
                {cloneResults.applications && (
                  <div className="p-2.5 bg-[#09090b] rounded-xl border border-emerald-500/20">
                    <p className="font-bold text-white">{cloneResults.applications.formsCloned} Forms</p>
                    <p className="text-[10px] text-zinc-400">Applications imported</p>
                  </div>
                )}
                {cloneResults.customMessages && (
                  <div className="p-2.5 bg-[#09090b] rounded-xl border border-emerald-500/20">
                    <p className="font-bold text-white">{cloneResults.customMessages.messagesCloned} Messages</p>
                    <p className="text-[10px] text-zinc-400">Custom messages imported</p>
                  </div>
                )}
                {cloneResults.autoReact && (
                  <div className="p-2.5 bg-[#09090b] rounded-xl border border-emerald-500/20">
                    <p className="font-bold text-white">{cloneResults.autoReact.rulesCloned} Rules</p>
                    <p className="text-[10px] text-zinc-400">Auto-reactions imported</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
