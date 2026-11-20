# Giveaways

Öffne im Dashboard den gewünschten Discord-Server und aktiviere **Plugins → Giveaways**. Die Aktivierung, Standardeinstellungen, Vorlagen, Teilnahmen, Ziehungen und Audit-Logs gelten jeweils für diesen Server. Die Verwaltung setzt in Discord die Berechtigung **Server verwalten** voraus. Der Backend-Zugriff wird pro Anfrage anhand der aktuellen Servermitgliedschaft und Discord-Berechtigungen geprüft.

## Discord vorbereiten

- Der Bot benötigt **Kanal ansehen**, **Nachrichten senden** und **Nachrichtenverlauf lesen** in Giveaway-, Gewinner- und Audit-Kanal. Der Nachrichtenverlauf erlaubt dem Bot, nach einem Zustellungsabbruch bereits gesendete Nachrichten wiederzufinden.
- Eine optionale Ping-Rolle muss erwähnbar sein oder der Bot benötigt das Recht, sie im Giveaway-Kanal zu erwähnen. Der Bot sendet den auf diese Rolle begrenzten Ping zusammen mit einem Link zur Ankündigung.
- Verwende für Audit-Meldungen einen privaten Teamkanal. Discord-Meldungen enthalten Ereignistyp und Audit-Referenz. Die Einzelheiten sind im Dashboard sichtbar.
- Aktiviere für den Bot den **Server Members Intent**, damit Änderungen an Mitgliedschaften und Rollen live im Dashboard einlaufen. Einträge und Gewinner werden bei Bedarf zusätzlich über Discord verifiziert.

## Erstellen, planen und verwalten

1. Lege unter **Einstellungen** die Kanäle, Zeitzone, Standarddauer und Teilnahmebedingungen fest. **Manuelle Prüfung** ist die Standardeinstellung für Ziehung und Veröffentlichung.
2. Öffne **Giveaway erstellen** oder verwende eine gespeicherte Vorlage. Gib Preis, Gestaltung, Teilnahmebedingungen, Abholoptionen und Zeitplan an. Start und Ende werden in der gewählten IANA-Zeitzone eingegeben und als UTC gespeichert. Bei einer doppelt auftretenden Ortszeit kannst du den späteren Zeitpunkt wählen.
3. **Vorschau anzeigen** rendert die Components-V2-Nachricht aus demselben Backend-Builder, der die Discord-Ankündigung erstellt. **Info** öffnet die Vorschau der privaten Detailansicht mit Beschreibung, Teilnahmebedingungen, Regeln und genauen Fristen. Die Ankündigung zeigt Preis, Status, Teilnehmerzahl und die verfügbaren Aktionen. Beim Neustart aktualisiert der Bot Ankündigungen für aktive und pausierte Giveaways.
4. Speichere den Entwurf und wähle **Jetzt veröffentlichen** oder **Start planen**. Veröffentlichte Bedingungen und Gewinnchancen sind gesperrt. Während des Giveaways kannst du unter **Ankündigung gestalten** die Darstellung aktualisieren und im selben Tab pausieren, fortsetzen, verlängern, vorzeitig beenden oder stornieren.
5. Unter **Teilnahmen** stehen Suchfunktion, Filter, Verifikationsdetails und Teilnahmeverlauf zur Verfügung. Solange das Giveaway offen ist, kann das Team erneut prüfen, einen Risikohinweis einordnen oder mit protokollierter Begründung ausschließen. Mitgliedschaft, Kontoalter, Rollen und Mitgliedschaftsdauer sind getrennte Prüfungen.

Ein Eintrag pro Discord-Nutzer zählt gleich viel. Heuristische Hinweise wie ein junges Konto oder mehrfach abgewiesene Klicks ändern die Gewinnchance nicht. Wenn du die erneute Rollen- und Altersprüfung ausschaltest, werden dafür die erfolgreichen oder fehlgeschlagenen Prüfungen beim Eintritt wiederverwendet. Die aktuelle Mitgliedschaft wird weiter geprüft, wenn sie vorgeschrieben ist.

## Private Ziehung und Gewinnerfreigabe

Teilnahmeschluss und Ende gelten auch dann, wenn der Bot zu diesem Zeitpunkt offline oder das Giveaway pausiert ist. Nach dem Ende prüft der Bot die Teilnahmen in begrenzten Batches und versiegelt den Snapshot. Bei einer nicht abschließbaren Prüfung bleibt der Fall offen. Vor der Ziehung muss das Team jeden offenen Fall erneut prüfen oder begründet ausschließen. Diese Entscheidungen werden zusätzlich zum unveränderten Snapshot protokolliert.

- Öffne **Gewinnerprüfung → Gewinner privat ziehen**. Die Auswahl erscheint im geschützten Dashboard.
- Gib Kandidaten nach Prüfung frei, prüfe sie erneut oder lehne sie mit einem Richtliniengrund und Begründung ab. Bei einem noch freien Platz kannst du aus dem verbleibenden Pool privat Ersatz ziehen. Bereits gezogene Personen bleiben für weitere Ziehungen ausgeschlossen.
- Wenn der Pool ausgeschöpft ist, kannst du mit Begründung weniger Gewinnerplätze bestätigen.
- Öffne **Gewinner bestätigen und ankündigen** und bestätige die angezeigte Liste. Der Bot prüft neue Gewinner nochmals vor dem Einreihen der Discord-Zustellung. Eine fehlgeschlagene oder offene Prüfung führt zurück in die Gewinnerprüfung.
- Automatische Freigabe ist pro Giveaway optional. Sie erfordert eine aufgelöste Teilnahmeprüfung, ausreichend Kandidaten und eine erfolgreiche abschließende Verifikation ohne hohe Risikoeinstufung. In anderen Fällen entscheidet das Team.

Die Ankündigung enthält vor Ende ein SHA-256-Commitment zum Seed der ersten Ziehung. Der vollständige Export unter **Ziehungstransparenz** enthält den Snapshot, die Reihenfolge des berechtigten Pools, Auswahlprotokolle und die freigegebenen Seeds. Er ist für berechtigte Teammitglieder bestimmt und enthält Discord-Nutzer-IDs sowie Prüf- und Entscheidungsdaten. Für die Weitergabe eignet sich die anonyme Zusammenfassung mit Prüfsummen und Zählwerten.

Zur Überprüfung des vollständigen Exports:

- Der Snapshot-Hash ist SHA-256 über die UTF-8-kodierte Folge der kompakten JSON-Zeilen aus `snapshot`, jede Zeile mit abschließendem LF in aufsteigender Sortierung nach Discord-Nutzer-ID.
- Der Pool-Hash ist SHA-256 über das kompakte JSON-Array der Kandidaten-IDs. Beginne mit `eligibleOrder`. Für jede weitere Ziehung entferne alle Kandidaten früherer Ziehungen. Die Reihenfolge bleibt erhalten.
- Das erste Commitment ist SHA-256 über die Zeichenfolge des ersten Hex-Seeds. Die Ziehung dekodiert den 32-Byte-Seed aus Hex und verwendet HMAC-SHA-256 mit der Zeichenfolge `giveawayId:drawIndex:poolHash:counter`. Der Zähler beginnt bei 0. Bei `n` verbleibenden Personen werden Werte ab `2^256 - (2^256 mod n)` verworfen. Der akzeptierte Wert modulo `n` bestimmt den Abstand im verbleibenden Array. Tausche den gezogenen Eintrag mit der ersten noch freien Position und wiederhole das für den nächsten Platz. Ersatzziehungen erhalten einen eigenen Seed.

Damit lassen sich die Auswahl aus dem gespeicherten Pool und der Abgleich mit dem vorab veröffentlichten Commitment reproduzieren. Die Aufnahme in den Pool hängt weiterhin von den verifizierten Discord-Daten und den dokumentierten Entscheidungen des Teams ab.

## Preisabholung und Audit

Aktiviere die Abholung mit einer Frist im Editor. Nach der Veröffentlichung kann jeder bestätigte Gewinner den eigenen Preis über **Claim Prize** in der aktuellen Gewinnerankündigung abholen. **Info** zeigt dem Gewinner dort auch den persönlichen Abholstatus und die Frist. Bei aktivierten DMs enthält die Direktnachricht zusätzlich die Möglichkeit, den Preis abzulehnen.

Im Entwurf kannst du unter **Freigabe, Abholung & Teilnahmehinweise → Private Abhol-DM** eine Notiz wie „Open a ticket“ und optional einen eigenen Code je Gewinnerplatz hinterlegen. Die Codes werden in der Reihenfolge der Gewinnerplätze vergeben. Der Bot sendet den vorbereiteten Inhalt erst nach der bestätigten Abholung direkt an den Gewinner. Für Notizen ohne Code kannst du die Preisübergabe weiterhin manuell bestätigen.

Den Versandstatus findest du unter **Verwaltung → Discord-Zustellung**. Bei blockierten DMs kann der Gewinner Direktnachrichten erlauben. Der Bot versucht die Zustellung automatisch erneut. Einen bereits beanspruchten Code hält der Bot für den ursprünglichen Gewinner reserviert.

Unter **Abholungen** kannst du die Frist verlängern, die Abholung stornieren oder nach einer bestätigten Abholung die Übergabe mit Notiz erfassen. Abgelaufene oder abgelehnte Gewinne lassen sich begründet neu ziehen. Die optionale Einstellung für automatische Ersatzziehungen greift nach Ablauf der Abholfrist. Auch dann gilt der Freigabemodus des Giveaways.

Der **Audit-Log** ist nach Ereignis und Giveaway filterbar. Er hält Akteur, Zeitstempel, Entscheidungen, Begründungen und relevante Änderungen fest. Unter **Analysen** findest du Teilnahmeentwicklung, Abschluss- und Abholquoten sowie fehlgeschlagene Berechtigungsprüfungen aus der Datenbank.

## Deployment und Wiederanlauf

Die Migration `20261119120000_giveaways` ergänzt die vorhandene SQLite-Datenbank um Giveaway-Tabellen. Es sind keine zusätzlichen Umgebungsvariablen nötig. Beim regulären Compose-Deployment legt der Backend-Einstiegspunkt ein Backup der bestehenden Datenbank in `/data/backups` an und synchronisiert das Prisma-Schema. Für bereits migrationsverwaltete Installationen kannst du nach dem Backup `npx prisma migrate deploy` mit der vorgesehenen `DATABASE_URL` ausführen.

```sh
git pull --ff-only
docker compose build
docker compose up -d
```

Der Bot liest überfällige Termine, Prüfungen, Abholfristen und Discord-Zustellungen aus SQLite und setzt sie nach dem Neustart fort. Eine verpasste Startzeit wird nachgeholt, solange das Teilnahmefenster offen ist. Abgelaufene geplante Giveaways ohne Veröffentlichung werden als fehlgeschlagen markiert. Beim Deaktivieren werden keine neuen Giveaways gestartet und keine neuen Teilnahmen angenommen. Bestehende Giveaways enden zur vorgesehenen Zeit. Verwaltung, Freigabe und Abholungen bleiben zugänglich.

Ausstehende Discord-Zustellungen erscheinen unter **Verwaltung → Discord-Zustellung**. Der Bot verwendet einen dauerhaften Zustellauftrag, eine Discord-Nonce und eine Referenz im Nachrichtenverlauf. Stelle nach einer fehlgeschlagenen Veröffentlichung den Kanalzugriff wieder her und wähle bei Bedarf **Erneut versuchen**. Ein Giveaway gilt erst nach bestätigter Discord-Zustellung als veröffentlicht.

`npm run test:giveaways` führt den Kernablauf mit dem echten Prisma-Schema, SQLite und der Express-API aus. Discord-Mitgliedsdaten und Nachrichten werden im Test simuliert.
