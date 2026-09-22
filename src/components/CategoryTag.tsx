import { CATEGORY_LABELS, type Category } from "@/types/content";

export function CategoryTag({ category }: { category: Category }) {
  return (
    <span className="inline-flex items-center rounded-sm border border-line bg-ink/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-fog">
      {CATEGORY_LABELS[category]}
    </span>
  );
}
