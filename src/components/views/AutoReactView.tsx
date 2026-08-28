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
  Download,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastContainer";
import { QuickImportModal } from "../QuickImportModal";

interface AutoReactViewProps {
  selectedGuildId: string | null;
  channels: any[];
  emojis: any[]; // Guild custom emojis
  botStatus: { ready: boolean; tag: string; ping: number } | null;
  guilds?: any[];
}

const COMMON_EMOJIS = [
  "👍", "❤️", "🔥", "⭐", "🎉", "🚀", "👀", "💬", "💯", "👏", "😂", "✨", "👑", "🎯", "💎", "🙌", "😍", "⚡", "💡", "✅",
];

export function AutoReactView({
  selectedGuildId,
  channels,
  emojis: guildCustomEmojis,
  botStatus,
  guilds = [],
}: AutoReactViewProps) {
  const { showToast } = useToast();
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

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
      showToast(err.response?.data?.error || "Fehler beim Laden der Auto-Reaktionsregeln", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedGuildId, showToast]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const openCreateModal = () => {
    setEditingRuleId(null);
    setFormName("Neue Auto-Reaktion");
    setFormEnabled(true);
    setFormChannelIds([]);
    setFormEmojis(["👍"]);
    setFormIgnoreBots(true);
    setCustomEmojiInput("");
    setIsEditing(true);
  };

  const openEditModal = (rule: any) => {
    setEditingRuleId(rule.id);
    setFormName(rule.name || "Auto-Reaktion");
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
      showToast("Bitte gib einen Namen für die Regel ein", "error");
      return;
    }
    if (formEmojis.length === 0) {
      showToast("Bitte füge mindestens ein Reaktions-Emoji hinzu", "error");
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
        showToast("Auto-Reaktionsregel erfolgreich aktualisiert!", "success");
      } else {
        await api.post(`/guilds/${selectedGuildId}/auto-reacts`, payload);
        showToast("Auto-Reaktionsregel erfolgreich erstellt!", "success");
      }

      setIsEditing(false);
      fetchRules();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Fehler beim Speichern der Regel", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm("Möchtest du diese Auto-Reaktionsregel wirklich löschen?")) return;
    try {
      await api.delete(`/guilds/${selectedGuildId}/auto-reacts/${id}`);
      showToast("Regel gelöscht", "success");
      fetchRules();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Fehler beim Löschen der Regel", "error");
    }
  };

  const handleToggleRule = async (id: string) => {
    try {
      await api.patch(`/guilds/${selectedGuildId}/auto-reacts/${id}/toggle`);
      setRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
      );
      showToast("Regel-Status geändert", "success");
    } catch (err: any) {
      showToast(err.response?.data?.error || "Fehler beim Umschalten der Regel", "error");
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
    <div className="flex-1 flex flex-col h-full bg-[#0b0f17] text-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-[#1e293b] bg-[#0d121c] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Smile className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Auto-Reaktions-Engine
            </h1>
            <p className="text-xs text-slate-400">
              Automatisch mit festgelegten Emojis reagieren, sobald jemand in bestimmten Kanälen postet
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#111724] hover:bg-[#1a2333] text-slate-300 hover:text-white border border-[#1e293b] transition-all cursor-pointer shadow-sm"
            title="Auto-Reaktionen von einem anderen Server importieren"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Von Server importieren</span>
          </button>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/25 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Neue Auto-Reaktion</span>
          </button>
        </div>
      </div>

      {/* Main List */}
      <div className="flex-1 p-6 md:p-8 overflow-y-auto space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mb-3 text-indigo-400" />
            <p className="text-xs">Lade Auto-Reaktionsregeln...</p>
          </div>
        ) : rules.length === 0 ? (
          <div className="bg-[#111724] border border-[#1e293b] rounded-2xl p-10 text-center max-w-lg mx-auto my-8 space-y-4 shadow-sm">
            <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto">
              <Smile className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Keine Auto-Reaktionen konfiguriert</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Erstelle deine erste Regel, um Nachrichten in bestimmten Kanälen automatisch mit Emojis zu versehen (z. B. #memes, #ankuendigungen, #galerie).
              </p>
            </div>
            <button
              onClick={openCreateModal}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/25 transition-all cursor-pointer"
            >
              + Erste Auto-Reaktion erstellen
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
                  className={`bg-[#111724] border rounded-2xl p-5 space-y-4 transition-all flex flex-col justify-between shadow-sm ${
                    rule.enabled
                      ? "border-[#1e293b] hover:border-indigo-500/40"
                      : "border-[#1e293b]/50 opacity-60 bg-[#0d121c]"
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Status & Actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            rule.enabled ? "bg-emerald-500" : "bg-slate-600"
                          }`}
                        />
                        <h3 className="font-bold text-white text-xs truncate max-w-[170px]">
                          {rule.name}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleRule(rule.id)}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            rule.enabled
                              ? "text-emerald-400 hover:bg-emerald-500/10"
                              : "text-slate-500 hover:bg-white/5"
                          }`}
                          title={rule.enabled ? "Regel deaktivieren" : "Regel aktivieren"}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(rule)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                          title="Regel bearbeiten"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Regel löschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Channels */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Kanäle
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {ruleChannels.length === 0 ? (
                          <span className="px-2 py-0.5 rounded-md bg-[#0d121c] text-[11px] text-slate-400 font-medium">
                            🌐 Alle Kanäle
                          </span>
                        ) : (
                          ruleChannels.map((cId) => {
                            const c = channels.find((ch) => ch.id === cId);
                            return (
                              <span
                                key={cId}
                                className="px-2 py-0.5 rounded-md bg-[#0d121c] border border-[#1e293b] text-[11px] text-indigo-300 font-mono flex items-center gap-1"
                              >
                                <Hash className="w-3 h-3 text-slate-500" />
                                {c ? c.name : cId}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Emojis Sequence */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Reaktions-Emojis ({ruleEmojis.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5 bg-[#0d121c] p-2.5 rounded-xl border border-[#1e293b]">
                        {ruleEmojis.map((emojiStr, idx) => (
                          <span
                            key={idx}
                            className="text-sm p-1 rounded bg-[#111724] border border-[#1e293b] flex items-center justify-center min-w-[28px] select-none shadow-sm"
                          >
                            {emojiStr}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 text-[10px] text-slate-500 flex items-center justify-between border-t border-[#1e293b]">
                    <span>{rule.ignoreBots ? "🤖 Ignoriert Bots" : "🤖 Reagiert auf alle"}</span>
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f1626] border border-[#212d45] rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in duration-150 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#1f2c44] pb-4">
              <div className="flex items-center gap-2">
                <Smile className="w-5 h-5 text-amber-400" />
                <h2 className="text-sm font-bold text-white">
                  {editingRuleId ? "Auto-Reaktion bearbeiten" : "Neue Auto-Reaktion erstellen"}
                </h2>
              </div>
              <button
                onClick={() => setIsEditing(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Name & Enabled */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Regelname
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="z. B. Meme-Kanal Reaktionen"
                    className="w-full bg-[#0d121c] border border-[#1e293b] rounded-xl px-3.5 py-2 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Status
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormEnabled(!formEnabled)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                      formEnabled
                        ? "bg-emerald-600/20 border-emerald-500 text-emerald-400"
                        : "bg-[#0d121c] border-[#1e293b] text-slate-400"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        formEnabled ? "bg-emerald-500" : "bg-slate-500"
                      }`}
                    />
                    {formEnabled ? "Aktiv" : "Deaktiviert"}
                  </button>
                </div>
              </div>

              {/* Target Channels Multi-Select */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Zielkanäle (Leer lassen für Alle Kanäle)
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-[#0d121c] rounded-xl border border-[#1e293b]">
                  {textChannels.map((c) => {
                    const isSelected = formChannelIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleChannel(c.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-indigo-500/20 border-indigo-400 text-indigo-300 font-bold"
                            : "bg-[#111724] border-[#1e293b] text-slate-400 hover:text-white"
                        }`}
                      >
                        <Hash className="w-3 h-3 text-slate-500" />
                        <span>{c.name}</span>
                        {isSelected && <CheckCircle2 className="w-3 h-3 ml-0.5 text-indigo-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reaction Emojis Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Reaktions-Emojis (Reihenfolge)
                  </label>
                  <span className="text-[11px] text-slate-500">
                    {formEmojis.length} Emojis ausgewählt
                  </span>
                </div>

                {/* Selected Emojis Box */}
                <div className="min-h-[50px] bg-[#0d121c] border border-[#1e293b] rounded-xl p-3 flex flex-wrap items-center gap-2">
                  {formEmojis.length === 0 ? (
                    <span className="text-xs text-slate-500 italic">
                      Klicke auf Emojis unten oder tippe eines ein
                    </span>
                  ) : (
                    formEmojis.map((emoji, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 bg-[#111724] border border-[#1e293b] px-2.5 py-1 rounded-lg text-xs text-white shadow-sm"
                      >
                        <span>{emoji}</span>
                        <button
                          type="button"
                          onClick={() => removeEmoji(idx)}
                          className="text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Quick Unicode Picker Bar */}
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    Beliebte Reaktionen:
                  </span>
                  <div className="flex flex-wrap gap-1.5 bg-[#0d121c] p-2 rounded-xl border border-[#1e293b]">
                    {COMMON_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => addEmoji(emoji)}
                        className="text-base p-1 hover:bg-[#111724] rounded-lg transition-transform active:scale-125 cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Server Custom Emojis (if any exist) */}
                {guildCustomEmojis && guildCustomEmojis.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      Servereigene Emojis:
                    </span>
                    <div className="flex flex-wrap gap-1.5 bg-[#0d121c] p-2 rounded-xl border border-[#1e293b] max-h-24 overflow-y-auto">
                      {guildCustomEmojis.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => addEmoji(`<:${e.name}:${e.id}>`)}
                          title={`:${e.name}:`}
                          className="p-1 hover:bg-[#111724] rounded-lg transition-all cursor-pointer"
                        >
                          {e.url ? (
                            <img src={e.url} alt={e.name} className="w-5 h-5 object-contain" />
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
                    placeholder="Emoji eintippen oder einfügen..."
                    className="flex-1 bg-[#0d121c] border border-[#1e293b] rounded-xl px-3.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomInputEmoji}
                    className="px-3.5 py-1.5 bg-[#111724] hover:bg-indigo-600 text-white text-xs font-semibold rounded-xl border border-[#1e293b] transition-colors cursor-pointer"
                  >
                    Hinzufügen
                  </button>
                </div>
              </div>

              {/* Ignore Bots Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-[#1e293b]">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-300">
                    Nachrichten anderer Bots ignorieren
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIgnoreBots}
                    onChange={(e) => setFormIgnoreBots(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#1a2333] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#1f2c44]">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleSaveRule}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/25 transition-all disabled:opacity-50 cursor-pointer"
              >
                {saving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Speichern</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK IMPORT MODAL */}
      <QuickImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        targetGuildId={selectedGuildId}
        guilds={guilds}
        moduleType="auto-react"
        onImportComplete={fetchRules}
      />
    </div>
  );
}

