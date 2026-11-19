"use client";
import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { api } from "@/lib/api";
import { RejectionPolicy, rejectionPolicies } from "@/types/giveaways";
import { button, field, label, muted, panel, primary, requestError } from "../changelog/ui";
import { Audit, Badge, Candidate, dateLabel, Detail, Empty, Loading, localTime, Page, Pagination, toInstant, useLive } from "./shared";

export type Action = {
  path: string; title: string; description?: string; reason?: boolean; policy?: RejectionPolicy | true;
  date?: "deadline" | "endAt"; initialDate?: string; notes?: "optional" | "required"; confirmation?: boolean; summary?: Candidate[];
};

export function ActionDialog({ action, item, dismiss, applied }: {
  action: Action; item: Detail; dismiss: () => void; applied: (text: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [policy, setPolicy] = useState<RejectionPolicy>(action.policy && action.policy !== true ? action.policy : "INELIGIBLE");
  const [date, setDate] = useState(() => action.initialDate ? localTime(action.initialDate, item.config.timezone) : "");
  const [later, setLater] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = { revision: item.revision, confirmed: true, reason, policy, notes,
        ...(action.date ? { [action.date]: toInstant(date, item.config.timezone, later) } : {}) };
      const { data } = await api.post<{ replaced?: boolean }>(action.path, body);
      applied(data?.replaced === false ? "Der Ziehungspool ist ausgeschöpft. Der Gewinnerplatz bleibt frei."
        : action.path.endsWith("/results") ? "Die freigegebenen Gewinner stehen zur Discord-Zustellung an." : "Änderung gespeichert.");
    } catch (error) {
      setError(error instanceof Error && !("response" in error) ? error.message : requestError(error));
    } finally { setBusy(false); }
  }
  return <dialog ref={ref} aria-labelledby={uid} onCancel={event => { event.preventDefault(); if (!busy) dismiss(); }}
    className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-xl overflow-auto rounded-2xl border border-[var(--gp-border)] bg-[var(--gp-surface)] p-5 text-[var(--gp-text)] backdrop:bg-black/70">
    <form className="space-y-4" onSubmit={submit}>
      <h2 className="text-lg font-semibold" id={uid}>{action.title}</h2>
      {action.description && <p className={`text-sm ${muted}`}>{action.description}</p>}
      {action.summary && <div className="space-y-2 rounded-xl bg-[var(--gp-raised)] p-3">
        <p className="font-semibold">{item.config.title} · {item.config.prize}</p>
        <p className={`text-sm ${muted}`}>{Object.values(item.totals).reduce((total, count) => total + count, 0)} Teilnahmen · {item.totals.ELIGIBLE ?? 0} berechtigt · {item.candidates.filter(candidate => candidate.status === "REJECTED").length} abgelehnt · {item.candidates.filter(candidate => candidate.replacesId).length} Ersatzziehungen</p>
        {action.summary.map(candidate => <div key={candidate.id} className="flex items-center justify-between gap-2 py-1 text-sm">
          <span>Platz {candidate.slot} · {candidate.profile?.displayName ?? candidate.userId}</span><Badge status={candidate.verification.status} />
        </div>)}
      </div>}
      {action.policy === true && <label className={label}>Richtlinie<select className={field} value={policy} onChange={event => setPolicy(event.target.value as RejectionPolicy)}>
        {Object.entries(rejectionPolicies).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
      </select></label>}
      {action.policy && action.policy !== true && <p className={`text-sm ${muted}`}>{rejectionPolicies[action.policy]}</p>}
      {action.reason && <label className={label}>Begründung<textarea className={field} value={reason} onChange={event => setReason(event.target.value)} required minLength={8} maxLength={750} rows={3} /></label>}
      {action.notes && <label className={label}>{action.notes === "required" ? "Begründung" : "Notiz zur Übergabe"}<textarea className={field}
        value={notes} onChange={event => setNotes(event.target.value)} required={action.notes === "required"} minLength={action.notes === "required" ? 8 : 0} maxLength={action.notes === "required" ? 750 : 1000} rows={3} /></label>}
      {action.date && <>
        <label className={label}>Neuer Termin ({item.config.timezone})<input className={field} type="datetime-local" required value={date} onChange={event => setDate(event.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={later} onChange={event => setLater(event.target.checked)} />Bei Zeitumstellung spätere Uhrzeit verwenden</label>
      </>}
      {error && <p className="text-sm text-rose-200" role="alert">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2"><button type="button" className={button} onClick={dismiss} disabled={busy}>Abbrechen</button>
        <button type="submit" className={primary} disabled={busy}>{busy ? "Verarbeitet …" : action.confirmation ? "Bestätigen" : "Speichern"}</button></div>
    </form>
  </dialog>;
}

export function AuditList({ path, giveawayId }: { path: string; giveawayId?: string }) {
  const [page, setPage] = useState(1);
  const [event, setEvent] = useState("");
  const params = new URLSearchParams({ page: String(page) });
  if (event) params.set("event", event);
  if (giveawayId) params.set("giveawayId", giveawayId);
  const query = useLive<Page<Audit> & { events: string[] }>(`${path}/audit?${params}`, 15_000);
  return <div className="space-y-3">
    <label className={`${label} max-w-sm`}>Ereignis<select className={field} value={event} onChange={e => { setEvent(e.target.value); setPage(1); }}>
      <option value="">Alle Ereignisse</option>{(query.data?.events ?? (event ? [event] : [])).map(name => <option key={name}>{name}</option>)}
    </select></label>
    {!query.data || query.error ? <Loading error={query.error} retry={() => void query.refresh()} /> : <>
      {!query.data.items.length && <Empty title="Keine Audit-Ereignisse" text="Änderungen und Entscheidungen erscheinen hier mit Zeitstempel und Akteur." />}
      {query.data.items.map(row => <details className={`${panel} !py-3`} key={row.id}>
        <summary className="cursor-pointer text-sm"><span className="font-medium">{row.event}</span> <span className={muted}>· {dateLabel(row.createdAt)} · {row.actor}</span></summary>
        <pre className={`mt-3 overflow-auto whitespace-pre-wrap break-words text-xs ${muted}`}>{JSON.stringify(row.detail, null, 2)}</pre>
      </details>)}
      <Pagination page={page} data={query.data} change={setPage} />
    </>}
  </div>;
}
