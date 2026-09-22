/**
 * Provider TMDb (+ OMDb) : implémente le contrat ContentProvider.
 *
 * Page Films — 4 sections :
 *   1. Sorties de la semaine au cinéma (3, now_playing FR)
 *   2. Nouveautés en streaming (1 par plateforme : Netflix, Prime, Disney, Apple TV+)
 *   3. À voir en streaming · récents (<2 ans, bien notés, beaucoup de votes)
 *   4. Les classiques à (re)voir (>2 ans, notes exceptionnelles : 1 comédie/romance,
 *      1 thriller, 1 drame)
 *
 * Le genre "horreur" est exclu partout (films & séries).
 * Musique & livres restent mockés tant qu'il n'y a pas de source dédiée.
 */
import type { ContentProvider } from "../content/provider";
import type {
  FilmSection,
  FilmSelection,
  Recommendation,
} from "@/types/content";
import {
  tmdbGet,
  type TmdbList,
  type TmdbMovie,
  type TmdbTv,
} from "./client";
import { mapTmdbMovie, mapTmdbTv } from "./mapper";
import { omdbGetByImdbId } from "../omdb/client";
import { searchGoogleBooks, type GBook } from "../googlebooks/client";
import {
  bestSeries,
  filmRatings,
  filmsAtCinema,
  filmsByCountryDecade,
  ALLO_COUNTRY_FR,
  ALLO_COUNTRY_US,
  type AllocineFilm,
} from "../allocine/client";
import { computeScoreGlobal } from "@/lib/scoring";
import { buildMusicSelection, getMoreMusic } from "../spotify/music";

const HORROR = 27; // id du genre "Horreur" (films)
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 365 * 2; // 2 ans

// IDs des plateformes (region FR, vérifiés via /watch/providers).
const PLATFORMS = [
  { id: 8, name: "Netflix" },
  { id: 119, name: "Prime Video" },
  { id: 337, name: "Disney+" },
  { id: 350, name: "Apple TV+" },
];

const DETAIL_PARAMS = {
  append_to_response: "watch/providers,videos,credits",
  include_video_language: "en,null,fr", // trailer en VO en priorité
};

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/** Libellé de la semaine courante, ex. "Semaine du 8 septembre 2026" (lundi). */
function currentWeekLabel(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = dimanche, 1 = lundi…
  const monday = new Date(now);
  monday.setDate(now.getDate() + (day === 0 ? -6 : 1 - day));
  const fmt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `Semaine du ${fmt.format(monday)}`;
}
const twoYearsAgo = () => new Date(Date.now() - MAX_AGE_MS).toISOString().slice(0, 10);

// Sorties au cinéma : sourcées depuis Allociné "à l'affiche" (fiable pour la
// France, contrairement à TMDb now_playing qui rate des films majeurs). On garde
// les films plébiscités par le public (spectateurs >= 3.9) et les nouvelles
// productions (année >= currentYear-1, pour écarter les reprises).
const CINEMA_MIN_SPECT = 3.9;
const CINEMA_MIN_YEAR = new Date().getFullYear() - 1;
const CINEMA_COUNT = 6;

const noHorror = (m: TmdbMovie | TmdbTv) => !(m.genre_ids ?? []).includes(HORROR);

async function discover(params: Record<string, string>): Promise<TmdbMovie[]> {
  const res = await tmdbGet<TmdbList<TmdbMovie>>("/discover/movie", {
    watch_region: "FR",
    ...params,
  });
  return res.results;
}


/** Détail TMDb d'un film (durée, plateformes, trailer, casting) + notes OMDb. */
async function enrichMovie(id: number): Promise<Recommendation> {
  const detail = await tmdbGet<TmdbMovie>(`/movie/${id}`, DETAIL_PARAMS);
  const omdb = detail.imdb_id ? await omdbGetByImdbId(detail.imdb_id) : null;
  return mapTmdbMovie(detail, omdb);
}

const enrichAll = (ids: number[]) => Promise.all(ids.map(enrichMovie));

/** Enrichissement allégé (détail TMDb sans OMDb) — pour le flux veille, plus large. */
async function enrichMovieLite(id: number): Promise<Recommendation> {
  const detail = await tmdbGet<TmdbMovie>(`/movie/${id}`, DETAIL_PARAMS);
  return mapTmdbMovie(detail, null);
}
const enrichLiteAll = (ids: number[]) => Promise.all(ids.map(enrichMovieLite));

const THREE_YEARS_MS = 1000 * 60 * 60 * 24 * 365 * 3;
const HOME_COUNT = 40; // section 1 : à voir chez soi (affichés)
const CINEMA_US_COUNT = 12; // section 3 : au cinéma aux US
const US_INDIE_COUNT = 12; // section 4 : indé & auteur US
// Surplus récupéré en plus de l'affichage, pour remplacer les films "ne plus voir".
const BACKFILL = 10;

// Goûts cinéphile : drame, thriller, policier, comédie, comédie romantique (OR).
const CINEPHILE_GENRES = "18|53|80|35|10749";
// SF / action / aventure : uniquement en exception (énorme prod saluée).
const BLOCKBUSTER_GENRES = "878|28|12";
// Toujours exclus : animation, horreur.
const EXCLUDE_GENRES = "16,27";
// Distributeurs art & essai US : A24, Neon, Focus, Searchlight, IFC, Sony Classics,
// MUBI, Bleecker Street, Magnolia, Roadside Attractions, Annapurna.
// (Lionsgate volontairement exclu : trop mainstream/faith-based, pollue la sélection.)
const INDIE_COMPANIES =
  "293354|307597|10146|127929|307|302911|288516|167986|1030|911|117057";
// Pour les CLASSIQUES : mêmes distributeurs + Miramax (indé des années 90-2000).
const CLASSIC_INDIE_COMPANIES = `${INDIE_COMPANIES}|14`;
// Genres cinéphile des classiques : drame, thriller, policier, comédie, romance,
// western, mystère. Exclus : action, SF, animation, horreur.
const CLASSIC_US_GENRES = "18|53|80|35|10749|37|9648";
const CLASSIC_US_EXCLUDE = "28,878,16,27";
const CLASSICS_US_COUNT = 20;

/** Un appel discover orienté genre, trié par note (qualité d'abord). */
async function discoverByTaste(
  base: Record<string, string>,
  opts: { genres: string; voteCount: number; voteAvg: number },
): Promise<TmdbMovie[]> {
  const res = await tmdbGet<TmdbList<TmdbMovie>>("/discover/movie", {
    ...base,
    with_genres: opts.genres,
    without_genres: EXCLUDE_GENRES,
    "vote_count.gte": String(opts.voteCount),
    "vote_average.gte": String(opts.voteAvg),
    sort_by: "vote_average.desc",
  });
  return res.results;
}

/** Un appel discover restreint aux distributeurs art & essai, trié par note. */
async function discoverIndie(
  base: Record<string, string>,
  opts: { voteCount: number; voteAvg: number },
): Promise<TmdbMovie[]> {
  const res = await tmdbGet<TmdbList<TmdbMovie>>("/discover/movie", {
    ...base,
    with_companies: INDIE_COMPANIES,
    without_genres: EXCLUDE_GENRES,
    "vote_count.gte": String(opts.voteCount),
    "vote_average.gte": String(opts.voteAvg),
    sort_by: "vote_average.desc",
  });
  return res.results;
}

/**
 * Fusionne le cœur cinéphile et les blockbusters salués (max ~25 % de blockbusters),
 * puis trie par note décroissante (les meilleurs d'abord, tous genres confondus).
 */
function mergeByTaste(core: TmdbMovie[], block: TmdbMovie[], total: number): TmdbMovie[] {
  const seen = new Set<number>();
  const uniq = (arr: TmdbMovie[]) =>
    arr.filter((m) => (seen.has(m.id) ? false : seen.add(m.id)));
  const nBlock = Math.min(block.length, Math.round(total * 0.25));
  const chosenBlock = uniq(block).slice(0, nBlock);
  const chosenCore = uniq(core).slice(0, total - chosenBlock.length);
  return [...chosenCore, ...chosenBlock].sort((a, b) => b.vote_average - a.vote_average);
}

/**
 * Section 1 : à voir chez soi — dispo en FR (VOD ou streaming), < 3 ans, sorti en
 * salle. MAJORITÉ art & essai / indé / drame (distributeurs indé + genres cinéphile),
 * plus quelques gros films SF/action salués (≤ 5). Trié par note. Jusqu'à 40.
 */
async function buildAtHome(): Promise<Recommendation[]> {
  const base: Record<string, string> = {
    with_release_type: "2|3",
    "primary_release_date.gte": new Date(Date.now() - THREE_YEARS_MS).toISOString().slice(0, 10),
    "primary_release_date.lte": isoDaysAgo(0),
    watch_region: "FR",
    with_watch_monetization_types: "flatrate|rent|buy", // streaming OU VOD
  };
  const [indie, core1, core2, block] = await Promise.all([
    discoverIndie(base, { voteCount: 80, voteAvg: 6.8 }),
    discoverByTaste({ ...base, page: "1" }, { genres: CINEPHILE_GENRES, voteCount: 300, voteAvg: 7 }),
    discoverByTaste({ ...base, page: "2" }, { genres: CINEPHILE_GENRES, voteCount: 300, voteAvg: 7 }),
    discoverByTaste(base, { genres: BLOCKBUSTER_GENRES, voteCount: 3000, voteAvg: 7.6 }),
  ]);
  const seen = new Set<number>();
  const uniq = (arr: TmdbMovie[]) => arr.filter((m) => (seen.has(m.id) ? false : seen.add(m.id)));
  const arts = uniq([...indie, ...core1, ...core2]); // majorité indé/auteur/drame
  const blockPool = uniq(block);
  const nBlock = Math.min(blockPool.length, 5);
  const ids = [...arts.slice(0, HOME_COUNT + BACKFILL - nBlock), ...blockPool.slice(0, nBlock)]
    .sort((a, b) => b.vote_average - a.vote_average)
    .map((m) => m.id);
  return enrichLiteAll(ids);
}

/**
 * Section 3 : au cinéma aux États-Unis — sorties théâtrales US récentes, orientées
 * cinéphile (+ gros films SF/action salués), nouvelles productions. Source TMDb.
 */
async function buildCinemaUS(): Promise<Recommendation[]> {
  const base: Record<string, string> = {
    region: "US",
    with_release_type: "2|3",
    "release_date.gte": isoDaysAgo(150),
    "release_date.lte": isoDaysAgo(0),
  };
  const [core, block] = await Promise.all([
    // Seuil de votes bas pour capter les indés/films d'auteur (peu votés),
    // triés par note.
    discoverByTaste(base, { genres: CINEPHILE_GENRES, voteCount: 20, voteAvg: 6.5 }),
    // Blockbusters : uniquement les très gros salués (exception).
    discoverByTaste(base, { genres: BLOCKBUSTER_GENRES, voteCount: 1000, voteAvg: 7.6 }),
  ]);
  const ids = mergeByTaste(core, block, CINEMA_US_COUNT + BACKFILL + 6).map((m) => m.id);
  const enriched = await enrichLiteAll(ids);
  return enriched
    .filter((f) => f.year >= CINEMA_MIN_YEAR)
    .slice(0, CINEMA_US_COUNT + BACKFILL)
    .map((f) => ({ ...f, inTheaters: true }));
}

/**
 * Section 4 : cinéma indé & d'auteur (US) — films des distributeurs art & essai
 * (A24, Neon, Focus, Searchlight, IFC, Sony Classics), sortis ces ~3 ans, triés
 * par note. Le vivier "Landmark" (Tár, Poor Things, The Northman…) via TMDb.
 */
// Bande de popularité "indé" : ni blockbuster (trop populaire), ni téléfilm
// obscur (quasi nul), pour le complément par genre.
const INDIE_POP_MIN = 8;
const INDIE_POP_MAX = 40;

async function buildCinemaUSIndie(): Promise<Recommendation[]> {
  const base: Record<string, string> = {
    "primary_release_date.gte": isoDaysAgo(1460), // ~4 ans (l'indé sort/vote lentement)
    "primary_release_date.lte": isoDaysAgo(0),
  };
  const [byDist, byGenre] = await Promise.all([
    // Distributeurs art & essai (précis) — le cœur de la section.
    discoverIndie(base, { voteCount: 50, voteAvg: 6.5 }),
    // Complément par genre : drame/thriller/policier anglophone, bien noté.
    discoverByTaste(
      { ...base, with_original_language: "en" },
      { genres: "18|53|80", voteCount: 250, voteAvg: 7.2 },
    ),
  ]);
  // Complément : faible popularité (= indé), mais pas un téléfilm obscur.
  const indieByGenre = byGenre
    .filter((m) => m.popularity >= INDIE_POP_MIN && m.popularity <= INDIE_POP_MAX)
    .sort((a, b) => b.vote_average - a.vote_average);

  // Distributeurs d'abord (précis/prestige), puis complément genre.
  const seen = new Set<number>();
  const merged = [...byDist, ...indieByGenre].filter((m) =>
    seen.has(m.id) ? false : seen.add(m.id),
  );

  const ids = merged.slice(0, US_INDIE_COUNT + BACKFILL).map((m) => m.id);
  const enriched = await enrichLiteAll(ids);
  return enriched.slice(0, US_INDIE_COUNT + BACKFILL);
}

/* --- Sections sourcées Allociné (notes) + TMDb (métadonnées) : France, Classiques --- */

const FRANCE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30 * 36; // 36 mois
const FR_MIN_RATING = 3.9; // presse ET spectateurs, /5
const FR_MIN_VOTES = 1000; // votes spectateurs
const FRANCE_YEARS = [2026, 2025, 2024, 2023]; // couvre les 36 derniers mois

const ALLO_ROMANCE = 13024; // genre Allociné Romance
const ALLO_COMEDY = 13005; // genre Allociné Comédie (romcom incluses)
const ALLO_DRAMA = 13008; // genre Allociné Drame
const CLASSICS_MIN_YEAR = 1992; // rien de plus vieux que 1992
const CLASSICS_MAX_YEAR = new Date().getFullYear() - 2; // "classique" = > 2 ans
const CLASSIC_DECADES = [2020, 2010, 2000, 1990]; // couvre 1992 -> il y a 2 ans

/** Nettoie un titre Allociné pour matcher TMDb (retire "- Partie N", etc.). */
function cleanTitle(title: string): string {
  return title
    .replace(/\s*-\s*[Pp]artie\s+\d+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Retrouve l'id TMDb d'un film par titre (+ année). Titre nettoyé, puis repli
 * sans année si besoin (les titres Allociné diffèrent parfois de TMDb).
 */
async function searchMovieId(title: string, year: number): Promise<number | null> {
  const query = cleanTitle(title);
  const search = (withYear: boolean) =>
    tmdbGet<TmdbList<TmdbMovie>>("/search/movie", {
      query,
      ...(withYear && year ? { year: String(year) } : {}),
      region: "FR",
    });
  const withYear = await search(true);
  if (withYear.results?.[0]) return withYear.results[0].id;
  const anyYear = await search(false);
  return anyYear.results?.[0]?.id ?? null;
}

/**
 * Compose une Recommendation depuis un film noté par Allociné : métadonnées +
 * plateforme de streaming via TMDb (Allociné ne les donne pas), notes presse /
 * spectateurs d'Allociné.
 */
async function allocineToRec(opts: {
  title: string;
  year?: number;
  press: number | null;
  spectateur: number;
  votes: number;
  requireLang?: string; // langue originale attendue (ex. "fr", "en")
}): Promise<Recommendation | null> {
  const id = await searchMovieId(opts.title, opts.year ?? 0);
  if (id == null) return null;
  const detail = await tmdbGet<TmdbMovie>(`/movie/${id}`, DETAIL_PARAMS);
  // Élimine les co-productions dont la langue ne correspond pas (ex. film US
  // co-produit par la France apparaissant dans la liste "pays France").
  if (opts.requireLang && detail.original_language !== opts.requireLang) return null;
  const rec = mapTmdbMovie(detail, null);
  const scores = {
    critique: Math.round((opts.press ?? opts.spectateur) * 20), // presse, sinon spectateurs
    public: Math.round(opts.spectateur * 20),
    popularite: Math.min(100, Math.round(opts.votes / 50)),
    reputation: Math.min(100, Math.round(opts.votes / 50)),
    compatibilite: 75,
  };
  const pressTxt = opts.press != null ? `Presse ${opts.press}/5 · ` : "";
  const votesTxt = opts.votes > 0 ? ` sur ${opts.votes.toLocaleString("fr-FR")} avis` : "";
  return {
    ...rec,
    scores,
    scoreGlobal: computeScoreGlobal(scores),
    whySafe: `${pressTxt}Spectateurs ${opts.spectateur}/5${votesTxt} (Allociné).`,
  } satisfies Recommendation;
}

const CINEMA_FR_MIN_AVG = 3.5;
const CINEMA_FR_COUNT = 12;

/** Moyenne Allociné (presse + spectateurs)/5 ; spectateurs seuls si pas de presse. */
function alloAvg(f: AllocineFilm): number {
  return f.press != null && f.spectateur != null
    ? (f.press + f.spectateur) / 2
    : (f.spectateur ?? 0);
}

/**
 * Section 2 : au cinéma en France (Allociné "au cinéma"). Nouvelles productions
 * dont la moyenne presse+spectateurs > 3,5. Notes Allociné + métadonnées TMDb.
 */
async function buildCinemaFR(): Promise<Recommendation[]> {
  const seen = new Set<string>();
  const candidates = (await filmsAtCinema())
    .filter((f) => f.spectateur != null && alloAvg(f) > CINEMA_FR_MIN_AVG)
    .filter((f) => (seen.has(f.allocineId) ? false : seen.add(f.allocineId)))
    .sort((a, b) => alloAvg(b) - alloAvg(a))
    .slice(0, CINEMA_FR_COUNT + BACKFILL);

  const built = await Promise.all(
    candidates.map(async (f): Promise<Recommendation | null> => {
      const ratings = await filmRatings(f.url);
      const year = ratings?.year || f.year;
      if (!year || year < CINEMA_MIN_YEAR) return null; // nouvelles productions
      const rec = await allocineToRec({
        title: f.title,
        year,
        press: f.press,
        spectateur: f.spectateur!,
        votes: ratings?.votes ?? 0,
      });
      return rec ? { ...rec, inTheaters: true } : null;
    }),
  );

  return built
    .filter((r): r is Recommendation => r !== null)
    .slice(0, CINEMA_FR_COUNT + BACKFILL);
}

const FR_CLASSIC_COUNT = 10;
const CLASSIC_MIN_AVG = 3.9; // moyenne presse+spectateurs > 3,9 (classiques)

// Genres Allociné exclus des classiques US (goût cinéphile : ni action, ni SF…).
const CLASSIC_EXCLUDED_GENRES = [
  "action",
  "science fiction",
  "animation",
  "épouvante",
  "epouvante",
  "horreur",
  "fantastique",
];
function hasExcludedGenre(genres: string[]): boolean {
  return genres.some((g) => {
    const l = g.toLowerCase();
    return CLASSIC_EXCLUDED_GENRES.some((x) => l.includes(x));
  });
}

/**
 * Classiques d'un pays via Allociné : moyenne presse+spectateurs > 3,9, langue
 * originale vérifiée (élimine les co-productions), option d'exclusion de genres.
 * Notes Allociné + métadonnées TMDb. Surplus (buffer) pour le remplacement.
 */
async function buildClassicsFromCountry(
  country: number,
  lang: string,
  count: number,
  opts: { minYear: number; excludeGenres: boolean },
): Promise<Recommendation[]> {
  const lists = await Promise.all(CLASSIC_DECADES.map((d) => filmsByCountryDecade(country, d)));
  const seen = new Set<string>();
  const candidates = lists
    .flat()
    .filter((f) => f.press != null && f.spectateur != null)
    .filter((f) => alloAvg(f) > CLASSIC_MIN_AVG)
    .filter((f) => !opts.excludeGenres || !hasExcludedGenre(f.genres))
    .filter((f) => f.year >= opts.minYear && f.year <= CLASSICS_MAX_YEAR)
    .filter((f) => (seen.has(f.allocineId) ? false : seen.add(f.allocineId)))
    .sort((a, b) => alloAvg(b) - alloAvg(a))
    .slice(0, count + BACKFILL);

  const built = await Promise.all(
    candidates.map((f) =>
      allocineToRec({
        title: f.title,
        year: f.year,
        press: f.press,
        spectateur: f.spectateur!,
        votes: 0,
        requireLang: lang,
      }),
    ),
  );
  return built.filter((r): r is Recommendation => r !== null);
}

/** Section 5 : classiques américains (Allociné US, > 3,9, hors action/SF, ≥ 1992). */
function buildClassicsUS(): Promise<Recommendation[]> {
  return buildClassicsFromCountry(ALLO_COUNTRY_US, "en", CLASSICS_US_COUNT, {
    minYear: CLASSICS_MIN_YEAR,
    excludeGenres: true,
  });
}

/** Section 6 : classiques français (Allociné FR, > 3,9, films vraiment français). */
function buildFrenchClassics(): Promise<Recommendation[]> {
  return buildClassicsFromCountry(ALLO_COUNTRY_FR, "fr", FR_CLASSIC_COUNT, {
    minYear: 1980,
    excludeGenres: false,
  });
}

/* --- Séries --- */

// Genres TV exclus partout : animation, SF/fantastique, jeunesse, téléréalité,
// info, talk-show, feuilleton.
const SERIES_EXCLUDE = "16,10765,10762,10764,10763,10767,10766";
const SERIES_HOME_COUNT = 20;
const SERIES_FR_COUNT = 12;
const SERIES_CLASSICS_COUNT = 12;
// Genres Allociné exclus des séries (mêmes goûts : ni anim, ni SF/fantastique).
const SERIES_EXCLUDED_ALLO = ["animation", "science fiction", "fantastique", "fantasy"];

async function enrichTv(id: number): Promise<Recommendation> {
  return mapTmdbTv(await tmdbGet<TmdbTv>(`/tv/${id}`, DETAIL_PARAMS));
}
const enrichTvAll = (ids: number[]) => Promise.all(ids.map(enrichTv));

async function searchTvId(title: string): Promise<number | null> {
  const res = await tmdbGet<TmdbList<TmdbTv>>("/search/tv", { query: cleanTitle(title) });
  return res.results?.[0]?.id ?? null;
}

/** Section 1 : séries récentes à voir en streaming (FR), bien notées, hors anim/SF. */
async function buildSeriesStreaming(): Promise<Recommendation[]> {
  const params: Record<string, string> = {
    without_genres: SERIES_EXCLUDE,
    watch_region: "FR",
    with_watch_monetization_types: "flatrate",
    "first_air_date.gte": isoDaysAgo(365 * 7), // ~7 ans = "récentes"
    "vote_count.gte": "200",
    "vote_average.gte": "7.2",
    sort_by: "vote_average.desc",
  };
  const [p1, p2] = await Promise.all([
    tmdbGet<TmdbList<TmdbTv>>("/discover/tv", { ...params, page: "1" }),
    tmdbGet<TmdbList<TmdbTv>>("/discover/tv", { ...params, page: "2" }),
  ]);
  const seen = new Set<number>();
  const ids = [...p1.results, ...p2.results]
    .filter((t) => (seen.has(t.id) ? false : seen.add(t.id)))
    .slice(0, SERIES_HOME_COUNT + BACKFILL)
    .map((t) => t.id);
  return enrichTvAll(ids);
}

/** Section 2 : séries françaises (TMDb origin FR), bien notées, hors anim/SF. */
async function buildSeriesFR(): Promise<Recommendation[]> {
  const res = await tmdbGet<TmdbList<TmdbTv>>("/discover/tv", {
    with_origin_country: "FR",
    without_genres: SERIES_EXCLUDE,
    "vote_count.gte": "80",
    "vote_average.gte": "7",
    sort_by: "vote_average.desc",
  });
  const ids = res.results.slice(0, SERIES_FR_COUNT + BACKFILL).map((t) => t.id);
  return enrichTvAll(ids);
}

function hasSeriesExcludedGenre(genres: string[]): boolean {
  return genres.some((g) => {
    const l = g.toLowerCase();
    return SERIES_EXCLUDED_ALLO.some((x) => l.includes(x));
  });
}

/** Une série Allociné -> Recommendation (note presse Allociné + métadonnées TMDb). */
async function seriesToRec(f: AllocineFilm): Promise<Recommendation | null> {
  const id = await searchTvId(f.title);
  if (id == null) return null;
  const rec = mapTmdbTv(await tmdbGet<TmdbTv>(`/tv/${id}`, DETAIL_PARAMS));
  if (f.press == null) return rec;
  const scores = { ...rec.scores, critique: Math.round(f.press * 20) };
  return {
    ...rec,
    scores,
    scoreGlobal: computeScoreGlobal(scores),
    whySafe: `Presse ${f.press}/5 (Allociné) — une valeur sûre.`,
  };
}

/** Section 3 : classiques séries (Allociné "meilleures séries", hors anim/SF). */
async function buildSeriesClassics(): Promise<Recommendation[]> {
  const seen = new Set<string>();
  const candidates = (await bestSeries())
    .filter((f) => !hasSeriesExcludedGenre(f.genres))
    .filter((f) => (seen.has(f.allocineId) ? false : seen.add(f.allocineId)))
    .slice(0, SERIES_CLASSICS_COUNT + BACKFILL);
  const built = await Promise.all(candidates.map(seriesToRec));
  return built.filter((r): r is Recommendation => r !== null);
}

/* --- Livres (Google Books, éditions françaises) --- */

const BOOK_MIN_YEAR = 1990; // œuvres écrites à partir de 1990
// Catégories bannies : SF/fantasy, BD/manga, jeunesse, philosophie.
const BOOK_EXCLUDED_CATS = [
  "science fiction",
  "science-fiction",
  "fantasy",
  "fantastique",
  "comics",
  "graphic novel",
  "manga",
  "juvenile",
  "philosoph",
];
const lowerHas = (values: string[], words: string[]) =>
  values.some((v) => words.some((w) => v.toLowerCase().includes(w)));

/** Lien de recherche Kindle (Amazon ne se scrape pas, mais on peut y renvoyer). */
function kindleUrl(title: string, author?: string): string {
  const q = encodeURIComponent(`${title} ${author ?? ""}`.trim());
  return `https://www.amazon.fr/s?k=${q}&i=digital-text`;
}

function gbToRec(b: GBook): Recommendation {
  const rating = b.rating ?? 0; // /5
  const score = rating ? Math.round(rating * 20) : 72;
  const scores = {
    critique: score,
    public: score,
    popularite: 70,
    reputation: 70,
    compatibilite: 75,
  };
  return {
    id: `gbook-${b.id}`,
    category: "book",
    title: b.title,
    year: b.year,
    genres: b.categories.slice(0, 2),
    scores,
    scoreGlobal: computeScoreGlobal(scores),
    format: b.pages ? `${b.pages} pages` : "Livre",
    posterUrl: b.thumbnail,
    streaming: [{ platform: "Kindle", kind: "buy", url: kindleUrl(b.title, b.authors[0]) }],
    cast: b.authors.slice(0, 2),
    synopsis: b.description ? b.description.slice(0, 400) : "",
    whySafe: rating
      ? `Note Google Books ${rating.toFixed(1)}/5.`
      : "Sélection Google Books.",
  };
}

/** Une section de livres Google Books : FR, depuis 1990, hors genres bannis, avec couverture. */
async function buildGoogleBooks(
  query: string,
  count: number,
  startIndex = 0,
): Promise<Recommendation[]> {
  const seen = new Set<string>();
  const books = await searchGoogleBooks(query, startIndex);
  return books
    .filter((b) => b.thumbnail && b.year >= BOOK_MIN_YEAR)
    .filter((b) => !lowerHas(b.categories, BOOK_EXCLUDED_CATS))
    .filter((b) => (seen.has(b.id) ? false : seen.add(b.id)))
    .slice(0, count + BACKFILL)
    .map(gbToRec);
}

const BOOK_QUERIES = [
  { id: "books-romans", title: "Romans & littérature", query: "subject:fiction", limit: 20 },
  { id: "books-polars", title: "Polars & thrillers", query: 'subject:"roman policier"', limit: 15 },
];

export class TmdbProvider implements ContentProvider {
  async getFilmSelection(): Promise<FilmSelection> {
    // 5 sections, chacune sourcée indépendamment, en parallèle.
    const [atHome, cinemaFR, cinemaUS, cinemaUSIndie, classicsUS, classicsFR] =
      await Promise.all([
        buildAtHome(), // 1. à voir chez soi (TMDb, VOD/streaming)
        buildCinemaFR(), // 2. au cinéma en France (Allociné, moyenne > 3,5)
        buildCinemaUS(), // 3. au cinéma aux US (TMDb)
        buildCinemaUSIndie(), // 4. indé & auteur US (TMDb, distributeurs art & essai)
        buildClassicsUS(), // 5. classiques américains indé (TMDb distributeurs, >= 1992)
        buildFrenchClassics(), // 6. classiques français (Allociné, moyenne > 4)
      ]);

    const sections: FilmSection[] = [
      {
        id: "home",
        title: "À voir chez toi · VOD & streaming",
        hint: "Nouvelles productions bien notées, dispo à la maison",
        items: atHome,
        limit: HOME_COUNT,
      },
      {
        id: "cinema-fr",
        title: "Au cinéma en France",
        hint: "À l'affiche · moyenne presse & spectateurs > 3,5 (Allociné)",
        items: cinemaFR,
        limit: CINEMA_FR_COUNT,
      },
      {
        id: "cinema-us",
        title: "Au cinéma aux États-Unis",
        hint: "Sorties récentes bien notées (TMDb)",
        items: cinemaUS,
        limit: CINEMA_US_COUNT,
      },
      {
        id: "cinema-us-indie",
        title: "Cinéma indé & d'auteur (US)",
        hint: "Distributeurs art & essai (A24, Neon, Focus…) · récents",
        items: cinemaUSIndie,
        limit: US_INDIE_COUNT,
      },
      {
        id: "classics-us",
        title: "Classiques américains à (re)voir",
        hint: "Allociné · moyenne presse & spectateurs > 3,9 · hors action/SF · depuis 1992",
        items: classicsUS,
        limit: CLASSICS_US_COUNT,
      },
      {
        id: "classics-fr",
        title: "Classiques français à (re)voir",
        hint: "Allociné · moyenne presse & spectateurs > 3,9 · films français",
        items: classicsFR,
        limit: FR_CLASSIC_COUNT,
      },
    ];

    // Dédoublonnage inter-sections : un film n'apparaît qu'une fois (la 1re
    // section dans l'ordre l'emporte — ex. un film FR reste dans "France").
    const seenIds = new Set<string>();
    const deduped = sections
      .map((s) => {
        // La vitrine indé garde sa sélection complète (elle peut recouper "chez toi").
        if (s.id === "cinema-us-indie") return s;
        return {
          ...s,
          items: s.items.filter((it) => (seenIds.has(it.id) ? false : seenIds.add(it.id))),
        };
      })
      .filter((s) => s.items.length > 0);

    return { week: currentWeekLabel(), sections: deduped };
  }

  async getSeries(): Promise<FilmSelection> {
    const [streaming, french, classics] = await Promise.all([
      buildSeriesStreaming(),
      buildSeriesFR(),
      buildSeriesClassics(),
    ]);

    const sections: FilmSection[] = [
      {
        id: "series-streaming",
        title: "À voir en streaming",
        hint: "Séries récentes bien notées, dispo en France · hors animation/SF",
        items: streaming,
        limit: SERIES_HOME_COUNT,
      },
      {
        id: "series-fr",
        title: "Séries françaises",
        hint: "Production française, bien notées (TMDb)",
        items: french,
        limit: SERIES_FR_COUNT,
      },
      {
        id: "series-classics",
        title: "Classiques séries à (re)voir",
        hint: "Meilleures séries (Allociné) · note presse",
        items: classics,
        limit: SERIES_CLASSICS_COUNT,
      },
    ];

    const seenIds = new Set<string>();
    const deduped = sections
      .map((s) => ({
        ...s,
        items: s.items.filter((it) => (seenIds.has(it.id) ? false : seenIds.add(it.id))),
      }))
      .filter((s) => s.items.length > 0);

    return { week: currentWeekLabel(), sections: deduped };
  }

  async getAlbums(): Promise<FilmSelection> {
    return buildMusicSelection(currentWeekLabel());
  }

  async getBooks(): Promise<FilmSelection> {
    const built = await Promise.all(
      BOOK_QUERIES.map((q) => buildGoogleBooks(q.query, q.limit)),
    );
    const sections: FilmSection[] = BOOK_QUERIES.map((q, i) => ({
      id: q.id,
      title: q.title,
      hint: "Éditions françaises · depuis 1990 · lien Kindle (Google Books)",
      items: built[i],
      limit: q.limit,
    })).filter((s) => s.items.length > 0);

    return { week: currentWeekLabel(), sections };
  }

  /**
   * "Restock" : renvoie une page supplémentaire de films/séries pour une section,
   * quand la réserve du client s'épuise (rejets). Les sections Allociné (vivier
   * fini) renvoient [] au-delà de la 1re page.
   */
  async getMore(kind: string, sectionId: string, page: number): Promise<Recommendation[]> {
    const p = String(page);

    if (kind === "films") {
      if (sectionId === "home") {
        const core = await discoverByTaste(
          {
            with_release_type: "2|3",
            "primary_release_date.gte": new Date(Date.now() - THREE_YEARS_MS).toISOString().slice(0, 10),
            "primary_release_date.lte": isoDaysAgo(0),
            watch_region: "FR",
            with_watch_monetization_types: "flatrate|rent|buy",
            page: p,
          },
          { genres: CINEPHILE_GENRES, voteCount: 400, voteAvg: 7 },
        );
        return enrichLiteAll(core.slice(0, 20).map((m) => m.id));
      }
      if (sectionId === "cinema-us") {
        const core = await discoverByTaste(
          {
            region: "US",
            with_release_type: "2|3",
            "release_date.gte": isoDaysAgo(150),
            "release_date.lte": isoDaysAgo(0),
            page: p,
          },
          { genres: CINEPHILE_GENRES, voteCount: 20, voteAvg: 6.5 },
        );
        const enriched = await enrichLiteAll(core.slice(0, 20).map((m) => m.id));
        return enriched.filter((f) => f.year >= CINEMA_MIN_YEAR).map((f) => ({ ...f, inTheaters: true }));
      }
      if (sectionId === "cinema-us-indie") {
        const films = await discoverIndie(
          { "primary_release_date.gte": isoDaysAgo(1460), "primary_release_date.lte": isoDaysAgo(0), page: p },
          { voteCount: 20, voteAvg: 6.6 },
        );
        return enrichLiteAll(films.slice(0, 20).map((m) => m.id));
      }
      return []; // cinema-fr, classics-* : Allociné (vivier fini)
    }

    if (kind === "series") {
      const tvParams: Record<string, string> = {
        without_genres: SERIES_EXCLUDE,
        "vote_average.gte": "7",
        sort_by: "vote_average.desc",
        page: p,
      };
      if (sectionId === "series-streaming") {
        const res = await tmdbGet<TmdbList<TmdbTv>>("/discover/tv", {
          ...tvParams,
          watch_region: "FR",
          with_watch_monetization_types: "flatrate",
          "first_air_date.gte": isoDaysAgo(365 * 7),
          "vote_count.gte": "200",
          "vote_average.gte": "7.2",
        });
        return enrichTvAll(res.results.slice(0, 20).map((t) => t.id));
      }
      if (sectionId === "series-fr") {
        const res = await tmdbGet<TmdbList<TmdbTv>>("/discover/tv", {
          ...tvParams,
          with_origin_country: "FR",
          "vote_count.gte": "80",
        });
        return enrichTvAll(res.results.slice(0, 20).map((t) => t.id));
      }
      return []; // series-classics : Allociné (vivier fini)
    }

    if (kind === "books") {
      const q = BOOK_QUERIES.find((x) => x.id === sectionId);
      return q ? buildGoogleBooks(q.query, q.limit, (page - 1) * 40) : [];
    }

    if (kind === "music") {
      return getMoreMusic(sectionId, page);
    }

    return [];
  }
}
