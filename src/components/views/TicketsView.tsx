"use client";

import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastContainer";
import { getSocket } from "@/lib/socket";
import {
  Ticket,
  LayoutDashboard,
  Layers,
  ListFilter,
  FolderTree,
  Settings,
  History,
  Plus,
  Trash2,
  Edit,
  Send,
  Lock,
  Unlock,
  UserPlus,
  FileText,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserCheck,
  Shield,
  Hash,
  Download,
  Eye,
  RefreshCw,
  Image as ImageIcon,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  MessageSquarePlus,
  AlignLeft,
  ListOrdered,
} from "lucide-react";

type SubPage = "dashboard" | "panels" | "tickets-list" | "categories" | "settings" | "logs";

interface TicketsViewProps {
  selectedGuildId: string | null;
  channels: any[];
  roles: any[];
}

interface IntakeQuestion {
  id: string;
  label: string;
  placeholder: string;
  style: "short" | "paragraph";
  required: boolean;
}

interface TicketReason {
  label: string;
  value: string;
  emoji: string;
  description: string;
  categoryId?: string;
  questions?: IntakeQuestion[];
}

export function TicketsView({ selectedGuildId, channels, roles }: TicketsViewProps) {
  const { showToast } = useToast();
  const [activeSubPage, setActiveSubPage] = useState<SubPage>("dashboard");

  // Data states
  const [stats, setStats] = useState<any>({ total: 0, open: 0, claimed: 0, closed: 0, panelsCount: 0 });
  const [panels, setPanels] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({
    namingFormat: "ticket-{username}",
    defaultSupportRoles: [],
    defaultCategoryId: "",
    logChannelId: "",
    closeConfirmation: true,
    deleteDelaySeconds: 5,
    transcriptStorage: "local",
    maxTicketsPerUser: 3,
    autoArchive: false,
  });

  // Loading & Filter states
  const [loading, setLoading] = useState(false);
  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modals
  const [isPanelModalOpen, setIsPanelModalOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<any>(null);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [previewTab, setPreviewTab] = useState<"panel" | "welcome" | "questions">("panel");
  const [selectedPreviewReasonIdx, setSelectedPreviewReasonIdx] = useState<number>(0);
  const [expandedReasonIdx, setExpandedReasonIdx] = useState<number | null>(null);

  // Panel Form State with Full Live Preview defaults
  const [panelForm, setPanelForm] = useState<any>({
    name: "General Support",
    description: "Main support panel for member inquiries.",
    embedTitle: "📩 Need Support?",
    embedDescription: "Click the button below or choose a ticket reason from the menu to open a private ticket.",
    embedColor: "#5865F2",
    thumbnail: "",
    image: "",
    footer: "TheGodGen Ticket Engine",
    welcomeTitle: "👋 Welcome to your support ticket!",
    welcomeDescription: "A member of our support staff will be with you shortly. Please describe your request in detail.",
    welcomeColor: "#5865F2",
    welcomeThumbnail: "",
    welcomeImage: "",
    welcomeFooter: "TheGodGen Ticket Engine",
    reasons: [] as TicketReason[],
    questions: [] as IntakeQuestion[],
    channelId: "",
    categoryId: "",
    buttonText: "Create Ticket",
    buttonEmoji: "📩",
    buttonColor: "Primary",
    allowedRoles: [],
    supportRoles: [],
    maxOpenTickets: 1,
    autoCloseHours: 0,
    transcriptEnabled: true,
  });

  // Ticket Reason Form inside Panel Modal
  const [newReasonLabel, setNewReasonLabel] = useState("");
  const [newReasonEmoji, setNewReasonEmoji] = useState("❓");
  const [newReasonDesc, setNewReasonDesc] = useState("");
  const [newReasonCat, setNewReasonCat] = useState("");

  // Global Question Form state inside Panel Modal
  const [newQTitle, setNewQTitle] = useState("");
  const [newQPlaceholder, setNewQPlaceholder] = useState("");
  const [newQStyle, setNewQStyle] = useState<"short" | "paragraph">("short");
  const [newQRequired, setNewQRequired] = useState(true);

  // Per-Reason Question Form state
  const [reasonQTitle, setReasonQTitle] = useState("");
  const [reasonQPlaceholder, setReasonQPlaceholder] = useState("");
  const [reasonQStyle, setReasonQStyle] = useState<"short" | "paragraph">("short");
  const [reasonQRequired, setReasonQRequired] = useState(true);

  // Category Form State
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("🎫");

  // Fetch all ticket data for selected guild
  const fetchAllData = useCallback(async () => {
    if (!selectedGuildId) return;
    setLoading(true);
    try {
      const [statsRes, panelsRes, ticketsRes, catRes, settingsRes, logsRes] = await Promise.all([
        api.get(`/guilds/${selectedGuildId}/tickets/stats`).catch(() => ({ data: {} })),
        api.get(`/guilds/${selectedGuildId}/tickets/panels`).catch(() => ({ data: [] })),
        api.get(`/guilds/${selectedGuildId}/tickets`).catch(() => ({ data: [] })),
        api.get(`/guilds/${selectedGuildId}/tickets/categories`).catch(() => ({ data: [] })),
        api.get(`/guilds/${selectedGuildId}/tickets/settings`).catch(() => ({ data: {} })),
        api.get(`/guilds/${selectedGuildId}/tickets/logs`).catch(() => ({ data: [] })),
      ]);

      setStats(statsRes.data);
      setPanels(panelsRes.data);
      setTickets(ticketsRes.data);
      setCategories(catRes.data);
      if (settingsRes.data.guildId) {
        setSettings({
          ...settingsRes.data,
          defaultSupportRoles: JSON.parse(settingsRes.data.defaultSupportRoles || "[]"),
        });
      }
      setLogs(logsRes.data);
    } catch (err) {
      console.error("Failed to load ticket data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedGuildId]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Real-time socket updates
  useEffect(() => {
    const socket = getSocket();
    const handleLiveUpdate = () => {
      fetchAllData();
    };

    socket.on("ticketCreate", handleLiveUpdate);
    socket.on("ticketUpdate", handleLiveUpdate);
    socket.on("ticketDelete", handleLiveUpdate);
    socket.on("ticketLogCreate", handleLiveUpdate);
    socket.on("ticketPanelCreate", handleLiveUpdate);
    socket.on("ticketPanelUpdate", handleLiveUpdate);
    socket.on("ticketPanelDelete", handleLiveUpdate);

    return () => {
      socket.off("ticketCreate", handleLiveUpdate);
      socket.off("ticketUpdate", handleLiveUpdate);
      socket.off("ticketDelete", handleLiveUpdate);
      socket.off("ticketLogCreate", handleLiveUpdate);
      socket.off("ticketPanelCreate", handleLiveUpdate);
      socket.off("ticketPanelUpdate", handleLiveUpdate);
      socket.off("ticketPanelDelete", handleLiveUpdate);
    };
  }, [fetchAllData]);

  // Panel Handlers
  const handleOpenCreatePanel = () => {
    setEditingPanel(null);
    setPanelForm({
      name: "Support Desk",
      description: "General support inquiries & technical help",
      embedTitle: "📩 Support Desk",
      embedDescription: "Click the button below or pick a reason from the dropdown menu to open a private ticket with our staff.",
      embedColor: "#5865F2",
      thumbnail: "",
      image: "",
      footer: "TheGodGen Ticket Engine",
      welcomeTitle: "👋 Welcome to your support ticket!",
      welcomeDescription: "A member of our support team will be with you shortly. Please describe your inquiry in detail.",
      welcomeColor: "#5865F2",
      welcomeThumbnail: "",
      welcomeImage: "",
      welcomeFooter: "TheGodGen Ticket Engine",
      reasons: [
        {
          label: "🐛 Bug Report",
          value: "bug_report",
          emoji: "🐛",
          description: "Report a bug or system issue",
          questions: [
            { id: "q1", label: "Describe the bug in detail", placeholder: "What went wrong?", style: "paragraph", required: true },
            { id: "q2", label: "Steps to reproduce", placeholder: "1. Click X... 2. Press Y...", style: "paragraph", required: false },
          ],
        },
        {
          label: "💳 Billing & Purchases",
          value: "billing",
          emoji: "💳",
          description: "Payment and package questions",
          questions: [
            { id: "q3", label: "Transaction ID / Receipt", placeholder: "e.g. TX-987654", style: "short", required: true },
          ],
        },
      ],
      questions: [],
      channelId: channels[0]?.id || "",
      categoryId: "",
      buttonText: "Create Ticket",
      buttonEmoji: "📩",
      buttonColor: "Primary",
      allowedRoles: [],
      supportRoles: [],
      maxOpenTickets: 1,
      autoCloseHours: 0,
      transcriptEnabled: true,
    });
    setSelectedPreviewReasonIdx(0);
    setPreviewTab("panel");
    setIsPanelModalOpen(true);
  };

  const handleOpenEditPanel = (panel: any) => {
    setEditingPanel(panel);
    setPanelForm({
      ...panel,
      allowedRoles: JSON.parse(panel.allowedRoles || "[]"),
      supportRoles: JSON.parse(panel.supportRoles || "[]"),
      reasons: JSON.parse(panel.reasons || "[]"),
      questions: JSON.parse(panel.questions || "[]"),
    });
    setSelectedPreviewReasonIdx(0);
    setPreviewTab("panel");
    setIsPanelModalOpen(true);
  };

  const handleAddReason = () => {
    if (!newReasonLabel) return;
    const value = newReasonLabel.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const updated = [
      ...(panelForm.reasons || []),
      {
        label: newReasonLabel,
        value,
        emoji: newReasonEmoji || "❓",
        description: newReasonDesc || "Open ticket for this reason",
        categoryId: newReasonCat || undefined,
        questions: [],
      },
    ];
    setPanelForm({ ...panelForm, reasons: updated });
    setNewReasonLabel("");
    setNewReasonDesc("");
    setNewReasonEmoji("❓");
    setNewReasonCat("");
  };

  const handleRemoveReason = (index: number) => {
    const updated = panelForm.reasons.filter((_: any, i: number) => i !== index);
    setPanelForm({ ...panelForm, reasons: updated });
  };

  // Add question specifically to a reason
  const handleAddReasonQuestion = (reasonIndex: number) => {
    if (!reasonQTitle) return;
    const qId = `q_${Date.now()}`;
    const updatedReasons = [...panelForm.reasons];
    const targetReason = { ...updatedReasons[reasonIndex] };
    targetReason.questions = [
      ...(targetReason.questions || []),
      {
        id: qId,
        label: reasonQTitle,
        placeholder: reasonQPlaceholder || "Enter your answer...",
        style: reasonQStyle,
        required: reasonQRequired,
      },
    ];
    updatedReasons[reasonIndex] = targetReason;
    setPanelForm({ ...panelForm, reasons: updatedReasons });
    setReasonQTitle("");
    setReasonQPlaceholder("");
    setReasonQStyle("short");
    setReasonQRequired(true);
  };

  const handleRemoveReasonQuestion = (reasonIndex: number, qIndex: number) => {
    const updatedReasons = [...panelForm.reasons];
    const targetReason = { ...updatedReasons[reasonIndex] };
    targetReason.questions = targetReason.questions?.filter((_: any, i: number) => i !== qIndex) || [];
    updatedReasons[reasonIndex] = targetReason;
    setPanelForm({ ...panelForm, reasons: updatedReasons });
  };

  const handleSavePanel = async () => {
    try {
      if (editingPanel) {
        await api.patch(`/guilds/${selectedGuildId}/tickets/panels/${editingPanel.id}`, panelForm);
        showToast("Ticket panel updated successfully!", "success");
      } else {
        await api.post(`/guilds/${selectedGuildId}/tickets/panels`, panelForm);
        showToast("New ticket panel created!", "success");
      }
      setIsPanelModalOpen(false);
      fetchAllData();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to save panel", "error");
    }
  };

  const handleDeletePanel = async (panelId: string) => {
    try {
      await api.delete(`/guilds/${selectedGuildId}/tickets/panels/${panelId}`);
      showToast("Ticket panel deleted.", "info");
      fetchAllData();
    } catch (err: any) {
      showToast("Failed to delete panel.", "error");
    }
  };

  const handleDeployPanel = async (panelId: string) => {
    try {
      await api.post(`/guilds/${selectedGuildId}/tickets/panels/${panelId}/deploy`);
      showToast("🚀 Panel deployed to Discord channel!", "success");
      fetchAllData();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to deploy panel.", "error");
    }
  };

  // Category Handlers
  const handleCreateCategory = async () => {
    if (!newCatName) return;
    try {
      await api.post(`/guilds/${selectedGuildId}/tickets/categories`, {
        name: newCatName,
        description: newCatDesc,
        emoji: newCatEmoji,
      });
      showToast("Category created!", "success");
      setNewCatName("");
      setNewCatDesc("");
      fetchAllData();
    } catch (err: any) {
      showToast("Failed to create category.", "error");
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    try {
      await api.delete(`/guilds/${selectedGuildId}/tickets/categories/${catId}`);
      showToast("Category deleted.", "info");
      fetchAllData();
    } catch (err) {
      showToast("Failed to delete category.", "error");
    }
  };

  // Ticket Action Handler
  const handleTicketAction = async (ticketId: string, action: string) => {
    try {
      await api.post(`/guilds/${selectedGuildId}/tickets/${ticketId}/action`, { action });
      showToast(`Action '${action}' executed successfully.`, "success");
      if (selectedTicket && selectedTicket.id === ticketId) {
        const updated = await api.get(`/guilds/${selectedGuildId}/tickets/${ticketId}`);
        setSelectedTicket(updated.data);
      }
      fetchAllData();
    } catch (err: any) {
      showToast("Action execution failed.", "error");
    }
  };

  // Settings Handler
  const handleSaveSettings = async () => {
    try {
      await api.patch(`/guilds/${selectedGuildId}/tickets/settings`, settings);
      showToast("Ticket settings updated!", "success");
      fetchAllData();
    } catch (err) {
      showToast("Failed to save settings.", "error");
    }
  };

  // Filtered tickets
  const filteredTickets = tickets.filter((t) => {
    const matchesStatus = ticketStatusFilter === "ALL" || t.status === ticketStatusFilter;
    const matchesSearch =
      !ticketSearch ||
      t.userTag.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      t.ticketNumber.toString().includes(ticketSearch) ||
      (t.claimedByTag && t.claimedByTag.toLowerCase().includes(ticketSearch.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const paginatedTickets = filteredTickets.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage) || 1;

  const textChannels = channels.filter((c) => c.type === 0);
  const categoryChannels = channels.filter((c) => c.type === 4);

  // Determine active questions to display in preview modal tab
  const activePreviewReason = panelForm.reasons && panelForm.reasons[selectedPreviewReasonIdx];
  const activePreviewQuestions =
    activePreviewReason?.questions && activePreviewReason.questions.length > 0
      ? activePreviewReason.questions
      : panelForm.questions || [];

  return (
    <div className="flex flex-col h-full bg-[#313338] text-discord-header overflow-hidden">
      {/* Top Header & Subpage Navigation */}
      <div className="p-4 bg-[#2b2d31] border-b border-[#35373c] flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-discord-brand/20 border border-discord-brand/40 flex items-center justify-center text-discord-brand">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              Ticket System
              <span className="text-xs px-2 py-0.5 rounded-full bg-discord-brand/20 text-discord-brand border border-discord-brand/30">
                TheGodGen v1.0
              </span>
            </h1>
            <p className="text-xs text-discord-muted">
              Custom Discord Ticket Engine with Ticket-Type Modal Intake Forms & Live Embed Previews
            </p>
          </div>
        </div>

        {/* Subpages Tabs */}
        <div className="flex items-center gap-1 bg-[#1e1f22] p-1 rounded-xl border border-[#35373c]">
          {[
            { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
            { id: "panels", label: "Panels", icon: Layers },
            { id: "tickets-list", label: "Tickets", icon: ListFilter },
            { id: "categories", label: "Categories", icon: FolderTree },
            { id: "settings", label: "Settings", icon: Settings },
            { id: "logs", label: "Logs", icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubPage === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubPage(tab.id as SubPage)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-discord-brand text-white shadow"
                    : "text-discord-muted hover:text-white hover:bg-[#2b2d31]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        {/* ========================================================= */}
        {/* 1. DASHBOARD SUBPAGE */}
        {/* ========================================================= */}
        {activeSubPage === "dashboard" && (
          <div className="space-y-6">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="p-4 rounded-xl bg-[#2b2d31] border border-[#383a40] flex items-center justify-between">
                <div>
                  <span className="text-xs text-discord-muted block">Total Tickets</span>
                  <span className="text-2xl font-bold text-white font-mono">{stats.total || 0}</span>
                </div>
                <div className="p-3 rounded-xl bg-discord-brand/10 text-discord-brand">
                  <Ticket className="w-6 h-6" />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#2b2d31] border border-[#383a40] flex items-center justify-between">
                <div>
                  <span className="text-xs text-discord-muted block">Open Tickets</span>
                  <span className="text-2xl font-bold text-discord-green font-mono">{stats.open || 0}</span>
                </div>
                <div className="p-3 rounded-xl bg-discord-green/10 text-discord-green">
                  <Clock className="w-6 h-6" />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#2b2d31] border border-[#383a40] flex items-center justify-between">
                <div>
                  <span className="text-xs text-discord-muted block">Claimed Tickets</span>
                  <span className="text-2xl font-bold text-sky-400 font-mono">{stats.claimed || 0}</span>
                </div>
                <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400">
                  <UserCheck className="w-6 h-6" />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#2b2d31] border border-[#383a40] flex items-center justify-between">
                <div>
                  <span className="text-xs text-discord-muted block">Closed Tickets</span>
                  <span className="text-2xl font-bold text-discord-red font-mono">{stats.closed || 0}</span>
                </div>
                <div className="p-3 rounded-xl bg-discord-red/10 text-discord-red">
                  <Lock className="w-6 h-6" />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#2b2d31] border border-[#383a40] flex items-center justify-between">
                <div>
                  <span className="text-xs text-discord-muted block">Active Panels</span>
                  <span className="text-2xl font-bold text-amber-400 font-mono">{stats.panelsCount || 0}</span>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
                  <Layers className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Quick Actions & Recent Activity Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Quick Actions */}
              <div className="p-5 rounded-xl bg-[#2b2d31] border border-[#383a40] space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider text-discord-muted">
                  Quick Actions
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={handleOpenCreatePanel}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-[#1e1f22] border border-[#35373c] hover:border-discord-brand hover:bg-[#232428] text-white text-sm font-medium transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-discord-brand" /> Create New Ticket Panel
                    </span>
                    <span className="text-xs text-discord-muted">Deploy</span>
                  </button>

                  <button
                    onClick={() => setActiveSubPage("settings")}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-[#1e1f22] border border-[#35373c] hover:border-discord-brand hover:bg-[#232428] text-white text-sm font-medium transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-sky-400" /> Ticket Settings
                    </span>
                    <span className="text-xs text-discord-muted">Config</span>
                  </button>

                  <button
                    onClick={() => setActiveSubPage("logs")}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-[#1e1f22] border border-[#35373c] hover:border-discord-brand hover:bg-[#232428] text-white text-sm font-medium transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <History className="w-4 h-4 text-emerald-400" /> View Audit Logs
                    </span>
                    <span className="text-xs text-discord-muted">Audit</span>
                  </button>
                </div>
              </div>

              {/* Recent Ticket Activity */}
              <div className="lg:col-span-2 p-5 rounded-xl bg-[#2b2d31] border border-[#383a40] space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider text-discord-muted">
                  Recent Ticket Activity
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {logs.length === 0 ? (
                    <p className="text-xs text-discord-muted py-6 text-center">No ticket activity logged yet.</p>
                  ) : (
                    logs.slice(0, 5).map((log: any) => (
                      <div key={log.id} className="flex items-center justify-between p-3 rounded-xl bg-[#1e1f22] border border-[#35373c]">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-bold text-discord-brand">#{log.ticketNumber}</span>
                          <div>
                            <span className="text-xs font-semibold text-white block">{log.action}</span>
                            <span className="text-[11px] text-discord-muted">{log.details || `Executed by ${log.executorTag}`}</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-discord-muted font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 2. PANELS SUBPAGE */}
        {/* ========================================================= */}
        {activeSubPage === "panels" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Ticket Panels</h2>
                <p className="text-xs text-discord-muted">Configure and deploy interactive ticket creation embeds with intake forms per ticket type.</p>
              </div>
              <button
                onClick={handleOpenCreatePanel}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-discord-brand hover:bg-discord-brandHover text-white font-bold text-sm shadow transition-all transform hover:scale-[1.02]"
              >
                <Plus className="w-4 h-4" /> Create Panel
              </button>
            </div>

            {/* Panels List Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {panels.map((panel) => {
                const reasonsList: TicketReason[] = JSON.parse(panel.reasons || "[]");
                const totalReasonQuestions = reasonsList.reduce((acc, r) => acc + (r.questions?.length || 0), 0);
                return (
                  <div key={panel.id} className="p-5 rounded-xl bg-[#2b2d31] border border-[#383a40] space-y-4 relative overflow-hidden">
                    <div className="w-full h-1.5 absolute top-0 left-0" style={{ backgroundColor: panel.embedColor || "#5865F2" }} />
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-base font-bold text-white">{panel.name}</h3>
                        <p className="text-xs text-discord-muted line-clamp-1">{panel.description || "No description."}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {reasonsList.length > 0 ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            📋 {reasonsList.length} Ticket Types
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1e1f22] text-discord-brand border border-[#35373c]">
                            {panel.buttonColor} Button
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-discord-muted bg-[#1e1f22] p-3 rounded-lg border border-[#35373c]">
                      <div className="flex justify-between">
                        <span>Target Channel:</span>
                        <strong className="text-white font-mono">
                          #{channels.find((c) => c.id === panel.channelId)?.name || panel.channelId || "Not set"}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Pre-Ticket Questions:</span>
                        <strong className="text-white">
                          {totalReasonQuestions > 0 ? `${totalReasonQuestions} Questions configured` : "Standard Ticket"}
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => handleDeployPanel(panel.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-discord-brand hover:bg-discord-brandHover text-white font-bold text-xs shadow transition-all"
                      >
                        <Send className="w-3.5 h-3.5" /> Deploy Panel
                      </button>
                      <button
                        onClick={() => handleOpenEditPanel(panel)}
                        className="p-2 rounded-lg bg-[#1e1f22] hover:bg-[#35373c] text-discord-muted hover:text-white transition-colors"
                        title="Edit Panel"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePanel(panel.id)}
                        className="p-2 rounded-lg bg-[#1e1f22] hover:bg-discord-red/20 text-discord-muted hover:text-discord-red transition-colors"
                        title="Delete Panel"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 3. TICKETS LIST SUBPAGE */}
        {/* ========================================================= */}
        {activeSubPage === "tickets-list" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1e1f22] border border-[#35373c] text-xs">
                  <Search className="w-3.5 h-3.5 text-discord-muted" />
                  <input
                    type="text"
                    placeholder="Search creator, #number, claimer..."
                    value={ticketSearch}
                    onChange={(e) => {
                      setTicketSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-transparent border-none outline-none text-white text-xs w-48 focus:w-60 transition-all"
                  />
                </div>

                <div className="flex items-center gap-1 bg-[#1e1f22] p-1 rounded-lg border border-[#35373c] text-xs">
                  {["ALL", "OPEN", "CLAIMED", "CLOSED"].map((st) => (
                    <button
                      key={st}
                      onClick={() => {
                        setTicketStatusFilter(st);
                        setCurrentPage(1);
                      }}
                      className={`px-3 py-1 rounded font-semibold transition-colors ${
                        ticketStatusFilter === st
                          ? "bg-discord-brand text-white"
                          : "text-discord-muted hover:text-white"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <span className="text-xs text-discord-muted font-mono">
                Showing {filteredTickets.length} tickets
              </span>
            </div>

            {/* Tickets Table */}
            <div className="bg-[#2b2d31] rounded-xl border border-[#383a40] overflow-hidden shadow-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1e1f22] text-discord-muted font-bold uppercase tracking-wider border-b border-[#35373c]">
                  <tr>
                    <th className="p-3">Ticket</th>
                    <th className="p-3">Creator</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Claimed By</th>
                    <th className="p-3">Created At</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#35373c]/40 font-mono">
                  {paginatedTickets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-discord-muted">
                        No tickets match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedTickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-[#18191c]/50 transition-colors">
                        <td className="p-3 font-bold text-discord-brand">#{ticket.ticketNumber}</td>
                        <td className="p-3 font-sans text-white font-medium flex items-center gap-2">
                          {ticket.userAvatar && <img src={ticket.userAvatar} className="w-5 h-5 rounded-full" alt="" />}
                          <span>{ticket.userTag}</span>
                        </td>
                        <td className="p-3 font-sans">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              ticket.status === "OPEN"
                                ? "bg-discord-green/20 text-discord-green"
                                : ticket.status === "CLAIMED"
                                ? "bg-sky-500/20 text-sky-400"
                                : "bg-discord-red/20 text-discord-red"
                            }`}
                          >
                            {ticket.status}
                          </span>
                        </td>
                        <td className="p-3 font-sans text-discord-muted">
                          {ticket.claimedByTag ? (
                            <span className="text-sky-400 font-medium">👤 {ticket.claimedByTag}</span>
                          ) : (
                            "--"
                          )}
                        </td>
                        <td className="p-3 text-discord-muted">{new Date(ticket.createdAt).toLocaleString()}</td>
                        <td className="p-3 text-right font-sans">
                          <button
                            onClick={() => setSelectedTicket(ticket)}
                            className="px-2.5 py-1 rounded bg-[#1e1f22] hover:bg-[#35373c] text-white text-xs font-semibold transition-colors flex items-center gap-1 ml-auto"
                          >
                            <Eye className="w-3.5 h-3.5" /> Inspect
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 4. CATEGORIES SUBPAGE */}
        {/* ========================================================= */}
        {activeSubPage === "categories" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Create Category Form */}
              <div className="p-5 rounded-xl bg-[#2b2d31] border border-[#383a40] space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider text-discord-muted">
                  Add Ticket Category
                </h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-discord-muted mb-1 font-semibold">Category Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Technical Support"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="w-full p-2.5 rounded-lg bg-[#1e1f22] border border-[#35373c] text-white outline-none focus:border-discord-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-discord-muted mb-1 font-semibold">Emoji</label>
                    <input
                      type="text"
                      placeholder="🎫"
                      value={newCatEmoji}
                      onChange={(e) => setNewCatEmoji(e.target.value)}
                      className="w-full p-2.5 rounded-lg bg-[#1e1f22] border border-[#35373c] text-white outline-none focus:border-discord-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-discord-muted mb-1 font-semibold">Description</label>
                    <textarea
                      placeholder="Short category description..."
                      value={newCatDesc}
                      onChange={(e) => setNewCatDesc(e.target.value)}
                      className="w-full p-2.5 rounded-lg bg-[#1e1f22] border border-[#35373c] text-white outline-none focus:border-discord-brand h-20"
                    />
                  </div>
                  <button
                    onClick={handleCreateCategory}
                    className="w-full py-2.5 rounded-xl bg-discord-brand hover:bg-discord-brandHover text-white font-bold text-xs shadow transition-all"
                  >
                    Save Category
                  </button>
                </div>
              </div>

              {/* Categories List */}
              <div className="md:col-span-2 space-y-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider text-discord-muted">
                  Configured Categories
                </h3>
                <div className="space-y-2">
                  {categories.length === 0 ? (
                    <p className="text-xs text-discord-muted p-6 bg-[#2b2d31] rounded-xl border border-[#383a40] text-center">
                      No custom ticket categories created yet.
                    </p>
                  ) : (
                    categories.map((cat) => (
                      <div key={cat.id} className="flex items-center justify-between p-4 rounded-xl bg-[#2b2d31] border border-[#383a40]">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{cat.emoji || "🎫"}</span>
                          <div>
                            <h4 className="text-sm font-bold text-white">{cat.name}</h4>
                            <p className="text-xs text-discord-muted">{cat.description || "No description."}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="p-2 rounded-lg bg-[#1e1f22] hover:bg-discord-red/20 text-discord-muted hover:text-discord-red transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 5. SETTINGS SUBPAGE */}
        {/* ========================================================= */}
        {activeSubPage === "settings" && (
          <div className="max-w-3xl space-y-6">
            <div className="p-6 rounded-xl bg-[#2b2d31] border border-[#383a40] space-y-6">
              <h2 className="text-base font-bold text-white">Global Ticket Settings</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Naming Format */}
                <div>
                  <label className="block text-discord-muted mb-1.5 font-semibold">Ticket Channel Naming Format</label>
                  <select
                    value={settings.namingFormat}
                    onChange={(e) => setSettings({ ...settings, namingFormat: e.target.value })}
                    className="w-full p-2.5 rounded-lg bg-[#1e1f22] border border-[#35373c] text-white outline-none focus:border-discord-brand"
                  >
                    <option value="ticket-{username}">ticket-username (e.g. ticket-john)</option>
                    <option value="{username}-ticket">username-ticket (e.g. john-ticket)</option>
                    <option value="ticket-{number}">ticket-0001 (Sequential Numbering)</option>
                  </select>
                </div>

                {/* Default Category */}
                <div>
                  <label className="block text-discord-muted mb-1.5 font-semibold">Default Channel Category</label>
                  <select
                    value={settings.defaultCategoryId || ""}
                    onChange={(e) => setSettings({ ...settings, defaultCategoryId: e.target.value })}
                    className="w-full p-2.5 rounded-lg bg-[#1e1f22] border border-[#35373c] text-white outline-none focus:border-discord-brand"
                  >
                    <option value="">-- Select Category --</option>
                    {categoryChannels.map((c) => (
                      <option key={c.id} value={c.id}>
                        📁 {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Transcript Log Channel */}
                <div>
                  <label className="block text-discord-muted mb-1.5 font-semibold">Transcript Log Channel</label>
                  <select
                    value={settings.logChannelId || ""}
                    onChange={(e) => setSettings({ ...settings, logChannelId: e.target.value })}
                    className="w-full p-2.5 rounded-lg bg-[#1e1f22] border border-[#35373c] text-white outline-none focus:border-discord-brand"
                  >
                    <option value="">-- Select Text Channel --</option>
                    {textChannels.map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Delete Delay */}
                <div>
                  <label className="block text-discord-muted mb-1.5 font-semibold">
                    Delete Countdown Delay ({settings.deleteDelaySeconds}s)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    value={settings.deleteDelaySeconds}
                    onChange={(e) => setSettings({ ...settings, deleteDelaySeconds: Number(e.target.value) })}
                    className="w-full accent-discord-brand"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-2 text-xs">
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-[#1e1f22] border border-[#35373c]">
                  <input
                    type="checkbox"
                    checked={settings.closeConfirmation}
                    onChange={(e) => setSettings({ ...settings, closeConfirmation: e.target.checked })}
                    className="w-4 h-4 accent-discord-brand"
                  />
                  <div>
                    <span className="font-semibold text-white block">Require Close Confirmation</span>
                    <span className="text-discord-muted text-[11px]">Prompt users with a confirmation modal before closing tickets.</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-[#1e1f22] border border-[#35373c]">
                  <input
                    type="checkbox"
                    checked={settings.autoArchive}
                    onChange={(e) => setSettings({ ...settings, autoArchive: e.target.checked })}
                    className="w-4 h-4 accent-discord-brand"
                  />
                  <div>
                    <span className="font-semibold text-white block">Auto Archive Closed Tickets</span>
                    <span className="text-discord-muted text-[11px]">Automatically archive closed ticket channels after 24h.</span>
                  </div>
                </label>
              </div>

              <button
                onClick={handleSaveSettings}
                className="px-6 py-2.5 rounded-xl bg-discord-brand hover:bg-discord-brandHover text-white font-bold text-xs shadow transition-all"
              >
                Save Ticket Settings
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 6. LOGS SUBPAGE */}
        {/* ========================================================= */}
        {activeSubPage === "logs" && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-white">Ticket Audit Logs</h2>
            <div className="bg-[#2b2d31] rounded-xl border border-[#383a40] overflow-hidden shadow-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1e1f22] text-discord-muted font-bold uppercase tracking-wider border-b border-[#35373c]">
                  <tr>
                    <th className="p-3">Action</th>
                    <th className="p-3">Ticket</th>
                    <th className="p-3">Executor</th>
                    <th className="p-3">Details</th>
                    <th className="p-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#35373c]/40 font-mono">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-discord-muted">No ticket audit logs recorded.</td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#18191c]/50">
                        <td className="p-3 font-sans font-bold text-discord-header">
                          <span className="px-2 py-0.5 rounded bg-[#1e1f22] border border-[#35373c] text-discord-brand text-[10px]">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-discord-brand">#{log.ticketNumber}</td>
                        <td className="p-3 font-sans text-white">{log.executorTag}</td>
                        <td className="p-3 font-sans text-discord-muted">{log.details || "--"}</td>
                        <td className="p-3 text-right text-discord-muted">{new Date(log.timestamp).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* PANEL EDITOR MODAL WITH PER-TICKET-REASON QUESTION BUILDER */}
      {/* ========================================================= */}
      {isPanelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#2b2d31] border border-[#383a40] rounded-2xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 bg-[#1e1f22] border-b border-[#35373c] flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-discord-brand" />
                {editingPanel ? "Edit Ticket Panel & Ticket-Type Form Questions" : "Create New Ticket Panel"}
              </h3>
              <button
                onClick={() => setIsPanelModalOpen(false)}
                className="text-discord-muted hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Form (Left) & Live Embed Preview (Right) */}
            <div className="flex-1 p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
              {/* Form Inputs (7 Cols) */}
              <div className="lg:col-span-7 space-y-5">
                {/* 1. Basic Panel Settings */}
                <div className="space-y-3 bg-[#1e1f22] p-4 rounded-xl border border-[#35373c]">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider text-discord-brand">1. Basic Panel Settings</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-discord-muted mb-1 font-semibold">Panel Name</label>
                      <input
                        type="text"
                        value={panelForm.name}
                        onChange={(e) => setPanelForm({ ...panelForm, name: e.target.value })}
                        className="w-full p-2.5 rounded-lg bg-[#2b2d31] border border-[#35373c] text-white outline-none focus:border-discord-brand"
                      />
                    </div>
                    <div>
                      <label className="block text-discord-muted mb-1 font-semibold">Target Channel</label>
                      <select
                        value={panelForm.channelId}
                        onChange={(e) => setPanelForm({ ...panelForm, channelId: e.target.value })}
                        className="w-full p-2.5 rounded-lg bg-[#2b2d31] border border-[#35373c] text-white outline-none focus:border-discord-brand"
                      >
                        <option value="">-- Select Channel --</option>
                        {textChannels.map((c) => (
                          <option key={c.id} value={c.id}>
                            #{c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. Multiple Ticket Reasons & Per-Type Form Questions */}
                <div className="space-y-3 bg-[#1e1f22] p-4 rounded-xl border border-[#35373c]">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-white text-xs uppercase tracking-wider text-discord-brand flex items-center gap-1.5">
                      2. Ticket Types & Custom Intake Questions
                    </h4>
                    <span className="text-[10px] text-discord-muted font-mono">{panelForm.reasons?.length || 0} Ticket Types</span>
                  </div>
                  <p className="text-[11px] text-discord-muted">
                    Each ticket type can have its own specific modal questions asked before creating the channel (e.g. Bug Report asks for reproduction steps, Billing asks for transaction ID).
                  </p>

                  {/* Reasons List */}
                  <div className="space-y-3">
                    {panelForm.reasons && panelForm.reasons.length > 0 ? (
                      panelForm.reasons.map((r: TicketReason, idx: number) => {
                        const isExpanded = expandedReasonIdx === idx;
                        const reasonQuestions = r.questions || [];
                        return (
                          <div key={idx} className="rounded-lg bg-[#2b2d31] border border-[#35373c] overflow-hidden">
                            <div className="p-3 flex items-center justify-between bg-[#232428]">
                              <div className="flex items-center gap-2">
                                <span className="text-base">{r.emoji}</span>
                                <div>
                                  <span className="font-bold text-white block">{r.label}</span>
                                  <span className="text-[10px] text-discord-muted">{r.description}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setExpandedReasonIdx(isExpanded ? null : idx);
                                    setSelectedPreviewReasonIdx(idx);
                                  }}
                                  className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${
                                    reasonQuestions.length > 0
                                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                      : "bg-[#1e1f22] text-discord-muted border border-[#35373c] hover:text-white"
                                  }`}
                                >
                                  <span>📋 {reasonQuestions.length} Questions</span>
                                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>
                                <button
                                  onClick={() => handleRemoveReason(idx)}
                                  className="p-1 text-discord-muted hover:text-discord-red transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Accordion Body: Questions Builder for THIS Ticket Reason */}
                            {isExpanded && (
                              <div className="p-4 bg-[#1e1f22] border-t border-[#35373c] space-y-3">
                                <span className="font-semibold text-emerald-400 text-[11px] block uppercase tracking-wider">
                                  Questions for: {r.label}
                                </span>

                                {/* Existing Questions for this reason */}
                                <div className="space-y-2">
                                  {reasonQuestions.length > 0 ? (
                                    reasonQuestions.map((rq: IntakeQuestion, qIdx: number) => (
                                      <div key={rq.id} className="flex items-center justify-between p-2.5 rounded bg-[#2b2d31] border border-[#35373c]">
                                        <div className="flex items-center gap-2">
                                          <span className="w-4 h-4 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[9px] flex items-center justify-center">
                                            Q{qIdx + 1}
                                          </span>
                                          <div>
                                            <span className="font-bold text-white block">{rq.label}</span>
                                            <span className="text-[10px] text-discord-muted">
                                              {rq.style} • {rq.required ? "Required" : "Optional"}
                                            </span>
                                          </div>
                                        </div>
                                        <button
                                          onClick={() => handleRemoveReasonQuestion(idx, qIdx)}
                                          className="p-1 text-discord-muted hover:text-discord-red"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-[11px] text-discord-muted italic">No specific questions for this ticket type yet.</p>
                                  )}
                                </div>

                                {/* Add Question Form for this specific reason */}
                                {reasonQuestions.length < 5 && (
                                  <div className="pt-2 border-t border-[#35373c] space-y-2">
                                    <span className="font-semibold text-white text-[11px] block">Add Question to {r.label}</span>
                                    <div className="grid grid-cols-2 gap-2">
                                      <input
                                        type="text"
                                        placeholder="Question (e.g. Transaction ID)"
                                        value={reasonQTitle}
                                        onChange={(e) => setReasonQTitle(e.target.value)}
                                        className="p-2 rounded bg-[#2b2d31] border border-[#35373c] text-white text-xs outline-none focus:border-discord-brand"
                                      />
                                      <input
                                        type="text"
                                        placeholder="Placeholder (e.g. TX-123)"
                                        value={reasonQPlaceholder}
                                        onChange={(e) => setReasonQPlaceholder(e.target.value)}
                                        className="p-2 rounded bg-[#2b2d31] border border-[#35373c] text-white text-xs outline-none focus:border-discord-brand"
                                      />
                                    </div>
                                    <div className="flex items-center gap-4 text-[11px]">
                                      <label className="flex items-center gap-1 text-discord-muted font-semibold cursor-pointer">
                                        <input
                                          type="radio"
                                          name={`rqstyle_${idx}`}
                                          checked={reasonQStyle === "short"}
                                          onChange={() => setReasonQStyle("short")}
                                          className="accent-discord-brand"
                                        />
                                        Single Line
                                      </label>
                                      <label className="flex items-center gap-1 text-discord-muted font-semibold cursor-pointer">
                                        <input
                                          type="radio"
                                          name={`rqstyle_${idx}`}
                                          checked={reasonQStyle === "paragraph"}
                                          onChange={() => setReasonQStyle("paragraph")}
                                          className="accent-discord-brand"
                                        />
                                        Multi Line
                                      </label>
                                      <label className="flex items-center gap-1 text-discord-muted font-semibold cursor-pointer ml-auto">
                                        <input
                                          type="checkbox"
                                          checked={reasonQRequired}
                                          onChange={(e) => setReasonQRequired(e.target.checked)}
                                          className="accent-discord-brand"
                                        />
                                        Required
                                      </label>
                                    </div>
                                    <button
                                      onClick={() => handleAddReasonQuestion(idx)}
                                      className="px-3 py-1 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold text-xs hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-1"
                                    >
                                      <Plus className="w-3.5 h-3.5" /> Add Question to {r.label}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-[11px] text-discord-muted italic">No ticket types added. The panel will display a single button.</p>
                    )}
                  </div>

                  {/* Add Reason Form */}
                  <div className="pt-2 border-t border-[#35373c] space-y-2">
                    <span className="font-semibold text-white text-[11px] block">Add New Ticket Type</span>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Label (e.g. Bug Report)"
                        value={newReasonLabel}
                        onChange={(e) => setNewReasonLabel(e.target.value)}
                        className="p-2 rounded bg-[#2b2d31] border border-[#35373c] text-white text-xs outline-none focus:border-discord-brand"
                      />
                      <input
                        type="text"
                        placeholder="Emoji (e.g. 🐛)"
                        value={newReasonEmoji}
                        onChange={(e) => setNewReasonEmoji(e.target.value)}
                        className="p-2 rounded bg-[#2b2d31] border border-[#35373c] text-white text-xs outline-none focus:border-discord-brand"
                      />
                      <input
                        type="text"
                        placeholder="Short description..."
                        value={newReasonDesc}
                        onChange={(e) => setNewReasonDesc(e.target.value)}
                        className="p-2 rounded bg-[#2b2d31] border border-[#35373c] text-white text-xs outline-none focus:border-discord-brand"
                      />
                    </div>
                    <button
                      onClick={handleAddReason}
                      className="px-3 py-1.5 rounded-lg bg-discord-brand/20 border border-discord-brand/40 text-discord-brand font-bold text-xs hover:bg-discord-brand hover:text-white transition-all flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Ticket Type
                    </button>
                  </div>
                </div>

                {/* 3. Panel Embed Customization */}
                <div className="space-y-3 bg-[#1e1f22] p-4 rounded-xl border border-[#35373c]">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider text-discord-brand">3. Panel Embed & Banner Images</h4>

                  <div>
                    <label className="block text-discord-muted mb-1 font-semibold">Embed Title</label>
                    <input
                      type="text"
                      value={panelForm.embedTitle}
                      onChange={(e) => setPanelForm({ ...panelForm, embedTitle: e.target.value })}
                      className="w-full p-2.5 rounded-lg bg-[#2b2d31] border border-[#35373c] text-white outline-none focus:border-discord-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-discord-muted mb-1 font-semibold">Embed Description</label>
                    <textarea
                      value={panelForm.embedDescription}
                      onChange={(e) => setPanelForm({ ...panelForm, embedDescription: e.target.value })}
                      className="w-full p-2.5 rounded-lg bg-[#2b2d31] border border-[#35373c] text-white outline-none focus:border-discord-brand h-16"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-discord-muted mb-1 font-semibold">Thumbnail URL (Icon Top Right)</label>
                      <input
                        type="text"
                        placeholder="https://..."
                        value={panelForm.thumbnail || ""}
                        onChange={(e) => setPanelForm({ ...panelForm, thumbnail: e.target.value })}
                        className="w-full p-2 rounded-lg bg-[#2b2d31] border border-[#35373c] text-white font-mono outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-discord-muted mb-1 font-semibold">Large Banner Image URL</label>
                      <input
                        type="text"
                        placeholder="https://..."
                        value={panelForm.image || ""}
                        onChange={(e) => setPanelForm({ ...panelForm, image: e.target.value })}
                        className="w-full p-2 rounded-lg bg-[#2b2d31] border border-[#35373c] text-white font-mono outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-discord-muted mb-1 font-semibold">Embed Color Hex</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={panelForm.embedColor}
                          onChange={(e) => setPanelForm({ ...panelForm, embedColor: e.target.value })}
                          className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                        />
                        <input
                          type="text"
                          value={panelForm.embedColor}
                          onChange={(e) => setPanelForm({ ...panelForm, embedColor: e.target.value })}
                          className="w-full p-2 rounded-lg bg-[#2b2d31] border border-[#35373c] text-white font-mono outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-discord-muted mb-1 font-semibold">Footer Text</label>
                      <input
                        type="text"
                        value={panelForm.footer}
                        onChange={(e) => setPanelForm({ ...panelForm, footer: e.target.value })}
                        className="w-full p-2.5 rounded-lg bg-[#2b2d31] border border-[#35373c] text-white outline-none focus:border-discord-brand"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Welcome Embed Customization inside Ticket */}
                <div className="space-y-3 bg-[#1e1f22] p-4 rounded-xl border border-[#35373c]">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider text-emerald-400">4. Ticket Welcome Message & Images</h4>

                  <div>
                    <label className="block text-discord-muted mb-1 font-semibold">Welcome Embed Title</label>
                    <input
                      type="text"
                      value={panelForm.welcomeTitle || ""}
                      onChange={(e) => setPanelForm({ ...panelForm, welcomeTitle: e.target.value })}
                      className="w-full p-2.5 rounded-lg bg-[#2b2d31] border border-[#35373c] text-white outline-none focus:border-discord-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-discord-muted mb-1 font-semibold">Welcome Embed Description</label>
                    <textarea
                      value={panelForm.welcomeDescription || ""}
                      onChange={(e) => setPanelForm({ ...panelForm, welcomeDescription: e.target.value })}
                      className="w-full p-2.5 rounded-lg bg-[#2b2d31] border border-[#35373c] text-white outline-none focus:border-discord-brand h-16"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Live Discord Mockups (5 Cols) */}
              <div className="lg:col-span-5 space-y-3 bg-[#1e1f22] p-5 rounded-xl border border-[#35373c] flex flex-col">
                <div className="flex items-center justify-between border-b border-[#35373c] pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-discord-muted">
                    Interactive Discord Preview
                  </span>

                  <div className="flex items-center gap-1 bg-[#2b2d31] p-1 rounded-lg border border-[#35373c]">
                    <button
                      onClick={() => setPreviewTab("panel")}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                        previewTab === "panel" ? "bg-discord-brand text-white" : "text-discord-muted hover:text-white"
                      }`}
                    >
                      Panel
                    </button>
                    <button
                      onClick={() => setPreviewTab("questions")}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                        previewTab === "questions" ? "bg-purple-600 text-white" : "text-discord-muted hover:text-white"
                      }`}
                    >
                      Form Modal
                    </button>
                    <button
                      onClick={() => setPreviewTab("welcome")}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                        previewTab === "welcome" ? "bg-emerald-600 text-white" : "text-discord-muted hover:text-white"
                      }`}
                    >
                      Welcome
                    </button>
                  </div>
                </div>

                {/* Discord Message Mockup Container */}
                <div className="flex-1 bg-[#313338] p-4 rounded-xl border border-[#383a40] space-y-3 font-sans overflow-y-auto max-h-[600px]">
                  {/* Bot Author Header */}
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-discord-brand flex items-center justify-center font-bold text-white text-xs">
                      TGG
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white flex items-center gap-1">
                        TheGodGen Bot <span className="bg-discord-brand text-white text-[9px] px-1 rounded font-semibold">BOT</span>
                      </span>
                      <span className="text-[10px] text-discord-muted">Today at 12:00 PM</span>
                    </div>
                  </div>

                  {/* Panel Embed Preview Tab */}
                  {previewTab === "panel" && (
                    <div className="space-y-3">
                      <div
                        className="p-3.5 rounded-lg bg-[#2b2d31] space-y-2 border-l-4 relative overflow-hidden"
                        style={{ borderColor: panelForm.embedColor || "#5865F2" }}
                      >
                        {panelForm.thumbnail && (
                          <img src={panelForm.thumbnail} alt="" className="w-16 h-16 rounded-md object-cover absolute top-3 right-3 border border-[#35373c]" />
                        )}

                        {panelForm.embedTitle && (
                          <h4 className="text-sm font-bold text-white pr-16">{panelForm.embedTitle}</h4>
                        )}
                        {panelForm.embedDescription && (
                          <p className="text-xs text-[#dbdee1] whitespace-pre-wrap leading-relaxed">
                            {panelForm.embedDescription}
                          </p>
                        )}

                        {panelForm.image && (
                          <div className="pt-2">
                            <img src={panelForm.image} alt="Banner" className="w-full max-h-40 object-cover rounded-md border border-[#35373c]" />
                          </div>
                        )}

                        {panelForm.footer && (
                          <span className="text-[10px] text-discord-muted block pt-1 border-t border-[#35373c]">
                            {panelForm.footer}
                          </span>
                        )}
                      </div>

                      {/* Dropdown Reasons Preview */}
                      {panelForm.reasons && panelForm.reasons.length > 0 && (
                        <div className="p-2.5 rounded-md bg-[#2b2d31] border border-[#35373c] flex items-center justify-between text-xs text-discord-muted">
                          <span>Select a ticket reason...</span>
                          <ChevronDown className="w-4 h-4" />
                        </div>
                      )}

                      {/* Button Mockup */}
                      <div className="pt-1">
                        <button
                          disabled
                          className={`flex items-center gap-1.5 px-4 py-2 rounded font-semibold text-xs text-white shadow opacity-90 ${
                            panelForm.buttonColor === "Success"
                              ? "bg-discord-green"
                              : panelForm.buttonColor === "Danger"
                              ? "bg-discord-red"
                              : panelForm.buttonColor === "Secondary"
                              ? "bg-[#4e5058]"
                              : "bg-discord-brand"
                          }`}
                        >
                          <span>{panelForm.buttonEmoji}</span>
                          <span>{panelForm.buttonText || "Create Ticket"}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Form Questions Modal Preview Tab */}
                  {previewTab === "questions" && (
                    <div className="bg-[#2b2d31] p-4 rounded-xl border border-[#35373c] space-y-3">
                      {/* Ticket Reason Selector for Preview */}
                      {panelForm.reasons && panelForm.reasons.length > 0 && (
                        <div className="pb-2 border-b border-[#35373c]">
                          <label className="text-[10px] font-bold text-discord-muted block mb-1">Preview Ticket Type:</label>
                          <select
                            value={selectedPreviewReasonIdx}
                            onChange={(e) => setSelectedPreviewReasonIdx(Number(e.target.value))}
                            className="w-full p-1.5 rounded bg-[#1e1f22] border border-[#35373c] text-white text-xs font-bold"
                          >
                            {panelForm.reasons.map((r: TicketReason, idx: number) => (
                              <option key={idx} value={idx}>
                                {r.emoji} {r.label} ({r.questions?.length || 0} questions)
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs">
                          {activePreviewReason ? `${activePreviewReason.emoji} ${activePreviewReason.label}` : panelForm.embedTitle || "Ticket Form"}
                        </span>
                        <span className="text-discord-muted text-xs">✕</span>
                      </div>

                      {activePreviewQuestions.length > 0 ? (
                        activePreviewQuestions.map((q: IntakeQuestion, idx: number) => (
                          <div key={idx} className="space-y-1">
                            <label className="text-[11px] font-semibold text-discord-muted block">
                              {q.label} {q.required && <span className="text-discord-red">*</span>}
                            </label>
                            {q.style === "paragraph" ? (
                              <div className="p-2 rounded bg-[#1e1f22] border border-[#35373c] text-discord-muted text-[10px] h-14">
                                {q.placeholder}
                              </div>
                            ) : (
                              <div className="p-2 rounded bg-[#1e1f22] border border-[#35373c] text-discord-muted text-[10px]">
                                {q.placeholder}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-discord-muted py-4 text-center">No questions configured for this ticket type.</p>
                      )}

                      <button disabled className="w-full py-2 bg-discord-brand text-white font-bold text-xs rounded opacity-90">
                        Submit Ticket Information
                      </button>
                    </div>
                  )}

                  {/* Welcome Embed Preview Tab */}
                  {previewTab === "welcome" && (
                    <div className="space-y-3">
                      <div
                        className="p-3.5 rounded-lg bg-[#2b2d31] space-y-2 border-l-4 relative overflow-hidden"
                        style={{ borderColor: panelForm.welcomeColor || "#5865F2" }}
                      >
                        <h4 className="text-sm font-bold text-white pr-14">
                          {panelForm.welcomeTitle || "👋 Welcome to your ticket!"}
                        </h4>
                        <p className="text-xs text-[#dbdee1] whitespace-pre-wrap leading-relaxed">
                          {panelForm.welcomeDescription || "Support staff will be with you shortly."}
                        </p>

                        {activePreviewQuestions.length > 0 && (
                          <div className="p-2.5 rounded bg-[#1e1f22] border border-[#35373c] text-[11px] space-y-1.5">
                            <span className="font-bold text-discord-brand block">📋 Submitted Intake Form ({activePreviewReason?.label || "General"})</span>
                            {activePreviewQuestions.map((q: IntakeQuestion, idx: number) => (
                              <div key={idx}>
                                <strong className="text-white">{q.label}:</strong>
                                <span className="text-discord-muted block pl-2">{q.placeholder}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <span className="text-[10px] text-discord-muted block pt-1 border-t border-[#35373c]">
                          {panelForm.welcomeFooter || "TheGodGen Ticket Engine"}
                        </span>
                      </div>

                      {/* Ticket Control Buttons Row */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <button disabled className="px-2.5 py-1 rounded bg-[#4e5058] text-white text-[11px] font-semibold">🔒 Close</button>
                        <button disabled className="px-2.5 py-1 rounded bg-discord-brand text-white text-[11px] font-semibold">👤 Claim</button>
                        <button disabled className="px-2.5 py-1 rounded bg-[#4e5058] text-white text-[11px] font-semibold">➕ Add</button>
                        <button disabled className="px-2.5 py-1 rounded bg-[#4e5058] text-white text-[11px] font-semibold">📄 Transcript</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#1e1f22] border-t border-[#35373c] flex items-center justify-end gap-3">
              <button
                onClick={() => setIsPanelModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-[#2b2d31] hover:bg-[#35373c] text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePanel}
                className="px-5 py-2 rounded-lg bg-discord-brand hover:bg-discord-brandHover text-white text-xs font-bold shadow"
              >
                Save Panel & Form Questions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TICKET DETAIL INSPECTOR MODAL */}
      {/* ========================================================= */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#2b2d31] border border-[#383a40] rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#35373c] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Ticket className="w-5 h-5 text-discord-brand" />
                Ticket #{selectedTicket.ticketNumber} Details
              </h3>
              <button onClick={() => setSelectedTicket(null)} className="text-discord-muted hover:text-white">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs bg-[#1e1f22] p-4 rounded-xl border border-[#35373c]">
              <div>
                <span className="text-discord-muted block">Creator:</span>
                <span className="text-white font-bold">{selectedTicket.userTag}</span>
              </div>
              <div>
                <span className="text-discord-muted block">Status:</span>
                <span className="font-bold text-discord-green">{selectedTicket.status}</span>
              </div>
              <div>
                <span className="text-discord-muted block">Claimed By:</span>
                <span className="text-white font-medium">{selectedTicket.claimedByTag || "Unclaimed"}</span>
              </div>
              <div>
                <span className="text-discord-muted block">Created At:</span>
                <span className="text-white">{new Date(selectedTicket.createdAt).toLocaleString()}</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={() => handleTicketAction(selectedTicket.id, "close")}
                className="px-3 py-1.5 rounded-lg bg-discord-red/20 hover:bg-discord-red/30 text-discord-red text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" /> Close Ticket
              </button>
              <button
                onClick={() => handleTicketAction(selectedTicket.id, "reopen")}
                className="px-3 py-1.5 rounded-lg bg-discord-green/20 hover:bg-discord-green/30 text-discord-green text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Unlock className="w-3.5 h-3.5" /> Reopen Ticket
              </button>
              <button
                onClick={() => handleTicketAction(selectedTicket.id, "transcript")}
                className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" /> Generate Transcript
              </button>
              {selectedTicket.transcriptUrl && (
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}${selectedTicket.transcriptUrl}`}
                  download
                  className="px-3 py-1.5 rounded-lg bg-discord-brand hover:bg-discord-brandHover text-white text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Download Transcript
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
