"use client";

import React from "react";
import {
  LayoutDashboard,
  Hash,
  FolderTree,
  Shield,
  Settings,
  Smile,
  Sticker,
  Link,
  Copy,
  Wrench,
  Bot,
  ChevronDown,
  Server,
  LogOut,
  Radio,
  Activity,
  Ticket,
  Check,
  RefreshCw,
} from "lucide-react";

export type ViewType =
  | "overview"
  | "channels"
  | "categories"
  | "roles"
  | "settings"
  | "emojis"
  | "stickers"
  | "invites"
  | "templates"
  | "utilities"
  | "tickets"
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
  const [isServerDropdownOpen, setIsServerDropdownOpen] = React.useState(false);
  const selectedGuild = guilds.find((g) => g.id === selectedGuildId) || guilds[0];

  const navigationItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "tickets", label: "Ticket System", icon: Ticket },
    { id: "channels", label: "Channel Manager", icon: Hash },
    { id: "categories", label: "Category Manager", icon: FolderTree },
    { id: "roles", label: "Role Manager", icon: Shield },
    { id: "settings", label: "Server Settings", icon: Settings },
    { id: "emojis", label: "Emoji Manager", icon: Smile },
    { id: "stickers", label: "Sticker Manager", icon: Sticker },
    { id: "invites", label: "Invite Manager", icon: Link },
    { id: "templates", label: "Templates & Layouts", icon: Copy },
    { id: "utilities", label: "Utilities & Bulk Tools", icon: Wrench },
  ];

  return (
    <aside className="w-64 bg-discord-sidebar flex flex-col h-screen border-r border-[#1f2023] shrink-0 select-none">
      {/* Header / Server Selector */}
      <div className="p-3 border-b border-[#1f2023] bg-discord-darkest/40 relative z-30">
        <div className="relative">
          <label className="text-[10px] font-bold uppercase tracking-wider text-discord-muted mb-1 block px-2">
            Selected Server
          </label>

          <div
            onClick={() => setIsServerDropdownOpen((prev) => !prev)}
            className="flex items-center justify-between p-2 rounded-lg bg-[#1e1f22] border border-[#35373c] hover:border-discord-brand transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              {selectedGuild?.icon ? (
                <img
                  src={selectedGuild.icon}
                  alt={selectedGuild.name}
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-discord-brand flex items-center justify-center font-bold text-white text-xs shrink-0">
                  {selectedGuild?.name ? selectedGuild.name.substring(0, 2).toUpperCase() : "GP"}
                </div>
              )}
              <div className="truncate">
                <p className="text-sm font-semibold text-discord-header truncate">
                  {selectedGuild?.name || "Select Server"}
                </p>
                <p className="text-xs text-discord-muted truncate">
                  {selectedGuild ? `${selectedGuild.memberCount} members` : "No server available"}
                </p>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-discord-muted shrink-0 transition-transform ${isServerDropdownOpen ? "rotate-180" : ""}`} />
          </div>

          {/* Interactive Server Selector Dropdown Menu */}
          {isServerDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#1e1f22] border border-[#35373c] rounded-xl shadow-2xl p-2 space-y-1 max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-150 z-50">
              <div className="text-[10px] font-bold uppercase tracking-wider text-discord-muted px-2 py-1 flex items-center justify-between">
                <span>Your Discord Servers</span>
                {onRefreshGuilds && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRefreshGuilds();
                    }}
                    title="Refresh Servers List"
                    className="p-1 hover:text-white transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}
              </div>

              {guilds.length === 0 ? (
                <p className="text-xs text-discord-muted p-3 text-center">No servers found. Is bot connected?</p>
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
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-colors ${
                        isSelected
                          ? "bg-discord-brand text-white font-bold"
                          : "text-discord-muted hover:bg-[#2b2d31] hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        {g.icon ? (
                          <img src={g.icon} alt="" className="w-6 h-6 rounded-full shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-discord-brand/40 flex items-center justify-center font-bold text-white text-[10px] shrink-0">
                            {g.name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="truncate">{g.name}</span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 shrink-0 text-white" />}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-discord-muted">
          System & Host
        </div>

        <button
          onClick={() => onSelectView("host-server")}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
            currentView === "host-server"
              ? "bg-discord-brand text-white shadow-md font-semibold"
              : "text-discord-muted hover:bg-[#35373c]/60 hover:text-discord-header"
          }`}
        >
          <Activity className={`w-4 h-4 ${currentView === "host-server" ? "text-white" : "text-sky-400"}`} />
          <span className="truncate">Host Server Monitor</span>
        </button>

        <div className="px-2 pt-3 py-1 text-[10px] font-bold uppercase tracking-wider text-discord-muted">
          Server Management
        </div>

        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id as ViewType)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-discord-brand text-white shadow-md font-semibold"
                  : "text-discord-muted hover:bg-[#35373c]/60 hover:text-discord-header"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-discord-muted"}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer: Bot Status & User Badge */}
      <div className="p-3 border-t border-[#1f2023] bg-discord-darkest/60 space-y-2">
        {/* Bot status */}
        <div className="flex items-center justify-between px-2 py-1.5 rounded bg-[#1e1f22] text-xs">
          <div className="flex items-center gap-2">
            <Radio className={`w-3.5 h-3.5 ${botStatus?.ready ? "text-discord-green animate-pulse" : "text-discord-red"}`} />
            <span className="font-medium text-discord-header">
              {botStatus?.ready ? "Bot Online" : "Bot Disconnected"}
            </span>
          </div>
          {botStatus?.ready && (
            <span className="text-[10px] font-mono text-discord-muted">{botStatus.ping}ms</span>
          )}
        </div>

        {/* Owner User Badge */}
        <div className="flex items-center justify-between p-2 rounded-md bg-[#232428]">
          <div className="flex items-center gap-2 overflow-hidden">
            {ownerUser?.avatar ? (
              <img src={ownerUser.avatar} alt="Owner" className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-discord-brand/80 flex items-center justify-center font-bold text-white text-xs">
                {ownerUser?.username ? ownerUser.username.substring(0, 1).toUpperCase() : "O"}
              </div>
            )}
            <div className="truncate">
              <p className="text-xs font-semibold text-discord-header truncate">
                {ownerUser?.username || "Local Owner"}
              </p>
              <p className="text-[10px] text-discord-green font-medium">Dashboard Owner</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            title="Logout"
            className="p-1 text-discord-muted hover:text-discord-red hover:bg-[#35373c] rounded transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
