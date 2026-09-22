"use client";

import { useState } from "react";
import Image from "next/image";
import { tmdbPoster } from "@/lib/format";
import type { Category } from "@/types/content";

const CATEGORY_GLYPH: Record<Category, string> = {
  film: "Film",
  series: "Série",
  album: "Album",
  book: "Livre",
};

/**
 * Poster avec fallback dégradé : si l'image manque ou échoue à charger
 * (typique pour albums/livres sans visuel), on affiche un dégradé propre
 * dérivé de la couleur d'accent + le titre. Jamais d'image cassée.
 */
export function PosterImage({
  posterUrl,
  title,
  category,
  accentColor,
}: {
  posterUrl?: string;
  title: string;
  category: Category;
  accentColor?: string;
}) {
  const [errored, setErrored] = useState(false);
  const src = tmdbPoster(posterUrl);
  const showImage = src && !errored;

  return (
    <div className="relative aspect-[2/3] w-full overflow-hidden bg-ink-2">
      {showImage ? (
        <Image
          src={src}
          alt={`Affiche : ${title}`}
          fill
          sizes="(max-width: 768px) 100vw, 320px"
          className="object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        <div
          className="flex h-full w-full flex-col items-center justify-center p-4 text-center"
          style={{
            background: `radial-gradient(120% 120% at 30% 20%, ${
              accentColor ?? "#3a3a40"
            }55, var(--color-ink-2) 70%)`,
          }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-fog">
            {CATEGORY_GLYPH[category]}
          </span>
          <span className="mt-2 font-serif text-lg leading-tight text-bone">
            {title}
          </span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
    </div>
  );
}
