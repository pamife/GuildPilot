"use client";

import React, { useState, useEffect } from "react";
import {
  MessageSquareText,
  Plus,
  Trash2,
  Copy,
  Send,
  RefreshCw,
  Edit,
  Sparkles,
  Layers,
  Palette,
  Eye,
  Code,
  Check,
  AlertCircle,
  Hash,
  Smile,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Image as ImageIcon,
  Type,
  Split,
  MousePointerClick,
  FileText,
  Bookmark,
  Undo2,
  FolderOpen,
  Info,
} from "lucide-react";
import { useToast } from "../ToastContainer";
import { api } from "@/lib/api";

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface ComponentItem {
  id: string;
  type: "text" | "separator" | "media_gallery" | "section" | "action_row";
  content?: string;
  spacing?: number;
  divider?: boolean;
  items?: Array<{ url: string; description?: string; spoiler?: boolean }>;
  accessory?: {
    type: "thumbnail" | "button";
    url?: string;
    spoiler?: boolean;
    style?: string | number;
    label?: string;
    customId?: string;
    emoji?: string;
    disabled?: boolean;
  };
  buttons?: Array<{
    id: string;
    style: "Primary" | "Secondary" | "Success" | "Danger" | "Link";
    label: string;
    emoji?: string;
    url?: string;
    customId?: string;
    disabled?: boolean;
  }>;
}

interface CustomMessageData {
  id?: string;
  guildId: string;
  name: string;
  description?: string;
  mode: "components_v2" | "embed";
  channelId?: string;
  messageId?: string | null;
  content?: string;
  flags?: number;
  accentColor?: string;
  spoiler?: boolean;
  containerConfig: ComponentItem[];
  embedConfig?: {
    title?: string;
    description?: string;
    color?: string;
    url?: string;
    authorName?: string;
    authorIcon?: string;
    authorUrl?: string;
    thumbnail?: string;
    image?: string;
    footerText?: string;
    footerIcon?: string;
    showTimestamp?: boolean;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
  };
  componentsConfig?: Array<{
    buttons: Array<{
      id: string;
      style: "Primary" | "Secondary" | "Success" | "Danger" | "Link";
      label: string;
      emoji?: string;
      url?: string;
      customId?: string;
      disabled?: boolean;
    }>;
  }>;
  lastSentAt?: string;
}

interface CustomMessagesViewProps {
  channels: Channel[];
  selectedGuildId: string | null;
  botStatus: { ready: boolean; tag: string; ping: number } | null;
}

const PRESET_TEMPLATES = [
  {
    name: "Server Rules & Guidelines",
    description: "Modern Discord Components V2 server rules layout with sections and links.",
    mode: "components_v2" as const,
    accentColor: "#5865F2",
    spoiler: false,
    containerConfig: [
      {
        id: "block-1",
        type: "section" as const,
        content: "# 📜 Server Rules & Code of Conduct\nWelcome to our community! Please follow these guidelines to keep our server friendly and safe for everyone.",
        accessory: {
          type: "thumbnail" as const,
          url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150",
        },
      },
      { id: "block-2", type: "separator" as const, divider: true },
      {
        id: "block-3",
        type: "text" as const,
        content: "### 1. Be Respectful\nTreat all members with respect. No harassment, hate speech, sexism, or discrimination.\n\n### 2. No Spam or Self-Promotion\nDo not post unsolicited advertisement, mass pings, or excessive message spam.\n\n### 3. Follow Discord TOS\nAll members must strictly abide by [Discord's Terms of Service](https://discord.com/terms).",
      },
      { id: "block-4", type: "separator" as const, divider: false },
      {
        id: "block-5",
        type: "action_row" as const,
        buttons: [
          { id: "btn-1", style: "Link" as const, label: "Discord Guidelines", url: "https://discord.com/guidelines", emoji: "🔗" },
          { id: "btn-2", style: "Success" as const, label: "I Agree & Accept", customId: "rules_accept", emoji: "✅" },
        ],
      },
    ],
  },
  {
    name: "Community Announcement",
    description: "Eye-catching announcement with media gallery grid and interactive buttons.",
    mode: "components_v2" as const,
    accentColor: "#23A55A",
    spoiler: false,
    containerConfig: [
      {
        id: "block-1",
        type: "media_gallery" as const,
        items: [
          { url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600", description: "Event Banner" },
        ],
      },
      { id: "block-2", type: "separator" as const, divider: true },
      {
        id: "block-3",
        type: "text" as const,
        content: "# 🚀 Big Community Update Released!\nWe're thrilled to announce the launch of our brand new server features and events.\n\n* **New Channels & Categories**\n* **Automated Ticket Support**\n* **Components V2 Custom Message Engine**\n\nCheck out the links below to participate in our weekend giveaway!",
      },
      {
        id: "block-4",
        type: "action_row" as const,
        buttons: [
          { id: "btn-1", style: "Primary" as const, label: "Join Event", customId: "event_join", emoji: "🎉" },
          { id: "btn-2", style: "Secondary" as const, label: "View Patch Notes", customId: "view_patch_notes", emoji: "📋" },
        ],
      },
    ],
  },
  {
    name: "Support & Help Hub",
    description: "Structured hub with contact sections and direct support action buttons.",
    mode: "components_v2" as const,
    accentColor: "#F0B232",
    spoiler: false,
    containerConfig: [
      {
        id: "block-1",
        type: "section" as const,
        content: "# 🎫 Help & Support Center\nNeed assistance or have questions? Our support team is here for you 24/7.",
        accessory: {
          type: "button" as const,
          style: "Primary",
          label: "Open Ticket",
          customId: "support_open_ticket",
          emoji: "📩",
        },
      },
      { id: "block-2", type: "separator" as const, divider: true },
      {
        id: "block-3",
        type: "text" as const,
        content: "### Frequently Asked Questions\n- **How do I verify?** Check `#verification` to unlock all channels.\n- **How do I report a player?** Open a ticket using the button above.\n- **Where are server announcements?** Keep an eye on `#announcements`.",
      },
    ],
  },
];

const PRESET_COLORS = [
  { name: "Blurple", hex: "#5865F2" },
  { name: "Emerald Green", hex: "#23A55A" },
  { name: "Crimson Red", hex: "#F23F43" },
  { name: "Amber Gold", hex: "#F0B232" },
  { name: "Deep Violet", hex: "#9B59B6" },
  { name: "Cyan Teal", hex: "#1ABC9C" },
  { name: "Charcoal Dark", hex: "#2B2D31" },
];

export function CustomMessagesView({
  channels,
  selectedGuildId,
  botStatus,
}: CustomMessagesViewProps) {
  const { showToast } = useToast();

  const [savedMessages, setSavedMessages] = useState<CustomMessageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSavedDrawerOpen, setIsSavedDrawerOpen] = useState(false);
  const [previewTab, setPreviewTab] = useState<"visual" | "json">("visual");
  const [activeEditorTab, setActiveEditorTab] = useState<"builder" | "settings">("builder");

  // Current active draft
  const [currentMessage, setCurrentMessage] = useState<CustomMessageData>({
    guildId: selectedGuildId || "",
    name: "New Announcement",
    description: "",
    mode: "components_v2",
    channelId: channels.find((c) => c.type === 0)?.id || "",
    messageId: null,
    content: "",
    accentColor: "#5865F2",
    spoiler: false,
    containerConfig: [
      {
        id: "b-" + Date.now(),
        type: "text",
        content: "# 🎉 Hello Discord!\nThis is a custom message crafted with **Discord Components V2**.",
      },
    ],
    embedConfig: {
      title: "Classic Embed Title",
      description: "Embed description formatted in markdown.",
      color: "#5865F2",
      showTimestamp: true,
      fields: [],
    },
    componentsConfig: [],
  });

  const textChannels = channels.filter((c) => c.type === 0);

  // Fetch saved custom messages
  const fetchMessages = async () => {
    if (!selectedGuildId) return;
    try {
      setLoading(true);
      const res = await api.get(`/guilds/${selectedGuildId}/custom-messages`);
      const parsed = (res.data || []).map((m: any) => ({
        ...m,
        containerConfig: typeof m.containerConfig === "string" ? JSON.parse(m.containerConfig || "[]") : m.containerConfig,
        embedConfig: typeof m.embedConfig === "string" ? JSON.parse(m.embedConfig || "{}") : m.embedConfig,
        componentsConfig: typeof m.componentsConfig === "string" ? JSON.parse(m.componentsConfig || "[]") : m.componentsConfig,
      }));
      setSavedMessages(parsed);
    } catch (err: any) {
      console.error("Error loading custom messages:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [selectedGuildId]);

  // Handle saving message to DB
  const handleSaveMessage = async () => {
    if (!selectedGuildId) return;
    if (!currentMessage.name.trim()) {
      showToast("Please provide a name for this custom message.", "error");
      return;
    }

    try {
      setLoading(true);
      if (currentMessage.id) {
        const res = await api.put(`/guilds/${selectedGuildId}/custom-messages/${currentMessage.id}`, currentMessage);
        showToast("Custom message updated successfully!", "success");
        setCurrentMessage({
          ...res.data,
          containerConfig: typeof res.data.containerConfig === "string" ? JSON.parse(res.data.containerConfig || "[]") : res.data.containerConfig,
          embedConfig: typeof res.data.embedConfig === "string" ? JSON.parse(res.data.embedConfig || "{}") : res.data.embedConfig,
          componentsConfig: typeof res.data.componentsConfig === "string" ? JSON.parse(res.data.componentsConfig || "[]") : res.data.componentsConfig,
        });
      } else {
        const res = await api.post(`/guilds/${selectedGuildId}/custom-messages`, {
          ...currentMessage,
          guildId: selectedGuildId,
        });
        showToast("Custom message created & saved!", "success");
        setCurrentMessage({
          ...res.data,
          containerConfig: typeof res.data.containerConfig === "string" ? JSON.parse(res.data.containerConfig || "[]") : res.data.containerConfig,
          embedConfig: typeof res.data.embedConfig === "string" ? JSON.parse(res.data.embedConfig || "{}") : res.data.embedConfig,
          componentsConfig: typeof res.data.componentsConfig === "string" ? JSON.parse(res.data.componentsConfig || "[]") : res.data.componentsConfig,
        });
      }
      fetchMessages();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to save custom message.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Handle Deploy / Send to Discord
  const handleDeployToDiscord = async () => {
    if (!selectedGuildId) return;
    if (!currentMessage.channelId) {
      showToast("Please select a target channel before sending.", "error");
      return;
    }
    if (!botStatus?.ready) {
      showToast("Discord bot is offline. Please start the bot first.", "error");
      return;
    }

    try {
      setLoading(true);
      // If message is already saved, use ID endpoint, else use raw send
      let res;
      if (currentMessage.id) {
        res = await api.post(`/guilds/${selectedGuildId}/custom-messages/${currentMessage.id}/send`, {
          channelId: currentMessage.channelId,
        });
      } else {
        res = await api.post(`/guilds/${selectedGuildId}/custom-messages-send-raw`, {
          messageData: currentMessage,
          channelId: currentMessage.channelId,
        });
      }

      showToast(`✅ Successfully sent message to #${res.data.channelName || "channel"}!`, "success");
      if (res.data.messageId) {
        setCurrentMessage((prev) => ({ ...prev, messageId: res.data.messageId }));
      }
      fetchMessages();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to send message to Discord.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Handle Delete message
  const handleDeleteMessage = async (id: string) => {
    if (!selectedGuildId) return;
    if (!confirm("Are you sure you want to delete this custom message?")) return;

    try {
      setLoading(true);
      await api.delete(`/guilds/${selectedGuildId}/custom-messages/${id}`);
      showToast("Message deleted.", "success");
      if (currentMessage.id === id) {
        handleNewMessage();
      }
      fetchMessages();
    } catch (err: any) {
      showToast("Failed to delete message.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Handle Duplicate message
  const handleDuplicateMessage = async (id: string) => {
    if (!selectedGuildId) return;
    try {
      setLoading(true);
      const res = await api.post(`/guilds/${selectedGuildId}/custom-messages/${id}/duplicate`);
      showToast("Message duplicated!", "success");
      fetchMessages();
      loadMessageIntoEditor(res.data);
    } catch (err: any) {
      showToast("Failed to duplicate message.", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadMessageIntoEditor = (msg: any) => {
    setCurrentMessage({
      ...msg,
      containerConfig: typeof msg.containerConfig === "string" ? JSON.parse(msg.containerConfig || "[]") : (msg.containerConfig || []),
      embedConfig: typeof msg.embedConfig === "string" ? JSON.parse(msg.embedConfig || "{}") : (msg.embedConfig || {}),
      componentsConfig: typeof msg.componentsConfig === "string" ? JSON.parse(msg.componentsConfig || "[]") : (msg.componentsConfig || []),
    });
    setIsSavedDrawerOpen(false);
  };

  const handleNewMessage = () => {
    setCurrentMessage({
      guildId: selectedGuildId || "",
      name: "New Custom Announcement",
      description: "",
      mode: "components_v2",
      channelId: textChannels[0]?.id || "",
      messageId: null,
      content: "",
      accentColor: "#5865F2",
      spoiler: false,
      containerConfig: [
        {
          id: "b-" + Date.now(),
          type: "text",
          content: "# 📢 Server Announcement\nYour formatted text here...",
        },
      ],
      embedConfig: {
        title: "Embed Title",
        description: "Embed description here...",
        color: "#5865F2",
        showTimestamp: true,
        fields: [],
      },
      componentsConfig: [],
    });
  };

  const applyPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    setCurrentMessage((prev) => ({
      ...prev,
      name: preset.name,
      description: preset.description,
      mode: preset.mode,
      accentColor: preset.accentColor,
      spoiler: preset.spoiler,
      containerConfig: JSON.parse(JSON.stringify(preset.containerConfig)),
    }));
    showToast(`Applied preset: ${preset.name}`, "info");
  };

  // Component Block Handlers for V2 Container
  const addComponentBlock = (type: ComponentItem["type"]) => {
    if (currentMessage.containerConfig.length >= 10) {
      showToast("Discord limit reached: A container can hold up to 10 component blocks.", "info");
      return;
    }

    const newId = "block-" + Date.now();
    let newBlock: ComponentItem;

    if (type === "text") {
      newBlock = { id: newId, type: "text", content: "### New Text Section\nWrite your rich markdown text here." };
    } else if (type === "separator") {
      newBlock = { id: newId, type: "separator", divider: true };
    } else if (type === "media_gallery") {
      newBlock = {
        id: newId,
        type: "media_gallery",
        items: [{ url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600", description: "" }],
      };
    } else if (type === "section") {
      newBlock = {
        id: newId,
        type: "section",
        content: "### Featured Section\nHighlight important information with an accessory on the right.",
        accessory: {
          type: "thumbnail",
          url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=150",
        },
      };
    } else {
      newBlock = {
        id: newId,
        type: "action_row",
        buttons: [
          { id: "btn-" + Date.now(), style: "Primary", label: "Button", customId: `btn_${Date.now()}` },
        ],
      };
    }

    setCurrentMessage((prev) => ({
      ...prev,
      containerConfig: [...prev.containerConfig, newBlock],
    }));
  };

  const removeComponentBlock = (index: number) => {
    setCurrentMessage((prev) => ({
      ...prev,
      containerConfig: prev.containerConfig.filter((_, i) => i !== index),
    }));
  };

  const moveComponentBlock = (index: number, direction: "up" | "down") => {
    const list = [...currentMessage.containerConfig];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;
    setCurrentMessage((prev) => ({ ...prev, containerConfig: list }));
  };

  const updateBlock = (index: number, patch: Partial<ComponentItem>) => {
    setCurrentMessage((prev) => {
      const next = [...prev.containerConfig];
      next[index] = { ...next[index], ...patch };
      return { ...prev, containerConfig: next };
    });
  };

  // Markdown quick toolbar helper
  const insertMarkdown = (blockIndex: number, before: string, after: string = "") => {
    const block = currentMessage.containerConfig[blockIndex];
    if (!block || block.type !== "text") return;
    const current = block.content || "";
    updateBlock(blockIndex, { content: `${current}\n${before}Highlighted Text${after}` });
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#090a0f] text-white">
      {/* Top Header Bar */}
      <header className="h-14 border-b border-[#18181b] bg-[#050507] px-6 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-discord-brand/20 border border-discord-brand/40 flex items-center justify-center text-discord-brand shadow-inner">
            <MessageSquareText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight">Custom Messages & Announcements</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-discord-brand/20 text-discord-brand border border-discord-brand/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Discord Components V2
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">Design pixel-perfect interactive Discord messages with modern V2 containers & blocks</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Preset Templates Dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#18181b] hover:bg-[#27272a] text-zinc-300 text-xs font-semibold border border-[#27272a] transition-all">
              <Bookmark className="w-3.5 h-3.5 text-amber-400" />
              <span>Presets</span>
              <ChevronDown className="w-3 h-3 text-zinc-500" />
            </button>
            <div className="absolute right-0 top-full mt-1 w-64 bg-[#0e0f15] border border-[#27272a] rounded-xl shadow-2xl p-1.5 hidden group-hover:block z-50 animate-in fade-in zoom-in-95">
              <div className="text-[10px] font-bold uppercase text-zinc-500 px-2 py-1">Quick Templates</div>
              {PRESET_TEMPLATES.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => applyPreset(p)}
                  className="w-full text-left p-2 rounded-lg hover:bg-[#1f2028] transition-colors"
                >
                  <p className="text-xs font-bold text-white">{p.name}</p>
                  <p className="text-[10px] text-zinc-400 line-clamp-1">{p.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Saved Messages Drawer Toggle */}
          <button
            onClick={() => setIsSavedDrawerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#18181b] hover:bg-[#27272a] text-zinc-300 text-xs font-semibold border border-[#27272a] transition-all"
          >
            <FolderOpen className="w-3.5 h-3.5 text-discord-brand" />
            <span>Saved ({savedMessages.length})</span>
          </button>

          {/* New Message Button */}
          <button
            onClick={handleNewMessage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#18181b] hover:bg-[#27272a] text-zinc-300 text-xs font-semibold border border-[#27272a] transition-all"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>New</span>
          </button>

          {/* Save Button */}
          <button
            onClick={handleSaveMessage}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-discord-brand hover:bg-discord-brand/90 text-white text-xs font-bold shadow-md shadow-discord-brand/25 transition-all disabled:opacity-50"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>{currentMessage.id ? "Update Draft" : "Save Message"}</span>
          </button>
        </div>
      </header>

      {/* Main Split Layout: Editor Left, Live Preview Right */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Config & Components Builder */}
        <div className="w-1/2 flex flex-col border-r border-[#18181b] bg-[#090a0f] overflow-y-auto">
          {/* Secondary Subheader / Tabs */}
          <div className="p-4 border-b border-[#18181b] bg-[#0c0d12] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={currentMessage.name}
                onChange={(e) => setCurrentMessage({ ...currentMessage, name: e.target.value })}
                placeholder="Message Title / Reference Name"
                className="bg-[#14151b] border border-[#27272a] focus:border-discord-brand px-3 py-1.5 rounded-lg text-sm font-bold text-white outline-none w-64 transition-all"
              />
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center p-1 bg-[#14151b] rounded-xl border border-[#27272a]">
              <button
                onClick={() => setCurrentMessage({ ...currentMessage, mode: "components_v2" })}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  currentMessage.mode === "components_v2"
                    ? "bg-discord-brand text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Components V2</span>
              </button>
              <button
                onClick={() => setCurrentMessage({ ...currentMessage, mode: "embed" })}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  currentMessage.mode === "embed"
                    ? "bg-discord-brand text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Classic Embed</span>
              </button>
            </div>
          </div>

          {/* Builder Body */}
          <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            {/* Target Channel Selector & Deployment Box */}
            <div className="p-4 rounded-xl bg-[#0e0f15] border border-[#27272a] space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <Hash className="w-4 h-4 text-discord-brand" /> Target Discord Channel
                </label>
                {currentMessage.messageId && (
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                    Live ID: {currentMessage.messageId}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={currentMessage.channelId || ""}
                  onChange={(e) => setCurrentMessage({ ...currentMessage, channelId: e.target.value })}
                  className="flex-1 bg-[#14151b] border border-[#27272a] focus:border-discord-brand px-3 py-2 rounded-lg text-xs font-semibold text-white outline-none"
                >
                  <option value="">-- Select a channel --</option>
                  {textChannels.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      #{ch.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleDeployToDiscord}
                  disabled={loading || !currentMessage.channelId}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{currentMessage.messageId ? "Update Live Message" : "Send to Discord"}</span>
                </button>
              </div>
            </div>

            {/* Mode-Specific Settings: Components V2 vs Classic Embed */}
            {currentMessage.mode === "components_v2" ? (
              <>
                {/* Root Container Options (Accent Color & Spoiler) */}
                <div className="p-4 rounded-xl bg-[#0e0f15] border border-[#27272a] space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                      <Palette className="w-4 h-4 text-discord-brand" /> Root Container Style
                    </span>
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-400">
                      <input
                        type="checkbox"
                        checked={!!currentMessage.spoiler}
                        onChange={(e) => setCurrentMessage({ ...currentMessage, spoiler: e.target.checked })}
                        className="rounded border-[#27272a] bg-[#14151b] text-discord-brand focus:ring-0"
                      />
                      <span>Spoiler Container (Blur)</span>
                    </label>
                  </div>

                  {/* Accent Color Palette */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Accent Border Color</label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          onClick={() => setCurrentMessage({ ...currentMessage, accentColor: c.hex })}
                          className={`w-7 h-7 rounded-lg transition-transform flex items-center justify-center ${
                            currentMessage.accentColor?.toLowerCase() === c.hex.toLowerCase()
                              ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#0e0f15]"
                              : "hover:scale-105"
                          }`}
                          style={{ backgroundColor: c.hex }}
                          title={c.name}
                        >
                          {currentMessage.accentColor?.toLowerCase() === c.hex.toLowerCase() && (
                            <Check className="w-3.5 h-3.5 text-white drop-shadow" />
                          )}
                        </button>
                      ))}

                      {/* Custom Hex input */}
                      <div className="flex items-center gap-1.5 ml-2 bg-[#14151b] border border-[#27272a] px-2 py-1 rounded-lg">
                        <span className="text-xs text-zinc-500 font-mono">#</span>
                        <input
                          type="text"
                          value={(currentMessage.accentColor || "").replace("#", "")}
                          onChange={(e) => setCurrentMessage({ ...currentMessage, accentColor: `#${e.target.value}` })}
                          maxLength={6}
                          placeholder="5865F2"
                          className="w-16 bg-transparent text-xs font-mono text-white outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* V2 Component Blocks Builder */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Layers className="w-4 h-4 text-discord-brand" /> Container Components ({currentMessage.containerConfig.length}/10)
                      </h3>
                      <p className="text-[11px] text-zinc-400">Add and arrange markdown texts, media galleries, sections, dividers & buttons</p>
                    </div>

                    {/* Add Component Menu */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => addComponentBlock("text")}
                        className="px-2.5 py-1 rounded-lg bg-[#18181b] hover:bg-[#27272a] text-zinc-300 text-xs font-semibold border border-[#27272a] flex items-center gap-1 transition-all"
                        title="Add Rich Text Display Block"
                      >
                        <Type className="w-3.5 h-3.5 text-sky-400" />
                        <span>Text</span>
                      </button>
                      <button
                        onClick={() => addComponentBlock("section")}
                        className="px-2.5 py-1 rounded-lg bg-[#18181b] hover:bg-[#27272a] text-zinc-300 text-xs font-semibold border border-[#27272a] flex items-center gap-1 transition-all"
                        title="Add Section with side Thumbnail or Button"
                      >
                        <Split className="w-3.5 h-3.5 text-violet-400" />
                        <span>Section</span>
                      </button>
                      <button
                        onClick={() => addComponentBlock("media_gallery")}
                        className="px-2.5 py-1 rounded-lg bg-[#18181b] hover:bg-[#27272a] text-zinc-300 text-xs font-semibold border border-[#27272a] flex items-center gap-1 transition-all"
                        title="Add Media Gallery Grid"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Media</span>
                      </button>
                      <button
                        onClick={() => addComponentBlock("separator")}
                        className="px-2.5 py-1 rounded-lg bg-[#18181b] hover:bg-[#27272a] text-zinc-300 text-xs font-semibold border border-[#27272a] flex items-center gap-1 transition-all"
                        title="Add Divider / Spacing"
                      >
                        <span className="text-zinc-400 font-bold">—</span>
                        <span>Divider</span>
                      </button>
                      <button
                        onClick={() => addComponentBlock("action_row")}
                        className="px-2.5 py-1 rounded-lg bg-[#18181b] hover:bg-[#27272a] text-zinc-300 text-xs font-semibold border border-[#27272a] flex items-center gap-1 transition-all"
                        title="Add Interactive Button Row"
                      >
                        <MousePointerClick className="w-3.5 h-3.5 text-amber-400" />
                        <span>Buttons</span>
                      </button>
                    </div>
                  </div>

                  {/* Active Components List */}
                  <div className="space-y-3 pt-2">
                    {currentMessage.containerConfig.map((block, idx) => (
                      <div
                        key={block.id || idx}
                        className="p-4 rounded-xl bg-[#0e0f15] border border-[#27272a] space-y-3 group hover:border-[#3f3f46] transition-all"
                      >
                        {/* Block Header */}
                        <div className="flex items-center justify-between border-b border-[#1c1d25] pb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-[#18181b] text-zinc-400 text-[11px] font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold text-zinc-200 capitalize flex items-center gap-1.5">
                              {block.type === "text" && <Type className="w-3.5 h-3.5 text-sky-400" />}
                              {block.type === "section" && <Split className="w-3.5 h-3.5 text-violet-400" />}
                              {block.type === "media_gallery" && <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />}
                              {block.type === "separator" && <span className="text-zinc-400 font-bold">—</span>}
                              {block.type === "action_row" && <MousePointerClick className="w-3.5 h-3.5 text-amber-400" />}
                              {block.type.replace("_", " ")} Block
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => moveComponentBlock(idx, "up")}
                              disabled={idx === 0}
                              className="p-1 text-zinc-400 hover:text-white disabled:opacity-20 transition-colors"
                              title="Move Up"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => moveComponentBlock(idx, "down")}
                              disabled={idx === currentMessage.containerConfig.length - 1}
                              className="p-1 text-zinc-400 hover:text-white disabled:opacity-20 transition-colors"
                              title="Move Down"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => removeComponentBlock(idx)}
                              className="p-1 text-zinc-400 hover:text-rose-400 transition-colors ml-1"
                              title="Delete Block"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Block Editors */}
                        {/* 1. Text Display Editor */}
                        {block.type === "text" && (
                          <div className="space-y-2">
                            {/* Markdown helper toolbar */}
                            <div className="flex items-center gap-1 text-[11px] text-zinc-400 bg-[#14151b] p-1 rounded-lg border border-[#27272a]">
                              <button onClick={() => insertMarkdown(idx, "# ")} className="px-1.5 py-0.5 hover:bg-[#27272a] rounded font-bold">H1</button>
                              <button onClick={() => insertMarkdown(idx, "### ")} className="px-1.5 py-0.5 hover:bg-[#27272a] rounded font-bold">H3</button>
                              <button onClick={() => insertMarkdown(idx, "**", "**")} className="px-1.5 py-0.5 hover:bg-[#27272a] rounded font-bold">B</button>
                              <button onClick={() => insertMarkdown(idx, "*", "*")} className="px-1.5 py-0.5 hover:bg-[#27272a] rounded italic font-serif">I</button>
                              <button onClick={() => insertMarkdown(idx, "> ")} className="px-1.5 py-0.5 hover:bg-[#27272a] rounded">Quote</button>
                              <button onClick={() => insertMarkdown(idx, "- ")} className="px-1.5 py-0.5 hover:bg-[#27272a] rounded">List</button>
                              <button onClick={() => insertMarkdown(idx, "||", "||")} className="px-1.5 py-0.5 hover:bg-[#27272a] rounded">Spoiler</button>
                            </div>
                            <textarea
                              rows={4}
                              value={block.content || ""}
                              onChange={(e) => updateBlock(idx, { content: e.target.value })}
                              placeholder="Type markdown formatted message content..."
                              className="w-full bg-[#14151b] border border-[#27272a] focus:border-discord-brand p-3 rounded-lg text-xs font-mono text-white outline-none resize-y"
                            />
                          </div>
                        )}

                        {/* 2. Section Editor */}
                        {block.type === "section" && (
                          <div className="space-y-3">
                            <div>
                              <label className="text-[11px] font-bold text-zinc-400 block mb-1">Section Content (Left)</label>
                              <textarea
                                rows={3}
                                value={block.content || ""}
                                onChange={(e) => updateBlock(idx, { content: e.target.value })}
                                placeholder="Section text description..."
                                className="w-full bg-[#14151b] border border-[#27272a] focus:border-discord-brand p-2.5 rounded-lg text-xs text-white outline-none"
                              />
                            </div>

                            <div className="p-3 bg-[#14151b] rounded-lg border border-[#27272a] space-y-2.5">
                              <div className="flex items-center justify-between">
                                <label className="text-[11px] font-bold text-zinc-300">Side Accessory (Right)</label>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() =>
                                      updateBlock(idx, {
                                        accessory: {
                                          type: "thumbnail",
                                          url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=150",
                                        },
                                      })
                                    }
                                    className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                                      block.accessory?.type === "thumbnail" ? "bg-discord-brand text-white" : "text-zinc-400 hover:text-white"
                                    }`}
                                  >
                                    Thumbnail Image
                                  </button>
                                  <button
                                    onClick={() =>
                                      updateBlock(idx, {
                                        accessory: {
                                          type: "button",
                                          style: "Primary",
                                          label: "Action",
                                          customId: "sec_btn_" + Date.now(),
                                        },
                                      })
                                    }
                                    className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                                      block.accessory?.type === "button" ? "bg-discord-brand text-white" : "text-zinc-400 hover:text-white"
                                    }`}
                                  >
                                    Button
                                  </button>
                                </div>
                              </div>

                              {block.accessory?.type === "thumbnail" ? (
                                <input
                                  type="text"
                                  value={block.accessory.url || ""}
                                  onChange={(e) =>
                                    updateBlock(idx, {
                                      accessory: { ...block.accessory, type: "thumbnail", url: e.target.value },
                                    })
                                  }
                                  placeholder="https://example.com/thumbnail.png"
                                  className="w-full bg-[#0e0f15] border border-[#27272a] focus:border-discord-brand px-3 py-1.5 rounded-lg text-xs text-white outline-none"
                                />
                              ) : (
                                <div className="grid grid-cols-3 gap-2">
                                  <input
                                    type="text"
                                    value={block.accessory?.label || ""}
                                    onChange={(e) =>
                                      updateBlock(idx, {
                                        accessory: { ...block.accessory, type: "button", label: e.target.value },
                                      })
                                    }
                                    placeholder="Button Label"
                                    className="bg-[#0e0f15] border border-[#27272a] px-2 py-1 rounded text-xs text-white outline-none"
                                  />
                                  <select
                                    value={block.accessory?.style || "Primary"}
                                    onChange={(e) =>
                                      updateBlock(idx, {
                                        accessory: { ...block.accessory, type: "button", style: e.target.value },
                                      })
                                    }
                                    className="bg-[#0e0f15] border border-[#27272a] px-2 py-1 rounded text-xs text-white outline-none"
                                  >
                                    <option value="Primary">Primary (Blue)</option>
                                    <option value="Secondary">Secondary (Gray)</option>
                                    <option value="Success">Success (Green)</option>
                                    <option value="Danger">Danger (Red)</option>
                                    <option value="Link">Link (URL)</option>
                                  </select>
                                  <input
                                    type="text"
                                    value={block.accessory?.customId || block.accessory?.url || ""}
                                    onChange={(e) =>
                                      updateBlock(idx, {
                                        accessory: {
                                          ...block.accessory,
                                          type: "button",
                                          customId: e.target.value,
                                          url: e.target.value,
                                        },
                                      })
                                    }
                                    placeholder="custom_id or URL"
                                    className="bg-[#0e0f15] border border-[#27272a] px-2 py-1 rounded text-xs text-white outline-none"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 3. Media Gallery Editor */}
                        {block.type === "media_gallery" && (
                          <div className="space-y-2.5">
                            <label className="text-[11px] font-bold text-zinc-400 block">Media Gallery URLs (Images/Videos)</label>
                            {(block.items || []).map((m, mIdx) => (
                              <div key={mIdx} className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={m.url || ""}
                                  onChange={(e) => {
                                    const nextItems = [...(block.items || [])];
                                    nextItems[mIdx] = { ...nextItems[mIdx], url: e.target.value };
                                    updateBlock(idx, { items: nextItems });
                                  }}
                                  placeholder="https://example.com/image.png"
                                  className="flex-1 bg-[#14151b] border border-[#27272a] px-3 py-1.5 rounded-lg text-xs text-white outline-none"
                                />
                                <button
                                  onClick={() => {
                                    const nextItems = (block.items || []).filter((_, i) => i !== mIdx);
                                    updateBlock(idx, { items: nextItems });
                                  }}
                                  className="p-1.5 text-zinc-400 hover:text-rose-400"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                            {(block.items || []).length < 4 && (
                              <button
                                onClick={() => {
                                  const nextItems = [...(block.items || []), { url: "", description: "" }];
                                  updateBlock(idx, { items: nextItems });
                                }}
                                className="text-xs text-discord-brand hover:underline font-bold flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" /> Add another image
                              </button>
                            )}
                          </div>
                        )}

                        {/* 4. Separator Editor */}
                        {block.type === "separator" && (
                          <div className="flex items-center justify-between p-2 bg-[#14151b] rounded-lg text-xs">
                            <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                              <input
                                type="checkbox"
                                checked={block.divider !== false}
                                onChange={(e) => updateBlock(idx, { divider: e.target.checked })}
                                className="rounded bg-[#0e0f15] border-[#27272a] text-discord-brand"
                              />
                              <span>Draw Visual Divider Line</span>
                            </label>
                            <span className="text-[10px] text-zinc-500 font-mono">Type 14</span>
                          </div>
                        )}

                        {/* 5. Action Row Buttons Editor */}
                        {block.type === "action_row" && (
                          <div className="space-y-3">
                            <div className="space-y-2">
                              {(block.buttons || []).map((btn, bIdx) => (
                                <div key={btn.id || bIdx} className="grid grid-cols-12 gap-2 items-center bg-[#14151b] p-2 rounded-lg border border-[#27272a]">
                                  <div className="col-span-3">
                                    <input
                                      type="text"
                                      value={btn.label}
                                      onChange={(e) => {
                                        const nextBtns = [...(block.buttons || [])];
                                        nextBtns[bIdx] = { ...nextBtns[bIdx], label: e.target.value };
                                        updateBlock(idx, { buttons: nextBtns });
                                      }}
                                      placeholder="Button Label"
                                      className="w-full bg-[#0e0f15] border border-[#27272a] px-2 py-1 rounded text-xs text-white outline-none"
                                    />
                                  </div>
                                  <div className="col-span-3">
                                    <select
                                      value={btn.style}
                                      onChange={(e) => {
                                        const nextBtns = [...(block.buttons || [])];
                                        nextBtns[bIdx] = { ...nextBtns[bIdx], style: e.target.value as any };
                                        updateBlock(idx, { buttons: nextBtns });
                                      }}
                                      className="w-full bg-[#0e0f15] border border-[#27272a] px-2 py-1 rounded text-xs text-white outline-none"
                                    >
                                      <option value="Primary">Primary (Blue)</option>
                                      <option value="Secondary">Secondary (Gray)</option>
                                      <option value="Success">Success (Green)</option>
                                      <option value="Danger">Danger (Red)</option>
                                      <option value="Link">Link (URL)</option>
                                    </select>
                                  </div>
                                  <div className="col-span-4">
                                    <input
                                      type="text"
                                      value={btn.style === "Link" ? btn.url || "" : btn.customId || ""}
                                      onChange={(e) => {
                                        const nextBtns = [...(block.buttons || [])];
                                        if (btn.style === "Link") {
                                          nextBtns[bIdx] = { ...nextBtns[bIdx], url: e.target.value };
                                        } else {
                                          nextBtns[bIdx] = { ...nextBtns[bIdx], customId: e.target.value };
                                        }
                                        updateBlock(idx, { buttons: nextBtns });
                                      }}
                                      placeholder={btn.style === "Link" ? "https://..." : "custom_id"}
                                      className="w-full bg-[#0e0f15] border border-[#27272a] px-2 py-1 rounded text-xs text-white outline-none"
                                    />
                                  </div>
                                  <div className="col-span-1">
                                    <input
                                      type="text"
                                      value={btn.emoji || ""}
                                      onChange={(e) => {
                                        const nextBtns = [...(block.buttons || [])];
                                        nextBtns[bIdx] = { ...nextBtns[bIdx], emoji: e.target.value };
                                        updateBlock(idx, { buttons: nextBtns });
                                      }}
                                      placeholder="😀"
                                      className="w-full bg-[#0e0f15] border border-[#27272a] px-1 py-1 rounded text-xs text-center text-white outline-none"
                                    />
                                  </div>
                                  <div className="col-span-1 flex justify-end">
                                    <button
                                      onClick={() => {
                                        const nextBtns = (block.buttons || []).filter((_, i) => i !== bIdx);
                                        updateBlock(idx, { buttons: nextBtns });
                                      }}
                                      className="p-1 text-zinc-400 hover:text-rose-400"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {(block.buttons || []).length < 5 && (
                              <button
                                onClick={() => {
                                  const nextBtns = [
                                    ...(block.buttons || []),
                                    {
                                      id: "btn-" + Date.now(),
                                      style: "Primary" as const,
                                      label: "New Button",
                                      customId: "btn_" + Date.now(),
                                    },
                                  ];
                                  updateBlock(idx, { buttons: nextBtns });
                                }}
                                className="text-xs text-discord-brand hover:underline font-bold flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" /> Add Button (max 5 per row)
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              /* Classic Embed Form */
              <div className="p-4 rounded-xl bg-[#0e0f15] border border-[#27272a] space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-discord-brand" /> Classic Embed Settings
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-zinc-400 block mb-1">Embed Title</label>
                    <input
                      type="text"
                      value={currentMessage.embedConfig?.title || ""}
                      onChange={(e) =>
                        setCurrentMessage({
                          ...currentMessage,
                          embedConfig: { ...currentMessage.embedConfig, title: e.target.value },
                        })
                      }
                      placeholder="Embed Title"
                      className="w-full bg-[#14151b] border border-[#27272a] px-3 py-2 rounded-lg text-xs text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-zinc-400 block mb-1">Embed Description</label>
                    <textarea
                      rows={4}
                      value={currentMessage.embedConfig?.description || ""}
                      onChange={(e) =>
                        setCurrentMessage({
                          ...currentMessage,
                          embedConfig: { ...currentMessage.embedConfig, description: e.target.value },
                        })
                      }
                      placeholder="Markdown description..."
                      className="w-full bg-[#14151b] border border-[#27272a] p-3 rounded-lg text-xs text-white outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-zinc-400 block mb-1">Thumbnail URL</label>
                      <input
                        type="text"
                        value={currentMessage.embedConfig?.thumbnail || ""}
                        onChange={(e) =>
                          setCurrentMessage({
                            ...currentMessage,
                            embedConfig: { ...currentMessage.embedConfig, thumbnail: e.target.value },
                          })
                        }
                        placeholder="https://..."
                        className="w-full bg-[#14151b] border border-[#27272a] px-3 py-1.5 rounded-lg text-xs text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-zinc-400 block mb-1">Banner Image URL</label>
                      <input
                        type="text"
                        value={currentMessage.embedConfig?.image || ""}
                        onChange={(e) =>
                          setCurrentMessage({
                            ...currentMessage,
                            embedConfig: { ...currentMessage.embedConfig, image: e.target.value },
                          })
                        }
                        placeholder="https://..."
                        className="w-full bg-[#14151b] border border-[#27272a] px-3 py-1.5 rounded-lg text-xs text-white outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-zinc-400 block mb-1">Footer Text</label>
                      <input
                        type="text"
                        value={currentMessage.embedConfig?.footerText || ""}
                        onChange={(e) =>
                          setCurrentMessage({
                            ...currentMessage,
                            embedConfig: { ...currentMessage.embedConfig, footerText: e.target.value },
                          })
                        }
                        placeholder="Footer note"
                        className="w-full bg-[#14151b] border border-[#27272a] px-3 py-1.5 rounded-lg text-xs text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-zinc-400 block mb-1">Embed Color</label>
                      <input
                        type="text"
                        value={currentMessage.embedConfig?.color || currentMessage.accentColor || "#5865F2"}
                        onChange={(e) =>
                          setCurrentMessage({
                            ...currentMessage,
                            embedConfig: { ...currentMessage.embedConfig, color: e.target.value },
                          })
                        }
                        placeholder="#5865F2"
                        className="w-full bg-[#14151b] border border-[#27272a] px-3 py-1.5 rounded-lg text-xs text-white outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Real-Time Discord Client Simulator */}
        <div className="w-1/2 flex flex-col bg-[#050507] overflow-hidden">
          {/* Preview Header */}
          <div className="p-4 border-b border-[#18181b] bg-[#0c0d12] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-discord-brand" />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">Live Discord Client Simulator</span>
            </div>

            <div className="flex items-center gap-1 bg-[#14151b] p-1 rounded-lg border border-[#27272a]">
              <button
                onClick={() => setPreviewTab("visual")}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                  previewTab === "visual" ? "bg-discord-brand text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                Visual Preview
              </button>
              <button
                onClick={() => setPreviewTab("json")}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                  previewTab === "json" ? "bg-discord-brand text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                API Payload JSON
              </button>
            </div>
          </div>

          {/* Preview Body */}
          <div className="flex-1 p-6 overflow-y-auto flex items-start justify-center bg-[#313338]/30">
            {previewTab === "visual" ? (
              <div className="w-full max-w-xl bg-[#313338] rounded-xl p-4 shadow-2xl border border-[#2b2d31] space-y-3 font-sans">
                {/* Discord Message Author Row */}
                <div className="flex items-start gap-3 select-none">
                  <div className="w-10 h-10 rounded-full bg-discord-brand flex items-center justify-center font-bold text-white text-xs shrink-0 shadow">
                    GP
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white hover:underline cursor-pointer">
                        {botStatus?.tag?.split("#")[0] || "GuildPilot"}
                      </span>
                      <span className="bg-[#5865F2] text-[10px] text-white px-1 py-0.2 rounded font-bold uppercase tracking-wide">
                        APP
                      </span>
                      <span className="text-[11px] text-zinc-400">Today at 12:00 PM</span>
                    </div>

                    {/* RENDER DISCORD COMPONENTS V2 CONTAINER */}
                    {currentMessage.mode === "components_v2" ? (
                      <div
                        className="mt-2 rounded-lg bg-[#2b2d31] p-3 border-l-4 shadow-md space-y-3 transition-all"
                        style={{ borderColor: currentMessage.accentColor || "#5865F2" }}
                      >
                        {currentMessage.containerConfig.map((block, bIdx) => (
                          <div key={block.id || bIdx} className="space-y-2">
                            {/* Text Display */}
                            {block.type === "text" && (
                              <div className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">
                                {block.content?.split("\n").map((line, lIdx) => {
                                  if (line.startsWith("# ")) {
                                    return <h1 key={lIdx} className="text-lg font-bold text-white my-1">{line.replace("# ", "")}</h1>;
                                  }
                                  if (line.startsWith("### ")) {
                                    return <h3 key={lIdx} className="text-sm font-bold text-white my-1">{line.replace("### ", "")}</h3>;
                                  }
                                  if (line.startsWith("> ")) {
                                    return <blockquote key={lIdx} className="border-l-2 border-zinc-500 pl-2 text-zinc-400 italic my-1">{line.replace("> ", "")}</blockquote>;
                                  }
                                  return <p key={lIdx}>{line}</p>;
                                })}
                              </div>
                            )}

                            {/* Section Block (Left Text + Right Accessory) */}
                            {block.type === "section" && (
                              <div className="flex items-center justify-between gap-4 bg-[#1e1f22]/50 p-2.5 rounded-lg border border-[#2b2d31]">
                                <div className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed flex-1">
                                  {block.content}
                                </div>
                                {block.accessory && (
                                  <div className="shrink-0">
                                    {block.accessory.type === "thumbnail" && block.accessory.url && (
                                      <img
                                        src={block.accessory.url}
                                        alt=""
                                        className="w-14 h-14 rounded-lg object-cover border border-[#2b2d31]"
                                      />
                                    )}
                                    {block.accessory.type === "button" && (
                                      <button
                                        className={`px-3 py-1.5 rounded text-xs font-semibold shadow flex items-center gap-1.5 ${
                                          block.accessory.style === "Success"
                                            ? "bg-[#23A55A] text-white"
                                            : block.accessory.style === "Danger"
                                            ? "bg-[#F23F43] text-white"
                                            : block.accessory.style === "Secondary"
                                            ? "bg-[#4e5058] text-white"
                                            : "bg-[#5865F2] text-white"
                                        }`}
                                      >
                                        {block.accessory.emoji && <span>{block.accessory.emoji}</span>}
                                        <span>{block.accessory.label || "Action"}</span>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Media Gallery */}
                            {block.type === "media_gallery" && block.items && block.items.length > 0 && (
                              <div className={`grid gap-2 my-2 ${block.items.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                                {block.items.map((m, mIdx) => (
                                  m.url && (
                                    <img
                                      key={mIdx}
                                      src={m.url}
                                      alt=""
                                      className="rounded-lg object-cover w-full max-h-52 border border-[#2b2d31]"
                                    />
                                  )
                                ))}
                              </div>
                            )}

                            {/* Separator */}
                            {block.type === "separator" && (
                              <div className={`my-2 ${block.divider !== false ? "border-b border-[#3f4147]" : "h-2"}`} />
                            )}

                            {/* Action Row Buttons */}
                            {block.type === "action_row" && block.buttons && block.buttons.length > 0 && (
                              <div className="flex items-center gap-2 flex-wrap pt-1">
                                {block.buttons.map((btn, bIdx) => (
                                  <button
                                    key={btn.id || bIdx}
                                    className={`px-3.5 py-1.5 rounded text-xs font-semibold shadow transition-all flex items-center gap-1.5 ${
                                      btn.style === "Success"
                                        ? "bg-[#23A55A] hover:bg-[#23A55A]/90 text-white"
                                        : btn.style === "Danger"
                                        ? "bg-[#F23F43] hover:bg-[#F23F43]/90 text-white"
                                        : btn.style === "Secondary"
                                        ? "bg-[#4e5058] hover:bg-[#4e5058]/90 text-white"
                                        : btn.style === "Link"
                                        ? "bg-[#4e5058] hover:bg-[#4e5058]/90 text-white"
                                        : "bg-[#5865F2] hover:bg-[#5865F2]/90 text-white"
                                    }`}
                                  >
                                    {btn.emoji && <span>{btn.emoji}</span>}
                                    <span>{btn.label || "Button"}</span>
                                    {btn.style === "Link" && <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* RENDER CLASSIC EMBED */
                      <div
                        className="mt-2 rounded-lg bg-[#2b2d31] p-4 border-l-4 shadow-md space-y-2.5 font-sans"
                        style={{ borderColor: currentMessage.embedConfig?.color || currentMessage.accentColor || "#5865F2" }}
                      >
                        {currentMessage.embedConfig?.title && (
                          <h2 className="text-base font-bold text-white">{currentMessage.embedConfig.title}</h2>
                        )}
                        {currentMessage.embedConfig?.description && (
                          <p className="text-sm text-zinc-300 whitespace-pre-wrap">{currentMessage.embedConfig.description}</p>
                        )}
                        {currentMessage.embedConfig?.image && (
                          <img
                            src={currentMessage.embedConfig.image}
                            alt=""
                            className="rounded-lg object-cover w-full max-h-60 mt-2"
                          />
                        )}
                        {currentMessage.embedConfig?.footerText && (
                          <p className="text-[11px] text-zinc-400 pt-2 border-t border-[#3f4147]">
                            {currentMessage.embedConfig.footerText}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* JSON Payload Inspector */
              <div className="w-full h-full bg-[#0e0f15] border border-[#27272a] rounded-xl p-4 overflow-y-auto">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#27272a]">
                  <span className="text-xs font-mono text-zinc-400">Discord REST API v10 Payload (flags: 32768)</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(currentMessage, null, 2));
                      showToast("Payload JSON copied to clipboard!", "success");
                    }}
                    className="text-xs text-discord-brand hover:underline font-bold flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" /> Copy JSON
                  </button>
                </div>
                <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap">
                  {JSON.stringify(currentMessage, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Saved Messages Modal / Drawer */}
      {isSavedDrawerOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-150">
          <div className="bg-[#0e0f15] border border-[#27272a] rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[#18181b] flex items-center justify-between bg-[#050507]">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-discord-brand" />
                <h2 className="text-sm font-bold text-white">Saved Custom Messages & Drafts</h2>
              </div>
              <button
                onClick={() => setIsSavedDrawerOpen(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-2.5">
              {savedMessages.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs">
                  No saved custom messages found. Save your current draft using the "Save Message" button above!
                </div>
              ) : (
                savedMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-3.5 rounded-xl bg-[#14151b] border border-[#27272a] hover:border-discord-brand flex items-center justify-between transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{msg.name}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            msg.mode === "components_v2"
                              ? "bg-discord-brand/20 text-discord-brand border border-discord-brand/30"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {msg.mode === "components_v2" ? "Components V2" : "Embed"}
                        </span>
                        {msg.messageId && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-mono">
                            Live Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400">{msg.description || "No description provided."}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => loadMessageIntoEditor(msg)}
                        className="px-3 py-1.5 bg-discord-brand hover:bg-discord-brand/90 text-white text-xs font-bold rounded-lg transition-all"
                      >
                        Open in Editor
                      </button>
                      <button
                        onClick={() => handleDuplicateMessage(msg.id!)}
                        className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#27272a]"
                        title="Duplicate"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteMessage(msg.id!)}
                        className="p-1.5 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-[#27272a]"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
