import { Navbar } from "@/components/Navbar";
import { PageHeader } from "@/components/PageHeader";
import { SectionHeader } from "@/components/SectionHeader";
import { CardGrid } from "@/components/CardGrid";
import { getContentProvider } from "@/services/content";

export const metadata = {
  title: "Films — Signal",
};

export default async function FilmsPage() {
  const selection = await getContentProvider().getFilmSelection();

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <PageHeader
          eyebrow={selection.week}
          title="Films"
          intro="Ce qu'il faut voir cette semaine : en salle, les nouveautés des plateformes, les récents qui valent le coup et les classiques à ne pas avoir manqués."
        />

        <div className="space-y-16">
          {selection.sections.map((section) => (
            <section key={section.id}>
              <SectionHeader
                title={section.title}
                count={Math.min(section.items.length, section.limit ?? section.items.length)}
                hint={section.hint}
              />
              <CardGrid
                items={section.items}
                limit={section.limit}
                sectionId={section.id}
                kind="films"
              />
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-line py-10">
        <div className="mx-auto max-w-6xl px-6 text-xs text-fog-2">
          Sources : TMDb (métadonnées, VOD/streaming, sorties US) · Allociné (au cinéma en France, notes presse & spectateurs, classiques français) · genre horreur exclu.
        </div>
      </footer>
    </>
  );
}
