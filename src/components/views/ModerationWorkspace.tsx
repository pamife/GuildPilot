"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { ModerationAction, ModerationPermission } from "@/types/moderation";
import { AutoModView, ModerationSettingsView, field, panel, requestError } from "./ModerationView";
import { GeminiView, GeminiSettingsView } from "./GeminiView";

type Option = { id: string; name: string; type?: number };
type Access = { permissions: ModerationPermission[]; channels: Option[]; roles: Option[]; missingBotPermissions: string[]; hasMessageContentIntent: boolean; dmDefault: boolean };
export type Case = { number: number; action: string; targetId: string; reason: string; status: string; error?: string; result?: string; dmStatus: string; moderatorId?: string; ruleIds?: string; createdAt: string; reversesCaseNumber?: number; logMessageUrl?: string; reviewId?: string };
export type ActionContext = { targetId: string; action?: ModerationAction; reason?: string; reverseNumber?: number; reviewId?: string };
const actionPermission: Record<ModerationAction, ModerationPermission> = { warn: "warn", revoke_warn: "warn", timeout: "timeout", untimeout: "timeout", kick: "kick", ban: "ban", unban: "ban", purge: "chat", slowmode: "chat" };
const labels: Record<ModerationAction, string> = { warn: "Verwarnen", revoke_warn: "Verwarnung zurücknehmen", timeout: "Timeout", untimeout: "Timeout aufheben", kick: "Kick", ban: "Ban", unban: "Unban per Nutzer-ID", purge: "Nachrichten löschen", slowmode: "Slowmode (0 = aus)" };
export const button = "rounded-lg border border-white/20 px-3 py-2 text-sm disabled:opacity-40 hover:bg-white/10";

export function ModerationWorkspace({ guildId, initialTab = "Moderation" }: { guildId: string; initialTab?: string }) {
  const [access, setAccess] = useState<Access>();
  const [error, setError] = useState("");
  const [tab, setTab] = useState(initialTab);
  const [context, setContext] = useState<ActionContext>();
  const [revision, setRevision] = useState(0);
  useEffect(() => { const controller = new AbortController(); api.get(`/guilds/${guildId}/moderation/access`, { signal: controller.signal }).then(r => setAccess(r.data)).catch(e => { if (!controller.signal.aborted) setError(requestError(e)); }); return () => controller.abort(); }, [guildId]);
  if (!access) return <p role="alert" className="p-6">{error || "Moderation wird geladen …"}</p>;
  const allowed = (p: ModerationPermission) => access.permissions.includes(p);
  const tabs = ["Moderation", ...(allowed("cases") ? ["Fälle"] : []), ...(allowed("settings") ? ["AutoMod", "Einstellungen"] : []), ...(allowed("review") ? ["Gemini Review"] : [])];
  const active = tabs.includes(tab) ? tab : "Moderation";
  const props = { guildId, roles: access.roles, channels: access.channels.map(c => ({ ...c, type: c.type ?? 0 })) };
  return <section className="mx-auto w-full max-w-6xl space-y-5 overflow-y-auto p-6 text-white">
    <h1 className="text-2xl font-bold">Moderationsarbeitsplatz</h1>
    <nav aria-label="Moderation" className="flex flex-wrap gap-2">{tabs.map(t => <button key={t} className={`${button} ${active === t ? 'bg-indigo-600' : ''}`} onClick={() => setTab(t)}>{t}</button>)}</nav>
    {active === "Moderation" && <MemberSearch guildId={guildId} canRead={allowed("cases")} onAction={setContext} revision={revision} />}
    {active === "Fälle" && <CasesView guildId={guildId} onAction={setContext} revision={revision} />}
    {active === "AutoMod" && <><AutoModView {...props} /><AutoModPreview guildId={guildId} />{allowed("cases") && <CasesView guildId={guildId} source="automod" onAction={setContext} revision={revision} />}</>}
    {active === "Gemini Review" && <GeminiView guildId={guildId} onAction={setContext} revision={revision} canReadCases={allowed("cases")} />}
    {active === "Einstellungen" && <><div className={panel}><p>Fehlende Bot-Rechte: {access.missingBotPermissions.join(', ') || 'Keine auf Serverebene'}</p><p>Message Content Intent: {access.hasMessageContentIntent ? 'angefordert' : 'nicht verfügbar'}. Kanalrechte und Hierarchie werden bei jeder Aktion erneut geprüft.</p></div><ModerationSettingsView {...props} /><GeminiSettingsView {...props} /></>}
    {context && <ActionDialog guildId={guildId} access={access} context={context} onClose={() => { setContext(undefined); setRevision(v => v + 1); }} />}
  </section>;
}
function MemberSearch({ guildId, onAction, canRead, revision }: { guildId: string; onAction: (c: ActionContext) => void; canRead: boolean; revision: number }) {
  const [query, setQuery] = useState(''); const [members, setMembers] = useState<Option[]>([]); const [target, setTarget] = useState(''); const [error, setError] = useState('');
  return <div className="space-y-4"><form className={panel} onSubmit={async e => { e.preventDefault(); try { setMembers((await api.get(`/guilds/${guildId}/moderation/members`, { params: { q: query } })).data); setError(''); } catch (err) { setError(requestError(err)); } }}>
    <label>Mitglied suchen (Name oder ID)<input className={field} value={query} onChange={e => setQuery(e.target.value)} /></label><button className={button}>Suchen</button>
    {error && <p role="alert">{error}</p>}{members.map(m => <button type="button" key={m.id} className={button} onClick={() => setTarget(m.id)}>{m.name} · {m.id}</button>)}
    <label className="block">Ziel-ID (auch Nutzer außerhalb des Servers)<input className={field} value={target} onChange={e => setTarget(e.target.value)} /></label>
    <button type="button" className={button} onClick={() => onAction({ targetId: target })}>Maßnahme öffnen</button>
    <button type="button" className={button} onClick={() => onAction({ targetId: '', action: 'purge' })}>Chat-Tools</button>
  </form>{canRead && target && <CasesView guildId={guildId} targetId={target} onAction={onAction} revision={revision} />}</div>;
}
export function CasesView({ guildId, targetId = '', source = '', onAction, revision }: { guildId: string; targetId?: string; source?: string; onAction: (c: ActionContext) => void; revision: number }) {
  const [filters, setFilters] = useState({ targetId, source, action: '', status: '', from: '', to: '', q: '' });
  const [page, setPage] = useState(1); const [items, setItems] = useState<Case[]>([]); const [total, setTotal] = useState(0); const [error, setError] = useState('');
  const [detail, setDetail] = useState<{ record: Case; history: Case[] }>();
  useEffect(() => { setFilters(f => ({ ...f, targetId, source })); setPage(1); }, [targetId, source]);
  const load = useCallback(async () => { try { const { data } = await api.get(`/guilds/${guildId}/moderation/cases`, { params: { ...filters, page, from: filters.from ? new Date(filters.from).toISOString() : undefined, to: filters.to ? new Date(filters.to).toISOString() : undefined } }); setItems(data.items); setTotal(data.total); setError(''); } catch (e) { setError(requestError(e)); } }, [guildId, filters, page]);
  useEffect(() => { void load(); }, [load, revision]);
  const choose = async (number: number) => { try { setDetail((await api.get(`/guilds/${guildId}/moderation/cases/${number}`)).data); } catch (e) { setError(requestError(e)); } };
  return <div className={panel}><h2 className="text-xl">Fälle ({total})</h2><div className="grid gap-2 sm:grid-cols-3">
    {(['q', 'targetId', 'from', 'to'] as const).map(key => <label key={key}>{({ q: 'Grund durchsuchen', targetId: 'Nutzer-/Kanal-ID', from: 'Seit', to: 'Bis' })[key]}<input className={field} type={key === 'from' || key === 'to' ? 'datetime-local' : 'text'} value={filters[key]} onChange={e => { setFilters({ ...filters, [key]: e.target.value }); setPage(1); }} /></label>)}
    {([['action', ['warn', 'revoke_warn', 'timeout', 'untimeout', 'kick', 'ban', 'unban', 'purge', 'slowmode', 'auto_log', 'auto_delete']], ['source', ['manual', 'automod', 'review']], ['status', ['pending', 'succeeded', 'failed', 'message_missing']]] as const).map(([key, options]) => <label key={key}>{key}<select className={field} value={filters[key]} onChange={e => { setFilters({ ...filters, [key]: e.target.value }); setPage(1); }}><option value="">Alle</option>{options.map(o => <option key={o}>{o}</option>)}</select></label>)}
  </div>{error && <p role="alert">{error}</p>}<div className="space-y-2">{items.map(c => <button key={c.number} className={`${button} block w-full text-left`} onClick={() => void choose(c.number)}>#{c.number} · {c.action} · {c.targetId} · {c.status}<span className="block text-slate-400">{c.reason}</span></button>)}{!items.length && <p>Keine Fälle gefunden.</p>}</div>
    <div className="flex gap-3"><button className={button} disabled={page === 1} onClick={() => setPage(page - 1)}>Zurück</button><span>Seite {page}</span><button className={button} disabled={page * 25 >= total} onClick={() => setPage(page + 1)}>Weiter</button></div>
    {detail && <div className={panel}><button className={button} onClick={() => setDetail(undefined)}>Details schließen</button><CaseResult record={detail.record} />
      {detail.record.status === 'succeeded' && ['warn', 'timeout', 'ban', 'slowmode'].includes(detail.record.action) && <button className={button} onClick={() => onAction({ targetId: detail.record.targetId, action: ({ warn: 'revoke_warn', timeout: 'untimeout', ban: 'unban', slowmode: 'slowmode' } as const)[detail.record.action as 'warn'], reverseNumber: detail.record.number })}>Mit Begründung zurücknehmen</button>}
      <h3>Verknüpfter Verlauf</h3>{detail.history.map(c => <CaseResult key={c.number} record={c} />)}</div>}
  </div>;
}
export function CaseResult({ record: c }: { record: Case }) { return <div className="space-y-1 break-words"><strong>#{c.number} · {c.action} · {c.status}</strong><p>Ziel: {c.targetId} · {new Date(c.createdAt).toLocaleString()}</p><p>{c.reason}</p><p>Auslöser: {c.moderatorId || c.ruleIds} · DM: {c.dmStatus}</p>{c.result && <p>{c.result}</p>}{c.error && <p role="alert" className="text-red-400">{c.error}</p>}{c.reversesCaseNumber && <p>Rücknahme von #{c.reversesCaseNumber}</p>}{c.reviewId && <p>Gemini-Hinweis: {c.reviewId}</p>}{c.logMessageUrl && <a className="underline" href={c.logMessageUrl} target="_blank" rel="noreferrer">Discord Mod-Log öffnen</a>}</div>; }
function ActionDialog({ guildId, access, context, onClose }: { guildId: string; access: Access; context: ActionContext; onClose: () => void }) {
  const available = (Object.keys(labels) as ModerationAction[]).filter(a => access.permissions.includes(actionPermission[a]) && (a !== 'revoke_warn' || context.reverseNumber));
  const [action, setAction] = useState<ModerationAction>(context.action ?? available[0]);
  const [targetId, setTarget] = useState(context.targetId); const [reason, setReason] = useState(context.reason ?? '');
  const [duration, setDuration] = useState(context.action === 'slowmode' && context.reverseNumber ? 0 : 300); const [count, setCount] = useState(10); const [userFilter, setFilter] = useState(''); const [dm, setDm] = useState(access.dmDefault);
  const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false); const inFlight = useRef(false);
  const [result, setResult] = useState<{ record: Case; notes: string[] }>(); const [error, setError] = useState('');
  const request = useRef<{ body: string; id: string }>();
  const chat = action === 'purge' || action === 'slowmode';
  async function submit() {
    if (inFlight.current || result) return;
    inFlight.current = true; setBusy(true); setError('');
    const input = { action, targetId, reason, durationSeconds: duration, count, userFilter: userFilter || undefined, dm, reverseNumber: context.reverseNumber, reviewId: context.reviewId };
    const body = JSON.stringify(input);
    if (request.current?.body !== body) request.current = { body, id: Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('') };
    try { setResult((await api.post(`/guilds/${guildId}/moderation/actions`, { ...input, requestId: request.current.id })).data); }
    catch (e) { setError(requestError(e)); } finally { inFlight.current = false; setBusy(false); }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"><div role="dialog" aria-modal="true" aria-label="Moderationsmaßnahme" className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-auto rounded-xl bg-slate-950 p-6">
    <h2 className="text-xl">{context.reverseNumber ? `Fall #${context.reverseNumber} zurücknehmen` : 'Moderationsmaßnahme'}</h2>
    {!result && <form onSubmit={e => { e.preventDefault(); if (!confirm) setConfirm(true); else void submit(); }}><fieldset disabled={busy || confirm} className="space-y-3">
      <label>Aktion<select className={field} value={action} disabled={Boolean(context.reverseNumber)} onChange={e => { setAction(e.target.value as ModerationAction); setConfirm(false); }}>{available.map(a => <option key={a} value={a}>{labels[a]}</option>)}</select></label>
      {chat ? <label>Kanal<select className={field} required value={targetId} onChange={e => setTarget(e.target.value)}><option value="">Kanal wählen</option>{access.channels.filter(c => c.type === 0).map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}</select></label> : <label>Nutzer-ID<input className={field} required pattern="[0-9]{17,20}" value={targetId} onChange={e => setTarget(e.target.value)} /></label>}
      <label>Begründung<textarea className={field} required maxLength={450} value={reason} onChange={e => setReason(e.target.value)} /></label>
      {(action === 'timeout' || action === 'slowmode') && <label>Dauer in Sekunden<input className={field} type="number" min={action === 'timeout' ? 60 : 0} max={action === 'timeout' ? 2419200 : 21600} value={duration} onChange={e => setDuration(Number(e.target.value))} /></label>}
      {action === 'purge' && <><label>Maximal löschen (1–100)<input className={field} type="number" min={1} max={100} value={count} onChange={e => setCount(Number(e.target.value))} /></label><label>Optionaler Nutzerfilter<input className={field} pattern="[0-9]{17,20}" value={userFilter} onChange={e => setFilter(e.target.value)} /></label><p>Durchsucht die letzten 100 Nachrichten; Nachrichten ab 14 Tagen werden übersprungen.</p></>}
      {['warn', 'timeout', 'kick', 'ban'].includes(action) && <label><input type="checkbox" checked={dm} onChange={e => setDm(e.target.checked)} /> Nutzer vorab per DM benachrichtigen</label>}
    </fieldset>{confirm && <div className="my-3 rounded border border-amber-400 p-3"><strong>Bestätigung: {labels[action]}</strong><p>Ziel: {targetId}</p><p>Grund: {reason}</p>{action === 'purge' && <p>Höchstens {count} Nachrichten{userFilter && ` von ${userFilter}`}</p>}<button type="button" className={button} disabled={busy} onClick={() => setConfirm(false)}>Bearbeiten</button></div>}
      <button className={button} disabled={busy || !available.includes(action)}>{busy ? 'Wird ausgeführt …' : confirm ? 'Bestätigen und ausführen' : 'Weiter zur Bestätigung'}</button></form>}
    {error && <p role="alert" className="text-red-400">{error} Bei Verbindungsfehlern verwendet ein erneuter Klick dieselbe Anfrage-ID.</p>}
    {result && <><CaseResult record={result.record} />{result.notes.map((n, i) => <p key={i}>{n}</p>)}</>}
    <button className={button} disabled={busy} onClick={onClose}>Schließen</button>
  </div></div>;
}
function AutoModPreview({ guildId }: { guildId: string }) {
  const [text, setText] = useState(''); const [result, setResult] = useState(''); const [channelId, setChannel] = useState(''); const [roles, setRoles] = useState('');
  return <div className={panel}><h2>Test ohne Moderationsaktion</h2><p>Verwendet die gespeicherten Regeln. Jede Zeile ist eine Nachricht im Abstand von 100 ms.</p><textarea className={field} value={text} onChange={e => setText(e.target.value)} /><label>Kanal-ID<input className={field} value={channelId} onChange={e => setChannel(e.target.value)} /></label><label>Rollen-IDs (Komma)<input className={field} value={roles} onChange={e => setRoles(e.target.value)} /></label><button className={button} onClick={async () => { try { const settings = (await api.get(`/guilds/${guildId}/automod`)).data; const r = await api.post(`/guilds/${guildId}/automod/preview`, { settings, messages: text.split('\n'), channelId, roleIds: roles.split(',').map(s => s.trim()).filter(Boolean) }); setResult(JSON.stringify(r.data, null, 2)); } catch (e) { setResult(requestError(e)); } }}>Testen</button><pre className="whitespace-pre-wrap">{result}</pre></div>;
}
