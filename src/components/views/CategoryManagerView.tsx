"use client";

import React, { useState } from "react";
import { FolderTree, Plus, Edit2, Trash2, ArrowRight, X, Hash } from "lucide-react";
import { useToast } from "../ToastContainer";

interface Channel {
  id: string;
  name: string;
  type: number;
  position: number;
  parentId: string | null;
}

interface CategoryManagerProps {
  channels: Channel[];
  onCreateCategory: (name: string) => Promise<void>;
  onRenameCategory: (categoryId: string, name: string) => Promise<void>;
  onDeleteCategory: (categoryId: string) => Promise<void>;
  onMoveChannel: (channelId: string, targetCategoryId: string | null) => Promise<void>;
}

export function CategoryManagerView({
  channels,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
  onMoveChannel,
}: CategoryManagerProps) {
  const { showToast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  const [editingCategory, setEditingCategory] = useState<Channel | null>(null);
  const [renameName, setRenameName] = useState("");

  const [movingChannel, setMovingChannel] = useState<Channel | null>(null);
  const [targetCategory, setTargetCategory] = useState<string>("");

  const categories = channels.filter((c) => c.type === 4).sort((a, b) => a.position - b.position);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await onCreateCategory(newCatName);
      showToast(`Category "${newCatName}" created!`, "success");
      setIsCreateOpen(false);
      setNewCatName("");
    } catch (err: any) {
      showToast(err.message || "Failed to create category", "error");
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !renameName.trim()) return;
    try {
      await onRenameCategory(editingCategory.id, renameName);
      showToast(`Category renamed to "${renameName}"`, "success");
      setEditingCategory(null);
    } catch (err: any) {
      showToast(err.message || "Failed to rename category", "error");
    }
  };

  const handleDelete = async (cat: Channel) => {
    if (!confirm(`Are you sure you want to delete category "${cat.name}"? Channels inside will become uncategorized.`)) return;
    try {
      await onDeleteCategory(cat.id);
      showToast(`Category "${cat.name}" deleted.`, "info");
    } catch (err: any) {
      showToast(err.message || "Failed to delete category", "error");
    }
  };

  const handleMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movingChannel) return;
    try {
      await onMoveChannel(movingChannel.id, targetCategory === "" ? null : targetCategory);
      showToast(`Moved #${movingChannel.name} successfully!`, "success");
      setMovingChannel(null);
    } catch (err: any) {
      showToast(err.message || "Failed to move channel", "error");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-discord-header flex items-center gap-2">
            <FolderTree className="w-6 h-6 text-discord-brand" />
            Category Manager
          </h2>
          <p className="text-sm text-discord-muted">Organize categories and move channels between them.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-discord-brand hover:bg-discord-brandHover text-white rounded-lg font-medium text-sm transition-colors shadow"
        >
          <Plus className="w-4 h-4" /> Create Category
        </button>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {categories.map((cat) => {
          const childChannels = channels.filter((c) => c.parentId === cat.id);
          return (
            <div key={cat.id} className="bg-[#2b2d31] border border-[#35373c] rounded-xl p-5 shadow space-y-4">
              <div className="flex items-center justify-between border-b border-[#35373c]/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <FolderTree className="w-5 h-5 text-discord-brand" />
                  <span className="text-base font-bold text-discord-header uppercase">{cat.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingCategory(cat);
                      setRenameName(cat.name);
                    }}
                    className="p-1.5 text-discord-muted hover:text-white hover:bg-[#1e1f22] rounded transition-colors"
                    title="Rename Category"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(cat)}
                    className="p-1.5 text-discord-muted hover:text-discord-red hover:bg-[#1e1f22] rounded transition-colors"
                    title="Delete Category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-discord-muted uppercase">Channels ({childChannels.length})</p>
                {childChannels.length === 0 ? (
                  <p className="text-xs text-discord-muted italic">No channels in this category.</p>
                ) : (
                  <div className="space-y-1.5">
                    {childChannels.map((ch) => (
                      <div
                        key={ch.id}
                        className="flex items-center justify-between p-2 rounded bg-[#1e1f22] border border-[#35373c]/40 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Hash className="w-3.5 h-3.5 text-discord-muted" />
                          <span className="font-medium text-discord-header">{ch.name}</span>
                        </div>
                        <button
                          onClick={() => {
                            setMovingChannel(ch);
                            setTargetCategory(ch.parentId || "");
                          }}
                          className="flex items-center gap-1 text-[11px] text-discord-brand hover:underline font-medium"
                        >
                          Move <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE CATEGORY MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#313338] border border-[#35373c] rounded-xl w-full max-w-md p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-discord-header">New Category</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-discord-muted hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-discord-muted block mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TEXT CHANNELS"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-lg p-2.5 text-sm text-discord-header focus:outline-none focus:border-discord-brand"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-sm text-discord-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-discord-brand hover:bg-discord-brandHover text-white rounded-lg text-sm font-medium"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENAME CATEGORY MODAL */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#313338] border border-[#35373c] rounded-xl w-full max-w-md p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-discord-header">Rename Category</h3>
              <button onClick={() => setEditingCategory(null)} className="text-discord-muted hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRename} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-discord-muted block mb-1">
                  New Category Name
                </label>
                <input
                  type="text"
                  required
                  value={renameName}
                  onChange={(e) => setRenameName(e.target.value)}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-lg p-2.5 text-sm text-discord-header focus:outline-none focus:border-discord-brand"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2 text-sm text-discord-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-discord-brand hover:bg-discord-brandHover text-white rounded-lg text-sm font-medium"
                >
                  Save Name
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOVE CHANNEL MODAL */}
      {movingChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#313338] border border-[#35373c] rounded-xl w-full max-w-md p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-discord-header">Move #{movingChannel.name}</h3>
              <button onClick={() => setMovingChannel(null)} className="text-discord-muted hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleMoveSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-discord-muted block mb-1">
                  Target Category
                </label>
                <select
                  value={targetCategory}
                  onChange={(e) => setTargetCategory(e.target.value)}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-lg p-2.5 text-sm text-discord-header focus:outline-none focus:border-discord-brand"
                >
                  <option value="">(Uncategorized)</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setMovingChannel(null)}
                  className="px-4 py-2 text-sm text-discord-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-discord-brand hover:bg-discord-brandHover text-white rounded-lg text-sm font-medium"
                >
                  Move Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
