# Brancher TMDb (films & séries)

Ce dossier est le point d'extension prévu pour remplacer les mocks par TMDb.
Rien ici n'est encore actif : le provider par défaut reste `mock`.

## Étapes

1. **Clé API** — crée une clé sur https://www.themoviedb.org/settings/api,
   renseigne `.env.local` :

   ```
   CONTENT_PROVIDER=tmdb
   TMDB_API_KEY=xxxxxxxx
   ```

2. **Client HTTP** — crée `client.ts` :

   ```ts
   const BASE = process.env.TMDB_API_BASE_URL!;
   const KEY = process.env.TMDB_API_KEY!;

   export async function tmdbGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
     const url = new URL(`${BASE}${path}`);
     url.searchParams.set("api_key", KEY);
     url.searchParams.set("language", "fr-FR");
     for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
     const res = await fetch(url, { next: { revalidate: 3600 } });
     if (!res.ok) throw new Error(`TMDb ${res.status}`);
     return res.json();
   }
   ```

3. **Mapper** — crée `mapper.ts` qui transforme une réponse TMDb en
   `Recommendation`. Points clés :
   - `scores.critique` ← `vote_average * 10` (TMDb note sur 10).
   - `scores.public` ← agréger d'autres sources si besoin (au départ = critique).
   - `scores.popularite` ← normaliser `popularity`.
   - `scores.reputation` / `scores.compatibilite` ← heuristiques maison.
   - **Ne calcule pas `scoreGlobal` à la main** : appelle `computeScoreGlobal(scores)`.
   - `posterUrl` ← `poster_path` (déjà géré par `tmdbPoster`).
   - `streaming` ← endpoint `/movie/{id}/watch/providers`.

4. **Provider** — crée `tmdb-provider.ts` :

   ```ts
   import type { ContentProvider } from "../content/provider";
   export class TmdbProvider implements ContentProvider {
     async getWeeklySelection() {
       // ex. /trending/movie/week + /trending/tv/week, filtrés par score,
       // puis mappés. Albums/livres : garder le MockProvider en attendant.
     }
   }
   ```

5. **Activer** — décommente le `case "tmdb"` dans
   [`../content/index.ts`](../content/index.ts).

## Musique & livres plus tard

Même schéma : un provider par source (ex. Spotify, Google Books / Open Library),
chacun `implements ContentProvider` ou alimente un `CompositeProvider` qui
fusionne les catégories. Le reste de l'app ne bouge pas.
