"use client";

import React from "react";
import { Shield, Users, Check } from "lucide-react";
import { TicketPanelData } from "@/types/ticketComponentTypes";
import { Role, Channel } from "./types";

interface PanelSettingsProps {
  panelData: TicketPanelData;
  setPanelData: React.Dispatch<React.SetStateAction<TicketPanelData>>;
  roles: Role[];
  categoryChannels: Channel[];
}

export function PanelSettings({
  panelData,
  setPanelData,
  roles,
  categoryChannels,
}: PanelSettingsProps) {
  return (
    <div className="space-y-5">
      {/* Supporter Roles */}
      <div className="p-4 rounded-xl bg-[#0e0f15] border border-[#27272a] space-y-3">
        <div>
          <label className="text-xs font-bold text-white flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-indigo-400" /> Supporter-Rollen (Zugriff & Erwähnungen)
          </label>
          <p className="text-[11px] text-zinc-400">
            Rollen, die vollen Zugriff auf die erstellten Ticket-Kanäle erhalten und bei Öffnung erwähnt werden.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {roles.map((r) => {
            const isSelected = panelData.supportRoles?.includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  const current: string[] = (panelData.supportRoles as any) || [];
                  const updated = isSelected ? current.filter((id: string) => id !== r.id) : [...current, r.id];
                  setPanelData({ ...panelData, supportRoles: updated });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-md border border-indigo-400/40"
                    : "bg-[#14151b] text-zinc-400 border border-[#27272a] hover:text-white"
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color || "#5865F2" }} />
                <span>{r.name}</span>
                {isSelected && <Check className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Allowed Roles to Open Tickets */}
      <div className="p-4 rounded-xl bg-[#0e0f15] border border-[#27272a] space-y-3">
        <div>
          <label className="text-xs font-bold text-white flex items-center gap-1.5">
            <Users className="w-4 h-4 text-indigo-400" /> Berechtigte Rollen (Panel-Zugriff)
          </label>
          <p className="text-[11px] text-zinc-400">
            Falls leer gelassen, dürfen alle Server-Mitglieder Tickets über dieses Panel erstellen.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {roles.map((r) => {
            const isSelected = panelData.allowedRoles?.includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  const current: string[] = (panelData.allowedRoles as any) || [];
                  const updated = isSelected ? current.filter((id: string) => id !== r.id) : [...current, r.id];
                  setPanelData({ ...panelData, allowedRoles: updated });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? "bg-emerald-600 text-white shadow-md border border-emerald-400/40"
                    : "bg-[#14151b] text-zinc-400 border border-[#27272a] hover:text-white"
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color || "#5865F2" }} />
                <span>{r.name}</span>
                {isSelected && <Check className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Limits & Fallback Category */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-[#0e0f15] border border-[#27272a] space-y-2">
          <label className="text-xs font-bold text-zinc-300 block">Max. offene Tickets pro User</label>
          <input
            type="number"
            min={1}
            max={10}
            value={panelData.maxOpenTickets || 1}
            onChange={(e) => setPanelData({ ...panelData, maxOpenTickets: Number(e.target.value) })}
            className="w-full bg-[#14151b] border border-[#27272a] p-2 rounded-lg text-xs text-white outline-none"
          />
        </div>

        <div className="p-4 rounded-xl bg-[#0e0f15] border border-[#27272a] space-y-2">
          <label className="text-xs font-bold text-zinc-300 block">Standard-Kategorie</label>
          <select
            value={panelData.categoryId || ""}
            onChange={(e) => setPanelData({ ...panelData, categoryId: e.target.value })}
            className="w-full bg-[#14151b] border border-[#27272a] p-2 rounded-lg text-xs text-white outline-none"
          >
            <option value="">-- Keine Standard-Kategorie --</option>
            {categoryChannels.map((c) => (
              <option key={c.id} value={c.id}>
                📁 {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
