import { Link } from "wouter";
import { useI18n } from "@site/lib/i18n";
import { Seo } from "@site/lib/seo";
import { PageCTA } from "@site/components/PageCTA";
import { TX_CITIES, SPECIALTIES } from "@site/data/seoMatrix";

/**
 * /therapists — the hub page that lists every city × specialty
 * combination in the SEO matrix. Two jobs:
 *
 *   1. Internal-linking surface so Googlebot can crawl all 100 combos
 *      from one well-linked page.
 *   2. Standalone landing for the generic "Texas therapist website"
 *      head-term, which is broader than any single city page.
 *
 * The page itself is intentionally text-heavy and link-dense — that's
 * what a hub page does. Conversion happens on the per-combo deep pages
 * and via the shared <PageCTA /> footer block.
 */
export default function FindTherapistIndex() {
  const { locale } = useI18n();
  const es = locale === "es";

  const title = es
    ? "Sitios web para terapeutas — Texas (todas las ciudades)"
    : "Therapist websites — Texas (every city)";

  const description = es
    ? "Sitios web bilingües, hechos a mano, para terapeutas en 20 ciudades de Texas y 5 especialidades — Boutique desde $199/mes, sin tarifa de configuración."
    : "Hand-built, bilingual websites for therapists across 20 Texas cities and 5 specialties — Boutique from $199/mo, zero setup fee.";

  return (
    <>
      <Seo
        title={title}
        description={description}
        path="/therapists"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: title,
          description,
          url: "https://ashfordcreative.org/therapists",
          numberOfItems: TX_CITIES.length * SPECIALTIES.length,
        }}
      />

      {/* HERO */}
      <section className="bg-ink text-cream py-24 px-6 lg:px-12">
        <div className="max-w-5xl mx-auto">
          <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-gold mb-6">
            {es ? "Cobertura · todo Texas" : "Coverage · all of Texas"}
          </div>
          <h1 className="font-display text-[40px] md:text-[64px] leading-[1.05] mb-6 text-balance">
            {es
              ? "Sitios web para terapeutas — en cada ciudad importante de Texas."
              : "Therapist websites — in every Texas city that matters."}
          </h1>
          <p className="font-serif text-[20px] md:text-[24px] leading-[1.55] text-cream/85 max-w-3xl text-pretty">
            {es
              ? "Veinte ciudades. Cinco especialidades. Versiones bilingües completas. Tres planes desde $199 al mes."
              : "Twenty cities. Five specialties. Full bilingual versions. Three plans from $199 a month."}
          </p>
        </div>
      </section>

      {/* CITY × SPECIALTY MATRIX — internal-linking grid */}
      <section className="py-20 px-6 lg:px-12 bg-cream">
        <div className="max-w-6xl mx-auto">
          <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-sage mb-4">
            {es ? "Encuentra tu ciudad" : "Find your city"}
          </div>
          <h2 className="font-display text-3xl md:text-4xl text-ink mb-12 max-w-3xl leading-[1.1] text-balance">
            {es
              ? "Cada ciudad de Texas tiene su propia página, con datos locales y enlaces cruzados."
              : "Every Texas city has its own page, with local data and cross-links."}
          </h2>

          <div className="space-y-12">
            {TX_CITIES.map((city) => (
              <div key={city.slug} className="border-l-2 border-sage/40 pl-6">
                <div className="flex flex-wrap items-baseline gap-4 mb-4">
                  <h3 className="font-display text-2xl text-ink">
                    {es ? city.es : city.en}
                  </h3>
                  <span className="font-mono text-[11px] tracking-[0.15em] text-ink/55">
                    {es
                      ? `${city.population.toLocaleString("es-MX")} hab · ${city.hispanicShare}% hispana`
                      : `${city.population.toLocaleString("en-US")} pop · ${city.hispanicShare}% Hispanic`}
                  </span>
                </div>
                <ul className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {SPECIALTIES.map((s) => (
                    <li key={s.slug}>
                      <Link
                        href={`/therapists/${city.slug}/${s.slug}`}
                        className="font-serif text-[15px] text-ink hover:text-sage underline decoration-ink/20 hover:decoration-sage transition"
                      >
                        {es
                          ? `${s.es} en ${city.es}`
                          : `${s.en} in ${city.en}`}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PageCTA />
    </>
  );
}
