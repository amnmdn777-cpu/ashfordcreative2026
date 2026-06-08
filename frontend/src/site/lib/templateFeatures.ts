import type { TemplateKey } from "@workspace/api-zod";

/**
 * Per-template declaration of where each "ALSO INCLUDED" feature actually
 * lives. Drives both the demo overlay (which dot to render and where) and
 * the "Try this template" panel categorization (homepage vs inner page vs
 * behind the scenes). A single source of truth so the panel never claims
 * something the page doesn't render.
 *
 * 2026-05 (founder iPad note): the three Google features
 * (`reviews_aggregator`, `google_business_locator`, `google_profile_sync`)
 * were merged into a single `google_business_presence` feature — they were
 * the same product mechanism and listing them separately read as filler.
 */

export type FeatureKey =
  | "insurance_sliding_scale"
  | "spanish_translation"
  | "crisis_hotline_button"
  | "office_tour"
  | "google_business_presence"
  | "daily_schedule_digest"
  | "social_row";

export type LocalizedText = { en: string; es: string };

export type FeaturePresence =
  | { kind: "homepage"; sublabel?: LocalizedText }
  | { kind: "inner_page"; href: string; sublabel?: LocalizedText }
  | { kind: "behind_scenes"; sublabel?: LocalizedText };

export type TemplateFeatureMap = Record<FeatureKey, FeaturePresence>;

// Order used for numbering pulse-dots and for ordering the panel list.
export const FEATURE_ORDER: readonly FeatureKey[] = [
  "spanish_translation",
  "insurance_sliding_scale",
  "office_tour",
  "google_business_presence",
  "social_row",
  "crisis_hotline_button",
  "daily_schedule_digest",
];

export const FEATURE_LABELS: Record<FeatureKey, LocalizedText> = {
  insurance_sliding_scale: { en: "Insurance & Sliding Scale", es: "Seguros y escala móvil" },
  spanish_translation: { en: "Spanish Translation", es: "Traducción al español" },
  crisis_hotline_button: { en: "Crisis Resources Button", es: "Botón de recursos de crisis" },
  office_tour: { en: "Office Tour Photo Strip", es: "Tira de fotos del consultorio" },
  google_business_presence: {
    en: "Google Business Presence",
    es: "Presencia en Google Business",
  },
  daily_schedule_digest: { en: "Daily Schedule Digest", es: "Resumen diario de agenda" },
  social_row: { en: "Social Profiles Row", es: "Perfiles sociales" },
};

const COMMON_BEHIND_SCENES = {
  daily_schedule_digest: {
    kind: "behind_scenes" as const,
    sublabel: {
      en: "A calm 7am email recap of today's bookings — lands in your inbox, not on the site.",
      es: "Resumen tranquilo a las 7am — llega a tu correo, no al sitio.",
    },
  },
};

const SPANISH_HOMEPAGE: FeaturePresence = {
  kind: "homepage",
  sublabel: {
    en: "EN/ES toggle in the header — every page renders bilingual.",
    es: "Toggle EN/ES en el header — cada página se renderiza bilingüe.",
  },
};

const STANDARD: TemplateFeatureMap = {
  insurance_sliding_scale: {
    kind: "homepage",
    sublabel: {
      en: "Insurance + sliding-scale badges sit in the Fees aside so prospects know fit at a glance.",
      es: "Distintivos de seguro y escala móvil en la sección de tarifas.",
    },
  },
  spanish_translation: SPANISH_HOMEPAGE,
  crisis_hotline_button: {
    kind: "homepage",
    sublabel: {
      en: "988 pill stays pinned to the corner of every page.",
      es: "Botón 988 fijo en cada página.",
    },
  },
  office_tour: {
    kind: "homepage",
    sublabel: {
      en: "Four-photo strip — door, waiting room, your chair, exterior.",
      es: "Cuatro fotos — puerta, sala de espera, tu silla, exterior.",
    },
  },
  google_business_presence: {
    kind: "homepage",
    sublabel: {
      en: "Reviews + map + directions + Google-sourced hours, all on every page.",
      es: "Reseñas + mapa + direcciones + horarios desde Google, en cada página.",
    },
  },
  social_row: {
    kind: "homepage",
    sublabel: {
      en: "Footer row links the social accounts you actually use.",
      es: "Footer enlaza solo las redes que de verdad usas.",
    },
  },
  ...COMMON_BEHIND_SCENES,
};

export const TEMPLATE_FEATURES: Record<TemplateKey, TemplateFeatureMap> = {
  garden: STANDARD,
  sunrise: STANDARD,
  constellation: STANDARD,
  polaroid: STANDARD,
  playful_modern: STANDARD,
  front_porch: STANDARD,
  hello_friend: STANDARD,
};

export function homepageFeatureNumber(
  templateKey: TemplateKey | null,
  featureKey: FeatureKey,
): number | null {
  if (!templateKey) return null;
  const map = TEMPLATE_FEATURES[templateKey];
  if (!map) return null;
  const homepageKeys = FEATURE_ORDER.filter((k) => map[k]?.kind === "homepage");
  const idx = homepageKeys.indexOf(featureKey);
  return idx >= 0 ? idx + 1 : null;
}

export function bucketFeatures(templateKey: TemplateKey) {
  const map = TEMPLATE_FEATURES[templateKey] ?? STANDARD;
  const homepage: FeatureKey[] = [];
  const innerPage: FeatureKey[] = [];
  const behindScenes: FeatureKey[] = [];
  for (const key of FEATURE_ORDER) {
    const presence = map[key];
    if (!presence) continue;
    if (presence.kind === "homepage") homepage.push(key);
    else if (presence.kind === "inner_page") innerPage.push(key);
    else behindScenes.push(key);
  }
  return { homepage, innerPage, behindScenes, map };
}
