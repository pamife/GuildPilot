"use client";

import React, { useState } from "react";
import { Smile, Sticker as StickerIcon, Plus, Trash2, Edit2, Upload, X } from "lucide-react";
import { useToast } from "../ToastContainer";

interface Emoji {
  id: string;
  name: string;
  url: string;
  animated: boolean;
}

interface Sticker {
  id: string;
  name: string;
  description: string;
  tags: string;
  url: string;
}

interface EmojiStickerManagerProps {
  emojis: Emoji[];
  stickers: Sticker[];
  onCreateEmoji: (name: string, image: string) => Promise<void>;
  onUpdateEmoji: (emojiId: string, name: string) => Promise<void>;
  onDeleteEmoji: (emojiId: string) => Promise<void>;
  onCreateSticker: (data: { name: string; description: string; tags: string; file: string }) => Promise<void>;
  onDeleteSticker: (stickerId: string) => Promise<void>;
}

export function EmojiStickerManagerView({
  emojis,
  stickers,
  onCreateEmoji,
  onUpdateEmoji,
  onDeleteEmoji,
  onCreateSticker,
  onDeleteSticker,
}: EmojiStickerManagerProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<"emojis" | "stickers">("emojis");

  // Modals state
  const [isUploadEmojiOpen, setIsUploadEmojiOpen] = useState(false);
  const [emojiName, setEmojiName] = useState("");
  const [emojiImage, setEmojiImage] = useState("");

  const [editingEmoji, setEditingEmoji] = useState<Emoji | null>(null);
  const [renameEmojiName, setRenameEmojiName] = useState("");

  const [isUploadStickerOpen, setIsUploadStickerOpen] = useState(false);
  const [stickerName, setStickerName] = useState("");
  const [stickerDesc, setStickerDesc] = useState("");
  const [stickerTags, setStickerTags] = useState("");
  const [stickerFile, setStickerFile] = useState("");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEmojiUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emojiName.trim() || !emojiImage) return;
    try {
      await onCreateEmoji(emojiName, emojiImage);
      showToast(`Emoji :${emojiName}: uploaded!`, "success");
      setIsUploadEmojiOpen(false);
      setEmojiName("");
      setEmojiImage("");
    } catch (err: any) {
      showToast(err.message || "Failed to upload emoji", "error");
    }
  };

  const handleEmojiRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmoji || !renameEmojiName.trim()) return;
    try {
      await onUpdateEmoji(editingEmoji.id, renameEmojiName);
      showToast(`Emoji renamed to :${renameEmojiName}:`, "success");
      setEditingEmoji(null);
    } catch (err: any) {
      showToast(err.message || "Failed to rename emoji", "error");
    }
  };

  const handleDeleteEmojiClick = async (e: Emoji) => {
    if (!confirm(`Delete emoji :${e.name}:?`)) return;
    try {
      await onDeleteEmoji(e.id);
      showToast(`Emoji :${e.name}: deleted.`, "info");
    } catch (err: any) {
      showToast(err.message || "Failed to delete emoji", "error");
    }
  };

  const handleStickerUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stickerName.trim() || !stickerFile) return;
    try {
      await onCreateSticker({
        name: stickerName,
        description: stickerDesc,
        tags: stickerTags || "guildpilot",
        file: stickerFile,
      });
      showToast(`Sticker "${stickerName}" uploaded!`, "success");
      setIsUploadStickerOpen(false);
      setStickerName("");
      setStickerDesc("");
      setStickerTags("");
      setStickerFile("");
    } catch (err: any) {
      showToast(err.message || "Failed to upload sticker", "error");
    }
  };

  const handleDeleteStickerClick = async (s: Sticker) => {
    if (!confirm(`Delete sticker "${s.name}"?`)) return;
    try {
      await onDeleteSticker(s.id);
      showToast(`Sticker "${s.name}" deleted.`, "info");
    } catch (err: any) {
      showToast(err.message || "Failed to delete sticker", "error");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-[#0b0f17] text-slate-200">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[#0d121c] border border-[#1e293b] shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Smile className="w-5 h-5" />
            </div>
            Emoji- & Sticker-Manager
          </h2>
          <p className="text-xs text-slate-400 mt-1">Eigene Server-Emojis und Sticker hochladen, umbenennen und verwalten.</p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center p-1 bg-[#111724] rounded-xl border border-[#1e293b] gap-1">
          <button
            onClick={() => setActiveTab("emojis")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "emojis" ? "bg-indigo-600 text-white shadow-sm font-bold" : "text-slate-400 hover:text-white hover:bg-[#1a2333]"
            }`}
          >
            <Smile className="w-4 h-4" /> Emojis ({emojis.length})
          </button>
          <button
            onClick={() => setActiveTab("stickers")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "stickers" ? "bg-indigo-600 text-white shadow-sm font-bold" : "text-slate-400 hover:text-white hover:bg-[#1a2333]"
            }`}
          >
            <StickerIcon className="w-4 h-4" /> Sticker ({stickers.length})
          </button>
        </div>
      </div>

      {/* EMOJIS TAB */}
      {activeTab === "emojis" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setIsUploadEmojiOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/25 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Neues Emoji hochladen
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {emojis.map((e) => (
              <div
                key={e.id}
                className="group relative bg-[#111724] border border-[#1e293b] hover:border-indigo-500/40 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-sm transition-all"
              >
                <img src={e.url} alt={e.name} className="w-12 h-12 object-contain mb-2" />
                <span className="text-xs font-mono font-semibold text-slate-200 truncate w-full">:{e.name}:</span>
                {e.animated && (
                  <span className="mt-1 text-[9px] bg-indigo-600 px-2 py-0.5 rounded-full font-bold uppercase text-white tracking-wider">
                    GIF
                  </span>
                )}

                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 flex items-center gap-1 bg-[#0d121c]/90 backdrop-blur-md p-1 rounded-lg border border-[#1e293b]">
                  <button
                    onClick={() => {
                      setEditingEmoji(e);
                      setRenameEmojiName(e.name);
                    }}
                    className="p-1 text-slate-400 hover:text-white hover:bg-[#1a2333] rounded-md cursor-pointer"
                    title="Emoji umbenennen"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteEmojiClick(e)}
                    className="p-1 text-slate-400 hover:text-rose-400 hover:bg-[#1a2333] rounded-md cursor-pointer"
                    title="Emoji löschen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STICKERS TAB */}
      {activeTab === "stickers" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setIsUploadStickerOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/25 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Neuen Sticker hochladen
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stickers.map((s) => (
              <div
                key={s.id}
                className="group relative bg-[#111724] border border-[#1e293b] hover:border-indigo-500/40 rounded-2xl p-5 flex flex-col items-center text-center shadow-sm transition-all"
              >
                <img src={s.url} alt={s.name} className="w-24 h-24 object-contain mb-3" />
                <p className="text-sm font-bold text-white">{s.name}</p>
                <p className="text-xs text-slate-400 mt-1 truncate max-w-full">{s.description || "Keine Beschreibung"}</p>
                <span className="mt-2 text-[10px] bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full text-indigo-400 font-mono">
                  🏷️ {s.tags}
                </span>

                <button
                  onClick={() => handleDeleteStickerClick(s)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 p-1.5 bg-[#0d121c]/90 backdrop-blur-md rounded-lg border border-[#1e293b] text-slate-400 hover:text-rose-400 cursor-pointer"
                  title="Sticker löschen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* UPLOAD EMOJI MODAL */}
      {isUploadEmojiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-[#0f1626] border border-[#212d45] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
              <h3 className="text-base font-bold text-white">Emoji hochladen</h3>
              <button onClick={() => setIsUploadEmojiOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a2333]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEmojiUploadSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Emoji-Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="z. B. poggers"
                  value={emojiName}
                  onChange={(e) => setEmojiName(e.target.value)}
                  className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-2.5 text-xs transition-all outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Bilddatei (Datei oder URL)
                </label>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/gif"
                  onChange={(e) => handleFileUpload(e, setEmojiImage)}
                  className="w-full text-xs text-slate-400 bg-[#0d121c] border border-[#1e293b] rounded-xl p-2 cursor-pointer mb-2"
                />
                <input
                  type="url"
                  placeholder="Oder Bild-URL einfügen (https://...)"
                  value={emojiImage.startsWith("data:") ? "" : emojiImage}
                  onChange={(e) => setEmojiImage(e.target.value)}
                  className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-2 text-xs transition-all outline-none"
                />
              </div>

              {emojiImage && (
                <div className="flex justify-center p-4 bg-[#0d121c] border border-[#1e293b] rounded-xl">
                  <img src={emojiImage} alt="Preview" className="w-12 h-12 object-contain" />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1e293b]">
                <button
                  type="button"
                  onClick={() => setIsUploadEmojiOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white hover:bg-[#1a2333] rounded-xl font-medium"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/25 cursor-pointer"
                >
                  Hochladen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENAME EMOJI MODAL */}
      {editingEmoji && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-[#0f1626] border border-[#212d45] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
              <h3 className="text-base font-bold text-white">Emoji umbenennen</h3>
              <button onClick={() => setEditingEmoji(null)} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a2333]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEmojiRenameSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Neuer Emoji-Name
                </label>
                <input
                  type="text"
                  required
                  value={renameEmojiName}
                  onChange={(e) => setRenameEmojiName(e.target.value)}
                  className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-2.5 text-xs transition-all outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1e293b]">
                <button
                  type="button"
                  onClick={() => setEditingEmoji(null)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white hover:bg-[#1a2333] rounded-xl font-medium"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/25 cursor-pointer"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPLOAD STICKER MODAL */}
      {isUploadStickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-[#0f1626] border border-[#212d45] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
              <h3 className="text-base font-bold text-white">Sticker hochladen</h3>
              <button onClick={() => setIsUploadStickerOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a2333]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleStickerUploadSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Sticker-Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="z. B. Wave Hello"
                  value={stickerName}
                  onChange={(e) => setStickerName(e.target.value)}
                  className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-2.5 text-xs transition-all outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Beschreibung
                </label>
                <input
                  type="text"
                  placeholder="Sticker-Beschreibung..."
                  value={stickerDesc}
                  onChange={(e) => setStickerDesc(e.target.value)}
                  className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-2.5 text-xs transition-all outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Passendes Emoji / Schlagwort
                </label>
                <input
                  type="text"
                  placeholder="z. B. 👋 oder Welle"
                  value={stickerTags}
                  onChange={(e) => setStickerTags(e.target.value)}
                  className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-2.5 text-xs transition-all outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Bilddatei (PNG/APNG)
                </label>
                <input
                  type="file"
                  accept="image/png, image/apng"
                  onChange={(e) => handleFileUpload(e, setStickerFile)}
                  className="w-full text-xs text-slate-400 bg-[#0d121c] border border-[#1e293b] rounded-xl p-2 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1e293b]">
                <button
                  type="button"
                  onClick={() => setIsUploadStickerOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white hover:bg-[#1a2333] rounded-xl font-medium"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/25 cursor-pointer"
                >
                  Sticker hochladen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

