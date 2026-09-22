"use client";

/**
 * Décisions utilisateur (watchlist + "ne plus voir").
 *
 * - Source durable : Supabase (via /api/decisions), synchronisée entre appareils.
 * - Cache instantané : localStorage (affichage immédiat, pas de clignotement).
 *
 * Chaque action met à jour localStorage tout de suite PUIS persiste dans Supabase.
 * Au montage, on fusionne serveur + local (aucune perte) et on renvoie les
 * éléments locaux non encore en base vers le serveur.
 */
import { useEffect, useState } from "react";
import type { Recommendation } from "@/types/content";

const WATCH_KEY = "signal:watchlist";
const DISMISS_KEY = "signal:dismissed";
const EVENT = "signal:decisions";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* quota / mode privé : on ignore */
  }
}

/** Persiste une opération dans Supabase (fire-and-forget). */
function persist(body: Record<string, unknown>): void {
  void fetch("/api/decisions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export function getWatchlist(): Recommendation[] {
  return read<Recommendation[]>(WATCH_KEY, []);
}
export function getDismissed(): string[] {
  return read<string[]>(DISMISS_KEY, []);
}

/** "Je veux le voir" : ajoute à la liste, retire des "ne plus voir". */
export function saveToWatchlist(item: Recommendation): void {
  const list = getWatchlist();
  if (!list.some((x) => x.id === item.id)) write(WATCH_KEY, [...list, item]);
  const dismissed = getDismissed();
  if (dismissed.includes(item.id))
    write(DISMISS_KEY, dismissed.filter((id) => id !== item.id));
  persist({ op: "save", item });
}

export function removeFromWatchlist(id: string): void {
  write(WATCH_KEY, getWatchlist().filter((x) => x.id !== id));
  persist({ op: "delete", id });
}

/** "Ne plus voir" : masque le film partout et le retire de la liste. */
export function dismissFilm(id: string): void {
  const dismissed = getDismissed();
  if (!dismissed.includes(id)) write(DISMISS_KEY, [...dismissed, id]);
  write(WATCH_KEY, getWatchlist().filter((x) => x.id !== id));
  persist({ op: "dismiss", id });
}

export function restoreFilm(id: string): void {
  write(DISMISS_KEY, getDismissed().filter((x) => x !== id));
  persist({ op: "delete", id });
}

/** Fusionne l'état serveur avec le cache local, sans rien perdre. */
async function syncFromServer(): Promise<void> {
  try {
    const res = await fetch("/api/decisions");
    if (!res.ok) return;
    const server = (await res.json()) as {
      watchlist?: Recommendation[];
      dismissedIds?: string[];
    };
    const serverW = server.watchlist ?? [];
    const serverD = server.dismissedIds ?? [];

    // Union serveur + local. Le "ne plus voir" l'emporte (exclusivité).
    const dSet = new Set<string>([...serverD, ...getDismissed()]);
    const wMap = new Map<string, Recommendation>();
    for (const x of [...serverW, ...getWatchlist()]) {
      if (!dSet.has(x.id)) wMap.set(x.id, x);
    }
    const mergedW = [...wMap.values()];
    const mergedD = [...dSet];

    write(WATCH_KEY, mergedW);
    write(DISMISS_KEY, mergedD);

    // Renvoie vers Supabase ce qui n'y était pas encore (1re connexion, offline…).
    const serverWIds = new Set(serverW.map((x) => x.id));
    const serverDIds = new Set(serverD);
    for (const item of mergedW) if (!serverWIds.has(item.id)) persist({ op: "save", item });
    for (const id of mergedD) if (!serverDIds.has(id)) persist({ op: "dismiss", id });
  } catch {
    /* hors-ligne : on garde le cache local */
  }
}

/**
 * Hook réactif. `ready` reste false au 1er rendu (SSR + hydratation) pour éviter
 * tout mismatch : les décisions ne s'appliquent qu'après le montage client.
 */
export function useDecisions() {
  const [ready, setReady] = useState(false);
  const [watchlist, setWatchlist] = useState<Recommendation[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => {
      setWatchlist(getWatchlist());
      setDismissedIds(getDismissed());
      setReady(true);
    };
    sync(); // instantané depuis le cache local
    void syncFromServer(); // puis fusion avec Supabase (déclenche l'event -> sync)
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return { ready, watchlist, dismissedIds };
}
