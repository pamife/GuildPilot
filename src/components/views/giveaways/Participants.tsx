"use client";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { button, field, label, muted } from "../changelog/ui";
import { Action } from "./Actions";
import { Section } from "./GiveawayEditor";
import { Audit, Avatar, Badge, Checks, dateLabel, Detail, Empty, Entry, Loading, nameOf, Page, Pagination, useLive } from "./shared";

export function Participants({ url, item, act, run, selected, select, revision }: {
  url: string; item: Detail; act: (action: Action) => void; run: (path: string) => Promise<void>;
  selected: string | null; select: (user: string | null) => void; revision: number;
}) {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const timeout = window.setTimeout(() => setTerm(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);
  const query = useLive<Page<Entry>>(`${url}/participants?${new URLSearchParams({ page: String(page), filter, search: term })}`, 7_000);
  const inspection = useLive<{ entry: Entry; events: Audit[] }>(selected ? `${url}/participants/${selected}` : null, 8_000);
  const refreshList = query.refresh;
  const refreshEntry = inspection.refresh;
  useEffect(() => { if (revision) { void refreshList(); void refreshEntry(); } }, [revision, refreshList, refreshEntry]);
  const entry = inspection.data?.entry;
  const live = ["ACTIVE", "PAUSED"].includes(item.status) && new Date(item.endAt) > new Date();
  const unresolved = item.status === "DRAW_PENDING" && entry?.snapshot?.status === "REVIEW" && !entry.resolved;
  const canManage = entry && !entry.withdrawnAt && (live || unresolved);
  const filters = { all: "Alle aktiven Teilnahmen", eligible: "Berechtigt", ineligible: "Nicht berechtigt", review: "Prüfung nötig",
    excluded: "Ausgeschlossen", left: "Server verlassen", roles: "Benötigte Rollen fehlen", account: "Kontoalter zu gering", withdrawn: "Zurückgezogen" };

  return <div className="space-y-4">
    {!!item.unresolved && <p className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
      {item.unresolved} offene Verifikationsfälle. Prüfe diese erneut oder dokumentiere, weshalb sie von der Ziehung ausgeschlossen werden.
    </p>}
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(345px,0.8fr)]">
      <div className="min-w-0 space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={label}>Teilnehmer suchen<input value={search} maxLength={120} className={field}
            onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Name oder Discord-ID" /></label>
          <label className={label}>Berechtigung<select value={filter} className={field} onChange={event => { setFilter(event.target.value); setPage(1); }}>
            {Object.entries(filters).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
          </select></label>
        </div>
        {!query.data || query.error ? <Loading error={query.error} retry={() => void query.refresh()} /> : <>
          {!query.data.items.length && <Empty title="Keine passenden Teilnahmen" text="Ändere die Suche oder den Filter, um weitere Teilnahmen zu sehen." />}
          {query.data.items.map(entry => <button type="button" key={entry.userId} onClick={() => select(entry.userId)}
            className={`${button} w-full flex-wrap !justify-start !text-left ${selected === entry.userId ? "bg-emerald-300/10" : "bg-[var(--gp-surface)]"}`}>
            <Avatar profile={entry} /><span className="min-w-0 flex-1"><span className="block break-words font-semibold">{entry.displayName}</span>
              <span className={`block break-words text-xs ${muted}`}>{entry.username} · {entry.userId} · {dateLabel(entry.enteredAt, item.config.timezone)}</span>
              <span className={`block text-xs ${muted}`}>{nameOf(entry.verification.membership)} · Rollen {nameOf(entry.verification.checks.required.result)} · Konto {entry.verification.accountDays} Tage</span>
            </span><Badge status={entry.verification.status} /><Badge status={entry.verification.risk} label={`Risiko · ${nameOf(entry.verification.risk)}`} /><ChevronRight size={16} aria-hidden="true" />
          </button>)}
          <Pagination page={page} data={query.data} change={setPage} />
        </>}
      </div>
      <div>
        {selected && (!entry || inspection.error) && <Loading error={inspection.error} retry={() => void inspection.refresh()} />}
        {entry && <Section title="Teilnahme prüfen">
          <div className="flex flex-wrap items-center gap-3"><Avatar profile={entry} /><div className="min-w-0 flex-1">
            <h3 className="break-words font-semibold">{entry.displayName}</h3><p className={`break-words text-xs ${muted}`}>{entry.username} · {entry.userId}</p>
          </div><button className={button} onClick={() => select(null)}>Schließen</button></div>
          <p className={`text-sm ${muted}`}>Teilnahme seit {dateLabel(entry.enteredAt, item.config.timezone)} · {nameOf(entry.verification.membership)}</p>
          <Checks value={entry.verification} />
          {entry.snapshot && <details className="rounded-lg border border-[var(--gp-border)] p-3"><summary className="mb-2 cursor-pointer text-sm">Festgeschriebener Snapshot</summary><Checks value={entry.snapshot} /></details>}
          {entry.exclusion && <p className="text-sm text-rose-200">{entry.exclusion}</p>}
          {entry.riskDecision && <p className={`break-words text-sm ${muted}`}>Risikoentscheidung · {entry.riskDecision}</p>}
          {canManage && <div className="flex flex-wrap gap-2">
            <button className={button} onClick={() => void run(`${url}/participants/${entry.userId}/recheck`)}>Erneut prüfen</button>
            {!entry.exclusion && <button className={button} onClick={() => act({
              path: `${url}/participants/${entry.userId}/exclude`, title: "Teilnahme ausschließen", reason: true,
              description: "Die Begründung erscheint dauerhaft im Audit-Log.",
            })}>Ausschließen</button>}
            {live && entry.verification.risk !== "LOW" && <button className={button} onClick={() => act({
              path: `${url}/participants/${entry.userId}/acknowledge`, title: "Risikoprüfung dokumentieren", reason: true,
            })}>Risikoprüfung dokumentieren</button>}
          </div>}
          {!!inspection.data?.events.length && <details className="rounded-lg border border-[var(--gp-border)] p-3">
            <summary className="cursor-pointer text-sm">Teilnahmeverlauf</summary>
            <ol className={`mt-2 space-y-1 text-xs ${muted}`}>{inspection.data.events.map(event => <li key={event.id}>{dateLabel(event.createdAt)} · {event.event} · {event.actor}</li>)}</ol>
          </details>}
        </Section>}
      </div>
    </div>
  </div>;
}
