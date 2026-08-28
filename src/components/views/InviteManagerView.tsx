"use client";

import React, { useState } from "react";
import { Link as LinkIcon, Plus, Copy, Trash2, Clock, Users, X, Check } from "lucide-react";
import { useToast } from "../ToastContainer";

interface Invite {
  code: string;
  url: string;
  channelId: string;
  channelName: string;
  inviter: { username: string } | null;
  uses: number;
  maxUses: number;
  maxAge: number;
  temporary: boolean;
  expiresTimestamp: number | null;
}

interface InviteManagerProps {
  invites: Invite[];
  channels: any[];
  onCreateInvite: (data: any) => Promise<void>;
  onDeleteInvite: (code: string) => Promise<void>;
}

export function InviteManagerView({ invites, channels, onCreateInvite, onDeleteInvite }: InviteManagerProps) {
  const { showToast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // New Invite form
  const [channelId, setChannelId] = useState(channels[0]?.id || "");
  const [maxAge, setMaxAge] = useState(86400); // 24 hours
  const [maxUses, setMaxUses] = useState(0); // unlimited
  const [temporary, setTemporary] = useState(false);

  const handleCopy = (url: string, code: string) => {
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    showToast("Invite link copied to clipboard!", "info");
    setTimeout(() => setCopiedCode(null), 3000);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelId) return;
    try {
      await onCreateInvite({
        channelId,
        maxAge,
        maxUses,
        temporary,
      });
      showToast("New invite link created!", "success");
      setIsCreateOpen(false);
    } catch (err: any) {
      showToast(err.message || "Failed to create invite", "error");
    }
  };

  const handleDelete = async (code: string) => {
    if (!confirm(`Revoke invite link ${code}?`)) return;
    try {
      await onDeleteInvite(code);
      showToast(`Invite ${code} revoked.`, "info");
    } catch (err: any) {
      showToast(err.message || "Failed to revoke invite", "error");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-[#0b0f17] text-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[#0d121c] border border-[#1e293b] shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <LinkIcon className="w-5 h-5" />
            </div>
            Einladungslink-Manager
          </h2>
          <p className="text-xs text-slate-400 mt-1">Benutzerdefinierte Einladungslinks erstellen, Ablaufzeiten festlegen und aktive Links widerrufen.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/25 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Einladungslink erstellen
        </button>
      </div>

      {/* Invites Table */}
      <div className="bg-[#111724] border border-[#1e293b] rounded-2xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-12 p-3.5 bg-[#0d121c] text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-[#1e293b]">
          <div className="col-span-3">Code / URL</div>
          <div className="col-span-3">Zielkanal</div>
          <div className="col-span-2">Verwendungen</div>
          <div className="col-span-2">Gültigkeit</div>
          <div className="col-span-2 text-right">Aktionen</div>
        </div>

        {invites.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs italic">Keine aktiven Einladungslinks für diesen Server gefunden.</div>
        ) : (
          <div className="divide-y divide-[#1e293b]">
            {invites.map((inv) => (
              <div key={inv.code} className="grid grid-cols-12 p-3.5 items-center hover:bg-[#0d121c]/50 transition-colors text-xs">
                <div className="col-span-3 flex items-center gap-2">
                  <span className="font-mono font-bold text-indigo-400">{inv.code}</span>
                  <button
                    onClick={() => handleCopy(inv.url, inv.code)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-[#1a2333] rounded-lg transition-colors cursor-pointer"
                    title="Link kopieren"
                  >
                    {copiedCode === inv.code ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="col-span-3 text-slate-200 font-semibold truncate">#{inv.channelName}</div>

                <div className="col-span-2 text-slate-400 text-xs flex items-center gap-1.5 font-medium">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  {inv.uses} / {inv.maxUses === 0 ? "∞" : inv.maxUses}
                </div>

                <div className="col-span-2 text-slate-400 text-xs flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  {inv.maxAge === 0 ? "Unbegrenzt" : inv.expiresTimestamp ? new Date(inv.expiresTimestamp).toLocaleDateString("de-DE") : `${inv.maxAge}s`}
                </div>

                <div className="col-span-2 flex items-center justify-end">
                  <button
                    onClick={() => handleDelete(inv.code)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-[#1a2333] rounded-lg transition-colors cursor-pointer"
                    title="Einladung widerrufen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE INVITE MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-[#0f1626] border border-[#212d45] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
              <h3 className="text-base font-bold text-white">Einladungslink erstellen</h3>
              <button onClick={() => setIsCreateOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a2333]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Zielkanal
                </label>
                <select
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 text-slate-100 rounded-xl px-4 py-2.5 text-xs transition-all outline-none cursor-pointer"
                >
                  {channels
                    .filter((c) => c.type === 0 || c.type === 2)
                    .map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.type === 2 ? "🔊 " : "# "}{ch.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Gültigkeitsdauer
                </label>
                <select
                  value={maxAge}
                  onChange={(e) => setMaxAge(Number(e.target.value))}
                  className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 text-slate-100 rounded-xl px-4 py-2.5 text-xs transition-all outline-none cursor-pointer"
                >
                  <option value={1800}>30 Minuten</option>
                  <option value={3600}>1 Stunde</option>
                  <option value={21600}>6 Stunden</option>
                  <option value={43200}>12 Stunden</option>
                  <option value={86400}>1 Tag</option>
                  <option value={604800}>7 Tage</option>
                  <option value={0}>Nie ablaufend</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Maximale Anzahl der Nutzungen
                </label>
                <select
                  value={maxUses}
                  onChange={(e) => setMaxUses(Number(e.target.value))}
                  className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 text-slate-100 rounded-xl px-4 py-2.5 text-xs transition-all outline-none cursor-pointer"
                >
                  <option value={0}>Unbegrenzt</option>
                  <option value={1}>1 Nutzung</option>
                  <option value={5}>5 Nutzungen</option>
                  <option value={10}>10 Nutzungen</option>
                  <option value={25}>25 Nutzungen</option>
                  <option value={50}>50 Nutzungen</option>
                  <option value={100}>100 Nutzungen</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-[#0d121c] border border-[#1e293b] rounded-xl">
                <span className="text-xs font-semibold text-slate-200">Temporäre Mitgliedschaft gewähren</span>
                <input
                  type="checkbox"
                  checked={temporary}
                  onChange={(e) => setTemporary(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1e293b]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white hover:bg-[#1a2333] rounded-xl font-medium"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/25 cursor-pointer"
                >
                  Link generieren
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

