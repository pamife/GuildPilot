"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastContainer";

const input = "w-full bg-panel border border-[#35353b] rounded-lg p-2.5 text-white";
const button = "px-3 py-2 rounded-lg bg-[#27272a] hover:bg-[#35353b] font-semibold text-white disabled:opacity-50";

export function ApplicationDmSettings({ value, onChange, channels, roles }: {
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
  channels: { id: string; name: string; type: number }[];
  roles: { id: string; name: string }[];
}) {
  const change = (key: string, next: unknown) => onChange({ ...value, [key]: next });
  const channel = (key: string, label: string, types: number[]) => (
    <label className="grid gap-1">{label}
      <select className={input} value={value[key] ?? ""} onChange={e => change(key, e.target.value)}>
        <option value="">Select a channel</option>
        {channels.filter(ch => types.includes(ch.type)).map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
      </select>
    </label>
  );
  const roleSelect = (key: string, label: string) => (
    <fieldset className="grid gap-1">
      <legend>{label}</legend>
      <div className="max-h-28 overflow-y-auto rounded-lg border border-[#35353b] bg-panel p-2">
        {roles.filter(role => role.name !== "@everyone").map(role => (
          <label key={role.id} className="flex items-center gap-2 py-1">
            <input type="checkbox" checked={value[key]?.includes(role.id) ?? false} onChange={e =>
              change(key, e.target.checked ? [...(value[key] ?? []), role.id] : value[key].filter((id: string) => id !== role.id))} />
            {role.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
  return (
    <fieldset className="space-y-3 border-t border-[#35353b] pt-3">
      <legend className="font-bold text-sm text-white">Discord DM application</legend>
      <label className="grid gap-1">Panel title
        <input className={input} maxLength={200} value={value.dmPanelTitle ?? ""} onChange={e => change("dmPanelTitle", e.target.value)} />
      </label>
      <label className="grid gap-1">Panel description
        <textarea className={input} maxLength={3400} rows={3} value={value.dmPanelDescription ?? ""} onChange={e => change("dmPanelDescription", e.target.value)} />
      </label>
      {channel("dmPanelChannelId", "Public start channel", [0, 5])}
      {channel("reviewChannelId", "Private review channel", [0])}
      {channel("ticketCategoryId", "Ticket category", [4])}
      {roleSelect("reviewerRoles", "Reviewer roles")}
      {roleSelect("acceptedRoles", "Roles granted on acceptance")}
      <label className="grid gap-1">Status steps (one per line)
        <textarea className={input} rows={3} placeholder="Interview scheduled"
          value={value.statusSteps ?? ""} onChange={e => change("statusSteps", e.target.value)} />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={value.isOpen} onChange={e => change("isOpen", e.target.checked)} />
        Accept applications
      </label>
    </fieldset>
  );
}

type ReviewAction = "dm" | "accept" | "deny" | "progress" | "ticket" | "retry_review" |
  "claim" | "unclaim" | "waitlist" | "close" | "transcript" | "reopen";

const titles: Record<ReviewAction, string> = {
  dm: "Send DM", accept: "Accept", deny: "Decline", progress: "Update status", ticket: "Open ticket",
  retry_review: "Retry review delivery", claim: "Claim", unclaim: "Unclaim", waitlist: "Waitlist",
  close: "Close & generate transcript", transcript: "Generate transcript", reopen: "Reopen",
};

export function ApplicationReviewControls({ app, onUpdate }: { app: any; onUpdate: (app: any) => void }) {
  const { showToast } = useToast();
  const [action, setAction] = useState<ReviewAction | null>(null);
  const [body, setBody] = useState("");
  const [reply, setReply] = useState(false);
  const [step, setStep] = useState("");
  const [percent, setPercent] = useState("");
  const [busy, setBusy] = useState(false);
  const [ticketUrl, setTicketUrl] = useState<string>();
  const [error, setError] = useState("");
  const steps: string[] = JSON.parse(app.form?.statusSteps || "[]");
  const decided = app.decidedAt || ["ACCEPTED", "DENIED"].includes(app.status);
  const options: ReviewAction[] = ["dm", "accept", "deny", "progress", "ticket", "retry_review",
    app.claimedByUserId ? "unclaim" : "claim", "waitlist", "close", "transcript"];
  if (app.status === "CLOSED" && !decided) options.push("reopen");

  const choose = (next: ReviewAction) => {
    setAction(next);
    setBody("");
    setReply(false);
    setError("");
    setStep(app.progressStep && (!steps.length || steps.includes(app.progressStep)) ? app.progressStep : steps[0] || "");
    setPercent(String(app.progressPercent ?? 0));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !action) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post(`/guilds/${app.guildId}/applications/apps/${app.id}/action`, {
        action, reason: body, message: body, replyRequested: reply, step, percent,
      });
      onUpdate(data.application);
      if (data.ticketUrl) setTicketUrl(data.ticketUrl);
      setAction(null);
      showToast(data.warnings?.join(" ") || "Application updated.", data.warnings?.length ? "error" : "success");
    } catch (error: any) {
      setError(error.response?.data?.error || "The review action failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-[#1f1f23] bg-canvas p-4">
      <h4 className="text-sm font-bold text-white">Review actions</h4>
      <div className="flex flex-wrap gap-2">
        {options.map(option => <button key={option} className={button} onClick={() => choose(option)}
          disabled={busy || (["accept", "deny", "claim", "unclaim", "waitlist"].includes(option) && (decided || app.status === "CLOSED"))
            || (option === "close" && app.status === "CLOSED")}>
          {titles[option]}
        </button>)}
      </div>
      {ticketUrl && <a href={ticketUrl} target="_blank" rel="noreferrer" className="text-indigo-300 underline">Open linked ticket in Discord</a>}
      {action && (
        <form onSubmit={submit} className="space-y-3 border-t border-line pt-3">
          <h5 className="font-semibold">{titles[action]} · Application #{app.appNumber}</h5>
          {["dm", "accept", "deny", "waitlist", "close"].includes(action) && (
            <label className="grid gap-1">{action === "dm" ? "Message to the applicant" : "Reason (optional)"}
              <textarea className={input} value={body} onChange={e => setBody(e.target.value)} maxLength={1500} required={action === "dm"} rows={3} />
            </label>
          )}
          {action === "dm" && <label className="flex items-center gap-2">
            <input type="checkbox" checked={reply} onChange={e => setReply(e.target.checked)} /> Request a reply
          </label>}
          {action === "progress" && <div className="grid grid-cols-[1fr_8rem] gap-3">
            <label className="grid gap-1">Status step
              {steps.length ? <select className={input} value={step} onChange={e => setStep(e.target.value)}>
                {steps.map(item => <option key={item}>{item}</option>)}
              </select> : <input className={input} value={step} onChange={e => setStep(e.target.value)} maxLength={100} required />}
            </label>
            <label className="grid gap-1">Progress (%)
              <input className={input} value={percent} type="number" min={0} max={100} onChange={e => setPercent(e.target.value)} required />
            </label>
          </div>}
          {error && <p role="alert" className="text-rose-300">{error}</p>}
          <div className="flex gap-2">
            <button type="button" className={button} disabled={busy} onClick={() => setAction(null)}>Cancel</button>
            <button type="submit" className={`${button} bg-indigo-600 hover:bg-indigo-500`} disabled={busy}>{busy ? "Saving…" : "Confirm"}</button>
          </div>
        </form>
      )}
    </section>
  );
}

export function ApplicationAttachment({ app, file }: { app: { id: string; guildId: string }; file: { id: string; name: string } }) {
  const { showToast } = useToast();
  const download = async () => {
    try {
      const { data } = await api.get<Blob>(`/guilds/${app.guildId}/applications/apps/${app.id}/files/${file.id}`,
        { responseType: "blob", timeout: 0 });
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      showToast("The attachment could not be downloaded.", "error");
    }
  };
  return <button type="button" className="break-all text-left text-indigo-300 underline" onClick={download}>{file.name}</button>;
}
