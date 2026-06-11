import { Link, useRoute } from "wouter";
import { useI18n } from "@site/lib/i18n";
import { TEMPLATE_COUNT, numberWord } from "@site/lib/templateCount";
import { Seo } from "@site/lib/seo";
import { PageCTA } from "@site/components/PageCTA";
import NotFound from "@site/pages/not-found";
import {
  findCity,
  findSpecialty,
  SPECIALTIES,
  TX_CITIES,
  type SeoCity,
  type SeoSpecialty,
} from "@site/data/seoMatrix";

/**
 * /therapists/:citySlug/:specialtySlug
 *
 * Programmatic SEO page — one of 100 (20 cities × 5 specialties). The
 * route renders the same React component for every combination; the
 * `<Seo>` component emits per-page title/description/canonical and the
 * H1 + body adapt to (city, specialty, locale).
 *
 * Why "find a therapist" framing on a website-builder site:
 * the user we're trying to rank for is the *therapist* who typed
 * "[specialty] therapist website [city]" into Google. Page meets them
 * with their exact city + specialty in the H1, then pivots to "here is
 * the website you would have if you worked with us." Each combo also
 * carries a couple of stats about the city's bilingual demand so the
 * content is unique and E-E-A-T-worthy, not boilerplate.
 *
 * Slugs (city + specialty) are validated against the matrix; unknown
 * combos fall through to the marketing 404, same as `/templates/:key`.
 */

type Combo = {
  city: SeoCity;
  specialty: SeoSpecialty;
};

const REGION_LABELS: Record<SeoCity["region"], { en: string; es: string }> = {
  north: { en: "North Texas", es: "Norte de Texas" },
  central: { en: "Central Texas", es: "Centro de Texas" },
  gulf: { en: "Gulf Coast", es: "Costa del Golfo" },
  rgv: { en: "Rio Grande Valley", es: "Valle del Río Grande" },
  west: { en: "West Texas", es: "Oeste de Texas" },
  panhandle: { en: "Panhandle", es: "Panhandle" },
};

/** Returns the four most relevant other-specialty links for the same city. */
function relatedSpecialties(
  current: SeoSpecialty,
  city: SeoCity,
): { specialty: SeoSpecialty; href: string }[] {
  return SPECIALTIES.filter((s) => s.slug !== current.slug).map((s) => ({
    specialty: s,
    href: `/therapists/${city.slug}/${s.slug}`,
  }));
}

/** Returns four nearby cities for cross-linking — same region first, then by population. */
function relatedCities(
  current: SeoCity,
  specialty: SeoSpecialty,
): { city: SeoCity; href: string }[] {
  const sameRegion = TX_CITIES.filter(
    (c) => c.slug !== current.slug && c.region === current.region,
  );
  const others = TX_CITIES.filter(
    (c) => c.slug !== current.slug && c.region !== current.region,
  );
  return [...sameRegion, ...others]
    .slice(0, 4)
    .map((c) => ({ city: c, href: `/therapists/${c.slug}/${specialty.slug}` }));
}

function FindTherapistInner({ city, specialty }: Combo) {
  const { locale, t } = useI18n();
  const es = locale === "es";

  // City data labelled to the active locale — keeps the H1 / hero / FAQ
  // copy single-sourced from `seoMatrix.ts`.
  const cityName = es ? city.es : city.en;
  const specialtyName = es ? specialty.es : specialty.en;
  const specialtyHook = es ? specialty.esHook : specialty.enHook;
  const region = REGION_LABELS[city.region][es ? "es" : "en"];
  const isHispanicHeavy = city.hispanicShare >= 50;

  // SEO-friendly title — keyword-first, location second, brand last.
  const title = es
    ? `Sitio web para ${specialty.esKeyword} en ${cityName}, TX`
    : `${specialty.enKeyword.replace(/^./, (c) => c.toUpperCase())} website in ${cityName}, TX`;

  const description = es
    ? `Sitios web bilingües para terapeutas de ${specialty.es.toLowerCase()} en ${cityName}. Diseño, alojamiento, mantenimiento — todo hecho. Desde $199/mes, sin tarifa de configuración.`
    : `Bilingual websites for ${specialty.en.toLowerCase()} therapists in ${cityName}, TX. Design, hosting, upkeep — all done for you. From $199/mo, zero setup fee.`;

  // JSON-LD: Service + FAQ combined. Google understands a graph array
  // with both nodes, and the FAQ markup is what shows up as the
  // accordion in SERP.
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: title,
      description,
      serviceType: es
        ? `Sitio web para terapeutas de ${specialty.es.toLowerCase()}`
        : `Website for ${specialty.en.toLowerCase()} therapists`,
      areaServed: { "@type": "City", name: cityName, addressRegion: "TX" },
      provider: {
        "@type": "Organization",
        name: "Ashford Creative",
        url: "https://ashfordhealthcreative.com",
      },
      offers: {
        "@type": "Offer",
        priceCurrency: "USD",
        price: "199",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "199",
          priceCurrency: "USD",
          unitCode: "MON",
        },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: es
            ? `¿Cuánto cuesta un sitio web para terapeutas en ${cityName}?`
            : `How much does a therapist website in ${cityName} cost?`,
          acceptedAnswer: {
            "@type": "Answer",
            text: es
              ? `Tres planes: Boutique $199/mes, Boutique Pro $299/mes, Concierge $649/mes. Sin tarifa de configuración, gasto comercial 100% deducible.`
              : `Three plans: Boutique $199/mo, Boutique Pro $299/mo, Concierge $649/mo. Zero setup fee, 100% tax-deductible business expense.`,
          },
        },
        {
          "@type": "Question",
          name: es
            ? `¿El sitio es bilingüe inglés y español?`
            : `Is the website bilingual English and Spanish?`,
          acceptedAnswer: {
            "@type": "Answer",
            text: es
              ? `Sí. Cada sitio se entrega con versiones completas en inglés y español, traducidas por un editor humano (no Google Translate). En ${cityName}, ${city.hispanicShare}% de la población es hispana — un sitio bilingüe duplica tu audiencia local.`
              : `Yes. Every site ships with full English and Spanish versions, translated by a human editor (not Google Translate). In ${cityName}, ${city.hispanicShare}% of residents are Hispanic — a bilingual site roughly doubles your local audience.`,
          },
        },
        {
          "@type": "Question",
          name: es
            ? `¿Cuánto tiempo tarda el lanzamiento?`
            : `How long does launch take?`,
          acceptedAnswer: {
            "@type": "Answer",
            text: es
              ? `Tres días después de tu llamada de 30 minutos. Te enviamos ${numberWord(TEMPLATE_COUNT, "es")} vistas previas a las 48 horas, eliges una, pagas, y publicamos en menos de 24 horas más.`
              : `Three days after your 30-minute call. We send ${numberWord(TEMPLATE_COUNT, "en")} previews within 48 hours, you pick one, pay securely, and we publish within 24 hours after that.`,
          },
        },
        {
          "@type": "Question",
          name: es
            ? `¿Necesito comprar un dominio aparte?`
            : `Do I need to buy a separate domain?`,
          acceptedAnswer: {
            "@type": "Answer",
            text: es
              ? `No. La renovación anual del dominio (sea uno que ya tengas o uno que registremos para ti) está incluida. El dominio queda a tu nombre — si algún día nos dejas, te lo llevas.`
              : `No. Annual renewal of your web address is included — whether you bring one or we register one for you. The domain stays in your name — if you ever leave us, you take it with you.`,
          },
        },
      ],
    },
  ];

  // The "before/after" copy is what carries the conversion. Tone:
  // boutique-fancy editorial — matches the rest of the site.
  const beforeAfter = es
    ? {
        before: [
          `Estás en Psychology Today con otras ${Math.round(city.population / 50_000)} fichas de terapeuta en ${cityName}.`,
          `Tu sitio actual (si tienes uno) es inglés solamente — invisible para los ${Math.round((city.population * city.hispanicShare) / 100 / 1000)} mil residentes hispanos de tu ciudad.`,
          `Cuando te encuentran, la página tarda 6 segundos en cargar y la prueba ADA falla en contraste.`,
        ],
        after: [
          `Un sitio diseñado para terapeutas, hecho a mano — no una plantilla de Wix.`,
          `Versión española completa, redactada por una editora humana, no traducida por máquina.`,
          `Carga en menos de 1 segundo, accesibilidad WCAG 2.1 AA garantizada — un argumento legal y comercial.`,
          `Botón de crisis 988, badge de escala móvil de tarifas, prueba social local, listado en Google Business — todo incluido.`,
        ],
      }
    : {
        before: [
          `You're on Psychology Today next to ${Math.round(city.population / 50_000)} other ${cityName} therapist listings.`,
          `Your current site (if you have one) is English-only — invisible to the ${Math.round((city.population * city.hispanicShare) / 100 / 1000)}k Hispanic residents of your city.`,
          `When people do find it, the page takes 6 seconds to load and fails ADA contrast checks.`,
        ],
        after: [
          `A website designed for therapists, hand-built — not a Wix template.`,
          `Full Spanish version, written by a human editor, not machine-translated.`,
          `Loads in under 1 second, WCAG 2.1 AA accessibility guaranteed — a legal and commercial argument.`,
          `988 crisis button, sliding-scale badge, local social proof, Google Business listing — all included.`,
        ],
      };

  const related = relatedCities(city, specialty);
  const relatedSpec = relatedSpecialties(specialty, city);

  return (
    <>
      <Seo
        title={title}
        description={description}
        path={`/therapists/${city.slug}/${specialty.slug}`}
        jsonLd={jsonLd}
      />

      {/* HERO — specific keyword + specific city in the H1, both above the fold */}
      <section className="bg-ink text-cream py-24 px-6 lg:px-12">
        <div className="max-w-5xl mx-auto">
          <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-gold mb-6">
            {es
              ? `Ashford Creative · ${region}`
              : `Ashford Creative · ${region}`}
          </div>
          <h1 className="font-display text-[40px] md:text-[64px] leading-[1.05] mb-6 text-balance">
            {es
              ? `Sitios web para terapeutas de ${specialty.es.toLowerCase()} en ${cityName}.`
              : `Websites for ${specialty.en.toLowerCase()} therapists in ${cityName}.`}
          </h1>
          <p className="font-serif text-[20px] md:text-[24px] leading-[1.55] text-cream/85 max-w-3xl text-pretty mb-8">
            {specialtyHook}
          </p>
          <p className="font-mono text-[12px] tracking-[0.15em] text-cream/60 max-w-2xl">
            {es
              ? `${cityName}, TX · población ${city.population.toLocaleString("es-MX")} · ${city.hispanicShare}% hispana · 3 planes desde $199/mes · sin tarifa de configuración.`
              : `${cityName}, TX · population ${city.population.toLocaleString("en-US")} · ${city.hispanicShare}% Hispanic · 3 plans from $199/mo · zero setup fee.`}
          </p>
        </div>
      </section>

      {/* CITY-SPECIFIC CONTEXT — unique data per page, prevents thin content */}
      <section className="py-20 px-6 lg:px-12 bg-cream">
        <div className="max-w-5xl mx-auto">
          <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-sage mb-4">
            {es ? `Lo que sabemos de ${cityName}` : `What we know about ${cityName}`}
          </div>
          <h2 className="font-display text-3xl md:text-5xl text-ink mb-6 max-w-3xl leading-[1.1] text-balance">
            {es
              ? `${specialty.es} es una de las búsquedas de terapeuta más activas de ${region}.`
              : `${specialty.en} is one of ${region}'s most-searched therapy needs.`}
          </h2>
          <div className="grid md:grid-cols-3 gap-6 mt-10">
            <div className="bg-paper border border-ink/10 p-6 rounded-sm">
              <div className="font-display text-4xl text-ink mb-2">
                {city.hispanicShare}%
              </div>
              <p className="font-serif text-[15px] text-ink/75 leading-snug">
                {es
                  ? `de la población de ${cityName} es hispana — un sitio en inglés solamente ignora a casi ${Math.round(city.hispanicShare)} de cada 100 vecinos.`
                  : `of ${cityName} identifies as Hispanic — an English-only site ignores nearly ${Math.round(city.hispanicShare)} of every 100 neighbors.`}
              </p>
            </div>
            <div className="bg-paper border border-ink/10 p-6 rounded-sm">
              <div className="font-display text-4xl text-ink mb-2">
                {Math.round(city.population / 50_000)}+
              </div>
              <p className="font-serif text-[15px] text-ink/75 leading-snug">
                {es
                  ? `fichas de terapeuta competirán contigo en Psychology Today para ${cityName}. Un sitio propio rompe ese empate.`
                  : `therapist listings will compete with you on Psychology Today for ${cityName}. Your own site breaks the tie.`}
              </p>
            </div>
            <div className="bg-paper border border-ink/10 p-6 rounded-sm">
              <div className="font-display text-4xl text-ink mb-2">3 {es ? "días" : "days"}</div>
              <p className="font-serif text-[15px] text-ink/75 leading-snug">
                {es
                  ? `desde la primera llamada hasta el lanzamiento. ${numberWord(TEMPLATE_COUNT, "es").replace(/^./, c => c.toUpperCase())} vistas previas a las 48 horas, publicación 24 horas después de tu elección.`
                  : `from first call to launch. ${numberWord(TEMPLATE_COUNT, "en").replace(/^./, c => c.toUpperCase())} previews within 48 hours, publish 24 hours after you pick one.`}
              </p>
            </div>
          </div>
          {isHispanicHeavy && (
            <p className="font-mono text-[12px] text-ink/55 leading-snug max-w-3xl mt-10">
              {es
                ? `Nota local: ${cityName} es una ciudad de mayoría hispana. Recomendamos publicar la versión española como la principal, y la inglesa como alternativa — invertido respecto a la mayoría de las ciudades del estado.`
                : `Local note: ${cityName} is a Hispanic-majority city. We recommend publishing the Spanish version as the primary, with English as the alternate — the inverse of most cities in the state.`}
            </p>
          )}
        </div>
      </section>

      {/* BEFORE / AFTER — concrete contrast, no marketing fluff */}
      <section className="py-20 px-6 lg:px-12 bg-paper">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10">
          <div>
            <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-ink/55 mb-4">
              {es ? "Antes — el sitio que ya tienes" : "Before — the site you have today"}
            </div>
            <ul className="space-y-4">
              {beforeAfter.before.map((line, i) => (
                <li key={i} className="font-serif text-[17px] leading-snug text-ink/75 flex gap-3">
                  <span className="text-ink/30 font-mono text-sm pt-1">·</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-sage mb-4">
              {es ? "Después — el sitio que mereces" : "After — the site you deserve"}
            </div>
            <ul className="space-y-4">
              {beforeAfter.after.map((line, i) => (
                <li key={i} className="font-serif text-[17px] leading-snug text-ink flex gap-3">
                  <span className="text-sage font-mono text-sm pt-1">✓</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CROSS-LINKS — keeps Google crawling the matrix instead of bouncing */}
      <section className="py-20 px-6 lg:px-12 bg-cream">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10">
          <div>
            <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-sage mb-4">
              {es ? `Otras especialidades en ${cityName}` : `Other specialties in ${cityName}`}
            </div>
            <ul className="space-y-3">
              {relatedSpec.map(({ specialty: s, href }) => (
                <li key={s.slug}>
                  <Link
                    href={href}
                    className="font-serif text-[17px] text-ink hover:text-sage underline decoration-ink/20 hover:decoration-sage transition"
                  >
                    {es
                      ? `Sitios web para terapeutas de ${s.es.toLowerCase()} en ${cityName}`
                      : `${s.en} therapist websites in ${cityName}`}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-sage mb-4">
              {es
                ? `${specialty.es} en otras ciudades`
                : `${specialty.en} in other cities`}
            </div>
            <ul className="space-y-3">
              {related.map(({ city: c, href }) => (
                <li key={c.slug}>
                  <Link
                    href={href}
                    className="font-serif text-[17px] text-ink hover:text-sage underline decoration-ink/20 hover:decoration-sage transition"
                  >
                    {es
                      ? `${specialty.es} en ${c.es}, TX`
                      : `${specialty.en} in ${c.en}, TX`}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <PageCTA />
    </>
  );
}

/**
 * Route wrapper — validates :citySlug / :specialtySlug against the
 * matrix before render. Unknown combos fall through to the same
 * marketing 404 the rest of the site uses, so a typo'd long-tail URL
 * doesn't render an empty shell that Google might index.
 */
export default function FindTherapist() {
  const [match, params] = useRoute<{ citySlug: string; specialtySlug: string }>(
    "/therapists/:citySlug/:specialtySlug",
  );
  if (!match || !params) return <NotFound />;
  const city = findCity(params.citySlug);
  const specialty = findSpecialty(params.specialtySlug);
  if (!city || !specialty) return <NotFound />;
  return <FindTherapistInner city={city} specialty={specialty} />;
}
