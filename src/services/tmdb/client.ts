/**
 * Client HTTP minimal pour l'API TMDb.
 *
 * Une seule fonction `tmdbGet` : elle ajoute la clé, la langue et la région,
 * met en cache 1h (revalidate) et renvoie le JSON typé. Tout le reste de
 * l'intégration (mapper, provider) passe par elle.
 */
const BASE_URL = process.env.TMDB_API_BASE_URL ?? "https://api.themoviedb.org/3";
const API_KEY = process.env.TMDB_API_KEY;

export async function tmdbGet<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  if (!API_KEY) {
    throw new Error(
      "TMDB_API_KEY manquante. Renseigne-la dans .env.local (voir .env.example).",
    );
  }

  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("api_key", API_KEY);
  url.searchParams.set("language", "fr-FR");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error(`TMDb ${res.status} sur ${path}`);
  }
  return res.json() as Promise<T>;
}

/* --- Formes des réponses TMDb dont on se sert (partielles) --- */

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbMovie {
  id: number;
  title: string;
  overview: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  release_date: string;
  poster_path: string | null;
  original_language?: string; // "fr", "en"… (filtre films vraiment français)
  imdb_id?: string | null; // sur le endpoint détails -> clé OMDb
  genre_ids?: number[]; // sur les listes (tendances)
  genres?: TmdbGenre[]; // sur le endpoint détails
  runtime?: number; // présent uniquement sur le endpoint détails
  "watch/providers"?: TmdbWatchProviders;
  videos?: TmdbVideos;
  credits?: TmdbCredits;
}

export interface TmdbTv {
  id: number;
  name: string;
  overview: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  first_air_date: string;
  poster_path: string | null;
  genre_ids?: number[];
  genres?: TmdbGenre[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  episode_run_time?: number[];
  "watch/providers"?: TmdbWatchProviders;
  videos?: TmdbVideos;
  credits?: TmdbCredits;
}

export interface TmdbList<T> {
  results: T[];
}

interface TmdbProviderEntry {
  provider_name: string;
}

export interface TmdbWatchProviders {
  results: Record<
    string,
    {
      flatrate?: TmdbProviderEntry[];
      rent?: TmdbProviderEntry[];
      buy?: TmdbProviderEntry[];
    }
  >;
}

export interface TmdbVideo {
  key: string; // identifiant YouTube
  site: string; // "YouTube", "Vimeo"...
  type: string; // "Trailer", "Teaser"...
  official: boolean;
  iso_639_1: string; // langue : "en" = VO
  name: string;
}

export interface TmdbVideos {
  results: TmdbVideo[];
}

export interface TmdbCastMember {
  name: string;
  order: number; // ordre au générique (0 = tête d'affiche)
  character?: string;
}

export interface TmdbCredits {
  cast?: TmdbCastMember[];
}
