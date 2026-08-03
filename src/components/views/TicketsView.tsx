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
  Users,
  Award,
  BarChart3,
  Terminal,
  Activity,
  Check,
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
  supportRoles?: string[];
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

  // Panel Form State with OLED defaults
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
    allowedRoles: [] as string[],
    supportRoles: [] as string[],
    maxOpenTickets: 1,
    autoCloseHours: 0,
    transcriptEnabled: true,
  });

  // Ticket Reason Form inside Panel Modal
  const [newReasonLabel, setNewReasonLabel] = useState("");
  const [newReasonEmoji, setNewReasonEmoji] = useState("❓");
  const [newReasonDesc, setNewReasonDesc] = useState("");
  const [newReasonCat, setNewReasonCat] = useState("");

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
          defaultSupportRoles: typeof settingsRes.data.defaultSupportRoles === "string"
            ? JSON.parse(settingsRes.data.defaultSupportRoles || "[]")
            : settingsRes.data.defaultSupportRoles || [],
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
      supportRoles: roles.slice(0, 2).map((r) => r.id),
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

    let parsedAllowed: any[] = [];
    try {
      parsedAllowed = typeof panel.allowedRoles === "string" ? JSON.parse(panel.allowedRoles || "[]") : panel.allowedRoles || [];
    } catch (e) {
      parsedAllowed = [];
    }

    let parsedSupport: any[] = [];
    try {
      parsedSupport = typeof panel.supportRoles === "string" ? JSON.parse(panel.supportRoles || "[]") : panel.supportRoles || [];
    } catch (e) {
      parsedSupport = [];
    }

    let parsedReasons: any[] = [];
    try {
      parsedReasons = typeof panel.reasons === "string" ? JSON.parse(panel.reasons || "[]") : panel.reasons || [];
    } catch (e) {
      parsedReasons = [];
    }

    let parsedQuestions: any[] = [];
    try {
      parsedQuestions = typeof panel.questions === "string" ? JSON.parse(panel.questions || "[]") : panel.questions || [];
    } catch (e) {
      parsedQuestions = [];
    }

    setPanelForm({
      ...panel,
      allowedRoles: parsedAllowed,
      supportRoles: parsedSupport,
      reasons: parsedReasons,
      questions: parsedQuestions,
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

  const handleToggleSupportRole = (roleId: string) => {
    const current = panelForm.supportRoles || [];
    const updated = current.includes(roleId)
      ? current.filter((id: string) => id !== roleId)
      : [...current, roleId];
    setPanelForm({ ...panelForm, supportRoles: updated });
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
    <div className="flex flex-col h-full bg-[#000000] text-zinc-100 overflow-hidden font-sans select-none">
      {/* OLED Top Header & Subpage Navigation */}
      <div className="p-4 bg-[#050507] border-b border-[#18181b] flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-discord-brand/20 border border-discord-brand/40 flex items-center justify-center text-discord-brand shadow-lg shadow-discord-brand/10">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              Ticket Control Engine
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-discord-brand/20 text-discord-brand border border-discord-brand/30 uppercase tracking-widest">
                OLED Edition v2.0
              </span>
            </h1>
            <p className="text-xs text-zinc-400">
              Supporter Role Access, Custom Discord Slash Commands & Persistent Ticket History
            </p>
          </div>
        </div>

        {/* Subpage Tabs */}
        <div className="flex items-center gap-1 bg-[#090a0f] p-1 rounded-2xl border border-[#18181b]">
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
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-discord-brand text-white shadow-lg shadow-discord-brand/20 font-bold"
                    : "text-zinc-400 hover:text-white hover:bg-[#18181b]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area - OLED Black */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-[#000000]">
        {/* ========================================================= */}
        {/* 1. DASHBOARD SUBPAGE */}
        {/* ========================================================= */}
        {activeSubPage === "dashboard" && (
          <div className="space-y-6">
            {/* Stat Cards - OLED Dark */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="p-4 rounded-2xl bg-[#090a0f] border border-[#18181b] flex items-center justify-between shadow-xl hover:border-discord-brand/40 transition-all">
                <div>
                  <span className="text-xs text-zinc-500 font-semibold block">Total Tickets</span>
                  <span className="text-2xl font-bold text-white font-mono">{stats.total || 0}</span>
                </div>
                <div className="p-3 rounded-2xl bg-discord-brand/10 text-discord-brand border border-discord-brand/20">
                  <Ticket className="w-5 h-5" />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#090a0f] border border-[#18181b] flex items-center justify-between shadow-xl hover:border-emerald-500/40 transition-all">
                <div>
                  <span className="text-xs text-zinc-500 font-semibold block">Open Tickets</span>
                  <span className="text-2xl font-bold text-emerald-400 font-mono">{stats.open || 0}</span>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Clock className="w-5 h-5" />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#090a0f] border border-[#18181b] flex items-center justify-between shadow-xl hover:border-sky-500/40 transition-all">
                <div>
                  <span className="text-xs text-zinc-500 font-semibold block">Claimed Tickets</span>
                  <span className="text-2xl font-bold text-sky-400 font-mono">{stats.claimed || 0}</span>
                </div>
                <div className="p-3 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <UserCheck className="w-5 h-5" />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#090a0f] border border-[#18181b] flex items-center justify-between shadow-xl hover:border-rose-500/40 transition-all">
                <div>
                  <span className="text-xs text-zinc-500 font-semibold block">Closed Tickets</span>
                  <span className="text-2xl font-bold text-rose-400 font-mono">{stats.closed || 0}</span>
                </div>
                <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <Lock className="w-5 h-5" />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#090a0f] border border-[#18181b] flex items-center justify-between shadow-xl hover:border-amber-500/40 transition-all">
                <div>
                  <span className="text-xs text-zinc-500 font-semibold block">Active Panels</span>
                  <span className="text-2xl font-bold text-amber-400 font-mono">{stats.panelsCount || 0}</span>
                </div>
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Layers className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Quick Actions & Recent Activity Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Quick Actions */}
              <div className="p-5 rounded-2xl bg-[#090a0f] border border-[#18181b] space-y-4 shadow-2xl">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-discord-brand" /> Quick Operations
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={handleOpenCreatePanel}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-[#000000] border border-[#18181b] hover:border-discord-brand hover:bg-[#12131a] text-white text-xs font-semibold transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-discord-brand" /> Create Ticket Panel
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">Deploy</span>
                  </button>

                  <button
                    onClick={() => setActiveSubPage("settings")}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-[#000000] border border-[#18181b] hover:border-sky-500 hover:bg-[#12131a] text-white text-xs font-semibold transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-sky-400" /> Configure Supporter Roles
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">Roles</span>
                  </button>

                  <button
                    onClick={() => setActiveSubPage("logs")}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-[#000000] border border-[#18181b] hover:border-emerald-500 hover:bg-[#12131a] text-white text-xs font-semibold transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <History className="w-4 h-4 text-emerald-400" /> Audit Log History
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">Audit</span>
                  </button>
                </div>
              </div>

              {/* Recent Ticket Activity */}
              <div className="lg:col-span-2 p-5 rounded-2xl bg-[#090a0f] border border-[#18181b] space-y-4 shadow-2xl">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" /> Real-time Ticket Events
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {logs.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-6 text-center">No ticket activity logged yet.</p>
                  ) : (
                    logs.slice(0, 5).map((log: any) => (
                      <div key={log.id} className="flex items-center justify-between p-3 rounded-xl bg-[#000000] border border-[#18181b]">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-bold text-discord-brand">#{log.ticketNumber}</span>
                          <div>
                            <span className="text-xs font-semibold text-white block">{log.action}</span>
                            <span className="text-[11px] text-zinc-500">{log.details || `Executed by ${log.executorTag}`}</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
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
                <p className="text-xs text-zinc-400">Configure and deploy interactive ticket embeds with supporter role access & pre-ticket questions.</p>
              </div>
              <button
                onClick={handleOpenCreatePanel}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-discord-brand hover:bg-discord-brandHover text-white font-bold text-xs shadow-lg shadow-discord-brand/20 transition-all transform hover:scale-[1.02]"
              >
                <Plus className="w-4 h-4" /> Create Panel
              </button>
            </div>

            {/* Panels List Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {panels.map((panel) => {
                const reasonsList: TicketReason[] = JSON.parse(panel.reasons || "[]");
                const supportRoleIds: string[] = JSON.parse(panel.supportRoles || "[]");
                return (
                  <div key={panel.id} className="p-5 rounded-2xl bg-[#090a0f] border border-[#18181b] space-y-4 relative overflow-hidden shadow-2xl hover:border-discord-brand/40 transition-all">
                    <div className="w-full h-1.5 absolute top-0 left-0" style={{ backgroundColor: panel.embedColor || "#5865F2" }} />
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-base font-bold text-white">{panel.name}</h3>
                        <p className="text-xs text-zinc-400 line-clamp-1">{panel.description || "No description."}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {reasonsList.length > 0 ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            📋 {reasonsList.length} Ticket Types
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#18181b] text-discord-brand border border-[#27272a]">
                            {panel.buttonColor} Button
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 text-xs text-zinc-400 bg-[#000000] p-3 rounded-xl border border-[#18181b]">
                      <div className="flex justify-between">
                        <span>Target Channel:</span>
                        <strong className="text-white font-mono">
                          #{channels.find((c) => c.id === panel.channelId)?.name || panel.channelId || "Not set"}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Supporter Roles:</span>
                        <strong className="text-sky-400 font-mono">
                          {supportRoleIds.length > 0 ? `${supportRoleIds.length} Roles Allowed` : "Default Roles"}
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => handleDeployPanel(panel.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-discord-brand hover:bg-discord-brandHover text-white font-bold text-xs shadow-lg shadow-discord-brand/20 transition-all"
                      >
                        <Send className="w-3.5 h-3.5" /> Deploy Panel
                      </button>
                      <button
                        onClick={() => handleOpenEditPanel(panel)}
                        className="p-2 rounded-xl bg-[#18181b] hover:bg-[#27272a] text-zinc-400 hover:text-white transition-colors"
                        title="Edit Panel"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePanel(panel.id)}
                        className="p-2 rounded-xl bg-[#18181b] hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-colors"
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
        {/* 3. TICKETS LIST SUBPAGE (PERSISTENT HISTORY) */}
        {/* ========================================================= */}
        {activeSubPage === "tickets-list" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#090a0f] border border-[#18181b] text-xs">
                  <Search className="w-3.5 h-3.5 text-zinc-500" />
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

                <div className="flex items-center gap-1 bg-[#090a0f] p-1 rounded-xl border border-[#18181b] text-xs">
                  {["ALL", "OPEN", "CLAIMED", "CLOSED"].map((st) => (
                    <button
                      key={st}
                      onClick={() => {
                        setTicketStatusFilter(st);
                        setCurrentPage(1);
                      }}
                      className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                        ticketStatusFilter === st
                          ? "bg-discord-brand text-white font-bold"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <span className="text-xs text-zinc-500 font-mono">
                Showing {filteredTickets.length} tickets (Saved in Persistent Database)
              </span>
            </div>

            {/* Persistent Tickets Table */}
            <div className="bg-[#090a0f] rounded-2xl border border-[#18181b] overflow-hidden shadow-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#000000] text-zinc-500 font-bold uppercase tracking-wider border-b border-[#18181b]">
                  <tr>
                    <th className="p-3.5">Ticket</th>
                    <th className="p-3.5">Creator</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Claimed By</th>
                    <th className="p-3.5">Open Date</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#18181b]/60 font-mono">
                  {paginatedTickets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-zinc-500">
                        No tickets recorded in database matching search filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedTickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-[#12131a] transition-colors">
                        <td className="p-3.5 font-bold text-discord-brand">#{ticket.ticketNumber}</td>
                        <td className="p-3.5 font-sans text-white font-medium flex items-center gap-2">
                          {ticket.userAvatar && <img src={ticket.userAvatar} className="w-5 h-5 rounded-full" alt="" />}
                          <span>{ticket.userTag}</span>
                        </td>
                        <td className="p-3.5 font-sans">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ticket.status === "OPEN"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : ticket.status === "CLAIMED"
                                ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                                : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                            }`}
                          >
                            {ticket.status}
                          </span>
                        </td>
                        <td className="p-3.5 font-sans text-zinc-400">
                          {ticket.claimedByTag ? (
                            <span className="text-sky-400 font-medium">👤 {ticket.claimedByTag}</span>
                          ) : (
                            "--"
                          )}
                        </td>
                        <td className="p-3.5 text-zinc-400">{new Date(ticket.createdAt).toLocaleString()}</td>
                        <td className="p-3.5 text-right font-sans">
                          <button
                            onClick={() => setSelectedTicket(ticket)}
                            className="px-3 py-1 rounded-xl bg-[#18181b] hover:bg-[#27272a] text-white text-xs font-semibold transition-colors flex items-center gap-1 ml-auto"
                          >
                            <Eye className="w-3.5 h-3.5" /> Inspect Details
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
              <div className="p-5 rounded-2xl bg-[#090a0f] border border-[#18181b] space-y-4 shadow-2xl">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                  Add Ticket Category
                </h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-zinc-400 mb-1 font-semibold">Category Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Technical Support"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[#000000] border border-[#18181b] text-white outline-none focus:border-discord-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1 font-semibold">Emoji</label>
                    <input
                      type="text"
                      placeholder="🎫"
                      value={newCatEmoji}
                      onChange={(e) => setNewCatEmoji(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[#000000] border border-[#18181b] text-white outline-none focus:border-discord-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1 font-semibold">Description</label>
                    <textarea
                      placeholder="Short category description..."
                      value={newCatDesc}
                      onChange={(e) => setNewCatDesc(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[#000000] border border-[#18181b] text-white outline-none focus:border-discord-brand h-20"
                    />
                  </div>
                  <button
                    onClick={handleCreateCategory}
                    className="w-full py-2.5 rounded-xl bg-discord-brand hover:bg-discord-brandHover text-white font-bold text-xs shadow-lg shadow-discord-brand/20 transition-all"
                  >
                    Save Category
                  </button>
                </div>
              </div>

              {/* Categories List */}
              <div className="md:col-span-2 space-y-3">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                  Configured Categories
                </h3>
                <div className="space-y-2">
                  {categories.length === 0 ? (
                    <p className="text-xs text-zinc-500 p-6 bg-[#090a0f] rounded-2xl border border-[#18181b] text-center">
                      No custom ticket categories created yet.
                    </p>
                  ) : (
                    categories.map((cat) => (
                      <div key={cat.id} className="flex items-center justify-between p-4 rounded-2xl bg-[#090a0f] border border-[#18181b] shadow-xl">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{cat.emoji || "🎫"}</span>
                          <div>
                            <h4 className="text-sm font-bold text-white">{cat.name}</h4>
                            <p className="text-xs text-zinc-400">{cat.description || "No description."}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="p-2 rounded-xl bg-[#18181b] hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-colors"
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
        {/* 5. SETTINGS SUBPAGE (SUPPORTER ROLES) */}
        {/* ========================================================= */}
        {activeSubPage === "settings" && (
          <div className="max-w-3xl space-y-6">
            <div className="p-6 rounded-2xl bg-[#090a0f] border border-[#18181b] space-y-6 shadow-2xl">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-discord-brand" /> Global Supporter Roles & Ticket Settings
              </h2>

              {/* Supporter Roles Picker */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-zinc-300">
                  Default Supporter / Staff Roles (Pings + Channel Access)
                </label>
                <p className="text-[11px] text-zinc-500">
                  Select Discord roles that will receive full view/reply access to all ticket channels and get pinged when a ticket is opened.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {roles.map((r) => {
                    const isSelected = settings.defaultSupportRoles?.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          const current = settings.defaultSupportRoles || [];
                          const updated = isSelected ? current.filter((id: string) => id !== r.id) : [...current, r.id];
                          setSettings({ ...settings, defaultSupportRoles: updated });
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                          isSelected
                            ? "bg-discord-brand text-white shadow-lg shadow-discord-brand/20 border border-discord-brand/40"
                            : "bg-[#000000] text-zinc-400 border border-[#18181b] hover:text-white"
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color || "#5865F2" }} />
                        <span>{r.name}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
                {/* Naming Format */}
                <div>
                  <label className="block text-zinc-400 mb-1.5 font-semibold">Ticket Channel Naming Format</label>
                  <select
                    value={settings.namingFormat}
                    onChange={(e) => setSettings({ ...settings, namingFormat: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-[#000000] border border-[#18181b] text-white outline-none focus:border-discord-brand"
                  >
                    <option value="ticket-{username}">ticket-username (e.g. ticket-john)</option>
                    <option value="{username}-ticket">username-ticket (e.g. john-ticket)</option>
                    <option value="ticket-{number}">ticket-0001 (Sequential Numbering)</option>
                  </select>
                </div>

                {/* Default Category */}
                <div>
                  <label className="block text-zinc-400 mb-1.5 font-semibold">Default Channel Category</label>
                  <select
                    value={settings.defaultCategoryId || ""}
                    onChange={(e) => setSettings({ ...settings, defaultCategoryId: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-[#000000] border border-[#18181b] text-white outline-none focus:border-discord-brand"
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
                  <label className="block text-zinc-400 mb-1.5 font-semibold">Log Channel (Ticket Close Log Embed)</label>
                  <select
                    value={settings.logChannelId || ""}
                    onChange={(e) => setSettings({ ...settings, logChannelId: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-[#000000] border border-[#18181b] text-white outline-none focus:border-discord-brand"
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
                  <label className="block text-zinc-400 mb-1.5 font-semibold">
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

              <button
                onClick={handleSaveSettings}
                className="px-6 py-2.5 rounded-xl bg-discord-brand hover:bg-discord-brandHover text-white font-bold text-xs shadow-lg shadow-discord-brand/20 transition-all"
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
            <div className="bg-[#090a0f] rounded-2xl border border-[#18181b] overflow-hidden shadow-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#000000] text-zinc-500 font-bold uppercase tracking-wider border-b border-[#18181b]">
                  <tr>
                    <th className="p-3.5">Action</th>
                    <th className="p-3.5">Ticket</th>
                    <th className="p-3.5">Executor</th>
                    <th className="p-3.5">Details</th>
                    <th className="p-3.5 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#18181b]/60 font-mono">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-zinc-500">No ticket audit logs recorded.</td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#12131a]">
                        <td className="p-3.5 font-sans font-bold text-white">
                          <span className="px-2 py-0.5 rounded-full bg-[#000000] border border-[#18181b] text-discord-brand text-[10px]">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold text-discord-brand">#{log.ticketNumber}</td>
                        <td className="p-3.5 font-sans text-white">{log.executorTag}</td>
                        <td className="p-3.5 font-sans text-zinc-400">{log.details || "--"}</td>
                        <td className="p-3.5 text-right text-zinc-500">{new Date(log.timestamp).toLocaleString()}</td>
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
      {/* PANEL EDITOR MODAL WITH SUPPORTER ROLE PICKER */}
      {/* ========================================================= */}
      {isPanelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#090a0f] border border-[#18181b] rounded-3xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 bg-[#000000] border-b border-[#18181b] flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-discord-brand" />
                {editingPanel ? "Edit Ticket Panel & Supporter Roles" : "Create New Ticket Panel"}
              </h3>
              <button
                onClick={() => setIsPanelModalOpen(false)}
                className="text-zinc-500 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
              <div className="lg:col-span-7 space-y-5">
                {/* Basic Settings */}
                <div className="space-y-3 bg-[#000000] p-4 rounded-2xl border border-[#18181b]">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider text-discord-brand">1. Basic Panel Settings</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold">Panel Name</label>
                      <input
                        type="text"
                        value={panelForm.name}
                        onChange={(e) => setPanelForm({ ...panelForm, name: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-[#090a0f] border border-[#18181b] text-white outline-none focus:border-discord-brand"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold">Target Channel</label>
                      <select
                        value={panelForm.channelId}
                        onChange={(e) => setPanelForm({ ...panelForm, channelId: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-[#090a0f] border border-[#18181b] text-white outline-none focus:border-discord-brand"
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

                {/* Supporter Roles Picker for Panel */}
                <div className="space-y-3 bg-[#000000] p-4 rounded-2xl border border-[#18181b]">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                    <Shield className="w-4 h-4" /> Supporter Roles for this Panel
                  </h4>
                  <p className="text-[11px] text-zinc-500">
                    Roles granted channel access and pinged when a user opens a ticket from this panel.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {roles.map((r) => {
                      const isSelected = panelForm.supportRoles?.includes(r.id);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => handleToggleSupportRole(r.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                            isSelected
                              ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                              : "bg-[#090a0f] text-zinc-500 border border-[#18181b] hover:text-white"
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color || "#38bdf8" }} />
                          <span>{r.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Live Preview Column */}
              <div className="lg:col-span-5 space-y-3 bg-[#000000] p-5 rounded-2xl border border-[#18181b] flex flex-col">
                <div className="flex items-center justify-between border-b border-[#18181b] pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Discord Embed Preview
                  </span>
                </div>

                <div className="flex-1 bg-[#090a0f] p-4 rounded-2xl border border-[#18181b] space-y-3 font-sans">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-discord-brand flex items-center justify-center font-bold text-white text-xs">
                      TGG
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white flex items-center gap-1">
                        TheGodGen Bot <span className="bg-discord-brand text-white text-[9px] px-1 rounded font-semibold">BOT</span>
                      </span>
                      <span className="text-[10px] text-zinc-500">Today at 12:00 PM</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#000000] border-l-4 space-y-2 border-[#5865F2]">
                    <h4 className="text-sm font-bold text-white">{panelForm.embedTitle || panelForm.name}</h4>
                    <p className="text-xs text-zinc-400">{panelForm.embedDescription}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#000000] border-t border-[#18181b] flex items-center justify-end gap-3">
              <button
                onClick={() => setIsPanelModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#18181b] hover:bg-[#27272a] text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePanel}
                className="px-5 py-2 rounded-xl bg-discord-brand hover:bg-discord-brandHover text-white text-xs font-bold shadow-lg shadow-discord-brand/20"
              >
                Save Panel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TICKET DETAIL INSPECTOR MODAL */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#090a0f] border border-[#18181b] rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#18181b] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Ticket className="w-5 h-5 text-discord-brand" />
                Ticket #{selectedTicket.ticketNumber} Details
              </h3>
              <button onClick={() => setSelectedTicket(null)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs bg-[#000000] p-4 rounded-2xl border border-[#18181b]">
              <div>
                <span className="text-zinc-500 block">Creator:</span>
                <span className="text-white font-bold">{selectedTicket.userTag}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Status:</span>
                <span className="font-bold text-emerald-400">{selectedTicket.status}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Claimed By:</span>
                <span className="text-white font-medium">{selectedTicket.claimedByTag || "Unclaimed"}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Open Date:</span>
                <span className="text-white">{new Date(selectedTicket.createdAt).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={() => handleTicketAction(selectedTicket.id, "close")}
                className="px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" /> Close Ticket
              </button>
              <button
                onClick={() => handleTicketAction(selectedTicket.id, "reopen")}
                className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Unlock className="w-3.5 h-3.5" /> Reopen Ticket
              </button>
              <button
                onClick={() => handleTicketAction(selectedTicket.id, "transcript")}
                className="px-3.5 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" /> Generate Transcript
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
