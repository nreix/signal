/**
 * Client Google Books — nécessite une clé (GOOGLE_BOOKS_API_KEY) : sans clé, le
 * quota anonyme est nul. Fournit éditions françaises, couvertures, catégories,
 * résumé, note. Sans clé -> [] (page vide).
 */
export interface GBook {
  id: string;
  title: string;
  authors: string[];
  year: number;
  categories: string[];
  description?: string;
  thumbnail?: string;
  rating?: number; // /5
  ratingsCount: number;
  pages?: number;
}

export async function searchGoogleBooks(
  query: string,
  startIndex = 0,
): Promise<GBook[]> {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (!key) return [];

  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", query);
  url.searchParams.set("key", key);
  url.searchParams.set("langRestrict", "fr");
  url.searchParams.set("country", "FR");
  url.searchParams.set("orderBy", "relevance");
  url.searchParams.set("printType", "books");
  url.searchParams.set("maxResults", "40");
  url.searchParams.set("startIndex", String(startIndex));

  try {
    const res = await fetch(url, { next: { revalidate: 86_400 } });
    if (!res.ok) return [];
    const j = (await res.json()) as { items?: Record<string, unknown>[] };
    return (j.items ?? []).map((it) => {
      const v = (it.volumeInfo ?? {}) as Record<string, unknown>;
      const images = (v.imageLinks ?? {}) as Record<string, string>;
      const thumb = images.thumbnail || images.smallThumbnail;
      const desc = typeof v.description === "string" ? v.description : undefined;
      return {
        id: String(it.id ?? ""),
        title: String(v.title ?? "Sans titre"),
        authors: (v.authors as string[]) ?? [],
        year: v.publishedDate ? Number(String(v.publishedDate).slice(0, 4)) : 0,
        categories: (v.categories as string[]) ?? [],
        description: desc ? desc.replace(/<[^>]+>/g, "").trim() : undefined,
        thumbnail: thumb ? thumb.replace(/^http:/, "https:") : undefined,
        rating: v.averageRating as number | undefined,
        ratingsCount: (v.ratingsCount as number) ?? 0,
        pages: v.pageCount as number | undefined,
      };
    });
  } catch {
    return [];
  }
}
