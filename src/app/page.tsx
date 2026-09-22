import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { SCORE_WEIGHTS } from "@/lib/scoring";

const PRINCIPLES = [
  {
    title: "Pas un catalogue",
    body: "Aucune liste infinie, aucun scroll sans fin. Quelques œuvres par semaine, point. Le filtre, c'est le produit.",
  },
  {
    title: "Des valeurs sûres",
    body: "Saluées par la critique ET le public, avec une vraie réputation. On écarte le générique et l'algorithmique.",
  },
  {
    title: "Toujours argumenté",
    body: "Chaque recommandation dit pourquoi elle mérite ton temps — et pourquoi elle pourrait ne pas te plaire.",
  },
];

const WEIGHT_LABELS: Record<string, string> = {
  critique: "Critiques",
  public: "Public",
  popularite: "Popularité",
  reputation: "Réputation",
  compatibilite: "Compatibilité",
};

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-6">
        {/* Hero */}
        <section className="flex flex-col items-start gap-8 py-24 md:py-32">
          <span className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs uppercase tracking-[0.2em] text-fog">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Curation hebdomadaire
          </span>
          <h1 className="max-w-3xl font-serif text-5xl leading-[1.05] text-bone md:text-7xl">
            Qu'est-ce que je ne dois{" "}
            <span className="text-accent">pas rater</span> cette semaine ?
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-fog">
            Signal trie à ta place. Chaque semaine, une sélection courte et
            exigeante de films, séries, albums et livres qui valent vraiment ton
            temps. Pas de bruit, que du signal.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/films"
              className="rounded-md bg-accent px-6 py-3 text-sm font-semibold text-ink transition-transform hover:scale-[1.02]"
            >
              Voir la sélection de la semaine
            </Link>
            <span className="text-sm text-fog-2">
              4 catégories · 12 propositions · 0 perte de temps
            </span>
          </div>
        </section>

        {/* Principes */}
        <section className="grid gap-6 border-t border-line py-16 md:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="flex flex-col gap-3">
              <h3 className="font-serif text-xl text-bone">{p.title}</h3>
              <p className="text-sm leading-relaxed text-fog">{p.body}</p>
            </div>
          ))}
        </section>

        {/* Scoring */}
        <section className="border-t border-line py-16">
          <div className="grid gap-10 md:grid-cols-[1fr_1.2fr] md:items-center">
            <div>
              <h2 className="font-serif text-3xl text-bone">
                Un score, cinq signaux
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-fog">
                Le score global n'est pas une note de plus : c'est un agrégat
                pondéré pensé pour répondre à une seule question — est-ce que ça
                mérite ton temps ? La critique pèse le plus, la compatibilité
                ajuste à ton profil.
              </p>
            </div>
            <div className="space-y-3 rounded-lg border border-line bg-card p-6">
              {Object.entries(SCORE_WEIGHTS).map(([key, weight]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-sm text-bone">
                    {WEIGHT_LABELS[key]}
                  </span>
                  <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-accent"
                      style={{ width: `${weight * 100 * 2.857}%` }}
                    />
                  </span>
                  <span className="w-10 shrink-0 text-right text-sm font-medium tabular-nums text-fog">
                    {Math.round(weight * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-10">
        <div className="mx-auto max-w-6xl px-6 text-xs text-fog-2">
          Signal — MVP · données mockées · films & séries via TMDb à venir.
        </div>
      </footer>
    </>
  );
}
