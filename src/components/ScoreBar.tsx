/** Une ligne « libellé — barre — valeur » pour détailler une composante du score. */
export function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-16 shrink-0 text-[11px] uppercase tracking-wider text-fog-2">
        {label}
      </span>
      <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-line">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-bone/70"
          style={{ width: `${value}%` }}
        />
      </span>
      <span className="w-6 shrink-0 text-right text-[11px] font-medium tabular-nums text-fog">
        {value}
      </span>
    </div>
  );
}
