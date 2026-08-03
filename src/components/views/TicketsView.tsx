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
} from "lucide-react";

type SubPage = "dashboard" | "panels" | "tickets-list" | "categories" | "settings" | "logs";

interface TicketsViewProps {
  selectedGuildId: string | null;
  channels: any[];
  roles: any[];
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

  // Panel Form State with Live Preview defaults
  const [panelForm, setPanelForm] = useState<any>({
    name: "General Support",
    description: "Main support panel for member inquiries.",
    embedTitle: "📩 Need Support?",
    embedDescription: "Click the button below to open a private ticket with our team.",
    embedColor: "#5865F2",
    thumbnail: "",
    image: "",
    footer: "TheGodGen Ticket Engine",
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
      name: "Support Panel",
      description: "General support inquiries",
      embedTitle: "📩 Support Desk",
      embedDescription: "Click the button below to open a ticket with our support staff.",
      embedColor: "#5865F2",
      thumbnail: "",
      image: "",
      footer: "TheGodGen Ticket Engine",
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
    setIsPanelModalOpen(true);
  };

  const handleOpenEditPanel = (panel: any) => {
    setEditingPanel(panel);
    setPanelForm({
      ...panel,
      allowedRoles: JSON.parse(panel.allowedRoles || "[]"),
      supportRoles: JSON.parse(panel.supportRoles || "[]"),
    });
    setIsPanelModalOpen(true);
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
                GuildPilot v1.0
              </span>
            </h1>
            <p className="text-xs text-discord-muted">
              Personal Discord Ticket Management Engine & Transcript Storage
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
                <p className="text-xs text-discord-muted">Configure and deploy interactive ticket creation embeds to Discord channels.</p>
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
              {panels.map((panel) => (
                <div key={panel.id} className="p-5 rounded-xl bg-[#2b2d31] border border-[#383a40] space-y-4 relative overflow-hidden">
                  <div className="w-full h-1.5 absolute top-0 left-0" style={{ backgroundColor: panel.embedColor || "#5865F2" }} />
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white">{panel.name}</h3>
                      <p className="text-xs text-discord-muted line-clamp-1">{panel.description || "No description."}</p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1e1f22] text-discord-brand border border-[#35373c]">
                      {panel.buttonColor}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-discord-muted bg-[#1e1f22] p-3 rounded-lg border border-[#35373c]">
                    <div className="flex justify-between">
                      <span>Target Channel:</span>
                      <strong className="text-white font-mono">
                        #{channels.find((c) => c.id === panel.channelId)?.name || panel.channelId || "Not set"}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Button Label:</span>
                      <strong className="text-white">{panel.buttonEmoji} {panel.buttonText}</strong>
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
              ))}
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-xs text-discord-muted">
                <span>Page {currentPage} of {totalPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    className="px-3 py-1.5 rounded bg-[#2b2d31] hover:bg-[#35373c] text-white font-medium disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    className="px-3 py-1.5 rounded bg-[#2b2d31] hover:bg-[#35373c] text-white font-medium disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
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
      {/* PANEL EDITOR MODAL WITH LIVE DISCORD EMBED PREVIEW */}
      {/* ========================================================= */}
      {isPanelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#2b2d31] border border-[#383a40] rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 bg-[#1e1f22] border-b border-[#35373c] flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-discord-brand" />
                {editingPanel ? "Edit Ticket Panel" : "Create New Ticket Panel"}
              </h3>
              <button
                onClick={() => setIsPanelModalOpen(false)}
                className="text-discord-muted hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Form (Left) & Live Embed Preview (Right) */}
            <div className="flex-1 p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
              {/* Form Inputs */}
              <div className="space-y-4">
                <div>
                  <label className="block text-discord-muted mb-1 font-semibold">Panel Name</label>
                  <input
                    type="text"
                    value={panelForm.name}
                    onChange={(e) => setPanelForm({ ...panelForm, name: e.target.value })}
                    className="w-full p-2.5 rounded-lg bg-[#1e1f22] border border-[#35373c] text-white outline-none focus:border-discord-brand"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-discord-muted mb-1 font-semibold">Target Channel</label>
                    <select
                      value={panelForm.channelId}
                      onChange={(e) => setPanelForm({ ...panelForm, channelId: e.target.value })}
                      className="w-full p-2.5 rounded-lg bg-[#1e1f22] border border-[#35373c] text-white outline-none focus:border-discord-brand"
                    >
                      <option value="">-- Select Channel --</option>
                      {textChannels.map((c) => (
                        <option key={c.id} value={c.id}>
                          #{c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-discord-muted mb-1 font-semibold">Target Category</label>
                    <select
                      value={panelForm.categoryId}
                      onChange={(e) => setPanelForm({ ...panelForm, categoryId: e.target.value })}
                      className="w-full p-2.5 rounded-lg bg-[#1e1f22] border border-[#35373c] text-white outline-none focus:border-discord-brand"
                    >
                      <option value="">-- Default Category --</option>
                      {categoryChannels.map((c) => (
                        <option key={c.id} value={c.id}>
                          📁 {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-discord-muted mb-1 font-semibold">Embed Title</label>
                  <input
                    type="text"
                    value={panelForm.embedTitle}
                    onChange={(e) => setPanelForm({ ...panelForm, embedTitle: e.target.value })}
                    className="w-full p-2.5 rounded-lg bg-[#1e1f22] border border-[#35373c] text-white outline-none focus:border-discord-brand"
                  />
                </div>

                <div>
                  <label className="block text-discord-muted mb-1 font-semibold">Embed Description</label>
                  <textarea
                    value={panelForm.embedDescription}
                    onChange={(e) => setPanelForm({ ...panelForm, embedDescription: e.target.value })}
                    className="w-full p-2.5 rounded-lg bg-[#1e1f22] border border-[#35373c] text-white outline-none focus:border-discord-brand h-20"
                  />
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
                        className="w-full p-2 rounded-lg bg-[#1e1f22] border border-[#35373c] text-white font-mono outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-discord-muted mb-1 font-semibold">Button Style Color</label>
                    <select
                      value={panelForm.buttonColor}
                      onChange={(e) => setPanelForm({ ...panelForm, buttonColor: e.target.value })}
                      className="w-full p-2.5 rounded-lg bg-[#1e1f22] border border-[#35373c] text-white outline-none focus:border-discord-brand"
                    >
                      <option value="Primary">Primary (Blue)</option>
                      <option value="Secondary">Secondary (Grey)</option>
                      <option value="Success">Success (Green)</option>
                      <option value="Danger">Danger (Red)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-discord-muted mb-1 font-semibold">Button Text</label>
                    <input
                      type="text"
                      value={panelForm.buttonText}
                      onChange={(e) => setPanelForm({ ...panelForm, buttonText: e.target.value })}
                      className="w-full p-2.5 rounded-lg bg-[#1e1f22] border border-[#35373c] text-white outline-none focus:border-discord-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-discord-muted mb-1 font-semibold">Button Emoji</label>
                    <input
                      type="text"
                      value={panelForm.buttonEmoji}
                      onChange={(e) => setPanelForm({ ...panelForm, buttonEmoji: e.target.value })}
                      className="w-full p-2.5 rounded-lg bg-[#1e1f22] border border-[#35373c] text-white outline-none focus:border-discord-brand"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-discord-muted mb-1 font-semibold">Footer Text</label>
                  <input
                    type="text"
                    value={panelForm.footer}
                    onChange={(e) => setPanelForm({ ...panelForm, footer: e.target.value })}
                    className="w-full p-2.5 rounded-lg bg-[#1e1f22] border border-[#35373c] text-white outline-none focus:border-discord-brand"
                  />
                </div>
              </div>

              {/* Right Column: Live Discord Embed Preview */}
              <div className="space-y-3 bg-[#1e1f22] p-5 rounded-xl border border-[#35373c] flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-discord-muted block">
                  Live Discord Embed Preview
                </span>

                {/* Discord Message Mockup Container */}
                <div className="flex-1 bg-[#313338] p-4 rounded-xl border border-[#383a40] space-y-3 font-sans">
                  {/* Bot Author Header */}
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-discord-brand flex items-center justify-center font-bold text-white text-xs">
                      GP
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white flex items-center gap-1">
                        TheGodGen Bot <span className="bg-discord-brand text-white text-[9px] px-1 rounded font-semibold">BOT</span>
                      </span>
                      <span className="text-[10px] text-discord-muted">Today at 12:00 PM</span>
                    </div>
                  </div>

                  {/* Embed Card Mockup */}
                  <div
                    className="p-3.5 rounded-lg bg-[#2b2d31] space-y-2 border-l-4"
                    style={{ borderColor: panelForm.embedColor || "#5865F2" }}
                  >
                    {panelForm.embedTitle && (
                      <h4 className="text-sm font-bold text-white">{panelForm.embedTitle}</h4>
                    )}
                    {panelForm.embedDescription && (
                      <p className="text-xs text-[#dbdee1] whitespace-pre-wrap leading-relaxed">
                        {panelForm.embedDescription}
                      </p>
                    )}
                    {panelForm.footer && (
                      <span className="text-[10px] text-discord-muted block pt-1 border-t border-[#35373c]">
                        {panelForm.footer}
                      </span>
                    )}
                  </div>

                  {/* Interactive Button Mockup */}
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
                Save Panel
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
