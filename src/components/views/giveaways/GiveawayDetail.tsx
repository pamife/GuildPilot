"use client";
import { useState } from "react";
import { ArrowLeft, ArrowUpRight, ClipboardCheck, Copy, Download, Gift, ScrollText } from "lucide-react";
import { api } from "@/lib/api";
import { button, muted, primary, requestError } from "../changelog/ui";
import { Action, ActionDialog, AuditList } from "./Actions";
import { Section } from "./GiveawayEditor";
import { Participants } from "./Participants";
import { Claims, Review } from "./Review";
import { Badge, dateLabel, Detail, Loading, useLive } from "./shared";

function Transparency({ item, url }: { item: Detail; url: string }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  async function download(redacted = false) {
    setExporting(true);
    setError("");
    try {
      const { data } = await api.get(`${url}/transparency`, { params: { redacted } });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `giveaway-${item.id}-${redacted ? "zusammenfassung" : "ziehung"}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (error) { setError(requestError(error)); }
    finally { setExporting(false); }
  }
  return <Section title="Ziehungstransparenz" icon={<ScrollText size={19} />} lead="Der Export enthält die kanonische Reihenfolge, Prüfsummen, Richtlinien und Ziehungsentscheidungen. Veröffentlichte Ziehungen lassen sich mit dem freigegebenen Seed nachvollziehen.">
    <dl className="grid gap-2 text-sm">
      <dt className={muted}>SHA-256-Commitment aus der Ankündigung</dt><dd className="break-all font-mono text-xs">{item.commitment}</dd>
      <dt className={muted}>Teilnahme-Snapshot</dt><dd className="break-all font-mono text-xs">{item.snapshotHash ?? "Wird nach Teilnahmeschluss festgeschrieben"}</dd>
      <dt className={muted}>Zeitpunkt des Snapshots</dt><dd>{dateLabel(item.snapshotAt, item.config.timezone)}</dd>
      <dt className={muted}>Prüfsumme des ursprünglichen Ziehungspools</dt><dd className="break-all font-mono text-xs">{item.poolHash ?? "Noch keine Ziehung"}</dd>
    </dl>
    <div className="flex flex-wrap gap-2">
      <button className={button} disabled={!item.snapshotHash || exporting} onClick={() => void download()}><Download size={16} /> Ziehungsdaten exportieren</button>
      <button className={button} disabled={!item.snapshotHash || exporting} onClick={() => void download(true)}>Anonyme Zusammenfassung exportieren</button>
    </div>
    {error && <p className="text-sm text-rose-200" role="alert">{error}</p>}
  </Section>;
}

export function GiveawayDetail({ path, giveawayId, pluginEnabled, back, edit, duplicate, saveTemplate }: {
  path: string; giveawayId: string; pluginEnabled: boolean; back: () => void; edit: (item: Detail, appearance?: boolean) => void;
  duplicate: (item: Detail) => void; saveTemplate: (item: Detail) => void;
}) {
  const url = `${path}/items/${giveawayId}`;
  const query = useLive<Detail>(url, 6_000);
  const item = query.data;
  const [tab, setTab] = useState<string>();
  const [selected, setSelected] = useState<string | null>(null);
  const [action, setAction] = useState<{ spec: Action; subject: Detail }>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState(0);
  const active = tab ?? (item && ["ENDED", "DRAW_PENDING", "WINNER_REVIEW"].includes(item.status) ? "review" : "manage");

  function reload() { void query.refresh(); setChanged(value => value + 1); }
  function act(next: Action) { if (item) { setMessage(""); setError(""); setAction({ spec: next, subject: item }); } }
  async function run(path: string) {
    if (!item || busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const { data } = await api.post<{ approved?: boolean }>(path, { revision: item.revision });
      setMessage(path.endsWith("/approve") && data?.approved === false ? "Die erneute Prüfung konnte die Berechtigung nicht bestätigen." : "Änderung gespeichert.");
    } catch (error) { setError(requestError(error)); }
    finally { setBusy(false); reload(); }
  }

  if (!item) return <div className="space-y-4"><button className={button} onClick={back}><ArrowLeft size={16} /> Zurück</button>
    <Loading error={query.error} retry={() => void query.refresh()} /></div>;
  const editable = ["DRAFT", "SCHEDULED", "FAILED"].includes(item.status) && !item.messageId &&
    !item.jobs.some(job => job.kind === "ANNOUNCEMENT" && !job.doneAt);
  const open = ["ACTIVE", "PAUSED"].includes(item.status);
  function lifecycle(action: string, title: string, description?: string) {
    return { path: `${url}/lifecycle/${action}`, title, description, confirmation: true };
  }
  const views = { manage: "Verwaltung", participants: "Teilnahmen", review: "Gewinnerprüfung", claims: "Abholungen", transparency: "Ziehungstransparenz", audit: "Audit-Log" };
  return <div className="space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><button className="mb-2 inline-flex items-center gap-2 text-sm text-[var(--gp-mint)]" onClick={back}><ArrowLeft size={15} /> Zurück zur Liste</button>
        <h2 className="break-words text-2xl font-semibold">{item.config.title}</h2>
        <p className={`mt-1 break-words text-sm ${muted}`}>{item.config.prize} · {item.creatorName} · {dateLabel(item.startAt, item.config.timezone)} bis {dateLabel(item.endAt, item.config.timezone)} ({item.config.timezone})</p></div>
      <Badge status={item.status} />
    </header>
    <nav aria-label="Giveaway-Details" className="flex flex-wrap gap-2 border-b border-[var(--gp-border)] pb-3">
      {Object.entries(views).map(([id, label]) => <button key={id} className={active === id ? primary : button} aria-current={active === id ? "page" : undefined}
        onClick={() => setTab(id)}>{label}</button>)}
    </nav>
    {(error || query.error) && <p className="rounded-lg bg-rose-950/30 p-3 text-sm text-rose-200" role="alert">{error || query.error}</p>}
    {message && <p className="rounded-lg bg-emerald-400/10 p-3 text-sm text-emerald-100" role="status">{message}</p>}
    {active === "manage" && <div className="grid items-start gap-4 lg:grid-cols-2">
      <Section title="Giveaway verwalten" icon={<Gift size={20} />}>
        <div className="flex flex-wrap gap-2">
          {editable && pluginEnabled && <>
            <button className={button} onClick={() => edit(item)}>Bearbeiten</button>
            <button className={primary} onClick={() => act(lifecycle("publish", "Jetzt in Discord veröffentlichen", "Das Giveaway wird im gewählten Kanal veröffentlicht und die Teilnahme geöffnet."))}>Jetzt veröffentlichen</button>
            <button className={button} disabled={busy} onClick={() => void run(`${url}/lifecycle/schedule`)}>Start planen</button>
          </>}
          {item.status === "ACTIVE" && <button className={button} disabled={busy} onClick={() => void run(`${url}/lifecycle/pause`)}>Pausieren</button>}
          {item.status === "PAUSED" && pluginEnabled && <button className={button} disabled={busy} onClick={() => void run(`${url}/lifecycle/resume`)}>Fortsetzen</button>}
          {open && <>
            {pluginEnabled && <button className={button} onClick={() => edit(item, true)}>Ankündigung gestalten</button>}
            {pluginEnabled && <button className={button} onClick={() => act({
              ...lifecycle("extend", "Endzeit verlängern"), date: "endAt", initialDate: new Date(+new Date(item.endAt) + 3_600_000).toISOString(),
            })}>Verlängern</button>}
            <button className={button} onClick={() => act(lifecycle("end", "Giveaway jetzt beenden", "Die Teilnahme wird geschlossen und der Snapshot geprüft."))}>Jetzt beenden</button>
          </>}
          {(editable || open || ["ENDED", "DRAW_PENDING", "WINNER_REVIEW"].includes(item.status)) && !item.publication &&
            <button className={button} onClick={() => act(lifecycle("cancel", "Giveaway stornieren", "Die Teilnahme wird geschlossen. Die Historie bleibt im Audit-Log erhalten."))}>Stornieren</button>}
          {pluginEnabled && <><button className={button} onClick={() => duplicate(item)}><Copy size={16} /> Duplizieren</button>
            <button className={button} onClick={() => saveTemplate(item)}>Als Vorlage speichern</button></>}
          {item.originalUrl && <a className={button} href={item.originalUrl} target="_blank" rel="noreferrer">Ankündigung <ArrowUpRight size={15} /></a>}
          {item.resultUrl && <a className={button} href={item.resultUrl} target="_blank" rel="noreferrer">Ergebnis <ArrowUpRight size={15} /></a>}
        </div>
      </Section>
      <Section title="Discord-Zustellung" icon={<ClipboardCheck size={20} />}>
        {item.error && <p className="text-sm text-amber-200">{item.error}</p>}
        {item.jobs.length ? item.jobs.map(job => <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--gp-border)] py-2 last:border-0" key={job.id}>
          <div><p className="text-sm font-medium">{({ ANNOUNCEMENT: "Giveaway", RESULT: "Gewinnerliste", PING: "Rollenping", DM: "Direktnachricht", CLAIM_DM: "Private Abhol-DM", AUDIT: "Audit-Meldung", EXPIRED_REPLACEMENT: "Ersatz nach Fristablauf" } as Record<string, string>)[job.kind] ?? job.kind}</p>
            <p className={`text-xs ${muted}`}>{job.error ?? (job.doneAt ? "Verarbeitet" : "In Warteschlange")} · {job.tries} Versuche</p>
          </div>
          {job.error && !job.doneAt ? <button className={button} disabled={busy} onClick={() => void run(`${url}/jobs/${job.id}/retry`)}>Erneut versuchen</button>
            : <Badge status={job.doneAt ? "COMPLETED" : "PENDING"} />}
        </div>) : <p className={`text-sm ${muted}`}>Discord-Nachrichten erscheinen hier, sobald ihre Zustellung geplant ist.</p>}
      </Section>
    </div>}
    {active === "participants" && <Participants url={url} item={item} act={act} run={run} selected={selected} select={setSelected} revision={changed} />}
    {active === "review" && <Review item={item} url={url} act={act} run={run} busy={busy}
      inspect={userId => { setSelected(userId); setTab("participants"); }} />}
    {active === "claims" && <Claims item={item} url={url} act={act} inspect={() => setTab("review")} />}
    {active === "transparency" && <Transparency item={item} url={url} />}
    {active === "audit" && <AuditList path={path} giveawayId={item.id} />}
    {action && <ActionDialog item={action.subject} action={action.spec} dismiss={() => { setAction(undefined); reload(); }}
      applied={text => { setAction(undefined); setMessage(text); reload(); }} />}
  </div>;
}
