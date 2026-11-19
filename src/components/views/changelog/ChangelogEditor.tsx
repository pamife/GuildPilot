import { ArrowDown, ArrowUp, Eye, GripVertical, Plus, Save, Send, Trash2 } from "lucide-react";
import { DragEvent, useRef, useState } from "react";
import {
  ChangelogContent, ChangelogOptions, ChangelogSection, SectionType, changelogLimits as limits,
  changelogPublishError, newSection, sectionPresets,
} from "@/types/changelog";
import { ChangelogPreview } from "./ChangelogPreview";
import { DestinationSelect, button, field, label, muted, panel, primary } from "./ui";

type Position = { section: number; entry?: number };

function reorder<T>(items: T[], from: number, to: number): T[] {
  if (from === to || to < 0 || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

const iconButton = `${button} !min-h-9 !px-2`;

function OrderingControls({ name, position, index, length, move, start, end }: {
  name: string; position: Position; index: number; length: number; move: (to: number) => void;
  start: (event: DragEvent, position: Position) => void; end: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span draggable={length > 1} onDragStart={(event) => start(event, position)} onDragEnd={end}
        title={`${name} ziehen`} aria-hidden="true" className="hidden cursor-grab px-1 text-[var(--gp-muted)] sm:inline-flex">
        <GripVertical size={15} />
      </span>
      <button className={iconButton} type="button" aria-label={`${name} nach oben`} title="Nach oben"
        disabled={index === 0} onClick={() => move(index - 1)}><ArrowUp size={14} /></button>
      <button className={iconButton} type="button" aria-label={`${name} nach unten`} title="Nach unten"
        disabled={index === length - 1} onClick={() => move(index + 1)}><ArrowDown size={14} /></button>
    </div>
  );
}

export function ChangelogEditor({ content, options, saved, dirty, busy, onChange, onNew, onSave, onPublish }: {
  content: ChangelogContent; options: ChangelogOptions; saved: boolean; dirty: boolean; busy: boolean;
  onChange: (content: ChangelogContent) => void; onNew: () => void; onSave: () => void; onPublish: () => void;
}) {
  const [preset, setPreset] = useState<SectionType>("features");
  const [dragged, setDragged] = useState<Position>();
  const preview = useRef<HTMLDivElement>(null);
  const role = options.roles.find(({ id }) => id === content.roleId);
  const channel = options.channels.find(({ id }) => id === content.channelId);
  const issue = changelogPublishError(content)
    ?? (content.channelId && !channel ? "Wähle einen Kanal, in dem der Bot Nachrichten senden kann." : null)
    ?? (content.roleId && !role ? "Wähle eine verfügbare Ping-Rolle oder entferne die Auswahl." : null);
  const update = (patch: Partial<ChangelogContent>) => onChange({ ...content, ...patch });
  const setSection = (index: number, patch: Partial<ChangelogSection>) => {
    update({ sections: content.sections.map((section, current) => current === index ? { ...section, ...patch } : section) });
  };
  const move = (source: Position, to: number) => {
    if (source.entry === undefined) update({ sections: reorder(content.sections, source.section, to) });
    else setSection(source.section, { entries: reorder(content.sections[source.section].entries, source.entry, to) });
  };
  const start = (event: DragEvent, position: Position) => {
    event.dataTransfer.setData("application/x-guildpilot-changelog", "reorder");
    event.dataTransfer.effectAllowed = "move";
    setDragged(position);
  };
  const end = () => setDragged(undefined);
  const dropAllowed = (target: Position) => dragged && (target.entry === undefined
    ? dragged.entry === undefined : dragged.section === target.section && dragged.entry !== undefined);
  const dropTarget = (target: Position) => ({
    onDragOver: (event: DragEvent) => {
      if (!dropAllowed(target)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    },
    onDrop: (event: DragEvent) => {
      if (!dragged || !dropAllowed(target)) return;
      event.preventDefault();
      event.stopPropagation();
      move(dragged, target.entry ?? target.section);
      end();
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`text-sm ${muted}`}>{dirty ? "Ungespeicherte Änderungen" : saved ? "Entwurf gespeichert" : "Neuer Entwurf"}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} disabled={busy} onClick={onNew}><Plus size={16} /> Neu</button>
          <button type="button" className={`${button} xl:hidden`} onClick={() => preview.current?.scrollIntoView({ block: "start" })}>
            <Eye size={16} /> Vorschau
          </button>
          <button type="button" className={button} disabled={busy || (saved && !dirty)} onClick={onSave}>
            <Save size={16} /> Entwurf speichern
          </button>
          <button type="button" className={primary} disabled={busy || Boolean(issue)} onClick={onPublish} aria-describedby={issue ? "changelog-validation" : undefined}>
            <Send size={16} /> Veröffentlichen
          </button>
        </div>
      </div>
      {issue && <p id="changelog-validation" className={`text-sm ${muted}`}>{issue}</p>}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <fieldset disabled={busy} aria-label="Changelog-Inhalt" className="min-w-0 space-y-4">
          <div className={`${panel} space-y-4`}>
            <h2 className="font-semibold">Ankündigung</h2>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(7rem,0.4fr)]">
              <label className={label}>Titel
                <input className={field} value={content.title} maxLength={limits.title}
                  placeholder="Ein Titel für dein Update" onChange={(e) => update({ title: e.target.value })} />
              </label>
              <label className={label}>Version
                <input className={field} value={content.version} maxLength={limits.version}
                  placeholder="v1.2.0" onChange={(e) => update({ version: e.target.value })} />
              </label>
            </div>
            <label className={label}>Einleitung
              <textarea className={field} value={content.intro} maxLength={limits.intro} rows={3}
                onChange={(e) => update({ intro: e.target.value })} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <DestinationSelect label="Ankündigungskanal" prefix="#" choices={options.channels} value={content.channelId}
                placeholder="Kanal auswählen" onChange={(channelId) => update({ channelId })} />
              <DestinationSelect label="Ping-Rolle" prefix="@" choices={options.roles} value={content.roleId}
                placeholder="Keine Rolle" onChange={(roleId) => update({ roleId, ping: Boolean(roleId) })} />
              <label className="flex min-h-9 items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={content.ping} onChange={(e) => update({ ping: e.target.checked })} />
                Rolle beim Versand benachrichtigen
              </label>
              <label className={label}>Banner-URL
                <input type="url" className={field} value={content.banner} maxLength={limits.banner}
                  placeholder="https://…" onChange={(e) => update({ banner: e.target.value })} />
              </label>
              <label className={label}>Akzentfarbe
                <span className="flex items-center gap-3">
                  <input type="color" className="h-10 w-12 cursor-pointer rounded-lg border border-[var(--gp-border)] p-1"
                    value={content.color} onChange={(e) => update({ color: e.target.value })} />
                  <span className={`font-mono text-xs ${muted}`}>{content.color}</span>
                </span>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,0.5fr)]">
              <label className={label}>Fußzeile
                <input className={field} maxLength={limits.footer} value={content.footer} onChange={(e) => update({ footer: e.target.value })} />
              </label>
              <label className={label}>Sprache der Ankündigung
                <select className={field} value={content.language} onChange={(e) => {
                  const language = e.target.value as ChangelogContent["language"];
                  const sections = content.sections.map((section) => {
                    const preset = sectionPresets[section.type];
                    return section.title === preset[content.language] ? { ...section, title: preset[language] } : section;
                  });
                  update({ language, sections });
                }}>
                  <option value="en">English</option>
                  <option value="de">Deutsch</option>
                </select>
              </label>
            </div>
          </div>
          <div className={`${panel} space-y-4`}>
            <h2 className="font-semibold">Abschnitte</h2>
            {content.sections.map((section, index) => (
              <article className="min-w-0 space-y-3 rounded-xl border border-[var(--gp-border)] bg-[var(--gp-bg)] p-3" key={index} {...dropTarget({ section: index })}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{sectionPresets[section.type].emoji} {sectionPresets[section.type][content.language]}</h3>
                  <div className="flex flex-wrap items-center gap-1">
                    <OrderingControls name={`Abschnitt ${index + 1}`} position={{ section: index }} index={index}
                      length={content.sections.length} move={(to) => move({ section: index }, to)} start={start} end={end} />
                    <button type="button" className={`${iconButton} text-red-200`} aria-label={`Abschnitt ${index + 1} entfernen`}
                      title="Abschnitt entfernen" onClick={() => update({ sections: content.sections.filter((_, i) => i !== index) })}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
                  <label className={label}>Emoji
                    <input className={field} maxLength={limits.emoji} value={section.emoji} onChange={(e) => setSection(index, { emoji: e.target.value })} />
                  </label>
                  <label className={label}>Abschnittstitel
                    <input className={field} maxLength={limits.sectionTitle} value={section.title} onChange={(e) => setSection(index, { title: e.target.value })} />
                  </label>
                </div>
                <label className={label}>Beschreibung
                  <textarea className={field} rows={2} maxLength={limits.description} value={section.description}
                    onChange={(e) => setSection(index, { description: e.target.value })} />
                </label>
                <div className="space-y-2">
                  {section.entries.map((entry, entryIndex) => (
                    <div className="flex flex-wrap items-center gap-1" key={entryIndex} {...dropTarget({ section: index, entry: entryIndex })}>
                      <input className={`${field} w-full grow sm:w-0 sm:min-w-[7rem]`} aria-label={`Eintrag ${entryIndex + 1} in Abschnitt ${index + 1}`}
                        placeholder="Was hat sich geändert?" maxLength={limits.entry} value={entry}
                        onChange={(e) => setSection(index, { entries: section.entries.map((value, i) => i === entryIndex ? e.target.value : value) })} />
                      <OrderingControls name={`Eintrag ${entryIndex + 1} in Abschnitt ${index + 1}`} position={{ section: index, entry: entryIndex }}
                        index={entryIndex} length={section.entries.length} move={(to) => move({ section: index, entry: entryIndex }, to)} start={start} end={end} />
                      <button type="button" className={`${iconButton} text-red-200`} aria-label={`Eintrag ${entryIndex + 1} in Abschnitt ${index + 1} entfernen`}
                        title="Eintrag entfernen" onClick={() => setSection(index, { entries: section.entries.filter((_, i) => i !== entryIndex) })}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className={button} disabled={section.entries.length >= limits.entries}
                  onClick={() => setSection(index, { entries: [...section.entries, ""] })}>
                  <Plus size={15} /> Eintrag hinzufügen
                </button>
              </article>
            ))}
            <div className="flex flex-wrap gap-2">
              <select className={`${field} sm:w-auto`} aria-label="Abschnittstyp auswählen"
                value={preset} onChange={(e) => setPreset(e.target.value as SectionType)}>
                {Object.entries(sectionPresets).map(([type, value]) => <option value={type} key={type}>{value.emoji} {value[content.language]}</option>)}
              </select>
              <button type="button" className={button} disabled={content.sections.length >= limits.sections}
                onClick={() => update({ sections: [...content.sections, newSection(preset, content.language)] })}>
                <Plus size={15} /> Abschnitt hinzufügen
              </button>
            </div>
          </div>
        </fieldset>
        <div ref={preview} className="min-w-0 scroll-mt-4 xl:sticky xl:top-4">
          <ChangelogPreview content={content} role={role?.name} channel={channel?.name} date={new Date()} editing />
        </div>
      </div>
    </div>
  );
}
