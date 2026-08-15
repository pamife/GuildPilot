"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  UserCheck,
  UserMinus,
  Save,
  Send,
  Hash,
  Palette,
  Image as ImageIcon,
  Shield,
  MessageSquare,
  Mail,
  HelpCircle,
  Eye,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastContainer";

interface WelcomeViewProps {
  selectedGuildId: string | null;
  channels: any[];
  roles: any[];
  botStatus: { ready: boolean; tag: string; ping: number } | null;
}

const PRESET_RING_COLORS = [
  { name: "Cyan", value: "#00d2d3" },
  { name: "Neon Blue", value: "#00e5ff" },
  { name: "Blurple", value: "#5865F2" },
  { name: "Emerald", value: "#22c55e" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Rose / Red", value: "#f43f5e" },
  { name: "Fuchsia", value: "#d946ef" },
  { name: "White", value: "#ffffff" },
];

export function WelcomeView({
  selectedGuildId,
  channels,
  roles,
  botStatus,
}: WelcomeViewProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<"welcome" | "leave">("welcome");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Welcome Settings State
  const [welcomeConfig, setWelcomeConfig] = useState({
    enabled: false,
    channelId: "",
    messageText: "Welcome {user} to **{server}**!",
    cardTitle: "Welcome @{username}",
    cardSubtitle: "Member #{memberCount}",
    avatarRingColor: "#00d2d3",
    cardBgColor: "#1e1f22",
    cardBorderColor: "#2b2d31",
    cardBgImage: "",
    sendCard: true,
    sendDm: false,
    dmText: "Welcome to {server}, {user}! We are thrilled to have you here.",
    autoRoles: [] as string[],
  });

  // Leave / Goodbye Settings State
  const [leaveConfig, setLeaveConfig] = useState({
    enabled: false,
    channelId: "",
    messageText: "**{username}** has left the server. We will miss you!",
    cardTitle: "Goodbye @{username}",
    cardSubtitle: "Left {server} • {memberCount} members remain",
    avatarRingColor: "#f43f5e",
    cardBgColor: "#1e1f22",
    cardBorderColor: "#2b2d31",
    cardBgImage: "",
    sendCard: true,
  });

  // Preview Image State
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generatingPreview, setGeneratingPreview] = useState(false);

  // Text channels for dropdown
  const textChannels = channels.filter((c) => c.type === 0 || c.type === 5);

  // Fetch settings from backend
  const fetchSettings = useCallback(async () => {
    if (!selectedGuildId) return;
    setLoading(true);
    try {
      const res = await api.get(`/guilds/${selectedGuildId}/welcome`);
      if (res.data.welcome) {
        let parsedRoles: string[] = [];
        try {
          parsedRoles = JSON.parse(res.data.welcome.autoRoles || "[]");
        } catch {}
        setWelcomeConfig({
          ...res.data.welcome,
          autoRoles: parsedRoles,
          channelId: res.data.welcome.channelId || "",
          cardBgImage: res.data.welcome.cardBgImage || "",
        });
      }
      if (res.data.leave) {
        setLeaveConfig({
          ...res.data.leave,
          channelId: res.data.leave.channelId || "",
          cardBgImage: res.data.leave.cardBgImage || "",
        });
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to load welcome settings", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedGuildId, showToast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Generate live card preview
  const generatePreview = useCallback(async () => {
    if (!selectedGuildId) return;
    setGeneratingPreview(true);
    try {
      const current = activeTab === "welcome" ? welcomeConfig : leaveConfig;
      const res = await api.post(
        `/guilds/${selectedGuildId}/welcome/preview`,
        {
          username: "megaloblatt",
          memberCount: 298,
          serverName: "TheGodGen",
          title: current.cardTitle.replace(/\{username\}/gi, "megaloblatt").replace(/\{memberCount\}/gi, "298").replace(/\{server\}/gi, "TheGodGen"),
          subtitle: current.cardSubtitle.replace(/\{username\}/gi, "megaloblatt").replace(/\{memberCount\}/gi, "298").replace(/\{server\}/gi, "TheGodGen"),
          avatarRingColor: current.avatarRingColor,
          cardBgColor: current.cardBgColor,
          cardBorderColor: current.cardBorderColor,
          cardBgImage: current.cardBgImage,
          mode: activeTab,
        },
        { responseType: "blob" }
      );

      const url = URL.createObjectURL(res.data);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch {
      // Ignore preview errors silently
    } finally {
      setGeneratingPreview(false);
    }
  }, [selectedGuildId, activeTab, welcomeConfig, leaveConfig]);

  useEffect(() => {
    const timer = setTimeout(() => {
      generatePreview();
    }, 400);
    return () => clearTimeout(timer);
  }, [generatePreview]);

  // Save Settings
  const handleSave = async () => {
    if (!selectedGuildId) return;
    setSaving(true);
    try {
      if (activeTab === "welcome") {
        await api.post(`/guilds/${selectedGuildId}/welcome`, welcomeConfig);
        showToast("Welcome settings saved successfully!", "success");
      } else {
        await api.post(`/guilds/${selectedGuildId}/leave`, leaveConfig);
        showToast("Goodbye settings saved successfully!", "success");
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  // Send Test Message to Discord
  const handleTest = async () => {
    if (!selectedGuildId) return;
    const current = activeTab === "welcome" ? welcomeConfig : leaveConfig;
    if (!current.channelId) {
      showToast("Please select a target Discord channel first!", "error");
      return;
    }

    setTesting(true);
    try {
      const endpoint =
        activeTab === "welcome"
          ? `/guilds/${selectedGuildId}/welcome/test`
          : `/guilds/${selectedGuildId}/leave/test`;

      const res = await api.post(endpoint, current);
      showToast(
        `Test message sent successfully to #${res.data.channelName || "channel"}!`,
        "success"
      );
    } catch (err: any) {
      showToast(
        err.response?.data?.error || "Failed to send test message",
        "error"
      );
    } finally {
      setTesting(false);
    }
  };

  const insertPlaceholder = (ph: string, field: "messageText" | "cardTitle" | "cardSubtitle" | "dmText") => {
    if (activeTab === "welcome") {
      setWelcomeConfig((prev) => ({
        ...prev,
        [field]: prev[field] + ph,
      }));
    } else {
      setLeaveConfig((prev) => ({
        ...prev,
        [field]: (prev as any)[field] + ph,
      }));
    }
  };

  const toggleAutoRole = (roleId: string) => {
    setWelcomeConfig((prev) => {
      const exists = prev.autoRoles.includes(roleId);
      return {
        ...prev,
        autoRoles: exists
          ? prev.autoRoles.filter((id) => id !== roleId)
          : [...prev.autoRoles, roleId],
      };
    });
  };

  const currentConfig = activeTab === "welcome" ? welcomeConfig : leaveConfig;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#1e1f22] text-zinc-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-[#2b2d31] bg-[#111214] flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-discord-brand/20 border border-cyan-500/30 text-cyan-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                Welcome & Goodbye Engine
              </h1>
              <p className="text-xs text-zinc-400">
                Automated greeting messages with custom image cards, glow rings & auto-roles
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleTest}
            disabled={testing || !currentConfig.channelId}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#2b2d31] hover:bg-[#35373c] text-white border border-[#3f4147] transition-all disabled:opacity-50"
            title="Send a live test message to your selected Discord channel"
          >
            {testing ? (
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
            ) : (
              <Send className="w-4 h-4 text-cyan-400" />
            )}
            <span>Send Test Message</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-discord-brand hover:bg-discord-brandHover text-white shadow-lg shadow-discord-brand/25 transition-all disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#2b2d31] bg-[#18191c] px-6">
        <button
          onClick={() => setActiveTab("welcome")}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
            activeTab === "welcome"
              ? "border-cyan-400 text-cyan-400 bg-[#1e1f22]/50"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Welcome Messages</span>
          {welcomeConfig.enabled && (
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("leave")}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
            activeTab === "leave"
              ? "border-rose-400 text-rose-400 bg-[#1e1f22]/50"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          <UserMinus className="w-4 h-4" />
          <span>Goodbye Messages (Bye)</span>
          {leaveConfig.enabled && (
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          )}
        </button>
      </div>

      {/* Main Content Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto divide-y lg:divide-y-0 lg:divide-x divide-[#2b2d31]">
        {/* Left Column: Settings Config */}
        <div className="lg:col-span-7 p-6 space-y-6 overflow-y-auto">
          {/* Discord Gateway Intent Reminder Alert */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-bold text-amber-300 block">
                Wichtiger Discord Bot Hinweis (Server Members Intent)
              </span>
              <p className="text-zinc-300 leading-relaxed">
                Damit Discord dem Bot mitteilt, wenn jemand dem Server beitritt oder ihn verlässt, muss im{" "}
                <a
                  href="https://discord.com/developers/applications"
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 underline font-semibold"
                >
                  Discord Developer Portal
                </a>{" "}
                unter <strong>Bot &gt; Privileged Gateway Intents</strong> die Option{" "}
                <strong className="text-amber-300">SERVER MEMBERS INTENT</strong> aktiviert sein.
              </p>
            </div>
          </div>

          {/* Main Toggle & Channel Picker */}
          <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-bold text-white block">
                  {activeTab === "welcome"
                    ? "Enable Welcome Messages"
                    : "Enable Goodbye Messages"}
                </label>
                <p className="text-xs text-zinc-400">
                  {activeTab === "welcome"
                    ? "Automatically send greetings when new members join your server"
                    : "Send notification messages when members leave your server"}
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    activeTab === "welcome"
                      ? welcomeConfig.enabled
                      : leaveConfig.enabled
                  }
                  onChange={(e) => {
                    if (activeTab === "welcome") {
                      setWelcomeConfig((prev) => ({
                        ...prev,
                        enabled: e.target.checked,
                      }));
                    } else {
                      setLeaveConfig((prev) => ({
                        ...prev,
                        enabled: e.target.checked,
                      }));
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            {/* Target Channel */}
            <div className="pt-3 border-t border-[#35373c]/60">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-zinc-400" />
                Target Discord Channel
              </label>
              <select
                value={
                  activeTab === "welcome"
                    ? welcomeConfig.channelId
                    : leaveConfig.channelId
                }
                onChange={(e) => {
                  if (activeTab === "welcome") {
                    setWelcomeConfig((prev) => ({
                      ...prev,
                      channelId: e.target.value,
                    }));
                  } else {
                    setLeaveConfig((prev) => ({
                      ...prev,
                      channelId: e.target.value,
                    }));
                  }
                }}
                className="w-full bg-[#1e1f22] border border-[#3f4147] rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="">Select a channel...</option>
                {textChannels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Text Message Configuration */}
          <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
                  Message Content (Top Text)
                </label>
              </div>
              <textarea
                rows={2}
                value={
                  activeTab === "welcome"
                    ? welcomeConfig.messageText
                    : leaveConfig.messageText
                }
                onChange={(e) => {
                  if (activeTab === "welcome") {
                    setWelcomeConfig((prev) => ({
                      ...prev,
                      messageText: e.target.value,
                    }));
                  } else {
                    setLeaveConfig((prev) => ({
                      ...prev,
                      messageText: e.target.value,
                    }));
                  }
                }}
                placeholder="Welcome {user} to {server}!"
                className="w-full bg-[#1e1f22] border border-[#3f4147] rounded-xl p-3 text-xs font-medium text-white focus:outline-none focus:border-cyan-400 resize-none font-mono"
              />
            </div>

            {/* Quick Placeholder Badges */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-zinc-400 font-semibold block">
                Click to insert variables:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {["{user}", "{username}", "{server}", "{memberCount}", "{memberOrdinal}"].map(
                  (ph) => (
                    <button
                      key={ph}
                      type="button"
                      onClick={() => insertPlaceholder(ph, "messageText")}
                      className="px-2.5 py-1 rounded-lg bg-[#1e1f22] hover:bg-[#35373c] border border-[#3f4147] text-[11px] font-mono text-cyan-400 transition-colors"
                    >
                      + {ph}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Card Customization */}
          <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-5 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">
                  Image Card Styling
                </h3>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <span className="text-xs font-semibold text-zinc-400 mr-2">
                  Attach Image Card
                </span>
                <input
                  type="checkbox"
                  checked={
                    activeTab === "welcome"
                      ? welcomeConfig.sendCard
                      : leaveConfig.sendCard
                  }
                  onChange={(e) => {
                    if (activeTab === "welcome") {
                      setWelcomeConfig((prev) => ({
                        ...prev,
                        sendCard: e.target.checked,
                      }));
                    } else {
                      setLeaveConfig((prev) => ({
                        ...prev,
                        sendCard: e.target.checked,
                      }));
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>

            {/* Card Texts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">
                  Card Main Title
                </label>
                <input
                  type="text"
                  value={
                    activeTab === "welcome"
                      ? welcomeConfig.cardTitle
                      : leaveConfig.cardTitle
                  }
                  onChange={(e) => {
                    if (activeTab === "welcome") {
                      setWelcomeConfig((prev) => ({
                        ...prev,
                        cardTitle: e.target.value,
                      }));
                    } else {
                      setLeaveConfig((prev) => ({
                        ...prev,
                        cardTitle: e.target.value,
                      }));
                    }
                  }}
                  className="w-full bg-[#1e1f22] border border-[#3f4147] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">
                  Card Subtitle
                </label>
                <input
                  type="text"
                  value={
                    activeTab === "welcome"
                      ? welcomeConfig.cardSubtitle
                      : leaveConfig.cardSubtitle
                  }
                  onChange={(e) => {
                    if (activeTab === "welcome") {
                      setWelcomeConfig((prev) => ({
                        ...prev,
                        cardSubtitle: e.target.value,
                      }));
                    } else {
                      setLeaveConfig((prev) => ({
                        ...prev,
                        cardSubtitle: e.target.value,
                      }));
                    }
                  }}
                  className="w-full bg-[#1e1f22] border border-[#3f4147] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {/* Avatar Ring Glow Color */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-300 block">
                Avatar Glow Ring Color
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {PRESET_RING_COLORS.map((preset) => {
                  const isSelected =
                    (activeTab === "welcome"
                      ? welcomeConfig.avatarRingColor
                      : leaveConfig.avatarRingColor) === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => {
                        if (activeTab === "welcome") {
                          setWelcomeConfig((prev) => ({
                            ...prev,
                            avatarRingColor: preset.value,
                          }));
                        } else {
                          setLeaveConfig((prev) => ({
                            ...prev,
                            avatarRingColor: preset.value,
                          }));
                        }
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                        isSelected
                          ? "border-white text-white font-bold bg-white/10 shadow-sm"
                          : "border-transparent text-zinc-400 hover:text-white bg-[#1e1f22]"
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: preset.value }}
                      />
                      <span>{preset.name}</span>
                    </button>
                  );
                })}

                {/* Custom Hex Picker */}
                <div className="flex items-center gap-1 bg-[#1e1f22] border border-[#3f4147] rounded-lg px-2 py-0.5">
                  <input
                    type="color"
                    value={
                      activeTab === "welcome"
                        ? welcomeConfig.avatarRingColor
                        : leaveConfig.avatarRingColor
                    }
                    onChange={(e) => {
                      if (activeTab === "welcome") {
                        setWelcomeConfig((prev) => ({
                          ...prev,
                          avatarRingColor: e.target.value,
                        }));
                      } else {
                        setLeaveConfig((prev) => ({
                          ...prev,
                          avatarRingColor: e.target.value,
                        }));
                      }
                    }}
                    className="w-5 h-5 bg-transparent border-0 cursor-pointer rounded"
                  />
                  <span className="text-[11px] font-mono text-zinc-400">
                    {activeTab === "welcome"
                      ? welcomeConfig.avatarRingColor
                      : leaveConfig.avatarRingColor}
                  </span>
                </div>
              </div>
            </div>

            {/* Background Customization */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">
                  Card Background Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={
                      activeTab === "welcome"
                        ? welcomeConfig.cardBgColor
                        : leaveConfig.cardBgColor
                    }
                    onChange={(e) => {
                      if (activeTab === "welcome") {
                        setWelcomeConfig((prev) => ({
                          ...prev,
                          cardBgColor: e.target.value,
                        }));
                      } else {
                        setLeaveConfig((prev) => ({
                          ...prev,
                          cardBgColor: e.target.value,
                        }));
                      }
                    }}
                    className="w-8 h-8 bg-transparent border-0 cursor-pointer rounded"
                  />
                  <input
                    type="text"
                    value={
                      activeTab === "welcome"
                        ? welcomeConfig.cardBgColor
                        : leaveConfig.cardBgColor
                    }
                    onChange={(e) => {
                      if (activeTab === "welcome") {
                        setWelcomeConfig((prev) => ({
                          ...prev,
                          cardBgColor: e.target.value,
                        }));
                      } else {
                        setLeaveConfig((prev) => ({
                          ...prev,
                          cardBgColor: e.target.value,
                        }));
                      }
                    }}
                    className="flex-1 bg-[#1e1f22] border border-[#3f4147] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">
                  Card Background Image URL (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                  <input
                    type="url"
                    placeholder="https://example.com/banner.png"
                    value={
                      activeTab === "welcome"
                        ? welcomeConfig.cardBgImage
                        : leaveConfig.cardBgImage
                    }
                    onChange={(e) => {
                      if (activeTab === "welcome") {
                        setWelcomeConfig((prev) => ({
                          ...prev,
                          cardBgImage: e.target.value,
                        }));
                      } else {
                        setLeaveConfig((prev) => ({
                          ...prev,
                          cardBgImage: e.target.value,
                        }));
                      }
                    }}
                    className="flex-1 bg-[#1e1f22] border border-[#3f4147] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Auto Roles (Welcome Tab Only) */}
          {activeTab === "welcome" && (
            <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-5 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">
                    Automatic Role Assigner (Autoroles)
                  </h3>
                </div>
                <p className="text-xs text-zinc-400">
                  New members will automatically receive these roles when they join
                </p>
              </div>

              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                {roles
                  .filter((r) => r.name !== "@everyone")
                  .map((role) => {
                    const isSelected = welcomeConfig.autoRoles.includes(role.id);
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => toggleAutoRole(role.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                          isSelected
                            ? "bg-emerald-600/20 border-emerald-500 text-emerald-300 font-bold"
                            : "bg-[#1e1f22] border-[#3f4147] text-zinc-400 hover:text-white"
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, "0")}` : "#99aab5" }}
                        />
                        <span>{role.name}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 ml-1" />}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* DM Greeting (Welcome Tab Only) */}
          {activeTab === "welcome" && (
            <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-discord-brand" />
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Send Direct Message (DM)
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Send a private greeting DM to new members
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={welcomeConfig.sendDm}
                    onChange={(e) =>
                      setWelcomeConfig((prev) => ({
                        ...prev,
                        sendDm: e.target.checked,
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-discord-brand"></div>
                </label>
              </div>

              {welcomeConfig.sendDm && (
                <div>
                  <textarea
                    rows={2}
                    value={welcomeConfig.dmText || ""}
                    onChange={(e) =>
                      setWelcomeConfig((prev) => ({
                        ...prev,
                        dmText: e.target.value,
                      }))
                    }
                    placeholder="Welcome to {server}, {user}!"
                    className="w-full bg-[#1e1f22] border border-[#3f4147] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-discord-brand resize-none font-mono"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Live Discord Message Simulation Preview */}
        <div className="lg:col-span-5 p-6 bg-[#18191c] space-y-4 flex flex-col justify-start">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Live Discord Message Preview
              </h3>
            </div>
            {generatingPreview && (
              <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" /> Rendering...
              </span>
            )}
          </div>

          {/* Discord Message Chat Bubble Simulator */}
          <div className="bg-[#313338] border border-[#3f4147]/60 rounded-2xl p-4 space-y-3 shadow-xl">
            {/* Top Text Content */}
            <div className="text-sm text-zinc-200 font-sans leading-relaxed">
              <span className="font-semibold">
                {activeTab === "welcome"
                  ? welcomeConfig.messageText
                      .replace(/\{user\}/gi, "@megaloblatt")
                      .replace(/\{username\}/gi, "megaloblatt")
                      .replace(/\{server\}/gi, "TheGodGen")
                      .replace(/\{memberCount\}/gi, "298")
                      .replace(/\{memberOrdinal\}/gi, "#298")
                  : leaveConfig.messageText
                      .replace(/\{user\}/gi, "@megaloblatt")
                      .replace(/\{username\}/gi, "megaloblatt")
                      .replace(/\{server\}/gi, "TheGodGen")
                      .replace(/\{memberCount\}/gi, "298")
                      .replace(/\{memberOrdinal\}/gi, "#298")}
              </span>
            </div>

            {/* Generated Image Card */}
            {(activeTab === "welcome" ? welcomeConfig.sendCard : leaveConfig.sendCard) && (
              <div className="relative rounded-xl overflow-hidden border border-[#2b2d31] bg-[#111214] flex items-center justify-center min-h-[160px] shadow-lg">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Greeting Card Preview"
                    className="w-full h-auto object-contain rounded-xl"
                  />
                ) : (
                  <div className="p-8 text-center text-zinc-500 text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-400" />
                    Generating card preview...
                  </div>
                )}
              </div>
            )}

            {/* Discord Reaction Simulation */}
            <div className="flex items-center gap-1.5 pt-1">
              <div className="flex items-center gap-1 bg-[#2b2d31] hover:bg-[#35373c] border border-[#3f4147] rounded-lg px-2 py-0.5 text-xs text-zinc-300 select-none">
                <span>👋</span>
                <span className="text-[11px] font-bold text-cyan-400">1</span>
              </div>
              <div className="flex items-center gap-1 bg-[#2b2d31] hover:bg-[#35373c] border border-[#3f4147] rounded-lg px-2 py-0.5 text-xs text-zinc-400 select-none">
                <span>😊</span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#111214] border border-[#2b2d31] text-[11px] text-zinc-400 space-y-1">
            <p className="font-semibold text-zinc-300">💡 Pro-Tipp:</p>
            <p>
              Du kannst das System sofort im ausgewählten Discord-Kanal ausprobieren, indem du oben rechts auf{" "}
              <strong className="text-cyan-400">"Send Test Message"</strong> klickst.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
