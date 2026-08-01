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
      showToast("Server settings saved successfully!", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to save server settings", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-discord-header flex items-center gap-2">
          <Settings className="w-6 h-6 text-discord-brand" />
          Server Settings Overview
        </h2>
        <p className="text-sm text-discord-muted">Configure server identity, security rules, notification defaults, and AFK channels.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        {/* Identity Section */}
        <div className="bg-[#2b2d31] border border-[#35373c] rounded-xl p-5 shadow space-y-4">
          <h3 className="text-base font-semibold text-discord-header border-b border-[#35373c]/60 pb-2">
            Server Identity
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-discord-muted block mb-1">
                Server Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#1e1f22] border border-[#35373c] rounded-lg p-2.5 text-sm text-discord-header focus:outline-none focus:border-discord-brand"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-discord-muted block mb-1">
                Server Icon URL
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full bg-[#1e1f22] border border-[#35373c] rounded-lg p-2.5 text-sm text-discord-header focus:outline-none focus:border-discord-brand"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-discord-muted block mb-1">
              Server Description
            </label>
            <textarea
              rows={3}
              placeholder="Describe your server community..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#1e1f22] border border-[#35373c] rounded-lg p-2.5 text-sm text-discord-header focus:outline-none focus:border-discord-brand resize-none"
            />
          </div>
        </div>

        {/* Security & Verification */}
        <div className="bg-[#2b2d31] border border-[#35373c] rounded-xl p-5 shadow space-y-4">
          <h3 className="text-base font-semibold text-discord-header flex items-center gap-2 border-b border-[#35373c]/60 pb-2">
            <ShieldAlert className="w-5 h-5 text-discord-yellow" />
            Verification Level
          </h3>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-discord-muted block mb-1">
              Requirements for members before chatting
            </label>
            <select
              value={verificationLevel}
              onChange={(e) => setVerificationLevel(Number(e.target.value))}
              className="w-full bg-[#1e1f22] border border-[#35373c] rounded-lg p-2.5 text-sm text-discord-header focus:outline-none focus:border-discord-brand"
            >
              <option value={0}>0 - None (Unrestricted)</option>
              <option value={1}>1 - Low (Must have verified email)</option>
              <option value={2}>2 - Medium (Must be registered for 5+ minutes)</option>
              <option value={3}>3 - High (Must be member for 10+ minutes)</option>
              <option value={4}>4 - Very High (Must have verified phone number)</option>
            </select>
          </div>
        </div>

        {/* Notifications & AFK Settings */}
        <div className="bg-[#2b2d31] border border-[#35373c] rounded-xl p-5 shadow space-y-4">
          <h3 className="text-base font-semibold text-discord-header flex items-center gap-2 border-b border-[#35373c]/60 pb-2">
            <Bell className="w-5 h-5 text-discord-brand" />
            Notifications & AFK Setup
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-discord-muted block mb-1">
                Default Notification Settings
              </label>
              <select
                value={defaultNotifications}
                onChange={(e) => setDefaultNotifications(Number(e.target.value))}
                className="w-full bg-[#1e1f22] border border-[#35373c] rounded-lg p-2.5 text-sm text-discord-header focus:outline-none focus:border-discord-brand"
              >
                <option value={0}>All Messages</option>
                <option value={1}>Only @mentions</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-discord-muted block mb-1">
                AFK Voice Channel
              </label>
              <select
                value={afkChannelId || ""}
                onChange={(e) => setAfkChannelId(e.target.value || null)}
                className="w-full bg-[#1e1f22] border border-[#35373c] rounded-lg p-2.5 text-sm text-discord-header focus:outline-none focus:border-discord-brand"
              >
                <option value="">(No AFK Channel)</option>
                {voiceChannels.map((vc) => (
                  <option key={vc.id} value={vc.id}>
                    🔊 {vc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-discord-muted block mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> AFK Timeout Cooldown
              </label>
              <select
                value={afkTimeout}
                onChange={(e) => setAfkTimeout(Number(e.target.value))}
                className="w-full bg-[#1e1f22] border border-[#35373c] rounded-lg p-2.5 text-sm text-discord-header focus:outline-none focus:border-discord-brand"
              >
                <option value={60}>1 minute</option>
                <option value={300}>5 minutes</option>
                <option value={900}>15 minutes</option>
                <option value={1800}>30 minutes</option>
                <option value={3600}>1 hour</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-discord-brand hover:bg-discord-brandHover text-white font-medium rounded-lg shadow-lg transition-colors"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Server Settings
          </button>
        </div>
      </form>
    </div>
  );
}
