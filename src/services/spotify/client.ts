/**
 * Client Spotify (Client Credentials — pas de login). Nécessite SPOTIFY_CLIENT_ID
 * et SPOTIFY_CLIENT_SECRET. Découverte par genre : albums/titres récents et
 * playlists. Défensif : sans clés ou en cas d'échec -> [].
 *
 * Contraintes de quota (app en mode développement) : `limit` plafonné à 10 par
 * requête -> on pagine via `offset`. `tag:new` ne marche que pour les albums ;
 * pour les titres on filtre par `year:<année courante>`.
 */
let cachedToken: { token: string; exp: number } | null = null;

const LIMIT = 10; // maximum autorisé par requête pour cette app

async function getToken(): Promise<string | null> {
  if (cachedToken && cachedToken.exp > Date.now()) return cachedToken.token;
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;
  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=client_credentials&client_id=${id}&client_secret=${secret}`,
      // Pas de "no-store" : sinon toute la page /musique bascule en rendu
      // dynamique. Le token est mis en cache en mémoire (cachedToken) + 50 min.
      next: { revalidate: 3000 },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { access_token: string; expires_in: number };
    cachedToken = { token: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
    return cachedToken.token;
  } catch {
    return null;
  }
}

const enc = (s: string) => encodeURIComponent(s);

/** Une page (max 10) de résultats bruts pour un type donné. */
async function searchPage(
  type: "album" | "track" | "playlist",
  q: string,
  offset: number,
): Promise<Record<string, unknown>[]> {
  const t = await getToken();
  if (!t) return [];
  try {
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${enc(q)}&type=${type}&market=FR&limit=${LIMIT}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${t}` }, next: { revalidate: 3600 } },
    );
    if (!res.ok) return [];
    const j = (await res.json()) as Record<string, { items?: (Record<string, unknown> | null)[] }>;
    return (j[`${type}s`]?.items ?? []).filter((x): x is Record<string, unknown> => !!x);
  } catch {
    return [];
  }
}

export interface SpotAlbum {
  id: string;
  name: string;
  artists: string[];
  releaseDate: string;
  image?: string;
  url: string;
  tracks: number;
}
export interface SpotTrack {
  id: string;
  name: string;
  artists: string[];
  image?: string;
  url: string;
  album: string;
  releaseDate: string;
}
export interface SpotPlaylist {
  id: string;
  name: string;
  owner?: string;
  image?: string;
  url: string;
  tracks?: number;
}

// Rejette compilations / mix DJ / "best of" (spam des recherches par genre).
const SPAM = /\b(mix|vol\.?|compil|best of|hits|top \d|megamix|dj set|essentials|selection|radio|workout|party)\b/i;

const firstImage = (o: Record<string, unknown>): string | undefined =>
  (o.images as { url: string }[] | undefined)?.[0]?.url;
const artistNames = (o: Record<string, unknown>): string[] =>
  ((o.artists as { name: string }[]) ?? []).map((x) => x.name);
const spotifyUrl = (o: Record<string, unknown>): string =>
  (o.external_urls as { spotify?: string })?.spotify ?? "";

/**
 * Albums récents d'un genre. On NE recherche PAS `type=album` (dominé par des
 * "artistes" SEO nommés d'après le genre) : on recherche les titres de l'année
 * puis on remonte à leurs albums parents (vrais artistes, vraies sorties). On
 * exige un vrai album (album_type=album, 5–30 titres) et on écarte le spam.
 */
export async function newAlbumsByGenre(genre: string, want: number, pageStart = 0): Promise<SpotAlbum[]> {
  const year = new Date().getFullYear();
  const out: SpotAlbum[] = [];
  const seen = new Set<string>();
  for (let p = 0; p < 4 && out.length < want; p++) {
    const items = await searchPage("track", `${genre} year:${year}`, (pageStart + p) * LIMIT);
    if (items.length === 0) break;
    for (const t of items) {
      const a = t.album as Record<string, unknown> | undefined;
      if (!a || a.album_type !== "album") continue;
      const tracks = (a.total_tracks as number) ?? 0;
      if (tracks < 5 || tracks > 30) continue; // ni EP ni méga-compilation
      const id = String(a.id);
      if (seen.has(id) || !firstImage(a) || SPAM.test(String(a.name))) continue;
      seen.add(id);
      out.push({
        id,
        name: String(a.name),
        artists: artistNames(a),
        releaseDate: String(a.release_date ?? ""),
        image: firstImage(a),
        url: spotifyUrl(a),
        tracks,
      });
      if (out.length >= want) break;
    }
  }
  return out;
}

/** Titres de l'année en cours pour un genre. */
export async function newTracksByGenre(genre: string, want: number, pageStart = 0): Promise<SpotTrack[]> {
  const year = new Date().getFullYear();
  const out: SpotTrack[] = [];
  for (let p = 0; p < 2 && out.length < want; p++) {
    const items = await searchPage("track", `${genre} year:${year}`, (pageStart + p) * LIMIT);
    if (items.length === 0) break;
    for (const t of items) {
      const alb = t.album as
        | { name?: string; images?: { url: string }[]; release_date?: string }
        | undefined;
      if (!alb?.images?.length) continue;
      out.push({
        id: String(t.id),
        name: String(t.name),
        artists: artistNames(t),
        image: alb.images[0]?.url,
        url: spotifyUrl(t),
        album: String(alb.name ?? ""),
        releaseDate: String(alb.release_date ?? ""),
      });
      if (out.length >= want) break;
    }
  }
  return out;
}

/**
 * Retrouve un album précis sur Spotify (pour lier une sélection externe, ex.
 * Pitchfork). Essaie d'abord les filtres de champ, puis une recherche libre.
 * Renvoie l'URL d'écoute + la pochette, ou null si introuvable.
 */
export async function resolveAlbum(
  title: string,
  artist: string,
): Promise<{ url: string; image?: string } | null> {
  const queries = [`album:${title} artist:${artist}`, `${title} ${artist}`];
  for (const q of queries) {
    const items = await searchPage("album", q, 0);
    const a = items[0];
    if (a && spotifyUrl(a)) return { url: spotifyUrl(a), image: firstImage(a) };
  }
  return null;
}

/** Playlists correspondant à un genre. */
export async function playlistsByGenre(genre: string, want: number, pageStart = 0): Promise<SpotPlaylist[]> {
  const out: SpotPlaylist[] = [];
  for (let p = 0; p < 2 && out.length < want; p++) {
    const items = await searchPage("playlist", genre, (pageStart + p) * LIMIT);
    if (items.length === 0) break;
    for (const pl of items) {
      if (!firstImage(pl)) continue;
      out.push({
        id: String(pl.id),
        name: String(pl.name),
        owner: (pl.owner as { display_name?: string })?.display_name,
        image: firstImage(pl),
        url: spotifyUrl(pl),
        tracks: (pl.tracks as { total?: number })?.total,
      });
      if (out.length >= want) break;
    }
  }
  return out;
}
