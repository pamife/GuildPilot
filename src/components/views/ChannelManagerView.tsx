"use client";

import React, { useState } from "react";
import {
  Hash,
  Volume2,
  FolderTree,
  MessageSquare,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Settings,
  Shield,
  ChevronDown,
  ChevronRight,
  Lock,
  Flame,
  Clock,
  X,
  Check,
  Type,
  Sparkles,
} from "lucide-react";
import { useToast } from "../ToastContainer";
import { DISCORD_SYMBOL_PRESETS, FONT_STYLE_PRESETS, transformFont } from "@/lib/fontStyles";

interface Channel {
  id: string;
  name: string;
  type: number;
  position: number;
  parentId: string | null;
  topic?: string | null;
  nsfw?: boolean;
  slowmode?: number;
  permissionOverwrites?: any[];
}

interface ChannelManagerProps {
  channels: Channel[];
  roles: any[];
  onCreateChannel: (data: any) => Promise<void>;
  onUpdateChannel: (channelId: string, data: any) => Promise<void>;
  onDeleteChannel: (channelId: string) => Promise<void>;
  onDuplicateChannel: (channelId: string) => Promise<void>;
}

export function ChannelManagerView({
  channels,
  roles,
  onCreateChannel,
  onUpdateChannel,
  onDeleteChannel,
  onDuplicateChannel,
}: ChannelManagerProps) {
  const { showToast } = useToast();
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Form states
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState<number>(0);
  const [newParentId, setNewParentId] = useState<string>("");

  // Edit Form state
  const [editName, setEditName] = useState("");
  const [editTopic, setEditTopic] = useState("");
  const [editNsfw, setEditNsfw] = useState(false);
  const [editSlowmode, setEditSlowmode] = useState(0);
  const [editParentId, setEditParentId] = useState<string | null>(null);

  // Categories and channels breakdown
  const categories = channels.filter((c) => c.type === 4).sort((a, b) => a.position - b.position);
  const uncategorizedChannels = channels
    .filter((c) => c.type !== 4 && !c.parentId)
    .sort((a, b) => a.position - b.position);

  const applySymbolToName = (symbolPrefix: string, setter: (val: string) => void, currentVal: string) => {
    setter(`${symbolPrefix}${currentVal}`);
  };

  const applyFontToName = (style: any, setter: (val: string) => void, currentVal: string) => {
    setter(transformFont(currentVal, style));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    try {
      await onCreateChannel({
        name: newChannelName.trim(),
        type: newChannelType,
        parentId: newParentId || undefined,
      });
      showToast(`Kanal "${newChannelName}" erfolgreich erstellt!`, "success");
      setIsCreateOpen(false);
      setNewChannelName("");
    } catch (err: any) {
      showToast(err.message || "Fehler beim Erstellen des Kanals", "error");
    }
  };

  const openEditModal = (ch: Channel) => {
    setSelectedChannel(ch);
    setEditName(ch.name);
    setEditTopic(ch.topic || "");
    setEditNsfw(ch.nsfw || false);
    setEditSlowmode(ch.slowmode || 0);
    setEditParentId(ch.parentId || "");
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannel) return;
    try {
      await onUpdateChannel(selectedChannel.id, {
        name: editName.trim(),
        topic: editTopic,
        nsfw: editNsfw,
        slowmode: editSlowmode,
        parentId: editParentId === "" ? null : editParentId,
      });
      showToast(`Kanal #${editName} erfolgreich aktualisiert!`, "success");
      setIsEditOpen(false);
    } catch (err: any) {
      showToast(err.message || "Fehler beim Aktualisieren des Kanals", "error");
    }
  };

  const handleDelete = async (ch: Channel) => {
    if (!confirm(`Möchtest du #${ch.name} wirklich unwiderruflich löschen?`)) return;
    try {
      await onDeleteChannel(ch.id);
      showToast(`Kanal #${ch.name} gelöscht.`, "info");
    } catch (err: any) {
      showToast(err.message || "Fehler beim Löschen des Kanals", "error");
    }
  };

  const handleDuplicate = async (ch: Channel) => {
    try {
      await onDuplicateChannel(ch.id);
      showToast(`Kanal #${ch.name} dupliziert!`, "success");
    } catch (err: any) {
      showToast(err.message || "Fehler beim Duplizieren des Kanals", "error");
    }
  };

  const renderChannelIcon = (type: number) => {
    switch (type) {
      case 0:
        return <Hash className="w-4 h-4 text-indigo-400 shrink-0" />;
      case 2:
        return <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 4:
        return <FolderTree className="w-4 h-4 text-amber-400 shrink-0" />;
      case 15:
        return <MessageSquare className="w-4 h-4 text-sky-400 shrink-0" />;
      default:
        return <Hash className="w-4 h-4 text-indigo-400 shrink-0" />;
    }
  };

  const renderChannelRow = (ch: Channel) => (
    <div
      key={ch.id}
      className="group flex items-center justify-between p-3 rounded-xl bg-[#0d121c] hover:bg-[#131b2b] border border-[#1a2333] hover:border-indigo-500/40 transition-all shadow-sm"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {renderChannelIcon(ch.type)}
        <span className="text-xs font-semibold text-slate-200 truncate">{ch.name}</span>
        {ch.nsfw && (
          <span title="Altersbeschränkter Inhalt (NSFW)">
            <Flame className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          </span>
        )}
        {ch.slowmode ? (
          <span className="flex items-center gap-1 text-[10px] bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full text-amber-300 font-mono">
            <Clock className="w-3 h-3" /> {ch.slowmode}s
          </span>
        ) : null}
      </div>

      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
        <button
          onClick={() => handleDuplicate(ch)}
          title="Kanal duplizieren"
          className="p-1.5 text-slate-400 hover:text-white hover:bg-[#1a253a] rounded-lg transition-colors cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => openEditModal(ch)}
          title="Kanal-Einstellungen"
          className="p-1.5 text-slate-400 hover:text-white hover:bg-[#1a253a] rounded-lg transition-colors cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => handleDelete(ch)}
          title="Kanal löschen"
          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-[#0b0f17] text-slate-200">
      {/* Action Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Hash className="w-5 h-5" />
            </div>
            Kanal-Manager
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Kanäle erstellen, bearbeiten, sortieren und mit Symbolen & Schriftstilen formatieren.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-xs transition-all shadow-md shadow-indigo-600/25 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Kanal erstellen
        </button>
      </div>

      {/* Channel Tree Layout */}
      <div className="space-y-6">
        {/* Uncategorized Channels */}
        {uncategorizedChannels.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
              Unkategorisierte Kanäle ({uncategorizedChannels.length})
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {uncategorizedChannels.map((ch) => renderChannelRow(ch))}
            </div>
          </div>
        )}

        {/* Categorized Channels */}
        {categories.map((cat) => {
          const childChannels = channels
            .filter((c) => c.parentId === cat.id)
            .sort((a, b) => a.position - b.position);
          return (
            <div key={cat.id} className="bg-[#111724] border border-[#1e293b] hover:border-indigo-500/30 rounded-2xl p-5 space-y-3.5 shadow-sm transition-all">
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
                <div className="flex items-center gap-2.5">
                  <FolderTree className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-white">{cat.name}</span>
                  <span className="text-[11px] text-slate-400 font-mono">({childChannels.length})</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(cat)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-[#18233a] rounded-lg transition-colors cursor-pointer"
                    title="Kategorie bearbeiten"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(cat)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                    title="Kategorie löschen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {childChannels.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">Keine Kanäle in dieser Kategorie.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {childChannels.map((ch) => renderChannelRow(ch))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* CREATE CHANNEL MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0f1626] border border-[#212d45] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden space-y-4">
            <div className="flex items-center justify-between p-5 border-b border-[#1f2c44]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" /> Neuen Kanal erstellen
              </h3>
              <button onClick={() => setIsCreateOpen(false)} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-[#1a253b]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Kanal-Typ
                </label>
                <select
                  value={newChannelType}
                  onChange={(e) => setNewChannelType(Number(e.target.value))}
                  className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 text-slate-100 rounded-xl px-3.5 py-2 text-xs transition-all outline-none cursor-pointer"
                >
                  <option value={0}>Textkanal (#)</option>
                  <option value={2}>Sprachkanal (🔊)</option>
                  <option value={4}>Kategorie (📁)</option>
                  <option value={15}>Forenkanal (💬)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Kanalname
                </label>
                <input
                  type="text"
                  required
                  placeholder="z. B. 💬・allgemein"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all outline-none"
                />
              </div>

              {/* DISCORD SYMBOLS & DECORATION PRESETS */}
              <div className="p-3.5 bg-[#0d121c] border border-[#1e293b] rounded-xl space-y-2">
                <p className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Symbol-Vorlagen
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {DISCORD_SYMBOL_PRESETS.map((sym) => (
                    <button
                      key={sym.label}
                      type="button"
                      onClick={() => applySymbolToName(sym.prefix, setNewChannelName, newChannelName)}
                      className="px-2 py-1 bg-[#172033] hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg text-xs transition-colors flex items-center gap-1 border border-[#243350] cursor-pointer"
                    >
                      <span>{sym.prefix}</span>
                      <span className="text-[10px] text-slate-400">{sym.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* DISCORD AESTHETIC FONT TRANSFORMERS */}
              <div className="p-3.5 bg-[#0d121c] border border-[#1e293b] rounded-xl space-y-2">
                <p className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5" /> Schriftstile
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {FONT_STYLE_PRESETS.map((font) => (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => applyFontToName(font.id, setNewChannelName, newChannelName)}
                      className="px-2.5 py-1 bg-[#172033] hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg text-xs transition-colors font-medium border border-[#243350] cursor-pointer"
                    >
                      {font.sample}
                    </button>
                  ))}
                </div>
              </div>

              {newChannelType !== 4 && (
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                    Übergeordnete Kategorie (Optional)
                  </label>
                  <select
                    value={newParentId}
                    onChange={(e) => setNewParentId(e.target.value)}
                    className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 text-slate-100 rounded-xl px-3.5 py-2 text-xs transition-all outline-none cursor-pointer"
                  >
                    <option value="">(Keine Kategorie - Unkategorisiert)</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1e293b]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3.5 py-2 text-xs text-slate-400 hover:text-white hover:bg-[#1a253a] rounded-xl font-medium"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/25 cursor-pointer"
                >
                  Kanal erstellen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CHANNEL MODAL */}
      {isEditOpen && selectedChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0f1626] border border-[#212d45] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden space-y-4">
            <div className="flex items-center justify-between p-5 border-b border-[#1f2c44]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-400" /> #{selectedChannel.name} bearbeiten
              </h3>
              <button onClick={() => setIsEditOpen(false)} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-[#1a253b]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Kanalname
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all outline-none"
                />
              </div>

              {/* DISCORD SYMBOLS & DECORATION PRESETS */}
              <div className="p-3.5 bg-[#0d121c] border border-[#1e293b] rounded-xl space-y-2">
                <p className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Symbol-Vorlagen
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {DISCORD_SYMBOL_PRESETS.map((sym) => (
                    <button
                      key={sym.label}
                      type="button"
                      onClick={() => applySymbolToName(sym.prefix, setEditName, editName)}
                      className="px-2 py-1 bg-[#172033] hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg text-xs transition-colors flex items-center gap-1 border border-[#243350] cursor-pointer"
                    >
                      <span>{sym.prefix}</span>
                      <span className="text-[10px] text-slate-400">{sym.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* DISCORD AESTHETIC FONT TRANSFORMERS */}
              <div className="p-3.5 bg-[#0d121c] border border-[#1e293b] rounded-xl space-y-2">
                <p className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5" /> Schriftstile
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {FONT_STYLE_PRESETS.map((font) => (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => applyFontToName(font.id, setEditName, editName)}
                      className="px-2.5 py-1 bg-[#172033] hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg text-xs transition-colors font-medium border border-[#243350] cursor-pointer"
                    >
                      {font.sample}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Kanalthema / Beschreibung
                </label>
                <textarea
                  rows={2}
                  placeholder="Kanalthema festlegen..."
                  value={editTopic}
                  onChange={(e) => setEditTopic(e.target.value)}
                  className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2 text-xs transition-all outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                    Slowmode (Sekunden)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={21600}
                    value={editSlowmode}
                    onChange={(e) => setEditSlowmode(Number(e.target.value))}
                    className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 text-slate-100 rounded-xl px-3.5 py-2 text-xs transition-all outline-none font-mono"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="nsfw-check"
                    checked={editNsfw}
                    onChange={(e) => setEditNsfw(e.target.checked)}
                    className="rounded border-[#1e293b] text-indigo-600 focus:ring-0 w-4 h-4 bg-[#0d121c]"
                  />
                  <label htmlFor="nsfw-check" className="text-xs font-semibold text-slate-200 cursor-pointer">
                    NSFW (Altersbeschränkt)
                  </label>
                </div>
              </div>

              {selectedChannel.type !== 4 && (
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                    Kategorie
                  </label>
                  <select
                    value={editParentId || ""}
                    onChange={(e) => setEditParentId(e.target.value || null)}
                    className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 text-slate-100 rounded-xl px-3.5 py-2 text-xs transition-all outline-none cursor-pointer"
                  >
                    <option value="">(Keine Kategorie - Unkategorisiert)</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1e293b]">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-3.5 py-2 text-xs text-slate-400 hover:text-white hover:bg-[#1a253a] rounded-xl font-medium cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/25 cursor-pointer"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

