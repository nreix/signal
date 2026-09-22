"use client";

import { useEffect, useRef, useState } from "react";
import { RecommendationCard } from "./RecommendationCard";
import { useDecisions } from "@/lib/decisions";
import type { Recommendation } from "@/types/content";

/**
 * Une section = une ligne scrollable horizontalement. On masque les "ne plus
 * voir" et on affiche `limit` cartes (les non-rejetées). Quand la réserve de
 * non-rejetées descend sous le seuil, on recharge une page (restock) via l'API.
 */
export function CardGrid({
  items,
  limit,
  sectionId,
  kind,
}: {
  items: Recommendation[];
  limit?: number;
  sectionId?: string;
  kind?: "films" | "series" | "books" | "music";
}) {
  const { ready, dismissedIds } = useDecisions();
  const [extra, setExtra] = useState<Recommendation[]>([]);
  const [page, setPage] = useState(2); // le serveur a déjà servi ~pages 1-2
  const [exhausted, setExhausted] = useState(false);
  const loadingRef = useRef(false);

  const all = [...items, ...extra];
  const visible = ready ? all.filter((it) => !dismissedIds.includes(it.id)) : all;

  useEffect(() => {
    if (!ready || !limit || !sectionId || !kind || exhausted || loadingRef.current) return;
    if (visible.length >= limit + 4) return; // réserve suffisante

    loadingRef.current = true;
    const next = page + 1;
    fetch(`/api/more?kind=${kind}&section=${encodeURIComponent(sectionId)}&page=${next}`)
      .then((r) => r.json())
      .then((d: { items?: Recommendation[] }) => {
        const seen = new Set(all.map((x) => x.id));
        const fresh = (d.items ?? []).filter((x) => !seen.has(x.id));
        setPage(next);
        if (fresh.length === 0) setExhausted(true);
        else setExtra((e) => [...e, ...fresh]);
      })
      .catch(() => setExhausted(true))
      .finally(() => {
        loadingRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, visible.length, limit, sectionId, kind, exhausted, page]);

  const shown = limit ? visible.slice(0, limit) : visible;

  return (
    <div className="-mx-6 overflow-x-auto px-6 pb-4">
      <div className="flex items-stretch gap-5">
        {shown.map((item) => (
          <RecommendationCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
