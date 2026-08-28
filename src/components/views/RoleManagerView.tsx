"use client";

import React, { useState } from "react";
import { Shield, Plus, Edit2, Trash2, ArrowUp, ArrowDown, Check, X, Palette, Users } from "lucide-react";
import { useToast } from "../ToastContainer";

interface Role {
  id: string;
  name: string;
  color: string;
  hoist: boolean;
  position: number;
  permissions: string;
  managed: boolean;
  mentionable: boolean;
  memberCount: number;
}

interface RoleManagerProps {
  roles: Role[];
  onCreateRole: (data: any) => Promise<void>;
  onUpdateRole: (roleId: string, data: any) => Promise<void>;
  onReorderRoles: (positions: Array<{ id: string; position: number }>) => Promise<void>;
  onDeleteRole: (roleId: string) => Promise<void>;
}

const PERMISSION_FLAGS = [
  { name: "Administrator", flag: 8n, desc: "Gewährt alle Berechtigungen und umgeht Kanal-Einschränkungen." },
  { name: "Server verwalten", flag: 32n, desc: "Servername, Icon und Region anpassen." },
  { name: "Rollen verwalten", flag: 268435456n, desc: "Untergeordnete Rollen erstellen und bearbeiten." },
  { name: "Kanäle verwalten", flag: 16n, desc: "Kanäle erstellen, bearbeiten oder löschen." },
  { name: "Audit-Log einsehen", flag: 128n, desc: "Server-Audit-Logbuch einsehen." },
  { name: "Nachrichten senden", flag: 2048n, desc: "Nachrichten in Textkanälen verfassen." },
  { name: "Links einbetten", flag: 16384n, desc: "Links posten, die Vorschauen erzeugen." },
  { name: "Dateien anhängen", flag: 32768n, desc: "Dateien, Bilder und Medien hochladen." },
  { name: "Verlauf lesen", flag: 65536n, desc: "Vergangene Nachrichten im Kanal lesen." },
  { name: "@everyone erwähnen", flag: 131072n, desc: "@everyone und @here Benachrichtigungen auslösen." },
  { name: "Sprachkanal verbinden", flag: 1048576n, desc: "Sprachkanälen beitreten." },
  { name: "Sprechen", flag: 2097152n, desc: "In Sprachkanälen sprechen." },
];

export function RoleManagerView({
  roles,
  onCreateRole,
  onUpdateRole,
  onReorderRoles,
  onDeleteRole,
}: RoleManagerProps) {
  const { showToast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // New role form
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#6366F1");
  const [newRoleHoist, setNewRoleHoist] = useState(false);
  const [newRoleMentionable, setNewRoleMentionable] = useState(false);

  // Edit role form
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#6366F1");
  const [editHoist, setEditHoist] = useState(false);
  const [editMentionable, setEditMentionable] = useState(false);
  const [editPermissionsBitfield, setEditPermissionsBitfield] = useState<bigint>(0n);

  const sortedRoles = [...roles].sort((a, b) => b.position - a.position);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    try {
      await onCreateRole({
        name: newRoleName,
        color: newRoleColor,
        hoist: newRoleHoist,
        mentionable: newRoleMentionable,
      });
      showToast(`Rolle "${newRoleName}" erfolgreich erstellt!`, "success");
      setIsCreateOpen(false);
      setNewRoleName("");
    } catch (err: any) {
      showToast(err.message || "Fehler beim Erstellen der Rolle", "error");
    }
  };

  const openEditModal = (role: Role) => {
    setEditingRole(role);
    setEditName(role.name);
    setEditColor(role.color === "#000000" ? "#99aab5" : role.color);
    setEditHoist(role.hoist);
    setEditMentionable(role.mentionable);
    try {
      setEditPermissionsBitfield(BigInt(role.permissions));
    } catch {
      setEditPermissionsBitfield(0n);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;
    try {
      await onUpdateRole(editingRole.id, {
        name: editName,
        color: editColor,
        hoist: editHoist,
        mentionable: editMentionable,
        permissions: editPermissionsBitfield.toString(),
      });
      showToast(`Rolle @${editName} erfolgreich aktualisiert!`, "success");
      setEditingRole(null);
    } catch (err: any) {
      showToast(err.message || "Fehler beim Aktualisieren der Rolle", "error");
    }
  };

  const handleDelete = async (role: Role) => {
    if (!confirm(`Möchtest du die Rolle @${role.name} wirklich löschen?`)) return;
    try {
      await onDeleteRole(role.id);
      showToast(`Rolle @${role.name} gelöscht.`, "info");
    } catch (err: any) {
      showToast(err.message || "Fehler beim Löschen der Rolle", "error");
    }
  };

  const togglePermissionFlag = (flag: bigint) => {
    setEditPermissionsBitfield((prev) => {
      if ((prev & flag) !== 0n) {
        return prev & ~flag;
      } else {
        return prev | flag;
      }
    });
  };

  const handleMove = async (role: Role, direction: "up" | "down") => {
    const currentIndex = sortedRoles.findIndex((r) => r.id === role.id);
    if (currentIndex === -1) return;
    if (direction === "up" && currentIndex === 0) return;
    if (direction === "down" && currentIndex === sortedRoles.length - 1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const targetRole = sortedRoles[targetIndex];

    const newPositions = [
      { id: role.id, position: targetRole.position },
      { id: targetRole.id, position: role.position },
    ];

    try {
      await onReorderRoles(newPositions);
      showToast("Rollen-Hierarchie aktualisiert!", "success");
    } catch (err: any) {
      showToast(err.message || "Fehler beim Verschieben der Rolle", "error");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-[#0b0f17] text-slate-200">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Shield className="w-5 h-5" />
            </div>
            Rollen- & Rechte-Manager
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Rollen erstellen, Farben und Berechtigungen anpassen und die Hierarchie per Klick ordnen.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-xs transition-all shadow-md shadow-indigo-600/25 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Rolle erstellen
        </button>
      </div>

      {/* Role List */}
      <div className="bg-[#111724] border border-[#1e293b] rounded-2xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-12 p-3.5 bg-[#0d121c] text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-[#1e293b]">
          <div className="col-span-5 flex items-center gap-2">Rollenname</div>
          <div className="col-span-3">Mitglieder</div>
          <div className="col-span-2">Hierarchie</div>
          <div className="col-span-2 text-right">Aktionen</div>
        </div>

        <div className="divide-y divide-[#1e293b]">
          {sortedRoles.map((role, idx) => (
            <div
              key={role.id}
              className="grid grid-cols-12 p-3.5 items-center hover:bg-[#0d121c] transition-colors text-xs"
            >
              {/* Role Name & Color */}
              <div className="col-span-5 flex items-center gap-3">
                <div
                  className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0 shadow-sm"
                  style={{ backgroundColor: role.color === "#000000" ? "#99aab5" : role.color }}
                />
                <span className="font-semibold text-slate-200 truncate flex items-center gap-2">
                  {role.name}
                  {role.managed && <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full text-indigo-400 font-mono">VERWALTET</span>}
                </span>
              </div>

              {/* Member count */}
              <div className="col-span-3 text-slate-400 text-xs flex items-center gap-1.5 font-medium">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                {role.memberCount} Mitglieder
              </div>

              {/* Hierarchy Reorder */}
              <div className="col-span-2 flex items-center gap-1">
                <button
                  disabled={idx === 0 || role.name === "@everyone"}
                  onClick={() => handleMove(role, "up")}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-[#1a253a] rounded-lg disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer"
                  title="Nach oben verschieben"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  disabled={idx === sortedRoles.length - 1 || role.name === "@everyone"}
                  onClick={() => handleMove(role, "down")}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-[#1a253a] rounded-lg disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer"
                  title="Nach unten verschieben"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Actions */}
              <div className="col-span-2 flex items-center justify-end gap-1.5">
                <button
                  onClick={() => openEditModal(role)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-[#1a253a] rounded-lg transition-colors cursor-pointer"
                  title="Rolle & Rechte bearbeiten"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                {role.name !== "@everyone" && !role.managed && (
                  <button
                    onClick={() => handleDelete(role)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                    title="Rolle löschen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CREATE ROLE MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0f1626] border border-[#212d45] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1f2c44] pb-3">
              <h3 className="text-sm font-bold text-white">Neue Rolle erstellen</h3>
              <button onClick={() => setIsCreateOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a253b]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Rollenname
                </label>
                <input
                  type="text"
                  required
                  placeholder="z. B. Moderator"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2 text-xs transition-all outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-2">
                  <Palette className="w-3.5 h-3.5 text-indigo-400" /> Rollenfarbe
                </label>
                <div className="flex items-center gap-3 bg-[#0d121c] border border-[#1e293b] p-2.5 rounded-xl">
                  <input
                    type="color"
                    value={newRoleColor}
                    onChange={(e) => setNewRoleColor(e.target.value)}
                    className="w-7 h-7 rounded-lg cursor-pointer border-0 bg-transparent"
                  />
                  <span className="font-mono text-xs text-slate-200 font-bold uppercase">{newRoleColor}</span>
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between p-3 bg-[#0d121c] border border-[#1e293b] rounded-xl">
                  <span className="text-xs text-slate-200 font-semibold">Separat in Mitgliederliste anzeigen (Hoist)</span>
                  <input
                    type="checkbox"
                    checked={newRoleHoist}
                    onChange={(e) => setNewRoleHoist(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-[#0d121c] border border-[#1e293b] rounded-xl">
                  <span className="text-xs text-slate-200 font-semibold">Allen erlauben, diese Rolle zu @erwähnen</span>
                  <input
                    type="checkbox"
                    checked={newRoleMentionable}
                    onChange={(e) => setNewRoleMentionable(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>
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
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/25 cursor-pointer"
                >
                  Rolle erstellen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ROLE & PERMISSIONS MODAL */}
      {editingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0f1626] border border-[#212d45] rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-[#1f2c44] bg-[#0d121c]">
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full ring-2 ring-white/20 shadow-md"
                  style={{ backgroundColor: editColor }}
                />
                <h3 className="text-sm font-bold text-white">Rolle bearbeiten: @{editingRole.name}</h3>
              </div>
              <button onClick={() => setEditingRole(null)} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a253b]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Basic Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                    Rollenname
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                    Rollenfarbe
                  </label>
                  <div className="flex items-center gap-3 bg-[#0d121c] border border-[#1e293b] p-2 rounded-xl">
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="w-7 h-7 rounded-lg cursor-pointer border-0 bg-transparent"
                    />
                    <span className="font-mono text-xs text-slate-200 font-bold uppercase">{editColor}</span>
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-3 bg-[#0d121c] border border-[#1e293b] rounded-xl">
                  <span className="text-xs font-semibold text-slate-200">Separat anzeigen (Hoist)</span>
                  <input
                    type="checkbox"
                    checked={editHoist}
                    onChange={(e) => setEditHoist(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-[#0d121c] border border-[#1e293b] rounded-xl">
                  <span className="text-xs font-semibold text-slate-200">@Erwähnung erlauben</span>
                  <input
                    type="checkbox"
                    checked={editMentionable}
                    onChange={(e) => setEditMentionable(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Permission Bitfield Matrix */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-[#1e293b] pb-2">
                  Berechtigungs-Matrix
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PERMISSION_FLAGS.map((perm) => {
                    const isEnabled = (editPermissionsBitfield & perm.flag) !== 0n;
                    return (
                      <div
                        key={perm.name}
                        onClick={() => togglePermissionFlag(perm.flag)}
                        className={`cursor-pointer p-3 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                          isEnabled
                            ? "bg-indigo-500/10 border-indigo-500/40 text-white"
                            : "bg-[#0d121c] border-[#1e293b] text-slate-400 hover:border-[#27272a]"
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold text-white">{perm.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{perm.desc}</p>
                        </div>
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center shrink-0 mt-0.5 ${
                            isEnabled ? "bg-indigo-600 text-white" : "border border-[#27272a]"
                          }`}
                        >
                          {isEnabled && <Check className="w-3 h-3" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1e293b] sticky bottom-0 bg-[#0f1626] py-2">
                <button
                  type="button"
                  onClick={() => setEditingRole(null)}
                  className="px-3.5 py-2 text-xs text-slate-400 hover:text-white hover:bg-[#1a253a] rounded-xl font-medium"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/25 cursor-pointer"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
