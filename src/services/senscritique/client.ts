/**
 * Client SensCritique (scraping) — livres curés en français : titre, année,
 * genres, note /10, couverture, auteur. Les BD/mangas sont dans des catégories
 * séparées sur SC, donc absents des listes "livres". Défensif : échec -> [].
 */
const BASE = "https://www.senscritique.com";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// Listes curées de livres récents/qualité (slug/id stables).
const BOOK_LIST_PATHS = [
  "/top/resultats/les_meilleurs_livres_des_annees_2020/4137906",
  "/top/resultats/les_meilleurs_livres_de_2025/4009445",
  "/top/resultats/les_meilleurs_livres_de_2026/4239330",
  "/livres/tops/top111",
];

export interface ScBook {
  id: string;
  title: string;
  year: number;
  genres: string[];
  rating: number | null; // /10
  coverUrl?: string;
  author?: string;
}

function decode(s: string): string {
  return s
    .replace(/&#0*39;|&#x27;/gi, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&eacute;/g, "é")
    .trim();
}

async function getHtml(path: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9" },
      next: { revalidate: 86_400 },
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

function parseBooks(html: string): ScBook[] {
  // Couverture associée par id (le poster porte le même /livre/<slug>/<id>).
  const coverById = new Map<string, string>();
  const posterRe =
    /data-testid="poster"[^>]*href="\/livre\/[^/"]+\/(\d+)"[\s\S]{0,300}?data-srcname="([^"]+)"/g;
  for (const p of html.matchAll(posterRe)) coverById.set(p[1], p[2]);

  const titleRe =
    /data-testid="product-title"[^>]*href="\/livre\/[^/"]+\/(\d+)">([^<]+)</g;
  const books: ScBook[] = [];
  let m: RegExpExecArray | null;

  while ((m = titleRe.exec(html))) {
    const id = m[1];
    const raw = decode(m[2]);
    const yearMatch = raw.match(/\((\d{4})\)\s*$/);
    const year = yearMatch ? Number(yearMatch[1]) : 0;
    const title = raw.replace(/\s*\(\d{4}\)\s*$/, "");

    const before = html.slice(Math.max(0, m.index - 1200), m.index);
    const after = html.slice(m.index, m.index + 1000);

    // Note /10 : dernier nombre décimal avant le titre (widget de note).
    const ratings = [...before.matchAll(/>(\d{1,2}\.\d)</g)];
    const rating = ratings.length ? Number(ratings[ratings.length - 1][1]) : null;

    const genres = (after.match(/data-testid="genres">([^<]+)</)?.[1] ?? "")
      .split(",")
      .map((g) => decode(g))
      .filter(Boolean);
    // Auteur : dans le lien /contact/ du bloc "creators" (après "de ").
    const author = decode(
      after.match(/data-testid="creators"[\s\S]*?data-testid="link"[\s\S]*?<span>([^<]+)<\/span>/)?.[1] ?? "",
    );

    books.push({
      id,
      title,
      year,
      genres,
      rating,
      coverUrl: coverById.get(id),
      author: author || undefined,
    });
  }
  return books;
}

/** Agrège les listes curées, dédoublonne par id. */
export async function bookLists(): Promise<ScBook[]> {
  const pages = await Promise.all(BOOK_LIST_PATHS.map(getHtml));
  const seen = new Set<string>();
  return pages
    .flatMap((h) => (h ? parseBooks(h) : []))
    .filter((b) => (seen.has(b.id) ? false : seen.add(b.id)));
}
