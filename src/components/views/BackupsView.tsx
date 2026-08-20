"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Archive,
  Save,
  Download,
  Upload,
  RefreshCw,
  Search,
  Check,
  X,
  AlertTriangle,
  Play,
  Trash2,
  Eye,
  Hash,
  FolderTree,
  Shield,
  Layers,
  Sparkles,
  Ticket,
  ClipboardList,
  MessageSquareText,
  Smile,
  Users,
  Server,
  Clock,
  CheckCircle2,
  HardDrive,
  Info,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "../ToastContainer";

export interface ServerBackupItem {
  id: string;
  guildId: string;
  guildName: string;
  guildIcon: string | null;
  backupName: string;
  backupType: "MANUAL" | "AUTO_LEAVE" | "AUTO_SCHEDULED" | "IMPORTED";
  reason: string | null;
  memberCount: number;
  channelsCount: number;
  rolesCount: number;
  emojisCount: number;
  isBotInGuild: boolean;
  createdAt: string;
  updatedAt: string;
  summary: {
    categoriesCount: number;
    textChannelsCount: number;
    voiceChannelsCount: number;
    rolesCount: number;
    hasTicketModules: boolean;
    hasAppModules: boolean;
    hasWelcome: boolean;
    hasCustomMessages: boolean;
    hasAutoReact: boolean;
  } | null;
}

interface GuildOption {
  id: string;
  name: string;
  icon: string | null;
}

interface BackupsViewProps {
  guilds: GuildOption[];
  selectedGuildId: string | null;
  onRefreshGuilds?: () => void;
}

export function BackupsView({ guilds, selectedGuildId, onRefreshGuilds }: BackupsViewProps) {
  const { showToast } = useToast();

  const [backups, setBackups] = useState<ServerBackupItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "active" | "archived" | "manual" | "auto_leave">("all");

  // Create Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createGuildId, setCreateGuildId] = useState<string>(selectedGuildId || (guilds[0]?.id ?? ""));
  const [createName, setCreateName] = useState("");
  const [createReason, setCreateReason] = useState("");
  const [creating, setCreating] = useState(false);

  // Restore Modal
  const [restoreModalBackup, setRestoreModalBackup] = useState<ServerBackupItem | null>(null);
  const [restoreTargetGuildId, setRestoreTargetGuildId] = useState<string>(selectedGuildId || (guilds[0]?.id ?? ""));
  const [restoreRoles, setRestoreRoles] = useState(true);
  const [restoreCategories, setRestoreCategories] = useState(true);
  const [restoreChannels, setRestoreChannels] = useState(true);
  const [restoreBotModules, setRestoreBotModules] = useState(true);
  const [restoring, setRestoring] = useState(false);

  // Detail Inspector Modal
  const [inspectModalBackup, setInspectModalBackup] = useState<any | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  // Import Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [importName, setImportName] = useState("");
  const [importing, setImporting] = useState(false);

  // Fetch Backups
  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/backups");
      setBackups(res.data);
    } catch (err: any) {
      showToast(err.response?.data?.error || "Fehler beim Laden der Backups.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  useEffect(() => {
    if (selectedGuildId) {
      setCreateGuildId(selectedGuildId);
      setRestoreTargetGuildId(selectedGuildId);
    }
  }, [selectedGuildId]);

  // Filtered Backups
  const filteredBackups = useMemo(() => {
    return backups.filter((b) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = b.backupName.toLowerCase().includes(q);
        const matchGuild = b.guildName.toLowerCase().includes(q);
        const matchId = b.guildId.includes(q);
        const matchReason = b.reason ? b.reason.toLowerCase().includes(q) : false;
        if (!matchName && !matchGuild && !matchId && !matchReason) return false;
      }

      // Filter tabs
      if (filterType === "active" && !b.isBotInGuild) return false;
      if (filterType === "archived" && b.isBotInGuild) return false;
      if (filterType === "manual" && b.backupType !== "MANUAL") return false;
      if (filterType === "auto_leave" && b.backupType !== "AUTO_LEAVE") return false;

      return true;
    });
  }, [backups, searchQuery, filterType]);

  // Statistics
  const stats = useMemo(() => {
    const total = backups.length;
    const autoLeave = backups.filter((b) => b.backupType === "AUTO_LEAVE").length;
    const manual = backups.filter((b) => b.backupType === "MANUAL").length;
    const archived = backups.filter((b) => !b.isBotInGuild).length;
    const uniqueGuilds = new Set(backups.map((b) => b.guildId)).size;
    return { total, autoLeave, manual, archived, uniqueGuilds };
  }, [backups]);

  // Create Manual Backup
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createGuildId) return;
    setCreating(true);
    try {
      const res = await api.post(`/backups/guilds/${createGuildId}`, {
        name: createName || undefined,
        reason: createReason || undefined,
      });
      showToast(`Backup "${res.data.backupName}" erfolgreich erstellt!`, "success");
      setIsCreateModalOpen(false);
      setCreateName("");
      setCreateReason("");
      fetchBackups();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Fehler beim Erstellen des Backups.", "error");
    } finally {
      setCreating(false);
    }
  };

  // Restore Backup
  const handleRestoreSubmit = async () => {
    if (!restoreModalBackup || !restoreTargetGuildId) return;
    setRestoring(true);
    try {
      const res = await api.post(`/backups/guilds/${restoreTargetGuildId}/restore/${restoreModalBackup.id}`, {
        restoreRoles,
        restoreCategories,
        restoreChannels,
        restoreBotModules,
      });
      showToast(
        `Wiederherstellung abgeschlossen: ${res.data.channelsCreated} Kanäle, ${res.data.categoriesCreated} Kategorien, ${res.data.rolesCreated} Rollen erstellt!`,
        "success"
      );
      setRestoreModalBackup(null);
    } catch (err: any) {
      showToast(err.response?.data?.error || "Fehler bei der Wiederherstellung.", "error");
    } finally {
      setRestoring(false);
    }
  };

  // Delete Backup
  const handleDeleteBackup = async (backup: ServerBackupItem) => {
    if (!confirm(`Möchtest du das Backup "${backup.backupName}" wirklich löschen?`)) return;
    try {
      await api.delete(`/backups/${backup.id}`);
      setBackups((prev) => prev.filter((b) => b.id !== backup.id));
      showToast(`Backup "${backup.backupName}" gelöscht.`, "info");
    } catch (err: any) {
      showToast(err.response?.data?.error || "Fehler beim Löschen des Backups.", "error");
    }
  };

  // Inspect Backup
  const handleInspectBackup = async (backup: ServerBackupItem) => {
    setInspectLoading(true);
    try {
      const res = await api.get(`/backups/${backup.id}`);
      setInspectModalBackup(res.data);
    } catch (err: any) {
      showToast("Konnte Backup-Details nicht laden.", "error");
    } finally {
      setInspectLoading(false);
    }
  };

  // Download JSON
  const handleDownloadJson = (backupId: string) => {
    const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/backups/${backupId}/download`;
    window.open(url, "_blank");
  };

  // Import JSON
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importJsonText.trim()) return;
    setImporting(true);
    try {
      const parsed = JSON.parse(importJsonText);
      const res = await api.post("/backups/import", {
        data: parsed,
        name: importName || undefined,
      });
      showToast(`Backup "${res.data.backupName}" erfolgreich importiert!`, "success");
      setIsImportModalOpen(false);
      setImportJsonText("");
      setImportName("");
      fetchBackups();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Ungültiges JSON-Format oder Import-Fehler.", "error");
    } finally {
      setImporting(false);
    }
  };

  // File Upload helper
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setImportJsonText(content);
      if (!importName) {
        setImportName(file.name.replace(".json", ""));
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#090a0f] text-zinc-200 select-none">
      {/* Header */}
      <div className="p-5 border-b border-[#18181b] bg-[#050507] shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 shadow-inner">
            <Archive className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Server-Backups & Wiederherstellung
              <span className="text-xs font-mono font-normal bg-[#18181b] border border-[#27272a] text-zinc-400 px-2.5 py-0.5 rounded-full">
                {backups.length} gesichert
              </span>
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Permanente Sicherungen aller Server. Backups bleiben auch erhalten, wenn der Bot vom Server entfernt wurde.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#12131a] hover:bg-[#1c1d28] border border-[#27272a] hover:border-indigo-500/50 text-xs font-semibold text-zinc-300 hover:text-white transition-all shadow-sm cursor-pointer"
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>JSON Importieren</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Neues Backup erstellen</span>
          </button>

          <button
            onClick={fetchBackups}
            disabled={loading}
            title="Aktualisieren"
            className="p-2 rounded-xl bg-[#12131a] hover:bg-[#1c1d28] border border-[#27272a] text-zinc-400 hover:text-white transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-discord-brand" : ""}`} />
          </button>
        </div>
      </div>

      {/* Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-4 bg-[#07070a] border-b border-[#18181b] text-xs shrink-0">
        <div className="p-2.5 rounded-xl bg-[#0e0f17] border border-[#1e1f2b] flex items-center justify-between">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <Archive className="w-3.5 h-3.5 text-indigo-400" /> Gesamt-Backups
          </span>
          <span className="font-bold text-white font-mono">{stats.total}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-[#0e0f17] border border-[#1e1f2b] flex items-center justify-between">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <Save className="w-3.5 h-3.5 text-sky-400" /> Manuelle Snapshots
          </span>
          <span className="font-bold text-sky-300 font-mono">{stats.manual}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-[#0e0f17] border border-[#1e1f2b] flex items-center justify-between">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Notfall-Backups (Bot Left)
          </span>
          <span className="font-bold text-amber-300 font-mono">{stats.autoLeave}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-[#0e0f17] border border-[#1e1f2b] flex items-center justify-between">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-rose-400" /> Archivierte Server
          </span>
          <span className="font-bold text-rose-300 font-mono">{stats.archived}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-[#0e0f17] border border-[#1e1f2b] flex items-center justify-between">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" /> Gesicherte Server
          </span>
          <span className="font-bold text-emerald-300 font-mono">{stats.uniqueGuilds}</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 bg-[#090a0f] border-b border-[#18181b] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Backups durchsuchen (Name, Server, ID, Notiz)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#12131a] border border-[#27272a] focus:border-indigo-500 text-zinc-100 placeholder-zinc-500 rounded-xl pl-9 pr-8 py-2 text-xs transition-all outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Segmented Buttons */}
        <div className="flex items-center bg-[#12131a] border border-[#27272a] rounded-xl p-1 text-xs">
          {(
            [
              { id: "all", label: "Alle Backups" },
              { id: "active", label: "Aktive Server" },
              { id: "archived", label: "Archivierte Server" },
              { id: "manual", label: "Manuelle" },
              { id: "auto_leave", label: "Notfall (Left)" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filterType === tab.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Backups List / Grid */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-500 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm">Lade Server-Backups...</p>
          </div>
        ) : filteredBackups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-500 gap-3 bg-[#0c0d14] border border-[#1e1f2b] rounded-2xl p-8 text-center">
            <Archive className="w-10 h-10 text-zinc-600 mb-1" />
            <h3 className="text-sm font-bold text-zinc-300">Keine Backups gefunden</h3>
            <p className="text-xs text-zinc-500 max-w-sm">
              Erstelle deinen ersten Server-Snapshot oder importiere ein Backup im JSON-Format.
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" /> Backup erstellen
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBackups.map((backup) => (
              <div
                key={backup.id}
                className="bg-[#0c0d14] border border-[#1e1f2b] hover:border-indigo-500/40 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4 transition-all hover:-translate-y-0.5"
              >
                <div className="space-y-3">
                  {/* Card Top: Server & Type */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      {backup.guildIcon ? (
                        <img
                          src={backup.guildIcon}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover shrink-0 border border-[#27272a]"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center font-bold text-indigo-400 text-xs shrink-0">
                          {backup.guildName.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="truncate">
                        <h4 className="font-bold text-white text-sm truncate">{backup.backupName}</h4>
                        <p className="text-[11px] text-zinc-400 truncate flex items-center gap-1">
                          <span>{backup.guildName}</span>
                          <span className="text-zinc-600">•</span>
                          <span className="font-mono text-[10px] text-zinc-500">{backup.guildId}</span>
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteBackup(backup)}
                      className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-[#18181b] rounded-lg transition-colors cursor-pointer shrink-0"
                      title="Backup löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Status & Type Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
                    {backup.backupType === "AUTO_LEAVE" ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-400" /> Notfall (Bot entfernt)
                      </span>
                    ) : backup.backupType === "IMPORTED" ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-1">
                        <Upload className="w-3 h-3 text-emerald-400" /> Importiert
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 flex items-center gap-1">
                        <Save className="w-3 h-3 text-indigo-400" /> Manueller Snapshot
                      </span>
                    )}

                    {backup.isBotInGuild ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Server aktiv
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Archiviert (Bot entfernt)
                      </span>
                    )}
                  </div>

                  {/* Reason / Notes */}
                  {backup.reason && (
                    <p className="text-[11px] text-zinc-400 bg-[#08090e] p-2 rounded-xl border border-[#1e1f2b] line-clamp-2">
                      {backup.reason}
                    </p>
                  )}

                  {/* Structure Stats */}
                  <div className="grid grid-cols-3 gap-2 text-[11px] font-semibold text-zinc-300">
                    <div className="bg-[#12131a] border border-[#1e1f2b] p-2 rounded-xl flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{backup.channelsCount} Kanäle</span>
                    </div>
                    <div className="bg-[#12131a] border border-[#1e1f2b] p-2 rounded-xl flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{backup.rolesCount} Rollen</span>
                    </div>
                    <div className="bg-[#12131a] border border-[#1e1f2b] p-2 rounded-xl flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{backup.memberCount} User</span>
                    </div>
                  </div>

                  {/* Modules Indicators */}
                  {backup.summary && (
                    <div className="flex flex-wrap items-center gap-1 pt-1">
                      {backup.summary.hasTicketModules && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 flex items-center gap-1">
                          <Ticket className="w-2.5 h-2.5" /> Tickets
                        </span>
                      )}
                      {backup.summary.hasAppModules && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-300 flex items-center gap-1">
                          <ClipboardList className="w-2.5 h-2.5" /> Apps
                        </span>
                      )}
                      {backup.summary.hasWelcome && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-pink-500/10 border border-pink-500/30 text-pink-300 flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" /> Welcome
                        </span>
                      )}
                      {backup.summary.hasCustomMessages && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300 flex items-center gap-1">
                          <MessageSquareText className="w-2.5 h-2.5" /> V2 Messages
                        </span>
                      )}
                      {backup.summary.hasAutoReact && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-1">
                          <Smile className="w-2.5 h-2.5" /> Auto-React
                        </span>
                      )}
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="text-[10px] text-zinc-500 flex items-center gap-1 pt-1">
                    <Clock className="w-3 h-3 text-zinc-500" />
                    <span>
                      Gesichert am:{" "}
                      {new Date(backup.createdAt).toLocaleString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1e1f2b]">
                  <button
                    onClick={() => {
                      setRestoreModalBackup(backup);
                    }}
                    className="col-span-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" /> Restore
                  </button>

                  <button
                    onClick={() => handleInspectBackup(backup)}
                    className="col-span-1 py-2 bg-[#12131a] hover:bg-[#1e1f2b] text-zinc-300 hover:text-white border border-[#27272a] rounded-xl font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5 text-indigo-400" /> Details
                  </button>

                  <button
                    onClick={() => handleDownloadJson(backup.id)}
                    className="col-span-1 py-2 bg-[#12131a] hover:bg-[#1e1f2b] text-zinc-300 hover:text-white border border-[#27272a] rounded-xl font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-1"
                    title="Als JSON herunterladen"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" /> JSON
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE BACKUP MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0c0d14] border border-[#1e1f2b] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e1f2b] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Save className="w-5 h-5 text-indigo-400" /> Server-Backup erstellen
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                  Server auswählen
                </label>
                <select
                  value={createGuildId}
                  onChange={(e) => setCreateGuildId(e.target.value)}
                  className="w-full bg-[#12131a] border border-[#27272a] text-zinc-200 rounded-xl p-2.5 outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {guilds.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                  Backup-Name
                </label>
                <input
                  type="text"
                  placeholder="z. B. Vollständiges Server-Backup vor Update"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full bg-[#12131a] border border-[#27272a] focus:border-indigo-500 text-zinc-100 rounded-xl px-3.5 py-2.5 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                  Notiz / Grund (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Zusätzliche Infos zum Snapshot..."
                  value={createReason}
                  onChange={(e) => setCreateReason(e.target.value)}
                  className="w-full bg-[#12131a] border border-[#27272a] focus:border-indigo-500 text-zinc-100 rounded-xl p-3 outline-none resize-none"
                />
              </div>

              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-zinc-300 text-[11px] flex items-start gap-2">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  Sichert alle Kanäle, Kategorien, Berechtigungen, Rollen, Emojis sowie Bot-Module (Tickets, Bewerbungen, Willkommens-System, Custom Messages & Auto-Reaktionen) in der lokalen SQLite-Datenbank.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1e1f2b]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3.5 py-2 text-zinc-400 hover:text-white rounded-xl"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 cursor-pointer flex items-center gap-1.5"
                >
                  {creating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{creating ? "Erstelle Backup..." : "Snapshot speichern"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESTORE BACKUP MODAL */}
      {restoreModalBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0c0d14] border border-[#1e1f2b] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e1f2b] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Play className="w-5 h-5 text-emerald-400 fill-current" /> Backup wiederherstellen
              </h3>
              <button onClick={() => setRestoreModalBackup(null)} className="p-1 text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[#12131a] border border-[#1e1f2b] rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold text-zinc-500">Ausgewähltes Backup</p>
                  <p className="font-bold text-white text-sm mt-0.5">{restoreModalBackup.backupName}</p>
                  <p className="text-[11px] text-zinc-400">Ursprung: {restoreModalBackup.guildName}</p>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                  Ziel-Server (Wohin soll wiederhergestellt werden?)
                </label>
                <select
                  value={restoreTargetGuildId}
                  onChange={(e) => setRestoreTargetGuildId(e.target.value)}
                  className="w-full bg-[#12131a] border border-[#27272a] text-zinc-200 rounded-xl p-2.5 outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {guilds.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 pt-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block">
                  Module auswählen
                </label>

                <label className="flex items-center justify-between p-2.5 bg-[#12131a] border border-[#1e1f2b] rounded-xl cursor-pointer">
                  <span className="font-semibold text-zinc-200">🛡️ Rollen wiederherstellen</span>
                  <input
                    type="checkbox"
                    checked={restoreRoles}
                    onChange={(e) => setRestoreRoles(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 bg-[#12131a] border border-[#1e1f2b] rounded-xl cursor-pointer">
                  <span className="font-semibold text-zinc-200">📁 Kategorien & Kanäle erstellen</span>
                  <input
                    type="checkbox"
                    checked={restoreChannels}
                    onChange={(e) => {
                      setRestoreChannels(e.target.checked);
                      setRestoreCategories(e.target.checked);
                    }}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 bg-[#12131a] border border-[#1e1f2b] rounded-xl cursor-pointer">
                  <span className="font-semibold text-zinc-200">⚙️ Bot-Module (Tickets, Apps, Welcome etc.)</span>
                  <input
                    type="checkbox"
                    checked={restoreBotModules}
                    onChange={(e) => setRestoreBotModules(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </label>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-[11px] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Beim Wiederherstellen werden neue Kanäle und Rollen auf dem Ziel-Server angelegt. Bestehende Kanäle werden nicht gelöscht.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1e1f2b]">
              <button
                onClick={() => setRestoreModalBackup(null)}
                className="px-3.5 py-2 text-xs text-zinc-400 hover:text-white rounded-xl"
              >
                Abbrechen
              </button>
              <button
                onClick={handleRestoreSubmit}
                disabled={restoring}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5"
              >
                {restoring ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{restoring ? "Stelle wieder her..." : "Wiederherstellung starten"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSPECT DETAIL MODAL */}
      {inspectModalBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0c0d14] border border-[#1e1f2b] rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-[#1e1f2b] bg-[#08090e]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Backup-Details: {inspectModalBackup.backupName}</h3>
                  <p className="text-xs text-zinc-400">
                    Server: {inspectModalBackup.guildName} • Gesichert am:{" "}
                    {new Date(inspectModalBackup.createdAt).toLocaleString("de-DE")}
                  </p>
                </div>
              </div>
              <button onClick={() => setInspectModalBackup(null)} className="p-1 text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* Categories & Channels Preview */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-[#1e1f2b] pb-2 flex items-center gap-2">
                  <FolderTree className="w-4 h-4 text-indigo-400" />
                  Kategorien & Kanäle ({inspectModalBackup.data?.channels?.length || 0})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 max-h-44 overflow-y-auto p-1">
                  {inspectModalBackup.data?.categories?.map((cat: any) => (
                    <div key={cat.id} className="p-2 rounded-lg bg-[#12131a] border border-[#1e1f2b]">
                      <span className="font-bold text-white flex items-center gap-1.5">📁 {cat.name}</span>
                      <div className="pl-3 pt-1 space-y-0.5 text-zinc-400 text-[11px]">
                        {inspectModalBackup.data?.channels
                          ?.filter((c: any) => c.parentId === cat.id)
                          .map((ch: any) => (
                            <p key={ch.id} className="truncate">
                              {ch.type === 2 ? "🔊" : "#"} {ch.name}
                            </p>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Roles Preview */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-[#1e1f2b] pb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-400" />
                  Rollen ({inspectModalBackup.data?.roles?.length || 0})
                </h4>
                <div className="flex flex-wrap gap-1.5 mt-2 max-h-36 overflow-y-auto p-1">
                  {inspectModalBackup.data?.roles?.map((role: any) => (
                    <span
                      key={role.id}
                      className="px-2.5 py-1 rounded-md text-[11px] font-semibold border flex items-center gap-1.5"
                      style={{
                        backgroundColor: `${role.color || "#99aab5"}15`,
                        borderColor: `${role.color || "#99aab5"}40`,
                        color: role.color === "#000000" ? "#99aab5" : role.color,
                      }}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: role.color === "#000000" ? "#99aab5" : role.color }}
                      />
                      <span>{role.name}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Bot Modules Summary */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-[#1e1f2b] pb-2 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  Enthaltene Bot-Module
                </h4>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="p-2.5 bg-[#12131a] border border-[#1e1f2b] rounded-xl flex items-center justify-between">
                    <span className="text-zinc-300">Ticket-System:</span>
                    <span className="font-mono font-bold text-white">
                      {inspectModalBackup.data?.databaseModules?.ticketPanels?.length || 0} Panels
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#12131a] border border-[#1e1f2b] rounded-xl flex items-center justify-between">
                    <span className="text-zinc-300">Bewerbungs-System:</span>
                    <span className="font-mono font-bold text-white">
                      {inspectModalBackup.data?.databaseModules?.appForms?.length || 0} Formulare
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#12131a] border border-[#1e1f2b] rounded-xl flex items-center justify-between">
                    <span className="text-zinc-300">Willkommens-Nachrichten:</span>
                    <span className="font-mono font-bold text-white">
                      {inspectModalBackup.data?.databaseModules?.welcomeSetting ? "Konfiguriert" : "Nein"}
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#12131a] border border-[#1e1f2b] rounded-xl flex items-center justify-between">
                    <span className="text-zinc-300">Auto-Reaktionen:</span>
                    <span className="font-mono font-bold text-white">
                      {inspectModalBackup.data?.databaseModules?.autoReacts?.length || 0} Regeln
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#1e1f2b] bg-[#08090e] flex items-center justify-end">
              <button
                onClick={() => setInspectModalBackup(null)}
                className="px-4 py-2 bg-[#12131a] hover:bg-[#1e1f2b] text-white rounded-xl text-xs font-semibold"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT BACKUP MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0c0d14] border border-[#1e1f2b] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e1f2b] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-400" /> JSON-Backup importieren
              </h3>
              <button onClick={() => setIsImportModalOpen(false)} className="p-1 text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                  JSON-Datei hochladen
                </label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="w-full bg-[#12131a] border border-[#27272a] text-zinc-200 text-xs rounded-xl p-2.5 outline-none file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white cursor-pointer"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                  Oder JSON-Inhalt einfügen
                </label>
                <textarea
                  rows={4}
                  placeholder='{"guild": { ... }, "channels": [ ... ]}'
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  className="w-full bg-[#12131a] border border-[#27272a] focus:border-emerald-500 text-zinc-100 rounded-xl p-3 font-mono text-[10px] outline-none resize-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                  Backup-Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="z. B. Importiertes Server-Backup"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  className="w-full bg-[#12131a] border border-[#27272a] focus:border-emerald-500 text-zinc-100 rounded-xl px-3.5 py-2.5 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1e1f2b]">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-3.5 py-2 text-zinc-400 hover:text-white rounded-xl"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={importing || !importJsonText.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5"
                >
                  {importing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>{importing ? "Importiere..." : "Importieren"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
