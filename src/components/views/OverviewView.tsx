"use client";

import React, { useState } from "react";
import {
  Users,
  Hash,
  Shield,
  SmilePlus,
  Link2,
  Radio,
  Cpu,
  RefreshCw,
  Sparkles,
  ArrowRight,
  MessageSquareText,
  Tag,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  HelpCircle,
  Activity,
  Server,
  Layers,
  Volume2,
  FolderTree,
  MessagesSquare,
} from "lucide-react";

interface OverviewProps {
  guildDetails: any;
  onRefresh: () => void;
  onNavigate: (view: any) => void;
}

export function OverviewView({ guildDetails, onRefresh, onNavigate }: OverviewProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [showTip, setShowTip] = useState(true);

  if (!guildDetails) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 text-indigo-400">
          <RefreshCw className="w-6 h-6 animate-spin" />
        </div>
        <h2 className="text-lg font-semibold text-white">Lade Server-Übersicht...</h2>
        <p className="text-xs text-slate-400 mt-1">Metriken und Konfiguration werden synchronisiert</p>
      </div>
    );
  }

  const { id: guildId, name, icon, banner, description, memberCount, counts, botStatus } = guildDetails;

  const handleRefreshClick = () => {
    setIsRefreshing(true);
    onRefresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleCopyServerId = () => {
    if (guildId) {
      navigator.clipboard.writeText(guildId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  // Channel metrics
  const textChannels = counts?.textChannels || 0;
  const voiceChannels = counts?.voiceChannels || 0;
  const categoryChannels = counts?.categoryChannels || 0;
  const forumChannels = counts?.forumChannels || 0;
  const totalChannels = counts?.channels || (textChannels + voiceChannels + categoryChannels + forumChannels);

  // SVG Donut calculation
  const safeTotal = Math.max(1, textChannels + voiceChannels + categoryChannels + forumChannels);
  const textPct = (textChannels / safeTotal) * 100;
  const voicePct = (voiceChannels / safeTotal) * 100;
  const catPct = (categoryChannels / safeTotal) * 100;
  const forumPct = (forumChannels / safeTotal) * 100;

  // Circumference for r=38 is 2 * PI * 38 = 238.76
  const circ = 238.76;
  const textOffset = 0;
  const voiceOffset = (textPct / 100) * circ;
  const catOffset = ((textPct + voicePct) / 100) * circ;
  const forumOffset = ((textPct + voicePct + catPct) / 100) * circ;

  const statCards = [
    {
      label: "Mitglieder",
      sublabel: "Community & Bots",
      count: memberCount || 0,
      icon: Users,
      color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
      view: "members",
    },
    {
      label: "Kanäle",
      sublabel: "Text, Voice & Foren",
      count: totalChannels,
      icon: Hash,
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      view: "channels",
    },
    {
      label: "Rollen & Rechte",
      sublabel: "Berechtigungsstufen",
      count: counts?.roles || 0,
      icon: Shield,
      color: "text-violet-400 bg-violet-500/10 border-violet-500/20",
      view: "roles",
    },
    {
      label: "Emojis & Sticker",
      sublabel: "Benutzerdefinierte Assets",
      count: (counts?.emojis || 0) + (counts?.stickers || 0),
      icon: SmilePlus,
      color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      view: "emojis",
    },
    {
      label: "Aktive Einladungen",
      sublabel: "Tracking & Verweise",
      count: counts?.invites || 0,
      icon: Link2,
      color: "text-sky-400 bg-sky-500/10 border-sky-500/20",
      view: "invites",
    },
  ];

  const quickActions = [
    {
      title: "Willkommen & Abschied",
      description: "Begrüßungskarten mit individuellen Grafiken und Auto-Rollen.",
      icon: Sparkles,
      iconColor: "text-indigo-400 bg-indigo-500/10",
      buttonText: "Konfigurieren",
      view: "welcome",
      badge: "Empfohlen",
    },
    {
      title: "Automatische Reaktionen",
      description: "Automatische Emoji-Reaktionen auf vordefinierte Stichwörter.",
      icon: SmilePlus,
      iconColor: "text-amber-400 bg-amber-500/10",
      buttonText: "Regeln anpassen",
      view: "auto-react",
    },
    {
      title: "Nachrichten & Embeds",
      description: "Professionelle Rich-Embeds, Regelwerke und Ankündigungen verfassen.",
      icon: MessageSquareText,
      iconColor: "text-emerald-400 bg-emerald-500/10",
      buttonText: "Nachricht erstellen",
      view: "custom-messages",
    },
    {
      title: "Rollen-Zuweisung (Self-Roles)",
      description: "Interaktive Button- und Dropdown-Panels für Benutzer zur Rollenwahl.",
      icon: Tag,
      iconColor: "text-violet-400 bg-violet-500/10",
      buttonText: "Panel öffnen",
      view: "self-roles",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-[#0b0f17] text-slate-200">
      {/* Onboarding Tip / Help Banner */}
      {showTip && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/50 via-slate-900/60 to-slate-900/60 border border-indigo-500/30 flex items-center justify-between gap-4 shadow-sm backdrop-blur-sm animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white flex items-center gap-2">
                Willkommen bei GuildPilot Pro
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-normal">
                  Tipp
                </span>
              </p>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Richte als Erstes deine Willkommensnachrichten ein oder sichere deinen Server mit einem automatischen Backup.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onNavigate("welcome")}
              className="text-xs font-semibold text-indigo-300 hover:text-white px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 transition-all"
            >
              Jetzt starten
            </button>
            <button
              onClick={() => setShowTip(false)}
              className="text-xs text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              title="Ausblenden"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Hero Header Card */}
      <div className="bg-[#111724] border border-[#1e293b] rounded-2xl p-6 relative overflow-hidden shadow-xl">
        {banner && (
          <div className="absolute inset-0 z-0">
            <img src={banner} alt="" className="w-full h-full object-cover opacity-10 blur-sm scale-105" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#111724] via-[#111724]/90 to-[#111724]/70" />
          </div>
        )}

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            {icon ? (
              <img
                src={icon}
                alt={name}
                className="w-16 h-16 rounded-2xl object-cover ring-2 ring-indigo-500/30 shadow-lg shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center font-bold text-white text-2xl shadow-lg ring-2 ring-indigo-500/30 shrink-0">
                {name ? name.substring(0, 2).toUpperCase() : "GP"}
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-white tracking-tight">{name}</h1>
                <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verifiziert & Verwaltet
                </span>
              </div>

              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <p className="text-xs text-slate-300 max-w-xl line-clamp-1">
                  {description || "Keine Serverbeschreibung hinterlegt. In den Server-Einstellungen anpassbar."}
                </p>

                {guildId && (
                  <button
                    onClick={handleCopyServerId}
                    className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 hover:text-slate-200 bg-[#0d121c] border border-[#1e293b] px-2 py-0.5 rounded-md transition-colors"
                    title="Server-ID kopieren"
                  >
                    {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>ID: {guildId}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action Button Bar */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleRefreshClick}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-xs font-semibold transition-all shadow-md shadow-indigo-600/25 cursor-pointer disabled:opacity-75"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{isRefreshing ? "Wird aktualisiert..." : "Statistiken aktualisieren"}</span>
            </button>

            <button
              onClick={() => onNavigate("settings")}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#172033] hover:bg-[#1f2c45] border border-[#243350] text-slate-200 hover:text-white text-xs font-semibold transition-all shadow-sm"
              title="Server-Einstellungen bearbeiten"
            >
              Einstellungen
            </button>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              onClick={() => onNavigate(card.view)}
              className="group cursor-pointer bg-[#111724] border border-[#1e293b] hover:border-indigo-500/40 rounded-2xl p-4 md:p-5 transition-all duration-200 hover:-translate-y-0.5 shadow-sm hover:shadow-md hover:shadow-indigo-500/5 relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                    {card.label}
                  </span>
                  <span className="text-[10px] text-slate-400">{card.sublabel}</span>
                </div>
                <div className={`p-2.5 rounded-xl ${card.color} group-hover:scale-105 transition-transform`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <p className="text-2xl md:text-3xl font-extrabold text-white tracking-tight font-mono">
                  {card.count.toLocaleString("de-DE")}
                </p>
                <span className="text-[11px] text-slate-400 group-hover:text-indigo-400 transition-colors flex items-center gap-0.5">
                  Verwalten
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Action Tasks Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            Häufige Aufgaben & Schnellaktionen
          </h2>
          <span className="text-xs text-slate-400">Direkter Zugriff auf Kernfunktionen</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, idx) => {
            const Icon = action.icon;
            return (
              <div
                key={idx}
                className="bg-[#111724] border border-[#1e293b] hover:border-[#2b3a54] rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2.5 rounded-xl ${action.iconColor}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    {action.badge && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        {action.badge}
                      </span>
                    )}
                  </div>

                  <h3 className="text-xs font-bold text-white mb-1">{action.title}</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-4">{action.description}</p>
                </div>

                <button
                  onClick={() => onNavigate(action.view)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#172033] hover:bg-indigo-600 hover:text-white text-slate-200 text-xs font-semibold transition-all border border-[#243350] hover:border-indigo-500 shadow-sm group"
                >
                  <span>{action.buttonText}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform text-slate-400 group-hover:text-white" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Channel Breakdown & Bot Runtime Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visual Channel Architecture Breakdown with Donut Chart */}
        <div className="lg:col-span-2 bg-[#111724] border border-[#1e293b] rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                <Layers className="w-4 h-4" />
              </div>
              Kanalarchitektur & Server-Struktur
            </h3>
            <span className="text-xs text-slate-400 font-medium">{totalChannels} Kanäle Gesamt</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
            {/* Visual SVG Donut Chart */}
            <div className="flex flex-col items-center justify-center p-4 bg-[#0d121c] rounded-xl border border-[#1a2333]">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                  {/* Background Track */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    className="stroke-[#1a2333]"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  {/* Text Channels Segment (Indigo) */}
                  {textChannels > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      stroke="#6366f1"
                      strokeWidth="10"
                      strokeDasharray={`${(textPct / 100) * circ} ${circ}`}
                      strokeDashoffset={`-${textOffset}`}
                      fill="transparent"
                      strokeLinecap="round"
                    />
                  )}
                  {/* Voice Channels Segment (Emerald) */}
                  {voiceChannels > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      stroke="#10b981"
                      strokeWidth="10"
                      strokeDasharray={`${(voicePct / 100) * circ} ${circ}`}
                      strokeDashoffset={`-${voiceOffset}`}
                      fill="transparent"
                      strokeLinecap="round"
                    />
                  )}
                  {/* Categories Segment (Amber) */}
                  {categoryChannels > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      stroke="#f59e0b"
                      strokeWidth="10"
                      strokeDasharray={`${(catPct / 100) * circ} ${circ}`}
                      strokeDashoffset={`-${catOffset}`}
                      fill="transparent"
                      strokeLinecap="round"
                    />
                  )}
                  {/* Forum Channels Segment (Sky) */}
                  {forumChannels > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      stroke="#0ea5e9"
                      strokeWidth="10"
                      strokeDasharray={`${(forumPct / 100) * circ} ${circ}`}
                      strokeDashoffset={`-${forumOffset}`}
                      fill="transparent"
                      strokeLinecap="round"
                    />
                  )}
                </svg>

                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-bold font-mono text-white">{totalChannels}</span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">Kanäle</span>
                </div>
              </div>
            </div>

            {/* Metric Breakdown Badges */}
            <div className="sm:col-span-2 grid grid-cols-2 gap-3">
              <div
                onClick={() => onNavigate("channels")}
                className="p-3.5 bg-[#0d121c] rounded-xl border border-[#1a2333] hover:border-indigo-500/40 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <span className="text-xs font-semibold text-slate-300">Textkanäle</span>
                </div>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-xl font-bold text-white font-mono">{textChannels}</span>
                  <span className="text-[11px] text-slate-400">{Math.round(textPct)}% Anteil</span>
                </div>
              </div>

              <div
                onClick={() => onNavigate("channels")}
                className="p-3.5 bg-[#0d121c] rounded-xl border border-[#1a2333] hover:border-emerald-500/40 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-slate-300">Sprachkanäle</span>
                </div>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-xl font-bold text-white font-mono">{voiceChannels}</span>
                  <span className="text-[11px] text-slate-400">{Math.round(voicePct)}% Anteil</span>
                </div>
              </div>

              <div
                onClick={() => onNavigate("categories")}
                className="p-3.5 bg-[#0d121c] rounded-xl border border-[#1a2333] hover:border-amber-500/40 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-xs font-semibold text-slate-300">Kategorien</span>
                </div>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-xl font-bold text-white font-mono">{categoryChannels}</span>
                  <span className="text-[11px] text-slate-400">{Math.round(catPct)}% Anteil</span>
                </div>
              </div>

              <div
                onClick={() => onNavigate("channels")}
                className="p-3.5 bg-[#0d121c] rounded-xl border border-[#1a2333] hover:border-sky-500/40 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                  <span className="text-xs font-semibold text-slate-300">Foren & Spezial</span>
                </div>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-xl font-bold text-white font-mono">{forumChannels}</span>
                  <span className="text-[11px] text-slate-400">{Math.round(forumPct)}% Anteil</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bot Runtime Diagnostics Card */}
        <div className="bg-[#111724] border border-[#1e293b] rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Activity className="w-4 h-4" />
              </div>
              Bot-Laufzeit-Diagnose
            </h3>
            <span
              className={`w-2 h-2 rounded-full ${
                botStatus?.ready ? "bg-emerald-400 animate-pulse" : "bg-rose-500"
              }`}
            />
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-3 bg-[#0d121c] rounded-xl border border-[#1a2333]">
              <span className="text-slate-400">Verbindungsstatus</span>
              <span
                className={`flex items-center gap-1.5 font-semibold px-2 py-0.5 rounded-full border text-[11px] ${
                  botStatus?.ready
                    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                    : "text-rose-400 bg-rose-500/10 border-rose-500/20"
                }`}
              >
                <Radio className={`w-3 h-3 ${botStatus?.ready ? "animate-pulse" : ""}`} />
                {botStatus?.ready ? "Online & Synchronisiert" : "Getrennt"}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#0d121c] rounded-xl border border-[#1a2333]">
              <span className="text-slate-400">Gateway-Latenz</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-white">{botStatus?.ping || 0} ms</span>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-medium">
                  Optimal
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#0d121c] rounded-xl border border-[#1a2333]">
              <span className="text-slate-400">Betriebsmodus</span>
              <span className="font-semibold text-indigo-300 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[11px]">
                Lokaler Bot (Eigentümer)
              </span>
            </div>

            <div className="p-3 bg-[#0d121c] rounded-xl border border-[#1a2333] flex items-center justify-between">
              <span className="text-slate-400">Host-System</span>
              <button
                onClick={() => onNavigate("host-server")}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 hover:underline"
              >
                Systemstatus öffnen
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

