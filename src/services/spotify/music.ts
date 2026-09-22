/**
 * Construction de la page Musique à partir de Spotify.
 *
 * Découverte par genre (anti-mainstream) : on ne part PAS des artistes déjà
 * connus mais des dernières sorties dans les styles aimés. Trois sections :
 * derniers albums, derniers titres, playlists par genre. Chaque item pointe
 * vers Spotify. Défensif : sans clés / en cas d'échec -> section vide.
 */
import type { FilmSection, FilmSelection, Recommendation, ScoreInput } from "@/types/content";
import {
  newAlbumsByGenre,
  newTracksByGenre,
  playlistsByGenre,
  resolveAlbum,
  type SpotAlbum,
  type SpotPlaylist,
  type SpotTrack,
} from "./client";
import { bestNewAlbums, type PfAlbum } from "../pitchfork/client";

// La musique n'a pas de note agrégée : on neutralise le scoring (masqué sur la carte).
const NEUTRAL: ScoreInput = { critique: 0, public: 0, popularite: 0, reputation: 0, compatibilite: 0 };

interface Genre {
  key: string;
  label: string;
  q: string;
}

// Les styles de l'utilisateur (mélomane, anti-commercial).
const GENRES: Genre[] = [
  { key: "indie", label: "Indé US", q: "indie" },
  { key: "alt-rock", label: "Rock alternatif", q: "alternative rock" },
  { key: "hiphop-us", label: "Hip-hop underground US", q: "underground hip hop" },
  { key: "rap-fr", label: "Rap FR", q: "rap français" },
  { key: "house", label: "House", q: "house" },
  { key: "deep-house", label: "Deep house", q: "deep house" },
  { key: "bouyon", label: "Bouyon", q: "bouyon" },
  { key: "reggae", label: "Reggae", q: "reggae" },
];

const yearOf = (d: string): number => Number((d || "").slice(0, 4)) || new Date().getFullYear();

function albumToRec(a: SpotAlbum, genreLabel: string): Recommendation {
  return {
    id: `sp-album-${a.id}`,
    category: "album",
    title: a.name,
    year: yearOf(a.releaseDate),
    genres: [genreLabel],
    scores: NEUTRAL,
    scoreGlobal: 0,
    format: `Album · ${a.tracks} titres`,
    posterUrl: a.image,
    streaming: [{ platform: "Spotify", kind: "stream", url: a.url }],
    cast: a.artists.slice(0, 3),
    synopsis: "",
    whySafe: "",
  };
}

function trackToRec(t: SpotTrack, genreLabel: string): Recommendation {
  return {
    id: `sp-track-${t.id}`,
    category: "album",
    title: t.name,
    year: yearOf(t.releaseDate),
    genres: [genreLabel],
    scores: NEUTRAL,
    scoreGlobal: 0,
    format: `Titre · ${t.album}`,
    posterUrl: t.image,
    streaming: [{ platform: "Spotify", kind: "stream", url: t.url }],
    cast: t.artists.slice(0, 3),
    synopsis: "",
    whySafe: "",
  };
}

function playlistToRec(p: SpotPlaylist, genreLabel: string): Recommendation {
  return {
    id: `sp-pl-${p.id}`,
    category: "album",
    title: p.name,
    year: new Date().getFullYear(),
    genres: [genreLabel],
    scores: NEUTRAL,
    scoreGlobal: 0,
    format: p.tracks ? `Playlist · ${p.tracks} titres` : "Playlist",
    posterUrl: p.image,
    streaming: [{ platform: "Spotify", kind: "stream", url: p.url }],
    cast: p.owner ? [p.owner] : undefined,
    synopsis: "",
    whySafe: "",
  };
}

/**
 * Album encensé par Pitchfork -> Recommendation. On relie à Spotify pour le
 * bouton d'écoute (sinon on retombe sur la critique Pitchfork). La critique
 * courte devient le "pourquoi c'est recommandé".
 */
async function pfToRec(a: PfAlbum): Promise<Recommendation> {
  const spot = await resolveAlbum(a.title, a.artist);
  const url = spot?.url ?? a.reviewUrl;
  const platform = spot ? "Spotify" : "Pitchfork";
  return {
    id: `pf-${a.reviewUrl}`,
    category: "album",
    title: a.title,
    year: new Date().getFullYear(),
    genres: [a.genre],
    scores: NEUTRAL,
    scoreGlobal: 0,
    format: "Album · encensé par Pitchfork",
    posterUrl: spot?.image ?? a.image,
    streaming: [{ platform, kind: "stream", url }],
    cast: [a.artist],
    synopsis: "",
    whySafe: a.blurb,
  };
}

/** map avec concurrence limitée (évite de saturer le rate limit Spotify). */
async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function buildPitchfork(page = 1): Promise<Recommendation[]> {
  const albums = await bestNewAlbums(page);
  // Résolution Spotify throttlée : 4 en parallèle, sinon Spotify renvoie du 429.
  const recs = await mapLimit(albums, 4, (a) => pfToRec(a));
  return dedup(recs).filter((r) => r.posterUrl);
}

/** Round-robin entre genres pour varier le flux (au lieu de blocs par genre). */
function interleave(groups: Recommendation[][]): Recommendation[] {
  const out: Recommendation[] = [];
  const max = Math.max(0, ...groups.map((g) => g.length));
  for (let i = 0; i < max; i++) {
    for (const g of groups) if (g[i]) out.push(g[i]);
  }
  return out;
}

function dedup(items: Recommendation[]): Recommendation[] {
  const seen = new Set<string>();
  return items.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

async function buildAlbums(perGenre: number, pageStart = 0): Promise<Recommendation[]> {
  const groups = await Promise.all(
    GENRES.map((g) =>
      newAlbumsByGenre(g.q, perGenre, pageStart).then((al) => al.map((a) => albumToRec(a, g.label))),
    ),
  );
  return dedup(interleave(groups)).filter((r) => r.posterUrl);
}

async function buildTracks(perGenre: number, pageStart = 0): Promise<Recommendation[]> {
  const groups = await Promise.all(
    GENRES.map((g) =>
      newTracksByGenre(g.q, perGenre, pageStart).then((tr) => tr.map((t) => trackToRec(t, g.label))),
    ),
  );
  return dedup(interleave(groups)).filter((r) => r.posterUrl);
}

async function buildPlaylists(perGenre: number, pageStart = 0): Promise<Recommendation[]> {
  const groups = await Promise.all(
    GENRES.map((g) =>
      playlistsByGenre(g.q, perGenre, pageStart).then((pl) => pl.map((p) => playlistToRec(p, g.label))),
    ),
  );
  return dedup(interleave(groups)).filter((r) => r.posterUrl);
}

/** Page Musique complète (3 sections), avec buffer pour le restock. */
export async function buildMusicSelection(week: string): Promise<FilmSelection> {
  // Deux salves séparées pour ne pas saturer le rate limit Spotify : d'abord la
  // résolution Pitchfork (throttlée), puis les recherches par genre.
  const pitchfork = await buildPitchfork();
  const [albums, tracks, playlists] = await Promise.all([
    buildAlbums(4),
    buildTracks(4),
    buildPlaylists(3),
  ]);

  const sections: FilmSection[] = [
    {
      id: "music-pitchfork",
      title: "Encensés par la critique",
      hint: "Best New Albums de Pitchfork · lien Spotify",
      items: pitchfork,
      limit: 20,
    },
    {
      id: "music-albums",
      title: "Derniers albums",
      hint: "Sorties récentes dans tes genres · lien Spotify",
      items: albums,
      limit: 20,
    },
    {
      id: "music-tracks",
      title: "Derniers titres",
      hint: "À écouter en priorité · lien Spotify",
      items: tracks,
      limit: 20,
    },
    {
      id: "music-playlists",
      title: "Playlists par genre",
      hint: "Une sélection par style · lien Spotify",
      items: playlists,
      limit: 12,
    },
  ].filter((s) => s.items.length > 0);

  return { week, sections };
}

/** Restock : page suivante d'une section musicale (offsets de recherche plus loin). */
export async function getMoreMusic(sectionId: string, page: number): Promise<Recommendation[]> {
  if (sectionId === "music-pitchfork") return buildPitchfork(page);
  const pageStart = (page - 1) * 4; // saute les pages déjà consommées
  if (sectionId === "music-albums") return buildAlbums(3, pageStart);
  if (sectionId === "music-tracks") return buildTracks(3, pageStart);
  if (sectionId === "music-playlists") return buildPlaylists(2, pageStart);
  return [];
}
