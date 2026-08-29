"use client";

import React, { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket";
import { api } from "@/lib/api";
import {
  Cpu,
  HardDrive,
  Activity,
  Server,
  Zap,
  Clock,
  ShieldCheck,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Terminal,
  Circle,
  Wrench,
  RotateCcw,
} from "lucide-react";

export function HostServerView() {
  const [metrics, setMetrics] = useState<any>(null);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [searchProc, setSearchProc] = useState("");
  const [cpuHistory, setCpuHistory] = useState<number[]>(Array(30).fill(0));
  const [netRxHistory, setNetRxHistory] = useState<number[]>(Array(30).fill(0));
  const [netTxHistory, setNetTxHistory] = useState<number[]>(Array(30).fill(0));

  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<{
    isUpdating: boolean;
    step: number;
    totalSteps: number;
    percent: number;
    currentAction: string;
    status: "idle" | "checking" | "running" | "success" | "error";
    logs: string[];
    localCommit?: string;
    remoteCommit?: string;
    timestamp?: string;
    errorDetails?: string;
  } | null>(null);

  useEffect(() => {
    const socket = getSocket();

    const handleMetrics = (data: any) => {
      setMetrics(data);

      if (data?.cpu?.totalLoad !== undefined) {
        setCpuHistory((prev) => [...prev.slice(1), data.cpu.totalLoad]);
      }
      if (data?.network?.totalRxSec !== undefined) {
        const rxKb = Math.round(data.network.totalRxSec / 1024);
        const txKb = Math.round(data.network.totalTxSec / 1024);
        setNetRxHistory((prev) => [...prev.slice(1), rxKb]);
        setNetTxHistory((prev) => [...prev.slice(1), txKb]);
      }
    };

    const handleUpdateNotif = (data: any) => {
      setUpdateInfo(data);
    };

    const handleUpdateProgress = (data: any) => {
      setUpdateProgress(data);
      if (data?.isUpdating || data?.status === "running" || data?.status === "checking") {
        setShowLogs(true);
      }
    };

    socket.on("hostMetricsUpdate", handleMetrics);
    socket.on("updateNotification", handleUpdateNotif);
    socket.on("updateProgress", handleUpdateProgress);

    // Initial fetch via API if socket has not emitted yet
    api
      .get("/host-server/metrics")
      .then((res) => {
        if (res.data && !res.data.error) handleMetrics(res.data);
      })
      .catch(() => {});

    api
      .get("/host-server/updates")
      .then((res) => {
        if (res.data && res.data.commit) setUpdateInfo(res.data);
      })
      .catch(() => {});

    api
      .get("/host-server/update-progress")
      .then((res) => {
        if (res.data) setUpdateProgress(res.data);
      })
      .catch(() => {});

    api
      .get("/host-server/hourly-restart-info")
      .then((res) => {
        if (res.data && res.data.minutesRemaining !== undefined) setHourlyRestartInfo(res.data);
      })
      .catch(() => {});

    return () => {
      socket.off("hostMetricsUpdate", handleMetrics);
      socket.off("updateNotification", handleUpdateNotif);
      socket.off("updateProgress", handleUpdateProgress);
    };
  }, []);

  const [hourlyRestartInfo, setHourlyRestartInfo] = useState<{ nextRestart: string; minutesRemaining: number } | null>(null);
  const [restartingNow, setRestartingNow] = useState(false);

  const handleRestartNow = async () => {
    if (!confirm("Bist du sicher, dass du das gesamte System jetzt neu starten möchtest? Alle Verbindungen & Caches werden neu geladen.")) return;
    setRestartingNow(true);
    try {
      await api.post("/host-server/restart-now");
    } catch (e) {}
    setTimeout(() => {
      window.location.reload();
    }, 3500);
  };

  // Active polling while update check or installation is running
  useEffect(() => {
    if (!checkingUpdate && !updateProgress?.isUpdating) return;

    const interval = setInterval(() => {
      api
        .get("/host-server/update-progress")
        .then((res) => {
          if (res.data) setUpdateProgress(res.data);
        })
        .catch(() => {});
    }, 800);

    return () => clearInterval(interval);
  }, [checkingUpdate, updateProgress?.isUpdating]);

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setShowLogs(true);

    // Optimistic progress state for step 1
    setUpdateProgress((prev: any) => ({
      isUpdating: true,
      step: 1,
      totalSteps: 6,
      percent: 10,
      currentAction: "Prüfe GitHub-Repository auf neue Commits...",
      status: "checking",
      logs: [...(prev?.logs || []), `[${new Date().toLocaleTimeString()}] Starte GitHub origin/main Abfrage...`],
    }));

    try {
      const res = await api.post("/host-server/check-update");
      const data = res.data;
      if (data && data.message) {
        setUpdateInfo({
          id: `update_${Date.now()}`,
          status: "success",
          message: data.message,
          commitShort: data.remoteCommit || data.localCommit || "latest",
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      console.error("Update check failed:", err);
      setUpdateInfo({
        id: `update_err_${Date.now()}`,
        status: "error",
        message: `Update check failed: ${err.response?.data?.error || err.message}`,
        commitShort: "error",
        timestamp: new Date().toISOString(),
      });
    } finally {
      // Immediately fetch current update-progress state
      api
        .get("/host-server/update-progress")
        .then((res) => {
          if (res.data) setUpdateProgress(res.data);
        })
        .catch(() => {});
      setCheckingUpdate(false);
    }
  };

  const [rebuilding, setRebuilding] = useState(false);

  const handleForceRebuild = async () => {
    if (!confirm("Möchtest du das gesamte Projekt (Frontend & Backend) jetzt sauber neu kompilieren und die Dienste neu starten?")) return;
    setRebuilding(true);
    setShowLogs(true);

    setUpdateProgress((prev: any) => ({
      isUpdating: true,
      step: 1,
      totalSteps: 6,
      percent: 15,
      currentAction: "Manueller Rebuild (Clean Build & Restart) wird initialisiert...",
      status: "running",
      logs: [...(prev?.logs || []), `[${new Date().toLocaleTimeString()}] 🔧 Manueller Rebuild durch Benutzer gestartet...`],
    }));

    try {
      const res = await api.post("/host-server/force-rebuild", { skipGit: false });
      const data = res.data;
      if (data && data.message) {
        setUpdateInfo({
          id: `rebuild_${Date.now()}`,
          status: "success",
          message: data.message,
          commitShort: "rebuild",
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      console.error("Force rebuild failed:", err);
      setUpdateInfo({
        id: `rebuild_err_${Date.now()}`,
        status: "error",
        message: `Force rebuild failed: ${err.response?.data?.error || err.message}`,
        commitShort: "error",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setRebuilding(false);
    }
  };

  const [resettingState, setResettingState] = useState(false);

  const handleResetUpdateState = async () => {
    setResettingState(true);
    try {
      const res = await api.post("/host-server/reset-update-state");
      const data = res.data;
      if (data && data.progress) {
        setUpdateProgress(data.progress);
      }
    } catch (err) {
      console.error("Reset update state failed:", err);
    } finally {
      setCheckingUpdate(false);
      setResettingState(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    if (!seconds) return "--";
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? d + "d " : ""}${h > 0 ? h + "h " : ""}${m}m ${s}s`;
  };

  const filteredProcesses = (metrics?.processes?.top || []).filter((p: any) =>
    p.name.toLowerCase().includes(searchProc.toLowerCase()) ||
    p.pid.toString().includes(searchProc) ||
    (p.user && p.user.toLowerCase().includes(searchProc.toLowerCase()))
  );

  const updateSteps = [
    { id: 1, title: "Repository Prüfung", desc: "Suche nach neuen Commits auf origin/main (git fetch)" },
    { id: 2, title: "Pre-Update Backup", desc: "Sicherung der SQLite-Datenbank & Status-Snapshot" },
    { id: 3, title: "Code Synchronisation", desc: "Herunterladen der Änderungen (git pull origin main)" },
    { id: 4, title: "Schema & Prisma Sync", desc: "Prisma Client Generierung & DB-Push" },
    { id: 5, title: "Production Build", desc: "Kompilieren von Frontend & Backend binaries" },
    { id: 6, title: "Service Neustart", desc: "PM2 Dienst-Neustart & System-Verifikation" },
  ];  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-[#0b0f17] text-slate-200">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 rounded-2xl bg-[#0d121c] border border-[#1e293b] shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              {metrics?.static?.hostname || "Host Server Monitor"}
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                Live-Telemetrie
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {metrics?.static?.distro} {metrics?.static?.release} ({metrics?.static?.arch}) • Kernel {metrics?.static?.kernel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#111724] border border-[#1e293b] text-xs text-slate-400">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>Laufzeit: <strong className="text-white font-mono">{formatUptime(metrics?.uptime)}</strong></span>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#111724] border border-[#1e293b] text-xs text-slate-400" title="Automatischer stündlicher System-Neustart">
            <RotateCcw className="w-4 h-4 text-sky-400" />
            <span>Auto-Neustart: <strong className="text-white font-mono">in {hourlyRestartInfo?.minutesRemaining ?? "--"} Min</strong></span>
          </div>

          <button
            onClick={handleRestartNow}
            disabled={restartingNow}
            title="Sofortigen kompletten System-Neustart durchführen"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-semibold text-xs transition-all disabled:opacity-50 cursor-pointer shadow-sm"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${restartingNow ? "animate-spin" : ""}`} />
            <span>{restartingNow ? "Neustart..." : "Jetzt neu starten"}</span>
          </button>

          {metrics?.battery?.hasBattery && (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#111724] border border-[#1e293b] text-xs text-slate-400">
              <Zap className={`w-4 h-4 ${metrics.battery.isCharging ? "text-emerald-400 animate-pulse" : "text-amber-400"}`} />
              <span className="text-white font-medium">{metrics.battery.percent}% {metrics.battery.isCharging ? "⚡" : ""}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU Card */}
        <div className="p-5 rounded-2xl bg-[#111724] border border-[#1e293b] space-y-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
                <Cpu className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-bold text-white">CPU Auslastung</h2>
            </div>
            <span className="text-lg font-bold font-mono text-sky-400">
              {metrics?.cpu?.totalLoad ?? 0}%
            </span>
          </div>

          <div className="w-full bg-[#0d121c] h-2 rounded-full overflow-hidden">
            <div
              className="bg-sky-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${metrics?.cpu?.totalLoad || 0}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-slate-400 pt-1">
            <span>Kerne: <strong className="text-white">{metrics?.static?.cpuCores || "--"}</strong></span>
            <span>Takt: <strong className="text-white">{metrics?.static?.cpuSpeed || "--"} GHz</strong></span>
            <span>Temp: <strong className="text-white">{metrics?.cpu?.temp ? `${metrics.cpu.temp}°C` : "N/A"}</strong></span>
          </div>

          {/* Cores mini bars */}
          {metrics?.cpu?.cores && (
            <div className="grid grid-cols-8 gap-1 pt-1">
              {metrics.cpu.cores.map((load: number, idx: number) => (
                <div key={idx} className="h-6 bg-[#0d121c] rounded overflow-hidden flex items-end" title={`Kern ${idx + 1}: ${load}%`}>
                  <div className="w-full bg-sky-400 transition-all duration-300" style={{ height: `${load}%` }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RAM Memory Card */}
        <div className="p-5 rounded-2xl bg-[#111724] border border-[#1e293b] space-y-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <Activity className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-bold text-white">Arbeitsspeicher (RAM)</h2>
            </div>
            <span className="text-lg font-bold font-mono text-emerald-400">
              {metrics?.memory?.usedPercent ?? 0}%
            </span>
          </div>

          <div className="w-full bg-[#0d121c] h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${metrics?.memory?.usedPercent || 0}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs bg-[#0d121c] border border-[#1e293b] p-2.5 rounded-xl">
            <div>
              <span className="text-slate-400 block">Belegt</span>
              <span className="font-mono text-white font-semibold">{formatBytes(metrics?.memory?.used)}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Gesamt</span>
              <span className="font-mono text-white font-semibold">{formatBytes(metrics?.memory?.total)}</span>
            </div>
          </div>
        </div>

        {/* Disk Storage Card */}
        <div className="p-5 rounded-2xl bg-[#111724] border border-[#1e293b] space-y-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                <HardDrive className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-bold text-white">Festplattenspeicher ( / )</h2>
            </div>
            <span className="text-lg font-bold font-mono text-amber-400">
              {metrics?.disks?.[0]?.usePercent ?? 0}%
            </span>
          </div>

          <div className="w-full bg-[#0d121c] h-2 rounded-full overflow-hidden">
            <div
              className="bg-amber-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${metrics?.disks?.[0]?.usePercent || 0}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs bg-[#0d121c] border border-[#1e293b] p-2.5 rounded-xl">
            <div>
              <span className="text-slate-400 block">Belegt</span>
              <span className="font-mono text-white font-semibold">{formatBytes(metrics?.disks?.[0]?.used)}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Gesamt</span>
              <span className="font-mono text-white font-semibold">{formatBytes(metrics?.disks?.[0]?.size)}</span>
            </div>
          </div>
        </div>

        {/* Network Card */}
        <div className="p-5 rounded-2xl bg-[#111724] border border-[#1e293b] space-y-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                <Activity className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-bold text-white">Netzwerktraffic</h2>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-[#0d121c] border border-[#1e293b] flex items-center gap-2">
              <ArrowDownLeft className="w-4 h-4 text-sky-400" />
              <div>
                <span className="text-slate-400 block text-[10px]">Download</span>
                <span className="font-mono text-white font-bold">{formatBytes(metrics?.network?.totalRxSec || 0)}/s</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#0d121c] border border-[#1e293b] flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-indigo-400" />
              <div>
                <span className="text-slate-400 block text-[10px]">Upload</span>
                <span className="font-mono text-white font-bold">{formatBytes(metrics?.network?.totalTxSec || 0)}/s</span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex justify-between pt-1">
            <span>Gesamt Rx: <strong className="text-white">{formatBytes(metrics?.network?.totalRxBytes)}</strong></span>
            <span>Gesamt Tx: <strong className="text-white">{formatBytes(metrics?.network?.totalTxBytes)}</strong></span>
          </div>
        </div>
      </div>

      {/* GitHub Auto-Sync & Update Status Card with Live Steps & Progress */}
      <div className="p-6 rounded-2xl bg-[#111724] border border-[#1e293b] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl border ${
              updateProgress?.status === "error" || updateInfo?.status === "error"
                ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                : updateProgress?.isUpdating || checkingUpdate
                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400 animate-pulse"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            }`}>
              {checkingUpdate || updateProgress?.isUpdating ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : updateProgress?.status === "error" || updateInfo?.status === "error" ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                GitHub Auto-Update Engine
                {(updateProgress?.remoteCommit || updateInfo?.commitShort) && (
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                    updateProgress?.status === "error" || updateInfo?.status === "error"
                      ? "bg-rose-500/20 text-rose-300"
                      : "bg-emerald-500/20 text-emerald-300 font-bold"
                  }`}>
                    Commit {updateProgress?.remoteCommit || updateInfo?.commitShort}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {updateProgress?.currentAction || updateInfo?.message || "Automatischer Abgleich mit GitHub main Branch."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {updateProgress?.logs && updateProgress.logs.length > 0 && (
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0d121c] hover:bg-[#1a253a] border border-[#1e293b] text-xs text-indigo-400 font-medium transition-all cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Logs ({updateProgress.logs.length})</span>
                {showLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}

            <button
              onClick={handleResetUpdateState}
              disabled={resettingState}
              title="Falls der Status hängenbleibt: Engine & Cache zurücksetzen"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0d121c] hover:bg-amber-500/20 border border-[#1e293b] hover:border-amber-500/40 text-slate-400 hover:text-amber-300 font-semibold text-xs transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${resettingState ? "animate-spin text-amber-400" : ""}`} />
              <span>Status reparieren</span>
            </button>

            <button
              onClick={handleForceRebuild}
              disabled={rebuilding || (updateProgress?.isUpdating && updateProgress?.percent !== 100)}
              title="Kompiliert Frontend und Backend komplett neu und startet die Dienste neu"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0d121c] hover:bg-sky-500/20 border border-[#1e293b] hover:border-sky-500/40 text-slate-300 hover:text-sky-300 font-semibold text-xs transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Wrench className={`w-3.5 h-3.5 ${rebuilding ? "animate-spin text-sky-400" : "text-sky-400"}`} />
              <span>{rebuilding ? "Wird gebaut..." : "Neu kompilieren (Build)"}</span>
            </button>

            <button
              onClick={handleCheckUpdate}
              disabled={checkingUpdate || (updateProgress?.isUpdating && updateProgress?.percent !== 100)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-600/25 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdate || (updateProgress?.isUpdating && updateProgress?.percent !== 100) ? "animate-spin" : ""}`} />
              {checkingUpdate || (updateProgress?.isUpdating && updateProgress?.percent !== 100) ? "Aktualisiere..." : "Nach Updates suchen"}
            </button>
          </div>
        </div>

        {/* Real-Time Progress Bar & Steps (Shown during update or when checked) */}
        {(updateProgress?.isUpdating || checkingUpdate || (updateProgress?.percent !== undefined && updateProgress.percent > 0)) && (
          <div className="space-y-3 pt-2 border-t border-[#1e293b]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white flex items-center gap-2">
                {updateProgress?.isUpdating && updateProgress?.percent !== 100 ? (
                  <span className="flex items-center gap-1.5 text-indigo-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Fortschritt: Schritt {updateProgress.step || 1} von {updateProgress.totalSteps || 6}
                  </span>
                ) : updateProgress?.status === "error" ? (
                  <span className="text-rose-400 font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Update abgebrochen / Fehler
                  </span>
                ) : (
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Status: {updateProgress?.currentAction || "System ist auf dem neuesten Stand"}
                  </span>
                )}
              </span>
              <span className="font-mono font-bold text-indigo-400">
                {updateProgress?.percent || (checkingUpdate ? 10 : 100)}%
              </span>
            </div>

            {/* Progress Bar Container */}
            <div className="w-full bg-[#0d121c] h-2.5 rounded-full overflow-hidden p-0.5 border border-[#1e293b]">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  updateProgress?.status === "error"
                    ? "bg-rose-500"
                    : (updateProgress?.isUpdating && updateProgress?.percent !== 100) || checkingUpdate
                    ? "bg-indigo-600 animate-pulse"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${updateProgress?.percent || (checkingUpdate ? 10 : 100)}%` }}
              />
            </div>

            {/* 6 Step Cards Checklist Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
              {updateSteps.map((s) => {
                const isFinished = updateProgress?.percent === 100 || updateProgress?.status === "success" || (!updateProgress?.isUpdating && !checkingUpdate);
                const currentStep = updateProgress?.step || (checkingUpdate ? 1 : 6);
                const isDone = isFinished || s.id < currentStep;
                const isCurrent = !isFinished && s.id === currentStep && (updateProgress?.isUpdating || checkingUpdate);
                const isError = s.id === currentStep && updateProgress?.status === "error";

                return (
                  <div
                    key={s.id}
                    className={`p-2.5 rounded-xl border text-xs transition-all ${
                      isDone
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : isCurrent
                        ? "bg-indigo-500/10 border-indigo-500/50 text-white shadow-sm"
                        : isError
                        ? "bg-rose-500/10 border-rose-500/40 text-rose-400"
                        : "bg-[#0d121c] border-[#1e293b] text-slate-500 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold">
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : isCurrent ? (
                        <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                      ) : isError ? (
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                      <span className="truncate">{s.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-tight line-clamp-1">
                      {s.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Live Terminal Logs Drawer */}
        {showLogs && updateProgress?.logs && updateProgress.logs.length > 0 && (
          <div className="pt-2 border-t border-[#1e293b]">
            <div className="flex items-center justify-between pb-1.5 text-xs text-slate-400">
              <span className="font-mono flex items-center gap-1.5 text-indigo-400 font-semibold">
                <Terminal className="w-3.5 h-3.5" /> Live Update Output Log
              </span>
              <button
                onClick={() => setShowLogs(false)}
                className="hover:text-white text-[11px] underline cursor-pointer"
              >
                Ausblenden
              </button>
            </div>
            <div className="bg-[#0b0f17] border border-[#1e293b] rounded-xl p-3 font-mono text-[11px] text-emerald-400 max-h-48 overflow-y-auto space-y-1 shadow-inner">
              {updateProgress.logs.map((logLine, idx) => (
                <div key={idx} className="leading-relaxed break-words flex gap-2">
                  <span className="text-slate-600 select-none">&gt;</span>
                  <span className={logLine.includes("❌") ? "text-rose-400 font-bold" : logLine.includes("✅") ? "text-emerald-400 font-bold" : logLine.includes("🚀") ? "text-sky-300 font-bold" : "text-emerald-300"}>
                    {logLine}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Live Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CPU Load Sparkline */}
        <div className="p-5 rounded-2xl bg-[#111724] border border-[#1e293b] space-y-2 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-sky-400" /> CPU-Verlauf (Letzte 30s)
          </h3>
          <div className="h-24 flex items-end gap-1 bg-[#0d121c] p-2 rounded-xl border border-[#1e293b]">
            {cpuHistory.map((val, i) => (
              <div
                key={i}
                className="flex-1 bg-sky-400/80 hover:bg-sky-300 rounded-t transition-all duration-300"
                style={{ height: `${Math.max(val, 4)}%` }}
                title={`${val}%`}
              />
            ))}
          </div>
        </div>

        {/* Network RX/TX Sparkline */}
        <div className="p-5 rounded-2xl bg-[#111724] border border-[#1e293b] space-y-2 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-indigo-400" /> Netzwerk-Bandbreite (KB/s)
          </h3>
          <div className="h-24 flex items-end gap-1 bg-[#0d121c] p-2 rounded-xl border border-[#1e293b]">
            {netRxHistory.map((val, i) => {
              const maxVal = Math.max(...netRxHistory, 100);
              const heightPct = Math.min(Math.max((val / maxVal) * 100, 4), 100);
              return (
                <div
                  key={i}
                  className="flex-1 bg-indigo-500/80 hover:bg-indigo-400 rounded-t transition-all duration-300"
                  style={{ height: `${heightPct}%` }}
                  title={`Download: ${val} KB/s`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Services & Process List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monitored System Services */}
        <div className="p-5 rounded-2xl bg-[#111724] border border-[#1e293b] space-y-3 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Systemd-Dienste
          </h3>

          <div className="space-y-2">
            {(metrics?.services || []).map((s: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-[#0d121c] border border-[#1e293b]">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${s.running ? "bg-emerald-400" : "bg-rose-500"}`} />
                  <span className="text-xs font-mono text-white font-medium">{s.name}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.running ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
                  {s.running ? "AKTIV" : "INAKTIV"}
                </span>
              </div>
            ))}
          </div>

          {metrics?.services?.some((s: any) => s.name === "keep-awake" && !s.running) && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 space-y-1.5 mt-2">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                Dienst "keep-awake" ist inaktiv
              </p>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Der Dienst verhindert Standby & Ruhezustand auf dem Server. Zur Aktivierung führe folgendes auf dem Host aus:
              </p>
              <code className="block bg-[#0d121c] p-2 rounded-lg text-[10px] font-mono text-amber-200 select-all border border-[#1e293b]">
                sudo cp systemd/keep-awake.service /etc/systemd/system/ && sudo systemctl enable --now keep-awake
              </code>
            </div>
          )}
        </div>

        {/* Top Processes Table */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#111724] border border-[#1e293b] space-y-3 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Top Systemprozesse
            </h3>
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-[#0d121c] border border-[#1e293b] text-xs">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Prozesse filtern..."
                value={searchProc}
                onChange={(e) => setSearchProc(e.target.value)}
                className="bg-transparent border-none outline-none text-white text-xs w-28 focus:w-36 transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-60 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#0d121c] text-slate-400">
                <tr>
                  <th className="p-2.5">PID</th>
                  <th className="p-2.5">Name</th>
                  <th className="p-2.5">Benutzer</th>
                  <th className="p-2.5 text-right">CPU %</th>
                  <th className="p-2.5 text-right">RAM %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b] font-mono">
                {filteredProcesses.map((proc: any, i: number) => (
                  <tr key={i} className="hover:bg-[#0d121c]/50">
                    <td className="p-2.5 text-slate-500">{proc.pid}</td>
                    <td className="p-2.5 text-white font-medium">{proc.name}</td>
                    <td className="p-2.5 text-slate-400">{proc.user}</td>
                    <td className="p-2.5 text-right text-sky-400 font-bold">{proc.cpu}%</td>
                    <td className="p-2.5 text-right text-emerald-400 font-bold">{proc.mem}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

