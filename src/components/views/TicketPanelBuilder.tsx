"use client";

import React, { useState } from "react";
import {
  Ticket,
  Sparkles,
  Layers,
  Shield,
  Bookmark,
  ChevronDown,
  Hash,
  CheckCircle2,
  Send,
} from "lucide-react";
import { useToast } from "../ToastContainer";
import { api } from "@/lib/api";
import { TicketPanelData } from "@/types/ticketComponentTypes";
import { Channel, Role } from "./ticket-builder/types";
import { PRESET_TICKET_TEMPLATES } from "./ticket-builder/presets";
import { ContainerDesigner } from "./ticket-builder/ContainerDesigner";
import { TicketTypesManager } from "./ticket-builder/TicketTypesManager";
import { PanelSettings } from "./ticket-builder/PanelSettings";
import { DiscordSimulator } from "./ticket-builder/DiscordSimulator";

interface TicketPanelBuilderProps {
  initialPanel?: any;
  selectedGuildId: string | null;
  channels: Channel[];
  roles: Role[];
  categories: any[];
  botStatus: { ready: boolean; tag: string; ping: number } | null;
  onSaveComplete: (savedPanel: any) => void;
  onCancel: () => void;
}

export function TicketPanelBuilder({
  initialPanel,
  selectedGuildId,
  channels,
  roles,
  categories,
  botStatus,
  onSaveComplete,
  onCancel,
}: TicketPanelBuilderProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"designer" | "types" | "settings">("designer");

  // Active Panel Data
  const [panelData, setPanelData] = useState<TicketPanelData>(() => {
    if (initialPanel) {
      return {
        ...initialPanel,
        layoutMode: initialPanel.layoutMode || "components_v2",
        accentColor: initialPanel.accentColor || initialPanel.embedColor || "#5865F2",
        spoiler: !!initialPanel.spoiler,
        containerConfig: typeof initialPanel.containerConfig === "string"
          ? JSON.parse(initialPanel.containerConfig || "[]")
          : initialPanel.containerConfig || [],
        ticketTypesConfig: typeof initialPanel.ticketTypesConfig === "string"
          ? JSON.parse(initialPanel.ticketTypesConfig || "[]")
          : initialPanel.ticketTypesConfig || (
              Array.isArray(initialPanel.reasons) ? initialPanel.reasons : (
                typeof initialPanel.reasons === "string" ? JSON.parse(initialPanel.reasons || "[]") : []
              )
            ),
        allowedRoles: typeof initialPanel.allowedRoles === "string"
          ? JSON.parse(initialPanel.allowedRoles || "[]")
          : initialPanel.allowedRoles || [],
        supportRoles: typeof initialPanel.supportRoles === "string"
          ? JSON.parse(initialPanel.supportRoles || "[]")
          : initialPanel.supportRoles || [],
      };
    }

    // Default Fresh Panel
    return {
      guildId: selectedGuildId || "",
      name: "Support Desk",
      description: "Server Support & Anfragen",
      layoutMode: "components_v2",
      channelId: channels.find((c) => c.type === 0)?.id || "",
      accentColor: "#5865F2",
      spoiler: false,
      containerConfig: [
        {
          id: "b-txt-header",
          type: "text",
          content: "# 🎫 Help & Support Center\nDu hast Fragen oder benötigst Hilfe? Klicke auf den Button unten, um ein Ticket zu öffnen.",
        },
        { id: "b-sep-1", type: "separator", divider: true },
        {
          id: "b-row-btn",
          type: "action_row",
          rowType: "buttons",
          buttons: [
            {
              id: "btn-open",
              style: "Primary",
              label: "Ticket öffnen",
              emoji: "📩",
              actionType: "CREATE_TICKET",
              ticketTypeId: "general",
            },
          ],
        },
      ],
      ticketTypesConfig: [
        {
          id: "general",
          name: "Allgemeiner Support",
          label: "Allgemeiner Support",
          emoji: "📩",
          description: "Allgemeine Server- und Community-Hilfe",
          namingFormat: "ticket-{username}",
          welcomeTitle: "👋 Willkommen in deinem Support-Ticket!",
          welcomeDescription: "Willkommen {user}! Unser Team steht dir in Kürze zur Seite. Nutze die Buttons unten zur Ticket-Steuerung.",
          welcomeColor: "#5865F2",
          questions: [],
        },
      ],
      embedTitle: "📩 Support benötigt?",
      embedDescription: "Klicke auf den Button unten, um ein Ticket zu öffnen.",
      embedColor: "#5865F2",
      buttonText: "Ticket erstellen",
      buttonEmoji: "📩",
      buttonColor: "Primary",
      allowedRoles: [],
      supportRoles: [],
      maxOpenTickets: 1,
      autoCloseHours: 0,
      transcriptEnabled: true,
    };
  });

  const textChannels = channels.filter((c) => c.type === 0);
  const categoryChannels = channels.filter((c) => c.type === 4);

  // Save Panel to DB
  const handleSavePanel = async () => {
    if (!selectedGuildId) return;
    if (!panelData.name.trim()) {
      showToast("Bitte gib einen Namen für dieses Ticket-Panel ein.", "error");
      return;
    }

    try {
      setLoading(true);
      const validateRes = await api.post(`/guilds/${selectedGuildId}/tickets/panels/validate`, {
        containerConfig: panelData.containerConfig,
        ticketTypesConfig: panelData.ticketTypesConfig,
      });

      if (!validateRes.data.valid) {
        const firstErr = validateRes.data.errors[0]?.message || "Validierungsfehler";
        showToast(`⚠️ Validierungshinweis: ${firstErr}`, "error");
      }

      let res;
      if (panelData.id) {
        res = await api.patch(`/guilds/${selectedGuildId}/tickets/panels/${panelData.id}`, panelData);
        showToast("Ticket-Panel erfolgreich gespeichert!", "success");
      } else {
        res = await api.post(`/guilds/${selectedGuildId}/tickets/panels`, {
          ...panelData,
          guildId: selectedGuildId,
        });
        showToast("Ticket-Panel erfolgreich erstellt!", "success");
      }

      onSaveComplete(res.data);
    } catch (err: any) {
      showToast(err.response?.data?.error || "Fehler beim Speichern des Ticket-Panels.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Deploy to Discord
  const handleDeployToDiscord = async () => {
    if (!selectedGuildId) return;
    if (!panelData.channelId) {
      showToast("Bitte wähle zuerst einen Zielkanal aus.", "error");
      return;
    }
    if (!botStatus?.ready) {
      showToast("Der Discord Bot ist offline. Bitte starte den Bot zuerst.", "error");
      return;
    }

    try {
      setLoading(true);
      let targetId = panelData.id;

      if (!targetId) {
        const saveRes = await api.post(`/guilds/${selectedGuildId}/tickets/panels`, {
          ...panelData,
          guildId: selectedGuildId,
        });
        targetId = saveRes.data.id;
        setPanelData((prev) => ({ ...prev, id: targetId }));
      } else {
        await api.patch(`/guilds/${selectedGuildId}/tickets/panels/${targetId}`, panelData);
      }

      const deployRes = await api.post(`/guilds/${selectedGuildId}/tickets/panels/${targetId}/deploy`);
      showToast(`✅ Ticket-Panel erfolgreich auf Discord bereitgestellt!`, "success");
      if (deployRes.data.messageId) {
        setPanelData((prev) => ({ ...prev, messageId: deployRes.data.messageId }));
      }
      onSaveComplete({ ...panelData, id: targetId, messageId: deployRes.data.messageId });
    } catch (err: any) {
      showToast(err.response?.data?.error || "Fehler beim Senden an Discord.", "error");
    } finally {
      setLoading(false);
    }
  };

  const applyPresetTemplate = (preset: typeof PRESET_TICKET_TEMPLATES[0]) => {
    setPanelData((prev) => ({
      ...prev,
      name: preset.name,
      description: preset.description,
      layoutMode: preset.layoutMode,
      accentColor: preset.accentColor,
      spoiler: preset.spoiler,
      containerConfig: JSON.parse(JSON.stringify(preset.containerConfig)),
      ticketTypesConfig: JSON.parse(JSON.stringify(preset.ticketTypesConfig)),
    }));
    showToast(`Vorlage angewendet: ${preset.name}`, "info");
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#0b0f17] text-slate-200">
      {/* Top Header Bar */}
      <header className="h-16 border-b border-[#1e293b] bg-[#0d121c] px-6 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={panelData.name}
                onChange={(e) => setPanelData({ ...panelData, name: e.target.value })}
                placeholder="Panel Name"
                className="text-base font-bold text-white bg-transparent border-b border-transparent hover:border-slate-600 focus:border-indigo-500 outline-none transition-all px-1 py-0.5"
              />
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Discord Components V2
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Vollständig anpassbares Ticket-Panel mit Layout-Hierarchien, Aktionen & Ticket-Typen
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Preset Templates Dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#111724] hover:bg-[#1a253a] text-slate-300 text-xs font-semibold border border-[#1e293b] transition-all cursor-pointer">
              <Bookmark className="w-3.5 h-3.5 text-amber-400" />
              <span>Vorlagen</span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>
            <div className="absolute right-0 top-full mt-1 w-72 bg-[#0f1626] border border-[#212d45] rounded-xl shadow-2xl p-1.5 hidden group-hover:block z-50 animate-in fade-in duration-100">
              <div className="text-[10px] font-bold uppercase text-slate-400 px-2 py-1">Vordefinierte Layouts</div>
              {PRESET_TICKET_TEMPLATES.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => applyPresetTemplate(p)}
                  className="w-full text-left p-2.5 rounded-lg hover:bg-[#182338] transition-colors cursor-pointer"
                >
                  <p className="text-xs font-bold text-white">{p.name}</p>
                  <p className="text-[10px] text-slate-400 line-clamp-1">{p.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Cancel Button */}
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-xl bg-[#111724] hover:bg-[#1a253a] text-slate-300 text-xs font-semibold border border-[#1e293b] transition-all cursor-pointer"
          >
            Abbrechen
          </button>

          {/* Save Button */}
          <button
            onClick={handleSavePanel}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/25 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>{panelData.id ? "Panel speichern" : "Panel erstellen"}</span>
          </button>
        </div>
      </header>

      {/* Main Designer Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Config, Components, Ticket Types */}
        <div className="w-1/2 flex flex-col border-r border-[#18181b] bg-[#090a0f] overflow-hidden">
          {/* Sub Navigation Bar */}
          <div className="p-3 border-b border-[#18181b] bg-[#0c0d12] flex items-center justify-between">
            <div className="flex items-center gap-1.5 bg-[#14151b] p-1 rounded-xl border border-[#27272a]">
              <button
                onClick={() => setActiveTab("designer")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "designer" ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>1. Layout & Components ({panelData.containerConfig.length})</span>
              </button>
              <button
                onClick={() => setActiveTab("types")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "types" ? "bg-emerald-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>2. Ticket-Typen ({panelData.ticketTypesConfig.length})</span>
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "settings" ? "bg-sky-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>3. Rollen & Channel</span>
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 p-6 space-y-6 overflow-y-auto">
            {/* Deploy Bar */}
            <div className="p-4 rounded-xl bg-[#0e0f15] border border-[#27272a] space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <Hash className="w-4 h-4 text-indigo-400" /> Zielkanal auf Discord
                </label>
                {panelData.messageId && (
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Live ID: {panelData.messageId}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={panelData.channelId || ""}
                  onChange={(e) => setPanelData({ ...panelData, channelId: e.target.value })}
                  className="flex-1 bg-[#14151b] border border-[#27272a] focus:border-indigo-500 px-3 py-2 rounded-lg text-xs font-semibold text-white outline-none cursor-pointer"
                >
                  <option value="">-- Zielkanal auswählen --</option>
                  {textChannels.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      #{ch.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleDeployToDiscord}
                  disabled={loading || !panelData.channelId}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{panelData.messageId ? "Live aktualisieren" : "An Discord senden"}</span>
                </button>
              </div>
            </div>

            {/* TAB 1: Components Designer */}
            {activeTab === "designer" && (
              <ContainerDesigner
                panelData={panelData}
                setPanelData={setPanelData}
                showToast={showToast}
              />
            )}

            {/* TAB 2: Ticket Types & Intake Modals */}
            {activeTab === "types" && (
              <TicketTypesManager
                panelData={panelData}
                setPanelData={setPanelData}
                categoryChannels={categoryChannels}
                showToast={showToast}
              />
            )}

            {/* TAB 3: Roles & Settings */}
            {activeTab === "settings" && (
              <PanelSettings
                panelData={panelData}
                setPanelData={setPanelData}
                roles={roles}
                categoryChannels={categoryChannels}
              />
            )}
          </div>
        </div>

        {/* Right Column: Live Discord Simulator & Live JSON Code Sync */}
        <DiscordSimulator
          panelData={panelData}
          setPanelData={setPanelData}
          botStatus={botStatus}
          showToast={showToast}
        />
      </div>
    </div>
  );
}
