"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Menu,
  X,
  ArrowLeft,
  LayoutDashboard,
  Hash,
  FolderTree,
  Shield,
  Settings,
  Smile,
  Link2,
  Copy,
  Wrench,
  ChevronDown,
  Server,
  LogOut,
  Ticket,
  Check,
  RefreshCw,
  ClipboardList,
  Tag,
  MessageSquareText,
  Sparkles,
  DownloadCloud,
  Users,
  Archive,
  Search,
  SmilePlus,
} from "lucide-react";

import { Brand } from "@/components/Brand";

export type ViewType =
  | "overview"
  | "members"
  | "backups"
  | "server-clone"
  | "welcome"
  | "auto-react"
  | "counting"
  | "leveling"
  | "moderation"
  | "automod"
  | "custom-messages"
  | "applications"
  | "tickets"
  | "self-roles"
  | "channels"
  | "categories"
  | "roles"
  | "settings"
  | "emojis"
  | "stickers"
  | "invites"
  | "templates"
  | "utilities"
  | "host-server";

interface GuildOption {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
}

interface SidebarProps {
  currentView: ViewType;
  onSelectView: (view: ViewType) => void;
  guilds: GuildOption[];
  selectedGuildId: string | null;
  onSelectGuild: (guildId: string) => void;
  botStatus: { ready: boolean; tag: string; ping: number } | null;
  ownerUser: { username: string; avatar: string | null; role?: string } | null;
  isOwner?: boolean;
  onLogout: () => void;
  onRefreshGuilds?: () => void;
  onBackToServers?: () => void;
}

interface NavCategory {
  id: string;
  label: string;
  items: {
    id: ViewType;
    label: string;
    description: string;
    icon: React.ElementType;
    badge?: string;
    badgeColor?: string;
  }[];
}

export function Sidebar({
  currentView,
  onSelectView,
  guilds,
  selectedGuildId,
  onSelectGuild,
  botStatus,
  ownerUser,
  isOwner = false,
  onLogout,
  onRefreshGuilds,
  onBackToServers,
}: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const [isServerDropdownOpen, setIsServerDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<
    Record<string, boolean>
  >({});

  const selectedGuild =
    guilds.find((g) => g.id === selectedGuildId) || guilds[0];

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const navCategories: NavCategory[] = [
    {
      id: "overview-cat",
      label: "Übersicht",
      items: [
        {
          id: "overview",
          label: "Server-Übersicht",
          description: "Zentrale Metriken & Schnellzugriff",
          icon: LayoutDashboard,
        },
      ],
    },
    {
      id: "community-cat",
      label: "Community & Interaktion",
      items: [
        {
          id: "welcome",
          label: "Willkommen & Abschied",
          description: "Begrüßungs-Embeds & Auto-Rollen",
          icon: Sparkles,

          badgeColor: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
        },
        {
          id: "auto-react",
          label: "Automatische Reaktionen",
          description: "Emoji-Reaktionsregeln auf Keywords",
          icon: SmilePlus,
        },
        {
          id: "leveling",
          label: "Leveling",
          description: "Chat-XP, Rollen und Prestige",
          icon: Sparkles,
        },
        {
          id: "counting",
          label: "Relay Count",
          description: "Zählkanal, Rekord und Relay Save",
          icon: Hash,
        },
        {
          id: "custom-messages",
          label: "Nachrichten & Embeds",
          description: "Rich-Embeds & Ankündigungen",
          icon: MessageSquareText,
        },
        {
          id: "self-roles",
          label: "Rollen-Zuweisung",
          description: "Interaktive Self-Role Panels",
          icon: Tag,
        },
        {
          id: "applications",
          label: "Bewerbungs-System",
          description: "Formulare & Auswertungen",
          icon: ClipboardList,
        },
        {
          id: "tickets",
          label: "Ticket-Support",
          description: "Support-Kanäle mit Transkripten",
          icon: Ticket,
        },
      ],
    },
    {
      id: "management-cat",
      label: "Server-Verwaltung",
      items: [
        {
          id: "moderation",
          label: "Moderation",
          description: "Mod-Log und Moderatorrollen",
          icon: Shield,
        },
        {
          id: "automod",
          label: "AutoMod",
          description: "Spam- und Einladungsfilter",
          icon: Shield,
        },
        {
          id: "members",
          label: "Mitglieder-Manager",
          description: "Benutzerübersicht & Rollenvergabe",
          icon: Users,
        },
        {
          id: "channels",
          label: "Kanal-Manager",
          description: "Text- & Sprachkanäle verwalten",
          icon: Hash,
        },
        {
          id: "categories",
          label: "Kategorien",
          description: "Kategoriestruktur & Berechtigungen",
          icon: FolderTree,
        },
        {
          id: "roles",
          label: "Rollen & Rechte",
          description: "Hierarchie & Berechtigungen",
          icon: Shield,
        },
        {
          id: "emojis",
          label: "Emojis & Sticker",
          description: "Server-Assets hochladen & sortieren",
          icon: Smile,
        },
        {
          id: "invites",
          label: "Einladungs-Links",
          description: "Tracking & Verwendungsstatistiken",
          icon: Link2,
        },
      ],
    },
    {
      id: "tools-cat",
      label: "Werkzeuge & Struktur",
      items: [
        {
          id: "backups",
          label: "Server-Sicherungen",
          description: "Vollständige Snapshots & Wiederherstellung",
          icon: Archive,
        },
        {
          id: "server-clone",
          label: "Server-Import / Klonen",
          description: "Strukturen kopieren & übertragen",
          icon: DownloadCloud,
        },
        {
          id: "templates",
          label: "Vorlagen & Layouts",
          description: "Kanal- und Kategoriemuster",
          icon: Copy,
        },
        {
          id: "utilities",
          label: "Massen-Werkzeuge",
          description: "Bulk-Erstellung & Schnellsuche",
          icon: Wrench,
        },
        {
          id: "settings",
          label: "Server-Einstellungen",
          description: "Name, Icon & Standard-Kanäle",
          icon: Settings,
        },
      ],
    },
  ];

  // Filter items if searching
  const filteredCategories = navCategories
    .map((cat) => {
      if (!searchQuery.trim()) return cat;
      const filteredItems = cat.items.filter(
        (item) =>
          item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      return { ...cat, items: filteredItems };
    })
    .filter((cat) => cat.items.length > 0);

  useEffect(() => {
    if (!mobileOpen) return;
    const sidebar = sidebarRef.current;
    sidebar?.focus();
    const desktop = window.matchMedia("(min-width: 1024px)");
    const handleResize = () => {
      if (desktop.matches) setMobileOpen(false);
    };
    desktop.addEventListener("change", handleResize);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
      if (event.key !== "Tab" || !sidebar) return;
      const elements = Array.from(
        sidebar.querySelectorAll<HTMLElement>("button, input, a[href], select"),
      ).filter((element) => element.offsetParent !== null);
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === sidebar)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      desktop.removeEventListener("change", handleResize);
      if (menuRef.current?.offsetParent) menuRef.current.focus();
    };
  }, [mobileOpen]);

  const navigate = (view: ViewType) => {
    onSelectView(view);
    setMobileOpen(false);
  };

  return (
    <>
      <div className="gp-mobile-bar">
        <Brand />
        <button
          ref={menuRef}
          className="gp-icon-button"
          aria-label="Navigation öffnen"
          aria-expanded={mobileOpen}
          aria-controls="workspace-navigation"
          onClick={() => setMobileOpen(true)}
        >
          <Menu size={22} />
        </button>
      </div>
      {mobileOpen && (
        <button
          className="gp-sidebar-overlay"
          onClick={() => setMobileOpen(false)}
          aria-label="Navigation schließen"
          tabIndex={-1}
        />
      )}
      <aside
        ref={sidebarRef}
        tabIndex={-1}
        id="workspace-navigation"
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen || undefined}
        className={`gp-sidebar ${mobileOpen ? "is-open" : ""}`}
        aria-label="Workspace-Navigation"
      >
        <div className="gp-sidebar-brand">
          <Brand />
          <button
            className="gp-icon-button gp-mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Navigation schließen"
          >
            <X size={19} />
          </button>
        </div>
        <div className="gp-sidebar-server">
          <button
            className="gp-server-select"
            aria-expanded={isServerDropdownOpen}
            aria-controls="guild-options"
            onClick={() => setIsServerDropdownOpen(!isServerDropdownOpen)}
          >
            {selectedGuild?.icon ? (
              <img src={selectedGuild.icon} alt="" className="gp-avatar" />
            ) : (
              <span className="gp-avatar gp-avatar-fallback">
                {selectedGuild?.name.slice(0, 2).toUpperCase() || "GP"}
              </span>
            )}
            <span>
              <strong>{selectedGuild?.name || "Server auswählen"}</strong>
              <span>Dein Workspace</span>
            </span>
            <ChevronDown size={16} />
          </button>
          {isServerDropdownOpen && (
            <div className="gp-server-dropdown" id="guild-options">
              <div className="gp-dropdown-heading">
                <span>Server wechseln</span>
                {onRefreshGuilds && (
                  <button
                    className="gp-icon-button"
                    title="Serverliste aktualisieren"
                    aria-label="Serverliste aktualisieren"
                    onClick={onRefreshGuilds}
                  >
                    <RefreshCw size={14} />
                  </button>
                )}
              </div>
              {guilds.map((guild) => (
                <button
                  key={guild.id}
                  className={guild.id === selectedGuildId ? "is-selected" : ""}
                  onClick={() => {
                    onSelectGuild(guild.id);
                    setIsServerDropdownOpen(false);
                    setMobileOpen(false);
                  }}
                >
                  <span>{guild.name}</span>
                  {guild.id === selectedGuildId && <Check size={15} />}
                </button>
              ))}
              {guilds.length === 0 && (
                <p className="gp-muted p-3">Keine Server verfügbar.</p>
              )}
              {onBackToServers && (
                <button onClick={onBackToServers}>
                  <ArrowLeft size={14} />
                  Alle Server anzeigen
                </button>
              )}
            </div>
          )}
        </div>
        <label className="gp-search gp-nav-search">
          <Search size={15} />
          <input
            aria-label="Funktion suchen"
            placeholder="Funktion suchen …"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="gp-search-clear"
              onClick={() => setSearchQuery("")}
              aria-label="Suche leeren"
            >
              <X size={13} />
            </button>
          )}
        </label>
        <nav className="gp-navigation" aria-label="Hauptnavigation">
          {filteredCategories.length === 0 && (
            <p className="gp-nav-empty">Keine Funktion gefunden.</p>
          )}
          {filteredCategories.map((category) => {
            const isCollapsed =
              !!collapsedCategories[category.id] && !searchQuery.trim();
            return (
              <div className="gp-nav-group" key={category.id}>
                <button
                  className="gp-nav-group-heading"
                  aria-expanded={!isCollapsed}
                  aria-controls={category.id}
                  onClick={() => toggleCategory(category.id)}
                >
                  <span>{category.label}</span>
                  <ChevronDown
                    size={12}
                    className={isCollapsed ? "-rotate-90" : ""}
                  />
                </button>
                {!isCollapsed && (
                  <div id={category.id}>
                    {category.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          className={`gp-nav-item ${currentView === item.id ? "is-active" : ""}`}
                          aria-current={
                            currentView === item.id ? "page" : undefined
                          }
                          title={item.description}
                          onClick={() => navigate(item.id)}
                        >
                          <Icon size={17} />
                          <span>{item.label}</span>
                          {currentView === item.id && (
                            <span className="gp-nav-active-dot" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {isOwner && (
            <div className="gp-nav-group gp-owner-nav">
              <span className="gp-nav-group-heading">SYSTEM</span>
              <button
                onClick={() => navigate("host-server")}
                className={`gp-nav-item ${currentView === "host-server" ? "is-active" : ""}`}
                aria-current={
                  currentView === "host-server" ? "page" : undefined
                }
              >
                <Server size={17} />
                <span>Host-System & Logs</span>
                <span className="gp-owner-tag">Owner</span>
              </button>
            </div>
          )}
        </nav>
        <div className="gp-sidebar-bottom">
          <div className="gp-sidebar-status">
            <span
              className={`gp-status-dot ${botStatus?.ready ? "" : "gp-dot-offline"}`}
            />
            <span>
              {botStatus
                ? botStatus.ready
                  ? "Bot verbunden"
                  : "Bot offline"
                : "Status wird geladen"}
            </span>
            <span>
              {botStatus?.ready && botStatus.ping >= 0
                ? `${botStatus.ping} ms`
                : "—"}
            </span>
          </div>
          <div className="gp-account">
            {ownerUser?.avatar ? (
              <img src={ownerUser.avatar} alt="" className="gp-avatar" />
            ) : (
              <span className="gp-avatar gp-avatar-fallback">
                {ownerUser?.username.slice(0, 1).toUpperCase() || "U"}
              </span>
            )}
            <div className="gp-account-name">
              <strong>{ownerUser?.username || "Benutzer"}</strong>
              <span>{isOwner ? "Global Owner" : "Community Manager"}</span>
            </div>
            <button
              onClick={onLogout}
              className="gp-icon-button"
              aria-label="Abmelden"
              title="Abmelden"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
