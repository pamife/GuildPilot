// eslint-disable-next-line @typescript-eslint/no-var-requires
const si = require("systeminformation");

export interface HostStaticInfo {
  hostname: string;
  distro: string;
  release: string;
  kernel: string;
  arch: string;
  cpuBrand: string;
  cpuSpeed: number;
  cpuCores: number;
}

export interface HostMetrics {
  timestamp: number;
  uptime: number;
  static: HostStaticInfo | null;
  cpu: {
    totalLoad: number;
    cores: number[];
    temp: number | null;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usedPercent: number;
  };
  disks: Array<{
    mount: string;
    size: number;
    used: number;
    available: number;
    usePercent: number;
  }>;
  network: {
    totalRxSec: number;
    totalTxSec: number;
    totalRxBytes: number;
    totalTxBytes: number;
  };
  battery: {
    hasBattery: boolean;
    percent: number;
    isCharging: boolean;
  };
  processes: {
    top: Array<{
      pid: number;
      name: string;
      cpu: number;
      mem: number;
      user: string;
    }>;
  };
  services: Array<{
    name: string;
    running: boolean;
  }>;
}

let cachedStaticInfo: HostStaticInfo | null = null;

export async function fetchHostStaticInfo(): Promise<HostStaticInfo> {
  if (cachedStaticInfo) return cachedStaticInfo;

  try {
    const [osInfo, cpu] = await Promise.all([si.osInfo(), si.cpu()]);
    cachedStaticInfo = {
      hostname: osInfo.hostname,
      distro: osInfo.distro,
      release: osInfo.release,
      kernel: osInfo.kernel,
      arch: osInfo.arch,
      cpuBrand: cpu.brand,
      cpuSpeed: cpu.speed,
      cpuCores: cpu.cores,
    };
    return cachedStaticInfo;
  } catch (err) {
    console.error("[HostMonitor] Error fetching static info:", err);
    return {
      hostname: "Host",
      distro: "Linux",
      release: "",
      kernel: "",
      arch: "x64",
      cpuBrand: "CPU",
      cpuSpeed: 0,
      cpuCores: 1,
    };
  }
}

const MONITORED_SERVICES = [
  "keep-awake",
  "guildpilot-update",
  "guildpilot-update.timer",
  "ssh",
  "sshd",
  "NetworkManager",
  "networkmanager",
  "docker",
  "dockerd",
  "pm2",
];

export async function collectHostMetrics(): Promise<HostMetrics> {
  const staticInfo = await fetchHostStaticInfo();

  try {
    const [currentLoad, cpuTemp, mem, fsSize, networkStats, battery, processes, time, services] =
      await Promise.all([
        si.currentLoad(),
        si.cpuTemperature(),
        si.mem(),
        si.fsSize(),
        si.networkStats(),
        si.battery(),
        si.processes(),
        si.time(),
        si.services(MONITORED_SERVICES.join(",")).catch(() => []),
      ]);

    let totalRxSec = 0;
    let totalTxSec = 0;
    let totalRxBytes = 0;
    let totalTxBytes = 0;

    networkStats.forEach((iface: any) => {
      totalRxSec += iface.rx_sec || 0;
      totalTxSec += iface.tx_sec || 0;
      totalRxBytes += iface.rx_bytes || 0;
      totalTxBytes += iface.tx_bytes || 0;
    });

    const topProcesses = (processes.list || [])
      .sort((a: any, b: any) => b.cpu - a.cpu)
      .slice(0, 10)
      .map((p: any) => ({
        pid: p.pid,
        name: p.name,
        cpu: Number(p.cpu.toFixed(1)),
        mem: Number(p.mem.toFixed(1)),
        user: p.user,
      }));

    const procList = processes?.list || [];
    const rawServices = services || [];

    const isServiceOrProcRunning = (serviceNames: string[], procRegex: RegExp) => {
      const svcRunning = rawServices.some((s: any) =>
        serviceNames.some((n) => s.name?.toLowerCase() === n.toLowerCase()) && s.running
      );
      if (svcRunning) return true;

      return procList.some((p: any) => {
        const name = (p.name || "").toLowerCase();
        const cmd = (p.cmd || "").toLowerCase();
        return procRegex.test(name) || procRegex.test(cmd);
      });
    };

    const aggregatedServices = [
      {
        name: "keep-awake",
        running: isServiceOrProcRunning(
          ["keep-awake"],
          /keep-awake|systemd-inhibit|caffeine|nosleep/i
        ),
      },
      {
        name: "guildpilot-update",
        running: isServiceOrProcRunning(
          ["guildpilot-update", "guildpilot-update.service", "guildpilot-update.timer"],
          /auto-update|guildpilot-update/i
        ),
      },
      {
        name: "ssh",
        running: isServiceOrProcRunning(["ssh", "sshd"], /\bsshd?\b/i),
      },
      {
        name: "networkmanager",
        running: isServiceOrProcRunning(
          ["NetworkManager", "networkmanager", "systemd-networkd"],
          /networkmanager|networkd/i
        ),
      },
      {
        name: "docker",
        running: isServiceOrProcRunning(["docker", "dockerd"], /\bdockerd?\b/i),
      },
      {
        name: "pm2",
        running: isServiceOrProcRunning(["pm2"], /\bpm2\b|PM2 God Daemon/i),
      },
    ];

    return {
      timestamp: Date.now(),
      uptime: time.uptime,
      static: staticInfo,
      cpu: {
        totalLoad: Number(currentLoad.currentLoad.toFixed(1)),
        cores: currentLoad.cpus.map((c: any) => Number(c.load.toFixed(1))),
        temp: cpuTemp.main || null,
      },
      memory: {
        total: mem.total,
        used: mem.active,
        free: mem.free,
        usedPercent: Number(((mem.active / mem.total) * 100).toFixed(1)),
      },
      disks: fsSize.map((d: any) => ({
        mount: d.mount,
        size: d.size,
        used: d.used,
        available: d.available,
        usePercent: Number(d.use.toFixed(1)),
      })),
      network: {
        totalRxSec,
        totalTxSec,
        totalRxBytes,
        totalTxBytes,
      },
      battery: {
        hasBattery: battery.hasBattery,
        percent: battery.percent,
        isCharging: battery.isCharging,
      },
      processes: {
        top: topProcesses,
      },
      services: aggregatedServices,
    };
  } catch (err) {
    console.error("[HostMonitor] Error collecting telemetry:", err);
    return {
      timestamp: Date.now(),
      uptime: 0,
      static: staticInfo,
      cpu: { totalLoad: 0, cores: [], temp: null },
      memory: { total: 0, used: 0, free: 0, usedPercent: 0 },
      disks: [],
      network: { totalRxSec: 0, totalTxSec: 0, totalRxBytes: 0, totalTxBytes: 0 },
      battery: { hasBattery: false, percent: 0, isCharging: false },
      processes: { top: [] },
      services: [],
    };
  }
}
