import { verdictFromScore, VERDICT_LABELS } from "@/lib/scoring";

/**
 * Pastille de score global avec anneau de progression (SVG, pas de dépendance).
 */
export function ScoreRing({ score }: { score: number }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const verdict = verdictFromScore(score);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-14 w-14">
        <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth="3"
          />
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-base font-bold tabular-nums text-bone">
          {score}
        </span>
      </div>
      <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-accent-2">
        {VERDICT_LABELS[verdict]}
      </span>
    </div>
  );
}
