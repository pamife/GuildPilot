"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ToastProvider, useToast } from "@/components/ToastContainer";
import { Sidebar, ViewType } from "@/components/Sidebar";
import { LoginView } from "@/components/views/LoginView";
import { ServerSelectorView } from "@/components/views/ServerSelectorView";
import { OverviewView } from "@/components/views/OverviewView";
import { ChannelManagerView } from "@/components/views/ChannelManagerView";
import { CategoryManagerView } from "@/components/views/CategoryManagerView";
import { RoleManagerView } from "@/components/views/RoleManagerView";
import { ServerSettingsView } from "@/components/views/ServerSettingsView";
import { EmojiStickerManagerView } from "@/components/views/EmojiStickerManagerView";
import { InviteManagerView } from "@/components/views/InviteManagerView";
import { TemplatesView } from "@/components/views/TemplatesView";
import { UtilitiesView } from "@/components/views/UtilitiesView";
import { HostServerView } from "@/components/views/HostServerView";
import { TicketsView } from "@/components/views/TicketsView";
import { ApplicationsView } from "@/components/views/ApplicationsView";
import { SelfRolesView } from "@/components/views/SelfRolesView";
import { CustomMessagesView } from "@/components/views/CustomMessagesView";
import { WelcomeView } from "@/components/views/WelcomeView";
import { AutoReactView } from "@/components/views/AutoReactView";
import { ServerCloneView } from "@/components/views/ServerCloneView";
import { MemberManagerView } from "@/components/views/MemberManagerView";
import { BackupsView } from "@/components/views/BackupsView";
import { api, setAuthToken, getAuthToken } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { Sparkles, ArrowLeft, Crown } from "lucide-react";

type ScreenMode = "servers" | "guild" | "owner";

function DashboardContent() {
  const { showToast } = useToast();

  const [screenMode, setScreenMode] = useState<ScreenMode>("servers");
  const [currentView, setCurrentView] = useState<ViewType>("overview");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authWarning, setAuthWarning] = useState<string | null>(null);

  // Data states
  const [guilds, setGuilds] = useState<any[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState<string | null>(null);

  const [guildDetails, setGuildDetails] = useState<any>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [emojis, setEmojis] = useState<any[]>([]);
  const [stickers, setStickers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [botStatus, setBotStatus] = useState<{ ready: boolean; tag: string; ping: number } | null>(null);
  const [updateNotification, setUpdateNotification] = useState<any>(null);

  // 1. Initial Authentication Check
  const checkAuth = useCallback(async () => {
    setLoadingAuth(true);
    try {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get("token");
        if (urlToken) {
          setAuthToken(urlToken);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        const err = params.get("error");
        if (err) setAuthError(err);
        const warn = params.get("auth_warning");
        if (warn) setAuthWarning(warn);
      }

      const res = await api.get("/auth/me", { timeout: 5000 });
      if (res.data && res.data.user) {
        setCurrentUser(res.data.user);
        setIsOwner(res.data.isOwner || res.data.user.role === "OWNER");
        setAuthError(null);
      } else {
        setCurrentUser(null);
        setIsOwner(false);
      }
    } catch (err: any) {
      console.warn("[GuildPilot Auth] Check /auth/me error:", err?.response?.data || err?.message);
      setCurrentUser(null);
      setIsOwner(false);
    } finally {
      setLoadingAuth(false);
    }

  }, []);

  // 2. Fetch accessible guilds for the logged in user
  const fetchGuilds = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await api.get("/guilds");
      setGuilds(res.data || []);
    } catch (err: any) {
      console.error("Failed to fetch guilds:", err);
      showToast("Fehler beim Laden der Serverliste.", "error");
    }
  }, [currentUser, showToast]);

  // 3. Fetch server update notification (Owner Only)
  const fetchUpdateNotification = useCallback(async () => {
    if (!isOwner) return;
    try {
      const res = await api.get("/host-server/updates");
      if (res.data && res.data.unread) {
        setUpdateNotification(res.data);
      }
    } catch (err) {
      // Ignoriere Update-Prüffehler
    }
  }, [isOwner]);

  const handleDismissUpdate = async () => {
    try {
      await api.post("/host-server/updates/read");
      setUpdateNotification(null);
    } catch (e) {
      setUpdateNotification(null);
    }
  };

  // 4. Fetch details for selected guild
  const fetchGuildData = useCallback(async () => {
    if (!selectedGuildId) return;
    try {
      const [detailsRes, channelsRes, rolesRes, emojisRes, stickersRes, invitesRes, templatesRes] =
        await Promise.all([
          api.get(`/guilds/${selectedGuildId}`).catch(() => ({ data: null })),
          api.get(`/guilds/${selectedGuildId}/channels`).catch(() => ({ data: [] })),
          api.get(`/guilds/${selectedGuildId}/roles`).catch(() => ({ data: [] })),
          api.get(`/guilds/${selectedGuildId}/emojis`).catch(() => ({ data: [] })),
          api.get(`/guilds/${selectedGuildId}/stickers`).catch(() => ({ data: [] })),
          api.get(`/guilds/${selectedGuildId}/invites`).catch(() => ({ data: [] })),
          api.get(`/templates`).catch(() => ({ data: [] })),
        ]);

      if (detailsRes.data) {
        setGuildDetails(detailsRes.data);
        if (detailsRes.data.botStatus) {
          setBotStatus(detailsRes.data.botStatus);
        }
      }
      setChannels(channelsRes.data);
      setRoles(rolesRes.data);
      setEmojis(emojisRes.data);
      setStickers(stickersRes.data);
      setInvites(invitesRes.data);
      setTemplates(templatesRes.data);
    } catch (err) {
      console.error("Failed to load guild data:", err);
    }
  }, [selectedGuildId]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (currentUser) {
      fetchGuilds();
      fetchUpdateNotification();
    }
  }, [currentUser, fetchGuilds, fetchUpdateNotification]);

  useEffect(() => {
    if (selectedGuildId && screenMode === "guild") {
      fetchGuildData();
    }
  }, [selectedGuildId, screenMode, fetchGuildData]);

  // Socket.IO Room Management for Selected Guild
  useEffect(() => {
    if (!selectedGuildId || screenMode !== "guild") return;
    const socket = getSocket();
    socket.emit("joinGuild", { guildId: selectedGuildId });

    return () => {
      socket.emit("leaveGuild", { guildId: selectedGuildId });
    };
  }, [selectedGuildId, screenMode]);

  // Real-time Socket.IO Listeners
  useEffect(() => {
    const socket = getSocket();

    const handleBotStatusChange = (data: any) => {
      setBotStatus((prev) => ({
        ready: data.ready,
        tag: data.tag,
        ping: prev?.ping || 0,
      }));
      if (data.ready) {
        fetchGuilds();
      }
    };

    const handleUpdateNotification = (data: any) => {
      if (isOwner) {
        setUpdateNotification(data);
        showToast(
          data.message || `Server-Update installiert (Commit: ${data.commitShort})`,
          data.status === "error" ? "error" : "success"
        );
      }
    };

    const handleUpdateNotificationRead = () => {
      setUpdateNotification(null);
    };

    const handleLiveEvent = () => {
      fetchGuildData();
    };

    const handleSystemRestarting = (data: any) => {
      if (isOwner) {
        showToast(data.reason || "System wird neu gestartet...", "info");
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      }
    };

    socket.on("botStatusChange", handleBotStatusChange);
    socket.on("updateNotification", handleUpdateNotification);
    socket.on("updateNotificationRead", handleUpdateNotificationRead);
    socket.on("systemRestarting", handleSystemRestarting);
    socket.on("guildUpdate", handleLiveEvent);
    socket.on("channelCreate", handleLiveEvent);
    socket.on("channelUpdate", handleLiveEvent);
    socket.on("channelDelete", handleLiveEvent);
    socket.on("roleCreate", handleLiveEvent);
    socket.on("roleUpdate", handleLiveEvent);
    socket.on("roleDelete", handleLiveEvent);
    socket.on("emojiCreate", handleLiveEvent);
    socket.on("emojiDelete", handleLiveEvent);
    socket.on("stickerCreate", handleLiveEvent);
    socket.on("stickerDelete", handleLiveEvent);
    socket.on("inviteCreate", handleLiveEvent);
    socket.on("inviteDelete", handleLiveEvent);
    socket.on("guildMemberAdd", handleLiveEvent);
    socket.on("guildMemberRemove", handleLiveEvent);
    socket.on("guildMemberUpdate", handleLiveEvent);
    socket.on("guildBanAdd", handleLiveEvent);
    socket.on("guildBanRemove", handleLiveEvent);
    socket.on("guildCreate", () => {
      fetchGuilds();
      fetchGuildData();
    });
    socket.on("guildDelete", (data: any) => {
      fetchGuilds();
      fetchGuildData();
      showToast(`Bot wurde vom Server "${data?.name || ""}" entfernt.`, "info");
    });
    socket.on("backupCreated", (data: any) => {
      showToast(`Backup "${data.backupName || data.guildName}" gesichert.`, "success");
    });

    return () => {
      socket.off("botStatusChange", handleBotStatusChange);
      socket.off("updateNotification", handleUpdateNotification);
      socket.off("updateNotificationRead", handleUpdateNotificationRead);
      socket.off("systemRestarting", handleSystemRestarting);
      socket.off("guildUpdate", handleLiveEvent);
      socket.off("channelCreate", handleLiveEvent);
      socket.off("channelUpdate", handleLiveEvent);
      socket.off("channelDelete", handleLiveEvent);
      socket.off("roleCreate", handleLiveEvent);
      socket.off("roleUpdate", handleLiveEvent);
      socket.off("roleDelete", handleLiveEvent);
      socket.off("emojiCreate", handleLiveEvent);
      socket.off("emojiDelete", handleLiveEvent);
      socket.off("stickerCreate", handleLiveEvent);
      socket.off("stickerDelete", handleLiveEvent);
      socket.off("inviteCreate", handleLiveEvent);
      socket.off("inviteDelete", handleLiveEvent);
      socket.off("guildMemberAdd", handleLiveEvent);
      socket.off("guildMemberRemove", handleLiveEvent);
      socket.off("guildMemberUpdate", handleLiveEvent);
      socket.off("guildBanAdd", handleLiveEvent);
      socket.off("guildBanRemove", handleLiveEvent);
      socket.off("guildCreate");
      socket.off("guildDelete");
      socket.off("backupCreated");
    };
  }, [fetchGuildData, fetchGuilds, isOwner, showToast]);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (e) {}
    setAuthToken(null);
    setCurrentUser(null);
    setIsOwner(false);
    setSelectedGuildId(null);
    setScreenMode("servers");
  };

  // API Mutators for selected Guild
  const handleCreateChannel = async (data: any) => {
    await api.post(`/guilds/${selectedGuildId}/channels`, data);
    fetchGuildData();
  };

  const handleUpdateChannel = async (channelId: string, data: any) => {
    await api.patch(`/guilds/${selectedGuildId}/channels/${channelId}`, data);
    fetchGuildData();
  };

  const handleDeleteChannel = async (channelId: string) => {
    await api.delete(`/guilds/${selectedGuildId}/channels/${channelId}`);
    fetchGuildData();
  };

  const handleDuplicateChannel = async (channelId: string) => {
    await api.post(`/templates/guilds/${selectedGuildId}/duplicate-channel`, { channelId });
    fetchGuildData();
  };

  const handleDuplicateCategory = async (categoryId: string) => {
    await api.post(`/templates/guilds/${selectedGuildId}/duplicate-category`, { categoryId });
    fetchGuildData();
  };

  const handleCreateRole = async (data: any) => {
    await api.post(`/guilds/${selectedGuildId}/roles`, data);
    fetchGuildData();
  };

  const handleUpdateRole = async (roleId: string, data: any) => {
    await api.patch(`/guilds/${selectedGuildId}/roles/${roleId}`, data);
    fetchGuildData();
  };

  const handleReorderRoles = async (rolePositions: any[]) => {
    await api.put(`/guilds/${selectedGuildId}/roles/reorder`, { rolePositions });
    fetchGuildData();
  };

  const handleDeleteRole = async (roleId: string) => {
    await api.delete(`/guilds/${selectedGuildId}/roles/${roleId}`);
    fetchGuildData();
  };

  const handleSaveSettings = async (settings: any) => {
    await api.patch(`/guilds/${selectedGuildId}/settings`, settings);
    fetchGuildData();
  };

  const handleCreateEmoji = async (name: string, image: string) => {
    await api.post(`/guilds/${selectedGuildId}/emojis`, { name, image });
    fetchGuildData();
  };

  const handleUpdateEmoji = async (emojiId: string, name: string) => {
    await api.patch(`/guilds/${selectedGuildId}/emojis/${emojiId}`, { name });
    fetchGuildData();
  };

  const handleDeleteEmoji = async (emojiId: string) => {
    await api.delete(`/guilds/${selectedGuildId}/emojis/${emojiId}`);
    fetchGuildData();
  };

  const handleCreateSticker = async (data: any) => {
    await api.post(`/guilds/${selectedGuildId}/stickers`, data);
    fetchGuildData();
  };

  const handleDeleteSticker = async (stickerId: string) => {
    await api.delete(`/guilds/${selectedGuildId}/stickers/${stickerId}`);
    fetchGuildData();
  };

  const handleCreateInvite = async (data: any) => {
    await api.post(`/guilds/${selectedGuildId}/invites`, data);
    fetchGuildData();
  };

  const handleDeleteInvite = async (code: string) => {
    await api.delete(`/guilds/${selectedGuildId}/invites/${code}`);
    fetchGuildData();
  };

  const handleSaveTemplate = async (name: string, description: string) => {
    await api.post(`/templates/guilds/${selectedGuildId}/save`, { name, description });
    fetchGuildData();
  };

  const handleApplyTemplate = async (templateId: string) => {
    await api.post(`/templates/guilds/${selectedGuildId}/apply/${templateId}`);
    fetchGuildData();
  };

  const handleDeleteTemplate = async (templateId: string) => {
    await api.delete(`/templates/${templateId}`);
    fetchGuildData();
  };

  const handleBulkCreateChannels = async (channelsData: any[]) => {
    await api.post(`/utilities/${selectedGuildId}/bulk-channels`, { channels: channelsData });
    fetchGuildData();
  };

  const handleBulkRenameChannels = async (renames: any[]) => {
    await api.post(`/utilities/${selectedGuildId}/bulk-rename`, { renames });
    fetchGuildData();
  };

  const handleSearch = async (query: string) => {
    const res = await api.get(`/utilities/${selectedGuildId}/search?q=${encodeURIComponent(query)}`);
    return res.data;
  };

  // 1. Loading State
  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#07090e] text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
          <p className="text-xs font-medium">Lade GuildPilot...</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated -> Show Modern Login Page
  if (!currentUser) {
    return <LoginView authWarning={authWarning} authError={authError} />;
  }

  // 3. Server Selector Screen
  if (screenMode === "servers") {
    return (
      <ServerSelectorView
        user={currentUser}
        isOwner={isOwner}
        guilds={guilds}
        onSelectGuild={(id) => {
          setSelectedGuildId(id);
          setScreenMode("guild");
          setCurrentView("overview");
        }}
        onOpenOwnerDashboard={() => {
          setScreenMode("owner");
          setCurrentView("host-server");
        }}
        onLogout={handleLogout}
      />
    );
  }

  // 4. Owner Dashboard Screen (Exklusiv für Owner)
  if (screenMode === "owner" && isOwner) {
    return (
      <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col">
        {/* Owner Header */}
        <header className="border-b border-[#141b2b] bg-[#090d15]/95 px-6 h-16 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setScreenMode("servers")}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#111724] hover:bg-[#182238] border border-[#1e2a42] text-xs font-semibold text-slate-300 hover:text-white transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Server-Übersicht</span>
            </button>

            <div className="h-4 w-px bg-[#1e2a42]" />

            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-bold text-white">Owner Control Center</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                Live Telemetrie
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">{currentUser.username}</span>
            <button
              onClick={handleLogout}
              className="text-xs text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all"
            >
              Abmelden
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#07090e]">
          <HostServerView />
        </main>
      </div>
    );
  }

  // 5. Guild Management Dashboard Screen
  return (
    <div className="flex h-screen overflow-hidden bg-[#07090e]">
      {/* Sidebar */}
      <Sidebar
        currentView={currentView}
        onSelectView={setCurrentView}
        guilds={guilds}
        selectedGuildId={selectedGuildId}
        onSelectGuild={setSelectedGuildId}
        botStatus={botStatus}
        ownerUser={currentUser}
        isOwner={isOwner}
        onLogout={handleLogout}
        onRefreshGuilds={fetchGuilds}
        onBackToServers={() => setScreenMode("servers")}
      />

      {/* Main View Shell */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#07090e] overflow-hidden">
        {updateNotification && updateNotification.unread && isOwner && (
          <div className="bg-gradient-to-r from-emerald-600 via-indigo-600 to-emerald-700 text-white px-4 py-2.5 flex items-center justify-between text-sm font-medium shadow-lg border-b border-emerald-400/40 shrink-0 animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="p-1.5 rounded-lg bg-white/20 shrink-0">
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              </div>
              <div className="truncate">
                <span className="font-bold">{updateNotification.title || "GitHub Update Installed"}</span>:{" "}
                <span>{updateNotification.message}</span>
              </div>
              {updateNotification.commitShort && (
                <span className="text-xs font-mono bg-black/40 px-2 py-0.5 rounded text-emerald-200 shrink-0 border border-emerald-400/30">
                  commit {updateNotification.commitShort}
                </span>
              )}
            </div>
            <button
              onClick={handleDismissUpdate}
              className="text-xs bg-white/20 hover:bg-white/30 active:scale-95 text-white font-semibold px-3 py-1.5 rounded-lg transition-all shrink-0 flex items-center gap-1"
            >
              Als gelesen markieren
            </button>
          </div>
        )}

        {currentView === "host-server" && isOwner && <HostServerView />}
        {currentView === "members" && (
          <MemberManagerView
            selectedGuildId={selectedGuildId}
            roles={roles}
            channels={channels}
          />
        )}
        {currentView === "backups" && (
          <BackupsView
            guilds={guilds}
            selectedGuildId={selectedGuildId}
            onRefreshGuilds={fetchGuilds}
          />
        )}
        {currentView === "server-clone" && (
          <ServerCloneView
            guilds={guilds}
            selectedGuildId={selectedGuildId}
            onRefreshData={fetchGuildData}
            onNavigate={setCurrentView}
          />
        )}
        {currentView === "welcome" && (
          <WelcomeView
            channels={channels}
            roles={roles}
            selectedGuildId={selectedGuildId}
            botStatus={botStatus}
            guilds={guilds}
          />
        )}
        {currentView === "auto-react" && (
          <AutoReactView
            channels={channels}
            emojis={emojis}
            selectedGuildId={selectedGuildId}
            botStatus={botStatus}
            guilds={guilds}
          />
        )}
        {currentView === "custom-messages" && (
          <CustomMessagesView
            channels={channels}
            roles={roles}
            emojis={emojis}
            selectedGuildId={selectedGuildId}
            botStatus={botStatus}
            guilds={guilds}
          />
        )}
        {currentView === "applications" && (
          <ApplicationsView
            selectedGuildId={selectedGuildId}
            channels={channels}
            roles={roles}
            guilds={guilds}
          />
        )}
        {currentView === "tickets" && (
          <TicketsView
            selectedGuildId={selectedGuildId}
            channels={channels}
            roles={roles}
            guilds={guilds}
          />
        )}
        {currentView === "self-roles" && (
          <SelfRolesView selectedGuildId={selectedGuildId} channels={channels} roles={roles} />
        )}
        {currentView === "overview" && (
          <OverviewView
            guildDetails={guildDetails}
            onRefresh={fetchGuildData}
            onNavigate={setCurrentView}
          />
        )}
        {currentView === "channels" && (
          <ChannelManagerView
            channels={channels}
            roles={roles}
            onCreateChannel={handleCreateChannel}
            onUpdateChannel={handleUpdateChannel}
            onDeleteChannel={handleDeleteChannel}
            onDuplicateChannel={handleDuplicateChannel}
          />
        )}
        {currentView === "categories" && (
          <CategoryManagerView
            channels={channels}
            onCreateCategory={(name) => handleCreateChannel({ name, type: 4 })}
            onRenameCategory={(id, name) => handleUpdateChannel(id, { name })}
            onDeleteCategory={handleDeleteChannel}
            onMoveChannel={(channelId, parentId) => handleUpdateChannel(channelId, { parentId })}
          />
        )}
        {currentView === "roles" && (
          <RoleManagerView
            roles={roles}
            onCreateRole={handleCreateRole}
            onUpdateRole={handleUpdateRole}
            onReorderRoles={handleReorderRoles}
            onDeleteRole={handleDeleteRole}
          />
        )}
        {currentView === "settings" && (
          <ServerSettingsView
            guildDetails={guildDetails}
            channels={channels}
            onSaveSettings={handleSaveSettings}
          />
        )}
        {currentView === "emojis" && (
          <EmojiStickerManagerView
            emojis={emojis}
            stickers={stickers}
            onCreateEmoji={handleCreateEmoji}
            onUpdateEmoji={handleUpdateEmoji}
            onDeleteEmoji={handleDeleteEmoji}
            onCreateSticker={handleCreateSticker}
            onDeleteSticker={handleDeleteSticker}
          />
        )}
        {currentView === "stickers" && (
          <EmojiStickerManagerView
            emojis={emojis}
            stickers={stickers}
            onCreateEmoji={handleCreateEmoji}
            onUpdateEmoji={handleUpdateEmoji}
            onDeleteEmoji={handleDeleteEmoji}
            onCreateSticker={handleCreateSticker}
            onDeleteSticker={handleDeleteSticker}
          />
        )}
        {currentView === "invites" && (
          <InviteManagerView
            invites={invites}
            channels={channels}
            onCreateInvite={handleCreateInvite}
            onDeleteInvite={handleDeleteInvite}
          />
        )}
        {currentView === "templates" && (
          <TemplatesView
            templates={templates}
            channels={channels}
            onSaveTemplate={handleSaveTemplate}
            onApplyTemplate={handleApplyTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            onDuplicateChannel={handleDuplicateChannel}
            onDuplicateCategory={handleDuplicateCategory}
          />
        )}
        {currentView === "utilities" && (
          <UtilitiesView
            selectedGuildId={selectedGuildId}
            channels={channels}
            roles={roles}
            emojis={emojis}
            onBulkCreateChannels={handleBulkCreateChannels}
            onBulkRenameChannels={handleBulkRenameChannels}
            onSearch={handleSearch}
            onRefreshData={fetchGuildData}
          />
        )}
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <ToastProvider>
      <DashboardContent />
    </ToastProvider>
  );
}

