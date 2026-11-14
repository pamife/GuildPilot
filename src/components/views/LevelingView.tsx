"use client";

import { isAxiosError } from "axios";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { LevelingConfig, LevelingPage, LevelingRow, MAX_XP, Ranking, levelForXp, levelProgress } from "@/types/leveling";

interface Choice { id: string; name: string }
interface Props { guildId: string; channels: (Choice & { type: number })[]; roles: Choice[] }
type Member = Pick<LevelingRow, "userId"> & { name: string };
type EditMember = LevelingRow & Member;
type Board = LevelingPage & { matches: Member[] };

const panel = "panel-glass space-y-4 rounded-xl p-5";
const field = "rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white";
const button = "rounded-lg border border-white/15 px-3 py-2 text-sm disabled:opacity-50";
const primary = button + " bg-indigo-600 text-white";

function errorText(error: unknown) {
  return isAxiosError(error) && typeof error.response?.data?.error === "string"
    ? error.response.data.error : "Die Anfrage konnte nicht abgeschlossen werden.";
}

export function LevelingView({ guildId, channels, roles }: Props) {
  const path = `/guilds/${guildId}/leveling`;
  const [settings, setSettings] = useState<LevelingConfig>();
  const [board, setBoard] = useState<Board>();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [ranking, setRanking] = useState<Ranking>("xp");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [editing, setEditing] = useState<EditMember>();
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"set" | "change">("set");
  const [preview, setPreview] = useState<number>();
  const [busy, setBusy] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [boardError, setBoardError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback((signal?: AbortSignal) => {
    setSettingsError("");
    api.get<LevelingConfig>(path, { signal }).then(({ data }) => setSettings(data))
      .catch((error) => { if (!signal?.aborted) setSettingsError(errorText(error)); });
  }, [path]);

  useEffect(() => {
    const request = new AbortController();
    load(request.signal);
    return () => request.abort();
  }, [load]);

  useEffect(() => {
    const request = new AbortController();
    setBoard(undefined);
    setBoardError("");
    api.get<Board>(`${path}/leaderboard`, { signal: request.signal, params: { search, ranking, page } })
      .then(({ data }) => setBoard(data))
      .catch((error) => { if (!request.signal.aborted) setBoardError(errorText(error)); });
    return () => request.abort();
  }, [path, search, ranking, page, refresh]);

  function update(patch: Partial<LevelingConfig>) {
    setSettings((current) => current && { ...current, ...patch });
  }

  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setActionError("");
    setNotice("");
    try { await action(); }
    catch (error) { setActionError(errorText(error)); }
    finally { setBusy(false); }
  }

  function edit(userId: string) {
    void perform(async () => {
      const { data } = await api.get<EditMember>(`${path}/members/${userId}`);
      setEditing(data);
      setMode("set");
      setAmount(String(data.xp));
      setPreview(undefined);
    });
  }

  const newXp = (mode === "change" ? editing?.xp ?? 0 : 0) + Number(amount);
  const maxLevel = levelForXp(MAX_XP);
  const validXp = /^-?\d+$/.test(amount) && Number.isSafeInteger(newXp) && newXp >= 0 && newXp <= MAX_XP;
  const textChannels = channels.filter(({ type }) => type === 0 || type === 5);

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <h1 className="text-2xl font-bold">Leveling</h1>
      {settingsError && <p role="alert" className="text-sm text-red-400">{settingsError} <button onClick={() => load()} className="underline">Neu laden</button></p>}
      {!settings && !settingsError && <p role="status">Einstellungen werden geladen …</p>}
      {settings && (
        <form className={panel} onSubmit={(event) => {
          event.preventDefault();
          void perform(async () => {
            const { data } = await api.put<LevelingConfig>(path, settings);
            setSettings(data);
            setNotice("Leveling-Einstellungen gespeichert.");
          });
        }}>
          <h2 className="text-lg font-semibold">Einstellungen</h2>
          <fieldset disabled={busy} className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings.enabled} onChange={(e) => update({ enabled: e.target.checked })} />
              Chat-Leveling aktivieren
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1 text-sm">Min. XP
                <input className={field} required type="number" min={1} max={100000} value={settings.minXp}
                  onChange={(e) => update({ minXp: Number(e.target.value) })} />
              </label>
              <label className="grid gap-1 text-sm">Max. XP
                <input className={field} required type="number" min={settings.minXp} max={100000} value={settings.maxXp}
                  onChange={(e) => update({ maxXp: Number(e.target.value) })} />
              </label>
              <label className="grid gap-1 text-sm">Cooldown (Sekunden)
                <input className={field} required type="number" min={0} max={86400} value={settings.cooldownSeconds}
                  onChange={(e) => update({ cooldownSeconds: Number(e.target.value) })} />
              </label>
            </div>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">Ausgeschlossene Kanäle</legend>
              <div className="grid max-h-36 gap-2 overflow-auto rounded-lg border border-white/15 p-3 sm:grid-cols-2">
                {[...channels, ...settings.excludedChannelIds.filter((id) => !channels.some((channel) => channel.id === id))
                  .map((id) => ({ id, name: `Nicht verfügbar (${id})` }))].map(({ id, name }) => (
                  <label key={id} className="flex gap-2 text-sm">
                    <input type="checkbox" checked={settings.excludedChannelIds.includes(id)} onChange={(e) => update({
                      excludedChannelIds: e.target.checked ? [...settings.excludedChannelIds, id] : settings.excludedChannelIds.filter((item) => item !== id),
                    })} />
                    #{name}
                  </label>
                ))}
              </div>
              <label className="flex gap-2 text-sm">
                <input type="checkbox" checked={settings.excludeRelay} onChange={(e) => update({ excludeRelay: e.target.checked })} />
                Relay-Count-Kanal automatisch ausschließen
              </label>
            </fieldset>
            <div className="flex flex-wrap items-end gap-4">
              <label className="flex gap-2 text-sm">
                <input type="checkbox" checked={settings.announce} onChange={(e) => update({ announce: e.target.checked })} />
                Levelaufstiege melden
              </label>
              <label className="grid gap-1 text-sm">Kanal für Meldungen
                <select className={field} value={settings.announcementId ?? ""} onChange={(e) => update({ announcementId: e.target.value || null })}>
                  <option value="">Aktueller Kanal</option>
                  {settings.announcementId && !textChannels.some(({ id }) => id === settings.announcementId) &&
                    <option value={settings.announcementId}>Kanal nicht verfügbar</option>}
                  {textChannels.map(({ id, name }) => <option key={id} value={id}>#{name}</option>)}
                </select>
              </label>
            </div>

            <fieldset className="space-y-2 border-t border-white/10 pt-3">
              <legend className="pr-2 text-sm font-medium">Rollenbelohnungen</legend>
              <label className="grid max-w-sm gap-1 text-sm">Vergabemodus
                <select className={field} value={settings.highestOnly ? "highest" : "all"} onChange={(e) => update({ highestOnly: e.target.value === "highest" })}>
                  <option value="all">Alle erreichten Rollen behalten</option>
                  <option value="highest">Nur Rollen der höchsten erreichten Stufe behalten</option>
                </select>
              </label>
              {settings.rewards.map((reward, index) => (
                <div key={index} className="flex flex-wrap gap-2">
                  <input aria-label="Belohnungslevel" className={field + " w-24"} type="number" min={1} max={maxLevel} required value={reward.level}
                    onChange={(e) => update({ rewards: settings.rewards.map((item, i) => i === index ? { ...item, level: Number(e.target.value) } : item) })} />
                  <select aria-label="Belohnungsrolle" required className={field} value={reward.roleId}
                    onChange={(e) => update({ rewards: settings.rewards.map((item, i) => i === index ? { ...item, roleId: e.target.value } : item) })}>
                    <option value="">Rolle wählen</option>
                    {reward.roleId && !roles.some(({ id }) => id === reward.roleId) && <option value={reward.roleId}>Rolle nicht verfügbar</option>}
                    {roles.filter(({ id }) => id !== guildId).map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
                  </select>
                  <button type="button" className={button} onClick={() => update({ rewards: settings.rewards.filter((_, i) => i !== index) })}>Entfernen</button>
                </div>
              ))}
              <button type="button" className={button} onClick={() => update({ rewards: [...settings.rewards, { level: 1, roleId: "" }] })}>Belohnung hinzufügen</button>
            </fieldset>

            <fieldset className="space-y-2 border-t border-white/10 pt-3">
              <legend className="pr-2 text-sm font-medium">Prestige</legend>
              <label className="flex gap-2 text-sm">
                <input type="checkbox" checked={settings.prestigeEnabled} onChange={(e) => update({ prestigeEnabled: e.target.checked })} />
                Prestige aktivieren
              </label>
              <label className="grid max-w-40 gap-1 text-sm">Mindestlevel
                <input required type="number" className={field} min={1} max={maxLevel} value={settings.prestigeLevel}
                  onChange={(e) => update({ prestigeLevel: Number(e.target.value) })} />
              </label>
            </fieldset>
            <button className={primary}>Einstellungen speichern</button>
          </fieldset>
        </form>
      )}

      <div className={panel}>
        <h2 className="text-lg font-semibold">Rangliste</h2>
        <form className="flex flex-wrap gap-2" onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(query.trim());
          setRefresh((value) => value + 1);
        }}>
          <select aria-label="Rangliste" className={field} value={ranking} onChange={(e) => {
            setRanking(e.target.value === "prestige" ? "prestige" : "xp");
            setPage(1);
          }}>
            <option value="xp">Aktive XP</option>
            <option value="prestige">Prestige</option>
          </select>
          <input aria-label="Mitglied suchen" className={field} placeholder="Name oder Discord-ID" maxLength={100} value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className={button}>{query.trim() ? "Suchen" : "Aktualisieren"}</button>
        </form>
        {boardError && <p role="alert" className="text-sm text-red-400">{boardError}</p>}
        {!board && !boardError && <p role="status">Rangliste wird geladen …</p>}
        {board && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-left text-sm">
                <thead className="text-slate-400"><tr>{["Platz", "Mitglied", "Level", "XP", "Prestige", "Aktion"].map((label) => <th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead>
                <tbody>
                  {board.entries.map((row) => (
                    <tr className="border-t border-white/10" key={row.userId}>
                      {[row.position, row.name, row.level, row.xp.toLocaleString("de"), row.prestige].map((value, index) => <td className="p-2" key={index}>{value}</td>)}
                      <td className="p-2"><button className={button} disabled={busy} onClick={() => edit(row.userId)}>XP bearbeiten</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!board.entries.length && <p className="text-sm text-slate-400">Keine Ranglisteneinträge gefunden.</p>}
            <div className="flex items-center gap-3 text-sm">
              <button className={button} disabled={board.page <= 1} onClick={() => setPage(board.page - 1)}>Zurück</button>
              <span>Seite {board.page} von {board.pages}</span>
              <button className={button} disabled={board.page >= board.pages} onClick={() => setPage(board.page + 1)}>Weiter</button>
            </div>
            {search && board.matches.length > 0 && (
              <label className="grid max-w-sm gap-1 text-sm">Mitglied zur XP-Bearbeitung wählen
                <select disabled={busy} className={field} value="" onChange={(e) => edit(e.target.value)}>
                  <option value="">Mitglied wählen</option>
                  {board.matches.map(({ userId, name }) => <option key={userId} value={userId}>{name} ({userId})</option>)}
                </select>
              </label>
            )}
          </>
        )}
        {editing && (
          <form className="space-y-3 rounded-lg border border-white/15 p-4" onSubmit={(e) => { e.preventDefault(); if (validXp) setPreview(newXp); }}>
            <h3 className="font-semibold">{editing.name}</h3>
            <p className="text-sm">Level {editing.level} · {editing.xp.toLocaleString("de")} XP · Prestige {editing.prestige}</p>
            {preview === undefined ? (
              <div className="flex flex-wrap items-end gap-2">
                <select className={field} aria-label="XP-Aktion" value={mode} onChange={(e) => {
                  const change = e.target.value === "change";
                  setMode(change ? "change" : "set");
                  setAmount(change ? "0" : String(editing.xp));
                }}>
                  <option value="set">XP setzen</option>
                  <option value="change">XP hinzufügen oder abziehen</option>
                </select>
                <input type="number" aria-label="XP-Wert" required className={field + " w-36"} value={amount} onChange={(e) => setAmount(e.target.value)} />
                <button className={primary} disabled={busy || !validXp}>Änderung prüfen</button>
                <button type="button" className={button} disabled={busy} onClick={() => setEditing(undefined)}>Schließen</button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm">Bisher {editing.xp.toLocaleString("de")} XP → neu {preview.toLocaleString("de")} XP (Level {levelProgress(preview).level})</p>
                <div className="flex gap-2">
                  <button type="button" className={primary} disabled={busy} onClick={() => {
                    void perform(async () => {
                      const { data } = await api.put<{ warning?: string }>(`${path}/members/${editing.userId}`, { xp: preview, revision: editing.revision, confirmed: true });
                      setEditing(undefined);
                      setPreview(undefined);
                      setNotice(data.warning ?? "XP gespeichert.");
                      setRefresh((value) => value + 1);
                    });
                  }}>Bestätigen</button>
                  <button type="button" className={button} disabled={busy} onClick={() => setPreview(undefined)}>Zurück</button>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
      {actionError && <p role="alert" className="text-sm text-red-400">{actionError}</p>}
      {notice && <p role="status" className="text-sm text-emerald-400">{notice}</p>}
    </section>
  );
}
