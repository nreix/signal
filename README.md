# Signal

> **Qu'est-ce que je ne dois pas rater ?**

Application web personnelle de curation culturelle. Chaque semaine, une sélection
**ultra-filtrée** de films, séries, albums et livres qui méritent vraiment ton
temps. Pas un catalogue, pas un clone de Netflix : un filtre éditorial.

## Stack

- **Next.js 15** (App Router) + **React 19**
- **TypeScript** (strict)
- **Tailwind CSS v4**
- **Supabase** (prévu — persistance des choix « À voir » / « Pas pour moi »)
- **TMDb** (prévu — films & séries)

L'architecture est pensée pour ajouter musique et livres via de vraies API plus tard.

## Lancer le projet

```bash
npm install
cp .env.example .env.local   # facultatif en mode mock
npm run dev
```

Puis ouvre http://localhost:3000.

- `/` — la landing, le concept et le modèle de scoring.
- `/dashboard` — la sélection hebdomadaire (4 sections).

Autres scripts :

```bash
npm run build      # build de production
npm run start      # serveur de production
npm run typecheck  # vérification TypeScript sans émettre
```

## Structure

```
src/
├── app/
│   ├── layout.tsx            # layout racine + police + métadonnées
│   ├── globals.css           # palette Signal (tokens @theme Tailwind v4)
│   ├── page.tsx              # landing : concept + scoring
│   └── dashboard/page.tsx    # sélection hebdo, server component
├── components/               # UI réutilisable
│   ├── RecommendationCard.tsx  # la carte (client : boutons, décision)
│   ├── PosterImage.tsx         # poster + fallback dégradé (jamais cassé)
│   ├── ScoreRing.tsx · ScoreBar.tsx · CategoryTag.tsx
│   ├── SectionHeader.tsx · Navbar.tsx
├── lib/
│   ├── scoring.ts            # fonction de scoring (source de vérité)
│   └── format.ts             # helpers (durée, URL poster)
├── types/content.ts          # types du domaine
├── data/mocks.ts             # données mockées réalistes
└── services/
    ├── content/              # abstraction de source de données
    │   ├── provider.ts         # interface ContentProvider
    │   ├── mock-provider.ts    # impl. actuelle
    │   └── index.ts            # sélecteur (CONTENT_PROVIDER)
    └── tmdb/README.md          # guide pour brancher TMDb
```

## Modèle de scoring

Une seule fonction agrège cinq signaux (chacun 0–100) en un score global
([`src/lib/scoring.ts`](src/lib/scoring.ts)) :

```ts
scoreGlobal =
  critique     * 0.35 +
  public       * 0.25 +
  popularite   * 0.15 +
  reputation   * 0.15 +
  compatibilite* 0.10
```

Le score n'est **jamais** écrit à la main — ni dans les mocks, ni (plus tard)
dans le mapper TMDb : tout passe par `computeScoreGlobal()`. C'est ce qui rend
le filtre cohérent de bout en bout. Au-dessus de `SAFE_BET_THRESHOLD` (78), une
œuvre est étiquetée « valeur sûre » ; au-dessus de 88, « incontournable ».

## Brancher de vraies données

Le dashboard ne dépend que de l'interface `ContentProvider`. Pour passer des
mocks à TMDb sans toucher au reste de l'app, suis
[`src/services/tmdb/README.md`](src/services/tmdb/README.md) :

1. clé API + `CONTENT_PROVIDER=tmdb` dans `.env.local` ;
2. créer `client.ts`, `mapper.ts`, `tmdb-provider.ts` ;
3. décommenter le `case "tmdb"` dans `src/services/content/index.ts`.

Musique et livres suivront le même patron (un provider par source).

## Statut

MVP. Données mockées, décisions « À voir / Pas pour moi » en état local
(non persistées). Prochaines étapes : provider TMDb, persistance Supabase,
section « pépite ancienne ».
