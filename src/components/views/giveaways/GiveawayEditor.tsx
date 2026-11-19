"use client";

import { FormEvent, ReactNode, useId, useState } from "react";
import { CalendarDays, Eye, Gift, Palette, Save, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { GiveawayConfig, GiveawayRules, GiveawaySettings } from "@/types/giveaways";
import { button, DestinationSelect, field, label, muted, panel, primary, requestError } from "../changelog/ui";
import { dateLabel, Item, localTime, newId, Options, Template, toInstant } from "./shared";

function Field({ name, children }: { name: string; children: ReactNode }) {
  return <label className={label}>{name}{children}</label>;
}

export function Switch({ name, checked, change }: { name: string; checked: boolean; change: (checked: boolean) => void }) {
  return <label className="flex min-h-10 items-center gap-3 rounded-lg border border-[var(--gp-border)] px-3 py-2 text-sm">
    <input type="checkbox" className="h-4 w-4 accent-emerald-400" checked={checked} onChange={event => change(event.target.checked)} />{name}
  </label>;
}

function NumberField({ name, value, change, min = 0, max }: {
  name: string; value: number; min?: number; max: number; change: (value: number) => void;
}) {
  return <Field name={name}><input type="number" required className={field} min={min} max={max} value={Number.isNaN(value) ? "" : value}
    onChange={event => change(event.target.valueAsNumber)} /></Field>;
}

export function Section({ title, lead, icon, children }: { title: string; lead?: string; icon?: ReactNode; children: ReactNode }) {
  return <section className={`${panel} space-y-4`}>
    <header className="flex items-start gap-3">
      {icon && <span className="mt-0.5 text-[var(--gp-mint)]">{icon}</span>}
      <div><h2 className="font-semibold">{title}</h2>{lead && <p className={`mt-1 text-sm ${muted}`}>{lead}</p>}</div>
    </header>
    {children}
  </section>;
}

function RolePicker({ name, values, options, change }: {
  name: string; values: string[]; options: Options; change: (ids: string[]) => void;
}) {
  return <div className="space-y-2">
    <Field name={name}><select className={field} value="" onChange={event => {
      if (event.target.value) change([...values, event.target.value]);
    }}>
      <option value="">{values.length === 10 ? "Maximal zehn Rollen" : "Rolle hinzufügen …"}</option>
      {values.length < 10 && options.roles.filter(role => !values.includes(role.id))
        .map(role => <option value={role.id} key={role.id}>@{role.name}</option>)}
    </select></Field>
    <div className="flex flex-wrap gap-2">{values.map(id => {
      const name = options.roles.find(role => role.id === id)?.name ?? id;
      return <button type="button" key={id} aria-label={`${name} entfernen`}
        className="rounded-full border border-[var(--gp-border)] bg-[var(--gp-raised)] px-3 py-1 text-xs"
        onClick={() => change(values.filter(item => item !== id))}>@{name} ×</button>;
    })}</div>
  </div>;
}

export function ConfigFields<T extends GiveawaySettings>({ value, choices, change, settings = false }: {
  value: T; choices: Options; change: (value: T) => void; settings?: boolean;
}) {
  const set = <K extends keyof GiveawaySettings>(key: K, next: GiveawaySettings[K]) => change({ ...value, [key]: next });
  const rule = <K extends keyof GiveawayRules>(key: K, next: GiveawayRules[K]) => change({ ...value, rules: { ...value.rules, [key]: next } });
  return <>
    <Section title="Discord & Standardwerte" icon={<CalendarDays size={19} />}>
      <div className="grid gap-3 sm:grid-cols-2">
        <DestinationSelect label="Giveaway-Kanal" value={value.channelId} choices={choices.channels} placeholder="Kanal auswählen" prefix="#" onChange={id => set("channelId", id)} />
        <DestinationSelect label="Gewinnerkanal" value={value.winnerChannelId} choices={choices.channels} placeholder="Giveaway-Kanal verwenden" prefix="#" onChange={id => set("winnerChannelId", id)} />
        <DestinationSelect label="Ping-Rolle" value={value.pingRoleId} choices={choices.roles} placeholder="Kein Rollenping" prefix="@" onChange={id => set("pingRoleId", id)} />
        {settings && <DestinationSelect label="Privater Audit-Kanal" value={value.auditChannelId} choices={choices.channels} placeholder="Keine Audit-Nachrichten" prefix="#" onChange={id => set("auditChannelId", id)} />}
        <Field name="IANA-Zeitzone"><input className={field} required maxLength={64} value={value.timezone} onChange={event => set("timezone", event.target.value)} placeholder="Europe/Berlin" /></Field>
        <Field name="Akzentfarbe"><input className={`${field} h-10`} type="color" value={value.color} onChange={event => set("color", event.target.value)} /></Field>
        {settings && <NumberField name="Standarddauer in Stunden" value={value.durationHours} min={1} max={8760} change={duration => set("durationHours", duration)} />}
        <NumberField name="Gewinnerplätze" value={value.winnerCount} min={1} max={20} change={count => set("winnerCount", count)} />
      </div>
    </Section>
    <Section title="Teilnahmebedingungen" lead="Jede berechtigte Person hat genau eine gleich gewichtete Teilnahme." icon={<ShieldCheck size={19} />}>
      <div className="grid gap-3 sm:grid-cols-2">
        <RolePicker name="Benötigte Rollen" values={value.rules.requiredRoles} options={choices} change={ids => rule("requiredRoles", ids)} />
        <RolePicker name="Ausgeschlossene Rollen" values={value.rules.excludedRoles} options={choices} change={ids => rule("excludedRoles", ids)} />
        <Field name="Rollenabgleich"><select className={field} value={value.rules.roleMatch} onChange={event => rule("roleMatch", event.target.value as "ALL" | "ANY")}>
          <option value="ALL">Alle benötigten Rollen</option><option value="ANY">Mindestens eine benötigte Rolle</option>
        </select></Field>
        <NumberField name="Minimales Kontoalter in Tagen" value={value.rules.accountDays} max={3650} change={days => rule("accountDays", days)} />
        <NumberField name="Minimale Servermitgliedschaft in Tagen" value={value.rules.memberDays} max={3650} change={days => rule("memberDays", days)} />
        <NumberField name="Teilnahmeschluss vor Ende in Minuten" value={value.rules.entryBufferMinutes} max={1440} change={minutes => rule("entryBufferMinutes", minutes)} />
        <Switch name="Mitgliedschaft bei der Ziehung voraussetzen" checked={value.rules.requireMember} change={v => rule("requireMember", v)} />
        <Switch name="Rollen und Altersregeln bei der Ziehung erneut prüfen" checked={value.rules.recheck} change={v => rule("recheck", v)} />
        <Switch name="Teilnahme zurückziehen erlauben" checked={value.rules.withdraw} change={v => rule("withdraw", v)} />
      </div>
    </Section>
    <Section title="Freigabe, Abholung & Teilnahmehinweise" lead="Risikosignale allein schließen keine Teilnahme aus. Mit manueller Freigabe bleibst du bei Ziehung und Veröffentlichung am Steuer.">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="Gewinnerfreigabe"><select className={field} value={value.autoFinalize ? "automatic" : "manual"} onChange={event => set("autoFinalize", event.target.value === "automatic")}>
          <option value="manual">Manuelle Prüfung</option><option value="automatic">Automatische Freigabe bei eindeutiger Prüfung</option>
        </select></Field>
        <Switch name="Gewinner per Discord-DM benachrichtigen" checked={value.dmWinners} change={v => set("dmWinners", v)} />
        <Switch name="Preisabholung mit Frist aktivieren" checked={value.claimsEnabled} change={v => set("claimsEnabled", v)} />
        <NumberField name="Abholfrist in Stunden" value={value.claimHours} min={1} max={8760} change={hours => set("claimHours", hours)} />
        <Switch name="Nach Fristablauf privat Ersatz ziehen" checked={value.autoReplaceExpired} change={v => set("autoReplaceExpired", v)} />
        <Switch name="Team über Abholungen im Audit-Kanal informieren" checked={value.notifyClaims} change={v => set("notifyClaims", v)} />
        <NumberField name="Hinweis unter diesem Kontoalter (Tage)" value={value.riskAccountDays} max={3650} change={days => set("riskAccountDays", days)} />
        <NumberField name="Hinweis unter dieser Mitgliedschaftsdauer (Tage)" value={value.riskMemberDays} max={3650} change={days => set("riskMemberDays", days)} />
        <NumberField name="Hinweis ab dieser Anzahl abgewiesener Versuche" value={value.riskAttempts} max={100} change={count => set("riskAttempts", count)} />
      </div>
    </Section>
  </>;
}

interface DiscordComponent {
  type: number; content?: string; components?: DiscordComponent[]; label?: string; accent_color?: number;
  custom_id?: string; style?: number; emoji?: { name: string }; items?: { media: { url: string } }[];
}

type PreviewData = { components: DiscordComponent[]; info?: { components: DiscordComponent[] } };
const relativeTime = new Intl.RelativeTimeFormat("en");

function formatPreview(text: string, choices: Options, zone: string) {
  return text.replace(/<t:(\d+):([A-Z])>/g, (_match, unix: string, style: string) => {
    const time = new Date(Number(unix) * 1000);
    if (style !== "R") return dateLabel(time.toISOString(), zone);
    const minutes = (time.getTime() - Date.now()) / 60_000;
    if (Math.abs(minutes) < 1) return relativeTime.format(Math.round(minutes * 60), "second");
    if (Math.abs(minutes) < 60) return relativeTime.format(Math.round(minutes), "minute");
    if (Math.abs(minutes) < 1440) return relativeTime.format(Math.round(minutes / 60), "hour");
    return relativeTime.format(Math.round(minutes / 1440), "day");
  })
    .replace(/<@&(\d+)>/g, (_match, id: string) => `@${choices.roles.find(role => role.id === id)?.name ?? id}`)
    .replace(/^(?:-#|##?) /gm, "").replace(/(?<!\\)\*\*/g, "").replace(/\\([\\*_~`|>#[\]()])/g, "$1");
}

function PreviewMessage({ components, choices, timezone, infoButton }: {
  components: DiscordComponent[]; choices: Options; timezone: string;
  infoButton?: { open: boolean; controls: string; toggle: () => void };
}) {
  return <div className="space-y-3 rounded-xl border border-white/10 bg-[#25262a] p-4 text-[#f2f3f5]">
    {components.map((container, index) => <div key={index} className="space-y-3 border-l-4 pl-3"
      style={{ borderColor: `#${container.accent_color?.toString(16).padStart(6, "0") ?? "34d399"}` }}>
      {container.components?.map((item, index) => {
        if (item.type === 14) return <hr key={index} className="border-white/10" />;
        if (item.type === 12) return <div key={index} className="grid gap-2">{item.items?.map(({ media: { url } }) =>
          <div key={url} role="img" aria-label="Giveaway-Bild" className="aspect-video rounded-lg bg-[#1b1c20] bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${JSON.stringify(url)})` }} />)}</div>;
        if (item.type === 1) return <div key={index} className="flex flex-wrap gap-2">{item.components?.map((item, i) => {
          const classes = `rounded px-3 py-2 text-xs font-semibold ${item.style === 1 ? "bg-indigo-600" : "bg-[#41434a]"}`;
          const content = <>{item.emoji?.name} {item.label}</>;
          return infoButton && item.custom_id?.startsWith("gp-gw:info:")
            ? <button type="button" key={i} className={`${classes} hover:bg-[#50535a]`} aria-expanded={infoButton.open}
              aria-controls={infoButton.controls} onClick={infoButton.toggle}>{content}</button>
            : <span key={i} className={classes}>{content}</span>;
        })}</div>;
        return <div key={index} className="whitespace-pre-wrap break-words">{item.content?.split("\n").map((line, lineIndex) => {
          const style = /^##? /.test(line) ? "text-xl font-bold" : line.startsWith("-# ") ? "text-xs text-zinc-400" : "text-sm";
          const spoiler = /^(.*)\|\|([0-9a-f]{64}|Preview)\|\|$/.exec(line);
          return <p key={lineIndex} className={style}>{formatPreview(spoiler?.[1] ?? line, choices, timezone)}
            {spoiler && <span className="rounded bg-zinc-800 px-1">••••••</span>}</p>;
        })}</div>;
      })}
    </div>)}
  </div>;
}

function Preview({ components, info, choices, timezone }: PreviewData & { choices: Options; timezone: string }) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  return <>
    <PreviewMessage components={components} choices={choices} timezone={timezone}
      infoButton={info && { open, controls: detailsId, toggle: () => setOpen(value => !value) }} />
    {info && <div id={detailsId} hidden={!open} className="space-y-2">
      <p className={`text-xs ${muted}`}>Private Antwort auf den Info-Button</p>
      <PreviewMessage components={info.components} choices={choices} timezone={timezone} />
    </div>}
  </>;
}

type Mode = { config: GiveawayConfig; item?: Pick<Item, "id" | "startAt" | "endAt" | "revision">; template?: Template; asTemplate?: boolean; appearance?: boolean };
export function GiveawayEditor({ path, mode, choices, cancel, saved }: {
  path: string; mode: Mode; choices: Options; cancel: () => void; saved: (id?: string) => void;
}) {
  const { item, template, asTemplate, appearance } = mode;
  const [requestId] = useState(newId);
  const [config, setConfig] = useState(mode.config);
  const [templateName, setTemplateName] = useState(template?.name ?? "");
  const [start, setStart] = useState(() => localTime(item?.startAt ?? new Date(Date.now() + 5 * 60_000), config.timezone));
  const [end, setEnd] = useState(() => localTime(item?.endAt ?? new Date(Date.now() + config.durationHours * 3_600_000), config.timezone));
  const [laterStart, setLaterStart] = useState(false);
  const [laterEnd, setLaterEnd] = useState(false);
  const [editingTime, setEditingTime] = useState(false);
  const [preview, setPreview] = useState<PreviewData & { timezone: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previewError, setPreviewError] = useState("");

  function timestamps() {
    const startAt = item && !editingTime ? item.startAt : toInstant(start, config.timezone, laterStart);
    const endAt = item && !editingTime ? item.endAt : toInstant(end, config.timezone, laterEnd);
    if (new Date(endAt).getTime() - config.rules.entryBufferMinutes * 60_000 <= new Date(startAt).getTime()) {
      throw new Error("Der Teilnahmeschluss muss nach dem Start liegen.");
    }
    return { startAt, endAt };
  }

  async function showPreview() {
    setPreviewError("");
    setBusy(true);
    try {
      const endAt = asTemplate ? new Date(Date.now() + config.durationHours * 3_600_000).toISOString() : timestamps().endAt;
      const { data } = await api.post<PreviewData>(`${path}/preview`, { config, endAt });
      setPreview({ ...data, timezone: config.timezone });
    } catch (error) {
      setPreviewError(error instanceof Error && !("response" in error) ? error.message : requestError(error));
    } finally { setBusy(false); }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (appearance && item) {
        await api.put(`${path}/items/${item.id}/appearance`, { config, revision: item.revision });
        saved(item.id);
      } else if (asTemplate) {
        await api.put(`${path}/templates/${template?.id ?? requestId}`, { name: templateName, config });
        saved();
      } else {
        const payload = { config, ...timestamps(), revision: item?.revision, requestId };
        const response = item ? await api.put<Item>(`${path}/items/${item.id}`, payload) : await api.post<Item>(`${path}/items`, payload);
        saved(response.data.id);
      }
    } catch (error) {
      setError(error instanceof Error && !("response" in error) ? error.message : requestError(error));
    } finally { setBusy(false); }
  }
  const textField = (key: keyof GiveawayConfig, name: string, max: number, required = false) => <Field name={name}>
    <input className={field} maxLength={max} required={required} value={config[key] as string}
      onChange={event => setConfig({ ...config, [key]: event.target.value })} />
  </Field>;
  const textarea = (key: keyof GiveawayConfig, name: string, max: number) => <Field name={name}>
    <textarea className={field} rows={3} maxLength={max} value={config[key] as string} onChange={event => setConfig({ ...config, [key]: event.target.value })} />
  </Field>;
  const changeConfig = (next: GiveawayConfig) => {
    if (next.timezone !== config.timezone) setEditingTime(true);
    setConfig(next);
  };
  return <form className="space-y-4" onSubmit={save}>
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">{appearance ? "Ankündigung gestalten" : asTemplate ? template ? "Vorlage bearbeiten" : "Neue Vorlage" : item ? "Giveaway bearbeiten" : "Giveaway erstellen"}</h2>
      <button type="button" className={button} onClick={cancel}>Zurück</button>
    </header>
    {error && <p role="alert" className="rounded-lg bg-rose-950/30 p-3 text-sm text-rose-200">{error}</p>}
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.55fr)]">
      <div className="space-y-4">
        {!appearance && <><Section title="Giveaway & Preis" icon={<Gift size={19} />}>
          {asTemplate && <Field name="Vorlagenname"><input className={field} required maxLength={120} value={templateName} onChange={event => setTemplateName(event.target.value)} /></Field>}
          <div className="grid gap-3 sm:grid-cols-2">{textField("title", "Giveaway-Titel", 120, true)}{textField("prize", "Preisname", 120, true)}
            {textarea("prizeDescription", "Preisbeschreibung", 550)}{textField("image", "Preisbild · HTTPS-URL", 1000)}
            {textField("sponsor", "Sponsor", 120)}{textarea("information", "Weitere Informationen", 360)}
            {textarea("terms", "Regeln und Teilnahmebedingungen", 500)}
          </div>
        </Section>
        {asTemplate ? <Section title="Zeitplan">
          <NumberField name="Dauer in Stunden" value={config.durationHours} min={1} max={8760} change={value => setConfig({ ...config, durationHours: value })} />
        </Section> : <Section title="Zeitplan" lead={`Ortszeit in ${config.timezone}. Nach dem Speichern kannst du jetzt veröffentlichen oder den Start planen.`} icon={<CalendarDays size={19} />}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="Start"><input className={field} required type="datetime-local" value={start}
              onChange={event => { setStart(event.target.value); setEditingTime(true); }} /></Field>
            <Field name="Ende"><input className={field} required type="datetime-local" value={end}
              onChange={event => { setEnd(event.target.value); setEditingTime(true); }} /></Field>
            <Switch name="Start · bei Zeitumstellung spätere Uhrzeit" checked={laterStart} change={value => { setLaterStart(value); setEditingTime(true); }} />
            <Switch name="Ende · bei Zeitumstellung spätere Uhrzeit" checked={laterEnd} change={value => { setLaterEnd(value); setEditingTime(true); }} />
          </div>
        </Section>}</>}
        <Section title="Gestaltung" icon={<Palette size={19} />}>
          <div className="grid gap-3 sm:grid-cols-2">
            {textField("titleOverride", "Abweichender Ankündigungstitel", 120)}
            {textField("branding", "Branding", 100)}
            {textarea("description", "Einleitung", 550)}{textField("banner", "Banner · HTTPS-URL", 1000)}
            {textField("buttonLabel", "Teilnahmebutton", 70, true)}{textField("buttonEmoji", "Unicode-Emoji", 32)}
            {textField("footer", "Fußzeile", 150)}
            {appearance && <>{textField("image", "Preisbild · HTTPS-URL", 1000)}
              <Field name="Akzentfarbe"><input className={`${field} h-10`} type="color" value={config.color}
                onChange={event => setConfig({ ...config, color: event.target.value })} /></Field></>}
          </div>
        </Section>
        {!appearance && <ConfigFields value={config} choices={choices} change={changeConfig} />}
      </div>
      <aside className="space-y-4 xl:sticky xl:top-4">
        <Section title="Discord-Vorschau" icon={<Eye size={19} />}>
          <button type="button" disabled={busy} className={button} onClick={() => void showPreview()}><Eye size={16} />{preview ? "Vorschau aktualisieren" : "Vorschau anzeigen"}</button>
          {previewError && <p role="alert" className="text-sm text-rose-200">{previewError}</p>}
          {preview ? <Preview {...preview} choices={choices} /> : <p className={`text-sm ${muted}`}>Die Vorschau zeigt die Ankündigung mit deinen aktuellen Einstellungen.</p>}
        </Section>
        <button type="submit" className={`${primary} w-full`} disabled={busy}><Save size={16} />{busy ? "Verarbeitet …" : asTemplate ? "Vorlage speichern" : item ? "Änderungen speichern" : "Entwurf speichern"}</button>
      </aside>
    </div>
  </form>;
}
