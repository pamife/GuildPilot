# 🛸 pa_mife

<div align="center">

![pa_mife Banner](https://img.shields.io/badge/pa__mife-Obsidian%20Edition%20v2.0-indigo?style=flat-square&logo=discord&logoColor=white)

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

**pa_mife** verwandelt die Verwaltung deines Discord-Servers in ein intuitives, hochmodernes Dashboard auf **10.000 €-Agentur-Niveau** im **Obsidian-Slate Deep-Dark Design**. Keine lästigen Chat-Befehle mehr – steuere deine Serverstruktur, Support-Tickets, Bewerbungen, Rollen, Backups und Automatisierungen in Echtzeit über eine elegante Weboberfläche.

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
- **Discord-DM-Bewerbungen:** Components-V2-Startpanel, fortsetzbare Entwürfe mit Anhängen und ein privater Review-Kanal pro Formular.

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
- **Docker-Betrieb:** Das produktive Deployment nutzt getrennte, nicht privilegierte Container für Backend/Bot und Frontend.
- **Legacy-Betrieb:** Die bisherige PM2/systemd-Aktualisierungslogik bleibt für bestehende Installationen erhalten, ist innerhalb von Docker jedoch deaktiviert.

---

## 🤖 Wichtige AI- & Entwickler-Hinweise (Host Architecture)

> [!IMPORTANT]
> **Produktiv-Host & Deployment:**
> - **Host OS:** Debian 13 mit Docker Compose.
> - **Deployment:** Docker ist der primäre Produktionsweg. GitHub Actions oder automatisches Deployment sind noch nicht aktiviert.
> - **Build-Integrität:** Jeder Commit auf `main` **MUSS** `npm run build` (TypeScript Backend `tsc` & Next.js Frontend `next build`) fehlerfrei bestehen.
> - **Ports & Prozesse:** Intern bleiben Backend `3001` und Frontend `3000`; Docker veröffentlicht standardmäßig `3101` und `3100`.
> - **Legacy:** PM2, Kali- und systemd-Dateien sind nur noch für ältere Bare-Metal-Installationen vorgesehen.

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
NEXT_PUBLIC_API_URL=http://localhost:3001
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

## 🐳 Produktionsbetrieb mit Docker auf Debian

Docker Compose startet zwei Container aus einem Multi-Stage-Build:

- `guildpilot-frontend`: Next.js Standalone, intern Port `3000`, Host-Port `3100`
- `guildpilot-backend`: Express, Socket.IO, Discord-Bot und Prisma, intern Port `3001`, Host-Port `3101`

Beide Container laufen als unprivilegierter Benutzer, ohne Docker-Socket und mit `restart: unless-stopped`. PM2, systemd, Keep-Awake und die frühere GitHub-Auto-Update-Engine werden im Container nicht benötigt.

### Installation

```bash
sudo mkdir -p /opt/stacks/guildpilot
sudo chown -R "$USER:$USER" /opt/stacks/guildpilot
git clone https://github.com/pamife/GuildPilot.git /opt/stacks/guildpilot
cd /opt/stacks/guildpilot
cp .env.example .env
chmod 600 .env
mkdir -p data/backups transcripts logs
```

Trage anschließend die echten Werte in `.env` ein. Die Datei ist durch `.gitignore` und `.dockerignore` ausgeschlossen.

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=http://100.97.89.86:3101/api/auth/callback
ALLOWED_USER_ID=
JWT_SECRET=
FRONTEND_URL=http://100.97.89.86:3100
CORS_ORIGINS=http://100.97.89.86:3100,http://192.168.178.176:3100
NEXT_PUBLIC_API_URL=http://100.97.89.86:3101
DATABASE_URL=file:/data/guildpilot.db
```

`JWT_SECRET` muss ein eigener, langer Zufallswert sein. Keine Beispielwerte als echte Zugangsdaten verwenden. Der exakte Discord-OAuth-Redirect lautet:

```text
http://100.97.89.86:3101/api/auth/callback
```

### Build und Start

```bash
cd /opt/stacks/guildpilot
docker compose config
docker compose build
docker compose up -d
docker compose ps
```

Beim Start legt das Backend vor jeder Schema-Synchronisierung ein Backup einer vorhandenen Datenbank unter `data/backups/` an und führt anschließend `prisma db push --skip-generate` ohne destructive Flags aus.

### Erstes DM-Bewerbungspanel veröffentlichen

1. Öffne **Application Center → Formulare**. Erstelle ein Formular oder bearbeite ein bestehendes. Lege unter **Fragen** die Fragen und Pflichtfelder an.
2. Trage im Formular unter **Discord DM application** Titel und Beschreibung ein. Wähle einen öffentlichen Startkanal und einen privaten Review-Textkanal. Entziehe `@everyone` im Review-Kanal **View Channel** und erlaube ihn für die vorgesehenen Reviewer-Rollen und den Bot. Der Bot braucht dort auch **Send Messages** und **Read Message History**.
3. Wähle die Reviewer-Rollen und bei Bedarf Statusschritte, eine Ticket-Kategorie und Annahmerollen. Für Tickets braucht der Bot **Manage Channels**. Für die Rollenvergabe braucht er **Manage Roles** und eine höhere Rolle als die zu vergebenden Rollen.
4. Wähle **Save & publish Discord panel**. Über **Update Discord panel** kannst du die veröffentlichte Nachricht später bearbeiten. Teste **Apply → Start application** mit einem Servermitglied und prüfe die Einreichung in der **Review-Queue**.

Reviewer melden sich über Discord am Webpanel an. Der Zugriff richtet sich nach Servermitgliedschaft und den für das Formular hinterlegten Rollen. Discord-Links zu gespeicherten Anhängen führen zum authentifizierten Download über die konfigurierte `NEXT_PUBLIC_API_URL`. Sichere für DM-Bewerbungen das SQLite-Volume und `transcripts/application-files`, damit gespeicherte Anhänge bei einer Wiederherstellung verfügbar sind.

Discord-Panels, Bewerbungs-DMs, Review-Nachrichten und die Begrüßung im Bewerbungsticket verwenden Components V2. Veröffentliche ältere Startpanels erneut über das Application Center, um die vorhandene Nachricht zu aktualisieren. Die nächste Statusänderung aktualisiert auch eine ältere Status-DM im selben Format.

Im Review-Kanal stehen Kopf, Fragen, Antworten, geschützte Dateilinks und Aktionsbuttons gemeinsam in einer kompakten Nachricht. Nur lange Bewerbungen werden auf weitere Nachrichten verteilt. Updates verwenden die vorhandenen Nachrichten erneut. Öffne eine bereits einzeln gepostete Bewerbung in der Review-Queue und wähle **Retry review delivery**, um sie zusammenzufassen. Die Hauptnachricht behält ihre ID; überzählige alte Antwortnachrichten des Bots werden nach erfolgreicher Zustellung entfernt.

### Leveling aktivieren

1. Baue und starte die Docker-Container nach dem Update neu. Der Backend-Start sichert die vorhandene SQLite-Datenbank und ergänzt die Leveling-Tabellen. Bei einer lokal bereits per `db push` verwalteten Datenbank sichere `prisma/dev.db` und führe mit der lokalen `DATABASE_URL` `npx prisma db push` aus. Bei einer per Prisma-Migrationen verwalteten Datenbank nutze nach dem Backup `npx prisma migrate deploy`.
2. Öffne **Community & Interaktion → Leveling** mit **Manage Server** oder **Administrator**. Aktiviere Chat-Leveling und speichere die Einstellungen. Die Vorgabe beträgt 15–25 XP pro Nachricht mit 60 Sekunden Cooldown. Der Relay-Count-Kanal ist standardmäßig ausgeschlossen.
3. Für Rollenbelohnungen braucht der Bot **Manage Roles** und eine Bot-Rolle oberhalb aller Belohnungsrollen. Für Meldungen braucht er im Zielkanal **View Channel** und **Send Messages**. Vorhandene Mitgliederrollen werden bei der nächsten XP-Vergabe, manuellen XP-Änderung oder beim Prestige anhand der Einstellungen aktualisiert.
4. Verwende `/rank`, `/leaderboard` und bei aktiviertem Prestige `/prestige`. Für die Prestige-Rangliste wähle im Discord-Befehl `ranking:Prestige` oder im Panel den Eintrag **Prestige**.

### Relay Count aktivieren

1. Aktiviere im Discord Developer Portal unter **Bot → Privileged Gateway Intents** den **Message Content Intent**. pa_mife fordert beim Start `Guilds`, `GuildMessages` und `MessageContent` an. Starte den Bot nach der Änderung neu.
2. Gib dem Bot im gewünschten Server-Textkanal **View Channel**, **Send Messages**, **Read Message History** und **Add Reactions**.
3. Wähle den Kanal mit `/counting setup channel:#counting` oder im Webpanel unter **Community & Interaktion → Relay Count**. Setup und Reset erfordern **Manage Server**. Ein Kanalwechsel übernimmt den bisherigen Spielstand.
4. Beginnt bei `1` und wechselt euch beim Zählen ab. `/counting stats` und das Webpanel zeigen die nächste Zahl, den Rekord und den Relay Save. Mit `/counting reset` oder der Reset-Schaltfläche im Webpanel könnt ihr nach Bestätigung bei `1` neu starten.

### Aufrufen und überwachen

- Dashboard: `http://100.97.89.86:3100`
- Backend-Healthcheck: `http://100.97.89.86:3101/api/health`
- Uptime Kuma kann den Backend-Healthcheck oder zusätzlich das Frontend überwachen.

```bash
docker compose logs -f
docker compose logs -f backend
docker compose logs -f frontend
```

### Stoppen

```bash
docker compose down
```

Die Daten bleiben dabei in `data/` und `transcripts/` erhalten.

### Aktualisieren

```bash
cd /opt/stacks/guildpilot
git pull --ff-only
docker compose build
docker compose up -d
docker compose ps
```

### SQLite sichern und wiederherstellen

Vor einem manuellen Backup sollte der Backend-Container kurz gestoppt werden, damit die SQLite-Datei konsistent kopiert wird:

```bash
docker compose stop backend
cp -a data/guildpilot.db "data/backups/guildpilot-$(date -u +%Y%m%dT%H%M%SZ).db"
docker compose start backend
```

Wiederherstellung aus einem geprüften Backup:

```bash
docker compose down
cp -a data/backups/GEPRUEFTES_BACKUP.db data/guildpilot.db
docker compose up -d
```

### Legacy-Betrieb

`ecosystem.config.js`, `server-frontend.js`, `scripts/auto-update.*` und `systemd/` bleiben für bestehende PM2-/Bare-Metal-Installationen erhalten. Für das Docker-Deployment sind sie nicht aktiv. Der frühere Kali-spezifische Betrieb ist damit als Legacy markiert.

---

## 🔒 Sicherheitskonzept

- **Getrennte Arbeitsbereiche:** Die in `ALLOWED_USER_ID` hinterlegte Discord-ID verwaltet den Bot. Berechtigte Moderatoren und Bewerbungsprüfer erhalten über denselben Discord-Login einen eingeschränkten Arbeitsbereich. Moderationsrechte werden auch für den Bot-Eigentümer anhand seiner tatsächlichen Servermitgliedschaft und Discord-Rechte geprüft.
- **JWT-Cookie-Authentifizierung:** Signierte JWTs in Session-Cookies mit SameSite- und HttpOnly-Attributen.
- **Lokale Datenhoheit:** Sämtliche Konfigurationen, Backups und Vorlagen verbleiben in der lokalen SQLite-Datenbank.

---

## 📜 Lizenz

Dieses Projekt steht unter der **MIT-Lizenz** – siehe die [LICENSE](LICENSE)-Datei für Details.


## Moderationsarbeitsplatz, AutoMod und Gemini Review

### Einrichtung und Update

1. Sichere die SQLite-Datenbank und `transcripts/`. Auf Debian/Docker: `git pull --ff-only`, `docker compose build`, `docker compose up -d`. Der vorhandene Backend-Entrypoint sichert `/data/guildpilot.db` und synchronisiert das Schema ohne destruktive Optionen. Das Frontend bleibt auf Container-Port 3000, Backend/Bot auf 3001.
2. Für Installationen mit Prisma-Migrationshistorie nach dem Backup `npx prisma migrate deploy` ausführen. Neu sind `20261115010000_moderation_workspace` (additive Moderations-/Review-Felder und Tabellen) und `20261115020000_complete_legacy_schema` (fehlende Tabellen der bisherigen Baseline, mit `IF NOT EXISTS`). Bei älteren `db push`-Installationen weiter den vorhandenen Docker-Entrypoint beziehungsweise `npx prisma db push` ohne `--accept-data-loss` verwenden; eine bestehende Datenbank nicht zurücksetzen. Fallnummern, Regeln und bisherige Rollen bleiben erhalten.
3. Aktiviere **Server Members Intent** und **Message Content Intent** im Discord Developer Portal. Der Bot braucht je nach Funktion **Manage Messages**, **Read Message History**, **Moderate Members**, **Kick Members**, **Ban Members**, **Manage Channels** sowie eine Rolle oberhalb der betroffenen Mitglieder. **View Audit Log** ermöglicht die sichere Zuordnung einer Ban-Rücknahme zum ursprünglichen Fall. Die fehlenden Serverrechte zeigt das Panel; Kanalrechte und Hierarchie prüft jede Aktion frisch.
4. Öffne im Dashboard **Moderation → Einstellungen**. Lege dort den privaten **Mod-Log-Kanal**, die **Rollen pro Berechtigung** und den **DM-Standardwert** fest. Verweigere `@everyone` den Kanalzugriff und gib ihn nur dem Bot und zuständigen Rollen. Leere Rollenlisten geben regulären Mitgliedern kein Recht; Discord-Administratoren benötigen keine zusätzliche GuildPilot-Rolle. Die bisherige Manage-Server-Einstellungsberechtigung bleibt erhalten, bis ausdrücklich Einstellungsrollen konfiguriert werden.
5. Moderatorinnen und Moderatoren melden sich mit dem vorhandenen Discord-Login an. Ihr eingeschränkter Arbeitsbereich bietet auch weiterhin den Wechsel zu Bewerbungen. Nach neu vergebenen Rollen gegebenenfalls neu anmelden. Schreibzugriffe im Moderationsbereich verlangen bei Cookie-Sessions einen erlaubten `Origin`; `FRONTEND_URL`/`CORS_ORIGINS` müssen die tatsächlich verwendete Panel-Adresse enthalten.

### Maßnahmen und Fälle

**Moderation** bietet Mitgliedersuche nach Name/ID sowie Warn, Timeout, Untimeout, Kick, Ban, Unban per ID, Purge und Slowmode. Der Dialog zeigt vor der Ausführung Ziel und Begründung; bei Purge zusätzlich die Höchstzahl. Purge durchsucht die letzten 100 Nachrichten, löscht maximal 1–100 und überspringt Nachrichten ab 14 Tagen; optional ist ein Nutzerfilter möglich. Slowmode `0` schaltet die Wartezeit aus. Dieselben Aktionen sind als `/warn`, `/timeout`, `/untimeout`, `/kick`, `/ban`, `/unban`, `/purge`, `/slowmode` in Discord registriert; `/cases` zeigt den privaten Verlauf.

**Fälle** bietet Suche, Datums-/Nutzer-/Aktions-/Quellen-/Statusfilter und Seiten mit je 25 Fällen. Details zeigen Ergebnis, DM-Zustellung, Discord-Link und verknüpfte Rücknahmen. Warnungen, aktive Timeouts, zuordenbarer Slowmode und eindeutig zuordenbare Bans können mit Begründung über die Falldetails oder Mod-Log-Buttons zurückgenommen werden. Ein alter Timeout-/Ban-Fall hebt keine neuere Maßnahme auf. Eine direkte Unban-Aktion per ID ist unabhängig von einer Fallrücknahme möglich.

Webpanel und Discord verwenden denselben Moderationsservice. Konfigurierte Rollen ersetzen keine Discord-Berechtigungen. Requests reservieren vor Nebenwirkungen eine eindeutige Fallnummer und eine Anfrage-ID; der Aktionsdialog verwendet diese ID bei einem Verbindungsretry erneut. DMs werden vor Kick/Ban versucht und separat protokolliert. Fehler bei DMs oder Logs blockieren die Maßnahme nicht. Ein `pending`-Fall bedeutet, dass die Ausführung nicht sicher bestätigt wurde (beispielsweise Prozessabbruch während einer Discord-Anfrage). GuildPilot wiederholt solche Aktionen nicht automatisch und blockiert weitere Aktionen gegen dasselbe Ziel bis zur administrativen Klärung des Falls anhand des Discord-Zustands und eines Datenbank-Backups. Keine Software kann einen Discord-Aufruf und SQLite gemeinsam atomar bestätigen.

### Regelbasiertes AutoMod

Unter **AutoMod** lassen sich Nachrichtenflut, Wiederholungen, Mention-Spam, Einladungen, Wörter und Domains konfigurieren. Jede Regel startet deaktiviert und bietet Kanal-/Rollenausnahmen sowie `Log only` oder `Delete and log`. Einladungen haben eine Code-Allowlist; Wortfilter optional Ganzwortabgleich; Domainfilter verwenden geparste Hostnamen, Allowlist und eine Subdomain-Option. `@everyone`/`@here` sind separat schaltbar. Bei Flut/Wiederholungen kann eine standardmäßig deaktivierte Eskalation nach mehreren Treffern einen kurzen Timeout auslösen.

Mehrere Regel-Treffer einer Nachricht werden zusammengefasst. Inhaltsfilter prüfen auch Bearbeitungen; dabei werden Counting und XP nicht erneut ausgeführt. Erfolgreich gelöschte neue Nachrichten erreichen Counting und Leveling nicht; Log-only-Nachrichten laufen regulär weiter. Bewerbungs-DMs bleiben ausgenommen. Die Vorschau unter AutoMod verwendet gespeicherte Regeln, simuliert eine Nachricht pro Zeile und führt keine Discord-Aktion aus. Jüngste Treffer stehen darunter, wenn die Fallverlaufsberechtigung vorhanden ist.

### Stündliches Gemini Review

Setze ausschließlich auf dem Backend `GEMINI_API_KEY` und `GEMINI_MODEL` in `.env`. Wähle ein für dein Google-Projekt verfügbares Modell mit Structured Output; Modellnamen und Verfügbarkeit ändern sich. Der Browser erhält nur den Integrationsstatus. Schlüssel werden weder in Fällen noch in Review-Fehlern oder Logs gespeichert. Der offizielle `@google/genai`-Client wird erst bei einem Review-Aufruf verwendet; ein Ausfall verhindert keinen Bot-Start.

Unter **Moderation → Einstellungen → Gemini** aktivierst du die Prüfung und wählst ausdrücklich die Kanäle, kurze Server-/Kanalregeln, Limits und optional einen privaten Zusammenfassungskanal. Die Auswahl weist darauf hin, dass Text an Google Gemini gesendet wird. Kein Kanal wird automatisch ausgewählt. Bekannte Bewerbungs-, Ticket- und Log-Kanäle/Kategorien sind zusätzlich gesperrt. Staff-Kanäle nicht auswählen. Standardmäßig ist die Integration pro Server deaktiviert.

Der erste geplante Lauf erfolgt 60 Minuten nach Aktivierung; danach im 60-Minuten-Abstand mit bis zu einer Minute Scheduler-Toleranz. **Gemini Review → Jetzt prüfen** verwendet dieselben Beschränkungen. Ein Serverlauf sperrt alle seine Kanäle auch gegenüber anderen Backend-Instanzen auf derselben SQLite-Datei. Pro Server und Lauf gelten maximal 200 gelesene Nachrichten einschließlich kurzem Kontext, 100–2000 Zeichen pro Nachricht und 1–5 Modellaufrufe einschließlich begrenzter Retries. Der erste Rückblick ist auf eine Stunde begrenzt. Dauerhafte Kanal-Cursor werden erst gemeinsam mit validierten Hinweisen bestätigt; Fehler überspringen nichts. Bei Rückstau bleiben spätere Nachrichten für folgende Läufe erhalten. Kanalrotation bevorzugt länger nicht erfolgreich geprüfte Kanäle.

Nur Text menschlicher normaler Nachrichten/Antworten wird verarbeitet. Dateien, Bilder, Webhooks, Bot-/Systemnachrichten und Nutzerprofile werden nicht gesendet; Links werden nicht geladen. Prompt-Injection-Anweisungen im Chat gelten als Daten. Gemini hat keine Tools oder Moderationsrechte. Das strukturierte Ergebnis wird serverseitig validiert; Hinweise mit fremden Referenzen werden verworfen. Gespeichert werden kurze Hinweise, Nachrichten-/Nutzerreferenzen, Bearbeitungsstatus und Laufmetadaten, kein Chatarchiv.

**Gemini Review** zeigt offene/geprüfte/als Fehlalarm geschlossene Hinweise, Zuweisungen, Nachrichtenlinks, letzten erfolgreichen Lauf, nächsten Termin und Fehler. Eine manuelle Maßnahme öffnet denselben Bestätigungsdialog mit vorausgefülltem Kontext. Ihre tatsächliche Berechtigung wird erneut geprüft. Erst eine erfolgreiche Maßnahme verknüpft Hinweis und Fall; eine Modellantwort allein erzeugt niemals Warnungen, DMs, Löschungen oder Sanktionen.

### Prüfungen und API-Referenzen

```sh
npm run test:counting
npm run test:leveling
npm run test:applications
npm run test:moderation
npm run test:moderation-workspace
npm run test:migrations
npm run test:plugins
npm run test:giveaways
npm run typecheck
npm run lint
npm run build
```

`test:moderation-workspace` verwendet temporäres SQLite, echte Express-Routen und Discord-/Gemini-Mocks. Es prüft Rechte/CSRF/IDOR, Idempotenz, Maßnahmen/Rücknahmen, Filter/Bearbeitungen, Cursor, Retries, parallele Reviews, Prompt-Injection und die ausdrücklich bestätigte Fallverknüpfung. `test:migrations` prüft mit gesichertem Testbestand ein Upgrade und den vollständigen Schemaabgleich. Die übrigen Integrationsprüfungen decken unter anderem neue Datenbanken sowie Counting-/XP-Verhalten ab. `npm run test:security` benötigt einen laufenden Test-Backend-Prozess und passende Testwerte für `API_BASE_URL`, `JWT_SECRET` und `ALLOWED_USER_ID`; niemals hierfür Produktionsschlüssel einsetzen. Die bestehenden Hook-/Bildoptimierungswarnungen sind nicht fatal.

Verwendete offizielle API-Dokumentation: [Discord-Mitglieder, Timeouts und Bans](https://docs.discord.com/developers/resources/guild), [Nachrichten, Pagination und Bulk Delete](https://docs.discord.com/developers/resources/message), [Kanal-Slowmode](https://docs.discord.com/developers/resources/channel), [Components V2](https://docs.discord.com/developers/components/overview), [Gemini Structured Output](https://ai.google.dev/gemini-api/docs/structured-output), [Google GenAI HTTP-Timeouts und Retries](https://googleapis.github.io/js-genai/release_docs/interfaces/types.HttpOptions.html).

## Giveaways

Der [Giveaways-Leitfaden](docs/giveaways.md) beschreibt die Aktivierung, private Gewinnerfreigabe, Preisabholung und das Deployment.
