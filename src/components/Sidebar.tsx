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
  ClipboardList,
  Tag,
  MessageSquareText,
  Sparkles,
  Download,
} from "lucide-react";

export type ViewType =
  | "overview"
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
    { id: "server-clone", label: "Server Importer", icon: Download },
    { id: "welcome", label: "Welcome & Goodbyes", icon: Sparkles },
    { id: "auto-react", label: "Auto Emojis & Reactions", icon: Smile },
    { id: "custom-messages", label: "Custom Messages & V2", icon: MessageSquareText },
    { id: "applications", label: "Applications", icon: ClipboardList },
    { id: "tickets", label: "Ticket System", icon: Ticket },
    { id: "self-roles", label: "Self Roles", icon: Tag },
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
    <aside className="w-64 bg-[#000000] flex flex-col h-screen border-r border-[#18181b] shrink-0 select-none">
      {/* Header / Server Selector */}
      <div className="p-3 border-b border-[#18181b] bg-[#050507] relative z-30">
        <div className="relative">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block px-2">
            Selected Server
          </label>

          <div
            onClick={() => setIsServerDropdownOpen((prev) => !prev)}
            className="flex items-center justify-between p-2 rounded-xl bg-[#090a0f] border border-[#27272a] hover:border-discord-brand transition-all cursor-pointer shadow-inner"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              {selectedGuild?.icon ? (
                <img
                  src={selectedGuild.icon}
                  alt={selectedGuild.name}
                  className="w-8 h-8 rounded-full object-cover shrink-0 border border-[#27272a]"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-discord-brand/20 border border-discord-brand/40 flex items-center justify-center font-bold text-discord-brand text-xs shrink-0">
                  {selectedGuild?.name ? selectedGuild.name.substring(0, 2).toUpperCase() : "GP"}
                </div>
              )}
              <div className="truncate">
                <p className="text-sm font-bold text-white truncate">
                  {selectedGuild?.name || "Select Server"}
                </p>
                <p className="text-[11px] text-zinc-400 truncate">
                  {selectedGuild ? `${selectedGuild.memberCount} members` : "No server available"}
                </p>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${isServerDropdownOpen ? "rotate-180" : ""}`} />
          </div>

          {/* Interactive Server Selector Dropdown Menu */}
          {isServerDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#090a0f] border border-[#27272a] rounded-xl shadow-2xl p-2 space-y-1 max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-150 z-50">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-2 py-1 flex items-center justify-between">
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
                <p className="text-xs text-zinc-500 p-3 text-center">No servers found. Is bot connected?</p>
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
                          : "text-zinc-400 hover:bg-[#18181b] hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        {g.icon ? (
                          <img src={g.icon} alt="" className="w-6 h-6 rounded-full shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-discord-brand/20 flex items-center justify-center font-bold text-discord-brand text-[10px] shrink-0">
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

      {/* Navigation Links */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-3 py-1.5">
          Server Management
        </div>

        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id as ViewType)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? "bg-discord-brand text-white shadow-lg shadow-discord-brand/20 font-bold"
                  : "text-zinc-400 hover:text-white hover:bg-[#0c0d12]"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-zinc-400"}`} />
              <span>{item.label}</span>
            </button>
          );
        })}

        <div className="pt-4 border-t border-[#18181b] my-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-3 py-1.5">
            System & Infrastructure
          </div>
          <button
            onClick={() => onSelectView("host-server")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              currentView === "host-server"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 font-bold"
                : "text-zinc-400 hover:text-white hover:bg-[#0c0d12]"
            }`}
          >
            <Server className={`w-4 h-4 ${currentView === "host-server" ? "text-white" : "text-emerald-400"}`} />
            <span>Host Server & System</span>
          </button>
        </div>
      </nav>

      {/* Bot & User Status Footer */}
      <div className="p-3 border-t border-[#18181b] bg-[#050507] space-y-2">
        {/* Bot Status */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-[#090a0f] border border-[#18181b] text-xs">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${botStatus?.ready ? "bg-emerald-500 shadow-sm shadow-emerald-500" : "bg-rose-500 animate-pulse"}`} />
            <span className="font-semibold text-zinc-300 text-[11px]">
              {botStatus?.ready ? botStatus.tag : "Bot Offline"}
            </span>
          </div>
          {botStatus?.ready && (
            <span className="text-[10px] font-mono text-zinc-500">{botStatus.ping}ms</span>
          )}
        </div>

        {/* User Info */}
        <div className="flex items-center justify-between pt-1 px-1">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded-full bg-discord-brand/20 border border-discord-brand/40 flex items-center justify-center text-discord-brand font-bold text-xs shrink-0">
              {ownerUser?.username ? ownerUser.username.substring(0, 1).toUpperCase() : "U"}
            </div>
            <span className="text-xs font-bold text-white truncate">
              {ownerUser?.username || "Dashboard User"}
            </span>
          </div>

          <button
            onClick={onLogout}
            title="Logout"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-[#18181b] transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
