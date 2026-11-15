"use client";
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { field, panel, requestError, Selection, SettingsForm } from './ModerationView';
import { ActionContext, button } from './ModerationWorkspace';
type Option = { id: string; name: string; type?: number };
type Settings = { enabled: boolean; configured: boolean; channelIds: string[]; rules: string; channelRules: Record<string, string>; reviewChannelId: string | null; maxMessages: number; maxChars: number; maxCalls: number };
type Hint = { id: string; channelId: string; createdAt: string; updatedAt: string; updatedBy?: string; category: string; severity: string; reason: string; status: string; assignedTo: string | null; references: { messageId: string; userId: string }[]; cases: number[] };
type ReviewData = { items: Hint[]; total: number; status: { enabled: boolean; configured: boolean; lastSuccessAt: string | null; nextRunAt: string | null; error: string | null; cursors: { channelId: string; messageId: string; lastSuccessAt: string | null; error: string | null }[] } };
export function GeminiSettingsView({ guildId, channels }: { guildId: string; channels: Option[] }) {
  return <SettingsForm<Settings> title="Gemini · Einstellungen" path={`/guilds/${guildId}/gemini/settings`}>
    {(s, update) => <div className={panel}>
      <p>Serverintegration: {s.configured ? 'konfiguriert' : 'GEMINI_API_KEY und GEMINI_MODEL fehlen auf dem Backend'}</p>
      <label><input type="checkbox" checked={s.enabled} onChange={e => update({ ...s, enabled: e.target.checked })} /> Stündliche Prüfung aktivieren</label>
      <p className="rounded border border-amber-400/40 p-3">Text aus ausdrücklich ausgewählten Kanälen wird an Google Gemini gesendet. Wähle keine Bewerbungs-, Ticket- oder Staff-Kanäle. Es werden keine Kanäle automatisch ausgewählt. Gemini erstellt ausschließlich Hinweise; jede Maßnahme muss ein Moderator ausdrücklich bestätigen.</p>
      <Selection label="Ausgewählte Review-Kanäle" options={channels.filter(c => c.type === 0)} value={s.channelIds} onChange={channelIds => update({ ...s, channelIds, channelRules: Object.fromEntries(Object.entries(s.channelRules).filter(([id]) => channelIds.includes(id))) })} />
      <label className="block">Kurze Serverregeln<textarea className={field} maxLength={2000} rows={4} value={s.rules} onChange={e => update({ ...s, rules: e.target.value })} /></label>
      {s.channelIds.map(id => <label className="block" key={id}>Zusätzliche Regeln: #{channels.find(c => c.id === id)?.name ?? id}<textarea className={field} maxLength={1000} value={s.channelRules[id] ?? ''} onChange={e => update({ ...s, channelRules: { ...s.channelRules, [id]: e.target.value } })} /></label>)}
      <label className="block">Privater Kanal für Zusammenfassungen (optional)<select className={field} value={s.reviewChannelId ?? ''} onChange={e => update({ ...s, reviewChannelId: e.target.value || null })}><option value="">Keiner</option>{channels.filter(c => c.type === 0).map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}</select></label>
      {([['maxMessages', 'Nachrichten pro Lauf und Server (inklusive Kontext)', 1, 200], ['maxChars', 'Zeichen pro Nachricht', 100, 2000], ['maxCalls', 'Gemini-Aufrufe pro Lauf inkl. Retries', 1, 5]] as const).map(([key, label, min, max]) => <label className="block" key={key}>{label}<input className={field} type="number" min={min} max={max} required value={s[key]} onChange={e => update({ ...s, [key]: Number(e.target.value) })} /></label>)}
      <p>Erster Lauf: höchstens eine Stunde Rückblick. Bei Rückstau wird mit den nächsten begrenzten Batches weitergearbeitet. Fehler überspringen keine Nachrichten.</p>
    </div>}
  </SettingsForm>;
}
export function GeminiView({ guildId, onAction, revision }: { guildId: string; onAction: (context: ActionContext) => void; revision: number; canReadCases: boolean }) {
  const [data, setData] = useState<ReviewData>(); const [status, setStatus] = useState('open'); const [page, setPage] = useState(1); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [result, setResult] = useState('');
  const load = useCallback(async () => { try { setData((await api.get(`/guilds/${guildId}/gemini`, { params: { status, page } })).data); setError(''); } catch (e) { setError(requestError(e)); } }, [guildId, status, page]);
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 30000); return () => clearInterval(timer); }, [load, revision]);
  const date = (v: string | null) => v ? new Date(v).toLocaleString() : 'Noch nicht verfügbar';
  async function change(hint: Hint, patch: Record<string, unknown>) { try { await api.patch(`/guilds/${guildId}/gemini/hints/${hint.id}`, patch); await load(); } catch (e) { setError(requestError(e)); } }
  return <div className="space-y-4"><div className={panel}><h2 className="text-xl">Gemini Review</h2>
    {data && <><p>{data.status.enabled ? 'Aktiviert' : 'Deaktiviert'} · Integration: {data.status.configured ? 'konfiguriert' : 'nicht konfiguriert'}</p><p>Letzte erfolgreiche Prüfung: {date(data.status.lastSuccessAt)}</p><p>Nächster Lauf: {date(data.status.nextRunAt)}</p>{data.status.error && <p role="alert" className="text-red-400">{data.status.error}</p>}
    <details><summary>Fortschritt pro Kanal</summary>{data.status.cursors.map(c => <p key={c.channelId}>{c.channelId}: {date(c.lastSuccessAt)} {c.error}</p>)}</details></>}
    <button className={button} disabled={busy || !data?.status.enabled} onClick={async () => { setBusy(true); try { const { data: r } = await api.post(`/guilds/${guildId}/gemini/run`, {}, { timeout: 180000 }); setResult(`${r.processed} Nachrichten, ${r.calls} Aufrufe, ${r.newHints} neue Hinweise. ${r.errors.join(' ')}`); await load(); } catch (e) { setError(requestError(e)); } finally { setBusy(false); } }}>{busy ? 'Prüfung läuft …' : 'Jetzt prüfen'}</button>{result && <p role="status">{result}</p>}
    <label>Status<select className={field} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="open">Offen</option><option value="reviewed">Geprüft</option><option value="false_positive">Fehlalarm</option><option value="">Alle</option></select></label>
  </div>{error && <p role="alert" className="text-red-400">{error}</p>}
    {data?.items.map(hint => <article className={panel} key={hint.id}><strong>{hint.category} · {hint.severity} · {hint.status}</strong><p>Kanal: {hint.channelId} · {date(hint.createdAt)}</p><p className="whitespace-pre-wrap break-words">{hint.reason}</p><p>Zugeteilt: {hint.assignedTo ?? 'Niemand'} · Bearbeitet: {hint.updatedBy ?? '–'} · {date(hint.updatedAt)}</p>
      <div className="flex flex-wrap gap-2">{hint.references.map(ref => <a key={ref.messageId} className={button} href={`https://discord.com/channels/${guildId}/${hint.channelId}/${ref.messageId}`} target="_blank" rel="noreferrer">Nachricht öffnen</a>)}</div>
      <Assign onAssign={assignedTo => void change(hint, { assignedTo })} />
      <div className="flex flex-wrap gap-2"><button className={button} onClick={() => void change(hint, { status: 'reviewed' })}>Als geprüft markieren</button><button className={button} onClick={() => void change(hint, { status: 'false_positive' })}>Fehlalarm schließen</button><button className={button} onClick={() => void change(hint, { status: 'open' })}>Wieder öffnen</button>
      {[...new Set(hint.references.map(r => r.userId))].map(id => <button key={id} className={button} onClick={() => onAction({ targetId: id, reason: `Review: ${hint.reason}`.slice(0, 450), reviewId: hint.id })}>Manuelle Maßnahme für {id}</button>)}</div>
      {!!hint.cases.length && <p>Verknüpfte Fälle: {hint.cases.map(n => `#${n}`).join(', ')} (unter „Fälle“ öffnen)</p>}
    </article>)}
    {!data?.items.length && <p>Keine Hinweise in dieser Ansicht.</p>}
    <div className="flex gap-3"><button className={button} disabled={page === 1} onClick={() => setPage(page - 1)}>Zurück</button><span>Seite {page}</span><button className={button} disabled={page * 25 >= (data?.total ?? 0)} onClick={() => setPage(page + 1)}>Weiter</button></div>
  </div>;
}
function Assign({ onAssign }: { onAssign: (id: string | null) => void }) { const [id, setId] = useState(''); return <form className="flex gap-2" onSubmit={e => { e.preventDefault(); onAssign(id || null); }}><input aria-label="Reviewer-ID" placeholder="Reviewer-ID (leer = freigeben)" pattern="[0-9]{17,20}" className={field} value={id} onChange={e => setId(e.target.value)} /><button className={button}>Zuweisen</button></form>; }
