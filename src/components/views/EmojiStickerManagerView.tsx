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
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Smile className="w-5 h-5" />
            </div>
            Emoji & Sticker Manager
          </h2>
          <p className="text-sm text-zinc-400 mt-0.5">Upload, rename, and manage custom server emojis and stickers.</p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center p-1.5 bg-[#09090b] rounded-xl border border-[#1f1f23] gap-1">
          <button
            onClick={() => setActiveTab("emojis")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "emojis" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 font-bold" : "text-zinc-400 hover:text-white hover:bg-[#18181b]"
            }`}
          >
            <Smile className="w-4 h-4" /> Emojis ({emojis.length})
          </button>
          <button
            onClick={() => setActiveTab("stickers")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "stickers" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 font-bold" : "text-zinc-400 hover:text-white hover:bg-[#18181b]"
            }`}
          >
            <StickerIcon className="w-4 h-4" /> Stickers ({stickers.length})
          </button>
        </div>
      </div>

      {/* EMOJIS TAB */}
      {activeTab === "emojis" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setIsUploadEmojiOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Upload Custom Emoji
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {emojis.map((e) => (
              <div
                key={e.id}
                className="group relative bg-[#09090b] border border-[#1f1f23] hover:border-indigo-500/40 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-lg transition-all hover:-translate-y-0.5"
              >
                <img src={e.url} alt={e.name} className="w-12 h-12 object-contain mb-2" />
                <span className="text-xs font-mono font-semibold text-zinc-200 truncate w-full">:{e.name}:</span>
                {e.animated && (
                  <span className="mt-1 text-[9px] bg-indigo-600 px-1.5 py-0.5 rounded-full font-bold uppercase text-white tracking-wider">
                    GIF
                  </span>
                )}

                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 flex items-center gap-1 bg-[#0a0a0e]/90 backdrop-blur-md p-1 rounded-lg border border-[#1f1f23]">
                  <button
                    onClick={() => {
                      setEditingEmoji(e);
                      setRenameEmojiName(e.name);
                    }}
                    className="p-1 text-zinc-400 hover:text-white hover:bg-[#18181b] rounded-md cursor-pointer"
                    title="Rename Emoji"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteEmojiClick(e)}
                    className="p-1 text-zinc-400 hover:text-rose-400 hover:bg-[#18181b] rounded-md cursor-pointer"
                    title="Delete Emoji"
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
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Upload Custom Sticker
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stickers.map((s) => (
              <div
                key={s.id}
                className="group relative bg-[#09090b] border border-[#1f1f23] hover:border-indigo-500/40 rounded-2xl p-5 flex flex-col items-center text-center shadow-lg transition-all hover:-translate-y-0.5"
              >
                <img src={s.url} alt={s.name} className="w-24 h-24 object-contain mb-3" />
                <p className="text-sm font-bold text-white">{s.name}</p>
                <p className="text-xs text-zinc-400 mt-1 truncate max-w-full">{s.description || "No description"}</p>
                <span className="mt-2 text-[10px] bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full text-indigo-400 font-mono">
                  🏷️ {s.tags}
                </span>

                <button
                  onClick={() => handleDeleteStickerClick(s)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 p-1.5 bg-[#0a0a0e]/90 backdrop-blur-md rounded-lg border border-[#1f1f23] text-zinc-400 hover:text-rose-400 cursor-pointer"
                  title="Delete Sticker"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0a0a0e] border border-[#1f1f2a] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1f1f23] pb-3">
              <h3 className="text-lg font-bold text-white">Upload Emoji</h3>
              <button onClick={() => setIsUploadEmojiOpen(false)} className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-[#18181b]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEmojiUploadSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Emoji Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. poggers"
                  value={emojiName}
                  onChange={(e) => setEmojiName(e.target.value)}
                  className="w-full bg-[#0d0d11] border border-[#27272a] focus:border-indigo-500 text-zinc-100 placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm transition-all outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Image (File or URL)
                </label>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/gif"
                  onChange={(e) => handleFileUpload(e, setEmojiImage)}
                  className="w-full text-xs text-zinc-400 bg-[#0d0d11] border border-[#27272a] rounded-xl p-2 cursor-pointer mb-2"
                />
                <input
                  type="url"
                  placeholder="Or paste image URL (https://...)"
                  value={emojiImage.startsWith("data:") ? "" : emojiImage}
                  onChange={(e) => setEmojiImage(e.target.value)}
                  className="w-full bg-[#0d0d11] border border-[#27272a] focus:border-indigo-500 text-zinc-100 placeholder-zinc-500 rounded-xl px-4 py-2 text-xs transition-all outline-none"
                />
              </div>

              {emojiImage && (
                <div className="flex justify-center p-4 bg-[#0d0d11] border border-[#1f1f23] rounded-xl">
                  <img src={emojiImage} alt="Preview" className="w-12 h-12 object-contain" />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1f1f23]">
                <button
                  type="button"
                  onClick={() => setIsUploadEmojiOpen(false)}
                  className="px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-[#18181b] rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENAME EMOJI MODAL */}
      {editingEmoji && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0a0a0e] border border-[#1f1f2a] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1f1f23] pb-3">
              <h3 className="text-lg font-bold text-white">Rename Emoji</h3>
              <button onClick={() => setEditingEmoji(null)} className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-[#18181b]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEmojiRenameSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  New Emoji Name
                </label>
                <input
                  type="text"
                  required
                  value={renameEmojiName}
                  onChange={(e) => setRenameEmojiName(e.target.value)}
                  className="w-full bg-[#0d0d11] border border-[#27272a] focus:border-indigo-500 text-zinc-100 placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm transition-all outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1f1f23]">
                <button
                  type="button"
                  onClick={() => setEditingEmoji(null)}
                  className="px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-[#18181b] rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  Save Name
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPLOAD STICKER MODAL */}
      {isUploadStickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0a0a0e] border border-[#1f1f2a] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1f1f23] pb-3">
              <h3 className="text-lg font-bold text-white">Upload Custom Sticker</h3>
              <button onClick={() => setIsUploadStickerOpen(false)} className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-[#18181b]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleStickerUploadSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Sticker Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wave Hello"
                  value={stickerName}
                  onChange={(e) => setStickerName(e.target.value)}
                  className="w-full bg-[#0d0d11] border border-[#27272a] focus:border-indigo-500 text-zinc-100 placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm transition-all outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Sticker description..."
                  value={stickerDesc}
                  onChange={(e) => setStickerDesc(e.target.value)}
                  className="w-full bg-[#0d0d11] border border-[#27272a] focus:border-indigo-500 text-zinc-100 placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm transition-all outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Tag Emoji / Keyword
                </label>
                <input
                  type="text"
                  placeholder="e.g. 👋 or wave"
                  value={stickerTags}
                  onChange={(e) => setStickerTags(e.target.value)}
                  className="w-full bg-[#0d0d11] border border-[#27272a] focus:border-indigo-500 text-zinc-100 placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm transition-all outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Image Attachment (PNG/APNG)
                </label>
                <input
                  type="file"
                  accept="image/png, image/apng"
                  onChange={(e) => handleFileUpload(e, setStickerFile)}
                  className="w-full text-xs text-zinc-400 bg-[#0d0d11] border border-[#27272a] rounded-xl p-2 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1f1f23]">
                <button
                  type="button"
                  onClick={() => setIsUploadStickerOpen(false)}
                  className="px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-[#18181b] rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  Upload Sticker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
