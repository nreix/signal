/**
 * Client Allociné — SCRAPING (Allociné n'a pas d'API publique).
 *
 * Fournit les notes que TMDb n'a pas pour le cinéma français : note presse,
 * note spectateurs et nombre de votes spectateurs. Volontairement défensif :
 * tout échec/parse manquant renvoie une liste/valeur vide, jamais d'exception
 * qui casserait la page. Le HTML peut changer côté Allociné — d'où le cache
 * long et les repli silencieux.
 */
const BASE = "https://www.allocine.fr";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const MONTHS: Record<string, number> = {
  janvier: 0, février: 1, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5,
  juillet: 6, août: 7, aout: 7, septembre: 8, octobre: 9, novembre: 10,
  décembre: 11, decembre: 11,
};

export interface AllocineFilm {
  allocineId: string;
  url: string;
  title: string;
  year: number;
  releaseMs: number; // ms epoch de la date de sortie
  press: number | null; // /5
  spectateur: number | null; // /5
  genres: string[]; // genres Allociné (ex. "Thriller", "Drame")
  votes?: number; // nombre de notes spectateurs (depuis la fiche détail)
}

async function getHtml(path: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9" },
      next: { revalidate: 86_400 }, // 24h : le HTML scrapé change peu
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function decode(s: string): string {
  return s
    .replace(/&#0*39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function toNote(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseFrenchDate(raw: string): { ms: number; year: number } | null {
  const m = raw.trim().match(/(\d{1,2})\s+([a-zà-ÿ]+)\s+(\d{4})/i);
  if (!m) {
    const y = raw.match(/(\d{4})/);
    return y ? { ms: Date.UTC(Number(y[1]), 0, 1), year: Number(y[1]) } : null;
  }
  const month = MONTHS[m[2].toLowerCase()];
  if (month === undefined) return null;
  const year = Number(m[3]);
  return { ms: Date.UTC(year, month, Number(m[1])), year };
}

/** Extrait une note d'un libellé donné ("Presse" / "Spectateurs") dans un bloc. */
function extractRating(chunk: string, label: string): number | null {
  const re = new RegExp(
    `rating-title">\\s*${label}\\s*<[\\s\\S]*?stareval-note">([0-9,]+)<`,
  );
  return toNote(chunk.match(re)?.[1]);
}

/** Parse une page de listing Allociné en films (notes presse + spectateurs). */
function parseListing(html: string, kind: "film" | "serie" = "film"): AllocineFilm[] {
  const body = html.slice(Math.max(0, html.indexOf("<body")));
  const path = kind === "serie" ? "/series/ficheserie_gen_cserie" : "/film/fichefilm_gen_cfilm";
  const titleRe = new RegExp(
    `meta-title-link"\\s+href="${path}=(\\d+)\\.html">([^<]+)<`,
    "g",
  );
  const matches = [...body.matchAll(titleRe)];
  const films: AllocineFilm[] = [];

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const start = m.index ?? 0;
    const end = i + 1 < matches.length ? matches[i + 1].index ?? body.length : body.length;
    const chunk = body.slice(start, end);

    const date = chunk.match(/<span class="date">([^<]+)<\/span>/);
    const parsed = date ? parseFrenchDate(date[1]) : null;

    // Genres : dans la ligne "meta-body-info" (spans dark-grey-link).
    const info = chunk.match(/meta-body-info"[^>]*>([\s\S]*?)<\/div>/);
    const genres = info
      ? [...info[1].matchAll(/dark-grey-link[^>]*>([^<]+)</g)].map((g) => decode(g[1]))
      : [];

    films.push({
      allocineId: m[1],
      url: `${path}=${m[1]}.html`,
      title: decode(m[2]),
      year: parsed?.year ?? 0,
      releaseMs: parsed?.ms ?? 0,
      press: extractRating(chunk, "Presse"),
      spectateur: extractRating(chunk, "Spectateurs"),
      genres,
    });
  }
  return films;
}

/** Films français d'une année donnée (page 1 du listing pays=France). */
export async function frenchFilmsByYear(year: number): Promise<AllocineFilm[]> {
  const decade = Math.floor(year / 10) * 10;
  const html = await getHtml(`/films/pays-5001/decennie-${decade}/annee-${year}/`);
  return html ? parseListing(html) : [];
}

/** Films actuellement à l'affiche en France (notes presse/spectateurs inline). */
export async function filmsAtCinema(): Promise<AllocineFilm[]> {
  const html = await getHtml("/film/aucinema/");
  return html ? parseListing(html) : [];
}

/**
 * Films d'un pays (5001 = France, 5002 = USA) et d'une décennie, sur plusieurs
 * pages. Notes presse/spectateurs et genres inline.
 */
export async function filmsByCountryDecade(
  country: number,
  decade: number,
): Promise<AllocineFilm[]> {
  const pages = await Promise.all(
    [1, 2, 3].map((p) => getHtml(`/films/pays-${country}/decennie-${decade}/?page=${p}`)),
  );
  return pages.flatMap((h) => (h ? parseListing(h) : []));
}

export const ALLO_COUNTRY_FR = 5001;
export const ALLO_COUNTRY_US = 5002;

/** Meilleures séries Allociné (note presse inline ; spectateurs souvent absent). */
export async function bestSeries(): Promise<AllocineFilm[]> {
  const pages = await Promise.all(
    [1, 2].map((p) => getHtml(`/series/meilleures/?page=${p}`)),
  );
  return pages.flatMap((h) => (h ? parseListing(h, "serie") : []));
}

/** Films d'un genre et d'une décennie (notes presse/spectateurs inline). */
export async function filmsByGenreDecade(
  genreId: number,
  decade: number,
): Promise<AllocineFilm[]> {
  const html = await getHtml(`/films/genre-${genreId}/decennie-${decade}/`);
  return html ? parseListing(html) : [];
}

/** Nombre de notes spectateurs depuis la fiche (JSON-LD aggregateRating). */
export async function spectateurVotes(filmUrl: string): Promise<number | null> {
  const html = await getHtml(filmUrl);
  if (!html) return null;
  const m = html.match(/"ratingCount":\s*"([\d  .]+)"/);
  if (!m) return null;
  const n = Number(m[1].replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export interface AllocineRef {
  allocineId: string;
  url: string;
  title: string;
}

/**
 * Références (id, titre) des « meilleurs films » Allociné, déjà triés par note.
 * Optionnellement filtrés par genre (ex. 13024 = Romance, 13008 = Drame).
 * On ne lit pas les notes ici (peu fiables sur cette page) — voir `filmRatings`.
 */
export async function bestFilmRefs(genreId?: number): Promise<AllocineRef[]> {
  const path = genreId ? `/film/meilleurs/genre-${genreId}/` : "/film/meilleurs/";
  const html = await getHtml(path);
  if (!html) return [];
  const body = html.slice(Math.max(0, html.indexOf("<body")));
  const re =
    /meta-title-link"\s+href="\/film\/fichefilm_gen_cfilm=(\d+)\.html">([^<]+)</g;
  return [...body.matchAll(re)].map((m) => ({
    allocineId: m[1],
    url: `/film/fichefilm_gen_cfilm=${m[1]}.html`,
    title: decode(m[2]),
  }));
}

export interface AllocineRatings {
  press: number | null; // /5
  spectateur: number | null; // /5
  votes: number; // nombre de notes spectateurs
  year: number; // année de sortie (0 si inconnue)
}

/** Notes presse + spectateurs + nb de votes + année depuis la fiche détail. */
export async function filmRatings(filmUrl: string): Promise<AllocineRatings | null> {
  const html = await getHtml(filmUrl);
  if (!html) return null;
  const votesM = html.match(/"ratingCount":\s*"([\d  .]+)"/);
  const votes = votesM ? Number(votesM[1].replace(/[^\d]/g, "")) : 0;
  const spLd = html.match(/"ratingValue":\s*"([0-9,]+)"/);
  const spectateur = spLd ? toNote(spLd[1]) : extractRating(html, "Spectateurs");
  // L'année figure dans le <title> : "Titre - Film 1977 - AlloCiné".
  const yearM = html.match(/- Film (\d{4})/);
  return {
    press: extractRating(html, "Presse"),
    spectateur,
    votes,
    year: yearM ? Number(yearM[1]) : 0,
  };
}
