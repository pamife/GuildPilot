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
    // If name already starts with a symbol, strip it or prefix it
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
      showToast(`Channel "${newChannelName}" created successfully!`, "success");
      setIsCreateOpen(false);
      setNewChannelName("");
    } catch (err: any) {
      showToast(err.message || "Failed to create channel", "error");
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
      showToast(`Channel updated successfully!`, "success");
      setIsEditOpen(false);
    } catch (err: any) {
      showToast(err.message || "Failed to update channel", "error");
    }
  };

  const handleDelete = async (ch: Channel) => {
    if (!confirm(`Are you sure you want to delete #${ch.name}?`)) return;
    try {
      await onDeleteChannel(ch.id);
      showToast(`Channel #${ch.name} deleted.`, "info");
    } catch (err: any) {
      showToast(err.message || "Failed to delete channel", "error");
    }
  };

  const handleDuplicate = async (ch: Channel) => {
    try {
      await onDuplicateChannel(ch.id);
      showToast(`Channel #${ch.name} duplicated!`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to duplicate channel", "error");
    }
  };

  const renderChannelIcon = (type: number) => {
    switch (type) {
      case 0:
        return <Hash className="w-4 h-4 text-indigo-400" />;
      case 2:
        return <Volume2 className="w-4 h-4 text-indigo-400" />;
      case 4:
        return <FolderTree className="w-4 h-4 text-indigo-400" />;
      case 15:
        return <MessageSquare className="w-4 h-4 text-indigo-400" />;
      default:
        return <Hash className="w-4 h-4 text-indigo-400" />;
    }
  };

  const renderChannelRow = (ch: Channel) => (
    <div
      key={ch.id}
      className="group flex items-center justify-between p-3 rounded-xl bg-[#0d0d11] hover:bg-[#121218] border border-[#1f1f23] hover:border-indigo-500/30 transition-all shadow-sm"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {renderChannelIcon(ch.type)}
        <span className="text-sm font-semibold text-zinc-200 truncate">{ch.name}</span>
        {ch.nsfw && (
          <span title="NSFW">
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
          title="Duplicate Channel"
          className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#18181b] rounded-lg transition-colors cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => openEditModal(ch)}
          title="Channel Settings"
          className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#18181b] rounded-lg transition-colors cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => handleDelete(ch)}
          title="Delete Channel"
          className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-[#18181b] rounded-lg transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Action Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Hash className="w-5 h-5" />
            </div>
            Channel Manager
          </h2>
          <p className="text-sm text-zinc-400 mt-0.5">Create, edit, duplicate, and style channels with Discord symbols & aesthetic fonts.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Create Channel
        </button>
      </div>

      {/* Channel Tree Layout */}
      <div className="space-y-6">
        {/* Uncategorized Channels */}
        {uncategorizedChannels.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 px-1">
              Uncategorized Channels ({uncategorizedChannels.length})
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
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
            <div key={cat.id} className="bg-[#09090b] border border-[#1f1f23] hover:border-indigo-500/30 rounded-2xl p-5 space-y-3.5 shadow-lg transition-all">
              <div className="flex items-center justify-between border-b border-[#1f1f23] pb-3">
                <div className="flex items-center gap-2.5">
                  <FolderTree className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-bold uppercase tracking-wider text-white">{cat.name}</span>
                  <span className="text-xs text-zinc-500 font-mono">({childChannels.length})</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(cat)}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#18181b] rounded-lg transition-colors cursor-pointer"
                    title="Edit Category"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(cat)}
                    className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-[#18181b] rounded-lg transition-colors cursor-pointer"
                    title="Delete Category"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {childChannels.length === 0 ? (
                <p className="text-xs text-zinc-500 italic py-2">No channels inside this category.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {childChannels.map((ch) => renderChannelRow(ch))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* CREATE CHANNEL MODAL WITH FANCY STYLER */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0a0a0e] border border-[#1f1f2a] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden space-y-4">
            <div className="flex items-center justify-between p-5 border-b border-[#1f1f23]">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" /> Create Channel
              </h3>
              <button onClick={() => setIsCreateOpen(false)} className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-[#18181b]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Channel Type
                </label>
                <select
                  value={newChannelType}
                  onChange={(e) => setNewChannelType(Number(e.target.value))}
                  className="w-full bg-[#0d0d11] border border-[#27272a] focus:border-indigo-500 text-zinc-100 rounded-xl px-4 py-2.5 text-sm transition-all outline-none cursor-pointer"
                >
                  <option value={0}>Text Channel (#)</option>
                  <option value={2}>Voice Channel (🔊)</option>
                  <option value={4}>Category (📁)</option>
                  <option value={15}>Forum Channel (💬)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Channel Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 💬・general-chat"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  className="w-full bg-[#0d0d11] border border-[#27272a] focus:border-indigo-500 text-zinc-100 placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all outline-none"
                />
              </div>

              {/* DISCORD SYMBOLS & DECORATION PRESETS */}
              <div className="p-4 bg-[#0d0d11] border border-[#1f1f23] rounded-xl space-y-2.5">
                <p className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Discord Channel Symbol Presets
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {DISCORD_SYMBOL_PRESETS.map((sym) => (
                    <button
                      key={sym.label}
                      type="button"
                      onClick={() => applySymbolToName(sym.prefix, setNewChannelName, newChannelName)}
                      className="px-2.5 py-1 bg-[#18181b] hover:bg-indigo-600 text-zinc-300 hover:text-white rounded-lg text-xs transition-colors flex items-center gap-1 border border-[#27272a] cursor-pointer"
                    >
                      <span>{sym.prefix}</span>
                      <span className="text-[10px] text-zinc-500">{sym.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* DISCORD AESTHETIC FONT TRANSFORMERS */}
              <div className="p-4 bg-[#0d0d11] border border-[#1f1f23] rounded-xl space-y-2.5">
                <p className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5" /> Aesthetic Font Styles
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {FONT_STYLE_PRESETS.map((font) => (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => applyFontToName(font.id, setNewChannelName, newChannelName)}
                      className="px-3 py-1 bg-[#18181b] hover:bg-indigo-600 text-zinc-300 hover:text-white rounded-lg text-xs transition-colors font-medium border border-[#27272a] cursor-pointer"
                    >
                      {font.sample}
                    </button>
                  ))}
                </div>
              </div>

              {newChannelType !== 4 && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                    Category Parent (Optional)
                  </label>
                  <select
                    value={newParentId}
                    onChange={(e) => setNewParentId(e.target.value)}
                    className="w-full bg-[#0d0d11] border border-[#27272a] focus:border-indigo-500 text-zinc-100 rounded-xl px-4 py-2.5 text-sm transition-all outline-none cursor-pointer"
                  >
                    <option value="">(No Category - Uncategorized)</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1f1f23]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-[#18181b] rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  Create Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CHANNEL MODAL WITH FANCY STYLER */}
      {isEditOpen && selectedChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0a0a0e] border border-[#1f1f2a] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden space-y-4">
            <div className="flex items-center justify-between p-5 border-b border-[#1f1f23]">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-400" /> Edit #{selectedChannel.name}
              </h3>
              <button onClick={() => setIsEditOpen(false)} className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-[#18181b]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Channel Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#0d0d11] border border-[#27272a] focus:border-indigo-500 text-zinc-100 placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all outline-none"
                />
              </div>

              {/* DISCORD SYMBOLS & DECORATION PRESETS */}
              <div className="p-4 bg-[#0d0d11] border border-[#1f1f23] rounded-xl space-y-2.5">
                <p className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Symbol Presets
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {DISCORD_SYMBOL_PRESETS.map((sym) => (
                    <button
                      key={sym.label}
                      type="button"
                      onClick={() => applySymbolToName(sym.prefix, setEditName, editName)}
                      className="px-2.5 py-1 bg-[#18181b] hover:bg-indigo-600 text-zinc-300 hover:text-white rounded-lg text-xs transition-colors flex items-center gap-1 border border-[#27272a] cursor-pointer"
                    >
                      <span>{sym.prefix}</span>
                      <span className="text-[10px] text-zinc-500">{sym.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* DISCORD AESTHETIC FONT TRANSFORMERS */}
              <div className="p-4 bg-[#0d0d11] border border-[#1f1f23] rounded-xl space-y-2.5">
                <p className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5" /> Aesthetic Font Styles
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {FONT_STYLE_PRESETS.map((font) => (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => applyFontToName(font.id, setEditName, editName)}
                      className="px-3 py-1 bg-[#18181b] hover:bg-indigo-600 text-zinc-300 hover:text-white rounded-lg text-xs transition-colors font-medium border border-[#27272a] cursor-pointer"
                    >
                      {font.sample}
                    </button>
                  ))}
                </div>
              </div>

              {selectedChannel.type !== 4 && (
                <>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                      Topic
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Channel topic..."
                      value={editTopic}
                      onChange={(e) => setEditTopic(e.target.value)}
                      className="w-full bg-[#0d0d11] border border-[#27272a] focus:border-indigo-500 text-zinc-100 placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm transition-all outline-none resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                      Slowmode Cooldown
                    </label>
                    <select
                      value={editSlowmode}
                      onChange={(e) => setEditSlowmode(Number(e.target.value))}
                      className="w-full bg-[#0d0d11] border border-[#27272a] focus:border-indigo-500 text-zinc-100 rounded-xl px-4 py-2.5 text-sm transition-all outline-none cursor-pointer"
                    >
                      <option value={0}>Off</option>
                      <option value={5}>5 seconds</option>
                      <option value={10}>10 seconds</option>
                      <option value={15}>15 seconds</option>
                      <option value={30}>30 seconds</option>
                      <option value={60}>1 minute</option>
                      <option value={300}>5 minutes</option>
                      <option value={600}>10 minutes</option>
                      <option value={3600}>1 hour</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-[#0d0d11] border border-[#1f1f23] rounded-xl">
                    <div>
                      <p className="text-sm font-bold text-white">NSFW Channel</p>
                      <p className="text-xs text-zinc-400">Users must confirm age to view.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={editNsfw}
                      onChange={(e) => setEditNsfw(e.target.checked)}
                      className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                      Category Parent
                    </label>
                    <select
                      value={editParentId || ""}
                      onChange={(e) => setEditParentId(e.target.value || null)}
                      className="w-full bg-[#0d0d11] border border-[#27272a] focus:border-indigo-500 text-zinc-100 rounded-xl px-4 py-2.5 text-sm transition-all outline-none cursor-pointer"
                    >
                      <option value="">(No Category - Uncategorized)</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1f1f23]">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-[#18181b] rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
