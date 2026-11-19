"use client";

import { ArrowLeft, ExternalLink, FileText, History, Pencil, Settings2 } from "lucide-react";
import { ComponentProps, useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { ChangelogContent, ChangelogOptions, ChangelogRecord, ChangelogSettings, ChangelogSummary, newChangelog } from "@/types/changelog";
import { ChangelogEditor } from "./ChangelogEditor";
import { ChangelogList, changelogTitle, discordMessageUrl } from "./ChangelogList";
import { ChangelogPreview } from "./ChangelogPreview";
import { ChangelogSettingsForm } from "./ChangelogSettingsForm";
import { ConfirmDialog, button, muted, requestError } from "./ui";

const tabs = [
  { id: "editor", label: "Editor", icon: Pencil },
  { id: "drafts", label: "Entwürfe", icon: FileText },
  { id: "history", label: "Verlauf", icon: History },
  { id: "settings", label: "Einstellungen", icon: Settings2 },
] as const;
type Tab = typeof tabs[number]["id"];
type Draft = Pick<ChangelogRecord, "id" | "content"> & { revision: number | null };
type Confirmation = Omit<ComponentProps<typeof ConfirmDialog>, "onCancel">;

function draftId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createDraft(settings: ChangelogSettings): Draft {
  return { id: draftId(), revision: null, content: newChangelog(settings) };
}

export function ChangelogWorkspace({ path, guildId, onBack }: { path: string; guildId: string; onBack: () => void }) {
  const records = `${path}/changelogs`;
  const [tab, setTab] = useState<Tab>("editor");
  const [settings, setSettings] = useState<ChangelogSettings>();
  const [options, setOptions] = useState<ChangelogOptions>();
  const [draft, setDraft] = useState<Draft>();
  const [dirty, setDirty] = useState(false);
  const [detail, setDetail] = useState<ChangelogRecord>();
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const locked = useRef(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoadError("");
    try {
      const [config, choices] = await Promise.all([
        api.get<ChangelogSettings>(`${path}/settings`, { signal }),
        api.get<ChangelogOptions>(`${path}/options`, { signal }),
      ]);
      setSettings(config.data);
      setOptions(choices.data);
      setDraft((value) => value ?? createDraft(config.data));
    } catch (error) {
      if (!signal?.aborted) setLoadError(requestError(error));
    }
  }, [path]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function perform(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (error) {
      setError(requestError(error));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  function replaceDraft(action: () => void) {
    if (!dirty) {
      action();
      return;
    }
    setConfirmation({
      heading: "Änderungen verwerfen?",
      description: "Deine Änderungen an diesem Entwurf wurden noch nicht gespeichert.",
      action: "Verwerfen",
      danger: true,
      onConfirm: action,
    });
  }

  function edit(value: Draft) {
    setDetail(undefined);
    setDraft(value);
    setDirty(false);
    setTab("editor");
  }

  async function store(value: Draft) {
    const { data } = await api.put<ChangelogRecord>(`${records}/${value.id}`, {
      revision: value.revision, content: value.content,
    });
    return data;
  }

  function saveDraft(value: Draft) {
    void perform(async () => {
      edit(await store(value));
      setNotice("Entwurf gespeichert.");
    });
  }

  function publish(value: Draft) {
    const channel = options?.channels.find(({ id }) => id === value.content.channelId);
    const role = value.content.ping && options?.roles.find(({ id }) => id === value.content.roleId);
    setConfirmation({
      heading: "Changelog veröffentlichen?",
      description: `„${value.content.title}“ wird jetzt in #${channel?.name ?? value.content.channelId} veröffentlicht.${role
        ? ` @${role.name} wird direkt davor separat benachrichtigt.` : ""}`,
      action: "Jetzt veröffentlichen",
      onConfirm: () => void perform(async () => {
        const saved = value.revision === null || dirty ? await store(value) : value;
        edit(saved);
        try {
          const { data } = await api.post<ChangelogRecord>(`${records}/${saved.id}/publish`, {
            confirmed: true, revision: saved.revision,
          });
          setDraft(settings ? createDraft(settings) : undefined);
          setTab("history");
          setDetail(data);
          setNotice("Changelog auf Discord veröffentlicht.");
        } catch (error) {
          const result = await api.get<ChangelogRecord>(`${records}/${saved.id}`).catch(() => null);
          if (result && result.data.status !== "draft") {
            setDraft(settings ? createDraft(settings) : undefined);
            setTab("history");
          }
          throw error;
        }
      }),
    });
  }

  function open(item: ChangelogSummary) {
    const action = () => void perform(async () => {
      const { data } = await api.get<ChangelogRecord>(`${records}/${item.id}`);
      if (data.status === "draft") edit(data);
      else {
        setTab("history");
        setDetail(data);
      }
    });
    if (item.status === "draft") replaceDraft(action);
    else action();
  }

  function duplicate(item: ChangelogSummary) {
    replaceDraft(() => void perform(async () => {
      const { data } = await api.get<ChangelogRecord>(`${records}/${item.id}`);
      edit(await store({ id: draftId(), revision: null, content: data.content }));
      setNotice("Kopie als Entwurf gespeichert.");
    }));
  }

  function remove(item: ChangelogSummary) {
    const isDraft = item.status === "draft";
    setConfirmation({
      heading: isDraft ? "Entwurf löschen?" : "Discord-Ankündigung löschen?",
      description: isDraft ? `„${changelogTitle(item)}“ wird endgültig gelöscht.`
        : `Die zu „${changelogTitle(item)}“ gehörenden Discord-Nachrichten werden gelöscht. Der Verlaufseintrag bleibt erhalten.`,
      danger: true,
      action: "Löschen",
      onConfirm: () => void perform(async () => {
        try {
          if (isDraft) {
            await api.delete(`${records}/${item.id}`, { data: { revision: item.revision } });
            if (draft?.id === item.id && settings) edit(createDraft(settings));
          } else {
            await api.delete(`${records}/${item.id}/announcement`, { data: { confirmed: true } });
          }
          setNotice(isDraft ? "Entwurf gelöscht." : "Discord-Nachrichten gelöscht.");
        } finally {
          setRefresh((value) => value + 1);
        }
      }),
    });
  }

  const externalUrl = detail && discordMessageUrl(guildId, detail);

  return (
    <section className="mx-auto w-full max-w-screen-2xl px-4 pb-10 pt-5 sm:px-8" aria-busy={busy}>
      <button type="button" className={`${button} mb-2`} disabled={busy} onClick={() => replaceDraft(onBack)}>
        <ArrowLeft size={16} /> Plugins
      </button>
      <header className="gp-page-heading">
        <h1>Changelog Publisher</h1>
      </header>
      {loadError && <p role="alert" className="text-sm text-red-300">{loadError}{" "}
        <button type="button" className="underline" onClick={() => void load()}>Neu laden</button>
      </p>}
      {!options && !loadError && <p role="status" className={muted}>Changelog Publisher wird geladen …</p>}
      {settings && options && draft && <>
        <nav aria-label="Changelog Publisher" className="mb-5 flex flex-wrap gap-2 border-b border-[var(--gp-border)] pb-3">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button type="button" className={`${button} ${tab === id ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100" : ""}`}
              key={id} aria-current={tab === id ? "page" : undefined} disabled={busy} onClick={() => {
                setTab(id);
                setDetail(undefined);
                setError("");
                setNotice("");
              }}>
              <Icon size={16} aria-hidden="true" /> {label}
            </button>
          ))}
        </nav>
        {busy && <p role="status" className={`mb-4 text-sm ${muted}`}>Anfrage läuft …</p>}
        {error && <p role="alert" className="mb-4 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-100">{notice}</p>}
        {tab === "editor" && <ChangelogEditor key={draft.id} content={draft.content} options={options} saved={draft.revision !== null}
          dirty={dirty} busy={busy} onChange={(content: ChangelogContent) => {
            setDraft({ ...draft, content });
            setDirty(true);
            setNotice("");
          }} onNew={() => replaceDraft(() => edit(createDraft(settings)))} onSave={() => saveDraft(draft)} onPublish={() => publish(draft)} />}
        {tab === "settings" && <ChangelogSettingsForm settings={settings} options={options} busy={busy} onSave={(value) => {
          void perform(async () => {
            const { data } = await api.put<ChangelogSettings>(`${path}/settings`, value);
            setSettings(data);
            if (draft.revision === null && !dirty) setDraft(createDraft(data));
            setNotice("Standardeinstellungen gespeichert.");
          });
        }} />}
        {(tab === "drafts" || tab === "history") && !detail && <ChangelogList path={records} guildId={guildId} mode={tab} key={tab}
          refresh={refresh} busy={busy} onOpen={open} onDuplicate={duplicate} onDelete={remove} />}
        {tab === "history" && detail && <div className="max-w-2xl space-y-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={button} onClick={() => setDetail(undefined)}><ArrowLeft size={16} /> Zum Verlauf</button>
            {externalUrl && <a className={button} href={externalUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /> In Discord öffnen</a>}
          </div>
          <ChangelogPreview content={detail.content} date={detail.publishedAt ? new Date(detail.publishedAt) : undefined}
            role={options.roles.find(({ id }) => id === detail.content.roleId)?.name} channel={detail.channelName ?? undefined} />
        </div>}
      </>}
      {confirmation && <ConfirmDialog {...confirmation} onCancel={() => setConfirmation(undefined)} onConfirm={() => {
        setConfirmation(undefined);
        confirmation.onConfirm();
      }} />}
    </section>
  );
}
