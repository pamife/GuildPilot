"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Smile,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  CheckCircle2,
  Hash,
  Sparkles,
  Bot,
  AlertCircle,
  RefreshCw,
  Power,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastContainer";

interface AutoReactViewProps {
  selectedGuildId: string | null;
  channels: any[];
  emojis: any[]; // Guild custom emojis
  botStatus: { ready: boolean; tag: string; ping: number } | null;
}

const COMMON_EMOJIS = [
  "👍", "❤️", "🔥", "⭐", "🎉", "🚀", "👀", "💬", "💯", "👏", "😂", "✨", "👑", "🎯", "💎", "🙌", "😍", "⚡", "💡", "✅",
];

export function AutoReactView({
  selectedGuildId,
  channels,
  emojis: guildCustomEmojis,
  botStatus,
}: AutoReactViewProps) {
  const { showToast } = useToast();
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal / Editor State
  const [isEditing, setIsEditing] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formEnabled, setFormEnabled] = useState(true);
  const [formChannelIds, setFormChannelIds] = useState<string[]>([]);
  const [formEmojis, setFormEmojis] = useState<string[]>([]);
  const [formIgnoreBots, setFormIgnoreBots] = useState(true);
  const [customEmojiInput, setCustomEmojiInput] = useState("");
  const [saving, setSaving] = useState(false);

  const textChannels = channels.filter((c) => c.type === 0 || c.type === 5);

  // Fetch all rules
  const fetchRules = useCallback(async () => {
    if (!selectedGuildId) return;
    setLoading(true);
    try {
      const res = await api.get(`/guilds/${selectedGuildId}/auto-reacts`);
      setRules(res.data || []);
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to load auto-react rules", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedGuildId, showToast]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const openCreateModal = () => {
    setEditingRuleId(null);
    setFormName("New Auto Reaction");
    setFormEnabled(true);
    setFormChannelIds([]);
    setFormEmojis(["👍"]);
    setFormIgnoreBots(true);
    setCustomEmojiInput("");
    setIsEditing(true);
  };

  const openEditModal = (rule: any) => {
    setEditingRuleId(rule.id);
    setFormName(rule.name || "Auto Reaction");
    setFormEnabled(rule.enabled);
    try {
      setFormChannelIds(JSON.parse(rule.channelIds || "[]"));
    } catch {
      setFormChannelIds([]);
    }
    try {
      setFormEmojis(JSON.parse(rule.emojis || "[]"));
    } catch {
      setFormEmojis([]);
    }
    setFormIgnoreBots(rule.ignoreBots ?? true);
    setCustomEmojiInput("");
    setIsEditing(true);
  };

  const handleSaveRule = async () => {
    if (!selectedGuildId) return;
    if (!formName.trim()) {
      showToast("Please enter a rule name", "error");
      return;
    }
    if (formEmojis.length === 0) {
      showToast("Please add at least one reaction emoji", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        enabled: formEnabled,
        channelIds: formChannelIds,
        emojis: formEmojis,
        ignoreBots: formIgnoreBots,
      };

      if (editingRuleId) {
        await api.put(`/guilds/${selectedGuildId}/auto-reacts/${editingRuleId}`, payload);
        showToast("Auto-react rule updated successfully!", "success");
      } else {
        await api.post(`/guilds/${selectedGuildId}/auto-reacts`, payload);
        showToast("Auto-react rule created successfully!", "success");
      }

      setIsEditing(false);
      fetchRules();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to save rule", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm("Are you sure you want to delete this auto-reaction rule?")) return;
    try {
      await api.delete(`/guilds/${selectedGuildId}/auto-reacts/${id}`);
      showToast("Rule deleted", "success");
      fetchRules();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to delete rule", "error");
    }
  };

  const handleToggleRule = async (id: string) => {
    try {
      await api.patch(`/guilds/${selectedGuildId}/auto-reacts/${id}/toggle`);
      setRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
      );
      showToast("Rule status toggled", "success");
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to toggle rule", "error");
    }
  };

  const toggleChannel = (channelId: string) => {
    setFormChannelIds((prev) =>
      prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId]
    );
  };

  const addEmoji = (emoji: string) => {
    if (!emoji || formEmojis.includes(emoji)) return;
    setFormEmojis((prev) => [...prev, emoji]);
  };

  const removeEmoji = (index: number) => {
    setFormEmojis((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddCustomInputEmoji = () => {
    if (!customEmojiInput.trim()) return;
    addEmoji(customEmojiInput.trim());
    setCustomEmojiInput("");
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#1e1f22] text-zinc-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-[#2b2d31] bg-[#111214] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-discord-brand/20 border border-amber-500/30 text-amber-400">
            <Smile className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Auto Reaction Engine
            </h1>
            <p className="text-xs text-zinc-400">
              Automatically react with configured emojis whenever someone posts in designated channels
            </p>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-discord-brand hover:bg-discord-brandHover text-white shadow-lg shadow-discord-brand/25 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>New Auto React</span>
        </button>
      </div>

      {/* Main List */}
      <div className="flex-1 p-6 overflow-y-auto space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-zinc-500">
            <RefreshCw className="w-8 h-8 animate-spin mb-3 text-discord-brand" />
            <p className="text-sm">Loading auto-react rules...</p>
          </div>
        ) : rules.length === 0 ? (
          <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-12 text-center max-w-lg mx-auto my-8 space-y-4 shadow-xl">
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto">
              <Smile className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">No Auto Reactions Configured</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                Create your first rule to automatically add emoji reactions to messages in specific channels (e.g. #memes, #announcements, #art).
              </p>
            </div>
            <button
              onClick={openCreateModal}
              className="px-5 py-2.5 bg-discord-brand hover:bg-discord-brandHover text-white text-xs font-bold rounded-xl shadow-lg transition-all"
            >
              + Create First Auto React
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rules.map((rule) => {
              let ruleChannels: string[] = [];
              try {
                ruleChannels = JSON.parse(rule.channelIds || "[]");
              } catch {}
              let ruleEmojis: string[] = [];
              try {
                ruleEmojis = JSON.parse(rule.emojis || "[]");
              } catch {}

              return (
                <div
                  key={rule.id}
                  className={`bg-[#2b2d31] border rounded-2xl p-5 space-y-4 transition-all flex flex-col justify-between ${
                    rule.enabled
                      ? "border-[#35373c] hover:border-discord-brand/50 shadow-lg"
                      : "border-[#35373c]/50 opacity-60 bg-[#2b2d31]/60"
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Status & Actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            rule.enabled ? "bg-emerald-500" : "bg-zinc-600"
                          }`}
                        />
                        <h3 className="font-bold text-white text-sm truncate max-w-[170px]">
                          {rule.name}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleRule(rule.id)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            rule.enabled
                              ? "text-emerald-400 hover:bg-emerald-500/10"
                              : "text-zinc-500 hover:bg-white/5"
                          }`}
                          title={rule.enabled ? "Disable Rule" : "Enable Rule"}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(rule)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                          title="Edit Rule"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Channels */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                        Channels
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {ruleChannels.length === 0 ? (
                          <span className="px-2 py-0.5 rounded-md bg-[#1e1f22] text-[11px] text-zinc-400 font-medium">
                            🌐 All Channels
                          </span>
                        ) : (
                          ruleChannels.map((cId) => {
                            const c = channels.find((ch) => ch.id === cId);
                            return (
                              <span
                                key={cId}
                                className="px-2 py-0.5 rounded-md bg-[#1e1f22] border border-[#3f4147] text-[11px] text-cyan-400 font-mono flex items-center gap-1"
                              >
                                <Hash className="w-3 h-3 text-zinc-500" />
                                {c ? c.name : cId}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Emojis Sequence */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                        Reaction Emojis ({ruleEmojis.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5 bg-[#1e1f22] p-2.5 rounded-xl border border-[#35373c]">
                        {ruleEmojis.map((emojiStr, idx) => (
                          <span
                            key={idx}
                            className="text-base p-1 rounded bg-[#2b2d31] border border-[#3f4147] flex items-center justify-center min-w-[28px] select-none shadow-sm"
                          >
                            {emojiStr}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 text-[10px] text-zinc-500 flex items-center justify-between border-t border-[#35373c]/50">
                    <span>{rule.ignoreBots ? "🤖 Ignores Bots" : "🤖 Reacts to All"}</span>
                    <span>{new Date(rule.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#35373c] pb-4">
              <div className="flex items-center gap-2">
                <Smile className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-bold text-white">
                  {editingRuleId ? "Edit Auto Reaction" : "Create Auto Reaction"}
                </h2>
              </div>
              <button
                onClick={() => setIsEditing(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Name & Enabled */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-zinc-300 block mb-1">
                    Rule Name
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Meme Channel Reactions"
                    className="w-full bg-[#1e1f22] border border-[#3f4147] rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1">
                    Status
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormEnabled(!formEnabled)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-2 ${
                      formEnabled
                        ? "bg-emerald-600/20 border-emerald-500 text-emerald-400"
                        : "bg-zinc-800 border-zinc-700 text-zinc-400"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        formEnabled ? "bg-emerald-500" : "bg-zinc-500"
                      }`}
                    />
                    {formEnabled ? "Active" : "Disabled"}
                  </button>
                </div>
              </div>

              {/* Target Channels Multi-Select */}
              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">
                  Target Channels (Leave empty for All Channels)
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-[#1e1f22] rounded-xl border border-[#3f4147]">
                  {textChannels.map((c) => {
                    const isSelected = formChannelIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleChannel(c.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                          isSelected
                            ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold"
                            : "bg-[#2b2d31] border-[#3f4147] text-zinc-400 hover:text-white"
                        }`}
                      >
                        <Hash className="w-3 h-3 text-zinc-500" />
                        <span>{c.name}</span>
                        {isSelected && <CheckCircle2 className="w-3 h-3 ml-0.5 text-cyan-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reaction Emojis Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-300 block">
                    Reaction Emojis (Order of reactions)
                  </label>
                  <span className="text-[11px] text-zinc-500">
                    {formEmojis.length} emojis selected
                  </span>
                </div>

                {/* Selected Emojis Box */}
                <div className="min-h-[50px] bg-[#1e1f22] border border-[#3f4147] rounded-xl p-3 flex flex-wrap items-center gap-2">
                  {formEmojis.length === 0 ? (
                    <span className="text-xs text-zinc-500 italic">
                      Click emojis below or type to add reactions
                    </span>
                  ) : (
                    formEmojis.map((emoji, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 bg-[#2b2d31] border border-[#35373c] px-2.5 py-1 rounded-lg text-sm text-white shadow-sm"
                      >
                        <span>{emoji}</span>
                        <button
                          type="button"
                          onClick={() => removeEmoji(idx)}
                          className="text-zinc-500 hover:text-rose-400 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Quick Unicode Picker Bar */}
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-zinc-400">
                    Popular Reactions:
                  </span>
                  <div className="flex flex-wrap gap-1.5 bg-[#18191c] p-2 rounded-xl border border-[#35373c]">
                    {COMMON_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => addEmoji(emoji)}
                        className="text-lg p-1 hover:bg-[#2b2d31] rounded-lg transition-transform active:scale-125"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Server Custom Emojis (if any exist) */}
                {guildCustomEmojis && guildCustomEmojis.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-zinc-400">
                      Server Custom Emojis:
                    </span>
                    <div className="flex flex-wrap gap-1.5 bg-[#18191c] p-2 rounded-xl border border-[#35373c] max-h-24 overflow-y-auto">
                      {guildCustomEmojis.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => addEmoji(`<:${e.name}:${e.id}>`)}
                          title={`:${e.name}:`}
                          className="p-1 hover:bg-[#2b2d31] rounded-lg transition-all"
                        >
                          {e.url ? (
                            <img src={e.url} alt={e.name} className="w-6 h-6 object-contain" />
                          ) : (
                            <span className="text-xs font-mono">:{e.name}:</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Emoji Input */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={customEmojiInput}
                    onChange={(e) => setCustomEmojiInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustomInputEmoji();
                      }
                    }}
                    placeholder="Type or paste any emoji or custom code..."
                    className="flex-1 bg-[#1e1f22] border border-[#3f4147] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomInputEmoji}
                    className="px-3 py-1.5 bg-[#35373c] hover:bg-[#3f4147] text-white text-xs font-bold rounded-xl transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Ignore Bots Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-[#35373c]/60">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-300">
                    Ignore other bot messages
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIgnoreBots}
                    onChange={(e) => setFormIgnoreBots(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#35373c]">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRule}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-discord-brand hover:bg-discord-brandHover text-white text-xs font-bold rounded-xl shadow-lg shadow-discord-brand/25 transition-all disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Save Auto React</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
