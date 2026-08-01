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
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-discord-header flex items-center gap-2">
            <LinkIcon className="w-6 h-6 text-discord-brand" />
            Invite Link Manager
          </h2>
          <p className="text-sm text-discord-muted">Generate custom invite links, set expiration limits, and revoke active links.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-discord-brand hover:bg-discord-brandHover text-white rounded-lg font-medium text-sm transition-colors shadow"
        >
          <Plus className="w-4 h-4" /> Create Invite Link
        </button>
      </div>

      {/* Invites Table */}
      <div className="bg-[#2b2d31] border border-[#35373c] rounded-xl overflow-hidden shadow">
        <div className="grid grid-cols-12 p-3 bg-[#1e1f22] text-xs font-bold uppercase tracking-wider text-discord-muted border-b border-[#35373c]">
          <div className="col-span-3">Code / URL</div>
          <div className="col-span-3">Target Channel</div>
          <div className="col-span-2">Uses</div>
          <div className="col-span-2">Expires</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {invites.length === 0 ? (
          <div className="p-8 text-center text-discord-muted text-sm italic">No active invite links found for this server.</div>
        ) : (
          <div className="divide-y divide-[#35373c]/50">
            {invites.map((inv) => (
              <div key={inv.code} className="grid grid-cols-12 p-3 items-center hover:bg-[#35373c]/40 transition-colors text-sm">
                <div className="col-span-3 flex items-center gap-2">
                  <span className="font-mono font-bold text-discord-brand">{inv.code}</span>
                  <button
                    onClick={() => handleCopy(inv.url, inv.code)}
                    className="p-1 text-discord-muted hover:text-white rounded"
                    title="Copy Link"
                  >
                    {copiedCode === inv.code ? <Check className="w-3.5 h-3.5 text-discord-green" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="col-span-3 text-discord-header font-medium truncate">#{inv.channelName}</div>

                <div className="col-span-2 text-discord-muted text-xs flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-discord-brand" />
                  {inv.uses} / {inv.maxUses === 0 ? "∞" : inv.maxUses}
                </div>

                <div className="col-span-2 text-discord-muted text-xs flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-discord-yellow" />
                  {inv.maxAge === 0 ? "Never" : inv.expiresTimestamp ? new Date(inv.expiresTimestamp).toLocaleDateString() : `${inv.maxAge}s`}
                </div>

                <div className="col-span-2 flex items-center justify-end">
                  <button
                    onClick={() => handleDelete(inv.code)}
                    className="p-1.5 text-discord-muted hover:text-discord-red hover:bg-[#1e1f22] rounded transition-colors"
                    title="Revoke Invite"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#313338] border border-[#35373c] rounded-xl w-full max-w-md p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-discord-header">Create Invite Link</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-discord-muted hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-discord-muted block mb-1">
                  Target Channel
                </label>
                <select
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-lg p-2.5 text-sm text-discord-header focus:outline-none focus:border-discord-brand"
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
                <label className="text-xs font-bold uppercase tracking-wider text-discord-muted block mb-1">
                  Expire After
                </label>
                <select
                  value={maxAge}
                  onChange={(e) => setMaxAge(Number(e.target.value))}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-lg p-2.5 text-sm text-discord-header focus:outline-none focus:border-discord-brand"
                >
                  <option value={1800}>30 minutes</option>
                  <option value={3600}>1 hour</option>
                  <option value={21600}>6 hours</option>
                  <option value={43200}>12 hours</option>
                  <option value={86400}>1 day</option>
                  <option value={604800}>7 days</option>
                  <option value={0}>Never</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-discord-muted block mb-1">
                  Max Number of Uses
                </label>
                <select
                  value={maxUses}
                  onChange={(e) => setMaxUses(Number(e.target.value))}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-lg p-2.5 text-sm text-discord-header focus:outline-none focus:border-discord-brand"
                >
                  <option value={0}>No limit (Unlimited)</option>
                  <option value={1}>1 use</option>
                  <option value={5}>5 uses</option>
                  <option value={10}>10 uses</option>
                  <option value={25}>25 uses</option>
                  <option value={50}>50 uses</option>
                  <option value={100}>100 uses</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3 bg-[#1e1f22] rounded-lg">
                <span className="text-sm font-semibold text-discord-header">Grant Temporary Membership</span>
                <input
                  type="checkbox"
                  checked={temporary}
                  onChange={(e) => setTemporary(e.target.checked)}
                  className="w-4 h-4 accent-discord-brand cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#35373c]">
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
                  Generate Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
