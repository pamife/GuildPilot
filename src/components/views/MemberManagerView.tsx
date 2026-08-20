"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  Search,
  Shield,
  Clock,
  Ban,
  UserMinus,
  MessageSquare,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Edit3,
  RefreshCw,
  Copy,
  Check,
  X,
  AlertTriangle,
  Crown,
  Bot,
  Sparkles,
  ChevronDown,
  MoreVertical,
  Plus,
  Send,
  Trash2,
  UserCheck,
  CheckSquare,
  Square,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "../ToastContainer";

export interface MemberDTO {
  id: string;
  user: {
    id: string;
    username: string;
    discriminator: string;
    globalName: string | null;
    bot: boolean;
    avatar: string | null;
    createdAt: string;
  };
  displayName: string;
  nickname: string | null;
  avatar: string | null;
  roles: Array<{
    id: string;
    name: string;
    color: string;
    position: number;
    managed: boolean;
  }>;
  highestRole: {
    id: string;
    name: string;
    color: string;
    position: number;
  };
  joinedAt: string | null;
  isOwner: boolean;
  isTimedOut: boolean;
  communicationDisabledUntil: string | null;
  premiumSince: string | null;
  voice: {
    channelId: string;
    channelName: string;
    mute: boolean;
    deaf: boolean;
    selfMute: boolean;
    selfDeaf: boolean;
  } | null;
  manageable: boolean;
  kickable: boolean;
  bannable: boolean;
  moderatable: boolean;
}

interface BanItem {
  user: {
    id: string;
    username: string;
    discriminator: string;
    globalName: string | null;
    avatar: string | null;
    bot: boolean;
  };
  reason: string;
}

interface RoleItem {
  id: string;
  name: string;
  color: string;
  position: number;
  managed?: boolean;
}

interface ChannelItem {
  id: string;
  name: string;
  type: number;
}

interface MemberManagerViewProps {
  selectedGuildId: string | null;
  roles: RoleItem[];
  channels: ChannelItem[];
}

export function MemberManagerView({
  selectedGuildId,
  roles,
  channels,
}: MemberManagerViewProps) {
  const { showToast } = useToast();

  const [members, setMembers] = useState<MemberDTO[]>([]);
  const [bans, setBans] = useState<BanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [bansLoading, setBansLoading] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("all");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<"all" | "humans" | "bots" | "boosters" | "timedout">("all");
  const [sortBy, setSortBy] = useState<"joined_desc" | "joined_asc" | "created_desc" | "created_asc" | "name_asc" | "name_desc" | "roles_desc">("joined_desc");

  // Selection for bulk actions
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());

  // Modals state
  const [nicknameModalMember, setNicknameModalMember] = useState<MemberDTO | null>(null);
  const [newNickname, setNewNickname] = useState("");

  const [rolesModalMember, setRolesModalMember] = useState<MemberDTO | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  const [timeoutModalMember, setTimeoutModalMember] = useState<MemberDTO | null>(null);
  const [timeoutDuration, setTimeoutDuration] = useState<number>(10); // minutes
  const [timeoutReason, setTimeoutReason] = useState("");

  const [kickModalMember, setKickModalMember] = useState<MemberDTO | null>(null);
  const [kickReason, setKickReason] = useState("");

  const [banModalMember, setBanModalMember] = useState<MemberDTO | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banDeleteSeconds, setBanDeleteSeconds] = useState<number>(0);

  const [dmModalMember, setDmModalMember] = useState<MemberDTO | null>(null);
  const [dmMessage, setDmMessage] = useState("");

  const [voiceModalMember, setVoiceModalMember] = useState<MemberDTO | null>(null);
  const [targetVoiceChannelId, setTargetVoiceChannelId] = useState("");

  const [isBansModalOpen, setIsBansModalOpen] = useState(false);
  const [banSearchQuery, setBanSearchQuery] = useState("");

  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<"addRole" | "removeRole" | "timeout" | "removeTimeout" | "kick">("addRole");
  const [bulkRoleId, setBulkRoleId] = useState("");
  const [bulkDurationMinutes, setBulkDurationMinutes] = useState(10);
  const [bulkReason, setBulkReason] = useState("");

  // Fetch members
  const fetchMembers = useCallback(async () => {
    if (!selectedGuildId) return;
    setLoading(true);
    try {
      const res = await api.get(`/guilds/${selectedGuildId}/members?limit=1000`);
      setMembers(res.data);
    } catch (err: any) {
      showToast(err.response?.data?.error || "Fehler beim Laden der Mitglieder.", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedGuildId, showToast]);

  // Fetch bans
  const fetchBans = useCallback(async () => {
    if (!selectedGuildId) return;
    setBansLoading(true);
    try {
      const res = await api.get(`/guilds/${selectedGuildId}/bans`);
      setBans(res.data);
    } catch (err: any) {
      console.warn("Bans could not be fetched:", err.message);
    } finally {
      setBansLoading(false);
    }
  }, [selectedGuildId]);

  useEffect(() => {
    fetchMembers();
    fetchBans();
    setSelectedMemberIds(new Set());
  }, [selectedGuildId, fetchMembers, fetchBans]);

  // Filtered & sorted members
  const filteredMembers = useMemo(() => {
    return members
      .filter((m) => {
        // Query search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchUsername = m.user.username.toLowerCase().includes(q);
          const matchNick = m.nickname ? m.nickname.toLowerCase().includes(q) : false;
          const matchDisplay = m.displayName.toLowerCase().includes(q);
          const matchId = m.id.includes(q);
          if (!matchUsername && !matchNick && !matchDisplay && !matchId) return false;
        }

        // Role filter
        if (selectedRoleFilter !== "all") {
          if (!m.roles.some((r) => r.id === selectedRoleFilter)) return false;
        }

        // Type filter
        if (selectedTypeFilter === "humans" && m.user.bot) return false;
        if (selectedTypeFilter === "bots" && !m.user.bot) return false;
        if (selectedTypeFilter === "boosters" && !m.premiumSince) return false;
        if (selectedTypeFilter === "timedout" && !m.isTimedOut) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "joined_desc") {
          return new Date(b.joinedAt || 0).getTime() - new Date(a.joinedAt || 0).getTime();
        }
        if (sortBy === "joined_asc") {
          return new Date(a.joinedAt || 0).getTime() - new Date(b.joinedAt || 0).getTime();
        }
        if (sortBy === "created_desc") {
          return new Date(b.user.createdAt).getTime() - new Date(a.user.createdAt).getTime();
        }
        if (sortBy === "created_asc") {
          return new Date(a.user.createdAt).getTime() - new Date(b.user.createdAt).getTime();
        }
        if (sortBy === "name_asc") {
          return a.displayName.localeCompare(b.displayName);
        }
        if (sortBy === "name_desc") {
          return b.displayName.localeCompare(a.displayName);
        }
        if (sortBy === "roles_desc") {
          return b.roles.length - a.roles.length;
        }
        return 0;
      });
  }, [members, searchQuery, selectedRoleFilter, selectedTypeFilter, sortBy]);

  // Bulk selection handlers
  const toggleSelectMember = (id: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedMemberIds.size === filteredMembers.length && filteredMembers.length > 0) {
      setSelectedMemberIds(new Set());
    } else {
      setSelectedMemberIds(new Set(filteredMembers.map((m) => m.id)));
    }
  };

  // Helper copy ID
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} in die Zwischenablage kopiert!`, "info");
  };

  // Nickname Submit
  const handleSaveNickname = async () => {
    if (!nicknameModalMember || !selectedGuildId) return;
    try {
      const res = await api.patch(
        `/guilds/${selectedGuildId}/members/${nicknameModalMember.id}/nickname`,
        { nickname: newNickname }
      );
      setMembers((prev) => prev.map((m) => (m.id === nicknameModalMember.id ? res.data : m)));
      showToast(`Nickname für @${nicknameModalMember.displayName} aktualisiert!`, "success");
      setNicknameModalMember(null);
    } catch (err: any) {
      showToast(err.response?.data?.error || "Fehler beim Ändern des Nicknames.", "error");
    }
  };

  // Roles Submit
  const handleSaveRoles = async () => {
    if (!rolesModalMember || !selectedGuildId) return;
    try {
      const res = await api.put(
        `/guilds/${selectedGuildId}/members/${rolesModalMember.id}/roles`,
        { roleIds: selectedRoleIds }
      );
      setMembers((prev) => prev.map((m) => (m.id === rolesModalMember.id ? res.data : m)));
      showToast(`Rollen für @${rolesModalMember.displayName} erfolgreich aktualisiert!`, "success");
      setRolesModalMember(null);
    } catch (err: any) {
      showToast(err.response?.data?.error || "Fehler beim Speichern der Rollen.", "error");
    }
  };

  // Timeout Submit
  const handleSaveTimeout = async (durationMins: number) => {
    if (!timeoutModalMember || !selectedGuildId) return;
    try {
      const res = await api.post(
        `/guilds/${selectedGuildId}/members/${timeoutModalMember.id}/timeout`,
        { durationMinutes: durationMins, reason: timeoutReason }
      );
      setMembers((prev) => prev.map((m) => (m.id === timeoutModalMember.id ? res.data : m)));
      showToast(
        durationMins <= 0
          ? `Timeout für @${timeoutModalMember.displayName} entfernt!`
          : `Timeout (${durationMins}m) für @${timeoutModalMember.displayName} verhängt!`,
        "success"
      );
      setTimeoutModalMember(null);
      setTimeoutReason("");
    } catch (err: any) {
      showToast(err.response?.data?.error || "Fehler beim Anpassen des Timeouts.", "error");
    }
  };

  // Kick Submit
  const handleKick = async () => {
    if (!kickModalMember || !selectedGuildId) return;
    try {
      await api.post(`/guilds/${selectedGuildId}/members/${kickModalMember.id}/kick`, {
        reason: kickReason,
      });
      setMembers((prev) => prev.filter((m) => m.id !== kickModalMember.id));
      showToast(`@${kickModalMember.displayName} wurde vom Server gekickt!`, "success");
      setKickModalMember(null);
      setKickReason("");
    } catch (err: any) {
      showToast(err.response?.data?.error || "Fehler beim Kicken des Mitglieds.", "error");
    }
  };

  // Ban Submit
  const handleBan = async () => {
    if (!banModalMember || !selectedGuildId) return;
    try {
      await api.post(`/guilds/${selectedGuildId}/members/${banModalMember.id}/ban`, {
        deleteMessageSeconds: banDeleteSeconds,
        reason: banReason,
      });
      setMembers((prev) => prev.filter((m) => m.id !== banModalMember.id));
      fetchBans();
      showToast(`@${banModalMember.displayName} wurde vom Server gebannt!`, "success");
      setBanModalMember(null);
      setBanReason("");
    } catch (err: any) {
      showToast(err.response?.data?.error || "Fehler beim Bannen des Mitglieds.", "error");
    }
  };

  // Unban
  const handleUnban = async (userId: string, username: string) => {
    if (!selectedGuildId) return;
    try {
      await api.post(`/guilds/${selectedGuildId}/bans/${userId}/unban`);
      setBans((prev) => prev.filter((b) => b.user.id !== userId));
      showToast(`@${username} wurde erfolgreich entbannt!`, "success");
    } catch (err: any) {
      showToast(err.response?.data?.error || "Fehler beim Entbannen.", "error");
    }
  };

  // Send DM Submit
  const handleSendDM = async () => {
    if (!dmModalMember || !selectedGuildId) return;
    try {
      await api.post(`/guilds/${selectedGuildId}/members/${dmModalMember.id}/dm`, {
        message: dmMessage,
      });
      showToast(`Direktnachricht an @${dmModalMember.displayName} gesendet!`, "success");
      setDmModalMember(null);
      setDmMessage("");
    } catch (err: any) {
      showToast(err.response?.data?.error || "Fehler beim Senden der Direktnachricht (DMs eventuell geschlossen).", "error");
    }
  };

  // Voice Moderation
  const handleVoiceAction = async (action: "disconnect" | "mute" | "unmute" | "deaf" | "undeaf" | "move") => {
    if (!voiceModalMember || !selectedGuildId) return;
    try {
      const res = await api.post(`/guilds/${selectedGuildId}/members/${voiceModalMember.id}/voice`, {
        action,
        targetChannelId: targetVoiceChannelId,
      });
      setMembers((prev) => prev.map((m) => (m.id === voiceModalMember.id ? res.data : m)));
      showToast(`Voice-Aktion (${action}) erfolgreich ausgeführt!`, "success");
      if (action === "disconnect") setVoiceModalMember(null);
    } catch (err: any) {
      showToast(err.response?.data?.error || "Fehler bei der Sprachkanal-Aktion.", "error");
    }
  };

  // Bulk Action Execute
  const handleExecuteBulk = async () => {
    if (!selectedGuildId || selectedMemberIds.size === 0) return;
    try {
      const res = await api.post(`/guilds/${selectedGuildId}/members/bulk`, {
        memberIds: Array.from(selectedMemberIds),
        action: bulkActionType,
        roleId: bulkRoleId,
        durationMinutes: bulkDurationMinutes,
        reason: bulkReason,
      });

      showToast(
        `Massen-Aktion abgeschlossen: ${res.data.successful} erfolgreich, ${res.data.failed} fehlgeschlagen.`,
        res.data.failed === 0 ? "success" : "info"
      );
      setIsBulkModalOpen(false);
      setSelectedMemberIds(new Set());
      fetchMembers();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Fehler bei der Massen-Aktion.", "error");
    }
  };

  // Voice channels for move target
  const voiceChannels = useMemo(() => {
    return channels.filter((c) => c.type === 2); // ChannelType.GuildVoice = 2
  }, [channels]);

  // Statistics
  const stats = useMemo(() => {
    const total = members.length;
    const humans = members.filter((m) => !m.user.bot).length;
    const bots = members.filter((m) => m.user.bot).length;
    const boosters = members.filter((m) => m.premiumSince).length;
    const timedOut = members.filter((m) => m.isTimedOut).length;
    const inVoice = members.filter((m) => m.voice !== null).length;
    const banned = bans.length;
    return { total, humans, bots, boosters, timedOut, inVoice, banned };
  }, [members, bans]);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#090a0f] text-zinc-200 select-none">
      {/* Top Header */}
      <div className="p-5 border-b border-[#18181b] bg-[#050507] shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-discord-brand/20 border border-discord-brand/40 text-discord-brand shadow-inner">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Mitglieder-Manager
                <span className="text-xs font-mono font-normal bg-[#18181b] border border-[#27272a] text-zinc-400 px-2.5 py-0.5 rounded-full">
                  {members.length} Mitglieder geladen
                </span>
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Vollständige Server-Mitgliederverwaltung: Rollen, Nicknames, Timeouts, Kicks, Bans und Voice.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              fetchBans();
              setIsBansModalOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#12131a] hover:bg-[#1c1d28] border border-[#27272a] hover:border-rose-500/50 text-xs font-semibold text-zinc-300 hover:text-rose-300 transition-all shadow-sm cursor-pointer"
          >
            <Ban className="w-4 h-4 text-rose-400" />
            <span>Bans verwalten</span>
            <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold">
              {stats.banned}
            </span>
          </button>

          <button
            onClick={fetchMembers}
            disabled={loading}
            title="Mitgliederliste aktualisieren"
            className="p-2.5 rounded-xl bg-[#12131a] hover:bg-[#1c1d28] border border-[#27272a] text-zinc-400 hover:text-white transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-discord-brand" : ""}`} />
          </button>
        </div>
      </div>

      {/* Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 p-4 bg-[#07070a] border-b border-[#18181b] text-xs">
        <div className="p-2.5 rounded-xl bg-[#0e0f17] border border-[#1e1f2b] flex items-center justify-between">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-indigo-400" /> Gesamt
          </span>
          <span className="font-bold text-white font-mono">{stats.total}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-[#0e0f17] border border-[#1e1f2b] flex items-center justify-between">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" /> Menschen
          </span>
          <span className="font-bold text-emerald-300 font-mono">{stats.humans}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-[#0e0f17] border border-[#1e1f2b] flex items-center justify-between">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-sky-400" /> Bots
          </span>
          <span className="font-bold text-sky-300 font-mono">{stats.bots}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-[#0e0f17] border border-[#1e1f2b] flex items-center justify-between">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-pink-400" /> Booster
          </span>
          <span className="font-bold text-pink-300 font-mono">{stats.boosters}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-[#0e0f17] border border-[#1e1f2b] flex items-center justify-between">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-teal-400" /> Im Voice
          </span>
          <span className="font-bold text-teal-300 font-mono">{stats.inVoice}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-[#0e0f17] border border-[#1e1f2b] flex items-center justify-between">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" /> Timeouts
          </span>
          <span className="font-bold text-amber-300 font-mono">{stats.timedOut}</span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-4 bg-[#090a0f] border-b border-[#18181b] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[300px]">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Suchen nach Name, Nickname oder ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#12131a] border border-[#27272a] focus:border-discord-brand text-zinc-100 placeholder-zinc-500 rounded-xl pl-9 pr-8 py-2 text-xs transition-all outline-none"
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

          {/* Role Filter Dropdown */}
          <div className="relative">
            <select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              className="bg-[#12131a] border border-[#27272a] text-zinc-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-discord-brand cursor-pointer appearance-none pr-8"
            >
              <option value="all">Alle Rollen ({roles.length})</option>
              {roles
                .filter((r) => r.name !== "@everyone")
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    @{r.name}
                  </option>
                ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Member Type Filters */}
          <div className="flex items-center bg-[#12131a] border border-[#27272a] rounded-xl p-1 text-xs">
            {(
              [
                { id: "all", label: "Alle" },
                { id: "humans", label: "Menschen" },
                { id: "bots", label: "Bots" },
                { id: "boosters", label: "Booster" },
                { id: "timedout", label: "Timeouts" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTypeFilter(tab.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  selectedTypeFilter === tab.id
                    ? "bg-discord-brand text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sort Options */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider hidden sm:inline">
            Sortieren:
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-[#12131a] border border-[#27272a] text-zinc-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-discord-brand cursor-pointer"
          >
            <option value="joined_desc">Neueste Mitglieder zuerst</option>
            <option value="joined_asc">Älteste Mitglieder zuerst</option>
            <option value="name_asc">Name (A-Z)</option>
            <option value="name_desc">Name (Z-A)</option>
            <option value="roles_desc">Meiste Rollen</option>
            <option value="created_desc">Neueste Discord Accounts</option>
            <option value="created_asc">Älteste Discord Accounts</option>
          </select>
        </div>
      </div>

      {/* Members Table */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-500 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-discord-brand" />
            <p className="text-sm">Mitglieder werden geladen...</p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-500 gap-2 bg-[#0d0e15] border border-[#1e1f2b] rounded-2xl p-8 text-center">
            <Users className="w-10 h-10 text-zinc-600 mb-2" />
            <h3 className="text-sm font-bold text-zinc-300">Keine Mitglieder gefunden</h3>
            <p className="text-xs text-zinc-500 max-w-sm">
              Es gibt keine Treffer für deinen aktuellen Suchbegriff oder die ausgewählten Filter.
            </p>
          </div>
        ) : (
          <div className="bg-[#0c0d14] border border-[#1e1f2b] rounded-2xl overflow-hidden shadow-xl">
            {/* Table Header */}
            <div className="grid grid-cols-12 p-3 bg-[#08090e] border-b border-[#1e1f2b] text-[11px] font-bold uppercase tracking-wider text-zinc-500 items-center">
              <div className="col-span-1 flex items-center justify-center">
                <button
                  onClick={handleSelectAll}
                  className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  title="Alle auswählen"
                >
                  {selectedMemberIds.size === filteredMembers.length && filteredMembers.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-discord-brand" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </div>
              <div className="col-span-4">Mitglied & Account</div>
              <div className="col-span-3">Rollen</div>
              <div className="col-span-2">Voice & Status</div>
              <div className="col-span-2 text-right pr-2">Aktionen</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-[#181924]">
              {filteredMembers.map((member) => {
                const isSelected = selectedMemberIds.has(member.id);
                return (
                  <div
                    key={member.id}
                    className={`grid grid-cols-12 p-3 items-center text-xs transition-colors hover:bg-[#12131d] ${
                      isSelected ? "bg-discord-brand/10 border-l-2 border-discord-brand" : ""
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="col-span-1 flex items-center justify-center">
                      <button
                        onClick={() => toggleSelectMember(member.id)}
                        className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-discord-brand" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Member Info */}
                    <div className="col-span-4 flex items-center gap-3 pr-2 overflow-hidden">
                      <div className="relative shrink-0">
                        {member.avatar ? (
                          <img
                            src={member.avatar}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover border border-[#27272a]"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-discord-brand/20 border border-discord-brand/40 flex items-center justify-center font-bold text-discord-brand">
                            {member.displayName.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        {member.isOwner && (
                          <div
                            title="Server Owner"
                            className="absolute -top-1.5 -right-1.5 p-0.5 bg-amber-500 text-black rounded-full shadow"
                          >
                            <Crown className="w-3 h-3 fill-current" />
                          </div>
                        )}
                        {member.user.bot && (
                          <div
                            title="Bot Account"
                            className="absolute -bottom-1 -right-1 px-1 py-0.2 bg-indigo-600 text-white rounded text-[9px] font-bold uppercase tracking-wider shadow"
                          >
                            BOT
                          </div>
                        )}
                      </div>

                      <div className="truncate min-w-0">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-bold text-white truncate text-sm">
                            {member.displayName}
                          </span>
                          {member.nickname && (
                            <span className="text-[10px] text-zinc-500 truncate">
                              ({member.user.username})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
                          <button
                            onClick={() => copyToClipboard(member.id, "User-ID")}
                            className="hover:text-zinc-300 flex items-center gap-1 font-mono transition-colors"
                            title="ID kopieren"
                          >
                            <span>{member.id.substring(0, 6)}...{member.id.substring(member.id.length - 4)}</span>
                            <Copy className="w-2.5 h-2.5 opacity-60" />
                          </button>
                          <span>•</span>
                          <span>
                            Beigetreten:{" "}
                            {member.joinedAt
                              ? new Date(member.joinedAt).toLocaleDateString("de-DE", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "2-digit",
                                })
                              : "Unbekannt"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Roles Chips */}
                    <div className="col-span-3 flex flex-wrap items-center gap-1.5 pr-2">
                      {member.roles.slice(0, 3).map((r) => (
                        <span
                          key={r.id}
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold border flex items-center gap-1 max-w-[120px] truncate"
                          style={{
                            backgroundColor: `${r.color}15`,
                            borderColor: `${r.color}40`,
                            color: r.color,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: r.color }}
                          />
                          <span className="truncate">{r.name}</span>
                        </span>
                      ))}
                      {member.roles.length > 3 && (
                        <button
                          onClick={() => {
                            setRolesModalMember(member);
                            setSelectedRoleIds(member.roles.map((r) => r.id));
                          }}
                          className="px-1.5 py-0.5 rounded bg-[#181924] border border-[#27272a] text-[10px] text-zinc-400 hover:text-white"
                        >
                          +{member.roles.length - 3} weitere
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setRolesModalMember(member);
                          setSelectedRoleIds(member.roles.map((r) => r.id));
                        }}
                        title="Rollen anpassen"
                        className="p-1 rounded bg-[#181924] hover:bg-[#222332] text-zinc-400 hover:text-white border border-[#27272a] cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Voice & Status Badges */}
                    <div className="col-span-2 flex flex-col gap-1 pr-2">
                      {member.voice ? (
                        <button
                          onClick={() => {
                            setVoiceModalMember(member);
                            setTargetVoiceChannelId(member.voice?.channelId || "");
                          }}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold hover:bg-emerald-500/20 transition-all cursor-pointer truncate"
                          title="Voice-Moderation öffnen"
                        >
                          <Volume2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                          <span className="truncate">{member.voice.channelName}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-zinc-500">Nicht im Sprachkanal</span>
                      )}

                      {member.isTimedOut && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-400 font-bold bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded w-fit">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>Gemutet (Timeout)</span>
                        </span>
                      )}

                      {member.premiumSince && (
                        <span className="flex items-center gap-1 text-[10px] text-pink-400 font-bold bg-pink-500/10 border border-pink-500/30 px-1.5 py-0.5 rounded w-fit">
                          <Sparkles className="w-3 h-3 shrink-0" />
                          <span>Server Booster</span>
                        </span>
                      )}
                    </div>

                    {/* Actions Menu */}
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          setNicknameModalMember(member);
                          setNewNickname(member.nickname || "");
                        }}
                        title="Nickname bearbeiten"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1e1f2b] transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          setTimeoutModalMember(member);
                          setTimeoutDuration(10);
                          setTimeoutReason("");
                        }}
                        title={member.isTimedOut ? "Timeout entfernen" : "Timeout verhängen"}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          member.isTimedOut
                            ? "text-amber-400 hover:bg-amber-500/20"
                            : "text-zinc-400 hover:text-amber-300 hover:bg-[#1e1f2b]"
                        }`}
                      >
                        <Clock className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          setDmModalMember(member);
                          setDmMessage("");
                        }}
                        title="Direktnachricht senden"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-sky-300 hover:bg-[#1e1f2b] transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          setKickModalMember(member);
                          setKickReason("");
                        }}
                        title="Mitglied kicken"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-orange-400 hover:bg-orange-500/10 transition-colors cursor-pointer"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          setBanModalMember(member);
                          setBanReason("");
                          setBanDeleteSeconds(0);
                        }}
                        title="Mitglied bannen"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bulk Action Floating Toolbar */}
      {selectedMemberIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0b0c14] border border-discord-brand/50 rounded-2xl shadow-2xl p-3 flex items-center gap-3 z-40 animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2 pl-2 pr-3 border-r border-[#27272a] text-xs font-bold text-white">
            <CheckSquare className="w-4 h-4 text-discord-brand" />
            <span>{selectedMemberIds.size} ausgewählt</span>
          </div>

          <button
            onClick={() => {
              setBulkActionType("addRole");
              setIsBulkModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            + Rolle zuweisen
          </button>

          <button
            onClick={() => {
              setBulkActionType("removeRole");
              setIsBulkModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-[#1e1f2b] hover:bg-[#2a2b3c] text-zinc-200 font-semibold text-xs transition-colors cursor-pointer"
          >
            - Rolle entfernen
          </button>

          <button
            onClick={() => {
              setBulkActionType("timeout");
              setIsBulkModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-amber-600/80 hover:bg-amber-500 text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            ⏳ Massen-Timeout
          </button>

          <button
            onClick={() => {
              setBulkActionType("kick");
              setIsBulkModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-rose-600/80 hover:bg-rose-500 text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            👢 Massen-Kick
          </button>

          <button
            onClick={() => setSelectedMemberIds(new Set())}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-[#18181b] transition-colors ml-1 cursor-pointer"
            title="Auswahl aufheben"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* NICKNAME MODAL */}
      {nicknameModalMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0c0d14] border border-[#1e1f2b] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e1f2b] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-discord-brand" /> Nickname bearbeiten
              </h3>
              <button
                onClick={() => setNicknameModalMember(null)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <p className="text-xs text-zinc-400 mb-3">
                Server-Nickname für <strong className="text-white">@{nicknameModalMember.user.username}</strong> anpassen oder leeren, um den Standard-Namen wiederherzustellen.
              </p>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Nickname
              </label>
              <input
                type="text"
                placeholder={nicknameModalMember.user.username}
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                className="w-full bg-[#12131a] border border-[#27272a] focus:border-discord-brand text-zinc-100 rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#1e1f2b]">
              <button
                onClick={() => setNewNickname("")}
                className="text-xs text-zinc-400 hover:text-rose-400 transition-colors"
              >
                Zurücksetzen (Leeren)
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setNicknameModalMember(null)}
                  className="px-3.5 py-2 text-xs text-zinc-400 hover:text-white rounded-xl"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSaveNickname}
                  className="px-4 py-2 bg-discord-brand hover:bg-discord-brandHover text-white rounded-xl text-xs font-bold shadow-lg shadow-discord-brand/20 cursor-pointer"
                >
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ROLES MODAL */}
      {rolesModalMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0c0d14] border border-[#1e1f2b] rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-[#1e1f2b] bg-[#08090e]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Rollen verwalten: @{rolesModalMember.displayName}
                  </h3>
                  <p className="text-xs text-zinc-400">Rollen zuweisen oder entfernen</p>
                </div>
              </div>
              <button
                onClick={() => setRolesModalMember(null)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {roles
                .filter((r) => r.name !== "@everyone")
                .map((role) => {
                  const isChecked = selectedRoleIds.includes(role.id);
                  return (
                    <div
                      key={role.id}
                      onClick={() => {
                        setSelectedRoleIds((prev) =>
                          prev.includes(role.id)
                            ? prev.filter((id) => id !== role.id)
                            : [...prev, role.id]
                        );
                      }}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isChecked
                          ? "bg-discord-brand/10 border-discord-brand/50 text-white"
                          : "bg-[#12131a] border-[#1e1f2b] text-zinc-400 hover:border-[#27272a]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: role.color === "#000000" ? "#99aab5" : role.color }}
                        />
                        <span className="text-xs font-semibold text-zinc-200">@{role.name}</span>
                        {role.managed && (
                          <span className="text-[9px] bg-[#18181b] border border-[#27272a] text-zinc-500 px-1.5 py-0.5 rounded uppercase">
                            Managed
                          </span>
                        )}
                      </div>

                      <div
                        className={`w-5 h-5 rounded-lg flex items-center justify-center ${
                          isChecked ? "bg-discord-brand text-white" : "border border-[#27272a]"
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="p-4 border-t border-[#1e1f2b] bg-[#08090e] flex items-center justify-end gap-2">
              <button
                onClick={() => setRolesModalMember(null)}
                className="px-4 py-2 text-xs text-zinc-400 hover:text-white rounded-xl"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSaveRoles}
                className="px-4 py-2 bg-discord-brand hover:bg-discord-brandHover text-white rounded-xl text-xs font-bold shadow-lg shadow-discord-brand/20 cursor-pointer"
              >
                Änderungen speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TIMEOUT MODAL */}
      {timeoutModalMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0c0d14] border border-[#1e1f2b] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e1f2b] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" /> Timeout (Mute) verhängen
              </h3>
              <button
                onClick={() => setTimeoutModalMember(null)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-zinc-400">
                Nutzer <strong className="text-white">@{timeoutModalMember.displayName}</strong> vorübergehend stummschalten (kann keine Nachrichten senden, nicht im Voice sprechen).
              </p>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-2">
                  Dauer auswählen
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    { label: "60 Sekunden", mins: 1 },
                    { label: "5 Minuten", mins: 5 },
                    { label: "10 Minuten", mins: 10 },
                    { label: "1 Stunde", mins: 60 },
                    { label: "1 Tag", mins: 1440 },
                    { label: "1 Woche", mins: 10080 },
                  ].map((preset) => (
                    <button
                      key={preset.mins}
                      onClick={() => setTimeoutDuration(preset.mins)}
                      className={`p-2.5 rounded-xl border font-semibold transition-all cursor-pointer ${
                        timeoutDuration === preset.mins
                          ? "bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold"
                          : "bg-[#12131a] border-[#1e1f2b] text-zinc-400 hover:text-white"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                  Begründung (Optional)
                </label>
                <input
                  type="text"
                  placeholder="z. B. Spamming im Chat"
                  value={timeoutReason}
                  onChange={(e) => setTimeoutReason(e.target.value)}
                  className="w-full bg-[#12131a] border border-[#27272a] focus:border-amber-500 text-zinc-100 rounded-xl px-3.5 py-2.5 text-xs outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#1e1f2b]">
              {timeoutModalMember.isTimedOut ? (
                <button
                  onClick={() => handleSaveTimeout(0)}
                  className="px-3 py-2 bg-rose-600/20 border border-rose-500/40 text-rose-300 hover:bg-rose-600/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Timeout aufheben
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTimeoutModalMember(null)}
                  className="px-3.5 py-2 text-xs text-zinc-400 hover:text-white rounded-xl"
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => handleSaveTimeout(timeoutDuration)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-600/20 cursor-pointer"
                >
                  Timeout anwenden
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KICK MODAL */}
      {kickModalMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0c0d14] border border-[#1e1f2b] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e1f2b] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserMinus className="w-4 h-4 text-orange-400" /> Mitglied kicken
              </h3>
              <button
                onClick={() => setKickModalMember(null)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl text-xs text-orange-300 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Bist du sicher, dass du <strong className="text-white">@{kickModalMember.displayName}</strong> vom Server kicken möchtest? Der Nutzer kann mit einem neuen Invite wieder beitreten.
                </span>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                  Begründung (Optional)
                </label>
                <input
                  type="text"
                  placeholder="z. B. Regelverstoß"
                  value={kickReason}
                  onChange={(e) => setKickReason(e.target.value)}
                  className="w-full bg-[#12131a] border border-[#27272a] focus:border-orange-500 text-zinc-100 rounded-xl px-3.5 py-2.5 text-xs outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1e1f2b]">
              <button
                onClick={() => setKickModalMember(null)}
                className="px-3.5 py-2 text-xs text-zinc-400 hover:text-white rounded-xl"
              >
                Abbrechen
              </button>
              <button
                onClick={handleKick}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-orange-600/20 cursor-pointer"
              >
                Mitglied kicken
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BAN MODAL */}
      {banModalMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0c0d14] border border-[#1e1f2b] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e1f2b] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Ban className="w-4 h-4 text-rose-400" /> Mitglied bannen
              </h3>
              <button
                onClick={() => setBanModalMember(null)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Bist du sicher, dass du <strong className="text-white">@{banModalMember.displayName}</strong> permanent vom Server bannen möchtest?
                </span>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                  Nachrichtenverlauf löschen
                </label>
                <select
                  value={banDeleteSeconds}
                  onChange={(e) => setBanDeleteSeconds(Number(e.target.value))}
                  className="w-full bg-[#12131a] border border-[#27272a] text-zinc-200 text-xs rounded-xl p-2.5 outline-none focus:border-rose-500 cursor-pointer"
                >
                  <option value={0}>Keine Nachrichten löschen</option>
                  <option value={86400}>Letzte 24 Stunden löschen</option>
                  <option value={604800}>Letzte 7 Tage löschen</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                  Begründung (Optional)
                </label>
                <input
                  type="text"
                  placeholder="z. B. Schwerer Verstoß gegen Server-Richtlinien"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  className="w-full bg-[#12131a] border border-[#27272a] focus:border-rose-500 text-zinc-100 rounded-xl px-3.5 py-2.5 text-xs outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1e1f2b]">
              <button
                onClick={() => setBanModalMember(null)}
                className="px-3.5 py-2 text-xs text-zinc-400 hover:text-white rounded-xl"
              >
                Abbrechen
              </button>
              <button
                onClick={handleBan}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/20 cursor-pointer"
              >
                Dauerhaft bannen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DM MODAL */}
      {dmModalMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0c0d14] border border-[#1e1f2b] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e1f2b] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-sky-400" /> Direktnachricht senden
              </h3>
              <button
                onClick={() => setDmModalMember(null)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <p className="text-xs text-zinc-400 mb-2">
                Sende eine Direktnachricht als Bot an <strong className="text-white">@{dmModalMember.displayName}</strong>:
              </p>
              <textarea
                rows={4}
                placeholder="Schreibe deine Nachricht..."
                value={dmMessage}
                onChange={(e) => setDmMessage(e.target.value)}
                className="w-full bg-[#12131a] border border-[#27272a] focus:border-sky-500 text-zinc-100 rounded-xl p-3 text-xs outline-none resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1e1f2b]">
              <button
                onClick={() => setDmModalMember(null)}
                className="px-3.5 py-2 text-xs text-zinc-400 hover:text-white rounded-xl"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSendDM}
                disabled={!dmMessage.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-sky-600/20 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" /> Nachricht senden
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOICE MODAL */}
      {voiceModalMember && voiceModalMember.voice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0c0d14] border border-[#1e1f2b] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e1f2b] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-emerald-400" /> Voice-Moderation: @{voiceModalMember.displayName}
              </h3>
              <button
                onClick={() => setVoiceModalMember(null)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[#12131a] border border-[#1e1f2b] rounded-xl flex items-center justify-between">
                <span className="text-zinc-400">Aktueller Sprachkanal:</span>
                <span className="font-bold text-white">{voiceModalMember.voice.channelName}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleVoiceAction(voiceModalMember.voice?.mute ? "unmute" : "mute")}
                  className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-semibold transition-all cursor-pointer ${
                    voiceModalMember.voice.mute
                      ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                      : "bg-[#12131a] border-[#1e1f2b] text-zinc-300 hover:text-white"
                  }`}
                >
                  {voiceModalMember.voice.mute ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  <span>{voiceModalMember.voice.mute ? "Server-Mute aufheben" : "Server Mute"}</span>
                </button>

                <button
                  onClick={() => handleVoiceAction(voiceModalMember.voice?.deaf ? "undeaf" : "deaf")}
                  className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-semibold transition-all cursor-pointer ${
                    voiceModalMember.voice.deaf
                      ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                      : "bg-[#12131a] border-[#1e1f2b] text-zinc-300 hover:text-white"
                  }`}
                >
                  {voiceModalMember.voice.deaf ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  <span>{voiceModalMember.voice.deaf ? "Taubschaltung aufheben" : "Server Deafen"}</span>
                </button>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                  In anderen Sprachkanal verschieben
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={targetVoiceChannelId}
                    onChange={(e) => setTargetVoiceChannelId(e.target.value)}
                    className="flex-1 bg-[#12131a] border border-[#27272a] text-zinc-200 text-xs rounded-xl p-2.5 outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {voiceChannels.map((c) => (
                      <option key={c.id} value={c.id}>
                        🔊 {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleVoiceAction("move")}
                    className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Verschieben
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => handleVoiceAction("disconnect")}
                  className="w-full py-2.5 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <VolumeX className="w-4 h-4" /> Aus dem Sprachkanal trennen (Disconnect)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BANS MODAL / MANAGER */}
      {isBansModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0c0d14] border border-[#1e1f2b] rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-[#1e1f2b] bg-[#08090e]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                  <Ban className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Bann-Manager ({bans.length})</h3>
                  <p className="text-xs text-zinc-400">Übersicht aller gebannten Nutzer und Entbann-Funktion</p>
                </div>
              </div>
              <button
                onClick={() => setIsBansModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-[#090a0f] border-b border-[#1e1f2b]">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Bann-Liste durchsuchen..."
                  value={banSearchQuery}
                  onChange={(e) => setBanSearchQuery(e.target.value)}
                  className="w-full bg-[#12131a] border border-[#27272a] focus:border-rose-500 text-zinc-100 placeholder-zinc-500 rounded-xl pl-9 pr-4 py-2 text-xs outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {bansLoading ? (
                <div className="flex items-center justify-center p-8 text-zinc-500">
                  <RefreshCw className="w-6 h-6 animate-spin text-rose-500 mr-2" />
                  <span className="text-xs">Lade Bans...</span>
                </div>
              ) : bans.length === 0 ? (
                <div className="text-center p-8 text-zinc-500 text-xs">
                  Keine gebannten Nutzer auf diesem Server vorhanden.
                </div>
              ) : (
                bans
                  .filter((b) => {
                    if (!banSearchQuery.trim()) return true;
                    const q = banSearchQuery.toLowerCase().trim();
                    return (
                      b.user.username.toLowerCase().includes(q) ||
                      b.user.id.includes(q) ||
                      b.reason.toLowerCase().includes(q)
                    );
                  })
                  .map((banItem) => (
                    <div
                      key={banItem.user.id}
                      className="p-3 bg-[#12131a] border border-[#1e1f2b] rounded-xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        {banItem.user.avatar ? (
                          <img
                            src={banItem.user.avatar}
                            alt=""
                            className="w-9 h-9 rounded-full object-cover border border-[#27272a]"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center font-bold text-rose-400">
                            {banItem.user.username.substring(0, 2).toUpperCase()}
                          </div>
                        )}

                        <div className="truncate">
                          <p className="font-bold text-white truncate">@{banItem.user.username}</p>
                          <p className="text-[11px] text-zinc-500 font-mono">{banItem.user.id}</p>
                          <p className="text-[11px] text-rose-400/80 mt-0.5 truncate">
                            Grund: {banItem.reason}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleUnban(banItem.user.id, banItem.user.username)}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold shrink-0 transition-colors cursor-pointer"
                      >
                        Entbannen
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* BULK ACTION MODAL */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0c0d14] border border-[#1e1f2b] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e1f2b] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-discord-brand" /> Massen-Aktion für {selectedMemberIds.size} Mitglieder
              </h3>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                  Aktion
                </label>
                <select
                  value={bulkActionType}
                  onChange={(e) => setBulkActionType(e.target.value as any)}
                  className="w-full bg-[#12131a] border border-[#27272a] text-zinc-200 text-xs rounded-xl p-2.5 outline-none focus:border-discord-brand cursor-pointer"
                >
                  <option value="addRole">Rolle hinzufügen</option>
                  <option value="removeRole">Rolle entfernen</option>
                  <option value="timeout">Timeout verhängen</option>
                  <option value="removeTimeout">Timeout entfernen</option>
                  <option value="kick">Mitglieder kicken</option>
                </select>
              </div>

              {(bulkActionType === "addRole" || bulkActionType === "removeRole") && (
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                    Rolle auswählen
                  </label>
                  <select
                    value={bulkRoleId}
                    onChange={(e) => setBulkRoleId(e.target.value)}
                    className="w-full bg-[#12131a] border border-[#27272a] text-zinc-200 text-xs rounded-xl p-2.5 outline-none focus:border-discord-brand cursor-pointer"
                  >
                    <option value="">-- Rolle wählen --</option>
                    {roles
                      .filter((r) => r.name !== "@everyone")
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          @{r.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {bulkActionType === "timeout" && (
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                    Timeout-Dauer (Minuten)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={40320}
                    value={bulkDurationMinutes}
                    onChange={(e) => setBulkDurationMinutes(Number(e.target.value))}
                    className="w-full bg-[#12131a] border border-[#27272a] focus:border-amber-500 text-zinc-100 rounded-xl px-3.5 py-2.5 text-xs outline-none"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                  Begründung (Optional)
                </label>
                <input
                  type="text"
                  placeholder="z. B. Massen-Aktion via Dashboard"
                  value={bulkReason}
                  onChange={(e) => setBulkReason(e.target.value)}
                  className="w-full bg-[#12131a] border border-[#27272a] focus:border-discord-brand text-zinc-100 rounded-xl px-3.5 py-2.5 text-xs outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1e1f2b]">
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="px-3.5 py-2 text-xs text-zinc-400 hover:text-white rounded-xl"
              >
                Abbrechen
              </button>
              <button
                onClick={handleExecuteBulk}
                className="px-4 py-2 bg-discord-brand hover:bg-discord-brandHover text-white rounded-xl text-xs font-bold shadow-lg shadow-discord-brand/20 cursor-pointer"
              >
                Aktion für {selectedMemberIds.size} Mitglieder ausführen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
