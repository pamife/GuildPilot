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
  { name: "Administrator", flag: 8n, desc: "Grants all permissions, bypassing channel restrictions." },
  { name: "Manage Server", flag: 32n, desc: "Change server name, icon, and region." },
  { name: "Manage Roles", flag: 268435456n, desc: "Create and edit lower roles." },
  { name: "Manage Channels", flag: 16n, desc: "Create, edit, or delete channels." },
  { name: "View Audit Log", flag: 128n, desc: "View server audit log." },
  { name: "Send Messages", flag: 2048n, desc: "Post messages in text channels." },
  { name: "Embed Links", flag: 16384n, desc: "Post links that generate embeds." },
  { name: "Attach Files", flag: 32768n, desc: "Upload files and images." },
  { name: "Read Message History", flag: 65536n, desc: "Read past channel messages." },
  { name: "Mention Everyone", flag: 131072n, desc: "Use @everyone and @here mentions." },
  { name: "Connect (Voice)", flag: 1048576n, desc: "Connect to voice channels." },
  { name: "Speak (Voice)", flag: 2097152n, desc: "Speak in voice channels." },
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
  const [newRoleColor, setNewRoleColor] = useState("#5865F2");
  const [newRoleHoist, setNewRoleHoist] = useState(false);
  const [newRoleMentionable, setNewRoleMentionable] = useState(false);

  // Edit role form
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#5865F2");
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
      showToast(`Role "${newRoleName}" created!`, "success");
      setIsCreateOpen(false);
      setNewRoleName("");
    } catch (err: any) {
      showToast(err.message || "Failed to create role", "error");
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
      showToast(`Role "${editName}" updated successfully!`, "success");
      setEditingRole(null);
    } catch (err: any) {
      showToast(err.message || "Failed to update role", "error");
    }
  };

  const togglePermissionFlag = (flag: bigint) => {
    setEditPermissionsBitfield((prev) => (prev & flag ? prev & ~flag : prev | flag));
  };

  const handleDelete = async (role: Role) => {
    if (!confirm(`Are you sure you want to delete role @${role.name}?`)) return;
    try {
      await onDeleteRole(role.id);
      showToast(`Role @${role.name} deleted.`, "info");
    } catch (err: any) {
      showToast(err.message || "Failed to delete role", "error");
    }
  };

  const handleMove = async (role: Role, direction: "up" | "down") => {
    const currentIndex = sortedRoles.findIndex((r) => r.id === role.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sortedRoles.length) return;

    const updated = [...sortedRoles];
    const temp = updated[currentIndex];
    updated[currentIndex] = updated[targetIndex];
    updated[targetIndex] = temp;

    // Recalculate position numbers
    const newPositions = updated.map((r, idx) => ({
      id: r.id,
      position: updated.length - idx,
    }));

    try {
      await onReorderRoles(newPositions);
      showToast("Role order updated!", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to reorder roles", "error");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Shield className="w-5 h-5" />
            </div>
            Role Manager
          </h2>
          <p className="text-sm text-zinc-400 mt-0.5">Create roles, customize colors, toggle permissions, and reorder hierarchy.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Create Role
        </button>
      </div>

      {/* Role List */}
      <div className="bg-[#09090b] border border-[#1f1f23] rounded-2xl overflow-hidden shadow-lg">
        <div className="grid grid-cols-12 p-3.5 bg-[#0d0d11] text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-[#1f1f23]">
          <div className="col-span-5 flex items-center gap-2">Role Name</div>
          <div className="col-span-3">Members</div>
          <div className="col-span-2">Hierarchy</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        <div className="divide-y divide-[#1f1f23]">
          {sortedRoles.map((role, idx) => (
            <div
              key={role.id}
              className="grid grid-cols-12 p-3.5 items-center hover:bg-[#0d0d11] transition-colors text-sm"
            >
              {/* Role Name & Color */}
              <div className="col-span-5 flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full border border-white/20 shrink-0 shadow-sm"
                  style={{ backgroundColor: role.color === "#000000" ? "#99aab5" : role.color }}
                />
                <span className="font-semibold text-zinc-200 truncate flex items-center gap-2">
                  {role.name}
                  {role.managed && <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full text-indigo-400 font-mono">MANAGED</span>}
                </span>
              </div>

              {/* Member count */}
              <div className="col-span-3 text-zinc-400 text-xs flex items-center gap-1.5 font-medium">
                <Users className="w-3.5 h-3.5 text-zinc-500" />
                {role.memberCount} members
              </div>

              {/* Hierarchy Reorder */}
              <div className="col-span-2 flex items-center gap-1">
                <button
                  disabled={idx === 0 || role.name === "@everyone"}
                  onClick={() => handleMove(role, "up")}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#18181b] rounded-lg disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  disabled={idx === sortedRoles.length - 1 || role.name === "@everyone"}
                  onClick={() => handleMove(role, "down")}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#18181b] rounded-lg disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>

              {/* Actions */}
              <div className="col-span-2 flex items-center justify-end gap-1.5">
                <button
                  onClick={() => openEditModal(role)}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#18181b] rounded-lg transition-colors cursor-pointer"
                  title="Edit Role & Permissions"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {role.name !== "@everyone" && !role.managed && (
                  <button
                    onClick={() => handleDelete(role)}
                    className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-[#18181b] rounded-lg transition-colors cursor-pointer"
                    title="Delete Role"
                  >
                    <Trash2 className="w-4 h-4" />
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
          <div className="bg-[#0a0a0e] border border-[#1f1f2a] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1f1f23] pb-3">
              <h3 className="text-lg font-bold text-white">Create Role</h3>
              <button onClick={() => setIsCreateOpen(false)} className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-[#18181b]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Role Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Moderator"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full bg-[#0d0d11] border border-[#27272a] focus:border-indigo-500 text-zinc-100 placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm transition-all outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5 flex items-center gap-2">
                  <Palette className="w-3.5 h-3.5 text-indigo-400" /> Role Color
                </label>
                <div className="flex items-center gap-3 bg-[#0d0d11] border border-[#27272a] p-2.5 rounded-xl">
                  <input
                    type="color"
                    value={newRoleColor}
                    onChange={(e) => setNewRoleColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
                  />
                  <span className="font-mono text-sm text-zinc-200 font-bold uppercase">{newRoleColor}</span>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-3.5 bg-[#0d0d11] border border-[#1f1f23] rounded-xl">
                  <span className="text-sm text-zinc-200 font-semibold">Display separately (Hoist)</span>
                  <input
                    type="checkbox"
                    checked={newRoleHoist}
                    onChange={(e) => setNewRoleHoist(e.target.checked)}
                    className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between p-3.5 bg-[#0d0d11] border border-[#1f1f23] rounded-xl">
                  <span className="text-sm text-zinc-200 font-semibold">Allow anyone to @mention</span>
                  <input
                    type="checkbox"
                    checked={newRoleMentionable}
                    onChange={(e) => setNewRoleMentionable(e.target.checked)}
                    className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1f1f23]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-[#18181b] rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  Create Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ROLE & PERMISSIONS MODAL */}
      {editingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0a0a0e] border border-[#1f1f2a] rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-[#1f1f23] bg-[#09090b]">
              <div className="flex items-center gap-3">
                <div
                  className="w-5 h-5 rounded-full ring-2 ring-white/20 shadow-md"
                  style={{ backgroundColor: editColor }}
                />
                <h3 className="text-lg font-bold text-white">Edit Role: @{editingRole.name}</h3>
              </div>
              <button onClick={() => setEditingRole(null)} className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-[#18181b]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Basic Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                    Role Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-[#0d0d11] border border-[#27272a] focus:border-indigo-500 text-zinc-100 placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                    Role Color
                  </label>
                  <div className="flex items-center gap-3 bg-[#0d0d11] border border-[#27272a] p-2 rounded-xl">
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
                    />
                    <span className="font-mono text-sm text-zinc-200 font-bold uppercase">{editColor}</span>
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3.5 bg-[#0d0d11] border border-[#1f1f23] rounded-xl">
                  <span className="text-xs font-semibold text-zinc-200">Display separately (Hoist)</span>
                  <input
                    type="checkbox"
                    checked={editHoist}
                    onChange={(e) => setEditHoist(e.target.checked)}
                    className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between p-3.5 bg-[#0d0d11] border border-[#1f1f23] rounded-xl">
                  <span className="text-xs font-semibold text-zinc-200">Allow @mention</span>
                  <input
                    type="checkbox"
                    checked={editMentionable}
                    onChange={(e) => setEditMentionable(e.target.checked)}
                    className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Permission Bitfield Matrix */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-[#1f1f23] pb-2">
                  Permissions Matrix
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PERMISSION_FLAGS.map((perm) => {
                    const isEnabled = (editPermissionsBitfield & perm.flag) !== 0n;
                    return (
                      <div
                        key={perm.name}
                        onClick={() => togglePermissionFlag(perm.flag)}
                        className={`cursor-pointer p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                          isEnabled
                            ? "bg-indigo-500/10 border-indigo-500/40 text-white"
                            : "bg-[#0d0d11] border-[#1f1f23] text-zinc-400 hover:border-[#27272a]"
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold text-white">{perm.name}</p>
                          <p className="text-[11px] text-zinc-400 mt-0.5">{perm.desc}</p>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            isEnabled ? "bg-indigo-600 text-white" : "border border-[#27272a]"
                          }`}
                        >
                          {isEnabled && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1f1f23] sticky bottom-0 bg-[#0a0a0e] py-2">
                <button
                  type="button"
                  onClick={() => setEditingRole(null)}
                  className="px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-[#18181b] rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
