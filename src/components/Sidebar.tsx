"use client";

import React, { useState } from "react";
import {
  LayoutDashboard,
  Hash,
  FolderTree,
  Shield,
  Settings,
  Smile,
  Sticker,
  Link2,
  Copy,
  Wrench,
  ChevronDown,
  ChevronRight,
  Server,
  LogOut,
  Radio,
  Activity,
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
  ExternalLink,
  PlusCircle,
  ShieldCheck,
  SmilePlus,
} from "lucide-react";

export type ViewType =
  | "overview"
  | "members"
  | "backups"
  | "server-clone"
  | "welcome"
  | "auto-react"
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
  ownerUser: { username: string; avatar: string | null } | null;
  onLogout: () => void;
  onRefreshGuilds?: () => void;
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
  onLogout,
  onRefreshGuilds,
}: SidebarProps) {
  const [isServerDropdownOpen, setIsServerDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const selectedGuild = guilds.find((g) => g.id === selectedGuildId) || guilds[0];

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
          badge: "Aktiv",
          badgeColor: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
        },
        {
          id: "auto-react",
          label: "Automatische Reaktionen",
          description: "Emoji-Reaktionsregeln auf Keywords",
          icon: SmilePlus,
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
          item.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
      return { ...cat, items: filteredItems };
    })
    .filter((cat) => cat.items.length > 0);

  return (
    <aside className="w-72 bg-[#0d111a] flex flex-col h-screen border-r border-[#1a2333] shrink-0 select-none text-slate-200">
      {/* Brand & Server Selector Header */}
      <div className="p-4 border-b border-[#1a2333] bg-[#090d15]/90 space-y-3">
        {/* App Branding */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-600/30 text-white">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                GuildPilot
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Pro
                </span>
              </span>
              <p className="text-[11px] text-slate-400">Discord Management</p>
            </div>
          </div>

          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium border ${
              botStatus?.ready
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
            }`}
            title={botStatus?.ready ? `Verbunden (${botStatus.ping}ms)` : "Offline"}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                botStatus?.ready ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
              }`}
            />
            <span>{botStatus?.ready ? `${botStatus.ping}ms` : "Offline"}</span>
          </div>
        </div>

        {/* Server Selector Trigger */}
        <div className="relative">
          <div
            onClick={() => setIsServerDropdownOpen((prev) => !prev)}
            className="flex items-center justify-between p-2.5 rounded-xl bg-[#131b2c] border border-[#212d45] hover:border-indigo-500/50 hover:bg-[#18233a] transition-all cursor-pointer shadow-sm group"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              {selectedGuild?.icon ? (
                <img
                  src={selectedGuild.icon}
                  alt={selectedGuild.name}
                  className="w-8 h-8 rounded-lg object-cover shrink-0 border border-[#263553]"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center font-bold text-indigo-300 text-xs shrink-0">
                  {selectedGuild?.name ? selectedGuild.name.substring(0, 2).toUpperCase() : "GP"}
                </div>
              )}
              <div className="truncate">
                <p className="text-xs font-semibold text-white truncate group-hover:text-indigo-200 transition-colors">
                  {selectedGuild?.name || "Server auswählen"}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {selectedGuild ? `${selectedGuild.memberCount.toLocaleString("de-DE")} Mitglieder` : "Kein Server verfügbar"}
                </p>
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                isServerDropdownOpen ? "rotate-180 text-indigo-400" : ""
              }`}
            />
          </div>

          {/* Server Selector Dropdown */}
          {isServerDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#101726] border border-[#243350] rounded-xl shadow-2xl p-2 space-y-1 max-h-72 overflow-y-auto z-50 animate-in fade-in-50 zoom-in-95 duration-150 backdrop-blur-xl">
              <div className="flex items-center justify-between px-2 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-[#1f2c44] mb-1">
                <span>Verfügbare Server ({guilds.length})</span>
                {onRefreshGuilds && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRefreshGuilds();
                    }}
                    title="Serverliste aktualisieren"
                    className="p-1 hover:text-white text-slate-400 hover:bg-[#1a253b] rounded transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}
              </div>

              {guilds.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  Keine Server gefunden. Ist der Bot autorisiert?
                </div>
              ) : (
                guilds.map((g) => {
                  const isSelected = g.id === selectedGuildId;
                  return (
                    <button
                      key={g.id}
                      onClick={() => {
                        onSelectGuild(g.id);
                        setIsServerDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-all ${
                        isSelected
                          ? "bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30"
                          : "text-slate-300 hover:bg-[#18233a] hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        {g.icon ? (
                          <img src={g.icon} alt="" className="w-6 h-6 rounded-md object-cover shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-md bg-indigo-500/20 flex items-center justify-center font-bold text-indigo-300 text-[10px] shrink-0">
                            {g.name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="truncate text-left">
                          <span className="truncate block">{g.name}</span>
                          <span className={`text-[10px] block ${isSelected ? "text-indigo-200" : "text-slate-400"}`}>
                            {g.memberCount} Mitglieder
                          </span>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 shrink-0 text-white" />}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Quick Search in Menu */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Funktion suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#111724] border border-[#1d293f] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500/60 transition-colors"
          />
        </div>
      </div>

      {/* Main Navigation with Categories */}
      <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
        {filteredCategories.map((category) => {
          const isCollapsed = collapsedCategories[category.id] && !searchQuery.trim();
          return (
            <div key={category.id} className="space-y-1">
              {/* Category Header with Collapse Toggle */}
              <button
                type="button"
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center justify-between px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors"
              >
                <span>{category.label}</span>
                <span className="text-slate-400 hover:text-slate-200">
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </span>
              </button>

              {/* Category Items */}
              {!isCollapsed && (
                <div className="space-y-0.5">
                  {category.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentView === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onSelectView(item.id)}
                        className={`w-full group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                          isActive
                            ? "bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/25"
                            : "text-slate-300 hover:text-white hover:bg-[#141c2c]"
                        }`}
                        title={item.description}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-colors ${
                              isActive
                                ? "text-white"
                                : "text-slate-400 group-hover:text-indigo-400"
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>

                        {item.badge && (
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              isActive
                                ? "bg-white/20 text-white border-white/30"
                                : item.badgeColor || "bg-slate-800 text-slate-300 border-slate-700"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* System & Infrastructure Section */}
        <div className="pt-2 border-t border-[#1a2333] space-y-1">
          <div className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            System
          </div>
          <button
            onClick={() => onSelectView("host-server")}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              currentView === "host-server"
                ? "bg-emerald-600 text-white font-semibold shadow-md shadow-emerald-600/25"
                : "text-slate-300 hover:text-white hover:bg-[#141c2c]"
            }`}
            title="Lokale Bot-Instanz, Systemlast und Protokolle"
          >
            <div className="flex items-center gap-3">
              <Server
                className={`w-4 h-4 ${
                  currentView === "host-server" ? "text-white" : "text-emerald-400"
                }`}
              />
              <span>Host-System & Logs</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Live
            </span>
          </button>
        </div>
      </nav>

      {/* User & Session Footer */}
      <div className="p-3 border-t border-[#1a2333] bg-[#090d15]/95">
        <div className="flex items-center justify-between p-2 rounded-xl bg-[#111724] border border-[#1b2538]">
          <div className="flex items-center gap-2.5 overflow-hidden">
            {ownerUser?.avatar ? (
              <img
                src={ownerUser.avatar}
                alt=""
                className="w-8 h-8 rounded-lg object-cover shrink-0 border border-[#243350]"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-xs shrink-0">
                {ownerUser?.username ? ownerUser.username.substring(0, 1).toUpperCase() : "A"}
              </div>
            )}
            <div className="truncate">
              <p className="text-xs font-semibold text-white truncate">
                {ownerUser?.username || "Administrator"}
              </p>
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                Lokaler Eigentümer
              </p>
            </div>
          </div>

          <button
            onClick={onLogout}
            title="Sitzung abmelden"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
