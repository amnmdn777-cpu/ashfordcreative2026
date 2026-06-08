/**
 * SEO programmatic-pages matrix — 20 Texas cities × 5 therapist
 * specialties × 2 languages = 200 indexable URLs that target long-tail
 * "[specialty] therapist [city] TX" / "terapeuta [especialidad]
 * [ciudad]" intent searches.
 *
 * Each city carries population + Hispanic-share data so the rendered
 * page can show real local stats (boosts E-E-A-T) and so we can rank
 * cities for content tone (border / Rio Grande Valley cities lean ES,
 * North TX leans EN).
 *
 * Each specialty carries the canonical EN + ES keyword we're trying to
 * rank for, plus a one-line description that flows into the page body.
 *
 * The page itself lives at `src/pages/FindTherapist.tsx` and uses
 * `useI18n()` so a single component renders both EN and ES — the
 * hreflang alternates emitted by `<Seo>` let Google index both halves.
 */

export type SeoCity = {
  /** URL-safe slug — used in route + sitemap. Stable forever. */
  slug: string;
  /** Display name in English (rendered on EN locale). */
  en: string;
  /** Display name in Spanish (rendered on ES locale). */
  es: string;
  /** City population (latest US Census estimate). */
  population: number;
  /** % of population identifying as Hispanic/Latino (US Census). */
  hispanicShare: number;
  /** Texas region — used to group cities in copy ("Rio Grande Valley", "North Texas"). */
  region: "north" | "central" | "gulf" | "rgv" | "west" | "panhandle";
};

export type SeoSpecialty = {
  slug: string;
  en: string;
  es: string;
  /** Lower-case keyword we're trying to rank for in EN. */
  enKeyword: string;
  /** Lower-case keyword we're trying to rank for in ES. */
  esKeyword: string;
  /** One-line description rendered under the H1. EN. */
  enHook: string;
  /** One-line description rendered under the H1. ES. */
  esHook: string;
};

// 20 Texas cities, ranked by therapist-demand × Hispanic relevance.
// Order matters: it's the order we list them on the index / hub page.
export const TX_CITIES: readonly SeoCity[] = [
  { slug: "houston", en: "Houston", es: "Houston", population: 2_302_000, hispanicShare: 45.4, region: "gulf" },
  { slug: "san-antonio", en: "San Antonio", es: "San Antonio", population: 1_495_000, hispanicShare: 64.0, region: "central" },
  { slug: "dallas", en: "Dallas", es: "Dallas", population: 1_304_000, hispanicShare: 41.4, region: "north" },
  { slug: "austin", en: "Austin", es: "Austin", population: 974_000, hispanicShare: 32.5, region: "central" },
  { slug: "fort-worth", en: "Fort Worth", es: "Fort Worth", population: 956_000, hispanicShare: 35.8, region: "north" },
  { slug: "el-paso", en: "El Paso", es: "El Paso", population: 678_000, hispanicShare: 81.4, region: "west" },
  { slug: "arlington", en: "Arlington", es: "Arlington", population: 394_000, hispanicShare: 30.9, region: "north" },
  { slug: "corpus-christi", en: "Corpus Christi", es: "Corpus Christi", population: 317_000, hispanicShare: 63.2, region: "gulf" },
  { slug: "plano", en: "Plano", es: "Plano", population: 287_000, hispanicShare: 16.6, region: "north" },
  { slug: "lubbock", en: "Lubbock", es: "Lubbock", population: 257_000, hispanicShare: 35.7, region: "panhandle" },
  { slug: "laredo", en: "Laredo", es: "Laredo", population: 256_000, hispanicShare: 95.6, region: "rgv" },
  { slug: "garland", en: "Garland", es: "Garland", population: 244_000, hispanicShare: 39.2, region: "north" },
  { slug: "irving", en: "Irving", es: "Irving", population: 239_000, hispanicShare: 41.6, region: "north" },
  { slug: "frisco", en: "Frisco", es: "Frisco", population: 219_000, hispanicShare: 14.6, region: "north" },
  { slug: "mckinney", en: "McKinney", es: "McKinney", population: 207_000, hispanicShare: 19.6, region: "north" },
  { slug: "amarillo", en: "Amarillo", es: "Amarillo", population: 200_000, hispanicShare: 30.7, region: "panhandle" },
  { slug: "grand-prairie", en: "Grand Prairie", es: "Grand Prairie", population: 196_000, hispanicShare: 47.7, region: "north" },
  { slug: "brownsville", en: "Brownsville", es: "Brownsville", population: 186_000, hispanicShare: 93.7, region: "rgv" },
  { slug: "pasadena", en: "Pasadena", es: "Pasadena", population: 151_000, hispanicShare: 65.0, region: "gulf" },
  { slug: "mcallen", en: "McAllen", es: "McAllen", population: 144_000, hispanicShare: 84.6, region: "rgv" },
] as const;

// 5 specialties — chosen for therapist-website demand × differentiated
// long-tail keywords. Each EN slug has a matching ES slug so a Spanish
// page lives at /therapists/houston/ansiedad and an English one at
// /therapists/houston/anxiety. The slug field stays in English so the
// URL is stable across locales; the rendered H1 swaps with the locale.
export const SPECIALTIES: readonly SeoSpecialty[] = [
  {
    slug: "anxiety",
    en: "Anxiety",
    es: "Ansiedad",
    enKeyword: "anxiety therapist",
    esKeyword: "terapeuta de ansiedad",
    enHook: "A calm, bilingual website that helps anxious clients reach you — not bounce.",
    esHook: "Un sitio bilingüe y sereno que ayuda a los clientes con ansiedad a contactarte — no a irse.",
  },
  {
    slug: "couples",
    en: "Couples",
    es: "Parejas",
    enKeyword: "couples therapist",
    esKeyword: "terapeuta de parejas",
    enHook: "A warm, two-name-friendly website that makes both partners feel welcome before the first session.",
    esHook: "Un sitio cálido, hecho para dos nombres, donde ambos miembros de la pareja se sienten bienvenidos antes de la primera sesión.",
  },
  {
    slug: "depression",
    en: "Depression",
    es: "Depresión",
    enKeyword: "depression therapist",
    esKeyword: "terapeuta de depresión",
    enHook: "A clear, low-friction website that lets depressed clients book in under two minutes.",
    esHook: "Un sitio claro y sin obstáculos que permite a los clientes con depresión reservar en menos de dos minutos.",
  },
  {
    slug: "trauma",
    en: "Trauma & EMDR",
    es: "Trauma y EMDR",
    enKeyword: "trauma therapist",
    esKeyword: "terapeuta de trauma",
    enHook: "A trauma-informed website with quiet design, crisis support, and no surprise pop-ups.",
    esHook: "Un sitio sensible al trauma, con diseño tranquilo, recursos de crisis y sin ventanas emergentes.",
  },
  {
    slug: "teens-family",
    en: "Teens & Family",
    es: "Adolescentes y Familia",
    enKeyword: "teen therapist",
    esKeyword: "terapeuta de adolescentes",
    enHook: "A website that speaks to the parent who's worried and to the teen who's curious.",
    esHook: "Un sitio que le habla al padre preocupado y al adolescente curioso.",
  },
] as const;

/**
 * Returns the SeoCity by slug, or undefined.
 * Used by the route component to validate URL params before render.
 */
export const findCity = (slug: string): SeoCity | undefined =>
  TX_CITIES.find((c) => c.slug === slug);

export const findSpecialty = (slug: string): SeoSpecialty | undefined =>
  SPECIALTIES.find((s) => s.slug === slug);

/**
 * All valid city × specialty combinations — used by the sitemap
 * generator to emit one <url> per combo. 20 × 5 = 100 unique URLs;
 * with hreflang alternates Google indexes 200 effective endpoints.
 */
export const ALL_COMBOS: readonly { city: SeoCity; specialty: SeoSpecialty }[] =
  TX_CITIES.flatMap((city) =>
    SPECIALTIES.map((specialty) => ({ city, specialty })),
  );
