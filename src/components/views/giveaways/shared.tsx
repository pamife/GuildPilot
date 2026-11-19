"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Gift } from "lucide-react";
import { api } from "@/lib/api";
import { GiveawayConfig, GiveawaySettings, RejectionPolicy, Verification, checkLabels } from "@/types/giveaways";
import { button, muted, panel, requestError } from "../changelog/ui";

export interface Options { channels: { id: string; name: string }[]; roles: { id: string; name: string }[] }
export interface Settings { enabled: boolean; settings: GiveawaySettings }
export interface Page<T> { items: T[]; total: number; pages: number }
export interface Profile { userId: string; username: string; displayName: string; avatar: string | null }
export interface Entry extends Profile {
  verification: Verification; snapshot: Verification | null; resolved: boolean; riskDecision: string | null;
  enteredAt: string; withdrawnAt: string | null; exclusion: string | null;
}
export interface Claim {
  id: string; status: string; deadline: string; claimedAt: string | null; fulfilledAt: string | null; notes: string | null;
}
export interface Candidate {
  id: string; userId: string; profile?: Profile; status: string; slot: number; verification: Verification;
  reason: string | null; policy: RejectionPolicy | null; replacesId: string | null; announcedAt: string | null;
  reviewedBy: string | null; reviewedAt: string | null; draw: { drawIndex: number }; claim: Claim | null;
}
export interface Item {
  id: string; status: string; config: GiveawayConfig; startAt: string; endAt: string; creatorId: string;
  creatorName: string; revision: number; participantCount: number; validCount: number;
}
export interface Detail extends Omit<Item, "participantCount" | "validCount"> {
  commitment: string; snapshotHash: string | null; snapshotAt: string | null; poolHash: string | null;
  publication: number; publishedRound: number; shortageAccepted: boolean; messageId: string | null;
  totals: Record<string, number>; unresolved: number; candidates: Candidate[]; error: string | null;
  originalUrl: string | null; resultUrl: string | null;
  jobs: { id: string; kind: string; tries: number; runAt: string; doneAt: string | null; error: string | null }[];
}
export interface Audit { id: number; event: string; actor: string; createdAt: string; detail: object; giveawayId: string | null }
export interface Template { id: string; name: string; config: GiveawayConfig; updatedAt: string }
export interface Metrics {
  status: Record<string, number>; claimStatus: Record<string, number>; entries: Record<string, number>;
  total: number; participantCount: number; unique: number; average: number; completionRate: number; claimRate: number;
  days: { day: string; count: number }[]; failures: { checkName: keyof typeof checkLabels; count: number }[];
}

const statuses: Record<string, string> = {
  DRAFT: "Entwurf", SCHEDULED: "Geplant", ACTIVE: "Aktiv", PAUSED: "Pausiert", ENDED: "Prüfung läuft",
  DRAW_PENDING: "Bereit zur Ziehung", WINNER_REVIEW: "Gewinnerprüfung", AWAITING_CLAIM: "Abholphase",
  COMPLETED: "Abgeschlossen", CANCELLED: "Storniert", FAILED: "Fehlgeschlagen", CLAIMED: "Abholung bestätigt",
  PENDING: "Ausstehend", FULFILLED: "Übergeben", DECLINED: "Abgelehnt", EXPIRED: "Abgelaufen",
  APPROVED: "Freigegeben", REJECTED: "Abgelehnt", ELIGIBLE: "Berechtigt", INELIGIBLE: "Nicht berechtigt",
  REVIEW: "Prüfung nötig", EXCLUDED: "Ausgeschlossen", PASSED: "Bestanden", ERROR: "API-Fehler",
  UNKNOWN: "Unbekannt", LOW: "Niedrig", MEDIUM: "Mittel", HIGH: "Hoch", REQUIRES_REVIEW: "Prüfung nötig",
  LEFT: "Ausgetreten", PRESENT: "Mitglied",
};
export const nameOf = (code: string) => statuses[code] ?? code;

export function Badge({ status, label }: { status: string; label?: string }) {
  const tone = ["ACTIVE", "COMPLETED", "ELIGIBLE", "APPROVED", "FULFILLED", "PASSED"].includes(status)
    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
    : ["WINNER_REVIEW", "DRAW_PENDING", "PAUSED", "REVIEW", "HIGH", "REQUIRES_REVIEW", "SCHEDULED", "EXPIRED"].includes(status)
      ? "border-amber-300/20 bg-amber-300/10 text-amber-200"
      : ["FAILED", "EXCLUDED", "REJECTED", "INELIGIBLE", "ERROR"].includes(status)
        ? "border-rose-400/20 bg-rose-400/10 text-rose-200" : "border-[var(--gp-border)] text-[var(--gp-muted)]";
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}>{label ?? nameOf(status)}</span>;
}

export function dateLabel(value: string | null, timezone?: string) {
  return value ? new Intl.DateTimeFormat("de", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value)) : "–";
}

export function localTime(value: string | Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone, hourCycle: "h23",
  }).formatToParts(new Date(value));
  const p = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function toInstant(value: string, timezone: string, later = false) {
  const wall = new Date(`${value}:00.000Z`).getTime();
  if (!Number.isFinite(wall)) throw new Error("Wähle ein gültiges Datum und eine Uhrzeit.");
  const offsets = new Set([-24, 0, 24].map(hour => {
    const nearby = wall + hour * 3_600_000;
    return nearby - new Date(`${localTime(new Date(nearby), timezone)}:00.000Z`).getTime();
  }));
  const matches = [...offsets].map(offset => wall + offset)
    .filter(instant => localTime(new Date(instant), timezone) === value).sort((a, b) => a - b);
  if (!matches.length) throw new Error("Diese Ortszeit existiert wegen der Zeitumstellung nicht.");
  return new Date(later ? matches[matches.length - 1] : matches[0]).toISOString();
}

export function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

export function useLive<T>(url: string | null, interval = 0) {
  const [value, setValue] = useState<{ url: string; data: T }>();
  const [failure, setFailure] = useState<{ url: string; error: string }>();
  const controller = useRef<AbortController>();
  const refresh = useCallback(async (background = false) => {
    if (!url || (background && controller.current)) return;
    controller.current?.abort();
    const task = new AbortController();
    controller.current = task;
    try {
      const { data } = await api.get<T>(url, { signal: task.signal });
      if (!task.signal.aborted) { setValue({ url, data }); setFailure(undefined); }
    } catch (error) {
      if (!task.signal.aborted) setFailure({ url, error: requestError(error) });
    } finally {
      if (controller.current === task) controller.current = undefined;
    }
  }, [url]);
  useEffect(() => {
    void refresh();
    const timer = interval && window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(true);
    }, interval);
    return () => {
      if (timer) window.clearInterval(timer);
      controller.current?.abort();
      controller.current = undefined;
    };
  }, [refresh, interval]);
  return { data: value?.url === url ? value?.data : undefined, error: failure?.url === url ? failure?.error : undefined, refresh };
}

export function Loading({ error, retry }: { error?: string; retry?: () => void }) {
  if (error) return <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-950/20 p-4 text-sm text-rose-200">
    {error} {retry && <button className="ml-2 underline" onClick={retry}>Neu laden</button>}
  </p>;
  return <div role="status" aria-label="Lädt" className="grid gap-3">
    {[1, 2, 3].map(key => <div key={key} className="h-20 animate-pulse rounded-xl bg-[var(--gp-raised)] motion-reduce:animate-none" />)}
  </div>;
}

export function Empty({ title, text }: { title: string; text: string }) {
  return <div className={`${panel} grid justify-items-center gap-2 py-10 text-center`}>
    <Gift size={25} className="text-[var(--gp-mint)]" aria-hidden="true" />
    <h3 className="font-semibold">{title}</h3><p className={`text-sm ${muted}`}>{text}</p>
  </div>;
}

export function Pagination({ page, data, change }: { page: number; data: Page<unknown>; change: (page: number) => void }) {
  if (data.pages < 2 && page === 1) return null;
  return <div className="flex items-center justify-end gap-3">
    <button className={button} disabled={page <= 1} aria-label="Vorherige Seite" onClick={() => change(page - 1)}><ChevronLeft size={16} /></button>
    <span className={`text-sm ${muted}`}>{page} / {data.pages} · {data.total} Einträge</span>
    <button className={button} disabled={page >= data.pages} aria-label="Nächste Seite" onClick={() => change(page + 1)}><ChevronRight size={16} /></button>
  </div>;
}

export function Avatar({ profile }: { profile?: Profile }) {
  return profile?.avatar
    ? <span role="img" aria-label="Discord-Avatar" className="h-10 w-10 shrink-0 rounded-full bg-cover bg-center" style={{ backgroundImage: `url("${profile.avatar}")` }} />
    : <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-300/10 text-emerald-200">{profile?.displayName[0] ?? "?"}</span>;
}

export function Checks({ value }: { value: Verification }) {
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <Badge status={value.status} /><Badge status={value.risk} label={`Risiko · ${nameOf(value.risk)}`} />
      <span className={`text-xs ${muted}`}>{dateLabel(value.checkedAt)}</span>
    </div>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(checkLabels).map(([key, label]) => {
        const check = value.checks[key as keyof typeof checkLabels];
        return <div key={key} className="space-y-1 rounded-lg border border-[var(--gp-border)] p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-1.5"><span className="text-xs font-medium">{label}</span>
            <Badge status={check.result} label={check.result === "FAILED" ? "Fehlgeschlagen" : undefined} />
          </div>
          <p className={`break-words text-xs ${muted}`}>{check.detail}</p>
        </div>;
      })}
    </div>
    {!!value.signals.length && <p className={`text-xs leading-relaxed ${muted}`}>{value.signals.join(" · ")}</p>}
  </div>;
}
