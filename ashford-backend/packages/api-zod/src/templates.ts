import { z } from "zod";

export type TemplateKeyLiteral =
  | "garden"
  | "sunrise"
  | "constellation"
  | "polaroid"
  | "playful_modern"
  | "front_porch"
  | "hello_friend";

// Retired templateKey values mapped to their closest current replacement so
// old leads / DB rows / preview links keep working without a data migration.
// `atrium` + `quiet_practice` were retired 2026-05 and now alias to garden.
export const LEGACY_TEMPLATE_ALIASES: Record<string, TemplateKeyLiteral> = {
  // Pre-canvas template keys
  clinic: "garden",
  bold_editorial: "garden",
  statement: "garden",
  manifesto: "garden",
  photo_overlay: "polaroid",
  wellness_center: "garden",
  // Earlier names that already mapped to clinic
  heritage: "garden",
  warm_minimalist: "garden",
  // Retired 2026-05
  framework: "garden",
  navy_editorial: "garden",
  atrium: "garden",
  quiet_practice: "garden",
};

// Normalize a raw stored templateKey (possibly retired) to a current literal.
export function normalizeTemplateKey(
  raw: string | null | undefined,
): TemplateKeyLiteral | null {
  if (!raw) return null;
  if (raw in TEMPLATES) return raw as TemplateKeyLiteral;
  return LEGACY_TEMPLATE_ALIASES[raw] ?? null;
}

export type VoiceHint = {
  paragraph: string;
  examples: string[];
};

export type TemplateDef = {
  key: TemplateKeyLiteral;
  label: string;
  description: string;
  font: string;
  /**
   * Optional body font. When unset, ThemeProvider falls back to Inter so
   * pre-existing templates render unchanged. Templates that want a single
   * type family across display + body (Garden uses Fraunces for both)
   * set this to the same value as `font`.
   */
  fontBody?: string;
  vibe: string;
  paletteKeys: string[];
  voiceHint: {
    en: VoiceHint;
    es: VoiceHint;
  };
};

/**
 * Canonical template-key list in public display order. The order matches
 * the /templates gallery page (Templates.tsx → TEMPLATE_DISPLAY_ORDER).
 *
 * Source of truth for any UI that needs to enumerate every template.
 */
export const TEMPLATE_KEYS: readonly TemplateKeyLiteral[] = [
  "constellation",
  "sunrise",
  "garden",
  "front_porch",
  "polaroid",
  "hello_friend",
  "playful_modern",
] as const;

export const TEMPLATES: Record<string, TemplateDef> = {
  garden: {
    key: "garden",
    label: "Garden",
    description:
      "Warm, organic, friendly. Hand-drawn botanical SVGs, soft sage and cream, and rounded cards. For trauma-informed and family-friendly practices that want the page to feel like a sunlit greenhouse.",
    font: "Fraunces",
    fontBody: "Fraunces",
    vibe: "warm, organic, family-friendly",
    paletteKeys: ["garden_sage"],
    voiceHint: {
      en: {
        paragraph:
          "Warm, plain, family-friendly. Use seasonal and growth language without veering into wellness cliché. Lead with what you treat and who you see; mention bilingual care and insurance early. Read like a kind clinician at a community practice.",
        examples: [
          "Bilingual therapy for adults and couples navigating trauma, anxiety, and life transitions.",
          "Most major insurance accepted. New patients usually scheduled within two weeks.",
          "EMDR, parts work, and the slow work of building a life you actually want.",
        ],
      },
      es: {
        paragraph:
          "Cálido, sencillo y pensado para familias. Usa el lenguaje de las estaciones y el crecimiento sin caer en el cliché del bienestar. Empieza por a quién atiendes y qué tratas; menciona pronto la atención bilingüe y los seguros.",
        examples: [
          "Terapia bilingüe para adultos y parejas que atraviesan trauma, ansiedad y transiciones.",
          "Aceptamos los principales seguros. Solemos atender nuevos pacientes en menos de dos semanas.",
          "EMDR, trabajo de partes y el trabajo lento de construir una vida que realmente quieras.",
        ],
      },
    },
  },
  sunrise: {
    key: "sunrise",
    label: "Sunrise",
    description:
      "Soft, hopeful, gradient-lit. Glass cards, peach-coral gradients, and rounded type. For perinatal and trauma-recovery practices that want the page to feel like the first warm light of morning.",
    font: "Plus Jakarta Sans",
    fontBody: "Plus Jakarta Sans",
    vibe: "hopeful, soft, modern",
    paletteKeys: ["sunrise_coral"],
    voiceHint: {
      en: {
        paragraph:
          "Tender and hopeful, but not saccharine. Speak directly to the reader at a hard moment — postpartum, post-loss, post-burnout — and offer a clear next step. Keep sentences short. Healing language is welcome; jargon is not.",
        examples: [
          "Specialty perinatal therapy for the part of motherhood no one warned you about.",
          "EMDR and trauma-focused work, paced to your nervous system, not your calendar.",
          "A free 15-minute call to see if we are a good fit, without any pressure.",
        ],
      },
      es: {
        paragraph:
          "Tierno y esperanzador, pero no empalagoso. Habla directamente al lector en un momento difícil — postparto, duelo, agotamiento — y ofrece un siguiente paso claro. Frases cortas. El lenguaje de sanación es bienvenido; la jerga no.",
        examples: [
          "Terapia perinatal especializada para esa parte de la maternidad de la que nadie te avisó.",
          "EMDR y trabajo centrado en trauma, al ritmo de tu sistema nervioso, no de tu calendario.",
          "Una llamada gratuita de 15 minutos para ver si encajamos, sin compromiso.",
        ],
      },
    },
  },
  constellation: {
    key: "constellation",
    label: "Constellation",
    description:
      "Cinematic dark mode with an interactive star field, gold accents, and glassy cards. For practices serving high-performing adults, founders, and creatives who appreciate a designed-feeling website.",
    font: "Inter",
    fontBody: "Inter",
    vibe: "cinematic, premium, dark",
    paletteKeys: ["constellation_amber"],
    voiceHint: {
      en: {
        paragraph:
          "Quietly confident and slightly literary. The page is dark, designed, and unmistakably aimed at adults who notice typography. Speak about the inner life as terrain to be mapped. Avoid wellness-speak; favor specificity and restraint.",
        examples: [
          "Mapping the inner universe of trauma, transitions, and the relationships you can't quite name.",
          "Twelve years of clinical work. EMDR and depth-oriented therapy, in English and Spanish.",
          "I see writers, founders, and people whose inner life runs ahead of them.",
        ],
      },
      es: {
        paragraph:
          "Tranquilamente segura, ligeramente literaria. La página es oscura, diseñada y dirigida sin disimulo a adultos que notan la tipografía. Habla de la vida interior como un terreno por cartografiar. Evita el tono wellness; prefiere la precisión y la sobriedad.",
        examples: [
          "Cartografiar el universo interior del trauma, las transiciones y los vínculos que no logras nombrar.",
          "Doce años de trabajo clínico. EMDR y terapia profunda, en inglés y español.",
          "Atiendo a escritores, fundadores y personas cuya vida interior va por delante de ellas.",
        ],
      },
    },
  },
  polaroid: {
    key: "polaroid",
    label: "Polaroid",
    description:
      "Personal and tactile. Tilted polaroid photos, masking-tape accents, and a handwritten Caveat counter-script. For solo therapists who want the page to feel like a kind invitation pinned to a corkboard.",
    font: "Playfair Display",
    fontBody: "Inter",
    vibe: "personal, tactile, handwritten",
    paletteKeys: ["polaroid_paper", "polaroid_sepia", "polaroid_dusk"],
    voiceHint: {
      en: {
        paragraph:
          "Personal, first-person, slightly handwritten in feel. Speak the way you'd write a note to a new client at the end of a Sunday — warm, specific, unhurried. Mention the room, the kind of person you keep meeting, what a session looks like.",
        examples: [
          "Hi, I'm Maya. I see adults and couples in central Austin, in English and Spanish.",
          "Tuesdays and Thursdays in person; the rest of the week from a quiet home office.",
          "Most of my clients arrive somewhere between exhausted and curious.",
        ],
      },
      es: {
        paragraph:
          "Personal, en primera persona, con un toque casi escrito a mano. Habla como escribirías una nota a un nuevo paciente al final de un domingo — cálido, específico, sin prisa. Menciona el espacio, el tipo de persona que sigues encontrando, cómo es una sesión.",
        examples: [
          "Hola, soy Maya. Atiendo a adultos y parejas en el centro de Austin, en inglés y español.",
          "Martes y jueves en persona; el resto de la semana desde una oficina tranquila en casa.",
          "La mayoría de mis pacientes llegan entre el agotamiento y la curiosidad.",
        ],
      },
    },
  },
  hello_friend: {
    key: "hello_friend",
    label: "Hello Friend",
    description:
      "Conversational, Gen-Z fluent, intake-form-first. The only template in the lineup that sounds like a person, not a practice. For LPCs and LPC-As who run small queer/neurodivergent-friendly practices and prefer the first message over the first calendar click.",
    font: "Inter",
    fontBody: "Inter",
    vibe: "conversational, warm, queer-friendly",
    paletteKeys: ["hello_friend_indigo"],
    voiceHint: {
      en: {
        paragraph:
          "Conversational, slightly funny, queer-friendly. Speak in first person like you'd write a long IG caption — names what you treat AND what kind of person you click with. Uses 'y'all' sparingly. No clinical jargon. The CTA is an intake form, not a calendar; the goal is the first message, not the first booking.",
        examples: [
          "Hi, I'm Sam. I work with queer adults in their 20s and 30s figuring out what they actually want.",
          "ADHD that wasn't caught at 8 — we'll undo a decade of being told you were just lazy.",
          "Sliding scale only ($80–$140). No insurance. Most of my work happens on Zoom.",
        ],
      },
      es: {
        paragraph:
          "Conversacional, con humor, friendly con la comunidad queer. Habla en primera persona como si fuera un caption largo de IG — nombra lo que tratas Y con qué tipo de persona conectas. Cero jerga clínica. La CTA es un formulario, no un calendario; la meta es el primer mensaje, no la primera cita.",
        examples: [
          "Hola, soy Sam. Trabajo con adultos queer en sus 20 y 30 averiguando qué quieren realmente.",
          "TDAH que no se detectó a los 8 — vamos a deshacer una década de creerte que eras flojx.",
          "Solo escala reducida ($80–$140). Sin seguros. La mayoría de mi trabajo es por Zoom.",
        ],
      },
    },
  },
  front_porch: {
    key: "front_porch",
    label: "Front Porch",
    description:
      "Warm, plain-spoken, Texas-rooted. Cedar + terracotta + butter palette, Fraunces display + Inter body. For couples and family therapists who want the page to feel like an honest first conversation on the porch.",
    font: "Fraunces",
    fontBody: "Inter",
    vibe: "warm, plain-spoken, Texas-rooted",
    paletteKeys: ["front_porch_cedar"],
    voiceHint: {
      en: {
        paragraph:
          "Warm, plain-spoken, Texas-rooted. Speak like you're sitting on the porch with someone — clinically credentialed but never preachy. Lead with what you treat and the populations you see; mention insurance and modalities clearly without listing every certification.",
        examples: [
          "Couples and family therapy in San Antonio. Gottman-trained, in-network with BCBS, Aetna, and United.",
          "I work mostly with couples in their first decade and families becoming new parents.",
          "We figure out what's actually going on, then build a way through it together.",
        ],
      },
      es: {
        paragraph:
          "Cálido, sencillo, con raíces texanas. Habla como si estuvieras conversando en el porche — con credenciales clínicas pero sin sermones. Empieza con lo que tratas y a quién atiendes; menciona seguros y modalidades con claridad sin listar cada certificación.",
        examples: [
          "Terapia de pareja y familiar en San Antonio. Formado en Gottman, en la red con BCBS, Aetna y United.",
          "Trabajo sobre todo con parejas en su primera década y familias que están por ser padres.",
          "Averiguamos qué está pasando realmente y luego construimos juntos una manera de atravesarlo.",
        ],
      },
    },
  },
  playful_modern: {
    key: "playful_modern",
    label: "Playful Modern",
    description:
      "Mental wellness for Gen-Z. Soft photography + SVG decorative overlays (hearts, lightning, smileys) + scrolling condition carousel. Energetic without being childish. For online-first practices, perinatal, LGBTQ+, identity-focused therapists.",
    font: "Inter",
    fontBody: "Inter",
    vibe: "energetic, accessible, modern",
    paletteKeys: ["playful_modern_peach"],
    voiceHint: {
      en: {
        paragraph:
          "Direct, warm, Gen-Z fluent without being trendy. Speak to the reader like a friend who happens to be a therapist. Specific is better than aspirational.",
        examples: [
          "Therapy for the part of being twenty-something nobody warned you about.",
          "Online sessions, evenings and weekends. Aetna, Cigna, sliding-scale tier 1.",
          "I work with anxious overachievers, queer kids in Texas, and recovering eldest daughters.",
        ],
      },
      es: {
        paragraph:
          "Directa, cálida, fluida con Gen-Z sin ser trendy. Habla al lector como una amiga que resulta ser terapeuta. Lo específico vence a lo aspiracional.",
        examples: [
          "Terapia para esa parte de tener veintipico que nadie te avisó.",
          "Sesiones en línea, tardes y fines de semana. Aetna, Cigna, tarifa flexible nivel 1.",
          "Atiendo a perfeccionistas ansiosas, jóvenes queer en Texas y hermanas mayores en recuperación.",
        ],
      },
    },
  },
};

export type PaletteDef = {
  key: string;
  label: string;
  templateKey: TemplateKeyLiteral;
  primary: string;
  accent: string;
  surface: string;
  ink: string;
  muted: string;
  /**
   * Distinct secondary brand color, separate from `muted`. When unset
   * ThemeProvider falls back to `muted` so existing palettes that pre-date
   * this field continue to render unchanged.
   */
  secondary?: string;
  /**
   * Lifted-card surface (e.g. service tiles, fee table). When unset
   * ThemeProvider falls back to `#ffffff`. Used by templates whose surface
   * itself is already a tinted cream and a plain white card would jar.
   */
  surfaceSoft?: string;
};

/**
 * One canonical palette per template. The palette swap UI was removed in the
 * 5-template catalog cleanup — each template now ships a single, signature
 * color identity that the design team curates.
 */
export const PALETTES: Record<string, PaletteDef> = {
  garden_sage: {
    key: "garden_sage",
    label: "Sage & Cream",
    templateKey: "garden",
    primary: "#3F5641",
    secondary: "#F2EBDA",
    accent: "#C97B5A",
    surface: "#F8F4E9",
    surfaceSoft: "#FFFCF5",
    ink: "#2A2D26",
    muted: "#6B6F66",
  },
  sunrise_coral: {
    key: "sunrise_coral",
    label: "Sunrise (Plum & Peach)",
    templateKey: "sunrise",
    primary: "#6B4F6B",
    secondary: "#F4B895",
    accent: "#E8826B",
    surface: "#FFF4ED",
    surfaceSoft: "#FFE4D9",
    ink: "#3A2E3A",
    // WCAG 2.1 AA fix (2026-05): darkened from #7A6E7A (was 4.47:1 on
    // surface, 4.00 on surfaceSoft) to #5A4E5A (now ~6.7:1 on surface,
    // ~6.0 on surfaceSoft). Same hue, lower lightness.
    muted: "#5A4E5A",
  },
  constellation_amber: {
    key: "constellation_amber",
    label: "Midnight & Gold",
    templateKey: "constellation",
    primary: "#0B1426",
    secondary: "#1A2332",
    accent: "#E5A547",
    surface: "#050810",
    surfaceSoft: "#0F1828",
    ink: "#F5F0E5",
    muted: "#A8B0BC",
  },
  polaroid_paper: {
    key: "polaroid_paper",
    label: "Paper & Tape (Teal)",
    templateKey: "polaroid",
    primary: "#264653",
    secondary: "#F5F0E1",
    accent: "#E29578",
    surface: "#FAF6EC",
    surfaceSoft: "#FFFFFF",
    ink: "#1F2937",
    muted: "#5C6470",
  },
  hello_friend_indigo: {
    key: "hello_friend_indigo",
    label: "Indigo & Butter",
    templateKey: "hello_friend",
    primary: "#2D2A6E",
    secondary: "#FF8C7A",
    accent: "#FFD86B",
    surface: "#FFF5EE",
    surfaceSoft: "#FFFFFF",
    ink: "#1F1B3F",
    muted: "#5A5680",
  },
  front_porch_cedar: {
    key: "front_porch_cedar",
    label: "Cedar & Butter",
    templateKey: "front_porch",
    primary: "#6B4423",
    secondary: "#C97B5A",
    accent: "#F2D67E",
    surface: "#F8F0E5",
    surfaceSoft: "#FFFAF2",
    ink: "#2F1F14",
    muted: "#6B5847",
  },
  playful_modern_peach: {
    key: "playful_modern_peach",
    label: "Indigo & Coral",
    templateKey: "playful_modern",
    primary: "#2C2654",
    secondary: "#FF6B5A",
    accent: "#C9B6FF",
    surface: "#FDF7F4",
    surfaceSoft: "#FFFFFF",
    ink: "#1A1647",
    muted: "#6B658A",
  },
};

/**
 * Legacy palette keys (multi-palette era) all collapse onto the canonical
 * palette for the same template. Used by the API normaliser so old stored
 * `paletteKey` values on leads/sales never 404.
 */
export const LEGACY_PALETTE_ALIASES: Record<string, string> = {
  atrium_brass: "garden_sage",
  atrium_ink: "garden_sage",
  atrium_marble: "garden_sage",
  quiet_practice_ink: "garden_sage",
  garden_dawn: "garden_sage",
  garden_moss: "garden_sage",
  sunrise_dusk: "sunrise_coral",
  sunrise_peach: "sunrise_coral",
  manifesto_ink: "garden_sage",
  manifesto_terracotta: "garden_sage",
  manifesto_forest: "garden_sage",
  constellation_indigo: "constellation_amber",
  constellation_slate: "constellation_amber",
  polaroid_sepia: "polaroid_paper",
  polaroid_dusk: "polaroid_paper",
  // Retired with framework + navy_editorial templates (2026-05).
  framework_clay: "garden_sage",
  navy_editorial_navy: "garden_sage",
};

/** Returns the canonical palette for a template (single source of truth). */
export function paletteForTemplate(
  templateKey: TemplateKeyLiteral,
): PaletteDef {
  const def = TEMPLATES[templateKey];
  const key = def?.paletteKeys?.[0];
  return (key && PALETTES[key]) || PALETTES.garden_sage;
}

/** Normalises a stored paletteKey through legacy aliases. */
export function normalizePaletteKey(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  if (raw in PALETTES) return raw;
  return LEGACY_PALETTE_ALIASES[raw] ?? null;
}

export const TemplatesResponse = z.object({
  templates: z.array(z.unknown()),
  palettes: z.array(z.unknown()),
});

/**
 * Self-serve reservation initiated from the public template showcase
 * (`/template/:key`). No prospect slug — the visitor is anonymous and lands
 * straight in Stripe Checkout. The lead pipeline is created post-payment by
 * the existing webhook chain (sale row → onboarding → lead reconciliation).
 */
export const SelfServeTemplateReserveRequest = z.object({
  templateKey: z.string().min(1).max(48),
  paletteKey: z.string().max(48).optional(),
  addonSlugs: z.array(z.string().max(48)).max(20).default([]),
  customizations: z
    .object({
      primary: z.string().max(16).optional(),
      accent: z.string().max(16).optional(),
      fontDisplay: z.string().max(120).optional(),
      fontBody: z.string().max(120).optional(),
    })
    .optional(),
  contact: z.object({
    email: z.string().email(),
    practiceName: z.string().min(1).max(192),
    phone: z.string().max(32).optional(),
    chosenDomain: z.string().max(253).optional(),
  }),
  /** Anti-bot honeypot — must be empty. */
  _hp: z.string().max(0).optional().default(""),
  locale: z.enum(["en", "es"]).optional(),
  /**
   * Per-tab funnel session UUID — minted client-side and persisted in
   * sessionStorage. Stamped on Stripe Checkout metadata so the admin
   * funnel report can join `funnel_events` rows back to the resulting
   * lead/sale. 64-char cap matches the DB column.
   */
  funnelSessionId: z.string().max(64).optional(),
});
export type SelfServeTemplateReserveRequest = z.infer<
  typeof SelfServeTemplateReserveRequest
>;

export const SelfServeTemplateReserveResponse = z.object({
  mode: z.enum(["stripe_checkout", "dev_mock", "fallback"]),
  url: z.string().nullable(),
  sessionId: z.string().nullable(),
  monthlyTotalCents: z.number().int().nonnegative(),
  setupTotalCents: z.number().int().nonnegative(),
});
export type SelfServeTemplateReserveResponse = z.infer<
  typeof SelfServeTemplateReserveResponse
>;
