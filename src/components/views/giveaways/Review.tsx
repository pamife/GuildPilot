"use client";
import { Check, Gift, LockKeyhole } from "lucide-react";
import { rejectionPolicies } from "@/types/giveaways";
import { button, muted, panel, primary } from "../changelog/ui";
import { Action } from "./Actions";
import { Section } from "./GiveawayEditor";
import { Avatar, Badge, Checks, dateLabel, Detail, Empty } from "./shared";

export function Review({ item, url, act, run, inspect, busy }: {
  item: Detail; url: string; act: (action: Action) => void; run: (path: string) => Promise<void>;
  inspect: (user: string) => void; busy: boolean;
}) {
  const current = item.candidates.filter(candidate => candidate.status !== "REJECTED");
  const ready = current.every(candidate => candidate.status === "APPROVED") &&
    (current.length === item.config.winnerCount || item.shortageAccepted);
  const queued = item.publication > item.publishedRound;
  const review = item.status === "WINNER_REVIEW" && !queued;
  const total = Object.values(item.totals).reduce((sum, count) => sum + count, 0);
  return <div className="space-y-4">
    <Section title={item.publishedRound ? "Gewinner und Ersatzziehungen" : "Private Gewinnerprüfung"} icon={<LockKeyhole size={20} />}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          ["Teilnahmen", total], ["Berechtigt", item.totals.ELIGIBLE ?? 0],
          ["Nicht berechtigt", (item.totals.INELIGIBLE ?? 0) + (item.totals.EXCLUDED ?? 0)],
          ["Offene Prüfungen", item.unresolved], ["Gewinnerplätze", item.config.winnerCount],
        ].map(([text, count]) => <div key={text} className="rounded-lg border border-[var(--gp-border)] p-3">
          <span className={`block text-xs ${muted}`}>{text}</span><span className="text-xl font-semibold tabular-nums">{count}</span>
        </div>)}
      </div>
      {item.status === "ENDED" && <p className={`text-sm ${muted}`}>Die Teilnahme ist geschlossen. Discord-Daten werden geprüft und im Snapshot festgeschrieben.</p>}
      {item.status === "DRAW_PENDING" && <>
        <p className={`text-sm ${muted}`}>{item.unresolved ? "Klär die offenen Fälle im Tab Teilnahmen, bevor du Gewinner ziehst." : "Die Ziehung wählt gleich gewichtet aus dem festgeschriebenen Teilnehmerpool."}</p>
        <button disabled={busy || Boolean(item.unresolved)} className={primary} onClick={() => act({
          path: `${url}/draw`, title: "Gewinner privat ziehen", description: "Die ausgewählten Personen erscheinen im Dashboard. Freigabe und Veröffentlichung sind eigene Schritte.", confirmation: true,
        })}><Gift size={16} /> Gewinner privat ziehen</button>
      </>}
      {review && !ready && <p className={`text-sm ${muted}`}>Prüfe und bestätige die Kandidaten. Ablehnungen und Ersatzziehungen brauchen einen dokumentierten Grund.</p>}
      {review && current.length < item.config.winnerCount && !item.shortageAccepted && <button className={button} onClick={() => act({
        path: `${url}/shortage`, title: "Fehlende Gewinnerplätze bestätigen", description: "Diese Bestätigung ist möglich, sobald der Pool bislang ungezogener berechtigter Personen ausgeschöpft ist.", reason: true,
      })}>Fehlende Plätze bestätigen</button>}
      {queued && <div role="status" className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
        Freigegeben · Die Zustellung an Discord steht aus. Den Verlauf findest du im Tab Verwaltung.
      </div>}
      {review && ready && <button disabled={busy} className={primary} onClick={() => act({
        path: `${url}/results`, title: "Gewinner bestätigen und ankündigen", confirmation: true, summary: current,
        description: "Die neuen Gewinner werden erneut geprüft. Anschließend veröffentlicht der Bot die freigegebene Liste im Discord-Gewinnerkanal.",
      })}><Check size={17} /> Gewinner bestätigen und ankündigen</button>}
      {!item.candidates.length && !["ENDED", "DRAW_PENDING", "WINNER_REVIEW"].includes(item.status) && <p className={`text-sm ${muted}`}>Hier erscheinen die Ergebnisse, sobald eine Ziehung stattgefunden hat.</p>}
    </Section>
    {item.candidates.map(candidate => {
      const candidateUrl = `${url}/candidates/${candidate.id}`;
      const replaceable = !queued && !item.candidates.some(other => other.replacesId === candidate.id) &&
        (candidate.status === "REJECTED" && !candidate.announcedAt && review ||
          candidate.status === "APPROVED" && candidate.announcedAt && !["FULFILLED", "CANCELLED"].includes(candidate.claim?.status ?? ""));
      return <article key={candidate.id} className={`${panel} space-y-4`}>
        <header className="flex flex-wrap items-center gap-3"><Avatar profile={candidate.profile} /><div className="min-w-0 flex-1">
          <h3 className="break-words font-semibold">{candidate.profile?.displayName ?? candidate.userId}</h3>
          <p className={`break-words text-xs ${muted}`}>Platz {candidate.slot} · {candidate.profile?.username} · {candidate.userId} {candidate.replacesId && "· Ersatzziehung"}</p>
        </div><Badge status={candidate.status} />{candidate.announcedAt && <Badge status="COMPLETED" label="Veröffentlicht" />}</header>
        <Checks value={candidate.verification} />
        <div className={`flex flex-wrap gap-3 text-xs ${muted}`}>
          <span>Kontoalter · {candidate.verification.accountDays} Tage</span>
          <span>Servermitgliedschaft · {candidate.verification.memberDays ?? "–"} Tage</span>
          {candidate.reviewedBy && <span>Geprüft von {candidate.reviewedBy} · {dateLabel(candidate.reviewedAt)}</span>}
        </div>
        {candidate.reason && <p className="break-words rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-100">
          {candidate.policy && rejectionPolicies[candidate.policy]} · {candidate.reason}
        </p>}
        <div className="flex flex-wrap gap-2">
          <button className={button} onClick={() => inspect(candidate.userId)}>Teilnahme ansehen</button>
          {review && !candidate.announcedAt && candidate.status !== "REJECTED" && <>
            <button className={button} disabled={busy} onClick={() => void run(`${candidateUrl}/recheck`)}>Erneut prüfen</button>
            <button className={button} disabled={busy} onClick={() => act({
              path: `${candidateUrl}/reject`, title: "Kandidat ablehnen", reason: true, policy: true,
              description: "Beziehe dich bei einer Ablehnung auf die veröffentlichte Regel oder dokumentiere die administrative Korrektur.",
            })}>Ablehnen</button>
            {candidate.status !== "APPROVED" && <button className={primary} disabled={busy} onClick={() => void run(`${candidateUrl}/approve`)}><Check size={15} /> Freigeben</button>}
          </>}
          {replaceable && <button className={primary} disabled={busy} onClick={() => act({
            path: `${candidateUrl}/replace`, title: "Ersatz privat ziehen", reason: true, policy: candidate.announcedAt ? true : candidate.policy ?? true,
            description: "Der Ersatz wird zufällig aus den verbleibenden berechtigten Teilnahmen gezogen.",
          })}>Ersatz ziehen</button>}
        </div>
      </article>;
    })}
  </div>;
}

export function Claims({ url, item, act, inspect }: { url: string; item: Detail; act: (action: Action) => void; inspect: () => void }) {
  const claims = item.candidates.filter(candidate => candidate.claim);
  if (!claims.length) return <Empty title="Keine Preisabholungen" text="Bei aktivierter Abholung werden die Fristen nach der Discord-Veröffentlichung angelegt." />;
  return <div className="grid gap-3 md:grid-cols-2">{claims.map(candidate => {
    const claim = candidate.claim!;
    const target = `${url}/claims/${claim.id}`;
    return <article className={`${panel} space-y-3`} key={claim.id}>
      <header className="flex flex-wrap items-center gap-3"><Avatar profile={candidate.profile} /><div className="min-w-0 flex-1">
        <h3 className="break-words font-semibold">{candidate.profile?.displayName ?? candidate.userId}</h3>
        <p className={`text-xs ${muted}`}>{item.config.prize} · Platz {candidate.slot}</p>
      </div><Badge status={claim.status} /></header>
      <dl className="grid grid-cols-2 gap-2 text-sm"><dt className={muted}>Frist</dt><dd>{dateLabel(claim.deadline, item.config.timezone)}</dd>
        <dt className={muted}>Abgeholt am</dt><dd>{dateLabel(claim.claimedAt, item.config.timezone)}</dd>
        <dt className={muted}>Übergeben am</dt><dd>{dateLabel(claim.fulfilledAt, item.config.timezone)}</dd></dl>
      {claim.notes && <p className="break-words text-sm">{claim.notes}</p>}
      {candidate.status === "APPROVED" && <div className="flex flex-wrap gap-2">
        {["PENDING", "EXPIRED"].includes(claim.status) && <button className={button} onClick={() => act({
          path: `${target}/extend`, title: "Abholfrist verlängern", date: "deadline",
          initialDate: new Date(Math.max(Date.now(), +new Date(claim.deadline)) + 86_400_000).toISOString(),
        })}>Frist verlängern</button>}
        {claim.status === "CLAIMED" && <button className={primary} onClick={() => act({
          path: `${target}/fulfill`, title: "Preis als übergeben markieren", notes: "optional", confirmation: true,
        })}>Übergabe bestätigen</button>}
        {["PENDING", "CLAIMED", "EXPIRED"].includes(claim.status) && <button className={button} onClick={() => act({
          path: `${target}/cancel`, title: "Abholung stornieren", notes: "required", confirmation: true,
        })}>Abholung stornieren</button>}
        {["DECLINED", "EXPIRED"].includes(claim.status) && <button className={button} onClick={inspect}>Ersatzziehung öffnen</button>}
      </div>}
    </article>;
  })}</div>;
}
