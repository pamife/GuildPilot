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
      showToast(`Kategorie "${newCatName}" erfolgreich erstellt!`, "success");
      setIsCreateOpen(false);
      setNewCatName("");
    } catch (err: any) {
      showToast(err.message || "Fehler beim Erstellen der Kategorie", "error");
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !renameName.trim()) return;
    try {
      await onRenameCategory(editingCategory.id, renameName);
      showToast(`Kategorie umbenannt in "${renameName}"`, "success");
      setEditingCategory(null);
    } catch (err: any) {
      showToast(err.message || "Fehler beim Umbenennen der Kategorie", "error");
    }
  };

  const handleDelete = async (cat: Channel) => {
    if (!confirm(`Möchtest du die Kategorie "${cat.name}" wirklich löschen? Darin befindliche Kanäle werden unkategorisiert.`)) return;
    try {
      await onDeleteCategory(cat.id);
      showToast(`Kategorie "${cat.name}" gelöscht.`, "info");
    } catch (err: any) {
      showToast(err.message || "Fehler beim Löschen der Kategorie", "error");
    }
  };

  const handleMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movingChannel) return;
    try {
      await onMoveChannel(movingChannel.id, targetCategory === "" ? null : targetCategory);
      showToast(`Kanal #${movingChannel.name} erfolgreich verschoben!`, "success");
      setMovingChannel(null);
    } catch (err: any) {
      showToast(err.message || "Fehler beim Verschieben des Kanals", "error");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-[#0b0f17] text-slate-200">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <FolderTree className="w-5 h-5" />
            </div>
            Kategorie-Manager
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Kategorien strukturieren und Kanäle per Mausklick verschieben.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-xs transition-all shadow-md shadow-indigo-600/25 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Kategorie erstellen
        </button>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {categories.map((cat) => {
          const childChannels = channels.filter((c) => c.parentId === cat.id);
          return (
            <div key={cat.id} className="bg-[#111724] border border-[#1e293b] hover:border-indigo-500/30 rounded-2xl p-5 shadow-sm space-y-4 transition-all">
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
                <div className="flex items-center gap-2.5">
                  <FolderTree className="w-5 h-5 text-indigo-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">{cat.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingCategory(cat);
                      setRenameName(cat.name);
                    }}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-[#1a253a] rounded-lg transition-colors cursor-pointer"
                    title="Kategorie umbenennen"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
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

              <div className="space-y-2">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Kanäle ({childChannels.length})</p>
                {childChannels.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">Keine Kanäle in dieser Kategorie.</p>
                ) : (
                  <div className="space-y-1.5">
                    {childChannels.map((ch) => (
                      <div
                        key={ch.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-[#0d121c] border border-[#1a2333] text-xs hover:border-[#27272a] transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <Hash className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold text-slate-200">{ch.name}</span>
                        </div>
                        <button
                          onClick={() => {
                            setMovingChannel(ch);
                            setTargetCategory(ch.parentId || "");
                          }}
                          className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                        >
                          Verschieben <ArrowRight className="w-3 h-3" />
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
          <div className="bg-[#0f1626] border border-[#212d45] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1f2c44] pb-3">
              <h3 className="text-sm font-bold text-white">Neue Kategorie erstellen</h3>
              <button onClick={() => setIsCreateOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a253b]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Kategoriename
                </label>
                <input
                  type="text"
                  required
                  placeholder="z. B. TEXTKANÄLE"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2 text-xs transition-all outline-none"
                />
              </div>
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
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/25"
                >
                  Kategorie erstellen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENAME CATEGORY MODAL */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0f1626] border border-[#212d45] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1f2c44] pb-3">
              <h3 className="text-sm font-bold text-white">Kategorie umbenennen</h3>
              <button onClick={() => setEditingCategory(null)} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a253b]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRename} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Neuer Kategoriename
                </label>
                <input
                  type="text"
                  required
                  value={renameName}
                  onChange={(e) => setRenameName(e.target.value)}
                  className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2 text-xs transition-all outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1e293b]">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-3.5 py-2 text-xs text-slate-400 hover:text-white hover:bg-[#1a253a] rounded-xl font-medium"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/25"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOVE CHANNEL MODAL */}
      {movingChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0f1626] border border-[#212d45] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1f2c44] pb-3">
              <h3 className="text-sm font-bold text-white">#{movingChannel.name} verschieben</h3>
              <button onClick={() => setMovingChannel(null)} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a253b]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleMoveSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Zielkategorie
                </label>
                <select
                  value={targetCategory}
                  onChange={(e) => setTargetCategory(e.target.value)}
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
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1e293b]">
                <button
                  type="button"
                  onClick={() => setMovingChannel(null)}
                  className="px-3.5 py-2 text-xs text-slate-400 hover:text-white hover:bg-[#1a253a] rounded-xl font-medium"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/25"
                >
                  Kanal verschieben
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

