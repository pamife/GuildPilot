"use client";

import React, { useState } from "react";
import {
  Activity,
  Archive,
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  Hash,
  Link2,
  MessageSquareText,
  RefreshCw,
  Settings2,
  Shield,
  SmilePlus,
  Sparkles,
  Tag,
  Ticket,
  Users,
  Volume2,
  FolderTree,
  MessagesSquare,
} from "lucide-react";
import type { ViewType } from "@/components/Sidebar";
import { useToast } from "@/components/ToastContainer";

interface OverviewProps {
  guildDetails: any;
  onRefresh: () => void | Promise<void>;
  onNavigate: (view: ViewType) => void;
  botStatus?: { ready: boolean; tag: string; ping: number } | null;
  isOwner?: boolean;
}

export function OverviewView({
  guildDetails,
  onRefresh,
  onNavigate,
  botStatus: liveBotStatus,
  isOwner = false,
}: OverviewProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const { showToast } = useToast();
  if (!guildDetails)
    return (
      <div className="gp-empty gp-loading" role="status">
        <RefreshCw className="animate-spin" size={30} />
        <h2>Dein Control Center wird geladen.</h2>
        <p>Serverdaten werden synchronisiert.</p>
        <button
          className="gp-button gp-button-secondary"
          onClick={() => void onRefresh()}
        >
          Erneut laden
        </button>
      </div>
    );

  const { id, name, icon, banner, description, memberCount, counts } =
    guildDetails;
  const botStatus = liveBotStatus ?? guildDetails.botStatus;
  const segments = [
    {
      label: "Textkanäle",
      value: counts?.textChannels ?? 0,
      color: "#7ce8b5",
      icon: Hash,
    },
    {
      label: "Sprachkanäle",
      value: counts?.voiceChannels ?? 0,
      color: "#b3a0ff",
      icon: Volume2,
    },
    {
      label: "Kategorien",
      value: counts?.categoryChannels ?? 0,
      color: "#edc780",
      icon: FolderTree,
    },
    {
      label: "Foren",
      value: counts?.forumChannels ?? 0,
      color: "#7fc8ed",
      icon: MessagesSquare,
    },
  ];
  const segmentTotal = segments.reduce(
    (sum, segment) => sum + segment.value,
    0,
  );
  const totalChannels = counts?.channels ?? segmentTotal;
  let offset = 0;
  const stats: {
    label: string;
    value: number;
    icon: React.ElementType;
    color: string;
    view: ViewType;
    note: string;
  }[] = [
    {
      label: "Mitglieder",
      value: memberCount ?? 0,
      icon: Users,
      color: "mint",
      view: "members",
      note: "Deine Community",
    },
    {
      label: "Kanäle",
      value: totalChannels,
      icon: Hash,
      color: "violet",
      view: "channels",
      note: "Raum für Austausch",
    },
    {
      label: "Rollen",
      value: counts?.roles ?? 0,
      icon: Shield,
      color: "amber",
      view: "roles",
      note: "Klare Berechtigungen",
    },
    {
      label: "Emojis & Sticker",
      value: (counts?.emojis ?? 0) + (counts?.stickers ?? 0),
      icon: SmilePlus,
      color: "blue",
      view: "emojis",
      note: "Mehr Persönlichkeit",
    },
  ];
  const actions: {
    title: string;
    text: string;
    icon: React.ElementType;
    color: string;
    view: ViewType;
  }[] = [
    {
      title: "Willkommen heißen",
      text: "Der erste Eindruck zählt.",
      icon: Sparkles,
      color: "mint",
      view: "welcome",
    },
    {
      title: "Support organisieren",
      text: "Für deine Mitglieder da sein.",
      icon: Ticket,
      color: "violet",
      view: "tickets",
    },
    {
      title: "Nachricht gestalten",
      text: "Deine Community erreichen.",
      icon: MessageSquareText,
      color: "blue",
      view: "custom-messages",
    },
    {
      title: "Rollen zuweisen",
      text: "Jeder findet seinen Platz.",
      icon: Tag,
      color: "amber",
      view: "self-roles",
    },
  ];
  const refresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(true);
      window.setTimeout(() => setCopiedId(false), 2000);
    } catch {
      showToast("Server-ID konnte nicht kopiert werden.", "error");
    }
  };

  return (
    <div className="gp-overview">
      <div className="gp-overview-inner">
        <div className="gp-page-heading">
          <div>
            <span className="gp-eyebrow">DEIN SERVER IM FOKUS</span>
            <h1>
              Alles auf einen Blick<span className="gp-accent">.</span>
            </h1>
            <p>
              Weniger suchen. Mehr bewegen. Willkommen in deinem Control Center.
            </p>
          </div>
          <button
            className="gp-button gp-button-secondary"
            disabled={isRefreshing}
            onClick={refresh}
          >
            <RefreshCw
              size={15}
              className={isRefreshing ? "animate-spin" : ""}
            />
            {isRefreshing ? "Aktualisieren …" : "Aktualisieren"}
          </button>
        </div>
        <section className="gp-guild-hero" aria-label="Aktueller Server">
          {banner && <img src={banner} alt="" className="gp-guild-banner" />}
          <div className="gp-guild-hero-copy">
            <span className="gp-eyebrow">DEIN COMMUNITY-WORKSPACE</span>
            <div className="gp-guild-title">
              {icon ? (
                <img src={icon} alt="" className="gp-guild-avatar" />
              ) : (
                <span className="gp-guild-avatar gp-avatar-fallback">
                  {name?.slice(0, 2).toUpperCase() || "GP"}
                </span>
              )}
              <h2>{name}</h2>
            </div>
            <p>
              {description ||
                "Ein guter Ort für deine Community. Mach ihn zu deinem."}
            </p>
            <div className="gp-guild-hero-actions">
              <button
                onClick={() => onNavigate("settings")}
                className="gp-button gp-button-primary"
              >
                <Settings2 size={16} />
                Server gestalten
              </button>
              {id && (
                <button
                  onClick={copyId}
                  className="gp-copy-id"
                  title={`Server-ID: ${id}`}
                >
                  {copiedId ? <Check size={14} /> : <Copy size={14} />}
                  {copiedId ? "Kopiert" : "Server-ID kopieren"}
                </button>
              )}
            </div>
          </div>
          <div className="gp-hero-art" aria-hidden="true">
            <div className="gp-hero-ring" />
            <div className="gp-hero-ring gp-hero-ring-inner" />
            <div className="gp-hero-core">
              <Shield size={49} strokeWidth={1.25} />
            </div>
            <span className="gp-hero-satellite gp-satellite-one">
              <Hash size={21} />
            </span>
            <span className="gp-hero-satellite gp-satellite-two">
              <Users size={21} />
            </span>
            <span className="gp-hero-satellite gp-satellite-three">
              <Sparkles size={18} />
            </span>
          </div>
        </section>
        <section className="gp-stats-grid" aria-label="Serverstatistiken">
          {stats.map(({ label, value, icon: Icon, color, view, note }) => (
            <button
              key={view}
              className="gp-stat-card"
              onClick={() => onNavigate(view)}
            >
              <div className="gp-stat-top">
                <span className={`gp-icon gp-icon-${color}`}>
                  <Icon size={18} />
                </span>
                <ArrowUpRight size={17} />
              </div>
              <span className="gp-stat-label">{label}</span>
              <strong>{value.toLocaleString("de-DE")}</strong>
              <span className="gp-stat-note">{note}</span>
            </button>
          ))}
        </section>
        <section className="gp-quick-section">
          <div className="gp-section-toolbar">
            <h2>Was möchtest du erledigen?</h2>
            <span className="gp-muted">Deine Shortcuts</span>
          </div>
          <div className="gp-quick-grid">
            {actions.map(({ title, text, icon: Icon, color, view }) => (
              <button
                className="gp-quick-action"
                onClick={() => onNavigate(view)}
                key={view}
              >
                <span className={`gp-icon gp-icon-${color}`}>
                  <Icon size={19} />
                </span>
                <span>
                  <strong>{title}</strong>
                  <span>{text}</span>
                </span>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>
        </section>
        <div className="gp-detail-grid">
          <section className="gp-card gp-channel-card">
            <div className="gp-section-toolbar">
              <div>
                <span className="gp-eyebrow">GUT STRUKTURIERT</span>
                <h2>Raum für deine Community</h2>
              </div>
              <button
                className="gp-icon-button"
                title="Kanäle verwalten"
                aria-label="Kanäle verwalten"
                onClick={() => onNavigate("channels")}
              >
                <ArrowUpRight size={19} />
              </button>
            </div>
            <div className="gp-channel-breakdown">
              <div className="gp-donut">
                <svg
                  viewBox="0 0 160 160"
                  aria-label={`${totalChannels} Kanäle, davon ${segmentTotal} in den dargestellten Kategorien`}
                  role="img"
                >
                  <circle
                    cx="80"
                    cy="80"
                    r="64"
                    fill="none"
                    stroke="#252e31"
                    strokeWidth="13"
                  />
                  {segments.map((segment) => {
                    const length =
                      (segment.value / Math.max(1, segmentTotal)) * 402.12;
                    const start = offset;
                    offset += length;
                    return (
                      segment.value > 0 && (
                        <circle
                          key={segment.label}
                          cx="80"
                          cy="80"
                          r="64"
                          fill="none"
                          stroke={segment.color}
                          strokeWidth="13"
                          strokeDasharray={`${Math.max(0, length - 5)} ${402.12 - Math.max(0, length - 5)}`}
                          strokeDashoffset={-start}
                          transform="rotate(-90 80 80)"
                        />
                      )
                    );
                  })}
                </svg>
                <div>
                  <strong>{totalChannels}</strong>
                  <span>Kanäle gesamt</span>
                </div>
              </div>
              <div className="gp-channel-legend">
                {segments.map(({ label, value, color, icon: Icon }) => (
                  <div key={label}>
                    <span
                      className="gp-legend-dot"
                      style={{ background: color }}
                    />
                    <Icon size={14} />
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section className="gp-card gp-bot-card">
            <div className="gp-section-toolbar">
              <h2>
                <Activity size={17} /> Bot-Status
              </h2>
              <span
                className={`gp-status-pill ${botStatus?.ready ? "" : "gp-status-offline"}`}
              >
                <span className="gp-status-dot" />
                {botStatus
                  ? botStatus.ready
                    ? "Online"
                    : "Offline"
                  : "Unbekannt"}
              </span>
            </div>
            <div className="gp-bot-ping">
              <strong>
                {botStatus?.ready && botStatus.ping >= 0 ? botStatus.ping : "—"}
              </strong>
              <span>ms / Gateway-Latenz</span>
            </div>
            <div className="gp-status-row">
              <span>Bot</span>
              <strong>{botStatus?.tag || "Noch nicht verbunden"}</strong>
            </div>
            <div className="gp-status-row">
              <span>Verbindung</span>
              <strong>
                {botStatus?.ready
                  ? "Mit Discord verbunden"
                  : "Keine aktive Verbindung"}
              </strong>
            </div>
            {isOwner && (
              <button
                className="gp-text-link"
                onClick={() => onNavigate("host-server")}
              >
                Systemstatus öffnen <ArrowRight size={15} />
              </button>
            )}
          </section>
        </div>
        <div className="gp-bottom-actions">
          <button onClick={() => onNavigate("backups")}>
            <Archive size={18} />
            <span>
              <strong>Gut vorbereitet.</strong> Sichere die Struktur deines
              Servers.
            </span>
            <ArrowRight size={17} />
          </button>
          <button onClick={() => onNavigate("invites")}>
            <Link2 size={18} />
            <span>
              <strong>{counts?.invites ?? 0} Einladungen.</strong> Öffne die Tür
              für neue Mitglieder.
            </span>
            <ArrowRight size={17} />
          </button>
        </div>
        <footer className="gp-workspace-footer">
          <span>GuildPilot · Dein Server. Deine Regeln.</span>
          <span>Mit deiner Community verbunden.</span>
        </footer>
      </div>
    </div>
  );
}
