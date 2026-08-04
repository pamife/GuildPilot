"use client";

import React, { useState } from "react";
import { Wrench, Search, Layers, Edit3, Hash, Shield, Smile, Check, RefreshCw } from "lucide-react";
import { useToast } from "../ToastContainer";

interface UtilitiesViewProps {
  channels: any[];
  roles: any[];
  emojis: any[];
  onBulkCreateChannels: (channels: Array<{ name: string; type: number; parentId?: string }>) => Promise<void>;
  onBulkRenameChannels: (renames: Array<{ id: string; name: string }>) => Promise<void>;
  onSearch: (query: string) => Promise<{ channels: any[]; roles: any[]; emojis: any[] }>;
}

export function UtilitiesView({
  channels,
  roles,
  emojis,
  onBulkCreateChannels,
  onBulkRenameChannels,
  onSearch,
}: UtilitiesViewProps) {
  const { showToast } = useToast();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ channels: any[]; roles: any[]; emojis: any[] }>({
    channels: [],
    roles: [],
    emojis: [],
  });
  const [isSearching, setIsSearching] = useState(false);

  // Bulk Create state
  const [bulkInput, setBulkInput] = useState("");
  const [bulkType, setBulkType] = useState(0); // 0: Text, 2: Voice
  const [bulkParentId, setBulkParentId] = useState("");

  // Bulk Rename state
  const [findPattern, setFindPattern] = useState("");
  const [replacePattern, setReplacePattern] = useState("");

  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults({ channels: [], roles: [], emojis: [] });
      return;
    }
    setIsSearching(true);
    try {
      const res = await onSearch(q);
      setSearchResults(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleBulkCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const names = bulkInput
      .split("\n")
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (names.length === 0) return;

    const payload = names.map((name) => ({
      name: name.toLowerCase().replace(/\s+/g, "-"),
      type: bulkType,
      parentId: bulkParentId || undefined,
    }));

    try {
      await onBulkCreateChannels(payload);
      showToast(`Successfully bulk created ${names.length} channels!`, "success");
      setBulkInput("");
    } catch (err: any) {
      showToast(err.message || "Failed to bulk create channels", "error");
    }
  };

  const handleBulkRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!findPattern) return;

    const matching = channels.filter((c) => c.name.includes(findPattern));
    if (matching.length === 0) {
      showToast(`No channels matching "${findPattern}" found.`, "info");
      return;
    }

    const renames = matching.map((c) => ({
      id: c.id,
      name: c.name.replace(new RegExp(findPattern, "g"), replacePattern),
    }));

    try {
      await onBulkRenameChannels(renames);
      showToast(`Successfully renamed ${renames.length} channels!`, "success");
      setFindPattern("");
      setReplacePattern("");
    } catch (err: any) {
      showToast(err.message || "Failed to bulk rename channels", "error");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Wrench className="w-5 h-5" />
          </div>
          Utilities & Bulk Management
        </h2>
        <p className="text-sm text-zinc-400 mt-0.5">Perform instant global searches, bulk channel creation, and batch renaming.</p>
      </div>

      {/* Instant Search Bar */}
      <div className="bg-[#09090b] border border-[#1f1f23] hover:border-indigo-500/30 rounded-2xl p-6 shadow-lg space-y-4 transition-all">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Search className="w-5 h-5 text-indigo-400" /> Universal Search
        </h3>
        <div className="relative">
          <input
            type="text"
            placeholder="Search channels, roles, emojis..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full bg-[#0d0d11] border border-[#27272a] focus:border-indigo-500 text-zinc-100 placeholder-zinc-500 rounded-xl pl-11 pr-4 py-3 text-sm transition-all outline-none"
          />
          <Search className="w-4 h-4 text-zinc-500 absolute left-4 top-3.5" />
          {isSearching && <RefreshCw className="w-4 h-4 animate-spin text-indigo-400 absolute right-4 top-3.5" />}
        </div>

        {searchQuery.trim() && (
          <div className="space-y-4 pt-2">
            {/* Channels results */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Channels ({searchResults.channels.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {searchResults.channels.map((c) => (
                  <span key={c.id} className="bg-[#0d0d11] px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-200 flex items-center gap-1.5 border border-[#1f1f23]">
                    <Hash className="w-3.5 h-3.5 text-indigo-400" /> #{c.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Roles results */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Roles ({searchResults.roles.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {searchResults.roles.map((r) => (
                  <span key={r.id} className="bg-[#0d0d11] px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-200 flex items-center gap-2 border border-[#1f1f23]">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color === "#000000" ? "#99aab5" : r.color }} />
                    @{r.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Emojis results */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Emojis ({searchResults.emojis.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {searchResults.emojis.map((e) => (
                  <span key={e.id} className="bg-[#0d0d11] px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-200 flex items-center gap-2 border border-[#1f1f23]">
                    <img src={e.url} alt={e.name} className="w-4 h-4 object-contain" />
                    :{e.name}:
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Tools Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bulk Channel Creator */}
        <div className="bg-[#09090b] border border-[#1f1f23] hover:border-indigo-500/30 rounded-2xl p-6 shadow-lg space-y-4 transition-all">
          <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-[#1f1f23] pb-3">
            <Layers className="w-5 h-5 text-emerald-400" /> Bulk Channel Creator
          </h3>
          <form onSubmit={handleBulkCreateSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                Channel Names (One per line)
              </label>
              <textarea
                rows={5}
                required
                placeholder="welcome&#10;rules&#10;announcements&#10;general&#10;memes"
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                className="w-full bg-[#0d0d11] border border-[#27272a] focus:border-indigo-500 text-zinc-100 placeholder-zinc-500 rounded-xl p-3 text-sm font-mono transition-all outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Type
                </label>
                <select
                  value={bulkType}
                  onChange={(e) => setBulkType(Number(e.target.value))}
                  className="w-full bg-[#0d0d11] border border-[#27272a] focus:border-indigo-500 text-zinc-100 rounded-xl px-4 py-2.5 text-sm transition-all outline-none cursor-pointer"
                >
                  <option value={0}>Text Channels (#)</option>
                  <option value={2}>Voice Channels (🔊)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Category
                </label>
                <select
                  value={bulkParentId}
                  onChange={(e) => setBulkParentId(e.target.value)}
                  className="w-full bg-[#0d0d11] border border-[#27272a] focus:border-indigo-500 text-zinc-100 rounded-xl px-4 py-2.5 text-sm transition-all outline-none cursor-pointer"
                >
                  <option value="">(Uncategorized)</option>
                  {channels
                    .filter((c) => c.type === 4)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              Execute Bulk Create
            </button>
          </form>
        </div>

        {/* Bulk Channel Rename */}
        <div className="bg-[#09090b] border border-[#1f1f23] hover:border-indigo-500/30 rounded-2xl p-6 shadow-lg space-y-4 transition-all">
          <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-[#1f1f23] pb-3">
            <Edit3 className="w-5 h-5 text-amber-400" /> Bulk Channel Batch Rename
          </h3>
          <form onSubmit={handleBulkRenameSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                Find Substring in Channel Names
              </label>
              <input
                type="text"
                required
                placeholder="e.g. old-prefix"
                value={findPattern}
                onChange={(e) => setFindPattern(e.target.value)}
                className="w-full bg-[#0d0d11] border border-[#27272a] focus:border-indigo-500 text-zinc-100 placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm transition-all outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                Replace With Substring
              </label>
              <input
                type="text"
                placeholder="e.g. new-prefix (or leave blank to remove)"
                value={replacePattern}
                onChange={(e) => setReplacePattern(e.target.value)}
                className="w-full bg-[#0d0d11] border border-[#27272a] focus:border-indigo-500 text-zinc-100 placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm transition-all outline-none"
              />
            </div>

            {findPattern && (
              <p className="text-xs text-zinc-400 italic">
                Matching channels: {channels.filter((c) => c.name.includes(findPattern)).length}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              Execute Bulk Rename
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
