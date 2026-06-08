import { useI18n } from "@site/lib/i18n";

/**
 * Re-usable WCAG 2.1 AA guarantee badge. Embedded on the pricing page,
 * the prospect portal, and the marketing footer (small variant).
 *
 * Editorial rule (CLAUDE.md): no technical jargon for therapist
 * audiences. The badge talks about "ADA letter" + "fix in 7 days" +
 * "we cover up to $5,000", never "WCAG 2.1 AA" or "axe-core". The
 * WCAG label is kept only on the small footer pill — it's the
 * commitment, not the audience-facing promise.
 *
 * Variants:
 *   - `default`  — full card with heading + body, for pricing & portal
 *   - `compact`  — single-line pill for footer trust row
 */
export function WcagGuaranteeBadge({
  variant = "default",
}: {
  variant?: "default" | "compact";
}) {
  const { locale } = useI18n();
  const es = locale === "es";

  if (variant === "compact") {
    return (
      <span
        className="inline-flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase"
        aria-label={
          es
            ? "Garantía ADA: corregimos en 7 días y cubrimos hasta $5,000 si recibes una demanda"
            : "ADA guarantee: we fix within 7 days and cover up to $5,000 if you receive a demand letter"
        }
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
        <span>{es ? "Garantía ADA" : "ADA guarantee"}</span>
      </span>
    );
  }

  // Default — full card variant for the Pricing page hero band.
  return (
    <div className="bg-card border border-card-border rounded-sm p-5 max-w-2xl">
      <div className="flex items-start gap-4">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          className="shrink-0 mt-1"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
        <div>
          <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-current/70 mb-2">
            {es ? "Garantía de accesibilidad" : "Accessibility guarantee"}
          </div>
          <h3 className="font-display text-xl mb-2 leading-tight">
            {es
              ? "Si recibes una demanda ADA, lo arreglamos."
              : "If you receive an ADA demand letter, we fix it."}
          </h3>
          <p className="text-sm leading-snug text-current/85">
            {es
              ? "Cada sitio se entrega conforme a WCAG 2.1 AA. Si una persona con discapacidad presenta una queja formal por accesibilidad, corregimos en 7 días y cubrimos los honorarios legales hasta $5,000."
              : "Every site ships conforming to WCAG 2.1 AA. If a person with a disability files a formal accessibility complaint, we fix it within 7 days and cover legal fees up to $5,000."}
          </p>
          <p className="text-[11px] text-current/55 mt-3 leading-snug">
            {es
              ? "Cubre demandas civiles bajo el Título III de la ADA. Excluye casos por mala fe, intento de demanda múltiple, o sitios alojados fuera de Ashford."
              : "Covers civil claims under ADA Title III. Excludes bad-faith filings, serial-litigation patterns, and sites hosted outside Ashford."}
          </p>
        </div>
      </div>
    </div>
  );
}
