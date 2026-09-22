/** En-tête éditorial commun aux pages de catégorie. */
export function PageHeader({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro: string;
}) {
  return (
    <header className="mb-12 border-b border-line pb-8">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-2">
        {eyebrow}
      </p>
      <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight text-bone md:text-5xl">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-fog">{intro}</p>
    </header>
  );
}
