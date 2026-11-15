"use client";

import { isAxiosError } from "axios";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/lib/api";
import {
  autoModRuleIds, autoModRuleLabels, type AutoModRuleId, type AutoModSettings, type ModerationSettings, moderationPermissions,
} from "@/types/moderation";

type Option = { id: string; name: string };
type Props = { guildId: string; roles: Option[]; channels: (Option & { type: number })[] };

export const field = "w-full rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white";
export const panel = "panel-glass space-y-4 rounded-xl p-5";

export function requestError(error: unknown) {
  return isAxiosError(error) && typeof error.response?.data?.error === "string"
    ? error.response.data.error : "Die Anfrage ist fehlgeschlagen.";
}

export function SettingsForm<T>({ path, title, children }: {
  path: string;
  title: string;
  children: (settings: T, setSettings: (settings: T) => void) => ReactNode;
}) {
  const [settings, setSettings] = useState<T>();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void api.get<T>(path, { signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) setSettings(data);
    }).catch(error => {
      if (!controller.signal.aborted) setError(requestError(error));
    });
    return () => controller.abort();
  }, [path]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings || busy) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const { data } = await api.put<T>(path, settings);
      setSettings(data);
      setSaved(true);
    } catch (error) {
      setError(requestError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <h1 className="text-2xl font-bold">{title}</h1>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {saved && <p role="status" className="text-sm text-emerald-400">Einstellungen gespeichert.</p>}
      {!settings && !error && <p role="status" className="text-sm text-slate-400">Einstellungen werden geladen …</p>}
      {settings && (
        <form onSubmit={save}>
          <fieldset disabled={busy} className="space-y-4">
            {children(settings, updated => { setSettings(updated); setSaved(false); setError(""); })}
            <button type="submit" className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium disabled:opacity-50">
              {busy ? "Wird gespeichert …" : "Speichern"}
            </button>
          </fieldset>
        </form>
      )}
    </section>
  );
}

export function Selection({ label, options, value, onChange }: {
  label: string;
  options: Option[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const missing = value.filter(id => !options.some(option => option.id === id));
  return (
    <details className="rounded-lg border border-white/15 px-3 py-2 text-sm">
      <summary className="cursor-pointer">{label} ({value.length})</summary>
      <div className="mt-2 max-h-44 space-y-1 overflow-auto">
        {[...options, ...missing.map(id => ({ id, name: `Nicht verfügbar (${id})` }))].map(option => (
          <label key={option.id} className="flex items-center gap-2">
            <input type="checkbox" checked={value.includes(option.id)} onChange={event =>
              onChange(event.target.checked ? [...value, option.id] : value.filter(id => id !== option.id))} />
            {option.name}
          </label>
        ))}
        {options.length === 0 && missing.length === 0 && <p className="text-slate-400">Keine Auswahl verfügbar.</p>}
      </div>
    </details>
  );
}

export function ModerationSettingsView({ guildId, roles, channels }: Props) {
  const selectableRoles = roles.filter(role => role.id !== guildId);
  const textChannels = channels.filter(channel => channel.type === 0);
  return (
    <SettingsForm<ModerationSettings> title="Moderation · Einstellungen" path={`/guilds/${guildId}/moderation`}>
      {(settings, update) => (
        <div className={panel}>
          <label className="block space-y-2 text-sm">
            <span>Privater Mod-Log-Kanal</span>
            <select className={field} value={settings.logChannelId ?? ""}
              onChange={event => update({ ...settings, logChannelId: event.target.value || null })}>
              <option value="">Kein Kanal ausgewählt</option>
              {settings.logChannelId && !textChannels.some(channel => channel.id === settings.logChannelId) &&
                <option value={settings.logChannelId}>Kanal nicht verfügbar</option>}
              {textChannels.map(channel => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
            </select>
          </label>
          <p className="text-sm text-slate-400">
            Verweigere @everyone „Kanal ansehen“ und erlaube es den zuständigen Rollen und dem Bot.
          </p>
          {moderationPermissions.map(permission => <Selection key={permission} label={`Rollen: ${permission}`} options={selectableRoles}
            value={settings.permissions?.[permission] ?? (permission === "cases" || permission === "warn" ? settings.reviewRoleIds : permission === "timeout" ? settings.timeoutRoleIds : [])}
            onChange={ids => update({ ...settings, permissions: { ...settings.permissions, [permission]: ids } })} />)}
          <label className="flex gap-2"><input type="checkbox" checked={settings.dmDefault ?? false} onChange={e => update({ ...settings, dmDefault: e.target.checked })} />Nutzer-DM standardmäßig aktivieren</label>
          <p className="text-sm text-slate-400">
            Rollen für Warnungen und Fallverlauf brauchen „Nachrichten verwalten“, Timeout-Rollen brauchen
            „Mitglieder in Timeout versetzen“. Administratoren brauchen keine zusätzliche Rolle. Die Rollenhierarchie gilt weiterhin.
          </p>
        </div>
      )}
    </SettingsForm>
  );
}

export function AutoModView({ guildId, roles, channels }: Props) {
  const selectableRoles = roles.filter(role => role.id !== guildId);
  const channelOptions = channels.filter(channel => channel.type !== 4)
    .map(channel => ({ ...channel, name: `#${channel.name}` }));
  return (
    <SettingsForm<AutoModSettings> title="AutoMod" path={`/guilds/${guildId}/automod`}>
      {(settings, update) => (
        <>
          <p className="text-sm text-slate-400">
            Fälle erscheinen im Mod-Log unter „Moderation“. Für den Wiederholungs- und Einladungsfilter
            benötigt der Bot den Message Content Intent. Zum Löschen braucht er „Nachrichten verwalten“ im jeweiligen Kanal.
          </p>
          {autoModRuleIds.map(id => (
            <RuleSettings key={id} id={id} settings={settings} update={update}
              roles={selectableRoles} channels={channelOptions} />
          ))}
        </>
      )}
    </SettingsForm>
  );
}

function RuleSettings({ id, settings, update, roles, channels }: {
  id: AutoModRuleId;
  settings: AutoModSettings;
  update: (settings: AutoModSettings) => void;
  roles: Option[];
  channels: Option[];
}) {
  const rule = settings[id];
  const [codes, setCodes] = useState(() => settings.invites.allowedCodes.join("\n"));
  const [terms, setTerms] = useState(() => (id === "words" ? settings.words.words : settings.domains.domains).join("\n"));
  const [allowedTerms, setAllowedTerms] = useState(() => settings.domains.allowedDomains.join("\n"));
  function change(patch: Record<string, unknown>) {
    update({ ...settings, [id]: { ...rule, ...patch } });
  }

  return (
    <div className={panel}>
      <h2 className="text-lg font-semibold">{autoModRuleLabels[id]}</h2>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={rule.enabled} onChange={event => change({ enabled: event.target.checked })} />
        Regel aktiv
      </label>
      <label className="block space-y-2 text-sm">
        <span>Aktion</span>
        <select className={field} value={rule.action}
          onChange={event => change({ action: event.target.value === "delete" ? "delete" : "log" })}>
          <option value="log">Log only</option>
          <option value="delete">Delete and log</option>
        </select>
      </label>
      {(id === "flood" || id === "repeat") && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span>Nachrichten pro Mitglied</span>
            <input className={field} type="number" min={2} max={50} required value={settings[id].threshold || ""}
              onChange={event => change({ threshold: Number(event.target.value) })} />
          </label>
          <label className="space-y-2 text-sm">
            <span>Zeitfenster in Sekunden</span>
            <input className={field} type="number" min={1} max={120} required value={settings[id].windowSeconds || ""}
              onChange={event => change({ windowSeconds: Number(event.target.value) })} />
          </label>
        </div>
      )}
      {id === "invites" && (
        <label className="block space-y-2 text-sm">
          <span>Erlaubte Einladungen (ein Invite-Code pro Zeile)</span>
          <textarea className={field} rows={3} value={codes}
            onChange={event => {
              setCodes(event.target.value);
              change({ allowedCodes: event.target.value.split(/\s+/).filter(Boolean) });
            }} />
        </label>
      )}
      {(id === "flood" || id === "repeat") && <div className="space-y-2">
        <label><input type="checkbox" checked={settings[id].escalation?.enabled ?? false} onChange={e => change({ escalation: { hits: 3, windowSeconds: 300, timeoutSeconds: 300, ...settings[id].escalation, enabled: e.target.checked } })} /> Kurzer Timeout bei wiederholten Treffern</label>
        {settings[id].escalation && ([['hits', 'Treffer', 2, 50], ['windowSeconds', 'Zeitfenster (Sekunden)', 10, 3600], ['timeoutSeconds', 'Timeout (Sekunden)', 60, 3600]] as const).map(([key, label, min, max]) =>
          <label key={key} className="block">{label}<input className={field} type="number" min={min} max={max} value={settings[id].escalation![key]} onChange={e => change({ escalation: { ...settings[id].escalation, [key]: Number(e.target.value) } })} /></label>)}
      </div>}
      {id === "mentions" && <><label>Maximale Mentions<input className={field} type="number" min={1} max={50} value={settings.mentions.threshold} onChange={e => change({ threshold: Number(e.target.value) })} /></label>
        <label><input type="checkbox" checked={settings.mentions.everyone} onChange={e => change({ everyone: e.target.checked })} /> @everyone und @here filtern</label></>}
      {id === "words" && <><label>Wörter (eine Zeile je Eintrag)<textarea className={field} value={terms} onChange={e => { setTerms(e.target.value); change({ words: e.target.value.split('\n').map(v => v.trim()).filter(Boolean) }); }} /></label>
        <label><input type="checkbox" checked={settings.words.wholeWord} onChange={e => change({ wholeWord: e.target.checked })} /> Nur ganze Wörter</label></>}
      {id === "domains" && <>{(['domains', 'allowedDomains'] as const).map(key => <label className="block" key={key}>{key === 'domains' ? 'Gesperrte Domains' : 'Erlaubte Domains'} (eine je Zeile)<textarea className={field} value={key === 'domains' ? terms : allowedTerms} onChange={e => { (key === 'domains' ? setTerms : setAllowedTerms)(e.target.value); change({ [key]: e.target.value.split('\n').map(v => v.trim()).filter(Boolean) }); }} /></label>)}
        <label><input type="checkbox" checked={settings.domains.subdomains} onChange={e => change({ subdomains: e.target.checked })} /> Subdomains einschließen</label></>}
      <Selection label="Ausgenommene Rollen" options={roles} value={rule.exemptRoleIds}
        onChange={exemptRoleIds => change({ exemptRoleIds })} />
      <Selection label="Ausgenommene Kanäle einschließlich ihrer Threads" options={channels} value={rule.exemptChannelIds}
        onChange={exemptChannelIds => change({ exemptChannelIds })} />
    </div>
  );
}
