import { useI18n } from "@site/lib/i18n";
import { TEMPLATE_COUNT, numberWord } from "@site/lib/templateCount";

/**
 * LOT 3.B7 — /compared route. Placeholder coming-soon page; the full
 * comparison story ships in LOT 8 Phase 4.
 */
export default function ComparedPage() {
  const { locale } = useI18n();
  const isEs = locale === "es";
  return (
    <div className="min-h-[60vh] px-6 py-20 max-w-3xl mx-auto text-center">
      <div className="font-mono text-[11px] uppercase tracking-widest text-gold mb-3">
        {isEs ? "Comparación" : "Comparison"}
      </div>
      <h1 className="font-display text-3xl md:text-5xl text-ink mb-4">
        {isEs
          ? "Próximamente — cómo nos comparamos."
          : "Coming soon — how we compare."}
      </h1>
      <p className="font-serif text-[19px] text-ink/80 leading-[1.55]">
        {isEs
          ? `Una mirada honesta lado a lado con otros proveedores. Estará lista pronto. Mientras tanto, explora nuestros ${numberWord(TEMPLATE_COUNT, "es")} diseños y los tres niveles en /templates y /pricing.`
          : `An honest side-by-side with the other providers. We're putting it together. In the meantime, browse our ${numberWord(TEMPLATE_COUNT, "en")} designs and three tiers at /templates and /pricing.`}
      </p>
    </div>
  );
}
