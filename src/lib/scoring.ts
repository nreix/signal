import type { ScoreInput } from "@/types/content";

/**
 * Pondération du score global. La somme des poids vaut 1.
 *
 *   scoreGlobal =
 *     critique     * 0.35 +
 *     public       * 0.25 +
 *     popularite   * 0.15 +
 *     reputation   * 0.15 +
 *     compatibilite* 0.10
 *
 * Centralisée ici pour qu'un seul endroit définisse « ce qui mérite ton temps ».
 */
export const SCORE_WEIGHTS: Record<keyof ScoreInput, number> = {
  critique: 0.35,
  public: 0.25,
  popularite: 0.15,
  reputation: 0.15,
  compatibilite: 0.1,
};

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));

/**
 * Calcule le score global (0–100, arrondi) à partir des composantes.
 * Chaque composante est bornée à [0, 100] avant pondération.
 */
export function computeScoreGlobal(scores: ScoreInput): number {
  const weighted =
    clamp(scores.critique) * SCORE_WEIGHTS.critique +
    clamp(scores.public) * SCORE_WEIGHTS.public +
    clamp(scores.popularite) * SCORE_WEIGHTS.popularite +
    clamp(scores.reputation) * SCORE_WEIGHTS.reputation +
    clamp(scores.compatibilite) * SCORE_WEIGHTS.compatibilite;

  return Math.round(weighted);
}

/**
 * Verdict éditorial dérivé du score global — sert de garde-fou : Signal ne
 * montre que des contenus au-dessus d'un certain seuil de confiance.
 */
export type Verdict = "incontournable" | "valeur-sure" | "a-considerer";

export const SAFE_BET_THRESHOLD = 78;

export function verdictFromScore(scoreGlobal: number): Verdict {
  if (scoreGlobal >= 88) return "incontournable";
  if (scoreGlobal >= SAFE_BET_THRESHOLD) return "valeur-sure";
  return "a-considerer";
}

export const VERDICT_LABELS: Record<Verdict, string> = {
  incontournable: "Incontournable",
  "valeur-sure": "Valeur sûre",
  "a-considerer": "À considérer",
};
