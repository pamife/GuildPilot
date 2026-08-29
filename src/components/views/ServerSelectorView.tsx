"use client";

import React from "react";
import {
  ShieldCheck,
  Server,
  Users,
  PlusCircle,
  LogOut,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Crown,
  Activity,
  ArrowUpRight,
  Shield,
} from "lucide-react";

interface GuildOption {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
}

interface ServerSelectorViewProps {
  user: {
    id: string;
    username: string;
    avatar: string | null;
    role: "OWNER" | "USER";
  };
  isOwner: boolean;
  guilds: GuildOption[];
  onSelectGuild: (guildId: string) => void;
  onOpenOwnerDashboard: () => void;
  onLogout: () => void;
}

export function ServerSelectorView({
  user,
  isOwner,
  guilds,
  onSelectGuild,
  onOpenOwnerDashboard,
  onLogout,
}: ServerSelectorViewProps) {
  // Discord Bot Invite Link (Exakte Berechtigungen ohne Administrator-Flag: 1616413846775)
  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || "1533187416230461490";
  const botInviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=1616413846775&scope=bot%20applications.commands`;


  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative">
      {/* Background Decorative Gradients */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[1000px] h-[450px] bg-gradient-to-b from-indigo-600/10 via-purple-600/5 to-transparent blur-3xl pointer-events-none -z-10 rounded-full" />

      {/* Header Bar */}
      <header className="border-b border-[#141b2b] bg-[#090d15]/90 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-600/30 text-white border border-indigo-400/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                GuildPilot
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Pro
                </span>
              </span>
            </div>
          </div>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#101726] border border-[#1b263d]">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.username}
                  className="w-7 h-7 rounded-lg object-cover border border-indigo-500/30"
                />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-200">
                  {user.username.substring(0, 1).toUpperCase()}
                </div>
              )}
              <div className="text-left">
                <p className="text-xs font-semibold text-white leading-none">{user.username}</p>
                <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                  {isOwner ? (
                    <span className="text-amber-400 font-bold flex items-center gap-0.5">
                      <Crown className="w-2.5 h-2.5" /> Global Owner
                    </span>
                  ) : (
                    <span>Verifizierter Benutzer</span>
                  )}
                </p>
              </div>
            </div>

            <button
              onClick={onLogout}
              title="Abmelden"
              className="p-2 rounded-xl bg-[#101726] hover:bg-rose-500/15 border border-[#1b263d] hover:border-rose-500/30 text-slate-400 hover:text-rose-300 transition-all shadow-sm"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-10 flex-1 w-full space-y-8">
        {/* Owner Special Banner */}
        {isOwner && (
          <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-indigo-950/40 to-[#0d121f] border border-amber-500/30 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center shadow-inner shrink-0">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Owner Control Center
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                    Exklusiv
                  </span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Überwache Host-Telemetrie (CPU, RAM, Disk), globale Bot-Prozesse, Systemprotokolle und Updates.
                </p>
              </div>
            </div>

            <button
              onClick={onOpenOwnerDashboard}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0"
            >
              <Activity className="w-4 h-4" />
              <span>Owner Dashboard öffnen</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#141b2b] pb-5">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <span>Deine Server</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                {guilds.length} verfügbar
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Wähle einen Discord-Server aus, um Module, Tickets, Rollen und Begrüßungen zu verwalten.
            </p>
          </div>

          <a
            href={botInviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#111726] hover:bg-[#18233a] border border-[#1f2c44] hover:border-indigo-500/40 text-xs font-semibold text-indigo-300 hover:text-white transition-all shadow-sm shrink-0"
          >
            <PlusCircle className="w-4 h-4 text-indigo-400" />
            <span>Bot zu neuem Server hinzufügen</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        </div>

        {/* Guilds Grid */}
        {guilds.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[#0b0f1a] border border-[#172033] space-y-4 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Keine berechtigten Server gefunden</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Du besitzt aktuell auf keinem Server mit GuildPilot 'Server verwalten'- oder Administrator-Rechte.
              </p>
            </div>
            <a
              href={botInviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>GuildPilot einladen</span>
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {guilds.map((guild) => (
              <div
                key={guild.id}
                onClick={() => onSelectGuild(guild.id)}
                className="p-5 rounded-2xl bg-[#0c101a] border border-[#172033] hover:border-indigo-500/50 hover:bg-[#0f1626] transition-all cursor-pointer group shadow-sm flex flex-col justify-between h-48 relative overflow-hidden"
              >
                {/* Glow Effect */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 rounded-full blur-2xl group-hover:bg-indigo-600/15 transition-all -z-0" />

                <div className="flex items-start gap-3.5 z-10">
                  {guild.icon ? (
                    <img
                      src={guild.icon}
                      alt={guild.name}
                      className="w-12 h-12 rounded-xl object-cover border border-[#212d45] shadow-md shrink-0 group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600/30 to-purple-600/20 border border-indigo-500/40 flex items-center justify-center font-bold text-indigo-200 text-sm shadow-md shrink-0">
                      {guild.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div className="overflow-hidden">
                    <h3 className="text-sm font-bold text-white truncate group-hover:text-indigo-200 transition-colors">
                      {guild.name}
                    </h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{guild.memberCount.toLocaleString("de-DE")} Mitglieder</span>
                    </p>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="pt-3 border-t border-[#141d2f] flex items-center justify-between z-10">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Verbunden</span>
                  </div>

                  <span className="flex items-center gap-1 text-xs font-semibold text-indigo-400 group-hover:text-indigo-300 group-hover:translate-x-1 transition-all">
                    <span>Verwalten</span>
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            ))}

            {/* Invite New Server Card */}
            <a
              href={botInviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-5 rounded-2xl border-2 border-dashed border-[#1a253b] hover:border-indigo-500/50 bg-[#090d15]/50 hover:bg-[#0d1322]/60 transition-all flex flex-col items-center justify-center text-center h-48 group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-[#121929] border border-[#1e2a44] group-hover:border-indigo-500/50 flex items-center justify-center text-slate-400 group-hover:text-indigo-300 group-hover:scale-110 transition-all shadow-inner">
                <PlusCircle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-200 group-hover:text-white mt-3 transition-colors">
                Neuen Server verbinden
              </h3>
              <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
                Lade den GuildPilot Bot mit Administrator-Rechten ein
              </p>
            </a>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#121824] py-6 text-center text-xs text-slate-400">
        <p>GuildPilot Multi-User Architecture • Host auf Localhost • Zero-Trust Tunnel Ready</p>
      </footer>
    </div>
  );
}
