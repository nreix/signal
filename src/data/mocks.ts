import type { Recommendation, ScoreInput } from "@/types/content";
import { computeScoreGlobal } from "@/lib/scoring";

/**
 * Données mockées réalistes. Le `scoreGlobal` n'est PAS écrit à la main : il est
 * dérivé des composantes via `computeScoreGlobal`, exactement comme le fera la
 * couche TMDb. C'est la même logique de bout en bout.
 */
type RawRecommendation = Omit<Recommendation, "scoreGlobal"> & { scores: ScoreInput };

function build(raw: RawRecommendation): Recommendation {
  return { ...raw, scoreGlobal: computeScoreGlobal(raw.scores) };
}

export const mockFilms: Recommendation[] = [
  build({
    id: "film-anatomie-d-une-chute",
    category: "film",
    title: "Anatomie d'une chute",
    year: 2023,
    genres: ["Drame", "Thriller judiciaire"],
    scores: { critique: 95, public: 84, popularite: 72, reputation: 90, compatibilite: 88 },
    format: "2 h 31",
    posterUrl: "/kQs6keheMwCxJxrzV83VUwFtHkB.jpg",
    accentColor: "#c2543d",
    streaming: [
      { platform: "Canal+", kind: "stream" },
      { platform: "Prime Video", kind: "rent" },
    ],
    synopsis:
      "Un homme meurt après une chute depuis le chalet familial. Sa femme, romancière, devient la principale suspecte. Le procès dissèque moins un crime qu'un couple : ses silences, ses rancunes et les versions incompatibles d'une même vie.",
    whySafe:
      "Palme d'or 2023, scénario d'une précision chirurgicale et une Sandra Hüller qui ne lâche jamais l'ambiguïté. Le genre de film dont on rediscute des jours après.",
  }),
  build({
    id: "film-oppenheimer",
    category: "film",
    title: "Oppenheimer",
    year: 2023,
    genres: ["Drame", "Histoire", "Biopic"],
    scores: { critique: 89, public: 91, popularite: 96, reputation: 92, compatibilite: 80 },
    format: "3 h 00",
    posterUrl: "/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
    accentColor: "#b9402f",
    streaming: [
      { platform: "Universal+", kind: "stream" },
      { platform: "Prime Video", kind: "buy" },
    ],
    synopsis:
      "La trajectoire de J. Robert Oppenheimer, père de la bombe atomique, de l'euphorie scientifique de Los Alamos à la culpabilité et au procès en loyauté qui l'a brisé.",
    whySafe:
      "Nolan au sommet de sa maîtrise formelle, un montage qui tient trois heures en apnée et une distribution impeccable. Sept Oscars, dont meilleur film.",
  }),
  build({
    id: "film-the-zone-of-interest",
    category: "film",
    title: "La Zone d'intérêt",
    year: 2023,
    genres: ["Drame", "Histoire"],
    scores: { critique: 93, public: 74, popularite: 64, reputation: 86, compatibilite: 70 },
    format: "1 h 45",
    posterUrl: "/8YFL5QwHbWfae6PVdRdyl9PCdgQ.jpg",
    accentColor: "#5c6e4f",
    streaming: [{ platform: "Mubi", kind: "stream" }],
    synopsis:
      "La vie domestique paisible du commandant d'Auschwitz et de sa famille, dans une maison accolée au camp. L'horreur n'est jamais montrée : elle est hors champ, dans le son, en permanence.",
    whySafe:
      "Dispositif radical et inoubliable, Grand Prix à Cannes et Oscar du meilleur film international. Une réflexion sur la banalité du mal qui marque durablement.",
  }),
];

export const mockSeries: Recommendation[] = [
  build({
    id: "series-shogun",
    category: "series",
    title: "Shōgun",
    year: 2024,
    genres: ["Drame historique", "Aventure"],
    scores: { critique: 94, public: 92, popularite: 90, reputation: 84, compatibilite: 86 },
    format: "10 épisodes · ~1 h",
    posterUrl: "/7O4iVfOMQmdCSxhOg1WnzG1AgYT.jpg",
    accentColor: "#9c3b2e",
    streaming: [{ platform: "Disney+", kind: "stream" }],
    synopsis:
      "Japon, 1600. Un navigateur anglais échoue sur des côtes en pleine lutte de pouvoir entre seigneurs féodaux. Pris dans les manœuvres d'un daimyo redoutable, il devient un pion — puis un acteur — d'un jeu politique mortel.",
    whySafe:
      "Reconstitution somptueuse, écriture politique adulte et un casting japonais enfin au premier plan. Raflé aux Emmy 2024. Du grand spectacle qui respecte son spectateur.",
  }),
  build({
    id: "series-the-bear",
    category: "series",
    title: "The Bear",
    year: 2022,
    genres: ["Comédie dramatique"],
    scores: { critique: 92, public: 88, popularite: 89, reputation: 82, compatibilite: 90 },
    format: "3 saisons · ~30 min",
    posterUrl: "/zPyMRsBJ0RB7Qabq9NjQHJtmh1m.jpg",
    accentColor: "#c0392b",
    streaming: [{ platform: "Disney+", kind: "stream" }],
    synopsis:
      "Un jeune chef étoilé revient à Chicago reprendre le sandwich-shop familial après un deuil. Entre cuisine sous pression, dettes et fantômes, il tente de transformer le chaos en quelque chose de viable.",
    whySafe:
      "Mise en scène nerveuse, sens du détail rare sur le métier de cuisinier et des personnages écrits au scalpel. Une des séries les plus primées du moment.",
  }),
  build({
    id: "series-severance",
    category: "series",
    title: "Severance",
    year: 2022,
    genres: ["Science-fiction", "Thriller psychologique"],
    scores: { critique: 91, public: 90, popularite: 85, reputation: 80, compatibilite: 87 },
    format: "2 saisons · ~50 min",
    posterUrl: "/lFf6LLrQjYldcZItzOkGmMMigP7.jpg",
    accentColor: "#2f6f8f",
    streaming: [{ platform: "Apple TV+", kind: "stream" }],
    synopsis:
      "Des employés acceptent une procédure qui scinde leur mémoire entre travail et vie privée : au bureau, ils ne savent rien de leur existence dehors, et inversement. Jusqu'à ce que l'un d'eux cherche à comprendre.",
    whySafe:
      "Concept vertigineux tenu de bout en bout, direction artistique glaçante et écriture millimétrée. Un objet de SF original comme on en voit peu.",
  }),
];

export const mockAlbums: Recommendation[] = [
  build({
    id: "album-charli-xcx-brat",
    category: "album",
    title: "BRAT",
    year: 2024,
    genres: ["Hyperpop", "Électro"],
    scores: { critique: 91, public: 86, popularite: 94, reputation: 78, compatibilite: 82 },
    format: "15 titres · 41 min",
    accentColor: "#8ace00",
    streaming: [
      { platform: "Spotify", kind: "stream" },
      { platform: "Apple Music", kind: "stream" },
    ],
    synopsis:
      "Un disque de club abrasif et confessionnel à la fois : Charli XCX y mêle euphorie nocturne et anxiété intime, et redéfinit au passage l'esthétique pop de l'année.",
    whySafe:
      "Phénomène culturel de 2024 et plébiscite critique quasi unanime. Production tranchante, écriture sans filtre : un album qui a déteint sur toute la pop.",
  }),
  build({
    id: "album-the-smile-wall-of-eyes",
    category: "album",
    title: "Wall of Eyes",
    year: 2024,
    genres: ["Art rock", "Expérimental"],
    scores: { critique: 88, public: 80, popularite: 66, reputation: 85, compatibilite: 79 },
    format: "8 titres · 43 min",
    accentColor: "#6c5ce7",
    streaming: [
      { platform: "Spotify", kind: "stream" },
      { platform: "Bandcamp", kind: "buy" },
    ],
    synopsis:
      "Le trio de Thom Yorke et Jonny Greenwood (Radiohead) prolonge ses explorations : nappes mélancoliques, rythmes brésiliens discrets et arrangements de cordes signés Greenwood.",
    whySafe:
      "Pour qui aime Radiohead, c'est une valeur sûre absolue : écriture sophistiquée, production soignée et une vraie cohérence d'album.",
  }),
  build({
    id: "album-beyonce-cowboy-carter",
    category: "album",
    title: "Cowboy Carter",
    year: 2024,
    genres: ["Country", "Pop", "Americana"],
    scores: { critique: 87, public: 83, popularite: 92, reputation: 88, compatibilite: 74 },
    format: "27 titres · 1 h 18",
    accentColor: "#c9a227",
    streaming: [
      { platform: "Spotify", kind: "stream" },
      { platform: "Apple Music", kind: "stream" },
    ],
    synopsis:
      "Beyoncé s'empare de la country et de l'americana pour en réécrire l'histoire, entre relectures, invités inattendus et revendication d'un héritage noir trop souvent effacé.",
    whySafe:
      "Album du Grammy 2025, ambition folle et exécution irréprochable. Une œuvre-concept qui dépasse largement le simple disque pop.",
  }),
];

export const mockBooks: Recommendation[] = [
  build({
    id: "book-andrea-veiller-sur-elle",
    category: "book",
    title: "Veiller sur elle",
    year: 2023,
    genres: ["Roman", "Fresque historique"],
    scores: { critique: 90, public: 89, popularite: 84, reputation: 82, compatibilite: 85 },
    format: "579 pages",
    accentColor: "#a8572c",
    streaming: [
      { platform: "Librairie", kind: "physical" },
      { platform: "Kindle", kind: "buy" },
    ],
    synopsis:
      "Dans l'Italie du XXe siècle traversée par le fascisme, l'histoire d'un sculpteur de génie au corps difforme et de son amitié indéfectible avec une aristocrate. Une fresque sur l'art, la classe et la fidélité.",
    whySafe:
      "Prix Goncourt 2023, souffle romanesque rare et plaisir de lecture immédiat. Le genre de roman ample qu'on dévore et qu'on recommande aussitôt.",
  }),
  build({
    id: "book-diaz-trust",
    category: "book",
    title: "Trust",
    year: 2022,
    genres: ["Roman", "Littérature"],
    scores: { critique: 92, public: 80, popularite: 70, reputation: 86, compatibilite: 81 },
    format: "416 pages",
    accentColor: "#3a6b6b",
    streaming: [
      { platform: "Librairie", kind: "physical" },
      { platform: "Kindle", kind: "buy" },
    ],
    synopsis:
      "Quatre récits emboîtés racontent la fortune d'un magnat de la finance new-yorkaise des années 1920 — et chacun défait la version précédente. Une enquête en abyme sur qui écrit l'Histoire et la vérité de l'argent.",
    whySafe:
      "Prix Pulitzer 2023, construction brillante et intelligence narrative jubilatoire. Un roman qui se relit autrement une fois la dernière page tournée.",
  }),
  build({
    id: "book-kingsolver-demon-copperhead",
    category: "book",
    title: "Demon Copperhead",
    year: 2022,
    genres: ["Roman", "Social"],
    scores: { critique: 91, public: 90, popularite: 78, reputation: 83, compatibilite: 80 },
    format: "560 pages",
    accentColor: "#8c5a3c",
    streaming: [
      { platform: "Librairie", kind: "physical" },
      { platform: "Kindle", kind: "buy" },
    ],
    synopsis:
      "Relecture de David Copperfield dans les Appalaches contemporaines ravagées par la crise des opioïdes : l'enfance cabossée d'un garçon né du mauvais côté de l'Amérique, raconté à la première personne, gouailleuse et vivante.",
    whySafe:
      "Prix Pulitzer 2023, voix narrative irrésistible et portrait social d'une force rare. Émouvant sans jamais tomber dans le misérabilisme.",
  }),
];

export const MOCK_WEEK = "Semaine du 16 juin 2026";
