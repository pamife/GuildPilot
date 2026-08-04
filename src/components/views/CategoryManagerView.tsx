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
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <FolderTree className="w-5 h-5" />
            </div>
            Category Manager
          </h2>
          <p className="text-sm text-zinc-400 mt-0.5">Organize categories and move channels between them.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Create Category
        </button>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {categories.map((cat) => {
          const childChannels = channels.filter((c) => c.parentId === cat.id);
          return (
            <div key={cat.id} className="bg-[#09090b] border border-[#1f1f23] hover:border-indigo-500/30 rounded-2xl p-5 shadow-lg space-y-4 transition-all">
              <div className="flex items-center justify-between border-b border-[#1f1f23] pb-3">
                <div className="flex items-center gap-2.5">
                  <FolderTree className="w-5 h-5 text-indigo-400" />
                  <span className="text-base font-bold text-white uppercase tracking-wider">{cat.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingCategory(cat);
                      setRenameName(cat.name);
                    }}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#18181b] rounded-lg transition-colors cursor-pointer"
                    title="Rename Category"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(cat)}
                    className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-[#18181b] rounded-lg transition-colors cursor-pointer"
                    title="Delete Category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Channels ({childChannels.length})</p>
                {childChannels.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic py-2">No channels in this category.</p>
                ) : (
                  <div className="space-y-1.5">
                    {childChannels.map((ch) => (
                      <div
                        key={ch.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-[#0d0d11] border border-[#1f1f23] text-xs hover:border-[#27272a] transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <Hash className="w-4 h-4 text-zinc-500" />
                          <span className="font-semibold text-zinc-200">{ch.name}</span>
                        </div>
                        <button
                          onClick={() => {
                            setMovingChannel(ch);
                            setTargetCategory(ch.parentId || "");
                          }}
                          className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0a0a0e] border border-[#1f1f2a] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1f1f23] pb-3">
              <h3 className="text-lg font-bold text-white">New Category</h3>
              <button onClick={() => setIsCreateOpen(false)} className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-[#18181b]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Category Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TEXT CHANNELS"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full bg-[#0d0d11] border border-[#27272a] focus:border-indigo-500 text-zinc-100 placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm transition-all outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-[#18181b] rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0a0a0e] border border-[#1f1f2a] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1f1f23] pb-3">
              <h3 className="text-lg font-bold text-white">Rename Category</h3>
              <button onClick={() => setEditingCategory(null)} className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-[#18181b]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRename} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  New Category Name
                </label>
                <input
                  type="text"
                  required
                  value={renameName}
                  onChange={(e) => setRenameName(e.target.value)}
                  className="w-full bg-[#0d0d11] border border-[#27272a] focus:border-indigo-500 text-zinc-100 placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm transition-all outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-[#18181b] rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0a0a0e] border border-[#1f1f2a] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1f1f23] pb-3">
              <h3 className="text-lg font-bold text-white">Move #{movingChannel.name}</h3>
              <button onClick={() => setMovingChannel(null)} className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-[#18181b]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleMoveSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Target Category
                </label>
                <select
                  value={targetCategory}
                  onChange={(e) => setTargetCategory(e.target.value)}
                  className="w-full bg-[#0d0d11] border border-[#27272a] focus:border-indigo-500 text-zinc-100 rounded-xl px-4 py-2.5 text-sm transition-all outline-none cursor-pointer"
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
                  className="px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-[#18181b] rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20"
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
