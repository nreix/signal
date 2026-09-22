import type { FilmSelection, Recommendation } from "@/types/content";

/**
 * Contrat unique pour toute source de contenus, une méthode par page.
 *
 * Aujourd'hui : `MockProvider` (tout mocké) et `TmdbProvider` (films/séries réels
 * via TMDb+OMDb, musique/livres mockés). La page ne dépend QUE de cette interface.
 */
export interface ContentProvider {
  /** Page Films : sections ciné / nouveautés streaming / récents / classiques. */
  getFilmSelection(): Promise<FilmSelection>;
  /** Page Séries : sections streaming / françaises / classiques. */
  getSeries(): Promise<FilmSelection>;
  /** Page Musique : sections derniers albums / derniers titres / playlists (Spotify). */
  getAlbums(): Promise<FilmSelection>;
  /** Page Livres : sections romans / polars / classiques (Open Library). */
  getBooks(): Promise<FilmSelection>;
  /** Page suivante d'une section (restock quand la réserve s'épuise). */
  getMore(kind: string, sectionId: string, page: number): Promise<Recommendation[]>;
}
