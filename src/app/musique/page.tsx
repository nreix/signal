import { Navbar } from "@/components/Navbar";
import { PageHeader } from "@/components/PageHeader";
import { SectionHeader } from "@/components/SectionHeader";
import { CardGrid } from "@/components/CardGrid";
import { getContentProvider } from "@/services/content";

export const metadata = {
  title: "Musique — Signal",
};

// ISR : page régénérée en arrière-plan toutes les heures (comme films/séries),
// servie depuis le cache CDN — pas de rendu lourd à chaque visite.
export const revalidate = 3600;

export default async function MusiquePage() {
  const selection = await getContentProvider().getAlbums();

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <PageHeader
          eyebrow={selection.week}
          title="Musique"
          intro="Les albums encensés par la critique et les dernières sorties dans tes genres — indé, rock alternatif, rap FR & hip-hop underground, house, bouyon, reggae. Rien de commercial."
        />

        {selection.sections.length === 0 ? (
          <p className="text-sm text-fog">
            Aucune sortie récupérée. Vérifie les clés Spotify (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET).
          </p>
        ) : (
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
                  kind="music"
                />
              </section>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-line py-10">
        <div className="mx-auto max-w-6xl px-6 text-xs text-fog-2">
          Sélection critique via Pitchfork · découverte par genre & écoute via Spotify.
        </div>
      </footer>
    </>
  );
}
