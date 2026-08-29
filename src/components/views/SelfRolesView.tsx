"use client";

import React, { useState, useEffect } from "react";
import {
  Tag,
  Plus,
  Trash2,
  Copy,
  Send,
  RefreshCw,
  Edit,
  Sparkles,
  Layers,
  Palette,
  MessageSquare,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Check,
  AlertCircle,
  HelpCircle,
  Hash,
  Shield,
  Smile,
  Layout,
  Sliders,
} from "lucide-react";
import { useToast } from "../ToastContainer";
import { api } from "@/lib/api";

interface Channel {
  id: string;
  name: string;
  type: number; // 0 = text, 4 = category
}

interface Role {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface SelfRoleOptionData {
  id?: string;
  roleId: string;
  roleName?: string;
  roleColor?: string;
  label?: string;
  emoji?: string;
  buttonColor: string; // Primary, Secondary, Success, Danger
  description?: string;
  showMemberCount: boolean;
  requiredRoles?: string[];
  exclusiveGroup?: string;
  order?: number;
}

interface SelfRolePanelData {
  id: string;
  guildId: string;
  name: string;
  description?: string;
  displayType: "button" | "dropdown";
  layoutMode?: "components_v2" | "embed";
  multiSelect: boolean;
  placeholderText?: string;

  embedTitle?: string;
  embedDescription?: string;
  embedColor: string;
  embedAuthorName?: string;
  embedAuthorIcon?: string;
  embedAuthorUrl?: string;
  thumbnail?: string;
  image?: string;
  footer?: string;
  footerIcon?: string;
  showTimestamp: boolean;
  embedFields: string; // JSON string of [{ name, value, inline }]

  addRoleMessage?: string;
  removeRoleMessage?: string;
  ephemeralResponse: boolean;

  channelId?: string;
  messageId?: string;

  options: SelfRoleOptionData[];
}

interface SelfRolesViewProps {
  selectedGuildId: string | null;
  channels: Channel[];
  roles: Role[];
}

const COLOR_PRESETS = [
  "#242429", // Neutral Dark (Components V2 / Seamless Look)
  "#5865F2", // Discord Blurple
  "#57F287", // Green
  "#FEE75C", // Yellow
  "#EB459E", // Fuchsia
  "#ED4245", // Red
  "#95A5A6", // Slate Gray
  "#1ABC9C", // Turquoise
  "#9B59B6", // Purple
  "#E67E22", // Orange
];

export function SelfRolesView({ selectedGuildId, channels, roles }: SelfRolesViewProps) {
  const { showToast } = useToast();
  const [panels, setPanels] = useState<SelfRolePanelData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"general" | "embed" | "options" | "messages">("general");

  // Form State
  const [formData, setFormData] = useState<Partial<SelfRolePanelData>>({
    name: "Neue Rollenauswahl",
    description: "",
    displayType: "button",
    multiSelect: true,
    placeholderText: "Wähle deine Rollen...",
    embedTitle: "🔔 Choose your Ping Roles",
    embedDescription: "7 roles available\n\nClick a button to receive or remove a role.",
    embedColor: "#5865F2",
    embedAuthorName: "",
    embedAuthorIcon: "",
    embedAuthorUrl: "",
    thumbnail: "",
    image: "",
    footer: "GuildPilot Self Roles",
    footerIcon: "",
    showTimestamp: false,
    embedFields: "[]",
    addRoleMessage: "✅ Added role {role}!",
    removeRoleMessage: "❌ Removed role {role}!",
    ephemeralResponse: true,
    channelId: "",
    options: [],
  });

  const [parsedFields, setParsedFields] = useState<Array<{ name: string; value: string; inline: boolean }>>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeploying, setIsDeploying] = useState<boolean>(false);

  // Filter text channels only
  const textChannels = channels.filter((c) => c.type === 0);

  // Fetch panels on guild select
  useEffect(() => {
    if (!selectedGuildId) return;
    fetchPanels();
  }, [selectedGuildId]);

  const fetchPanels = async () => {
    if (!selectedGuildId) return;
    setLoading(true);
    try {
      const res = await api.get(`/guilds/${selectedGuildId}/self-roles/panels`);
      const data = res.data;
      setPanels(data);
      if (data.length > 0 && !selectedPanelId) {
        loadPanelIntoForm(data[0]);
      }
    } catch (e: any) {
      console.error("Failed to fetch panels", e);
      showToast("Fehler beim Laden der Self-Role-Panels", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadPanelIntoForm = (panel: SelfRolePanelData) => {
    setSelectedPanelId(panel.id);
    let fields = [];
    try {
      fields = typeof panel.embedFields === "string" ? JSON.parse(panel.embedFields) : panel.embedFields || [];
    } catch (e) {
      fields = [];
    }
    setParsedFields(fields);
    setFormData({
      ...panel,
      options: panel.options || [],
    });
  };

  const handleCreateNewPanel = () => {
    setSelectedPanelId(null);
    setParsedFields([]);
    setFormData({
      name: "Neues Self-Role Panel",
      description: "Rollenverteilung für Community-Mitglieder",
      displayType: "button",
      multiSelect: true,
      placeholderText: "Wähle deine Rollen...",
      embedTitle: "🔔 Wähle deine Benachrichtigungs-Rollen",
      embedDescription: "Klicke auf einen Button unten, um die jeweilige Rolle zu erhalten oder zu entfernen.",
      embedColor: "#5865F2",
      embedAuthorName: "",
      embedAuthorIcon: "",
      embedAuthorUrl: "",
      thumbnail: "",
      image: "",
      footer: "GuildPilot Self Roles",
      footerIcon: "",
      showTimestamp: false,
      embedFields: "[]",
      addRoleMessage: "✅ Rolle {role} wurde dir gegeben!",
      removeRoleMessage: "❌ Rolle {role} wurde dir entfernt!",
      ephemeralResponse: true,
      channelId: textChannels[0]?.id || "",
      options: [
        {
          roleId: roles[0]?.id || "",
          roleName: roles[0]?.name || "News",
          label: "News",
          emoji: "📩",
          buttonColor: "Secondary",
          showMemberCount: true,
          order: 0,
        },
      ],
    });
    setActiveTab("general");
  };

  const handleAddField = () => {
    setParsedFields([...parsedFields, { name: "Feld Name", value: "Feld Inhalt", inline: true }]);
  };

  const handleUpdateField = (index: number, key: "name" | "value" | "inline", val: any) => {
    const updated = [...parsedFields];
    updated[index] = { ...updated[index], [key]: val };
    setParsedFields(updated);
  };

  const handleRemoveField = (index: number) => {
    setParsedFields(parsedFields.filter((_, i) => i !== index));
  };

  // Option Handlers
  const handleAddOption = () => {
    const defaultRole = roles[0];
    const newOptions = [
      ...(formData.options || []),
      {
        roleId: defaultRole?.id || "",
        roleName: defaultRole?.name || "Neuer Button",
        label: defaultRole?.name || "Rolle",
        emoji: "⭐️",
        buttonColor: "Secondary",
        showMemberCount: true,
        order: (formData.options || []).length,
      },
    ];
    setFormData({ ...formData, options: newOptions });
  };

  const handleUpdateOption = (index: number, key: string, val: any) => {
    const opts = [...(formData.options || [])];
    if (key === "roleId") {
      const selectedRole = roles.find((r) => r.id === val);
      opts[index] = {
        ...opts[index],
        roleId: val,
        roleName: selectedRole?.name || opts[index].roleName,
        label: opts[index].label || selectedRole?.name || "",
      };
    } else {
      opts[index] = { ...opts[index], [key]: val };
    }
    setFormData({ ...formData, options: opts });
  };

  const handleRemoveOption = (index: number) => {
    const opts = (formData.options || []).filter((_, i) => i !== index);
    setFormData({ ...formData, options: opts });
  };

  const handleMoveOption = (index: number, direction: "up" | "down") => {
    const opts = [...(formData.options || [])];
    if (direction === "up" && index > 0) {
      const temp = opts[index];
      opts[index] = opts[index - 1];
      opts[index - 1] = temp;
    } else if (direction === "down" && index < opts.length - 1) {
      const temp = opts[index];
      opts[index] = opts[index + 1];
      opts[index + 1] = temp;
    }
    setFormData({ ...formData, options: opts });
  };

  // Save Panel
  const handleSavePanel = async (): Promise<SelfRolePanelData | null> => {
    if (!selectedGuildId) return null;
    if (!formData.name?.trim()) {
      showToast("Bitte gib dem Panel einen Namen", "error");
      return null;
    }
    if (!formData.channelId) {
      showToast("Bitte wähle im Tab 'Allgemein & Kanal' einen Discord-Kanal aus", "error");
      return null;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        embedFields: JSON.stringify(parsedFields),
      };

      let res;
      if (selectedPanelId) {
        res = await api.put(`/guilds/${selectedGuildId}/self-roles/panels/${selectedPanelId}`, payload);
      } else {
        res = await api.post(`/guilds/${selectedGuildId}/self-roles/panels`, payload);
      }

      showToast("Self-Role-Panel erfolgreich gespeichert!", "success");
      await fetchPanels();
      loadPanelIntoForm(res.data);
      return res.data;
    } catch (e: any) {
      console.error(e);
      showToast(e.response?.data?.error || "Fehler beim Speichern", "error");
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  // Deploy to Discord
  const handleDeployToDiscord = async (panelIdToDeploy?: string) => {
    if (!selectedGuildId) return;

    setIsDeploying(true);
    try {
      let targetId = panelIdToDeploy || selectedPanelId;

      // Auto-save if new/unsaved panel
      if (!targetId) {
        const saved = await handleSavePanel();
        if (saved && saved.id) {
          targetId = saved.id;
        } else {
          setIsDeploying(false);
          return;
        }
      } else if (!formData.channelId) {
        showToast("Bitte wähle im Tab 'Allgemein & Kanal' einen Discord-Textkanal aus", "error");
        setIsDeploying(false);
        return;
      }

      await api.post(`/guilds/${selectedGuildId}/self-roles/panels/${targetId}/post`);
      showToast("🚀 Panel wurde erfolgreich auf Discord gepostet / aktualisiert!", "success");
      await fetchPanels();
    } catch (e: any) {
      console.error(e);
      showToast(e.response?.data?.error || "Fehler beim Senden nach Discord", "error");
    } finally {
      setIsDeploying(false);
    }
  };

  // Duplicate Panel
  const handleDuplicatePanel = async (id: string) => {
    if (!selectedGuildId) return;
    try {
      await api.post(`/guilds/${selectedGuildId}/self-roles/panels/${id}/duplicate`);
      showToast("Panel dupliziert!", "success");
      fetchPanels();
    } catch (e: any) {
      showToast(e.response?.data?.error || "Fehler beim Duplizieren", "error");
    }
  };

  // Delete Panel
  const handleDeletePanel = async (id: string) => {
    if (!selectedGuildId || !confirm("Möchtest du dieses Self-Role Panel wirklich löschen?")) return;
    try {
      await api.delete(`/guilds/${selectedGuildId}/self-roles/panels/${id}`);
      showToast("Panel gelöscht", "info");
      if (selectedPanelId === id) {
        setSelectedPanelId(null);
      }
      fetchPanels();
    } catch (e: any) {
      showToast(e.response?.data?.error || "Fehler beim Löschen", "error");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0f17] text-slate-200 overflow-hidden">
      {/* Top Header */}
      <div className="h-16 px-6 border-b border-[#1e293b] bg-[#0d121c] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">Self-Roles & Reaktions-Panels</h1>
            <p className="text-xs text-slate-400">
              Interaktive Rollen-Panels mit Buttons, Dropdowns & Live-Mitglieder-Zählern
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleCreateNewPanel}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#111724] hover:bg-[#1a253a] text-slate-300 hover:text-white text-xs font-semibold border border-[#1e293b] transition-all cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4 text-indigo-400" /> Neues Panel
          </button>
          <button
            onClick={handleSavePanel}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/25 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {selectedPanelId ? "Änderungen speichern" : "Panel erstellen"}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Column: Panel List & Presets */}
        <div className="w-72 border-r border-[#1e293b] bg-[#0d121c] flex flex-col shrink-0 overflow-hidden">
          <div className="p-3.5 border-b border-[#1e293b] bg-[#0b0f17] flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Deine Panels</span>
            <span className="text-[11px] font-semibold text-slate-400 bg-[#111724] px-2 py-0.5 rounded-full border border-[#1e293b]">
              {panels.length}
            </span>
          </div>

          <div className="flex-1 p-2.5 space-y-2 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" /> Lade Panels...
              </div>
            ) : panels.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                <Tag className="w-8 h-8 mx-auto text-slate-600" />
                <p>Noch keine Self-Role Panels vorhanden.</p>
                <button
                  onClick={handleCreateNewPanel}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer shadow-sm"
                >
                  Erstes Panel erstellen
                </button>
              </div>
            ) : (
              panels.map((p) => {
                const isSelected = selectedPanelId === p.id;
                const channel = textChannels.find((c) => c.id === p.channelId);
                return (
                  <div
                    key={p.id}
                    onClick={() => loadPanelIntoForm(p)}
                    className={`p-3 rounded-xl cursor-pointer transition-all border ${
                      isSelected
                        ? "bg-indigo-500/10 border-indigo-500 text-white shadow-sm"
                        : "bg-[#111724] border-[#1e293b] hover:border-slate-600 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-xs font-bold truncate flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: p.embedColor || "#5865F2" }}
                        />
                        {p.name}
                      </h3>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#0d121c] text-slate-400 border border-[#1e293b]">
                        {p.displayType === "dropdown" ? "Menü" : "Buttons"}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-1 mb-2">
                      {p.embedTitle || p.description || "Kein Titel"}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-[#1e293b]">
                      <span className="flex items-center gap-1 text-slate-400">
                        <Hash className="w-3 h-3 text-slate-500" />
                        {channel ? `#${channel.name}` : "Kein Kanal"}
                      </span>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDeployToDiscord(p.id)}
                          title="Auf Discord posten"
                          className="p-1 hover:text-emerald-400 transition-colors cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDuplicatePanel(p.id)}
                          title="Duplizieren"
                          className="p-1 hover:text-white transition-colors cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeletePanel(p.id)}
                          title="Löschen"
                          className="p-1 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Middle Column: Configuration Tabs & Editor */}
        <div className="flex-1 flex flex-col bg-[#0b0f17] min-w-0 border-r border-[#1e293b] overflow-hidden">
          {/* Tabs Navigation */}
          <div className="h-12 px-4 bg-[#0d121c] border-b border-[#1e293b] flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveTab("general")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "general"
                  ? "bg-indigo-600 text-white font-bold"
                  : "text-slate-400 hover:text-white hover:bg-[#111724]"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" /> Allgemein & Kanal
            </button>
            <button
              onClick={() => setActiveTab("embed")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "embed"
                  ? "bg-indigo-600 text-white font-bold"
                  : "text-slate-400 hover:text-white hover:bg-[#111724]"
              }`}
            >
              <Palette className="w-3.5 h-3.5" /> Embed Designer
            </button>
            <button
              onClick={() => setActiveTab("options")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "options"
                  ? "bg-indigo-600 text-white font-bold"
                  : "text-slate-400 hover:text-white hover:bg-[#111724]"
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Rollen & Buttons ({formData.options?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("messages")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "messages"
                  ? "bg-indigo-600 text-white font-bold"
                  : "text-slate-400 hover:text-white hover:bg-[#111724]"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" /> Rückmeldungen
            </button>
          </div>

          {/* Tab Content Panels */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            {/* TAB 1: GENERAL & CHANNEL */}
            {activeTab === "general" && (
              <div className="space-y-6 max-w-2xl">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
                    Panel-Name (Intern)
                  </label>
                  <input
                    type="text"
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-[#111724] border border-[#1e293b] focus:border-indigo-500 rounded-xl p-3 text-xs text-white outline-none"
                    placeholder="z. B. Community Ping Roles"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
                    Zielkanal auf Discord
                  </label>
                  <select
                    value={formData.channelId || ""}
                    onChange={(e) => setFormData({ ...formData, channelId: e.target.value })}
                    className="w-full bg-[#111724] border border-[#1e293b] focus:border-indigo-500 rounded-xl p-3 text-xs text-white outline-none cursor-pointer"
                  >
                    <option value="">Wähle einen Textkanal...</option>
                    {textChannels.map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
                      Anzeigemodus (UI)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, displayType: "button" })}
                        className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          formData.displayType === "button"
                            ? "bg-indigo-500/20 border-indigo-500 text-white"
                            : "bg-[#111724] border-[#1e293b] text-slate-400 hover:text-white"
                        }`}
                      >
                        <Layout className="w-4 h-4" />
                        <span>Buttons</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, displayType: "dropdown" })}
                        className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          formData.displayType === "dropdown"
                            ? "bg-indigo-500/20 border-indigo-500 text-white"
                            : "bg-[#111724] border-[#1e293b] text-slate-400 hover:text-white"
                        }`}
                      >
                        <Sliders className="w-4 h-4" />
                        <span>Dropdown-Menü</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
                      Auswahl-Modus
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, multiSelect: true })}
                        className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          formData.multiSelect
                            ? "bg-emerald-600/20 border-emerald-500 text-white"
                            : "bg-[#111724] border-[#1e293b] text-slate-400 hover:text-white"
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Mehrfachauswahl</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, multiSelect: false })}
                        className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          !formData.multiSelect
                            ? "bg-amber-600/20 border-amber-500 text-white"
                            : "bg-[#111724] border-[#1e293b] text-slate-400 hover:text-white"
                        }`}
                      >
                        <Shield className="w-4 h-4" />
                        <span>Exklusiv (1 Rolle)</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Layout Mode Selector (Components V2 vs Embed) */}
                <div className="pt-2 border-t border-[#1e293b]">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
                    Layout / Design-System
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, layoutMode: "components_v2" } as any)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        (formData as any).layoutMode !== "embed"
                          ? "bg-indigo-500/20 border-indigo-500 text-white"
                          : "bg-[#111724] border-[#1e293b] text-slate-400 hover:text-white"
                      }`}
                    >
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-400" /> ⚡ Components V2 (Native Card)
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 font-normal">
                        Nahtloses Design ohne dicken Embed-Rahmen.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, layoutMode: "embed" } as any)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        (formData as any).layoutMode === "embed"
                          ? "bg-indigo-500/20 border-indigo-500 text-white"
                          : "bg-[#111724] border-[#1e293b] text-slate-400 hover:text-white"
                      }`}
                    >
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Layout className="w-4 h-4 text-indigo-400" /> 📦 Klassisches Embed
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 font-normal">
                        Standard Discord Embed-Box mit Farbleiste, Thumbnail und Feldern.
                      </p>
                    </button>
                  </div>
                </div>

                {formData.displayType === "dropdown" && (
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
                      Dropdown Platzhalter Text
                    </label>
                    <input
                      type="text"
                      value={formData.placeholderText || ""}
                      onChange={(e) => setFormData({ ...formData, placeholderText: e.target.value })}
                      className="w-full bg-[#111724] border border-[#1e293b] focus:border-indigo-500 rounded-xl p-3 text-xs text-white outline-none"
                      placeholder="Wähle deine Rollen aus..."
                    />
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: EMBED DESIGNER */}
            {activeTab === "embed" && (
              <div className="space-y-6 max-w-2xl">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
                    Embed Titel
                  </label>
                  <input
                    type="text"
                    value={formData.embedTitle || ""}
                    onChange={(e) => setFormData({ ...formData, embedTitle: e.target.value })}
                    className="w-full bg-[#111724] border border-[#1e293b] focus:border-indigo-500 rounded-xl p-3 text-xs text-white outline-none"
                    placeholder="🔔 Wähle deine Benachrichtigungs-Rollen"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
                    Embed Beschreibung (Markdown unterstützt)
                  </label>
                  <textarea
                    rows={4}
                    value={formData.embedDescription || ""}
                    onChange={(e) => setFormData({ ...formData, embedDescription: e.target.value })}
                    className="w-full bg-[#111724] border border-[#1e293b] focus:border-indigo-500 rounded-xl p-3 text-xs text-white outline-none font-mono"
                    placeholder="Klicke auf einen Button unten, um eine Rolle zu erhalten oder zu entfernen."
                  />
                </div>

                {/* Embed Color Picker */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
                    Embed Akzentfarbe
                  </label>
                  <div className="flex items-center gap-3 mb-2">
                    <input
                      type="color"
                      value={formData.embedColor || "#5865F2"}
                      onChange={(e) => setFormData({ ...formData, embedColor: e.target.value })}
                      className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={formData.embedColor || "#5865F2"}
                      onChange={(e) => setFormData({ ...formData, embedColor: e.target.value })}
                      className="bg-[#111724] border border-[#1e293b] focus:border-indigo-500 rounded-xl p-2.5 text-xs text-white outline-none font-mono w-32"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFormData({ ...formData, embedColor: c })}
                        className="w-6 h-6 rounded-full border border-black/40 shadow-sm transition-transform hover:scale-110 cursor-pointer"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {/* Main Banner Graphic Image URL */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
                    Banner / Header Grafik Bild-URL
                  </label>
                  <input
                    type="text"
                    value={formData.image || ""}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                    className="w-full bg-[#111724] border border-[#1e293b] focus:border-indigo-500 rounded-xl p-3 text-xs text-white outline-none"
                    placeholder="https://example.com/banner.png"
                  />
                </div>

                {/* Thumbnail Image URL */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
                    Thumbnail Bild-URL (Kleines Icon oben rechts)
                  </label>
                  <input
                    type="text"
                    value={formData.thumbnail || ""}
                    onChange={(e) => setFormData({ ...formData, thumbnail: e.target.value })}
                    className="w-full bg-[#111724] border border-[#1e293b] focus:border-indigo-500 rounded-xl p-3 text-xs text-white outline-none"
                    placeholder="https://..."
                  />
                </div>

                {/* Footer & Timestamp */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
                      Footer Text
                    </label>
                    <input
                      type="text"
                      value={formData.footer || ""}
                      onChange={(e) => setFormData({ ...formData, footer: e.target.value })}
                      className="w-full bg-[#111724] border border-[#1e293b] focus:border-indigo-500 rounded-xl p-3 text-xs text-white outline-none"
                      placeholder="GuildPilot Self Roles"
                    />
                  </div>

                  <div className="flex items-center pt-6">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                      <input
                        type="checkbox"
                        checked={formData.showTimestamp || false}
                        onChange={(e) => setFormData({ ...formData, showTimestamp: e.target.checked })}
                        className="w-4 h-4 rounded bg-[#111724] border-[#1e293b] text-indigo-600 focus:ring-0"
                      />
                      <span>Zeitstempel anzeigen</span>
                    </label>
                  </div>
                </div>

                {/* Custom Fields */}
                <div className="pt-4 border-t border-[#1e293b]">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Zusätzliche Embed-Felder (Fields)
                    </label>
                    <button
                      type="button"
                      onClick={handleAddField}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#111724] hover:bg-[#1a253a] text-white text-xs font-semibold border border-[#1e293b] cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-indigo-400" /> Feld hinzufügen
                    </button>
                  </div>

                  {parsedFields.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">Keine zusätzlichen Felder konfiguriert.</p>
                  ) : (
                    <div className="space-y-3">
                      {parsedFields.map((f, idx) => (
                        <div key={idx} className="p-3 bg-[#111724] border border-[#1e293b] rounded-xl space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <input
                              type="text"
                              value={f.name}
                              onChange={(e) => handleUpdateField(idx, "name", e.target.value)}
                              className="flex-1 bg-[#0d121c] border border-[#1e293b] rounded-lg p-2 text-xs font-bold text-white outline-none"
                              placeholder="Feld Überschrift"
                            />
                            <label className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={f.inline}
                                onChange={(e) => handleUpdateField(idx, "inline", e.target.checked)}
                                className="w-3.5 h-3.5 rounded bg-[#0d121c]"
                              />
                              Inline
                            </label>
                            <button
                              type="button"
                              onClick={() => handleRemoveField(idx)}
                              className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <textarea
                            rows={2}
                            value={f.value}
                            onChange={(e) => handleUpdateField(idx, "value", e.target.value)}
                            className="w-full bg-[#0d121c] border border-[#1e293b] rounded-lg p-2 text-xs text-slate-200 outline-none"
                            placeholder="Feld Inhalt"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: ROLES & BUTTONS OPTIONS */}
            {activeTab === "options" && (
              <div className="space-y-6 max-w-3xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">Rollen-Optionen / Buttons ({formData.options?.length || 0})</h3>
                    <p className="text-xs text-slate-400">
                      Konfiguriere jeden Button mit Rolle, Emoji, Farbe und automatischem Zähler-Badge.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/25 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Rolle hinzufügen
                  </button>
                </div>

                {(!formData.options || formData.options.length === 0) ? (
                  <div className="p-8 text-center bg-[#111724] border border-[#1e293b] rounded-2xl text-xs text-slate-500 space-y-2">
                    <Layers className="w-8 h-8 mx-auto text-slate-600" />
                    <p>Keine Rollen hinzugefügt. Klicke oben auf "Rolle hinzufügen".</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.options.map((opt, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-[#111724] border border-[#1e293b] hover:border-slate-600 rounded-xl space-y-3 transition-all"
                      >
                        <div className="flex items-center justify-between gap-3 border-b border-[#1e293b] pb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#0d121c] text-[10px] font-bold text-slate-400 flex items-center justify-center border border-[#1e293b]">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold text-white">
                              {opt.emoji} {opt.label || opt.roleName || "Unbenannt"}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleMoveOption(idx, "up")}
                              disabled={idx === 0}
                              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveOption(idx, "down")}
                              disabled={idx === (formData.options?.length || 0) - 1}
                              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveOption(idx)}
                              className="p-1 text-slate-400 hover:text-rose-400 ml-2 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          {/* Target Role Select */}
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                              Discord Rolle
                            </label>
                            <select
                              value={opt.roleId}
                              onChange={(e) => handleUpdateOption(idx, "roleId", e.target.value)}
                              className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 rounded-lg p-2 text-xs text-white outline-none cursor-pointer"
                            >
                              <option value="">Wähle Rolle...</option>
                              {roles.map((r) => (
                                <option key={r.id} value={r.id}>
                                  @{r.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Custom Button Label */}
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                              Button Beschriftung
                            </label>
                            <input
                              type="text"
                              value={opt.label || ""}
                              onChange={(e) => handleUpdateOption(idx, "label", e.target.value)}
                              className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 rounded-lg p-2 text-xs text-white outline-none"
                              placeholder="z. B. News"
                            />
                          </div>

                          {/* Emoji */}
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                              Emoji
                            </label>
                            <input
                              type="text"
                              value={opt.emoji || ""}
                              onChange={(e) => handleUpdateOption(idx, "emoji", e.target.value)}
                              className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 rounded-lg p-2 text-xs text-white outline-none"
                              placeholder="z. B. 📩 oder 🎮"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-1">
                          {/* Button Color */}
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                              Button Farbe
                            </label>
                            <select
                              value={opt.buttonColor || "Secondary"}
                              onChange={(e) => handleUpdateOption(idx, "buttonColor", e.target.value)}
                              className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 rounded-lg p-2 text-xs text-white outline-none cursor-pointer"
                            >
                              <option value="Secondary">Sekundär (Grau / Dark)</option>
                              <option value="Primary">Primär (Blau / Indigo)</option>
                              <option value="Success">Erfolg (Grün)</option>
                              <option value="Danger">Gefahr (Rot)</option>
                            </select>
                          </div>

                          {/* Dynamic Member Count Badge Checkbox */}
                          <div className="flex items-center pt-4">
                            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 font-medium">
                              <input
                                type="checkbox"
                                checked={opt.showMemberCount !== false}
                                onChange={(e) => handleUpdateOption(idx, "showMemberCount", e.target.checked)}
                                className="w-4 h-4 rounded bg-[#0d121c] border-[#1e293b] text-indigo-600 focus:ring-0"
                              />
                              <span>Mitglieder-Zähler anzeigen (z. B. News (117))</span>
                            </label>
                          </div>
                        </div>

                        {formData.displayType === "dropdown" && (
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                              Option Beschreibung (im Menü)
                            </label>
                            <input
                              type="text"
                              value={opt.description || ""}
                              onChange={(e) => handleUpdateOption(idx, "description", e.target.value)}
                              className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 rounded-lg p-2 text-xs text-white outline-none"
                              placeholder="Erhalte Benachrichtigungen für Ankündigungen"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: MESSAGES */}
            {activeTab === "messages" && (
              <div className="space-y-6 max-w-2xl">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
                    Bestätigung bei Rollenvergabe
                  </label>
                  <input
                    type="text"
                    value={formData.addRoleMessage || ""}
                    onChange={(e) => setFormData({ ...formData, addRoleMessage: e.target.value })}
                    className="w-full bg-[#111724] border border-[#1e293b] focus:border-indigo-500 rounded-xl p-3 text-xs text-white outline-none"
                    placeholder="✅ Rolle {role} wurde dir gegeben!"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Variablen: {"{role}"}, {"{user}"}</p>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
                    Bestätigung bei Entfernen der Rolle
                  </label>
                  <input
                    type="text"
                    value={formData.removeRoleMessage || ""}
                    onChange={(e) => setFormData({ ...formData, removeRoleMessage: e.target.value })}
                    className="w-full bg-[#111724] border border-[#1e293b] focus:border-indigo-500 rounded-xl p-3 text-xs text-white outline-none"
                    placeholder="❌ Rolle {role} wurde dir entfernt!"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Variablen: {"{role}"}, {"{user}"}</p>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 font-semibold">
                    <input
                      type="checkbox"
                      checked={formData.ephemeralResponse !== false}
                      onChange={(e) => setFormData({ ...formData, ephemeralResponse: e.target.checked })}
                      className="w-4 h-4 rounded bg-[#111724] border-[#1e293b] text-indigo-600 focus:ring-0"
                    />
                    <span>Ephemere Antworten (Nur für den Nutzer sichtbar, der klickt)</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Dynamic Live Discord Preview */}
        <div className="w-96 bg-[#0d121c] flex flex-col shrink-0 border-l border-[#1e293b] overflow-hidden">
          <div className="p-3.5 border-b border-[#1e293b] bg-[#0b0f17] flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Live-Vorschau
            </span>
            <button
              onClick={() => handleDeployToDiscord()}
              disabled={isDeploying}
              className="flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-all disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {isDeploying ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              <span>Auf Discord posten</span>
            </button>
          </div>

          <div className="flex-1 p-4 bg-[#0d121c] overflow-y-auto space-y-3">
            {/* Discord Live Embed / Component V2 Container */}
            <div className="bg-[#111724] rounded-2xl p-4 border border-[#1e293b] shadow-md relative space-y-3 font-sans">
              {/* Colored Left Border (Hidden if Neutral Dark #242429 or V2 layout) */}
              {formData.embedColor && formData.embedColor.toLowerCase() !== "#242429" && formData.embedColor.toLowerCase() !== "#2b2d31" && formData.embedColor !== "none" && formData.layoutMode === "embed" && (
                <div
                  className="absolute top-0 bottom-0 left-0 w-1.5 rounded-l-2xl"
                  style={{ backgroundColor: formData.embedColor }}
                />
              )}

              {/* 1. Media Gallery Component (Large Image ABOVE text) */}
              {formData.image && (
                <div className="rounded-xl overflow-hidden border border-[#1e293b] shadow-sm">
                  <img src={formData.image} alt="Header Banner" className="w-full object-cover max-h-48" />
                </div>
              )}

              {/* 2. Separator */}
              {formData.image && (
                <div className="h-[1px] bg-[#1e293b] w-full" />
              )}

              {/* Author Header */}
              {formData.embedAuthorName && (
                <div className="flex items-center gap-2">
                  {formData.embedAuthorIcon && (
                    <img src={formData.embedAuthorIcon} alt="" className="w-5 h-5 rounded-full" />
                  )}
                  <span className="text-xs font-bold text-white">{formData.embedAuthorName}</span>
                </div>
              )}

              {/* 3. Text Display (Title & Description) */}
              <div className="space-y-1">
                {formData.embedTitle && (
                  <h2 className="text-sm font-bold text-white leading-tight">{formData.embedTitle}</h2>
                )}
                {formData.embedDescription && (
                  <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {formData.embedDescription}
                  </p>
                )}
              </div>

              {/* Custom Embed Fields */}
              {parsedFields.length > 0 && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1e293b]">
                  {parsedFields.map((f, idx) => (
                    <div key={idx} className={f.inline ? "col-span-1" : "col-span-2"}>
                      <span className="text-[10px] font-bold text-slate-400 block">{f.name}</span>
                      <span className="text-xs text-slate-200 block">{f.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer */}
              {formData.footer && (
                <div className="pt-2 border-t border-[#1e293b] flex items-center gap-2 text-[10px] text-slate-400">
                  {formData.footerIcon && <img src={formData.footerIcon} alt="" className="w-4 h-4 rounded-full" />}
                  <span>{formData.footer}</span>
                </div>
              )}

              {/* Interactive Components (Buttons or Dropdown) INSIDE Embed Container */}
              <div className="pt-2 border-t border-[#1e293b]">
                {formData.displayType === "dropdown" ? (
                  <div className="space-y-1">
                    <div className="bg-[#0d121c] border border-[#1e293b] rounded-xl p-2.5 flex items-center justify-between text-xs text-slate-400">
                      <span>{formData.placeholderText || "Rollen auswählen..."}</span>
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(!formData.options || formData.options.length === 0) ? (
                      <span className="text-xs text-slate-500 italic py-1">Keine Buttons hinzugefügt...</span>
                    ) : (
                      formData.options.map((opt, idx) => {
                        let bgColor = "bg-[#1e293b] hover:bg-[#2b3952] text-slate-200";
                        if (opt.buttonColor === "Primary") bgColor = "bg-indigo-600 hover:bg-indigo-500 text-white";
                        if (opt.buttonColor === "Success") bgColor = "bg-emerald-600 hover:bg-emerald-500 text-white";
                        if (opt.buttonColor === "Danger") bgColor = "bg-rose-600 hover:bg-rose-500 text-white";

                        const labelText = opt.label || opt.roleName || "News";
                        const countText = opt.showMemberCount !== false ? " (117)" : "";

                        return (
                          <button
                            key={idx}
                            type="button"
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${bgColor}`}
                          >
                            {opt.emoji && <span className="text-sm">{opt.emoji}</span>}
                            <span>
                              {labelText}
                              {countText}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

