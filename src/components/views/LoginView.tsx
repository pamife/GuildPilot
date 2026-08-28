"use client";

import React from "react";
import { getApiBaseUrl } from "@/lib/api";
import {
  ShieldCheck,
  LogIn,
  Ticket,
  ClipboardList,
  Sparkles,
  Archive,
  Lock,
  ArrowRight,
  Bot,
  Zap,
} from "lucide-react";

interface LoginViewProps {
  authWarning?: string | null;
  authError?: string | null;
}

export function LoginView({ authWarning, authError }: LoginViewProps) {
  const loginUrl = `${getApiBaseUrl()}/api/auth/login`;

  const features = [
    {
      icon: Ticket,
      title: "Support- & Ticket-System",
      description: "Interaktive Ticket-Panels, Kategorien, Rollen-Zuweisung und HTML-Transkripte.",
      color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    },
    {
      icon: ClipboardList,
      title: "Bewerbungs-Zentrale",
      description: "Eigene Formulare, DM-Intake, Live-Reviewer-Status und automatische Rollenvergabe.",
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    },
    {
      icon: Sparkles,
      title: "Community & Self-Roles",
      description: "Automatische Willkommens-Karten, Reaction-Roles und Keyword-Auto-React.",
      color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    },
    {
      icon: Archive,
      title: "Server-Sicherungen",
      description: "Vollständige Snapshots von Kanälen, Rollen und Berechtigungen mit 1-Klick Restore.",
      color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    },
  ];

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Background Decorative Gradients */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent blur-3xl pointer-events-none -z-10 rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[400px] bg-indigo-600/10 blur-3xl pointer-events-none -z-10 rounded-full" />

      {/* Top Navbar */}
      <header className="border-b border-[#141b2b] bg-[#090d15]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-600/30 text-white border border-indigo-400/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                GuildPilot
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Dashboard
                </span>
              </span>
            </div>
          </div>

          <a
            href={loginUrl}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-[#141d2f] hover:bg-[#1a263d] border border-[#212f4d] text-slate-200 hover:text-white transition-all shadow-sm group"
          >
            <LogIn className="w-3.5 h-3.5 text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
            <span>Login</span>
          </a>
        </div>
      </header>

      {/* Main Content Hero */}
      <main className="max-w-5xl mx-auto px-6 py-12 flex-1 flex flex-col justify-center items-center text-center">
        {/* Error / Warning Badges */}
        {authError && (
          <div className="mb-6 px-4 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium max-w-md animate-in fade-in duration-200">
            {authError === "oauth_failed"
              ? "Discord-Login fehlgeschlagen. Bitte versuche es erneut."
              : authError}
          </div>
        )}

        {authWarning && (
          <div className="mb-6 px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium max-w-md animate-in fade-in duration-200">
            Discord OAuth Zugangsdaten in .env fehlen oder sind unvollständig.
          </div>
        )}

        {/* Hero Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#111726] border border-[#1e2a42] text-slate-300 text-xs font-medium mb-6 shadow-inner">
          <Zap className="w-3.5 h-3.5 text-indigo-400" />
          <span>Multi-User Discord Management Engine</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white max-w-3xl leading-[1.15]">
          Manage deine Discord-Server mit{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-indigo-200 to-purple-400">
            GuildPilot
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-5 text-sm sm:text-base text-slate-400 max-w-2xl leading-relaxed">
          Zentrales Web-Dashboard für deine Community: Verwalte Kanäle, Rollen, Ticket-Systeme,
          Bewerbungs-Center und automatische Backups in Echtzeit.
        </p>

        {/* CTA Login Button */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 w-full justify-center max-w-md">
          <a
            href={loginUrl}
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:scale-[1.02] active:scale-[0.98] transition-all group"
          >
            <Bot className="w-5 h-5 text-indigo-200" />
            <span>Mit Discord anmelden</span>
            <ArrowRight className="w-4 h-4 text-indigo-200 group-hover:translate-x-1 transition-transform" />
          </a>
        </div>

        {/* Security Trust Note */}
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <Lock className="w-3.5 h-3.5 text-slate-400" />
          <span>Sichere OAuth2-Authentifizierung • Keine Bot-Secrets im Frontend</span>
        </div>

        {/* Features Showcase Grid */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full text-left">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-[#0c101a] border border-[#172033] hover:border-indigo-500/40 transition-all hover:bg-[#0f1524] group"
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl border ${feat.color} shrink-0`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-indigo-200 transition-colors">
                      {feat.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {feat.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#121824] py-6 text-center text-xs text-slate-400">
        <p>GuildPilot Pro Dashboard • Entwickelt für Discord Server Management</p>
      </footer>
    </div>
  );
}
