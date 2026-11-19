import { Save } from "lucide-react";
import { useState } from "react";
import { ChangelogOptions, ChangelogSettings, changelogLimits } from "@/types/changelog";
import { DestinationSelect, field, label, muted, panel, primary } from "./ui";

export function ChangelogSettingsForm({ settings, options, busy, onSave }: {
  settings: ChangelogSettings; options: ChangelogOptions; busy: boolean; onSave: (settings: ChangelogSettings) => void;
}) {
  const [form, setForm] = useState(settings);
  const update = (patch: Partial<ChangelogSettings>) => setForm((current) => ({ ...current, ...patch }));

  return (
    <form className={`${panel} max-w-3xl space-y-5`} onSubmit={(event) => {
      event.preventDefault();
      onSave(form);
    }}>
      <div className="space-y-1">
        <h2 className="font-semibold">Standards für neue Changelogs</h2>
        <p className={`text-sm ${muted}`}>Diese Einstellungen gelten für neu erstellte Entwürfe auf diesem Server.</p>
      </div>
      <fieldset className="grid gap-4 sm:grid-cols-2" disabled={busy}>
        <DestinationSelect label="Standardkanal" prefix="#" choices={options.channels} value={form.channelId}
          placeholder="Kein Standardkanal" onChange={(channelId) => update({ channelId })} />
        <DestinationSelect label="Standard-Ping-Rolle" prefix="@" choices={options.roles} value={form.roleId}
          placeholder="Keine Standardrolle" onChange={(roleId) => update({ roleId, autoPing: Boolean(roleId) && form.autoPing })} />
        <label className={label}>Sprache der Ankündigung
          <select className={field} value={form.language} onChange={(e) => update({ language: e.target.value as ChangelogSettings["language"] })}>
            <option value="en">English</option>
            <option value="de">Deutsch</option>
          </select>
        </label>
        <label className={label}>Standard-Akzentfarbe
          <span className="flex items-center gap-3">
            <input type="color" className="h-10 w-12 cursor-pointer rounded-lg border border-[var(--gp-border)] p-1"
              value={form.color} onChange={(e) => update({ color: e.target.value })} />
            <span className={`font-mono text-xs ${muted}`}>{form.color}</span>
          </span>
        </label>
        <label className={`${label} sm:col-span-2`}>Standard-Fußzeile
          <input className={field} value={form.footer} maxLength={changelogLimits.footer} onChange={(e) => update({ footer: e.target.value })} />
        </label>
        <label className="flex min-h-9 items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={form.autoPing} disabled={!form.roleId} onChange={(e) => update({ autoPing: e.target.checked })} />
          Standardrolle automatisch benachrichtigen
        </label>
      </fieldset>
      <button className={primary} disabled={busy} type="submit"><Save size={16} /> Einstellungen speichern</button>
    </form>
  );
}
