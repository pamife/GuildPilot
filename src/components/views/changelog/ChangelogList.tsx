import { Copy, ExternalLink, Eye, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ChangelogPage, ChangelogStatus, ChangelogSummary } from "@/types/changelog";
import { button, muted, panel, requestError } from "./ui";

const statuses: Record<ChangelogStatus, string> = {
  draft: "Entwurf",
  publishing: "Versand unbestätigt",
  published: "Veröffentlicht",
  failed: "Fehlgeschlagen · Ping offen",
  deleting: "Löschung offen",
  deleted: "Gelöscht",
};

export function discordMessageUrl(guildId: string, entry: ChangelogSummary) {
  return entry.channelId && entry.messageId && entry.status === "published"
    ? `https://discord.com/channels/${guildId}/${entry.channelId}/${entry.messageId}` : null;
}

export function changelogTitle(entry: ChangelogSummary) {
  return entry.title || "Entwurf ohne Titel";
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function ChangelogList({ path, guildId, mode, refresh, busy, onOpen, onDuplicate, onDelete }: {
  path: string; guildId: string; mode: "drafts" | "history"; refresh: number; busy: boolean;
  onOpen: (item: ChangelogSummary) => void; onDuplicate: (item: ChangelogSummary) => void; onDelete: (item: ChangelogSummary) => void;
}) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ChangelogPage>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const drafts = mode === "drafts";

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setResult(undefined);
    api.get<ChangelogPage>(path, { signal: controller.signal, params: { page, view: mode } })
      .then(({ data }) => {
        if (data.items.length === 0 && page > 1) setPage(page - 1);
        else setResult(data);
      })
      .catch((err) => { if (!controller.signal.aborted) setError(requestError(err)); });
    return () => controller.abort();
  }, [path, mode, page, refresh, retry]);

  return (
    <section aria-label={drafts ? "Entwürfe" : "Verlauf"} className="space-y-3">
      {error && <p role="alert" className="text-sm text-red-300">{error}{" "}
        <button type="button" className="underline" onClick={() => setRetry((value) => value + 1)}>Neu laden</button>
      </p>}
      {!result && !error && <p role="status" className={muted}>Changelogs werden geladen …</p>}
      {result?.items.length === 0 && <p className={`${panel} ${muted}`}>
        {drafts ? "Für diesen Server gibt es noch keine gespeicherten Entwürfe." : "Für diesen Server gibt es noch keine Veröffentlichungen."}
      </p>}
      {result?.items.map((item) => {
        const url = discordMessageUrl(guildId, item);
        const canDelete = drafts || ["published", "deleting", "failed"].includes(item.status);
        return (
          <article key={item.id} className={`${panel} grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center`}>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="min-w-0 break-words font-semibold">{changelogTitle(item)}</h2>
                {item.version && <span className="max-w-full break-all rounded-md bg-white/5 px-2 py-1 font-mono text-xs">{item.version}</span>}
                {!drafts && <span className={`rounded-full border border-white/10 px-2.5 py-1 text-xs ${item.status === "published" ? "text-emerald-200" : muted}`}>
                  {statuses[item.status]}
                </span>}
              </div>
              <div className={`flex flex-wrap gap-x-4 gap-y-1 text-xs ${muted}`}>
                <time dateTime={item.publishedAt ?? item.updatedAt}>
                  {drafts ? "Bearbeitet " : ""}{formatTimestamp(item.publishedAt ?? item.updatedAt)}
                </time>
                {!drafts && item.publisherId && <span className="break-all" title={item.publisherId}>von {item.publisherName || item.publisherId}</span>}
                {!drafts && item.channelId && <span className="break-all" title={item.channelId}>#{item.channelName || item.channelId}</span>}
              </div>
              {item.status === "publishing" && <p className="text-xs text-amber-200">Prüfe im Zielkanal, ob Discord die Ankündigung erhalten hat.</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={button} disabled={busy} onClick={() => onOpen(item)}>
                {drafts ? <Pencil size={15} /> : <Eye size={15} />} {drafts ? "Bearbeiten" : "Ansehen"}
              </button>
              <button type="button" className={button} disabled={busy || item.status === "publishing"} onClick={() => onDuplicate(item)}>
                <Copy size={15} /> Als Entwurf duplizieren
              </button>
              {url && <a className={button} href={url} target="_blank" rel="noreferrer"><ExternalLink size={15} /> In Discord öffnen</a>}
              {canDelete && <button type="button" className={`${button} text-red-200`} disabled={busy} onClick={() => onDelete(item)}>
                <Trash2 size={15} /> {item.status === "deleting" ? "Löschung wiederholen" : "Löschen"}
              </button>}
            </div>
          </article>
        );
      })}
      {result && (page > 1 || result.hasNext) && <nav className="flex flex-wrap items-center gap-3" aria-label="Changelog-Seiten">
        <button type="button" className={button} disabled={page === 1 || busy} onClick={() => setPage(page - 1)}>Zurück</button>
        <span className={`text-sm ${muted}`}>Seite {page}</span>
        <button type="button" className={button} disabled={!result.hasNext || busy} onClick={() => setPage(page + 1)}>Weiter</button>
      </nav>}
    </section>
  );
}
