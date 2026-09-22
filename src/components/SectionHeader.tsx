/** En-tête d'une section du dashboard (Films, Séries, ...). */
export function SectionHeader({
  title,
  count,
  hint,
}: {
  title: string;
  count: number;
  hint?: string;
}) {
  return (
    <div className="mb-5 flex items-end justify-between border-b border-line pb-3">
      <div className="flex items-baseline gap-3">
        <h2 className="font-serif text-2xl text-bone">{title}</h2>
        <span className="text-xs font-medium tabular-nums text-fog-2">
          {String(count).padStart(2, "0")}
        </span>
      </div>
      {hint ? <span className="text-xs text-fog-2">{hint}</span> : null}
    </div>
  );
}
