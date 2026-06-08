import type { TemplateKey } from "@workspace/api-zod";
import type { TemplateContent } from "./types";
import { img } from "@site/lib/api";

/**
 * Identity-check whether a TemplateContent is the shared demo sample
 * (vs. a real prospect's content). resolvePersona uses this to decide
 * whether to honour `props.content` or fall through to PERSONAS defaults.
 *
 * Reference equality is the strict signal — both shared SAMPLEs are
 * always passed by the same object reference because TemplateRoute
 * pulls them straight from SAMPLES below, never deep-clones. As a
 * defensive backstop we also accept a content whose team[0].name
 * matches the sample's distinctive demo name; that catches accidental
 * shallow-copies in tests or future refactors that break referential
 * equality without intending to.
 */
export function isSampleContent(
  content: TemplateContent | null | undefined,
): boolean {
  if (!content) return true;
  if (content === SHARED_SAMPLE_EN || content === SHARED_SAMPLE_ES) return true;
  const teamName = content.team?.[0]?.name?.trim() ?? "";
  return teamName === "Dr. Maya Alvarado" || teamName === "Dra. Maya Alvarado";
}

export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/dr\.?\s+/gi, "")
    .replace(/['’"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Each canvas-port template is a self-contained visual replica that hard-codes
 * its own copy and imagery — the goal is exact pixel fidelity to the approved
 * mockup, not data-driven rendering. The content prop is still required by
 * `TemplateProps` for type compatibility (so the template can render in legacy
 * data-driven contexts without crashing), but the live `/template/:key` route
 * now passes this same neutral sample for every key. Per-prospect content
 * substitution happens through a separate copy pass during onboarding rather
 * than at template-render time.
 */
const SHARED_SAMPLE_EN: TemplateContent = {
  practiceName: "Dr. Maya Alvarado, LCSW",
  // Universal, outcome-oriented fallback. Avoids leading with bilingualism
  // because most prospects don't market in two languages and the line was
  // running as the H1 on every preview that hadn't been personalised yet
  // — making the entire portal feel like it was for someone else. The
  // bilingual claim still lives in the SHARED_SAMPLE.mission paragraph
  // and on the team card's `identities` field, where it belongs.
  tagline:
    "Therapy that meets you where you are — grounded, evidence-based, and quietly tailored to you.",
  mission:
    "Compassionate, trauma-informed therapy in English and Spanish. Specializing in EMDR, perinatal mental health, and life transitions.",
  yearFounded: 2014,
  heroImage: img("images/atrium-hero.png"),
  services: [
    {
      name: "Individual Therapy",
      description:
        "A safe space to explore anxiety, depression, and life transitions.",
    },
    {
      name: "EMDR for Trauma",
      description:
        "Evidence-based processing to help your brain heal from past distressing events.",
    },
    {
      name: "Couples Counseling",
      description:
        "Rebuild connection, improve communication, and break unhelpful patterns.",
    },
  ],
  team: [
    {
      slug: "maya-alvarado",
      name: "Dr. Maya Alvarado",
      credentials: "LCSW",
      photo: img("images/atrium-portrait.jpg"),
      bio: "Bilingual LCSW with 10+ years of trauma-informed practice in Austin.",
      modalities: ["EMDR", "Psychodynamic", "Couples"],
      identities: ["Bilingual (Spanish)"],
      pronouns: "she/her",
    },
  ],
  reviews: [
    {
      author: "Sofia R.",
      body: "Maya hizo que mi primera sesión fuera lo menos intimidante posible. Poder hablar en español con alguien que entiende lo cultural marcó toda la diferencia.",
      rating: 5,
      source: "Google",
    },
    {
      author: "James T.",
      body: "EMDR with Dr. Alvarado actually worked. After two months I sleep through the night for the first time in three years. She's calm, prepared, and completely non-judgmental.",
      rating: 5,
      source: "Healthgrades",
    },
    {
      author: "Priya K.",
      body: "Found her during a hard postpartum stretch. The office is warm, parking is easy, and she replies to scheduling messages within the day. Worth every minute of the drive.",
      rating: 5,
      source: "Google",
    },
  ],
  locations: [
    {
      name: "Austin Office",
      address: "1200 E 11th St, Suite 204, Austin, TX 78702",
      hours: [
        { day: "Mon", open: "9:00 AM – 6:00 PM" },
        { day: "Tue", open: "9:00 AM – 6:00 PM" },
        { day: "Wed", open: "9:00 AM – 6:00 PM" },
        { day: "Thu", open: "9:00 AM – 6:00 PM" },
      ],
    },
  ],
  contact: {
    phone: "(512) 555-0198",
    email: "hello@drmayaalvarado.com",
    instagram: "@drmayaalvarado",
    facebook: "drmayaalvarado",
    linkedin: "dr-maya-alvarado",
    psychologyToday: "maya-alvarado-austin-tx",
    headway: "maya-alvarado",
  },
  addons: [],
  insurance: ["Aetna", "BCBS Texas", "Out of Network"],
};

/**
 * Spanish counterpart so the public template-browse surface (and any
 * portal pinned to es) flips visible practitioner content — taglines,
 * service names + descriptions, hours labels, insurance, etc. — into
 * Spanish without the prospect needing a real bilingual practice. The
 * structural shape mirrors SHARED_SAMPLE_EN field-for-field.
 */
const SHARED_SAMPLE_ES: TemplateContent = {
  ...SHARED_SAMPLE_EN,
  practiceName: "Dra. Maya Alvarado, LCSW",
  tagline:
    "Terapia que te recibe donde estás — basada en evidencia, cercana y discretamente hecha para ti.",
  mission:
    "Terapia compasiva e informada en trauma, en inglés y español. Especialidades: EMDR, salud mental perinatal y transiciones de vida.",
  services: [
    {
      name: "Terapia individual",
      description:
        "Un espacio seguro para explorar la ansiedad, la depresión y las transiciones de vida.",
    },
    {
      name: "EMDR para trauma",
      description:
        "Procesamiento basado en evidencia para ayudar a tu cerebro a sanar eventos angustiantes del pasado.",
    },
    {
      name: "Terapia de pareja",
      description:
        "Reconstruir la conexión, mejorar la comunicación y romper patrones que no ayudan.",
    },
  ],
  team: [
    {
      ...SHARED_SAMPLE_EN.team[0]!,
      name: "Dra. Maya Alvarado",
      bio: "LCSW bilingüe con más de 10 años de práctica informada en trauma en Austin.",
      modalities: ["EMDR", "Psicodinámica", "Parejas"],
      identities: ["Bilingüe (español)"],
      pronouns: "ella",
    },
  ],
  locations: [
    {
      name: "Consultorio en Austin",
      address: "1200 E 11th St, Suite 204, Austin, TX 78702",
      hours: [
        { day: "Lun", open: "9:00 AM – 6:00 PM" },
        { day: "Mar", open: "9:00 AM – 6:00 PM" },
        { day: "Mié", open: "9:00 AM – 6:00 PM" },
        { day: "Jue", open: "9:00 AM – 6:00 PM" },
      ],
    },
  ],
  insurance: ["Aetna", "BCBS Texas", "Fuera de red"],
  reviews: [
    {
      author: "Sofia R.",
      body: "Maya hizo que mi primera sesión fuera lo menos intimidante posible. Poder hablar en español con alguien que entiende lo cultural marcó toda la diferencia.",
      rating: 5,
      source: "Google",
    },
    {
      author: "James T.",
      body: "El EMDR con la Dra. Alvarado realmente funcionó. Después de dos meses duermo toda la noche por primera vez en tres años. Es calmada, preparada y nada crítica.",
      rating: 5,
      source: "Healthgrades",
    },
    {
      author: "Priya K.",
      body: "La encontré durante un postparto difícil. El consultorio es cálido, estacionar es fácil y responde a los mensajes el mismo día. Vale cada minuto del trayecto.",
      rating: 5,
      source: "Google",
    },
  ],
};

export const SAMPLES: Record<TemplateKey, TemplateContent> = {
  garden: SHARED_SAMPLE_EN,
  sunrise: SHARED_SAMPLE_EN,
  constellation: SHARED_SAMPLE_EN,
  polaroid: SHARED_SAMPLE_EN,
  // playful_modern + front_porch reuse the shared sample so the public
  // showcase / prospect preview can render them without bespoke fake
  // data; per-template hero copy comes from the strings catalog.
  playful_modern: SHARED_SAMPLE_EN,
  front_porch: SHARED_SAMPLE_EN,
  hello_friend: SHARED_SAMPLE_EN,
};

const SAMPLES_ES: Record<TemplateKey, TemplateContent> = {
  garden: SHARED_SAMPLE_ES,
  sunrise: SHARED_SAMPLE_ES,
  constellation: SHARED_SAMPLE_ES,
  polaroid: SHARED_SAMPLE_ES,
  playful_modern: SHARED_SAMPLE_ES,
  front_porch: SHARED_SAMPLE_ES,
  hello_friend: SHARED_SAMPLE_ES,
};

/**
 * Locale-aware sample picker used by every consumer that previously
 * read SAMPLES[key] directly. Public template browse, prospect preview
 * and prospect portal all call this so EN/ES toggling flips visible
 * practitioner copy across templates and the included add-on inlines.
 */
export function pickSample(
  key: TemplateKey,
  locale: "en" | "es",
): TemplateContent {
  return locale === "es" ? SAMPLES_ES[key] : SAMPLES[key];
}
