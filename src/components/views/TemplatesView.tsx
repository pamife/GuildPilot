"use client";

import React, { useState } from "react";
import { Copy, Save, Play, Trash2, Plus, X, Layers, Hash, FolderTree, Shield } from "lucide-react";
import { useToast } from "../ToastContainer";

interface Template {
  id: string;
  name: string;
  description: string | null;
  structure: any;
  createdAt: string;
}

interface TemplatesViewProps {
  templates: Template[];
  channels: any[];
  onSaveTemplate: (name: string, description: string) => Promise<void>;
  onApplyTemplate: (templateId: string) => Promise<void>;
  onDeleteTemplate: (templateId: string) => Promise<void>;
  onDuplicateChannel: (channelId: string) => Promise<void>;
  onDuplicateCategory: (categoryId: string) => Promise<void>;
}

export function TemplatesView({
  templates,
  channels,
  onSaveTemplate,
  onApplyTemplate,
  onDeleteTemplate,
  onDuplicateChannel,
  onDuplicateCategory,
}: TemplatesViewProps) {
  const { showToast } = useToast();
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDesc, setSaveDesc] = useState("");

  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");

  const categories = channels.filter((c) => c.type === 4);

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveName.trim()) return;
    try {
      await onSaveTemplate(saveName, saveDesc);
      showToast(`Template "${saveName}" saved to SQLite database!`, "success");
      setIsSaveOpen(false);
      setSaveName("");
      setSaveDesc("");
    } catch (err: any) {
      showToast(err.message || "Failed to save template", "error");
    }
  };

  const handleApplyClick = async (template: Template) => {
    if (
      !confirm(
        `Are you sure you want to apply template "${template.name}"? This will create new channels, categories, and roles matching the layout.`
      )
    )
      return;

    try {
      await onApplyTemplate(template.id);
      showToast(`Template "${template.name}" applied successfully!`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to apply template", "error");
    }
  };

  const handleDeleteClick = async (template: Template) => {
    if (!confirm(`Delete template "${template.name}"?`)) return;
    try {
      await onDeleteTemplate(template.id);
      showToast(`Template "${template.name}" deleted.`, "info");
    } catch (err: any) {
      showToast(err.message || "Failed to delete template", "error");
    }
  };

  const handleDuplicateChannelClick = async () => {
    if (!selectedChannelId) return;
    try {
      await onDuplicateChannel(selectedChannelId);
      showToast("Channel duplicated successfully!", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to duplicate channel", "error");
    }
  };

  const handleDuplicateCategoryClick = async () => {
    if (!selectedCategoryId) return;
    try {
      await onDuplicateCategory(selectedCategoryId);
      showToast("Category & contained channels duplicated successfully!", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to duplicate category", "error");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Copy className="w-5 h-5" />
            </div>
            Server Templates & Layout Duplicator
          </h2>
          <p className="text-sm text-zinc-400 mt-0.5">Save your current server setup as a layout template or clone channels & categories instantly.</p>
        </div>
        <button
          onClick={() => setIsSaveOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
        >
          <Save className="w-4 h-4" /> Save Current Server Layout
        </button>
      </div>

      {/* Quick Duplicators Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#09090b] border border-[#1f1f23] hover:border-indigo-500/30 rounded-2xl p-6 shadow-lg space-y-3.5 transition-all">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Hash className="w-5 h-5 text-indigo-400" /> Quick Duplicate Channel
          </h3>
          <p className="text-xs text-zinc-400">Clone an existing channel along with topic, slowmode, and NSFW settings.</p>
          <div className="flex gap-2.5">
            <select
              value={selectedChannelId}
              onChange={(e) => setSelectedChannelId(e.target.value)}
              className="flex-1 bg-[#0d0d11] border border-[#27272a] focus:border-indigo-500 text-zinc-100 rounded-xl px-4 py-2.5 text-sm transition-all outline-none cursor-pointer"
            >
              <option value="">(Select Channel to Duplicate)</option>
              {channels
                .filter((c) => c.type !== 4)
                .map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    #{ch.name}
                  </option>
                ))}
            </select>
            <button
              onClick={handleDuplicateChannelClick}
              disabled={!selectedChannelId}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              Duplicate
            </button>
          </div>
        </div>

        <div className="bg-[#09090b] border border-[#1f1f23] hover:border-indigo-500/30 rounded-2xl p-6 shadow-lg space-y-3.5 transition-all">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-indigo-400" /> Quick Duplicate Category
          </h3>
          <p className="text-xs text-zinc-400">Clone an entire category together with all child channels inside it.</p>
          <div className="flex gap-2.5">
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="flex-1 bg-[#0d0d11] border border-[#27272a] focus:border-indigo-500 text-zinc-100 rounded-xl px-4 py-2.5 text-sm transition-all outline-none cursor-pointer"
            >
              <option value="">(Select Category to Duplicate)</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  📁 {cat.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleDuplicateCategoryClick}
              disabled={!selectedCategoryId}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              Duplicate
            </button>
          </div>
        </div>
      </div>

      {/* Saved Templates Library */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-400" /> Saved Layout Library ({templates.length})
        </h3>

        {templates.length === 0 ? (
          <div className="p-12 text-center bg-[#09090b] border border-[#1f1f23] rounded-2xl text-zinc-400 shadow-lg">
            <Copy className="w-10 h-10 mx-auto mb-3 text-zinc-600" />
            <p className="font-bold text-base text-zinc-200">No saved templates yet</p>
            <p className="text-xs text-zinc-400 mt-1">Click "Save Current Server Layout" to snapshot your channels and roles.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tmpl) => {
              const struct = tmpl.structure;
              const textCount = struct?.textChannels?.length || 0;
              const voiceCount = struct?.voiceChannels?.length || 0;
              const catCount = struct?.categories?.length || 0;
              const roleCount = struct?.roles?.length || 0;

              return (
                <div
                  key={tmpl.id}
                  className="bg-[#09090b] border border-[#1f1f23] hover:border-indigo-500/40 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4 transition-all hover:-translate-y-0.5"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-bold text-white">{tmpl.name}</h4>
                      <button
                        onClick={() => handleDeleteClick(tmpl)}
                        className="text-zinc-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-[#18181b] transition-colors cursor-pointer"
                        title="Delete Template"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">{tmpl.description || "No description provided."}</p>

                    <div className="grid grid-cols-2 gap-2 mt-4 text-xs font-semibold text-zinc-300">
                      <div className="bg-[#0d0d11] border border-[#1f1f23] p-2.5 rounded-xl flex items-center gap-2">
                        <Hash className="w-3.5 h-3.5 text-indigo-400" /> {textCount + voiceCount} Channels
                      </div>
                      <div className="bg-[#0d0d11] border border-[#1f1f23] p-2.5 rounded-xl flex items-center gap-2">
                        <FolderTree className="w-3.5 h-3.5 text-indigo-400" /> {catCount} Categories
                      </div>
                      <div className="bg-[#0d0d11] border border-[#1f1f23] p-2.5 rounded-xl flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-indigo-400" /> {roleCount} Roles
                      </div>
                      <div className="bg-[#0d0d11] border border-[#1f1f23] p-2.5 rounded-xl flex items-center justify-center text-[10px] font-mono text-zinc-400">
                        {new Date(tmpl.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleApplyClick(tmpl)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-xs shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <Play className="w-4 h-4" /> Apply Template to Server
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SAVE TEMPLATE MODAL */}
      {isSaveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0a0a0e] border border-[#1f1f2a] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1f1f23] pb-3">
              <h3 className="text-lg font-bold text-white">Save Server Template</h3>
              <button onClick={() => setIsSaveOpen(false)} className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-[#18181b]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Template Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gaming Server Layout 2026"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="w-full bg-[#0d0d11] border border-[#27272a] focus:border-indigo-500 text-zinc-100 placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm transition-all outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Description (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Layout details..."
                  value={saveDesc}
                  onChange={(e) => setSaveDesc(e.target.value)}
                  className="w-full bg-[#0d0d11] border border-[#27272a] focus:border-indigo-500 text-zinc-100 placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm transition-all outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1f1f23]">
                <button
                  type="button"
                  onClick={() => setIsSaveOpen(false)}
                  className="px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-[#18181b] rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
