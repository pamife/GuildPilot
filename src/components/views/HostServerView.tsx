"use client";

import React, { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket";
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
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    fetch(`${apiUrl}/api/host-server/metrics`)
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) handleMetrics(data);
      })
      .catch(() => {});

    fetch(`${apiUrl}/api/host-server/updates`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.commit) setUpdateInfo(data);
      })
      .catch(() => {});

    fetch(`${apiUrl}/api/host-server/update-progress`)
      .then((res) => res.json())
      .then((data) => {
        if (data) setUpdateProgress(data);
      })
      .catch(() => {});

    return () => {
      socket.off("hostMetricsUpdate", handleMetrics);
      socket.off("updateNotification", handleUpdateNotif);
      socket.off("updateProgress", handleUpdateProgress);
    };
  }, []);

  // Active polling while update check or installation is running
  useEffect(() => {
    if (!checkingUpdate && !updateProgress?.isUpdating) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const interval = setInterval(() => {
      fetch(`${apiUrl}/api/host-server/update-progress`)
        .then((res) => res.json())
        .then((data) => {
          if (data) setUpdateProgress(data);
        })
        .catch(() => {});
    }, 800);

    return () => clearInterval(interval);
  }, [checkingUpdate, updateProgress?.isUpdating]);

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setShowLogs(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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
      const res = await fetch(`${apiUrl}/api/host-server/check-update`, { method: "POST" });
      const data = await res.json();
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
        message: `Update check failed: ${err.message}`,
        commitShort: "error",
        timestamp: new Date().toISOString(),
      });
    } finally {
      // Immediately fetch current update-progress state
      fetch(`${apiUrl}/api/host-server/update-progress`)
        .then((res) => res.json())
        .then((progressData) => {
          if (progressData) setUpdateProgress(progressData);
        })
        .catch(() => {});
      setCheckingUpdate(false);
    }
  };

  const [resettingState, setResettingState] = useState(false);

  const handleResetUpdateState = async () => {
    setResettingState(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const res = await fetch(`${apiUrl}/api/host-server/reset-update-state`, { method: "POST" });
      const data = await res.json();
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
  ];

  return (
    <div className="space-y-6 text-discord-header">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl bg-gradient-to-r from-[#1e1f22] to-[#2b2d31] border border-[#35373c] shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-discord-brand/20 border border-discord-brand/40 flex items-center justify-center text-discord-brand">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              {metrics?.static?.hostname || "Host Server Monitor"}
              <span className="text-xs px-2 py-0.5 rounded-full bg-discord-green/20 text-discord-green border border-discord-green/30 font-medium">
                Live Host Telemetry
              </span>
            </h1>
            <p className="text-xs text-discord-muted mt-0.5">
              {metrics?.static?.distro} {metrics?.static?.release} ({metrics?.static?.arch}) • Kernel {metrics?.static?.kernel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#18191c] border border-[#35373c] text-xs text-discord-muted">
            <Clock className="w-4 h-4 text-discord-brand" />
            <span>Uptime: <strong className="text-white font-mono">{formatUptime(metrics?.uptime)}</strong></span>
          </div>

          {metrics?.battery?.hasBattery && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#18191c] border border-[#35373c] text-xs text-discord-muted">
              <Zap className={`w-4 h-4 ${metrics.battery.isCharging ? "text-discord-green animate-pulse" : "text-amber-400"}`} />
              <span className="text-white font-medium">{metrics.battery.percent}% {metrics.battery.isCharging ? "⚡" : ""}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU Card */}
        <div className="p-4 rounded-xl bg-[#2b2d31] border border-[#383a40] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                <Cpu className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-semibold text-white">CPU Usage</h2>
            </div>
            <span className="text-lg font-bold font-mono text-sky-400">
              {metrics?.cpu?.totalLoad ?? 0}%
            </span>
          </div>

          <div className="w-full bg-[#1e1f22] h-2 rounded-full overflow-hidden">
            <div
              className="bg-sky-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${metrics?.cpu?.totalLoad || 0}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-discord-muted pt-1">
            <span>Cores: <strong className="text-white">{metrics?.static?.cpuCores || "--"}</strong></span>
            <span>Clock: <strong className="text-white">{metrics?.static?.cpuSpeed || "--"} GHz</strong></span>
            <span>Temp: <strong className="text-white">{metrics?.cpu?.temp ? `${metrics.cpu.temp}°C` : "N/A"}</strong></span>
          </div>

          {/* Cores mini bars */}
          {metrics?.cpu?.cores && (
            <div className="grid grid-cols-8 gap-1 pt-1">
              {metrics.cpu.cores.map((load: number, idx: number) => (
                <div key={idx} className="h-6 bg-[#18191c] rounded overflow-hidden flex items-end" title={`Core ${idx + 1}: ${load}%`}>
                  <div className="w-full bg-sky-400 transition-all duration-300" style={{ height: `${load}%` }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RAM Memory Card */}
        <div className="p-4 rounded-xl bg-[#2b2d31] border border-[#383a40] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Activity className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-semibold text-white">RAM Memory</h2>
            </div>
            <span className="text-lg font-bold font-mono text-emerald-400">
              {metrics?.memory?.usedPercent ?? 0}%
            </span>
          </div>

          <div className="w-full bg-[#1e1f22] h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${metrics?.memory?.usedPercent || 0}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs bg-[#18191c] p-2 rounded-lg">
            <div>
              <span className="text-discord-muted block">Used</span>
              <span className="font-mono text-white font-semibold">{formatBytes(metrics?.memory?.used)}</span>
            </div>
            <div>
              <span className="text-discord-muted block">Total</span>
              <span className="font-mono text-white font-semibold">{formatBytes(metrics?.memory?.total)}</span>
            </div>
          </div>
        </div>

        {/* Disk Storage Card */}
        <div className="p-4 rounded-xl bg-[#2b2d31] border border-[#383a40] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                <HardDrive className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-semibold text-white">Storage ( Root / )</h2>
            </div>
            <span className="text-lg font-bold font-mono text-amber-400">
              {metrics?.disks?.[0]?.usePercent ?? 0}%
            </span>
          </div>

          <div className="w-full bg-[#1e1f22] h-2 rounded-full overflow-hidden">
            <div
              className="bg-amber-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${metrics?.disks?.[0]?.usePercent || 0}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs bg-[#18191c] p-2 rounded-lg">
            <div>
              <span className="text-discord-muted block">Used</span>
              <span className="font-mono text-white font-semibold">{formatBytes(metrics?.disks?.[0]?.used)}</span>
            </div>
            <div>
              <span className="text-discord-muted block">Size</span>
              <span className="font-mono text-white font-semibold">{formatBytes(metrics?.disks?.[0]?.size)}</span>
            </div>
          </div>
        </div>

        {/* Network Card */}
        <div className="p-4 rounded-xl bg-[#2b2d31] border border-[#383a40] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                <Activity className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-semibold text-white">Network Traffic</h2>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-[#18191c] border border-sky-500/20 flex items-center gap-2">
              <ArrowDownLeft className="w-4 h-4 text-sky-400" />
              <div>
                <span className="text-discord-muted block text-[10px]">Download</span>
                <span className="font-mono text-sky-400 font-bold">{formatBytes(metrics?.network?.totalRxSec || 0)}/s</span>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-[#18191c] border border-purple-500/20 flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-purple-400" />
              <div>
                <span className="text-discord-muted block text-[10px]">Upload</span>
                <span className="font-mono text-purple-400 font-bold">{formatBytes(metrics?.network?.totalTxSec || 0)}/s</span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-discord-muted flex justify-between pt-1">
            <span>Total Rx: <strong className="text-white">{formatBytes(metrics?.network?.totalRxBytes)}</strong></span>
            <span>Total Tx: <strong className="text-white">{formatBytes(metrics?.network?.totalTxBytes)}</strong></span>
          </div>
        </div>
      </div>

      {/* GitHub Auto-Sync & Update Status Card with Live Steps & Progress */}
      <div className="p-5 rounded-xl bg-gradient-to-r from-[#1e1f22] via-[#2b2d31] to-[#1e1f22] border border-[#35373c] shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl border ${
              updateProgress?.status === "error" || updateInfo?.status === "error"
                ? "bg-discord-red/20 border-discord-red/40 text-discord-red"
                : updateProgress?.isUpdating || checkingUpdate
                ? "bg-sky-500/20 border-sky-500/40 text-sky-400 animate-pulse"
                : "bg-discord-green/20 border-discord-green/40 text-discord-green"
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
                      ? "bg-discord-red/20 text-discord-red"
                      : "bg-discord-green/20 text-discord-green font-bold"
                  }`}>
                    Commit {updateProgress?.remoteCommit || updateInfo?.commitShort}
                  </span>
                )}
              </h3>
              <p className="text-xs text-discord-muted mt-0.5">
                {updateProgress?.currentAction || updateInfo?.message || "Automatischer Abgleich mit GitHub main Branch."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {updateProgress?.logs && updateProgress.logs.length > 0 && (
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#18191c] hover:bg-[#202225] border border-[#35373c] text-xs text-sky-400 font-medium transition-all"
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
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#18191c] hover:bg-amber-500/20 border border-[#35373c] hover:border-amber-500/40 text-discord-muted hover:text-amber-300 font-semibold text-xs transition-all shadow-sm disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${resettingState ? "animate-spin text-amber-400" : ""}`} />
              <span>Status reparieren</span>
            </button>

            <button
              onClick={handleCheckUpdate}
              disabled={checkingUpdate || (updateProgress?.isUpdating && updateProgress?.percent !== 100)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-discord-brand hover:bg-discord-brandHover active:scale-95 text-white font-semibold text-xs transition-all shadow-md disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdate || (updateProgress?.isUpdating && updateProgress?.percent !== 100) ? "animate-spin" : ""}`} />
              {checkingUpdate || (updateProgress?.isUpdating && updateProgress?.percent !== 100) ? "Aktualisiere..." : "Nach Updates suchen"}
            </button>
          </div>
        </div>

        {/* Real-Time Progress Bar & Steps (Shown during update or when checked) */}
        {(updateProgress?.isUpdating || checkingUpdate || (updateProgress?.percent !== undefined && updateProgress.percent > 0)) && (
          <div className="space-y-3 pt-2 border-t border-[#35373c]/60">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white flex items-center gap-2">
                {updateProgress?.isUpdating && updateProgress?.percent !== 100 ? (
                  <span className="flex items-center gap-1.5 text-sky-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Fortschritt: Schritt {updateProgress.step || 1} von {updateProgress.totalSteps || 6}
                  </span>
                ) : updateProgress?.status === "error" ? (
                  <span className="text-discord-red font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Update abgebrochen / Fehler
                  </span>
                ) : (
                  <span className="text-discord-green font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Status: {updateProgress?.currentAction || "System ist auf dem neuesten Stand"}
                  </span>
                )}
              </span>
              <span className="font-mono font-bold text-sky-400">
                {updateProgress?.percent || (checkingUpdate ? 10 : 100)}%
              </span>
            </div>

            {/* Progress Bar Container */}
            <div className="w-full bg-[#18191c] h-2.5 rounded-full overflow-hidden p-0.5 border border-[#35373c]">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  updateProgress?.status === "error"
                    ? "bg-discord-red"
                    : (updateProgress?.isUpdating && updateProgress?.percent !== 100) || checkingUpdate
                    ? "bg-gradient-to-r from-sky-500 via-indigo-500 to-discord-brand animate-pulse"
                    : "bg-discord-green"
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
                    className={`p-2.5 rounded-lg border text-xs transition-all ${
                      isDone
                        ? "bg-discord-green/10 border-discord-green/30 text-discord-green"
                        : isCurrent
                        ? "bg-sky-500/10 border-sky-500/50 text-white shadow-[0_0_12px_rgba(14,165,233,0.2)]"
                        : isError
                        ? "bg-discord-red/10 border-discord-red/40 text-discord-red"
                        : "bg-[#18191c]/60 border-[#35373c] text-discord-muted opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold">
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-discord-green shrink-0" />
                      ) : isCurrent ? (
                        <Loader2 className="w-4 h-4 text-sky-400 animate-spin shrink-0" />
                      ) : isError ? (
                        <AlertTriangle className="w-4 h-4 text-discord-red shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-discord-muted shrink-0" />
                      )}
                      <span className="truncate">{s.title}</span>
                    </div>
                    <p className="text-[11px] text-discord-muted mt-1 leading-tight line-clamp-1">
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
          <div className="pt-2 border-t border-[#35373c]">
            <div className="flex items-center justify-between pb-1.5 text-xs text-discord-muted">
              <span className="font-mono flex items-center gap-1.5 text-sky-400 font-semibold">
                <Terminal className="w-3.5 h-3.5" /> Live Update Output Log
              </span>
              <button
                onClick={() => setShowLogs(false)}
                className="hover:text-white text-[11px] underline"
              >
                Ausblenden
              </button>
            </div>
            <div className="bg-[#0f1012] border border-[#2b2d31] rounded-lg p-3 font-mono text-[11px] text-emerald-400 max-h-48 overflow-y-auto space-y-1 shadow-inner">
              {updateProgress.logs.map((logLine, idx) => (
                <div key={idx} className="leading-relaxed break-words flex gap-2">
                  <span className="text-discord-muted select-none">&gt;</span>
                  <span className={logLine.includes("❌") ? "text-discord-red font-bold" : logLine.includes("✅") ? "text-discord-green font-bold" : logLine.includes("🚀") ? "text-sky-300 font-bold" : "text-emerald-300"}>
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
        <div className="p-4 rounded-xl bg-[#2b2d31] border border-[#383a40] space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-discord-muted flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-sky-400" /> CPU Load History (Last 30s)
          </h3>
          <div className="h-24 flex items-end gap-1 bg-[#18191c] p-2 rounded-lg">
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
        <div className="p-4 rounded-xl bg-[#2b2d31] border border-[#383a40] space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-discord-muted flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-purple-400" /> Network Bandwidth (KB/s)
          </h3>
          <div className="h-24 flex items-end gap-1 bg-[#18191c] p-2 rounded-lg">
            {netRxHistory.map((val, i) => {
              const maxVal = Math.max(...netRxHistory, 100);
              const heightPct = Math.min(Math.max((val / maxVal) * 100, 4), 100);
              return (
                <div
                  key={i}
                  className="flex-1 bg-purple-400/80 hover:bg-purple-300 rounded-t transition-all duration-300"
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
        <div className="p-4 rounded-xl bg-[#2b2d31] border border-[#383a40] space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-discord-muted flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-discord-green" /> System Services Status
          </h3>

          <div className="space-y-2">
            {(metrics?.services || []).map((s: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-[#1e1f22] border border-[#35373c]">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${s.running ? "bg-discord-green shadow-[0_0_8px_#23a55a]" : "bg-discord-red"}`} />
                  <span className="text-xs font-mono text-white font-medium">{s.name}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${s.running ? "bg-discord-green/20 text-discord-green" : "bg-discord-red/20 text-discord-red"}`}>
                  {s.running ? "RUNNING" : "STOPPED"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Processes Table */}
        <div className="lg:col-span-2 p-4 rounded-xl bg-[#2b2d31] border border-[#383a40] space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-discord-muted">
              Top System Processes
            </h3>
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#18191c] border border-[#35373c] text-xs">
              <Search className="w-3.5 h-3.5 text-discord-muted" />
              <input
                type="text"
                placeholder="Process filter..."
                value={searchProc}
                onChange={(e) => setSearchProc(e.target.value)}
                className="bg-transparent border-none outline-none text-white text-xs w-28 focus:w-36 transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-60 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#1e1f22] text-discord-muted">
                <tr>
                  <th className="p-2">PID</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">User</th>
                  <th className="p-2 text-right">CPU %</th>
                  <th className="p-2 text-right">RAM %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#35373c]/40 font-mono">
                {filteredProcesses.map((proc: any, i: number) => (
                  <tr key={i} className="hover:bg-[#18191c]/50">
                    <td className="p-2 text-discord-muted">{proc.pid}</td>
                    <td className="p-2 text-white font-medium">{proc.name}</td>
                    <td className="p-2 text-discord-muted">{proc.user}</td>
                    <td className="p-2 text-right text-sky-400 font-bold">{proc.cpu}%</td>
                    <td className="p-2 text-right text-emerald-400 font-bold">{proc.mem}%</td>
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
