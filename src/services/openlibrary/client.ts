/**
 * Client Open Library — livres gratuits, sans clé : couvertures, notes lecteurs,
 * auteurs, résumé (first_sentence). Couverture : covers.openlibrary.org/b/id/<id>.
 */
export interface OpenLibraryBook {
  key: string;
  title: string;
  authors: string[];
  year: number;
  coverId?: number;
  ratingAvg?: number; // /5
  ratingCount: number;
  pages?: number;
  firstSentence?: string;
  subjects: string[];
}

/**
 * Recherche de livres par sujet. On restreint aux éditions anglaises (Open Library
 * n'a quasi rien en français), aux œuvres écrites à partir de 1990, triées par note.
 */
export async function searchBooks(
  subject: string,
  page = 1,
  limit = 100,
): Promise<OpenLibraryBook[]> {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set(
    "q",
    `subject:"${subject}" language:eng first_publish_year:[1990 TO 2030]`,
  );
  url.searchParams.set("sort", "rating");
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(limit));
  url.searchParams.set(
    "fields",
    "key,title,author_name,first_publish_year,cover_i,ratings_average,ratings_count,number_of_pages_median,first_sentence,subject",
  );

  // Open Library est parfois capricieux (réponses vides ponctuelles) : on retente.
  let docs: Record<string, unknown>[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { next: { revalidate: 86_400 } });
      if (res.ok) {
        const j = (await res.json()) as { docs?: Record<string, unknown>[] };
        docs = j.docs ?? [];
        if (docs.length > 0) break;
      }
    } catch {
      /* on retente */
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  return docs.map((d) => ({
      key: String(d.key ?? ""),
      title: String(d.title ?? "Sans titre"),
      authors: (d.author_name as string[]) ?? [],
      year: (d.first_publish_year as number) ?? 0,
      coverId: d.cover_i as number | undefined,
      ratingAvg: d.ratings_average as number | undefined,
      ratingCount: (d.ratings_count as number) ?? 0,
      pages: d.number_of_pages_median as number | undefined,
      firstSentence: Array.isArray(d.first_sentence)
        ? (d.first_sentence[0] as string)
        : (d.first_sentence as string | undefined),
      subjects: (d.subject as string[]) ?? [],
    }));
}
