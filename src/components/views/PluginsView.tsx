"use client";

import { FileText, Puzzle, Settings2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { CHANGELOG_PLUGIN, PluginState } from "@/types/plugins";
import { ChangelogWorkspace } from "./changelog/ChangelogWorkspace";
import { button, panel, requestError } from "./changelog/ui";

const workspaces = { [CHANGELOG_PLUGIN]: ChangelogWorkspace };
const icons = { changelog: FileText };

export function PluginsView({ guildId }: { guildId: string }) {
  const path = `/guilds/${guildId}/plugins`;
  const [plugins, setPlugins] = useState<PluginState[]>();
  const [active, setActive] = useState<keyof typeof workspaces>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState("");
  const locked = useRef(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setError("");
    try {
      const { data } = await api.get<PluginState[]>(path, { signal });
      setPlugins(data);
    } catch (error) {
      if (!signal?.aborted) setError(requestError(error));
    }
  }, [path]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function toggle(plugin: PluginState) {
    if (locked.current) return;
    locked.current = true;
    setBusy(plugin.id);
    setError("");
    try {
      const { data } = await api.patch<PluginState>(`${path}/${plugin.id}`, { enabled: !plugin.enabled });
      setPlugins((value) => value?.map((item) => item.id === data.id ? data : item));
    } catch (error) {
      setError(requestError(error));
    } finally {
      locked.current = false;
      setBusy(undefined);
    }
  }

  if (active) {
    const Workspace = workspaces[active];
    return <Workspace path={`${path}/${active}`} guildId={guildId} onBack={() => {
      setActive(undefined);
      void load();
    }} />;
  }

  return (
    <section className="mx-auto w-full max-w-screen-2xl px-4 pb-10 pt-5 sm:px-8">
      <header className="gp-page-heading">
        <div>
          <h1 className="flex items-center gap-3"><Puzzle className="text-[var(--gp-mint)]" /> Plugins</h1>
          <p>Optionale Funktionen für den ausgewählten Discord-Server.</p>
        </div>
      </header>
      {error && <p role="alert" className="mb-4 text-sm text-red-300">
        {error} <button type="button" className="underline" onClick={() => void load()}>Neu laden</button>
      </p>}
      {!plugins && !error && <p role="status">Plugins werden geladen …</p>}
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {plugins?.map((plugin) => {
          const Icon = icons[plugin.icon];
          const workspace = Object.hasOwn(workspaces, plugin.id) ? plugin.id as keyof typeof workspaces : undefined;
          return (
            <article className={`${panel} flex flex-col gap-5`} key={plugin.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <span className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-[var(--gp-mint)]">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <span className={`rounded-full border px-2.5 py-1 text-xs ${plugin.enabled
                  ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200" : "border-white/10 text-[var(--gp-muted)]"}`}>
                  {plugin.enabled ? "Aktiv" : "Deaktiviert"}
                </span>
              </div>
              <div className="grow space-y-2">
                <h2 className="text-lg font-semibold">{plugin.name}</h2>
                {plugin.experimental && <span className="text-xs text-amber-200">Experimentell</span>}
                <p className="text-sm leading-relaxed text-[var(--gp-muted)]">{plugin.description}</p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--gp-border)] pt-4">
                <button type="button" className="flex items-center gap-2 text-sm" role="switch"
                  aria-label={plugin.name} aria-checked={plugin.enabled} disabled={Boolean(busy)} onClick={() => void toggle(plugin)}>
                  <span aria-hidden="true" className={`flex h-6 w-11 items-center rounded-full border px-1 transition-colors ${plugin.enabled
                    ? "border-emerald-300/40 bg-emerald-300/30" : "border-white/20 bg-[var(--gp-raised)]"}`}>
                    <span className={`h-4 w-4 rounded-full bg-white transition-transform ${plugin.enabled ? "translate-x-4" : ""}`} />
                  </span>
                  {busy === plugin.id ? "Speichert …" : plugin.enabled ? "Deaktivieren" : "Aktivieren"}
                </button>
                {plugin.configurable && workspace && <button type="button" className={button}
                  onClick={() => setActive(workspace)} disabled={!plugin.enabled || Boolean(busy)}>
                  <Settings2 size={15} aria-hidden="true" /> Konfigurieren
                </button>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
