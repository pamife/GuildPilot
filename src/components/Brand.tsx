import { Command } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="gp-brand">
      <span className="gp-brand-mark">
        <Command size={22} strokeWidth={2.5} />
      </span>
      {!compact && <span>pa_mife</span>}
    </div>
  );
}
