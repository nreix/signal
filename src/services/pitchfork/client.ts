/**
 * Scraping léger de Pitchfork "Best New Albums" — la sélection critique de
 * référence (indé, rap, électronique, expérimental). On lit le blob
 * `window.__PRELOADED_STATE__` de la page (pas d'API) : titre, artiste, genre,
 * critique courte, pochette. Défensif : tout échec -> [].
 */
const BNA_URL = "https://pitchfork.com/reviews/best/albums/";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

export interface PfAlbum {
  title: string;
  artist: string;
  genre: string;
  blurb: string;
  image?: string;
  reviewUrl: string;
}

const strip = (s: unknown): string =>
  String(s ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, "’")
    .trim();

// Genre Pitchfork -> libellé FR (sinon on garde tel quel).
const GENRE_FR: Record<string, string> = {
  Rock: "Rock",
  Rap: "Rap",
  Electronic: "Électronique",
  "Pop/R&B": "Pop / R&B",
  Experimental: "Expérimental",
  "Folk/Country": "Folk",
  Global: "Musiques du monde",
  Jazz: "Jazz",
  Metal: "Metal",
};

export async function bestNewAlbums(page = 1): Promise<PfAlbum[]> {
  const url = page > 1 ? `${BNA_URL}?page=${page}` : BNA_URL;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const m = html.match(/window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/);
    if (!m) return [];
    const state = JSON.parse(m[1]) as {
      transformed?: { bundle?: { containers?: { items?: Record<string, unknown>[] }[] } };
    };
    const containers = state.transformed?.bundle?.containers ?? [];
    const out: PfAlbum[] = [];
    const seen = new Set<string>();
    for (const c of containers) {
      for (const it of c.items ?? []) {
        const reviewUrl = String(it.url ?? "");
        if (!reviewUrl.includes("reviews/albums/")) continue;
        const sub = it.subHed as { name?: string } | undefined;
        const artist = strip(sub?.name);
        const title = strip(it.dangerousHed);
        if (!title || !artist || seen.has(reviewUrl)) continue;
        seen.add(reviewUrl);
        const rubric = (it.rubric as { name?: string }[] | undefined)?.[0]?.name ?? "";
        const img = (it.image as { sources?: { sm?: { url?: string }; lg?: { url?: string } } } | undefined)
          ?.sources;
        out.push({
          title,
          artist,
          genre: GENRE_FR[rubric] ?? rubric ?? "Album",
          blurb: strip(it.dangerousDek),
          image: img?.sm?.url ?? img?.lg?.url,
          reviewUrl: reviewUrl.startsWith("http") ? reviewUrl : `https://pitchfork.com${reviewUrl}`,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}
