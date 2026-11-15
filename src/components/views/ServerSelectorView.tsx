"use client";

import React, { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Crown,
  LogOut,
  Plus,
  Search,
  Server,
  Users,
} from "lucide-react";
import { Brand } from "@/components/Brand";

interface GuildOption {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
}
interface ServerSelectorViewProps {
  user: {
    id: string;
    username: string;
    avatar: string | null;
    role: "OWNER" | "USER";
  };
  isOwner: boolean;
  guilds: GuildOption[];
  onSelectGuild: (guildId: string) => void;
  onOpenOwnerDashboard: () => void;
  onLogout: () => void;
}

export function ServerSelectorView({
  user,
  isOwner,
  guilds,
  onSelectGuild,
  onOpenOwnerDashboard,
  onLogout,
}: ServerSelectorViewProps) {
  const [search, setSearch] = useState("");
  const clientId =
    process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || "1533187416230461490";
  const botInviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=1616413846775&scope=bot%20applications.commands`;
  const filteredGuilds = guilds.filter((guild) =>
    guild.name.toLocaleLowerCase("de").includes(search.toLocaleLowerCase("de")),
  );

  return (
    <div className="gp-public-page">
      <header className="gp-public-header">
        <Brand />
        <div className="gp-account">
          {user.avatar ? (
            <img className="gp-avatar" src={user.avatar} alt="" />
          ) : (
            <span className="gp-avatar gp-avatar-fallback">
              {user.username.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="gp-account-name">
            <strong>{user.username}</strong>
            <span>{isOwner ? "Owner" : "Dein Workspace"}</span>
          </div>
          <button
            onClick={onLogout}
            className="gp-icon-button"
            aria-label="Abmelden"
            title="Abmelden"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <main className="gp-servers-main">
        <section className="gp-welcome-heading">
          <div>
            <span className="gp-eyebrow">DEIN WORKSPACE</span>
            <h1>
              Hey {user.username}
              <span className="gp-accent">.</span>
              <br />
              Was steht heute an?
            </h1>
            <p>
              Deine Communities. Deine Möglichkeiten. Wähle einen Server und leg
              los.
            </p>
          </div>
          <div className="gp-workspace-count">
            <Server size={23} />
            <strong>{guilds.length.toLocaleString("de-DE")}</strong>
            <span>verfügbare Server</span>
          </div>
        </section>
        {isOwner && (
          <button className="gp-owner-banner" onClick={onOpenOwnerDashboard}>
            <span className="gp-icon gp-icon-amber">
              <Crown size={21} />
            </span>
            <span>
              <strong>Ein Blick hinter die Kulissen</strong>
              <span>
                Host-Auslastung, Bot-Prozesse und Updates im Owner Control
                Center.
              </span>
            </span>
            <ArrowUpRight size={22} />
          </button>
        )}
        <section aria-labelledby="servers-heading">
          <div className="gp-section-toolbar">
            <h2 id="servers-heading">
              Deine Server <span className="gp-count">{guilds.length}</span>
            </h2>
            <label className="gp-search">
              <Search size={16} />
              <input
                aria-label="Server suchen"
                placeholder="Server suchen …"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          {guilds.length === 0 ? (
            <div className="gp-empty">
              <Server size={32} />
              <h3>Dein nächstes Projekt wartet.</h3>
              <p>
                Noch kein berechtigter Server gefunden. Lade GuildPilot ein und
                stelle sicher, dass du dort „Server verwalten“- oder
                Administrator-Rechte besitzt.
              </p>
              <a
                className="gp-button gp-button-primary"
                href={botInviteUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                GuildPilot einladen <Plus size={17} />
              </a>
            </div>
          ) : (
            <>
              {filteredGuilds.length === 0 && (
                <div className="gp-empty">
                  <Search size={28} />
                  <h3>Kein Server gefunden</h3>
                  <p>Versuche einen anderen Suchbegriff.</p>
                  <button
                    className="gp-button gp-button-secondary"
                    onClick={() => setSearch("")}
                  >
                    Suche zurücksetzen
                  </button>
                </div>
              )}
              <div className="gp-server-grid">
                {filteredGuilds.map((guild, index) => (
                  <button
                    className="gp-server-card"
                    key={guild.id}
                    onClick={() => onSelectGuild(guild.id)}
                  >
                    <div
                      className={`gp-server-cover gp-server-cover-${index % 3}`}
                    >
                      <span className="gp-server-monogram" aria-hidden="true">
                        {guild.name.slice(0, 2).toUpperCase()}
                      </span>
                      <ArrowUpRight size={23} />
                    </div>
                    <div className="gp-server-card-body">
                      {guild.icon ? (
                        <img
                          src={guild.icon}
                          alt=""
                          className="gp-guild-avatar"
                        />
                      ) : (
                        <span className="gp-guild-avatar gp-avatar-fallback">
                          {guild.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <h3>{guild.name}</h3>
                      <p>
                        <Users size={14} />
                        {guild.memberCount.toLocaleString("de-DE")} Mitglieder
                      </p>
                      <div className="gp-server-card-footer">
                        <span>Workspace öffnen</span>
                        <ArrowRight size={17} />
                      </div>
                    </div>
                  </button>
                ))}
                <a
                  className="gp-server-add"
                  href={botInviteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="gp-icon">
                    <Plus size={25} />
                  </span>
                  <strong>Platz für mehr.</strong>
                  <span>
                    Verbinde deinen nächsten Server
                    <br />
                    mit GuildPilot.
                  </span>
                  <span className="gp-text-link">
                    Bot einladen <ArrowUpRight size={16} />
                  </span>
                </a>
              </div>
            </>
          )}
        </section>
      </main>
      <footer className="gp-public-footer">
        <span>GuildPilot · Für deine Community gebaut.</span>
        <span>Dein Server. Deine Regeln.</span>
      </footer>
    </div>
  );
}
