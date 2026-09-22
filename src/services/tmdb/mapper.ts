/**
 * Mapper TMDb -> domaine Signal.
 *
 * C'est LE traducteur : il prend le JSON brut de TMDb et le transforme en
 * `Recommendation`, le seul format que connaît le reste de l'app. Toute la
 * "tambouille" de conversion (note /10 -> /100, IDs de genres -> noms,
 * date -> année, providers -> streaming) est ici, et nulle part ailleurs.
 */
import type {
  Recommendation,
  ScoreInput,
  StreamingAvailability,
} from "@/types/content";
import { computeScoreGlobal } from "@/lib/scoring";
import { formatRuntime } from "@/lib/format";
import type {
  TmdbCredits,
  TmdbGenre,
  TmdbMovie,
  TmdbTv,
  TmdbVideos,
  TmdbWatchProviders,
} from "./client";
import type { OmdbResponse } from "../omdb/client";

/* TMDb renvoie des IDs de genres ; voici la correspondance officielle (FR). */
const MOVIE_GENRES: Record<number, string> = {
  28: "Action", 12: "Aventure", 16: "Animation", 35: "Comédie",
  80: "Crime", 99: "Documentaire", 18: "Drame", 10751: "Famille",
  14: "Fantastique", 36: "Histoire", 27: "Horreur", 10402: "Musique",
  9648: "Mystère", 10749: "Romance", 878: "Science-fiction",
  10770: "Téléfilm", 53: "Thriller", 10752: "Guerre", 37: "Western",
};

const TV_GENRES: Record<number, string> = {
  10759: "Action & Aventure", 16: "Animation", 35: "Comédie", 80: "Crime",
  99: "Documentaire", 18: "Drame", 10751: "Famille", 10762: "Enfants",
  9648: "Mystère", 10763: "Actualité", 10764: "Téléréalité",
  10765: "Science-fiction & Fantastique", 10766: "Feuilleton",
  10767: "Talk-show", 10768: "Guerre & Politique", 37: "Western",
};

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));

/** Plus une œuvre a de votes, plus sa réputation est "installée". */
function reputationFromVotes(voteCount: number): number {
  return clamp(Math.round(voteCount / 100));
}

/** La popularité TMDb n'a pas d'échelle fixe ; on la ramène grossièrement sur 100. */
function normalizePopularity(popularity: number): number {
  return clamp(Math.round((popularity / 300) * 100));
}

/**
 * Résout les genres. L'endpoint détails renvoie `genres: [{id, name}]` (déjà en
 * français), les listes renvoient `genre_ids: number[]` -> on mappe via la table.
 */
function resolveGenres(
  genres: TmdbGenre[] | undefined,
  ids: number[] | undefined,
  table: Record<number, string>,
): string[] {
  if (genres?.length) return genres.map((g) => g.name);
  if (ids?.length) return ids.map((id) => table[id]).filter(Boolean);
  return [];
}

/**
 * Choisit le meilleur trailer en VO : on privilégie une bande-annonce officielle
 * en anglais sur YouTube, puis tout trailer YouTube, puis n'importe quelle vidéo.
 */
function trailerUrlFrom(videos: TmdbVideos | undefined): string | undefined {
  const vids = (videos?.results ?? []).filter((v) => v.site === "YouTube");
  if (!vids.length) return undefined;
  const score = (v: (typeof vids)[number]) =>
    (v.type === "Trailer" ? 4 : v.type === "Teaser" ? 2 : 0) +
    (v.iso_639_1 === "en" ? 2 : 0) + // VO
    (v.official ? 1 : 0);
  const best = [...vids].sort((a, b) => score(b) - score(a))[0];
  return `https://www.youtube.com/watch?v=${best.key}`;
}

function yearFrom(date: string | undefined): number {
  return date ? Number(date.slice(0, 4)) : 0;
}

const FOUR_MONTHS_MS = 1000 * 60 * 60 * 24 * 122;

/** Plausiblement encore en salle : sorti il y a moins de 4 mois (ou à venir). */
function inTheatersFromDate(date: string | undefined): boolean {
  if (!date) return false;
  const t = Date.parse(date);
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= FOUR_MONTHS_MS;
}

/** Les 3 acteurs en tête d'affiche (déjà ordonnés par TMDb). */
function topCast(credits: TmdbCredits | undefined): string[] {
  return (credits?.cast ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .slice(0, 3)
    .map((c) => c.name);
}

/**
 * Disponibilité en France : abonnement (flatrate) EN PREMIER, puis VOD
 * (location / achat). Une plateforme n'apparaît qu'une fois (abonnement prioritaire).
 * Une liste vide => le film n'est ni en streaming ni en VOD (souvent encore en salle).
 */
function mapStreaming(providers: TmdbWatchProviders | undefined): StreamingAvailability[] {
  const fr = providers?.results?.FR;
  if (!fr) return [];
  const out: StreamingAvailability[] = [];
  const seen = new Set<string>();
  const add = (
    list: { provider_name: string }[] | undefined,
    kind: StreamingAvailability["kind"],
  ) => {
    for (const p of list ?? []) {
      if (seen.has(p.provider_name)) continue;
      seen.add(p.provider_name);
      out.push({ platform: p.provider_name, kind });
    }
  };
  add(fr.flatrate, "stream");
  add(fr.rent, "rent");
  add(fr.buy, "buy");
  return out.slice(0, 5);
}

/* --- Notes OMDb (Rotten Tomatoes / IMDb / Metacritic) --- */

/**
 * Extrait le premier nombre d'une chaîne ("92%" -> 92, "1,234,567" -> 1234567).
 * Renvoie null pour les valeurs absentes ("N/A", "") — sinon OMDb les ferait
 * passer pour 0, ce qui fausserait le scoring ET l'argumentaire.
 */
function num(s: string | undefined): number | null {
  if (!s || s === "N/A") return null;
  const cleaned = s.replace(/[^0-9.]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function rtCritics(omdb: OmdbResponse | null | undefined): number | null {
  const r = omdb?.Ratings?.find((x) => x.Source === "Rotten Tomatoes");
  return r ? num(r.Value) : null; // "92%" -> 92
}
const metascore = (omdb: OmdbResponse | null | undefined) => num(omdb?.Metascore);
const imdbScore10 = (omdb: OmdbResponse | null | undefined) => num(omdb?.imdbRating); // /10
const imdbVotes = (omdb: OmdbResponse | null | undefined) => num(omdb?.imdbVotes);

function formatVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} k`;
  return String(n);
}

/**
 * Construit les composantes du score en combinant TMDb et (si dispo) OMDb :
 *   - critique     <- moyenne Rotten Tomatoes + Metascore, sinon note TMDb
 *   - public       <- note IMDb (/100), sinon note TMDb
 *   - reputation   <- nombre de votes IMDb, sinon votes TMDb
 *   - popularite   <- popularité TMDb normalisée
 *   - compatibilite<- neutre (à raffiner avec le profil utilisateur)
 */
function buildScores(
  voteAverage: number,
  voteCount: number,
  popularity: number,
  omdb?: OmdbResponse | null,
): ScoreInput {
  const tmdbScore = clamp(Math.round(voteAverage * 10)); // /10 -> /100

  const critics = [rtCritics(omdb), metascore(omdb)].filter(
    (n): n is number => n != null,
  );
  const critique = critics.length
    ? Math.round(critics.reduce((a, b) => a + b, 0) / critics.length)
    : tmdbScore;

  const imdb = imdbScore10(omdb);
  const publicScore = imdb != null ? Math.round(imdb * 10) : tmdbScore;
  const votes = imdbVotes(omdb) ?? voteCount;

  return {
    critique: clamp(critique),
    public: clamp(publicScore),
    popularite: normalizePopularity(popularity),
    reputation: reputationFromVotes(votes),
    compatibilite: 75,
  };
}

/** Argumentaire "valeur sûre" basé sur les vraies notes disponibles. */
function buildWhySafe(
  voteAverage: number,
  voteCount: number,
  omdb?: OmdbResponse | null,
): string {
  const bits: string[] = [];
  const rt = rtCritics(omdb);
  if (rt != null) bits.push(`Rotten Tomatoes ${rt} % (critiques)`);
  const imdb = imdbScore10(omdb);
  if (imdb != null) {
    const votes = imdbVotes(omdb);
    bits.push(`IMDb ${imdb.toFixed(1)}/10${votes ? ` sur ${formatVotes(votes)} votes` : ""}`);
  }
  if (!bits.length) {
    bits.push(`TMDb ${voteAverage.toFixed(1)}/10 (${voteCount.toLocaleString("fr-FR")} votes)`);
  }
  return `Plébiscité : ${bits.join(" · ")}.`;
}

export function mapTmdbMovie(
  m: TmdbMovie,
  omdb?: OmdbResponse | null,
): Recommendation {
  const scores = buildScores(m.vote_average, m.vote_count, m.popularity, omdb);
  return {
    id: `tmdb-movie-${m.id}`,
    category: "film",
    title: m.title,
    year: yearFrom(m.release_date),
    genres: resolveGenres(m.genres, m.genre_ids, MOVIE_GENRES),
    scores,
    scoreGlobal: computeScoreGlobal(scores), // jamais à la main
    format: m.runtime ? formatRuntime(m.runtime) : "Durée n.c.",
    posterUrl: m.poster_path ?? undefined,
    streaming: mapStreaming(m["watch/providers"]),
    inTheaters: inTheatersFromDate(m.release_date),
    trailerUrl: trailerUrlFrom(m.videos),
    cast: topCast(m.credits),
    synopsis: m.overview || "Synopsis indisponible.",
    whySafe: buildWhySafe(m.vote_average, m.vote_count, omdb),
  };
}

export function mapTmdbTv(t: TmdbTv): Recommendation {
  const scores = buildScores(t.vote_average, t.vote_count, t.popularity);
  const seasons = t.number_of_seasons;
  const format = seasons
    ? `${seasons} saison${seasons > 1 ? "s" : ""}`
    : t.number_of_episodes
      ? `${t.number_of_episodes} épisodes`
      : "Format n.c.";
  return {
    id: `tmdb-tv-${t.id}`,
    category: "series",
    title: t.name,
    year: yearFrom(t.first_air_date),
    genres: resolveGenres(t.genres, t.genre_ids, TV_GENRES),
    scores,
    scoreGlobal: computeScoreGlobal(scores),
    format,
    posterUrl: t.poster_path ?? undefined,
    streaming: mapStreaming(t["watch/providers"]),
    trailerUrl: trailerUrlFrom(t.videos),
    cast: topCast(t.credits),
    synopsis: t.overview || "Synopsis indisponible.",
    whySafe: `Bien notée sur TMDb (${t.vote_average.toFixed(1)}/10, ${t.vote_count.toLocaleString("fr-FR")} votes).`,
  };
}
