import { Navbar } from "@/components/Navbar";
import { PageHeader } from "@/components/PageHeader";
import { SectionHeader } from "@/components/SectionHeader";
import { CardGrid } from "@/components/CardGrid";
import { getContentProvider } from "@/services/content";

export const metadata = {
  title: "Séries — Signal",
};

export default async function SeriesPage() {
  const selection = await getContentProvider().getSeries();

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <PageHeader
          eyebrow={selection.week}
          title="Séries"
          intro="À voir en streaming, les séries françaises, et les classiques à rattraper. Sans animation ni SF/fantastique."
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
                kind="series"
              />
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-line py-10">
        <div className="mx-auto max-w-6xl px-6 text-xs text-fog-2">
          Séries via TMDb · classiques & note presse via Allociné · animation & SF/fantastique exclus.
        </div>
      </footer>
    </>
  );
}
