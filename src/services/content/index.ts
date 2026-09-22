import type { ContentProvider } from "./provider";
import { MockProvider } from "./mock-provider";
import { TmdbProvider } from "../tmdb/tmdb-provider";

/**
 * Sélectionne le provider de contenus selon `CONTENT_PROVIDER`.
 *
 * Pour brancher TMDb plus tard :
 *   1. créer `tmdb/client.ts` (appels HTTP) + `tmdb/mapper.ts` (TMDb -> Recommendation),
 *   2. créer `TmdbProvider implements ContentProvider`,
 *   3. ajouter le `case "tmdb"` ci-dessous.
 * Le reste de l'app ne change pas.
 */
export function getContentProvider(): ContentProvider {
  const provider = process.env.CONTENT_PROVIDER ?? "mock";

  switch (provider) {
    case "tmdb":
      return new TmdbProvider();
    case "mock":
      return new MockProvider();
    default:
      return new MockProvider();
  }
}

export type { ContentProvider } from "./provider";
