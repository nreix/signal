import Link from "next/link";

const LINKS = [
  { href: "/films", label: "Films" },
  { href: "/series", label: "Séries" },
  // { href: "/livres", label: "Livres" }, // masqué : sources de curation à revoir
  { href: "/musique", label: "Musique" },
  { href: "/liste", label: "Ma liste" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ink/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_12px_var(--color-accent)]" />
          <span className="text-sm font-semibold uppercase tracking-[0.25em] text-bone">
            Signal
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm sm:gap-2">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-1.5 text-fog transition-colors hover:bg-card hover:text-bone"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
