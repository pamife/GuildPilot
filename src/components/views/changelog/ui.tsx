import { isAxiosError } from "axios";
import { useEffect, useId, useRef } from "react";
import { ChangelogChoice } from "@/types/changelog";

export const panel = "panel-glass min-w-0 rounded-2xl p-4 sm:p-5";
export const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--gp-border)] px-3 py-2 text-sm font-medium transition-colors enabled:hover:bg-[var(--gp-raised)]";
export const primary = `${button} !border-emerald-300/30 bg-emerald-300/15 text-emerald-100 enabled:hover:!bg-emerald-300/25`;
export const field = "min-w-0 w-full rounded-lg border border-[var(--gp-border)] px-3 py-2.5 text-sm text-[var(--gp-text)]";
export const label = "grid min-w-0 gap-1.5 text-sm font-medium";
export const muted = "text-[var(--gp-muted)]";

export function requestError(error: unknown) {
  return isAxiosError(error) && typeof error.response?.data?.error === "string"
    ? error.response.data.error : "Die Anfrage konnte nicht abgeschlossen werden.";
}

export function DestinationSelect({ label: name, value, choices, placeholder, prefix, onChange }: {
  label: string; value: string | null; choices: ChangelogChoice[]; placeholder: string;
  prefix: string; onChange: (value: string | null) => void;
}) {
  const id = useId();
  return (
    <div className={label}>
      <label htmlFor={id}>{name}</label>
      <select id={id} className={field} value={value ?? ""} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">{placeholder}</option>
        {value && !choices.some(({ id }) => id === value) && <option value={value}>Nicht verfügbar ({value})</option>}
        {choices.map(({ id, name }) => <option value={id} key={id}>{prefix}{name}</option>)}
      </select>
    </div>
  );
}

export function ConfirmDialog({ heading, description, action, danger, onCancel, onConfirm }: {
  heading: string; description: string; action: string; danger?: boolean;
  onCancel: () => void; onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const title = useId();
  const detail = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} aria-labelledby={title} aria-describedby={detail} onCancel={onCancel}
      className="m-auto w-[calc(100%-2rem)] max-w-md space-y-4 rounded-2xl border border-[var(--gp-border)] bg-[var(--gp-surface)] p-6 text-[var(--gp-text)] backdrop:bg-black/65">
      <h2 id={title} className="text-lg font-semibold">{heading}</h2>
      <p id={detail} className="break-words text-sm leading-relaxed text-[var(--gp-muted)]">{description}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={button} autoFocus onClick={onCancel}>Abbrechen</button>
        <button type="button" className={danger ? `${button} border-red-400/40 text-red-200` : primary} onClick={onConfirm}>
          {action}
        </button>
      </div>
    </dialog>
  );
}
