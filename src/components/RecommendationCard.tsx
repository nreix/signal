"use client";

import { useState } from "react";
import type { Recommendation } from "@/types/content";
import {
  dismissFilm,
  removeFromWatchlist,
  saveToWatchlist,
  useDecisions,
} from "@/lib/decisions";
import { CategoryTag } from "./CategoryTag";
import { PosterImage } from "./PosterImage";
import { ScoreRing } from "./ScoreRing";
import { ScoreBar } from "./ScoreBar";

const KIND_LABELS: Record<string, string> = {
  stream: "Streaming",
  rent: "Location",
  buy: "Achat",
  physical: "Physique",
};

/** Extrait la clé YouTube de l'URL du trailer (…watch?v=KEY). */
function youtubeKey(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(/[?&]v=([^&]+)/);
  return m ? m[1] : null;
}

export function RecommendationCard({ item }: { item: Recommendation }) {
  const { ready, watchlist, dismissedIds } = useDecisions();
  const [playing, setPlaying] = useState(false);

  const watched = ready && watchlist.some((x) => x.id === item.id);
  const dismissed = ready && dismissedIds.includes(item.id);

  // "Ne plus voir" => la carte disparaît du flux (et n'est plus proposée).
  if (dismissed) return null;

  const trailerKey = youtubeKey(item.trailerUrl);
  const isMusic = item.category === "album";
  const castLabel = item.category === "book" ? "De " : isMusic ? "Par " : "Avec ";

  return (
    <article className="group flex h-full w-[19rem] shrink-0 flex-col overflow-hidden rounded-lg border border-line bg-card transition-all duration-300 hover:border-line/0 hover:shadow-[0_0_0_1px_var(--color-accent)]">
      <div className="relative">
        {playing && trailerKey ? (
          <div className="aspect-[2/3] w-full bg-ink">
            <iframe
              className="h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&rel=0`}
              title={`Bande-annonce : ${item.title}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <>
            <PosterImage
              posterUrl={item.posterUrl}
              title={item.title}
              category={item.category}
              accentColor={item.accentColor}
            />
            {trailerKey ? (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                aria-label={`Lire la bande-annonce de ${item.title}`}
                className="absolute inset-0 flex items-center justify-center bg-ink/20 opacity-0 transition-opacity hover:opacity-100"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-ink shadow-lg">
                  ▶
                </span>
              </button>
            ) : null}
          </>
        )}
        <div className="absolute left-3 top-3">
          <CategoryTag category={item.category} />
        </div>
        {watched ? (
          <div className="absolute right-3 top-3 rounded-sm bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink">
            Dans ta liste
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        {/* Titre + score */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-serif text-xl leading-tight text-bone">
              {item.title}
            </h3>
            <p className="mt-1 text-xs text-fog">
              {item.year} · {item.genres.join(", ")} · {item.format}
            </p>
          </div>
          {!isMusic ? <ScoreRing score={item.scoreGlobal} /> : null}
        </div>

        {/* Synopsis */}
        <div>
          {item.synopsis ? (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fog-2">
                De quoi ça parle
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-bone/85">
                {item.synopsis}
              </p>
            </>
          ) : null}
          {item.cast && item.cast.length > 0 ? (
            <p className="mt-2 text-xs text-fog">
              <span className="text-fog-2">{castLabel}</span>
              {item.cast.join(", ")}
            </p>
          ) : null}
        </div>

        {/* Détail des scores (pas de note agrégée pour la musique) */}
        {!isMusic ? (
          <div className="space-y-1.5 rounded-md bg-ink-2/60 p-3">
            <ScoreBar label="Critiques" value={item.scores.critique} />
            <ScoreBar label="Public" value={item.scores.public} />
            <ScoreBar label="Popularité" value={item.scores.popularite} />
            <ScoreBar label="Réputation" value={item.scores.reputation} />
          </div>
        ) : null}

        {/* Argument : pourquoi c'est une valeur sûre (critique Pitchfork pour la musique) */}
        {item.whySafe ? (
          <div className="border-l-2 border-accent pl-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-2">
              {isMusic ? "Ce qu'en dit la critique" : "Pourquoi c'est une valeur sûre"}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-bone/85">
              {item.whySafe}
            </p>
          </div>
        ) : null}

        {/* Disponibilité (ou "Au cinéma" pour un film pas encore en streaming) */}
        <div className="flex flex-wrap items-center gap-2">
          {item.streaming.length > 0 ? (
            item.streaming.map((s) => {
              const cls =
                "inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] text-fog transition-colors hover:border-bone hover:text-bone";
              const inner = (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-accent/70" />
                  {isMusic ? `Écouter sur ${s.platform}` : s.platform}
                  {isMusic ? null : <span className="text-fog-2">· {KIND_LABELS[s.kind]}</span>}
                </>
              );
              return s.url ? (
                <a key={`${s.platform}-${s.kind}`} href={s.url} target="_blank" rel="noopener noreferrer" className={cls}>
                  {inner}
                </a>
              ) : (
                <span key={`${s.platform}-${s.kind}`} className={cls}>
                  {inner}
                </span>
              );
            })
          ) : item.category === "film" && item.inTheaters ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Au cinéma
            </span>
          ) : item.category === "film" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] text-fog-2">
              Indisponible en streaming
            </span>
          ) : null}

          {trailerKey && !playing ? (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] text-fog transition-colors hover:border-bone hover:text-bone"
            >
              <span aria-hidden>▶</span> Bande-annonce (VO)
            </button>
          ) : null}
        </div>

        {/* Actions persistantes */}
        <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() =>
              watched ? removeFromWatchlist(item.id) : saveToWatchlist(item)
            }
            className={`rounded-md px-3 py-2.5 text-sm font-semibold transition-colors ${
              watched
                ? "bg-accent text-ink"
                : "bg-accent/10 text-accent-2 hover:bg-accent hover:text-ink"
            }`}
          >
            {watched ? "✓ Dans ta liste" : isMusic ? "Je l'écoute" : "Oui, je veux le voir"}
          </button>
          <button
            type="button"
            onClick={() => dismissFilm(item.id)}
            className="rounded-md border border-line px-3 py-2.5 text-sm font-medium text-fog transition-colors hover:border-fog-2 hover:text-bone"
          >
            {isMusic ? "Passer" : "Ne plus voir"}
          </button>
        </div>
      </div>
    </article>
  );
}
