import type { FilmSelection, Recommendation } from "@/types/content";
import {
  MOCK_WEEK,
  mockAlbums,
  mockBooks,
  mockFilms,
  mockSeries,
} from "@/data/mocks";
import type { ContentProvider } from "./provider";

/** Provider par défaut : renvoie les données mockées. */
export class MockProvider implements ContentProvider {
  async getFilmSelection(): Promise<FilmSelection> {
    return {
      week: MOCK_WEEK,
      sections: [
        { id: "mock", title: "Films à voir", items: mockFilms },
      ],
    };
  }

  async getSeries(): Promise<FilmSelection> {
    return {
      week: MOCK_WEEK,
      sections: [{ id: "mock-series", title: "Séries à voir", items: mockSeries }],
    };
  }

  async getAlbums(): Promise<FilmSelection> {
    return {
      week: MOCK_WEEK,
      sections: [{ id: "mock-albums", title: "À écouter", items: mockAlbums }],
    };
  }

  async getBooks(): Promise<FilmSelection> {
    return {
      week: MOCK_WEEK,
      sections: [{ id: "mock-books", title: "Livres à lire", items: mockBooks }],
    };
  }

  async getMore(): Promise<Recommendation[]> {
    return [];
  }
}
