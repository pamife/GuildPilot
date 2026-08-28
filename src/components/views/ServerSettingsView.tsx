"use client";

import React, { useState, useEffect } from "react";
import { Settings, Save, ShieldAlert, Bell, Clock, RefreshCw } from "lucide-react";
import { useToast } from "../ToastContainer";

interface ServerSettingsProps {
  guildDetails: any;
  channels: any[];
  onSaveSettings: (settings: any) => Promise<void>;
}

export function ServerSettingsView({ guildDetails, channels, onSaveSettings }: ServerSettingsProps) {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [description, setDescription] = useState("");
  const [verificationLevel, setVerificationLevel] = useState(0);
  const [defaultNotifications, setDefaultNotifications] = useState(0);
  const [afkChannelId, setAfkChannelId] = useState<string | null>(null);
  const [afkTimeout, setAfkTimeout] = useState(300);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (guildDetails) {
      setName(guildDetails.name || "");
      setIcon(guildDetails.icon || "");
      setDescription(guildDetails.description || "");
      setVerificationLevel(guildDetails.verificationLevel ?? 0);
      setDefaultNotifications(guildDetails.defaultMessageNotifications ?? 0);
      setAfkChannelId(guildDetails.afkChannelId || null);
      setAfkTimeout(guildDetails.afkTimeout || 300);
    }
  }, [guildDetails]);

  const voiceChannels = channels.filter((c) => c.type === 2);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveSettings({
        name,
        icon: icon.trim() ? icon : undefined,
        description,
        verificationLevel,
        defaultMessageNotifications: defaultNotifications,
        afkChannelId: afkChannelId === "" ? null : afkChannelId,
        afkTimeout,
      });
      showToast("Server-Einstellungen erfolgreich gespeichert!", "success");
    } catch (err: any) {
      showToast(err.message || "Fehler beim Speichern der Server-Einstellungen", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-[#0b0f17] text-slate-200">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Settings className="w-5 h-5" />
          </div>
          Server-Einstellungen
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">Server-Identität, Sicherheitsregeln, Benachrichtigungsstandards und AFK-Kanäle konfigurieren.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        {/* Identity Section */}
        <div className="bg-[#111724] border border-[#1e293b] hover:border-indigo-500/30 rounded-2xl p-6 shadow-sm space-y-4 transition-all">
          <h3 className="text-sm font-bold text-white border-b border-[#1e293b] pb-3">
            Server-Identität
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Servername
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Server-Icon URL
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2 text-xs transition-all outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Server-Beschreibung
            </label>
            <textarea
              rows={3}
              placeholder="Beschreibe deine Server-Community..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2 text-xs transition-all outline-none resize-none"
            />
          </div>
        </div>

        {/* Security & Verification */}
        <div className="bg-[#111724] border border-[#1e293b] hover:border-indigo-500/30 rounded-2xl p-6 shadow-sm space-y-4 transition-all">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-[#1e293b] pb-3">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            Sicherheits- & Verifizierungsstufe
          </h3>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Voraussetzungen für Mitglieder vor dem Chatten
            </label>
            <select
              value={verificationLevel}
              onChange={(e) => setVerificationLevel(Number(e.target.value))}
              className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 text-slate-100 rounded-xl px-3.5 py-2 text-xs transition-all outline-none cursor-pointer"
            >
              <option value={0}>0 - Keine (Uneingeschränkter Zutritt)</option>
              <option value={1}>1 - Niedrig (Muss verifizierte E-Mail haben)</option>
              <option value={2}>2 - Mittel (Muss seit mind. 5 Min. bei Discord registriert sein)</option>
              <option value={3}>3 - Hoch (Muss seit mind. 10 Min. auf dem Server sein)</option>
              <option value={4}>4 - Sehr hoch (Muss verifizierte Telefonnummer haben)</option>
            </select>
          </div>
        </div>

        {/* Notifications & AFK Settings */}
        <div className="bg-[#111724] border border-[#1e293b] hover:border-indigo-500/30 rounded-2xl p-6 shadow-sm space-y-4 transition-all">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-[#1e293b] pb-3">
            <Bell className="w-4 h-4 text-indigo-400" />
            Benachrichtigungen & AFK-Kanal
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Standard-Benachrichtigungen
              </label>
              <select
                value={defaultNotifications}
                onChange={(e) => setDefaultNotifications(Number(e.target.value))}
                className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 text-slate-100 rounded-xl px-3.5 py-2 text-xs transition-all outline-none cursor-pointer"
              >
                <option value={0}>Alle Nachrichten</option>
                <option value={1}>Nur @Erwähnungen</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                AFK-Sprachkanal
              </label>
              <select
                value={afkChannelId || ""}
                onChange={(e) => setAfkChannelId(e.target.value || null)}
                className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 text-slate-100 rounded-xl px-3.5 py-2 text-xs transition-all outline-none cursor-pointer"
              >
                <option value="">(Kein AFK-Kanal)</option>
                {voiceChannels.map((vc) => (
                  <option key={vc.id} value={vc.id}>
                    🔊 {vc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> AFK-Timeout
              </label>
              <select
                value={afkTimeout}
                onChange={(e) => setAfkTimeout(Number(e.target.value))}
                className="w-full bg-[#0d121c] border border-[#1e293b] focus:border-indigo-500 text-slate-100 rounded-xl px-3.5 py-2 text-xs transition-all outline-none cursor-pointer"
              >
                <option value={60}>1 Minute</option>
                <option value={300}>5 Minuten</option>
                <option value={900}>15 Minuten</option>
                <option value={1800}>30 Minuten</option>
                <option value={3600}>1 Stunde</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/25 transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Einstellungen speichern
          </button>
        </div>
      </form>
    </div>
  );
}

