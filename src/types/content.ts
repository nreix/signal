/**
 * Types du domaine Signal.
 *
 * Un même modèle `Recommendation` couvre les 4 catégories. Les champs spécifiques
 * (durée d'un film vs nombre de pages d'un livre) sont normalisés dans un seul
 * champ lisible `format` — la couche provider est responsable de le produire.
 */

export type Category = "film" | "series" | "album" | "book";

export const CATEGORY_LABELS: Record<Category, string> = {
  film: "Film",
  series: "Série",
  album: "Album",
  book: "Livre",
};

/**
 * Les cinq composantes du score, chacune sur une échelle 0–100.
 * Voir `lib/scoring.ts` pour la pondération.
 */
export interface ScoreInput {
  /** Note des critiques professionnels (presse, agrégateurs). */
  critique: number;
  /** Note du public (spectateurs, lecteurs, auditeurs). */
  public: number;
  /** Popularité / traction actuelle. */
  popularite: number;
  /** Réputation installée de l'œuvre ou de ses auteurs. */
  reputation: number;
  /** Compatibilité estimée avec le profil de l'utilisateur. */
  compatibilite: number;
}

export interface StreamingAvailability {
  /** Nom de la plateforme : "Netflix", "Max", "Spotify", "Librairie"... */
  platform: string;
  /** Type d'accès. */
  kind: "stream" | "rent" | "buy" | "physical";
  url?: string;
}

/**
 * Une recommandation prête à afficher. `scoreGlobal` est dérivé de `scores`
 * via `computeScoreGlobal` au moment de la construction (provider).
 */
export interface Recommendation {
  id: string;
  category: Category;
  title: string;
  year: number;
  genres: string[];

  /** Composantes brutes du score. */
  scores: ScoreInput;
  /** Score global agrégé (0–100), arrondi. */
  scoreGlobal: number;

  /** Durée ou format déjà formaté : "2 h 16", "10 épisodes", "320 pages". */
  format: string;
  /** Chemin TMDb (/t/p/...) ou URL absolue. Optionnel : fallback dégradé sinon. */
  posterUrl?: string;
  /** Couleur dominante (hex) pour le fallback et l'ambiance de la carte. */
  accentColor?: string;

  streaming: StreamingAvailability[];
  /** Réellement à l'affiche (sortie < 4 mois ou issu de now_playing). Décide
   *  l'affichage du tag « Au cinéma » quand aucune plateforme n'est dispo. */
  inTheaters?: boolean;
  /** Lien du trailer en version originale (YouTube), si disponible. */
  trailerUrl?: string;
  /** 2–3 acteurs principaux (films/séries). */
  cast?: string[];

  /** De quoi ça parle. */
  synopsis: string;
  /** Pourquoi c'est une valeur sûre. */
  whySafe: string;
}

/** Un bloc thématique de la page Films (titre + films). */
export interface FilmSection {
  id: string;
  title: string;
  hint?: string;
  /** Films fournis avec un surplus (buffer) pour remplacer les "ne plus voir". */
  items: Recommendation[];
  /** Nombre de films à afficher (les non-rejetés en tête). */
  limit?: number;
}

/** La page Films : plusieurs sections (ciné, nouveautés streaming, récents, classiques). */
export interface FilmSelection {
  week: string;
  sections: FilmSection[];
}

/** Décision utilisateur sur une carte. */
export type CardDecision = "none" | "watchlist" | "dismissed";
