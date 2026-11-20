"use client";

import { FormEvent, useEffect, useState } from "react";
import { Activity, ArrowLeft, ArrowRight, BarChart3, CalendarClock, Clock3, Copy, FileText, Gift, List, LockKeyhole, Plus, ScrollText, Settings2, Users } from "lucide-react";
import { api } from "@/lib/api";
import { checkLabels, GiveawayClaimDelivery, GiveawayConfig, GiveawaySettings, newGiveaway } from "@/types/giveaways";
import { button, ConfirmDialog, field, label, muted, panel, primary, requestError } from "../changelog/ui";
import { AuditList } from "./Actions";
import { ConfigFields, GiveawayEditor, Section } from "./GiveawayEditor";
import { GiveawayDetail } from "./GiveawayDetail";
import {
  Badge, dateLabel, Empty, Item, Loading, Metrics, Options, Page, Pagination, Settings, Template, useLive,
} from "./shared";

const nav = [
  { id: "overview", name: "Übersicht", icon: Gift }, { id: "active", name: "Aktiv", icon: Activity },
  { id: "scheduled", name: "Geplant", icon: CalendarClock }, { id: "review", name: "Zur Prüfung", icon: LockKeyhole },
  { id: "drafts", name: "Entwürfe", icon: FileText }, { id: "history", name: "Verlauf", icon: Clock3 },
  { id: "templates", name: "Vorlagen", icon: Copy }, { id: "analytics", name: "Analysen", icon: BarChart3 },
  { id: "audit", name: "Audit-Log", icon: ScrollText }, { id: "settings", name: "Einstellungen", icon: Settings2 },
] as const;
type View = typeof nav[number]["id"];
type Edit = {
  config: GiveawayConfig; asTemplate?: boolean; item?: Pick<Item, "id" | "startAt" | "endAt" | "revision">;
  template?: Template; appearance?: boolean; claimDelivery?: GiveawayClaimDelivery | null;
};

function SettingsForm({ path, initial, choices, reload }: { path: string; initial: Settings; choices: Options; reload: () => void }) {
  const [settings, setSettings] = useState<GiveawaySettings>(initial.settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirm, setConfirm] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const { data } = await api.put<GiveawaySettings>(`${path}/settings`, settings);
      setSettings(data); setSuccess("Giveaway-Standards gespeichert."); reload();
    } catch (error) { setError(requestError(error)); }
    finally { setBusy(false); }
  }
  async function toggle() {
    setBusy(true); setError(""); setSuccess(""); setConfirm(false);
    try {
      await api.patch(path, { enabled: !initial.enabled });
      setSuccess(initial.enabled ? "Giveaways deaktiviert." : "Giveaways aktiviert.");
      reload();
    } catch (error) { setError(requestError(error)); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save} className="space-y-4">
    <Section title="Plugin-Status" icon={<Settings2 size={19} />} lead="Beim Deaktivieren pausieren neue Starts und Teilnahmen. Laufende Giveaways erreichen weiterhin ihr Ende. Ziehungen, Ergebnisse und Abholungen bleiben verwaltbar.">
      <button type="button" className={initial.enabled ? button : primary} disabled={busy}
        onClick={() => initial.enabled ? setConfirm(true) : void toggle()}>{initial.enabled ? "Plugin deaktivieren" : "Plugin aktivieren"}</button>
    </Section>
    {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}
    {success && <p role="status" className="text-sm text-emerald-200">{success}</p>}
    <fieldset disabled={busy || !initial.enabled} className="space-y-4 disabled:opacity-60">
      <ConfigFields value={settings} choices={choices} change={setSettings} settings />
      <button className={primary} type="submit">Einstellungen speichern</button>
    </fieldset>
    {confirm && <ConfirmDialog heading="Giveaways deaktivieren?" description="Teilnahmen und geplante Starts pausieren. Daten, Gewinnerprüfungen und Preisabholungen bleiben erhalten."
      action="Deaktivieren" onCancel={() => setConfirm(false)} onConfirm={() => void toggle()} danger />}
  </form>;
}

function MetricCards({ data, change }: { data: Metrics; change: (id: View) => void }) {
  const stats = [
    { icon: Activity, label: "Aktiv", value: (data.status.ACTIVE ?? 0) + (data.status.PAUSED ?? 0), to: "active" },
    { icon: CalendarClock, label: "Geplant", value: data.status.SCHEDULED ?? 0, to: "scheduled" },
    { icon: LockKeyhole, label: "Zur Gewinnerprüfung", value: (data.status.ENDED ?? 0) + (data.status.DRAW_PENDING ?? 0) + (data.status.WINNER_REVIEW ?? 0), to: "review" },
    { icon: Users, label: "Teilnahmen", value: data.participantCount, to: "analytics" },
    { icon: Users, label: "Berechtigte Teilnahmen", value: data.entries.ELIGIBLE ?? 0, to: "analytics" },
    { icon: Clock3, label: "Beendete Giveaways", value: ["ENDED", "DRAW_PENDING", "WINNER_REVIEW", "AWAITING_CLAIM", "COMPLETED"].reduce((sum, key) => sum + (data.status[key] ?? 0), 0), to: "history" },
    { icon: Gift, label: "Ausstehende Abholungen", value: data.claimStatus.PENDING ?? 0, to: "history" },
    { icon: List, label: "Abgeschlossen", value: data.status.COMPLETED ?? 0, to: "history" },
  ] as const;
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{stats.map(({ icon: Icon, label, value, to }) => <button key={label}
    onClick={() => change(to)} className={`${panel} space-y-3 text-left transition-colors hover:bg-[var(--gp-raised)]`}>
    <div className="flex justify-between gap-1 text-[var(--gp-mint)]"><Icon size={19} aria-hidden="true" /><ArrowRight size={15} aria-hidden="true" /></div>
    <p className="text-2xl font-semibold tabular-nums sm:text-3xl">{value.toLocaleString("de")}</p>
    <p className={`text-xs sm:text-sm ${muted}`}>{label}</p>
  </button>)}</div>;
}

function Chart({ data }: { data: Metrics }) {
  const max = Math.max(1, ...data.days.map(day => day.count));
  return <Section title="Teilnahmen der letzten 30 Tage" lead="Aktuelle Teilnahmen nach Eintrittstag (UTC)." icon={<BarChart3 size={19} />}>
    <div role="img" aria-label={data.days.map(({ day, count }) => `${day}: ${count}`).join("; ")}
      className="flex h-36 items-end gap-0.5 rounded-xl border border-[var(--gp-border)] bg-[var(--gp-surface)] px-2 pb-2 pt-5 sm:gap-1">
      {data.days.map(({ day, count }) => <div key={day} className="flex h-full min-w-0 flex-1 items-end" title={`${day} · ${count} Teilnahmen`}>
        <div className={`w-full rounded-t ${count ? "bg-emerald-300/60 hover:bg-emerald-200" : "bg-[var(--gp-border)]"}`}
          style={{ height: count ? `${Math.max(4, count / max * 100)}%` : "2px" }} />
      </div>)}
    </div>
    <div className={`flex justify-between text-xs ${muted}`}><span>{data.days[0]?.day}</span><span>{data.days.at(-1)?.day}</span></div>
  </Section>;
}

function Analytics({ data }: { data: Metrics }) {
  const metrics = [
    ["Erstellte Giveaways", data.total], ["Abgeschlossen", data.status.COMPLETED ?? 0],
    ["Gesamte Teilnahmen", data.participantCount], ["Eindeutige Teilnehmende", data.unique],
    ["Teilnahmen je Giveaway", data.average], ["Noch nicht abgeholte Preise", data.claimStatus.PENDING ?? 0],
    ["Abschlussquote", data.completionRate.toLocaleString("de", { style: "percent", maximumFractionDigits: 1 })],
    ["Abholquote", data.claimRate.toLocaleString("de", { style: "percent", maximumFractionDigits: 1 })],
  ];
  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{metrics.map(([label, value]) => <div key={label} className={panel}>
      <p className="text-xl font-semibold tabular-nums">{typeof value === "number" ? value.toLocaleString("de", { maximumFractionDigits: 1 }) : value}</p>
      <p className={`mt-1 text-sm ${muted}`}>{label}</p>
    </div>)}</div>
    <Chart data={data} />
    <Section title="Fehlgeschlagene Berechtigungsprüfungen">
      {data.failures.length ? data.failures.map(({ checkName, count }) => <p key={checkName} className="flex justify-between border-b border-[var(--gp-border)] py-2 text-sm last:border-0">{checkLabels[checkName]}<b>{count}</b></p>)
        : <p className={`text-sm ${muted}`}>Für gespeicherte Teilnahmen liegen keine fehlgeschlagenen Prüfungen vor.</p>}
    </Section>
  </div>;
}

function GiveawayList({ path, view, choices, select }: {
  path: string; view: string; choices: Options; select: (id: string) => void;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  const query = useLive<Page<Item>>(`${path}/items?${new URLSearchParams({ view, page: String(page), search: term })}`, 10_000);
  return <div className="space-y-3">
    <label className={`${label} max-w-sm`}>Giveaway suchen<input className={field} value={search} maxLength={120} placeholder="Titel oder Preis"
      onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
    {!query.data || query.error ? <Loading error={query.error} retry={() => void query.refresh()} /> : <>
      {!query.data.items.length && <Empty title="Keine Giveaways in dieser Ansicht" text={term ? "Passe deinen Suchbegriff an." : "Passende Giveaways erscheinen hier, sobald ihr Status erreicht ist."} />}
      {query.data.items.map(item => {
        const channel = choices.channels.find(channel => channel.id === item.config.channelId);
        return <article className={`${panel} grid items-center gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.15fr)_auto]`} key={item.id}>
          <div className="min-w-0"><Badge status={item.status} /><h3 className="mt-2 break-words text-base font-semibold">{item.config.title}</h3>
            <p className={`break-words text-sm ${muted}`}>{item.config.prize}</p></div>
          <div className="space-y-1 text-sm"><p>{item.participantCount} Teilnahmen · {item.validCount} berechtigt</p>
            <p className={muted}>{item.config.winnerCount} Gewinnerplätze · {channel ? `#${channel.name}` : item.config.channelId ?? "Kanal offen"}</p></div>
          <div className={`space-y-1 text-xs ${muted}`}>
            <p>Start · {dateLabel(item.startAt, item.config.timezone)}</p><p>Ende · {dateLabel(item.endAt, item.config.timezone)}</p>
            <p className="break-words">Erstellt von {item.creatorName}</p>
          </div>
          <button className={button} onClick={() => select(item.id)}>{["ENDED", "DRAW_PENDING", "WINNER_REVIEW"].includes(item.status) ? "Prüfung öffnen" : "Verwalten"} <ArrowRight size={15} /></button>
        </article>;
      })}
      <Pagination page={page} data={query.data} change={setPage} />
    </>}
  </div>;
}

function Templates({ path, enabled, create, edit }: { path: string; enabled: boolean; create: () => void; edit: (next: Edit) => void }) {
  const [page, setPage] = useState(1);
  const query = useLive<Page<Template>>(`${path}/templates?page=${page}`);
  const [remove, setRemove] = useState<Template>();
  const [error, setError] = useState("");
  async function deleteTemplate(template: Template) {
    setRemove(undefined); setError("");
    try {
      await api.delete(`${path}/templates/${template.id}`, { data: { confirmed: true } });
      if (page > 1 && query.data?.items.length === 1) setPage(page - 1);
      else void query.refresh();
    } catch (error) { setError(requestError(error)); }
  }
  return <div className="space-y-3">
    <button className={primary} onClick={create} disabled={!enabled}><Plus size={16} /> Neue Vorlage</button>
    {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}
    {!query.data || query.error ? <Loading error={query.error} retry={() => void query.refresh()} /> : <>
      {!query.data.items.length && <Empty title="Keine Vorlagen gespeichert" text="Speichere einen wiederverwendbaren Ablauf für deine Community." />}
      <div className="grid gap-3 md:grid-cols-2">{query.data.items.map(template => <article key={template.id} className={`${panel} space-y-3`}>
        <div><h3 className="break-words font-semibold">{template.name}</h3>
          <p className={`break-words text-sm ${muted}`}>{template.config.prize} · {template.config.winnerCount} Gewinnerplätze · {template.config.durationHours} Std.</p></div>
        <div className="flex flex-wrap gap-2">
          <button className={primary} disabled={!enabled} onClick={() => edit({ config: template.config })}>Giveaway erstellen</button>
          <button className={button} disabled={!enabled} onClick={() => edit({ asTemplate: true, config: template.config, template })}>Bearbeiten</button>
          <button className={button} disabled={!enabled} onClick={() => edit({ asTemplate: true, config: template.config })}>Duplizieren</button>
          <button className={button} onClick={() => setRemove(template)}>Löschen</button>
        </div>
      </article>)}</div>
      <Pagination page={page} data={query.data} change={setPage} />
    </>}
    {remove && <ConfirmDialog heading="Vorlage löschen?" description={`„${remove.name}“ wird aus den Vorlagen dieses Servers entfernt.`}
      action="Löschen" onCancel={() => setRemove(undefined)} onConfirm={() => void deleteTemplate(remove)} danger />}
  </div>;
}

export function GiveawayWorkspace({ path, onBack }: { path: string; guildId: string; onBack: () => void }) {
  const [view, setView] = useState<View>("overview");
  const [selected, setSelected] = useState<string>();
  const [editor, setEditor] = useState<Edit>();
  const settings = useLive<Settings>(`${path}/settings`, 30_000);
  const options = useLive<Options>(`${path}/options`);
  const metrics = useLive<Metrics>(!selected && !editor && ["overview", "analytics"].includes(view) ? `${path}/analytics` : null, 18_000);
  const plugin = settings.data;
  const choices = options.data;
  const defaultEditor = (asTemplate = false) => {
    if (plugin?.enabled) setEditor({ config: newGiveaway(plugin.settings), asTemplate });
  };

  return <section className="mx-auto w-full max-w-screen-2xl space-y-4 px-4 pb-10 pt-5 sm:px-8">
    <button onClick={onBack} className="inline-flex items-center gap-2 text-sm text-[var(--gp-mint)]"><ArrowLeft size={16} /> Plugins</button>
    {!selected && !editor && <header className="gp-page-heading">
      <div><h1 className="flex items-center gap-3"><Gift className="text-[var(--gp-mint)]" aria-hidden="true" /> Giveaways</h1>
        <p>Discord-Giveaways planen, Teilnahmen prüfen und Gewinner freigeben.</p>
      </div>
      {plugin?.enabled && choices && <button className={primary} onClick={() => defaultEditor()}><Plus size={17} /> Giveaway erstellen</button>}
    </header>}
    {!plugin || !choices ? <Loading error={settings.error ?? options.error} retry={() => { void settings.refresh(); void options.refresh(); }} />
      : editor ? <GiveawayEditor path={path} mode={editor} choices={choices} cancel={() => setEditor(undefined)} saved={id => {
        setEditor(undefined);
        if (id) setSelected(id); else if (!selected) setView("templates");
      }} />
      : selected ? <GiveawayDetail key={selected} path={path} giveawayId={selected} pluginEnabled={plugin.enabled}
        back={() => setSelected(undefined)} edit={(item, appearance) => setEditor({ item, config: item.config, appearance, claimDelivery: item.claimDelivery })}
        duplicate={item => setEditor({ config: item.config })}
        saveTemplate={item => setEditor({ asTemplate: true, config: {
          ...item.config, durationHours: Math.min(8760, Math.max(1, Math.ceil((+new Date(item.endAt) - +new Date(item.startAt)) / 3_600_000))),
        } })} />
      : <>
        {!plugin.enabled && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
          <span>Giveaways ist für diesen Server deaktiviert. Historie, Gewinnerprüfung und Abholungen sind weiterhin verfügbar.</span>
          {view !== "settings" && <button className={button} onClick={() => setView("settings")}>Zu den Einstellungen</button>}
        </div>}
        <nav aria-label="Giveaways" className="flex flex-wrap gap-2 border-b border-[var(--gp-border)] pb-3">
          {nav.map(({ id, name, icon: Icon }) => <button className={id === view ? primary : button} onClick={() => setView(id)}
            key={id} aria-current={id === view ? "page" : undefined}><Icon size={15} aria-hidden="true" />{name}</button>)}
        </nav>
        {["overview", "analytics"].includes(view) && (!metrics.data || metrics.error
          ? <Loading error={metrics.error} retry={() => void metrics.refresh()} />
          : view === "overview" ? <><MetricCards data={metrics.data} change={setView} /><Chart data={metrics.data} /></>
            : <Analytics data={metrics.data} />)}
        {["overview", "active", "scheduled", "review", "drafts", "history"].includes(view) && <section className="space-y-3">
          <h2 className="text-lg font-semibold">{view === "overview" ? "Alle Giveaways" : nav.find(item => item.id === view)?.name}</h2>
          <GiveawayList path={path} key={view} view={view === "overview" ? "all" : view} choices={choices} select={setSelected} />
        </section>}
        {view === "templates" && <Templates path={path} enabled={plugin.enabled} create={() => defaultEditor(true)} edit={setEditor} />}
        {view === "audit" && <AuditList path={path} />}
        {view === "settings" && <SettingsForm path={path} initial={plugin} choices={choices} reload={() => void settings.refresh()} />}
      </>}
  </section>;
}
