# 🛸 GuildPilot

<div align="center">

![GuildPilot Banner](https://img.shields.io/badge/GuildPilot-Obsidian%20Edition%20v2.0-indigo?style=for-the-badge&logo=discord&logoColor=white)

**Das ultimative, lokale Discord-Server-Management-Panel & Automations-System.**  
Gebaut mit **Next.js 14, React 18, Tailwind CSS, TypeScript, Discord.js v14, Express, Socket.IO & Prisma (SQLite)**.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14.15-5865F2?style=flat-square&logo=discord)](https://discord.js.org/)
[![Prisma](https://img.shields.io/badge/Prisma-SQLite-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS%20v3.4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

</div>

---

## 🌟 Übersicht & Highlights

**GuildPilot** verwandelt die Verwaltung deines Discord-Servers in ein intuitives, hochmodernes Dashboard auf **10.000 €-Agentur-Niveau** im **Obsidian-Slate Deep-Dark Design**. Keine lästigen Chat-Befehle mehr – steuere deine Serverstruktur, Support-Tickets, Bewerbungen, Rollen, Backups und Automatisierungen in Echtzeit über eine elegante Weboberfläche.

---

## 🚀 Funktionsübersicht

### 📊 1. Übersicht & Live-Diagnostik
- **Interaktives SVG-Donut-Chart:** Live-Kanalaufteilung (Text, Voice, Kategorien, Foren).
- **KPI-Metriken:** Echtzeit-Zähler für Mitglieder, Rollen, Emojis, Sticker und aktive Einladungen.
- **Bot-Telemetrie:** Gateway-Ping in ms, Uptime und Verbindungsstatus via Socket.IO.
- **Quick-Actions:** 4 Sofort-Aktionskarten für Server-Backup, Kanäle, Rollen und Tickets.

### 💬 2. Kanal- & Kategoriemanager
- **Visueller Kanalbaum:** Übersichtliche Gliederung aller Kanäle nach Kategorien.
- **Symbol- & Style-Presets:** Schnellvorlagen für saubere Discord-Kanalnamen (`│`, `・`, `『』`, `【】`, `»`).
- **Erweiterte Einstellungen:** Slowmode (bis 6h), NSFW-Status, Thema, Bitrate und User-Limits.
- **Kategorie-Verschiebung:** Kanäle per Dropdown oder Schnellaktion zwischen Kategorien bewegen.

### 🎭 3. Rollen-Manager & Berechtigungsmatrix
- **Bitfield-Matrix:** Interaktive Toggles für alle Discord-Berechtigungen (Administrator, Kanäle verwalten, Nachrichten senden, Timeouts etc.).
- **Farbpaletten:** Vorgefertigte Discord-Farben oder freie Hex-Code-Wahl.
- **Hierarchie-Reihenfolge:** Sortiere Rollen per Klick nach oben oder unten.
- **Sicherheits-Indikatoren:** Farbige Badges für administrative und gefährliche Rechte.

### 👥 4. Mitglieder-Manager & Moderation
- **Mitglieder-Filter:** Sofortige Filterung nach Menschen, Bots, Server-Boostern, Voice-Status und Timeouts.
- **Individuelle Moderation:** Nickname ändern, Rollen vergeben/entziehen, Timeout verhängen, Kicken oder Bannen.
- **Voice-Steuerung:** Mitglieder stummschalten (Server Mute/Deafen), in andere Sprachkanäle verschieben oder trennen.
- **Massen-Aktionen (Bulk):** Mehrere Mitglieder gleichzeitig auswählen und Rollen vergeben, kicken oder mit Timeout belegen.
- **Bans-Verwaltung:** Vollständige Ban-Liste mit Gründen und Entbannungs-Funktion.

### 🎫 5. Ticket-Support-Engine
- **Interaktive Ticket-Panels:** Benutzerdefinierte Embeds mit Buttons oder Dropdown-Menüs.
- **Intake-Fragebögen:** Modale Formulare mit Pflichtfeldern, bevor ein Ticket erstellt wird.
- **Kategorien & Rollen-Routing:** Tickets automatisch in Ziel-Kategorien erstellen und Support-Rollen zuweisen.
- **Transkripte & Protokolle:** Vollständiger Nachrichtenverlauf, Claim-System für Supporter und Ticket-Logs.

### 📝 6. Bewerbungs- & Formular-Engine (Application Center)
- **Formular-Baukasten:** Eigene Bewerbungsformulare mit Kurzantworten, Textfeldern und Validierung.
- **Review-Queue:** Übersichtliche Prüfungsliste für Moderatoren mit Notizfunktion.
- **Entscheidungsworkflow:** Bewerbungen annehmen, ablehnen oder auf die Warteliste setzen.
- **Automatische Aktionen:** Automatische Vergabe von Teamrollen und DM-Benachrichtigung des Bewerbers bei Annahme/Ablehnung.

### 🏷️ 7. Self-Roles & Reaktions-Panels
- **Button- & Dropdown-Panels:** Interaktive Rollen-Panels mit Live-Mitgliederzählern.
- **Auswahlmodi:** Einzelne Auswahl (Radio) oder Mehrfachauswahl (Multi-Select) mit Höchstgrenzen.
- **Echtzeit Discord-Simulator:** Live-Vorschau der Embeds und Buttons während der Bearbeitung.

### ✉️ 8. Benutzerdefinierte Nachrichten & Embed-Designer
- **Embed-Baukasten:** Titel, Beschreibung, Farben, Autoren, Thumbnails, Banner-Bilder, Felder und Footer.
- **Vorlagenbibliothek:** Speichere entworfene Embeds dauerhaft in der lokalen Datenbank.
- **Direktversand:** Sende oder bearbeite Nachrichten in jedem beliebigen Textkanal.

### ✨ 9. Willkommens- & Abschieds-System
- **Canvas-Kartengenerator:** Dynamisch gerenderte Willkommenskarten (`@napi-rs/canvas`) mit Avatar, Farbverläufen und Glow-Ringen.
- **Autoroles:** Automatische Rollenzuweisung für neue Mitglieder.
- **Willkommens-DMs:** Persönliche Begrüßungsnachrichten direkt im Postfach des neuen Nutzers.

### ⚡ 10. Auto-Reactions & Reaktionsregeln
- **Automatische Reaktionen:** Weise dem Bot an, auf bestimmte Stichwörter, Kanäle oder alle Nachrichten mit Emojis zu reagieren.
- **Unicode- & Custom-Emojis:** Volle Unterstützung für Standard- und Server-Emojis.

### 💾 11. Server-Backups & Notfall-Sicherung
- **Vollständige Server-Snapshots:** Sichert alle Kanäle, Berechtigungen, Kategorien, Rollen, Emojis und Bot-Module in SQLite.
- **Notfall-Backup (Bot Left):** Erstellt automatisch einen vollständigen Snapshot, falls der Bot den Server verlässt (`guildDelete`).
- **JSON Import & Export:** Backups als Datei herunterladen oder importieren.
- **Selektiver Restore:** Wähle gezielt, ob nur Rollen, Kanäle oder Module wiederhergestellt werden sollen.

### 🔄 12. Server-Modul-Kloner & Schnell-Import
- **Cross-Server Migration:** Übertrage Ticket-Systeme, Bewerbungsformulare, Nachrichten und Willkommens-Settings mit einem Klick von einem Server auf einen anderen.

### 🧹 13. Server Cleaner & Reset (Danger Zone)
- **Gezielte Server-Bereinigung:** Lösche Kanäle, Kategorien, Rollen, Emojis oder Datenbank-Configs mit Sicherheitsabfrage.
- **Automatisches Sicherheits-Backup:** Vor jedem Löschvorgang wird automatisch ein Snapshot erstellt.

### 🖥️ 14. Host-Server & Live-Telemetrie
- **Hardware-Monitoring:** CPU-Auslastung (pro Kern), RAM-Verbrauch, Festplattenbelegung und Netzwerktraffic.
- **GitHub Auto-Update Engine:** 6-Schritte Update-Pipeline (Git Fetch, Backup, Git Pull, npm install, Prisma Sync, Build, PM2 Restart) mit Live-Terminal-Logs.
- **Hosting Environment:** Der Bot und das Webpanel laufen 24/7 produktiv auf einer **Linux (Kali Linux)** Maschine, welche Änderungen automatisch via GitHub `origin/main` synchronisiert, baut und via PM2 neustartet.

---

## 🤖 Wichtige AI- & Entwickler-Hinweise (Host Architecture)

> [!IMPORTANT]
> **Produktiv-Host & Continuous Deployment:**
> - **Host OS:** Linux (Kali Linux).
> - **Deployment:** Der Server pollt/zieht neue Commits automatisch von GitHub (`main` Branch) und führt `scripts/auto-update.js` / `scripts/auto-update.sh` aus.
> - **Build-Integrität:** Jeder Commit auf `main` **MUSS** `npm run build` (TypeScript Backend `tsc` & Next.js Frontend `next build`) fehlerfrei bestehen.
> - **Ports & Prozesse:** Backend läuft auf Port `3001` (`dist/backend/server.js`), Frontend läuft auf Port `3000` (`server-frontend.js`). Gesteuert via PM2 (`ecosystem.config.js`).
- **Dienste-Status:** Überwachung von Hintergrund-Diensten wie `keep-awake`.

### 🔗 15. Einladungs-, Emoji- & Sticker-Manager
- **Invite-Generator:** Einladungslinks mit maximalen Nutzungen, Ablaufzeiten und temporärer Mitgliedschaft erstellen.
- **Asset-Uploader:** Eigene Server-Emojis (auch animierte GIFs) und Sticker direkt im Webpanel hochladen.

---

## 🛠️ Technologie-Stack

| Schicht | Technologie |
|---|---|
| **Frontend Framework** | [Next.js 14](https://nextjs.org/) (App Router, React 18) |
| **Styling & Design** | [Tailwind CSS](https://tailwindcss.com/), Lucide Icons, Custom Scrollbars |
| **Backend API** | [Node.js](https://nodejs.org/), [Express.js](https://expressjs.com/), [TypeScript](https://www.typescriptlang.org/) |
| **Discord API** | [Discord.js v14](https://discord.js.org/) (Gateway & REST) |
| **Echtzeit-Synchronisation** | [Socket.IO](https://socket.io/) (Bi-direktionale Live-Events) |
| **Datenbank & ORM** | [SQLite](https://www.sqlite.org/), [Prisma ORM](https://www.prisma.io/) |
| **Grafik-Rendering** | [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas) (High-Performance Canvas) |

---

## 📦 Installation & Schnellstart

### 1. Voraussetzungen
- **Node.js:** v18.0.0 oder neuer
- **npm** (oder `pnpm` / `yarn`)
- Eine erstellte Discord-Anwendung im [Discord Developer Portal](https://discord.com/developers/applications) mit aktivierten **Privileged Gateway Intents** (Server Members Intent, Message Content Intent).

### 2. Repository klonen
```bash
git clone https://github.com/pamife/GuildPilot.git
cd GuildPilot
npm install
```

### 3. Umgebungsvariablen konfigurieren
Kopiere `.env.example` zu `.env`:
```bash
cp .env.example .env
```

Trage deine Discord-Bot-Daten ein:
```env
# Discord Bot & OAuth2
DISCORD_TOKEN=dein_discord_bot_token
DISCORD_CLIENT_ID=deine_client_id
DISCORD_CLIENT_SECRET=dein_client_secret
DISCORD_REDIRECT_URI=http://localhost:3001/api/auth/callback
ALLOWED_USER_ID=deine_discord_user_id

# Authentifizierung & Sicherheit
JWT_SECRET=dein_geheimes_jwt_token_hier

# Datenbank
DATABASE_URL="file:./dev.db"

# Server Ports (Optional)
PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### 4. Datenbank initialisieren
```bash
npx prisma db push
```

### 5. Entwicklungsserver starten
Startet das Next.js-Frontend (Port `3000`) und den Express/Discord-Backend-Server (Port `3001`) parallel:
```bash
npm run dev
```

Öffne anschließend dein Webpanel im Browser unter:  
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🚀 Produktionsbetrieb & Deployment

### Build erstellen
```bash
npm run build
```

### Starten mit PM2 (Empfohlen für Server / VPS)
```bash
pm2 start ecosystem.config.js
# oder direkt:
npm start
```

---

## 🔒 Sicherheitskonzept

- **Single-Owner-Prinzip:** Der Zugriff auf das Dashboard ist strikt auf die in `ALLOWED_USER_ID` hinterlegte Discord-ID beschränkt.
- **JWT-Cookie-Authentifizierung:** Sichere, verschlüsselte Session-Cookies mit SameSite- und HttpOnly-Attributen.
- **Lokale Datenhoheit:** Sämtliche Konfigurationen, Backups und Vorlagen verbleiben in der lokalen SQLite-Datenbank.

---

## 📜 Lizenz

Dieses Projekt steht unter der **MIT-Lizenz** – siehe die [LICENSE](LICENSE)-Datei für Details.
