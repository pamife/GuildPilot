"use client";

import React from "react";
import { Users, Hash, Shield, Smile, Link, Radio, Cpu, RefreshCw } from "lucide-react";

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
      <div className="relative rounded-xl bg-gradient-to-r from-[#2b2d31] to-[#1e1f22] border border-[#35373c] overflow-hidden p-6 shadow-lg">
        {banner && (
          <img src={banner} alt="Banner" className="absolute inset-0 w-full h-full object-cover opacity-20" />
        )}
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {icon ? (
              <img src={icon} alt={name} className="w-16 h-16 rounded-2xl object-cover ring-4 ring-discord-dark" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-discord-brand flex items-center justify-center font-bold text-white text-2xl ring-4 ring-discord-dark shadow-md">
                {name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-discord-header">{name}</h1>
              <p className="text-sm text-discord-muted mt-1 max-w-xl">
                {description || "No description configured for this Discord server."}
              </p>
            </div>
          </div>
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#35373c] hover:bg-discord-brand text-discord-header text-sm font-medium transition-colors shadow"
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
              className={`cursor-pointer bg-gradient-to-br ${card.color} backdrop-blur-sm border rounded-xl p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-xl`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-discord-muted">{card.label}</span>
                <Icon className="w-5 h-5 text-discord-header opacity-80" />
              </div>
              <p className="text-3xl font-extrabold text-white mt-3 font-mono">{card.count}</p>
            </div>
          );
        })}
      </div>

      {/* Channel Breakdown & Bot Status Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Channel Type Breakdown */}
        <div className="lg:col-span-2 bg-[#2b2d31] border border-[#35373c] rounded-xl p-5 shadow">
          <h3 className="text-base font-semibold text-discord-header mb-4 flex items-center gap-2">
            <Hash className="w-5 h-5 text-discord-brand" />
            Channel Architecture Breakdown
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 bg-[#1e1f22] rounded-lg border border-[#35373c]/50">
              <p className="text-xs text-discord-muted">Text Channels</p>
              <p className="text-xl font-bold text-discord-header mt-1">{counts?.textChannels || 0}</p>
            </div>
            <div className="p-3 bg-[#1e1f22] rounded-lg border border-[#35373c]/50">
              <p className="text-xs text-discord-muted">Voice Channels</p>
              <p className="text-xl font-bold text-discord-header mt-1">{counts?.voiceChannels || 0}</p>
            </div>
            <div className="p-3 bg-[#1e1f22] rounded-lg border border-[#35373c]/50">
              <p className="text-xs text-discord-muted">Categories</p>
              <p className="text-xl font-bold text-discord-header mt-1">{counts?.categoryChannels || 0}</p>
            </div>
            <div className="p-3 bg-[#1e1f22] rounded-lg border border-[#35373c]/50">
              <p className="text-xs text-discord-muted">Forum Channels</p>
              <p className="text-xl font-bold text-discord-header mt-1">{counts?.forumChannels || 0}</p>
            </div>
          </div>
        </div>

        {/* Bot Local Diagnostics */}
        <div className="bg-[#2b2d31] border border-[#35373c] rounded-xl p-5 shadow space-y-4">
          <h3 className="text-base font-semibold text-discord-header flex items-center gap-2">
            <Cpu className="w-5 h-5 text-discord-green" />
            Bot Runtime Diagnostics
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between p-2.5 bg-[#1e1f22] rounded-lg">
              <span className="text-discord-muted">Connection Status</span>
              <span className="flex items-center gap-1.5 font-semibold text-discord-green">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                {botStatus?.ready ? "Connected" : "Disconnected"}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-[#1e1f22] rounded-lg">
              <span className="text-discord-muted">Gateway Latency</span>
              <span className="font-mono font-medium text-discord-header">{botStatus?.ping || 0} ms</span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-[#1e1f22] rounded-lg">
              <span className="text-discord-muted">Mode</span>
              <span className="font-semibold text-discord-brand">Local-Only (Single Owner)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
