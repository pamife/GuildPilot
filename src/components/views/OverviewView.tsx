"use client";

import React from "react";
import { Users, Hash, Shield, Smile, Link, Radio, Cpu, RefreshCw, Sparkles } from "lucide-react";

interface OverviewProps {
  guildDetails: any;
  onRefresh: () => void;
  onNavigate: (view: any) => void;
}

export function OverviewView({ guildDetails, onRefresh, onNavigate }: OverviewProps) {
  if (!guildDetails) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-discord-muted">
        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-discord-brand" />
        <p className="text-base font-medium text-discord-header">Loading Server Overview...</p>
      </div>
    );
  }

  const { name, icon, banner, description, memberCount, counts, botStatus } = guildDetails;

  const statCards = [
    { label: "Members", count: memberCount, icon: Users, color: "from-blue-500/20 to-indigo-500/10 border-blue-500/30", view: "overview" },
    { label: "Channels", count: counts?.channels || 0, icon: Hash, color: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30", view: "channels" },
    { label: "Roles", count: counts?.roles || 0, icon: Shield, color: "from-purple-500/20 to-pink-500/10 border-purple-500/30", view: "roles" },
    { label: "Emojis & Stickers", count: (counts?.emojis || 0) + (counts?.stickers || 0), icon: Smile, color: "from-amber-500/20 to-orange-500/10 border-amber-500/30", view: "emojis" },
    { label: "Active Invites", count: counts?.invites || 0, icon: Link, color: "from-sky-500/20 to-cyan-500/10 border-sky-500/30", view: "invites" },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header Banner Card */}
      <div className="bg-[#09090b]/80 border border-[#1f1f23] rounded-2xl p-6 relative overflow-hidden backdrop-blur-xl shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 pointer-events-none" />
        {banner && (
          <img src={banner} alt="Banner" className="absolute inset-0 w-full h-full object-cover opacity-15" />
        )}
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {icon ? (
              <img src={icon} alt={name} className="w-16 h-16 rounded-2xl object-cover ring-2 ring-indigo-500/30 shadow-lg" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-white text-2xl shadow-lg ring-2 ring-indigo-500/30">
                {name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">{name}</h1>
              <p className="text-sm text-zinc-400 mt-1 max-w-xl">
                {description || "No description configured for this Discord server."}
              </p>
            </div>
          </div>
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Stats
          </button>
        </div>
      </div>

      {/* Stats Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              onClick={() => onNavigate(card.view)}
              className="cursor-pointer bg-[#09090b] border border-[#1f1f23] hover:border-indigo-500/40 rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5 shadow-lg group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-500/10 to-transparent rounded-bl-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{card.label}</span>
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-white mt-3 font-mono tracking-tight">{card.count}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Action Navigation Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigate("welcome")}
          className="cursor-pointer bg-[#09090b] border border-[#1f1f23] hover:border-cyan-500/40 rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 shadow-lg group flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white group-hover:text-cyan-400 transition-colors">
                Welcome & Goodbyes
              </p>
              <p className="text-[11px] text-zinc-400">Image greeting cards & autoroles</p>
            </div>
          </div>
          <span className="text-xs text-cyan-400 font-bold">Open &rarr;</span>
        </div>

        <div
          onClick={() => onNavigate("auto-react")}
          className="cursor-pointer bg-[#09090b] border border-[#1f1f23] hover:border-amber-500/40 rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 shadow-lg group flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
              <Smile className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                Auto Emojis & Reactions
              </p>
              <p className="text-[11px] text-zinc-400">Automated reactions in channels</p>
            </div>
          </div>
          <span className="text-xs text-amber-400 font-bold">Open &rarr;</span>
        </div>

        <div
          onClick={() => onNavigate("custom-messages")}
          className="cursor-pointer bg-[#09090b] border border-[#1f1f23] hover:border-indigo-500/40 rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 shadow-lg group flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors">
                Custom Messages & V2
              </p>
              <p className="text-[11px] text-zinc-400">Rich embeds & components</p>
            </div>
          </div>
          <span className="text-xs text-indigo-400 font-bold">Open &rarr;</span>
        </div>

        <div
          onClick={() => onNavigate("self-roles")}
          className="cursor-pointer bg-[#09090b] border border-[#1f1f23] hover:border-purple-500/40 rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 shadow-lg group flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors">
                Self Roles Panels
              </p>
              <p className="text-[11px] text-zinc-400">Button & dropdown role assign</p>
            </div>
          </div>
          <span className="text-xs text-purple-400 font-bold">Open &rarr;</span>
        </div>
      </div>

      {/* Channel Breakdown & Bot Status Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Channel Type Breakdown */}
        <div className="lg:col-span-2 bg-[#09090b] border border-[#1f1f23] rounded-2xl p-6 shadow-lg">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Hash className="w-5 h-5" />
            </div>
            Channel Architecture Breakdown
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-[#0d0d11] rounded-xl border border-[#1f1f23]">
              <p className="text-xs text-zinc-400 font-medium">Text Channels</p>
              <p className="text-2xl font-bold text-white mt-1 font-mono">{counts?.textChannels || 0}</p>
            </div>
            <div className="p-4 bg-[#0d0d11] rounded-xl border border-[#1f1f23]">
              <p className="text-xs text-zinc-400 font-medium">Voice Channels</p>
              <p className="text-2xl font-bold text-white mt-1 font-mono">{counts?.voiceChannels || 0}</p>
            </div>
            <div className="p-4 bg-[#0d0d11] rounded-xl border border-[#1f1f23]">
              <p className="text-xs text-zinc-400 font-medium">Categories</p>
              <p className="text-2xl font-bold text-white mt-1 font-mono">{counts?.categoryChannels || 0}</p>
            </div>
            <div className="p-4 bg-[#0d0d11] rounded-xl border border-[#1f1f23]">
              <p className="text-xs text-zinc-400 font-medium">Forum Channels</p>
              <p className="text-2xl font-bold text-white mt-1 font-mono">{counts?.forumChannels || 0}</p>
            </div>
          </div>
        </div>

        {/* Bot Local Diagnostics */}
        <div className="bg-[#09090b] border border-[#1f1f23] rounded-2xl p-6 shadow-lg space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Cpu className="w-5 h-5" />
            </div>
            Bot Runtime Diagnostics
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between p-3 bg-[#0d0d11] rounded-xl border border-[#1f1f23]">
              <span className="text-zinc-400">Connection Status</span>
              <span className="flex items-center gap-1.5 font-semibold text-emerald-400 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                {botStatus?.ready ? "Connected" : "Disconnected"}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#0d0d11] rounded-xl border border-[#1f1f23]">
              <span className="text-zinc-400">Gateway Latency</span>
              <span className="font-mono font-bold text-white">{botStatus?.ping || 0} ms</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#0d0d11] rounded-xl border border-[#1f1f23]">
              <span className="text-zinc-400">Mode</span>
              <span className="font-semibold text-indigo-400 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs">Local-Only (Owner)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
