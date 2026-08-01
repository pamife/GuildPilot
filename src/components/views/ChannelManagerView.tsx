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
        return <Hash className="w-4 h-4 text-discord-muted" />;
      case 2:
        return <Volume2 className="w-4 h-4 text-discord-muted" />;
      case 4:
        return <FolderTree className="w-4 h-4 text-discord-muted" />;
      case 15:
        return <MessageSquare className="w-4 h-4 text-discord-muted" />;
      default:
        return <Hash className="w-4 h-4 text-discord-muted" />;
    }
  };

  const renderChannelRow = (ch: Channel) => (
    <div
      key={ch.id}
      className="group flex items-center justify-between p-2.5 rounded-md bg-[#2b2d31] hover:bg-[#35373c] border border-[#35373c]/40 transition-colors"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {renderChannelIcon(ch.type)}
        <span className="text-sm font-medium text-discord-header truncate">{ch.name}</span>
        {ch.nsfw && (
          <span title="NSFW">
            <Flame className="w-3.5 h-3.5 text-discord-red shrink-0" />
          </span>
        )}
        {ch.slowmode ? (
          <span className="flex items-center gap-1 text-[10px] bg-[#1e1f22] px-1.5 py-0.5 rounded text-discord-yellow">
            <Clock className="w-3 h-3" /> {ch.slowmode}s
          </span>
        ) : null}
      </div>

      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
        <button
          onClick={() => handleDuplicate(ch)}
          title="Duplicate Channel"
          className="p-1 text-discord-muted hover:text-white hover:bg-[#1e1f22] rounded transition-colors"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => openEditModal(ch)}
          title="Channel Settings"
          className="p-1 text-discord-muted hover:text-white hover:bg-[#1e1f22] rounded transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => handleDelete(ch)}
          title="Delete Channel"
          className="p-1 text-discord-muted hover:text-discord-red hover:bg-[#1e1f22] rounded transition-colors"
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
          <h2 className="text-xl font-bold text-discord-header flex items-center gap-2">
            <Hash className="w-6 h-6 text-discord-brand" />
            Channel Manager
          </h2>
          <p className="text-sm text-discord-muted">Create, edit, duplicate, and style channels with Discord symbols & aesthetic fonts.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-discord-brand hover:bg-discord-brandHover text-white rounded-lg font-medium text-sm transition-colors shadow"
        >
          <Plus className="w-4 h-4" /> Create Channel
        </button>
      </div>

      {/* Channel Tree Layout */}
      <div className="space-y-6">
        {/* Uncategorized Channels */}
        {uncategorizedChannels.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-discord-muted px-1">
              Uncategorized Channels ({uncategorizedChannels.length})
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
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
            <div key={cat.id} className="bg-[#1e1f22]/60 border border-[#35373c] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#35373c]/60 pb-2">
                <div className="flex items-center gap-2">
                  <FolderTree className="w-4 h-4 text-discord-brand" />
                  <span className="text-sm font-bold uppercase tracking-wider text-discord-header">{cat.name}</span>
                  <span className="text-xs text-discord-muted">({childChannels.length} channels)</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(cat)}
                    className="p-1 text-discord-muted hover:text-white rounded"
                    title="Edit Category"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(cat)}
                    className="p-1 text-discord-muted hover:text-discord-red rounded"
                    title="Delete Category"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {childChannels.length === 0 ? (
                <p className="text-xs text-discord-muted italic py-2">No channels inside this category.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {childChannels.map((ch) => renderChannelRow(ch))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* CREATE CHANNEL MODAL WITH FANCY STYLER */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#313338] border border-[#35373c] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b border-[#35373c]">
              <h3 className="text-lg font-bold text-discord-header flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-discord-brand" /> Create Channel
              </h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-discord-muted hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-discord-muted block mb-1">
                  Channel Type
                </label>
                <select
                  value={newChannelType}
                  onChange={(e) => setNewChannelType(Number(e.target.value))}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-lg p-2.5 text-sm text-discord-header focus:outline-none focus:border-discord-brand"
                >
                  <option value={0}>Text Channel (#)</option>
                  <option value={2}>Voice Channel (🔊)</option>
                  <option value={4}>Category (📁)</option>
                  <option value={15}>Forum Channel (💬)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-discord-muted block mb-1">
                  Channel Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 💬・general-chat"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-lg p-2.5 text-sm font-semibold text-discord-header focus:outline-none focus:border-discord-brand"
                />
              </div>

              {/* DISCORD SYMBOLS & DECORATION PRESETS */}
              <div className="p-3 bg-[#1e1f22] border border-[#35373c] rounded-lg space-y-2">
                <p className="text-xs font-bold text-discord-brand flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Discord Channel Symbol Presets
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {DISCORD_SYMBOL_PRESETS.map((sym) => (
                    <button
                      key={sym.label}
                      type="button"
                      onClick={() => applySymbolToName(sym.prefix, setNewChannelName, newChannelName)}
                      className="px-2 py-1 bg-[#2b2d31] hover:bg-discord-brand text-discord-header hover:text-white rounded text-xs transition-colors flex items-center gap-1 border border-[#35373c]"
                    >
                      <span>{sym.prefix}</span>
                      <span className="text-[10px] text-discord-muted">{sym.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* DISCORD AESTHETIC FONT TRANSFORMERS */}
              <div className="p-3 bg-[#1e1f22] border border-[#35373c] rounded-lg space-y-2">
                <p className="text-xs font-bold text-discord-brand flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5" /> Aesthetic Font Styles
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {FONT_STYLE_PRESETS.map((font) => (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => applyFontToName(font.id, setNewChannelName, newChannelName)}
                      className="px-2.5 py-1 bg-[#2b2d31] hover:bg-discord-brand text-discord-header hover:text-white rounded text-xs transition-colors font-medium border border-[#35373c]"
                    >
                      {font.sample}
                    </button>
                  ))}
                </div>
              </div>

              {newChannelType !== 4 && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-discord-muted block mb-1">
                    Category Parent (Optional)
                  </label>
                  <select
                    value={newParentId}
                    onChange={(e) => setNewParentId(e.target.value)}
                    className="w-full bg-[#1e1f22] border border-[#35373c] rounded-lg p-2.5 text-sm text-discord-header focus:outline-none focus:border-discord-brand"
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

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#35373c]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-sm text-discord-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-discord-brand hover:bg-discord-brandHover text-white rounded-lg text-sm font-medium shadow"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#313338] border border-[#35373c] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b border-[#35373c]">
              <h3 className="text-lg font-bold text-discord-header flex items-center gap-2">
                <Settings className="w-5 h-5 text-discord-brand" /> Edit #{selectedChannel.name}
              </h3>
              <button onClick={() => setIsEditOpen(false)} className="text-discord-muted hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-discord-muted block mb-1">
                  Channel Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-lg p-2.5 text-sm font-semibold text-discord-header focus:outline-none focus:border-discord-brand"
                />
              </div>

              {/* DISCORD SYMBOLS & DECORATION PRESETS */}
              <div className="p-3 bg-[#1e1f22] border border-[#35373c] rounded-lg space-y-2">
                <p className="text-xs font-bold text-discord-brand flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Symbol Presets
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {DISCORD_SYMBOL_PRESETS.map((sym) => (
                    <button
                      key={sym.label}
                      type="button"
                      onClick={() => applySymbolToName(sym.prefix, setEditName, editName)}
                      className="px-2 py-1 bg-[#2b2d31] hover:bg-discord-brand text-discord-header hover:text-white rounded text-xs transition-colors flex items-center gap-1 border border-[#35373c]"
                    >
                      <span>{sym.prefix}</span>
                      <span className="text-[10px] text-discord-muted">{sym.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* DISCORD AESTHETIC FONT TRANSFORMERS */}
              <div className="p-3 bg-[#1e1f22] border border-[#35373c] rounded-lg space-y-2">
                <p className="text-xs font-bold text-discord-brand flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5" /> Aesthetic Font Styles
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {FONT_STYLE_PRESETS.map((font) => (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => applyFontToName(font.id, setEditName, editName)}
                      className="px-2.5 py-1 bg-[#2b2d31] hover:bg-discord-brand text-discord-header hover:text-white rounded text-xs transition-colors font-medium border border-[#35373c]"
                    >
                      {font.sample}
                    </button>
                  ))}
                </div>
              </div>

              {selectedChannel.type !== 4 && (
                <>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-discord-muted block mb-1">
                      Topic
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Channel topic..."
                      value={editTopic}
                      onChange={(e) => setEditTopic(e.target.value)}
                      className="w-full bg-[#1e1f22] border border-[#35373c] rounded-lg p-2.5 text-sm text-discord-header focus:outline-none focus:border-discord-brand resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-discord-muted block mb-1">
                      Slowmode Cooldown
                    </label>
                    <select
                      value={editSlowmode}
                      onChange={(e) => setEditSlowmode(Number(e.target.value))}
                      className="w-full bg-[#1e1f22] border border-[#35373c] rounded-lg p-2.5 text-sm text-discord-header focus:outline-none focus:border-discord-brand"
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

                  <div className="flex items-center justify-between p-3 bg-[#1e1f22] rounded-lg">
                    <div>
                      <p className="text-sm font-semibold text-discord-header">NSFW Channel</p>
                      <p className="text-xs text-discord-muted">Users must confirm age to view.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={editNsfw}
                      onChange={(e) => setEditNsfw(e.target.checked)}
                      className="w-5 h-5 accent-discord-brand rounded cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-discord-muted block mb-1">
                      Category Parent
                    </label>
                    <select
                      value={editParentId || ""}
                      onChange={(e) => setEditParentId(e.target.value || null)}
                      className="w-full bg-[#1e1f22] border border-[#35373c] rounded-lg p-2.5 text-sm text-discord-header focus:outline-none focus:border-discord-brand"
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

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#35373c]">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 text-sm text-discord-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-discord-brand hover:bg-discord-brandHover text-white rounded-lg text-sm font-medium shadow"
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
