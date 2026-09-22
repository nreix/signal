/**
 * Client OMDb — apporte les notes que TMDb n'a pas : Rotten Tomatoes (critiques),
 * Metascore et IMDb (public + réputation via le nombre de votes).
 *
 * Entièrement OPTIONNEL : sans `OMDB_API_KEY`, `omdbGetByImdbId` renvoie `null`
 * et le reste de l'app retombe proprement sur le scoring TMDb seul. Clé gratuite
 * (1000 req/jour) sur https://www.omdbapi.com/apikey.aspx
 */
const BASE_URL = process.env.OMDB_API_BASE_URL ?? "https://www.omdbapi.com";
const API_KEY = process.env.OMDB_API_KEY;

export interface OmdbRating {
  Source: string; // "Internet Movie Database", "Rotten Tomatoes", "Metacritic"
  Value: string; // "8.1/10", "92%", "85/100"
}

export interface OmdbResponse {
  Response: string; // "True" | "False"
  imdbRating?: string; // "8.1"
  imdbVotes?: string; // "1,234,567"
  Metascore?: string; // "85"
  Ratings?: OmdbRating[];
}

/** Cherche un film par son identifiant IMDb. `null` si pas de clé / échec / introuvable. */
export async function omdbGetByImdbId(imdbId: string): Promise<OmdbResponse | null> {
  if (!API_KEY) return null; // dégradation propre : OMDb absent -> TMDb seul

  try {
    const url = new URL(`${BASE_URL}/`);
    url.searchParams.set("apikey", API_KEY);
    url.searchParams.set("i", imdbId);
    url.searchParams.set("tomatoes", "true"); // enrichit les Ratings

    const res = await fetch(url, { next: { revalidate: 86_400 } }); // cache 24h
    if (!res.ok) return null;

    const data = (await res.json()) as OmdbResponse;
    return data.Response === "True" ? data : null;
  } catch {
    return null;
  }
}
