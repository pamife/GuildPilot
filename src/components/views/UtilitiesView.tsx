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
        <h2 className="text-xl font-bold text-discord-header flex items-center gap-2">
          <Wrench className="w-6 h-6 text-discord-brand" />
          Utilities & Bulk Management
        </h2>
        <p className="text-sm text-discord-muted">Perform instant global searches, bulk channel creation, and batch renaming.</p>
      </div>

      {/* Instant Search Bar */}
      <div className="bg-[#2b2d31] border border-[#35373c] rounded-xl p-5 shadow space-y-4">
        <h3 className="text-base font-semibold text-discord-header flex items-center gap-2">
          <Search className="w-5 h-5 text-discord-brand" /> Universal Search
        </h3>
        <div className="relative">
          <input
            type="text"
            placeholder="Search channels, roles, emojis..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full bg-[#1e1f22] border border-[#35373c] rounded-lg pl-10 pr-4 py-3 text-sm text-discord-header focus:outline-none focus:border-discord-brand"
          />
          <Search className="w-4 h-4 text-discord-muted absolute left-3.5 top-3.5" />
          {isSearching && <RefreshCw className="w-4 h-4 animate-spin text-discord-brand absolute right-3.5 top-3.5" />}
        </div>

        {searchQuery.trim() && (
          <div className="space-y-4 pt-2">
            {/* Channels results */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-discord-muted mb-2">
                Channels ({searchResults.channels.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {searchResults.channels.map((c) => (
                  <span key={c.id} className="bg-[#1e1f22] px-2.5 py-1 rounded text-xs font-medium text-discord-header flex items-center gap-1 border border-[#35373c]">
                    <Hash className="w-3 h-3 text-discord-brand" /> #{c.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Roles results */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-discord-muted mb-2">
                Roles ({searchResults.roles.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {searchResults.roles.map((r) => (
                  <span key={r.id} className="bg-[#1e1f22] px-2.5 py-1 rounded text-xs font-medium text-discord-header flex items-center gap-1.5 border border-[#35373c]">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color === "#000000" ? "#99aab5" : r.color }} />
                    @{r.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Emojis results */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-discord-muted mb-2">
                Emojis ({searchResults.emojis.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {searchResults.emojis.map((e) => (
                  <span key={e.id} className="bg-[#1e1f22] px-2.5 py-1 rounded text-xs font-medium text-discord-header flex items-center gap-1.5 border border-[#35373c]">
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
        <div className="bg-[#2b2d31] border border-[#35373c] rounded-xl p-5 shadow space-y-4">
          <h3 className="text-base font-semibold text-discord-header flex items-center gap-2 border-b border-[#35373c]/60 pb-2">
            <Layers className="w-5 h-5 text-discord-green" /> Bulk Channel Creator
          </h3>
          <form onSubmit={handleBulkCreateSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-discord-muted block mb-1">
                Channel Names (One per line)
              </label>
              <textarea
                rows={5}
                required
                placeholder="welcome&#10;rules&#10;announcements&#10;general&#10;memes"
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                className="w-full bg-[#1e1f22] border border-[#35373c] rounded-lg p-2.5 text-sm font-mono text-discord-header focus:outline-none focus:border-discord-brand resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-discord-muted block mb-1">
                  Type
                </label>
                <select
                  value={bulkType}
                  onChange={(e) => setBulkType(Number(e.target.value))}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-lg p-2.5 text-sm text-discord-header focus:outline-none"
                >
                  <option value={0}>Text Channels (#)</option>
                  <option value={2}>Voice Channels (🔊)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-discord-muted block mb-1">
                  Category
                </label>
                <select
                  value={bulkParentId}
                  onChange={(e) => setBulkParentId(e.target.value)}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-lg p-2.5 text-sm text-discord-header focus:outline-none"
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
              className="w-full py-2.5 bg-discord-brand hover:bg-discord-brandHover text-white rounded-lg text-sm font-bold shadow transition-colors"
            >
              Execute Bulk Create
            </button>
          </form>
        </div>

        {/* Bulk Channel Rename */}
        <div className="bg-[#2b2d31] border border-[#35373c] rounded-xl p-5 shadow space-y-4">
          <h3 className="text-base font-semibold text-discord-header flex items-center gap-2 border-b border-[#35373c]/60 pb-2">
            <Edit3 className="w-5 h-5 text-discord-yellow" /> Bulk Channel Batch Rename
          </h3>
          <form onSubmit={handleBulkRenameSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-discord-muted block mb-1">
                Find Substring in Channel Names
              </label>
              <input
                type="text"
                required
                placeholder="e.g. old-prefix"
                value={findPattern}
                onChange={(e) => setFindPattern(e.target.value)}
                className="w-full bg-[#1e1f22] border border-[#35373c] rounded-lg p-2.5 text-sm text-discord-header focus:outline-none focus:border-discord-brand"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-discord-muted block mb-1">
                Replace With Substring
              </label>
              <input
                type="text"
                placeholder="e.g. new-prefix (or leave blank to remove)"
                value={replacePattern}
                onChange={(e) => setReplacePattern(e.target.value)}
                className="w-full bg-[#1e1f22] border border-[#35373c] rounded-lg p-2.5 text-sm text-discord-header focus:outline-none focus:border-discord-brand"
              />
            </div>

            {findPattern && (
              <p className="text-xs text-discord-muted italic">
                Matching channels: {channels.filter((c) => c.name.includes(findPattern)).length}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-discord-brand hover:bg-discord-brandHover text-white rounded-lg text-sm font-bold shadow transition-colors"
            >
              Execute Bulk Rename
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
