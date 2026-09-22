"use client";

import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { PageHeader } from "@/components/PageHeader";
import { SectionHeader } from "@/components/SectionHeader";
import { CardGrid } from "@/components/CardGrid";
import { useDecisions } from "@/lib/decisions";

export default function ListePage() {
  const { ready, watchlist } = useDecisions();

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <PageHeader
          eyebrow="Ma sélection"
          title="Ma liste"
          intro="Les films et séries que tu as gardés pour plus tard. Enregistrés sur cet appareil."
        />

        {!ready ? (
          <p className="text-sm text-fog">Chargement…</p>
        ) : watchlist.length === 0 ? (
          <div className="rounded-lg border border-line bg-card p-10 text-center">
            <p className="text-bone">Ta liste est vide.</p>
            <p className="mt-2 text-sm text-fog">
              Parcours les{" "}
              <Link href="/films" className="text-accent-2 hover:text-accent">
                films
              </Link>{" "}
              et clique sur « Oui, je veux le voir » pour les retrouver ici.
            </p>
          </div>
        ) : (
          <>
            <SectionHeader title="À voir" count={watchlist.length} />
            <CardGrid items={watchlist} />
          </>
        )}
      </main>

      <footer className="border-t border-line py-10">
        <div className="mx-auto max-w-6xl px-6 text-xs text-fog-2">
          Liste enregistrée localement (localStorage) — persistance Supabase à venir.
        </div>
      </footer>
    </>
  );
}
