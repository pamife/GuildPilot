"use client";

import { isAxiosError } from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { CountingStats } from "@/types/counting";

interface Props {
  guildId: string;
  channels: { id: string; name: string; type: number }[];
}

function errorMessage(error: unknown) {
  return isAxiosError(error) && typeof error.response?.data?.error === "string"
    ? error.response.data.error
    : "Relay Count konnte die Anfrage nicht abschließen.";
}

export function CountingView({ guildId, channels }: Props) {
  const path = `/guilds/${guildId}/counting`;
  const request = useRef<AbortController>();
  const [stats, setStats] = useState<CountingStats>();
  const [selectedChannel, setSelectedChannel] = useState<string>();
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const { data } = await api.get<CountingStats>(path, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setStats(data);
      setLoadError("");
    } catch (error) {
      if (!controller.signal.aborted) setLoadError(errorMessage(error));
    }
  }, [path]);

  useEffect(() => {
    const socket = getSocket();
    const onChange = (event: { guildId: string }) => {
      if (event.guildId === guildId) void refresh();
    };
    socket.on("countingChanged", onChange);
    socket.on("guildJoined", onChange);
    void refresh();
    return () => {
      socket.off("countingChanged", onChange);
      socket.off("guildJoined", onChange);
      request.current?.abort();
    };
  }, [guildId, refresh]);

  async function update(action: "setup" | "reset") {
    setBusy(true);
    setActionError("");
    setNotice("");
    try {
      if (action === "setup") {
        await api.put(path, { channelId: selectedChannel });
        setSelectedChannel(undefined);
        setNotice("Zählkanal gespeichert.");
      } else {
        await api.post(`${path}/reset`, { confirmed: true });
        setConfirmReset(false);
        setNotice("Run zurückgesetzt.");
      }
      await refresh();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const textChannels = channels.filter((channel) => channel.type === 0);
  const activeChannel = selectedChannel ?? stats?.channelId ?? "";
  const saveLabel = stats?.saveStatus === "charged"
    ? "Bereit"
    : stats?.saveStatus === "used"
      ? "In diesem Run verbraucht"
      : `Relay-Fortschritt · ${stats?.relayProgress}/5`;
  const button = "rounded-lg border border-white/15 px-4 py-2 text-sm font-medium disabled:opacity-50";

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Relay Count</h1>
        <p className="mt-1 text-sm text-slate-400">Fünf verschiedene Personen in Folge verdienen einen gemeinsamen Rettungsversuch.</p>
      </header>
      {loadError && <p role="alert" className="text-sm text-red-400">{loadError} <button className="underline" onClick={refresh}>Neu laden</button></p>}
      {!stats && !loadError && <p role="status" className="text-sm text-slate-400">Spielstand wird geladen …</p>}
      {stats && (
        <>
          <dl className="grid gap-3 sm:grid-cols-3">
            {[
              ["Nächste Zahl", stats.nextNumber],
              ["Serverrekord", stats.record],
              ["Relay Save", saveLabel],
            ].map(([label, value]) => (
              <div className="panel-glass rounded-xl p-4" key={label}>
                <dt className="text-sm text-slate-400">{label}</dt>
                <dd className="mt-2 break-all text-lg font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="panel-glass space-y-5 rounded-xl p-5">
            <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); void update("setup"); }}>
              <label className="flex min-w-52 flex-1 flex-col gap-2 text-sm">
                Zählkanal
                <select className="rounded-lg border border-white/15 bg-slate-900 p-2 text-white" value={activeChannel} disabled={busy}
                  onChange={(event) => setSelectedChannel(event.target.value)}>
                  <option value="" disabled>Textkanal auswählen</option>
                  {stats.channelId && !textChannels.some((channel) => channel.id === stats.channelId) && (
                    <option value={stats.channelId}>Kanal nicht verfügbar ({stats.channelId})</option>
                  )}
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </label>
              <button className={`${button} bg-indigo-600 text-white`} disabled={busy || !selectedChannel || selectedChannel === stats.channelId}>
                Kanal speichern
              </button>
            </form>
            {confirmReset ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm">Der Run startet bei 1. Der Serverrekord bleibt erhalten.</p>
                <button className={`${button} border-red-500/40 text-red-400`} disabled={busy} onClick={() => update("reset")}>Reset bestätigen</button>
                <button className={button} disabled={busy} onClick={() => setConfirmReset(false)}>Abbrechen</button>
              </div>
            ) : (
              <button className={button} disabled={busy || !stats.channelId} onClick={() => setConfirmReset(true)}>Run zurücksetzen</button>
            )}
            {actionError && <p role="alert" className="text-sm text-red-400">{actionError}</p>}
            {notice && <p role="status" className="text-sm text-emerald-400">{notice}</p>}
          </div>
        </>
      )}
    </section>
  );
}
