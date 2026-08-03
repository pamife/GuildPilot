"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ToastProvider, useToast } from "@/components/ToastContainer";
import { Sidebar, ViewType } from "@/components/Sidebar";
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
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { ShieldAlert, LogIn, Radio, RefreshCw, Sparkles, CheckCircle2 } from "lucide-react";

function DashboardContent() {
  const { showToast } = useToast();

  const [currentView, setCurrentView] = useState<ViewType>("overview");
  const [ownerUser, setOwnerUser] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

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

  // Check auth status
  const checkAuth = async () => {
    setLoadingAuth(true);
    try {
      const res = await api.get("/auth/me");
      setOwnerUser(res.data.user);
      setAuthError(null);
    } catch (err: any) {
      console.warn("Auth check failed:", err.response?.data || err.message);
      setAuthError(err.response?.data?.error || "Please authenticate to access GuildPilot.");
    } finally {
      setLoadingAuth(false);
    }
  };

  // Fetch server update notification
  const fetchUpdateNotification = async () => {
    try {
      const res = await api.get("/host-server/updates");
      if (res.data && res.data.unread) {
        setUpdateNotification(res.data);
      }
    } catch (err) {
      // Ignore update check error
    }
  };

  const handleDismissUpdate = async () => {
    try {
      await api.post("/host-server/updates/read");
      setUpdateNotification(null);
    } catch (e) {
      setUpdateNotification(null);
    }
  };

  // Fetch guilds list
  const fetchGuilds = async () => {
    try {
      const res = await api.get("/guilds");
      setGuilds(res.data);
      if (res.data.length > 0 && !selectedGuildId) {
        setSelectedGuildId(res.data[0].id);
      }
    } catch (err: any) {
      console.error("Failed to fetch guilds:", err);
    }
  };

  // Fetch details for selected guild
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
  }, []);

  useEffect(() => {
    if (ownerUser) {
      fetchGuilds();
      fetchUpdateNotification();
    }
  }, [ownerUser]);

  useEffect(() => {
    if (selectedGuildId) {
      fetchGuildData();
    }
  }, [selectedGuildId, fetchGuildData]);

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
      showToast(data.ready ? `Bot ${data.tag} is online` : "Bot disconnected", data.ready ? "success" : "error");
    };

    const handleUpdateNotification = (data: any) => {
      setUpdateNotification(data);
      showToast(
        data.message || `Server update installed (Commit: ${data.commitShort})`,
        data.status === "error" ? "error" : "success"
      );
    };

    const handleUpdateNotificationRead = () => {
      setUpdateNotification(null);
    };

    const handleLiveEvent = () => {
      fetchGuildData();
    };

    socket.on("botStatusChange", handleBotStatusChange);
    socket.on("updateNotification", handleUpdateNotification);
    socket.on("updateNotificationRead", handleUpdateNotificationRead);
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

    return () => {
      socket.off("botStatusChange", handleBotStatusChange);
      socket.off("updateNotification", handleUpdateNotification);
      socket.off("updateNotificationRead", handleUpdateNotificationRead);
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
    };
  }, [fetchGuildData, showToast]);

  const handleLogout = async () => {
    await api.post("/auth/logout");
    setOwnerUser(null);
    setAuthError("Logged out.");
  };

  // API Mutators
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

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-discord-darkest text-discord-header">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-10 h-10 animate-spin text-discord-brand" />
          <p className="text-base font-semibold">Initializing GuildPilot Local Dashboard...</p>
        </div>
      </div>
    );
  }

  // Auth Protection Splash Screen if not logged in
  if (!ownerUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-discord-darkest p-4">
        <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl max-w-md w-full p-8 text-center shadow-2xl space-y-6">
          <div className="w-16 h-16 bg-discord-brand/20 border border-discord-brand/40 text-discord-brand rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-discord-header">GuildPilot Local</h1>
            <p className="text-sm text-discord-muted mt-2">
              Personal Discord Server Management Dashboard. Access is restricted to the local bot owner.
            </p>
          </div>

          <a
            href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/auth/login`}
            className="flex items-center justify-center gap-2.5 w-full py-3 bg-discord-brand hover:bg-discord-brandHover text-white font-bold rounded-xl shadow-lg transition-all transform hover:scale-[1.02]"
          >
            <LogIn className="w-5 h-5" /> Login with Discord OAuth2
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-discord-dark">
      {/* Sidebar */}
      <Sidebar
        currentView={currentView}
        onSelectView={setCurrentView}
        guilds={guilds}
        selectedGuildId={selectedGuildId}
        onSelectGuild={setSelectedGuildId}
        botStatus={botStatus}
        ownerUser={ownerUser}
        onLogout={handleLogout}
        onRefreshGuilds={fetchGuilds}
      />

      {/* Main View Shell */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#313338] overflow-hidden">
        {updateNotification && updateNotification.unread && (
          <div className="bg-gradient-to-r from-emerald-600 via-discord-brand to-emerald-700 text-white px-4 py-2.5 flex items-center justify-between text-sm font-medium shadow-lg border-b border-emerald-400/40 shrink-0 animate-in slide-in-from-top duration-300">
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
        {currentView === "host-server" && <HostServerView />}
        {currentView === "tickets" && (
          <TicketsView selectedGuildId={selectedGuildId} channels={channels} roles={roles} />
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
            channels={channels}
            roles={roles}
            emojis={emojis}
            onBulkCreateChannels={handleBulkCreateChannels}
            onBulkRenameChannels={handleBulkRenameChannels}
            onSearch={handleSearch}
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
