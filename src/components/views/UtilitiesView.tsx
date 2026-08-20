"use client";

import React, { useState, useEffect } from "react";
import {
  Wrench,
  Search,
  Layers,
  Edit3,
  Hash,
  Shield,
  Smile,
  Check,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Flame,
  X,
  CheckSquare,
  Square,
  ShieldAlert,
  FolderTree,
  Link,
  Sticker,
  Database,
  Lock,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "../ToastContainer";

interface UtilitiesViewProps {
  selectedGuildId: string | null;
  channels: any[];
  roles: any[];
  emojis: any[];
  onBulkCreateChannels: (channels: Array<{ name: string; type: number; parentId?: string }>) => Promise<void>;
  onBulkRenameChannels: (renames: Array<{ id: string; name: string }>) => Promise<void>;
  onSearch: (query: string) => Promise<{ channels: any[]; roles: any[]; emojis: any[] }>;
  onRefreshData?: () => void;
}

export function UtilitiesView({
  selectedGuildId,
  channels,
  roles,
  emojis,
  onBulkCreateChannels,
  onBulkRenameChannels,
  onSearch,
  onRefreshData,
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

  // Purge / Delete Everything state
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [purgeSummary, setPurgeSummary] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [purging, setPurging] = useState(false);

  // Purge Checkbox selections
  const [purgeChannels, setPurgeChannels] = useState(true);
  const [purgeCategories, setPurgeCategories] = useState(true);
  const [purgeRoles, setPurgeRoles] = useState(true);
  const [purgeEmojis, setPurgeEmojis] = useState(false);
  const [purgeStickers, setPurgeStickers] = useState(false);
  const [purgeInvites, setPurgeInvites] = useState(false);
  const [purgeDbConfigs, setPurgeDbConfigs] = useState(false);
  const [createFallbackChannel, setCreateFallbackChannel] = useState(true);
  const [createAutoBackup, setCreateAutoBackup] = useState(true);

  // Security confirmation
  const [confirmInput, setConfirmInput] = useState("");

  // Fetch Purge summary when opening modal
  const handleOpenPurgeModal = async () => {
    if (!selectedGuildId) return;
    setIsPurgeModalOpen(true);
    setConfirmInput("");
    setLoadingSummary(true);
    try {
      const res = await api.get(`/utilities/${selectedGuildId}/purge-summary`);
      setPurgeSummary(res.data);
    } catch (err) {
      console.warn("Failed to load purge summary:", err);
    } finally {
      setLoadingSummary(false);
    }
  };

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
      showToast(`Erfolgreich ${names.length} Kanäle erstellt!`, "success");
      setBulkInput("");
    } catch (err: any) {
      showToast(err.message || "Fehler beim Erstellen der Kanäle", "error");
    }
  };

  const handleBulkRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!findPattern) return;

    const matching = channels.filter((c) => c.name.includes(findPattern));
    if (matching.length === 0) {
      showToast(`Keine Kanäle mit dem Muster "${findPattern}" gefunden.`, "info");
      return;
    }

    const renames = matching.map((c) => ({
      id: c.id,
      name: c.name.replace(new RegExp(findPattern, "g"), replacePattern),
    }));

    try {
      await onBulkRenameChannels(renames);
      showToast(`Erfolgreich ${renames.length} Kanäle umbenannt!`, "success");
      setFindPattern("");
      setReplacePattern("");
    } catch (err: any) {
      showToast(err.message || "Fehler beim Umbenennen der Kanäle", "error");
    }
  };

  const handleExecutePurge = async () => {
    if (!selectedGuildId) return;
    setPurging(true);
    try {
      const res = await api.post(`/utilities/${selectedGuildId}/purge`, {
        createAutoBackup,
        deleteChannels: purgeChannels,
        deleteCategories: purgeCategories,
        createFallbackChannel,
        deleteRoles: purgeRoles,
        deleteEmojis: purgeEmojis,
        deleteStickers: purgeStickers,
        deleteInvites: purgeInvites,
        deleteDatabaseConfigs: purgeDbConfigs,
      });

      const totalDeleted =
        res.data.channelsDeleted +
        res.data.categoriesDeleted +
        res.data.rolesDeleted +
        res.data.emojisDeleted +
        res.data.stickersDeleted +
        res.data.invitesDeleted;

      showToast(
        `Server-Bereinigung abgeschlossen: ${totalDeleted} Elemente gelöscht${
          res.data.backupCreated ? " (Sicherheits-Backup gespeichert!)" : ""
        }!`,
        "success"
      );

      setIsPurgeModalOpen(false);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Fehler bei der Server-Bereinigung.", "error");
    } finally {
      setPurging(false);
    }
  };

  const isConfirmationValid =
    confirmInput.trim().toUpperCase() === "LÖSCHEN" ||
    confirmInput.trim().toUpperCase() === "DELETE" ||
    (purgeSummary?.guildName && confirmInput.trim().toLowerCase() === purgeSummary.guildName.toLowerCase());

  const hasAnySelection =
    purgeChannels ||
    purgeCategories ||
    purgeRoles ||
    purgeEmojis ||
    purgeStickers ||
    purgeInvites ||
    purgeDbConfigs;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 select-none bg-[#090a0f] text-zinc-200">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Wrench className="w-5 h-5" />
          </div>
          Utilities & Bulk Management
        </h2>
        <p className="text-sm text-zinc-400 mt-0.5">
          Massen-Operationen, Server-Reset / Purge, Batch-Renaming und universelle Suche.
        </p>
      </div>

      {/* DANGER ZONE: SERVER PURGE / DELETE EVERYTHING CARD */}
      <div className="bg-gradient-to-r from-rose-950/40 via-[#140b0f] to-[#0d0e15] border border-rose-500/40 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Server Cleaner & Reset (Delete Everything)
                <span className="text-[10px] bg-rose-500/20 border border-rose-500/40 text-rose-300 px-2 py-0.5 rounded-full font-bold uppercase">
                  Danger Zone
                </span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5 max-w-2xl">
                Selektive oder vollständige Bereinigung des Servers: Lösche auf einen Klick Kanäle, Kategorien, Rollen, Emojis oder Bot-Konfigurationen mit vorheriger Auswahl und automatischem Sicherheits-Backup.
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenPurgeModal}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
          >
            <Trash2 className="w-4 h-4" />
            <span>Server-Bereinigung öffnen...</span>
          </button>
        </div>
      </div>

      {/* Instant Search Bar */}
      <div className="bg-[#0c0d14] border border-[#1e1f2b] hover:border-indigo-500/30 rounded-2xl p-6 shadow-lg space-y-4 transition-all">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Search className="w-5 h-5 text-indigo-400" /> Universelle Suche
        </h3>
        <div className="relative">
          <input
            type="text"
            placeholder="Kanäle, Rollen, Emojis durchsuchen..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full bg-[#12131a] border border-[#27272a] focus:border-indigo-500 text-zinc-100 placeholder-zinc-500 rounded-xl pl-11 pr-4 py-3 text-sm transition-all outline-none"
          />
          <Search className="w-4 h-4 text-zinc-500 absolute left-4 top-3.5" />
          {isSearching && <RefreshCw className="w-4 h-4 animate-spin text-indigo-400 absolute right-4 top-3.5" />}
        </div>

        {searchQuery.trim() && (
          <div className="space-y-4 pt-2">
            {/* Channels results */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Kanäle ({searchResults.channels.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {searchResults.channels.map((c) => (
                  <span
                    key={c.id}
                    className="bg-[#12131a] px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-200 flex items-center gap-1.5 border border-[#1e1f2b]"
                  >
                    <Hash className="w-3.5 h-3.5 text-indigo-400" /> #{c.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Roles results */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Rollen ({searchResults.roles.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {searchResults.roles.map((r) => (
                  <span
                    key={r.id}
                    className="bg-[#12131a] px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-200 flex items-center gap-2 border border-[#1e1f2b]"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: r.color === "#000000" ? "#99aab5" : r.color }}
                    />
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
                  <span
                    key={e.id}
                    className="bg-[#12131a] px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-200 flex items-center gap-2 border border-[#1e1f2b]"
                  >
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
        <div className="bg-[#0c0d14] border border-[#1e1f2b] hover:border-indigo-500/30 rounded-2xl p-6 shadow-lg space-y-4 transition-all">
          <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-[#1e1f2b] pb-3">
            <Layers className="w-5 h-5 text-emerald-400" /> Bulk Channel Creator
          </h3>
          <form onSubmit={handleBulkCreateSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                Kanal-Namen (Einer pro Zeile)
              </label>
              <textarea
                rows={5}
                required
                placeholder="willkommen&#10;regeln&#10;ankündigungen&#10;general&#10;memes"
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                className="w-full bg-[#12131a] border border-[#27272a] focus:border-indigo-500 text-zinc-100 placeholder-zinc-500 rounded-xl p-3 text-sm font-mono transition-all outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Typ
                </label>
                <select
                  value={bulkType}
                  onChange={(e) => setBulkType(Number(e.target.value))}
                  className="w-full bg-[#12131a] border border-[#27272a] focus:border-indigo-500 text-zinc-100 rounded-xl px-4 py-2.5 text-sm transition-all outline-none cursor-pointer"
                >
                  <option value={0}>Textkanäle (#)</option>
                  <option value={2}>Sprachkanäle (🔊)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Kategorie
                </label>
                <select
                  value={bulkParentId}
                  onChange={(e) => setBulkParentId(e.target.value)}
                  className="w-full bg-[#12131a] border border-[#27272a] focus:border-indigo-500 text-zinc-100 rounded-xl px-4 py-2.5 text-sm transition-all outline-none cursor-pointer"
                >
                  <option value="">(Ohne Kategorie)</option>
                  {channels
                    .filter((c) => c.type === 4)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        📁 {cat.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              Massen-Erstellung ausführen
            </button>
          </form>
        </div>

        {/* Bulk Channel Rename */}
        <div className="bg-[#0c0d14] border border-[#1e1f2b] hover:border-indigo-500/30 rounded-2xl p-6 shadow-lg space-y-4 transition-all">
          <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-[#1e1f2b] pb-3">
            <Edit3 className="w-5 h-5 text-amber-400" /> Bulk Channel Batch Rename
          </h3>
          <form onSubmit={handleBulkRenameSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                Suchbegriff im Kanalnamen
              </label>
              <input
                type="text"
                required
                placeholder="z. B. alt-prefix"
                value={findPattern}
                onChange={(e) => setFindPattern(e.target.value)}
                className="w-full bg-[#12131a] border border-[#27272a] focus:border-indigo-500 text-zinc-100 placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm transition-all outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                Ersetzen durch
              </label>
              <input
                type="text"
                placeholder="z. B. neu-prefix (oder leer lassen zum Entfernen)"
                value={replacePattern}
                onChange={(e) => setReplacePattern(e.target.value)}
                className="w-full bg-[#12131a] border border-[#27272a] focus:border-indigo-500 text-zinc-100 placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm transition-all outline-none"
              />
            </div>

            {findPattern && (
              <p className="text-xs text-zinc-400 italic">
                Gefundene Treffer: {channels.filter((c) => c.name.includes(findPattern)).length} Kanäle
              </p>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              Massen-Umbenennung ausführen
            </button>
          </form>
        </div>
      </div>

      {/* PURGE / DELETE EVERYTHING MODAL */}
      {isPurgeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0c0d14] border border-rose-500/50 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#1e1f2b] bg-[#11080d] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Server Cleaner & Reset
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Wähle genau aus, welche Server-Elemente gelöscht werden sollen
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPurgeModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {loadingSummary ? (
                <div className="flex items-center justify-center p-8 text-zinc-500 gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-rose-400" />
                  <span>Berechne Server-Bestand...</span>
                </div>
              ) : (
                <>
                  {/* Backup Auto-Check Alert */}
                  <label className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-center justify-between cursor-pointer hover:bg-indigo-500/20 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <ShieldAlert className="w-5 h-5 text-indigo-400 shrink-0" />
                      <div>
                        <p className="font-bold text-white text-xs">
                          🛡️ Automatisches Sicherheits-Backup vor Löschung erstellen
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          Sichert den aktuellen Serverzustand automatisch in der Backup-Bibliothek.
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={createAutoBackup}
                      onChange={(e) => setCreateAutoBackup(e.target.checked)}
                      className="w-5 h-5 accent-indigo-600 rounded cursor-pointer shrink-0"
                    />
                  </label>

                  {/* Options List */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                      Was soll gelöscht werden?
                    </p>

                    {/* Channels */}
                    <label className="flex items-center justify-between p-3 bg-[#12131a] border border-[#1e1f2b] hover:border-[#2a2b3d] rounded-xl cursor-pointer transition-colors">
                      <div className="flex items-center gap-2.5">
                        <Hash className="w-4 h-4 text-rose-400" />
                        <div>
                          <span className="font-bold text-white">Kanäle löschen</span>
                          <span className="text-zinc-400 ml-2 text-[11px]">
                            ({purgeSummary?.channelsCount ?? channels.filter((c) => c.type !== 4).length} Text- & Sprachkanäle)
                          </span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={purgeChannels}
                        onChange={(e) => setPurgeChannels(e.target.checked)}
                        className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                      />
                    </label>

                    {/* Fallback channel if channels are deleted */}
                    {purgeChannels && (
                      <label className="flex items-center justify-between p-2.5 pl-8 bg-[#151620] border border-[#1e1f2b] rounded-xl cursor-pointer">
                        <span className="text-zinc-300 text-[11px]">
                          ↳ Ersatzkanal <code className="text-emerald-300">#general</code> erstellen (damit Server nicht leer ist)
                        </span>
                        <input
                          type="checkbox"
                          checked={createFallbackChannel}
                          onChange={(e) => setCreateFallbackChannel(e.target.checked)}
                          className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                        />
                      </label>
                    )}

                    {/* Categories */}
                    <label className="flex items-center justify-between p-3 bg-[#12131a] border border-[#1e1f2b] hover:border-[#2a2b3d] rounded-xl cursor-pointer transition-colors">
                      <div className="flex items-center gap-2.5">
                        <FolderTree className="w-4 h-4 text-rose-400" />
                        <div>
                          <span className="font-bold text-white">Kategorien löschen</span>
                          <span className="text-zinc-400 ml-2 text-[11px]">
                            ({purgeSummary?.categoriesCount ?? channels.filter((c) => c.type === 4).length} Kategorien)
                          </span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={purgeCategories}
                        onChange={(e) => setPurgeCategories(e.target.checked)}
                        className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                      />
                    </label>

                    {/* Roles */}
                    <label className="flex items-center justify-between p-3 bg-[#12131a] border border-[#1e1f2b] hover:border-[#2a2b3d] rounded-xl cursor-pointer transition-colors">
                      <div className="flex items-center gap-2.5">
                        <Shield className="w-4 h-4 text-rose-400" />
                        <div>
                          <span className="font-bold text-white">Rollen löschen</span>
                          <span className="text-zinc-400 ml-2 text-[11px]">
                            ({purgeSummary?.rolesCount ?? roles.filter((r) => !r.managed && r.name !== "@everyone").length} löschbare Rollen)
                          </span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={purgeRoles}
                        onChange={(e) => setPurgeRoles(e.target.checked)}
                        className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                      />
                    </label>

                    {/* Emojis */}
                    <label className="flex items-center justify-between p-3 bg-[#12131a] border border-[#1e1f2b] hover:border-[#2a2b3d] rounded-xl cursor-pointer transition-colors">
                      <div className="flex items-center gap-2.5">
                        <Smile className="w-4 h-4 text-rose-400" />
                        <div>
                          <span className="font-bold text-white">Emojis löschen</span>
                          <span className="text-zinc-400 ml-2 text-[11px]">
                            ({purgeSummary?.emojisCount ?? emojis.length} Emojis)
                          </span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={purgeEmojis}
                        onChange={(e) => setPurgeEmojis(e.target.checked)}
                        className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                      />
                    </label>

                    {/* Stickers */}
                    <label className="flex items-center justify-between p-3 bg-[#12131a] border border-[#1e1f2b] hover:border-[#2a2b3d] rounded-xl cursor-pointer transition-colors">
                      <div className="flex items-center gap-2.5">
                        <Sticker className="w-4 h-4 text-rose-400" />
                        <div>
                          <span className="font-bold text-white">Sticker löschen</span>
                          <span className="text-zinc-400 ml-2 text-[11px]">
                            ({purgeSummary?.stickersCount ?? 0} Sticker)
                          </span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={purgeStickers}
                        onChange={(e) => setPurgeStickers(e.target.checked)}
                        className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                      />
                    </label>

                    {/* Invites */}
                    <label className="flex items-center justify-between p-3 bg-[#12131a] border border-[#1e1f2b] hover:border-[#2a2b3d] rounded-xl cursor-pointer transition-colors">
                      <div className="flex items-center gap-2.5">
                        <Link className="w-4 h-4 text-rose-400" />
                        <div>
                          <span className="font-bold text-white">Einladungen widerrufen</span>
                          <span className="text-zinc-400 ml-2 text-[11px]">
                            ({purgeSummary?.invitesCount ?? 0} aktive Invites)
                          </span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={purgeInvites}
                        onChange={(e) => setPurgeInvites(e.target.checked)}
                        className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                      />
                    </label>

                    {/* Database Module Configs */}
                    <label className="flex items-center justify-between p-3 bg-[#12131a] border border-[#1e1f2b] hover:border-[#2a2b3d] rounded-xl cursor-pointer transition-colors">
                      <div className="flex items-center gap-2.5">
                        <Database className="w-4 h-4 text-rose-400" />
                        <div>
                          <span className="font-bold text-white">Bot-Module & DB-Konfigurationen zurücksetzen</span>
                          <span className="text-zinc-400 ml-2 text-[11px]">
                            (Tickets, Apps, Welcome, Custom Messages, Auto-React)
                          </span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={purgeDbConfigs}
                        onChange={(e) => setPurgeDbConfigs(e.target.checked)}
                        className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                      />
                    </label>
                  </div>

                  {/* Confirmation Input */}
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-2">
                    <p className="text-[11px] text-rose-300 font-semibold flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 shrink-0" />
                      Tippe zur Bestätigung <strong className="text-white font-mono uppercase">LÖSCHEN</strong> oder den Servernamen ein:
                    </p>
                    <input
                      type="text"
                      placeholder="LÖSCHEN eingeben..."
                      value={confirmInput}
                      onChange={(e) => setConfirmInput(e.target.value)}
                      className="w-full bg-[#0d0e15] border border-rose-500/40 focus:border-rose-400 text-white rounded-xl px-3.5 py-2 text-xs outline-none uppercase font-mono tracking-wider"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#1e1f2b] bg-[#11080d] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsPurgeModalOpen(false)}
                className="px-4 py-2 text-xs text-zinc-400 hover:text-white rounded-xl"
              >
                Abbrechen
              </button>

              <button
                type="button"
                onClick={handleExecutePurge}
                disabled={purging || !hasAnySelection || !isConfirmationValid}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs shadow-lg shadow-rose-600/30 transition-all cursor-pointer flex items-center gap-2"
              >
                {purging ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
                <span>{purging ? "Lösche ausgewählte Elemente..." : "Ausgewählte Elemente löschen"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
