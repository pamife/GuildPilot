interface AccentColorToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function AccentColorToggle({
  checked,
  onChange,
  label = "Accent-Farbe anzeigen",
}: AccentColorToggleProps) {
  return (
    <label className="mb-1 flex w-fit cursor-pointer items-center gap-2 text-xs font-semibold text-zinc-400">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="cursor-pointer accent-indigo-500"
      />
      {label}
    </label>
  );
}
