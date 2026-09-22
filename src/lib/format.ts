/** Petits helpers de formatage, isolés pour rester réutilisables. */

/** 136 -> "2 h 16". */
export function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/** Construit l'URL d'un poster TMDb à partir d'un chemin "/abc.jpg". */
export function tmdbPoster(path: string | undefined, size = "w500"): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  const base = process.env.TMDB_IMAGE_BASE_URL ?? "https://image.tmdb.org/t/p";
  return `${base}/${size}${path}`;
}
