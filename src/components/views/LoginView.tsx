"use client";

import React from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Hash,
  LockKeyhole,
  Shield,
  Sparkles,
  Ticket,
  Users,
  Zap,
} from "lucide-react";
import { Brand } from "@/components/Brand";
import { getApiBaseUrl } from "@/lib/api";

interface LoginViewProps {
  authWarning?: string | null;
  authError?: string | null;
}

export function LoginView({ authWarning, authError }: LoginViewProps) {
  const [originUrl, setOriginUrl] = React.useState("");
  React.useEffect(() => setOriginUrl(window.location.origin), []);
  const loginUrl = `${getApiBaseUrl()}/api/auth/login${originUrl ? `?return_to=${encodeURIComponent(originUrl)}` : ""}`;

  return (
    <div className="gp-public-page">
      <header className="gp-public-header">
        <Brand />
        <a href={loginUrl} className="gp-button gp-button-secondary">
          Dashboard öffnen <ArrowUpRight size={16} />
        </a>
      </header>
      <main className="gp-login-main">
        <div className="gp-login-copy">
          <span className="gp-eyebrow">
            <span className="gp-status-dot" /> DEIN DISCORD. DEIN CONTROL
            CENTER.
          </span>
          <h1>
            Große Community.
            <br />
            Volle Kontrolle<span className="gp-accent">.</span>
          </h1>
          <p className="gp-lead">
            Weniger Verwaltung. Mehr Miteinander. Bring deinen Server auf Kurs –
            mit einem Zuhause für alles, was deine Community braucht.
          </p>
          {authError && (
            <div role="alert" className="gp-alert gp-alert-error">
              {authError === "oauth_failed"
                ? "Discord-Login fehlgeschlagen. Bitte versuche es erneut."
                : authError}
            </div>
          )}
          {authWarning && (
            <div role="alert" className="gp-alert">
              Die Discord-Anmeldung ist noch nicht vollständig eingerichtet.
              Wende dich bitte an den Betreiber.
            </div>
          )}
          <a
            href={loginUrl}
            className="gp-button gp-button-primary gp-login-cta"
          >
            Mit Discord loslegen <ArrowRight size={19} />
          </a>
          <p className="gp-login-note">
            <LockKeyhole size={13} /> Sicher anmelden über Discord OAuth2
          </p>
          <div className="gp-login-benefits">
            <span>
              <Check size={15} /> Alles an einem Ort
            </span>
            <span>
              <Check size={15} /> Änderungen in Echtzeit
            </span>
          </div>
        </div>
        <div
          className="gp-login-visual"
          aria-label="Vorschau der GuildPilot-Funktionen"
        >
          <div className="gp-orbit gp-orbit-one" />
          <div className="gp-orbit gp-orbit-two" />
          <div className="gp-preview">
            <div className="gp-preview-top">
              <Brand compact />
              <span>Dein Community-Hub</span>
              <span className="gp-preview-label">VORSCHAU</span>
            </div>
            <div className="gp-preview-heading">
              <span className="gp-eyebrow">ALLES IM BLICK</span>
              <h2>Bereit für das nächste Level.</h2>
              <p>Ein Panel. Alle Möglichkeiten.</p>
            </div>
            <div className="gp-preview-metrics">
              {[
                {
                  icon: Users,
                  label: "Community",
                  text: "Verbinden",
                  color: "mint",
                },
                {
                  icon: Shield,
                  label: "Verwaltung",
                  text: "Gestalten",
                  color: "violet",
                },
                {
                  icon: Zap,
                  label: "Automation",
                  text: "Entlasten",
                  color: "amber",
                },
              ].map(({ icon: Icon, label, text, color }) => (
                <div key={label}>
                  <span className={`gp-icon gp-icon-${color}`}>
                    <Icon size={18} />
                  </span>
                  <strong>{text}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <div className="gp-preview-row">
              <span className="gp-icon gp-icon-mint">
                <Hash size={18} />
              </span>
              <div>
                <strong>Platz für gute Gespräche</strong>
                <span>Kanäle & Server-Struktur</span>
              </div>
              <ArrowUpRight size={17} />
            </div>
            <div className="gp-preview-row">
              <span className="gp-icon gp-icon-violet">
                <Ticket size={18} />
              </span>
              <div>
                <strong>Support, der ankommt</strong>
                <span>Tickets & Bewerbungen</span>
              </div>
              <ArrowUpRight size={17} />
            </div>
            <div className="gp-preview-footer">
              <Sparkles size={15} />
              <span>Deine Community steht im Mittelpunkt.</span>
            </div>
          </div>
          <div className="gp-floating-note">
            <span className="gp-icon gp-icon-mint">
              <Check size={20} />
            </span>
            <div>
              <strong>Weniger Klicks. Mehr Community.</strong>
              <span>Das ist GuildPilot.</span>
            </div>
          </div>
        </div>
        <section className="gp-feature-strip" aria-label="Funktionen">
          {[
            {
              n: "01",
              title: "Community aufbauen",
              text: "Willkommensnachrichten, Leveling und Self-Roles.",
              icon: Users,
            },
            {
              n: "02",
              title: "Support vereinfachen",
              text: "Tickets und Bewerbungen an einem Ort.",
              icon: Ticket,
            },
            {
              n: "03",
              title: "Kontrolle behalten",
              text: "Kanäle, Rollen und Backups für deinen Server.",
              icon: Shield,
            },
          ].map(({ n, title, text, icon: Icon }) => (
            <article key={n}>
              <span className="gp-feature-number">{n} /</span>
              <Icon size={20} />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </section>
      </main>
      <footer className="gp-public-footer">
        <span>GuildPilot · Für deine Community gebaut.</span>
        <span>Dein Server. Deine Regeln.</span>
      </footer>
    </div>
  );
}
