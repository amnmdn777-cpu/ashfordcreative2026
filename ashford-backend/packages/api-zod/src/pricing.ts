import { z } from "zod";

/**
 * PRICING MODEL — Tier-based (post 2026-05 refactor).
 *
 * Three tiers replace the legacy PLANS A/B + addon catalog. All features
 * are now bundled into a tier; there are no à-la-carte addons. The catalog
 * shape:
 *
 *   TIERS          public-facing billable products (boutique / pro / concierge)
 *   CAPABILITIES   atomic feature definitions with EN+ES copy
 *   TIERS[t].capabilities  ordered CapabilityKey[] = which features the tier renders
 *
 * Templates and the prospect portal consume `resolveTierFeatures(tierKey)`
 * to know what to render. The Pricing page consumes `TIERS` directly for
 * the 3-tier comparison layout.
 *
 * Decisions doc: artifacts/api-server/docs/pricing-migration-decisions.md
 */

export const TierKey = z.enum([
  "boutique",
  "boutique_pro",
  "boutique_concierge",
]);
export type TierKey = z.infer<typeof TierKey>;

/**
 * CapabilityKey is the closed universe of features a template can render.
 * Adding a key here widens the literal union and forces exhaustive switches
 * downstream (template skins, IncludedFeaturesShowcase, registry).
 */
export const CAPABILITY_KEYS = [
  // Foundation — every tier ships these.
  "spanish_translation",
  "crisis_hotline_button",
  "office_tour",
  "google_business_presence",
  "daily_schedule_digest",
  "social_row",
  "insurance_sliding_scale",
  // Pro tier additions (formerly paid client-angle addons).
  "online_booking",
  "first_visit_video",
  "telehealth_bridge",
  // 2026-05-21 — `patient_onboarding_hub` capability dropped (Sprint 2 streamline).
  // Concierge tier additions.
  "telehealth_full",
  "blog_publishing",
] as const;
export type CapabilityKey = (typeof CAPABILITY_KEYS)[number];

export type CapabilityFeature = {
  key: CapabilityKey;
  label: string;
  description: string;
  longPitch?: string;
  bullets?: string[];
  longPitchEs?: string;
  bulletsEs?: string[];
};

export const CAPABILITIES: Record<CapabilityKey, CapabilityFeature> = {
  spanish_translation: {
    key: "spanish_translation",
    label: "Spanish Translation",
    description:
      "Every site ships fully bilingual EN/ES at launch. We translate continuously when you update copy — no extra fee.",
  },
  crisis_hotline_button: {
    key: "crisis_hotline_button",
    label: "Crisis Resources Button",
    description:
      "A floating, always-visible 988 button with the option to call or text — present on every page, every template.",
  },
  office_tour: {
    key: "office_tour",
    label: "Office Tour Photo Strip",
    description:
      "A small photo grid of your real office — door, waiting room, your chair — so first-time patients know exactly what to expect.",
  },
  google_business_presence: {
    key: "google_business_presence",
    label: "Google Business Presence",
    description:
      "One Google integration covering three things: reviews curated by your rep from Google + Healthgrades, a live map + directions on every page, and your contact info + hours pulled straight from your Google Business Profile.",
  },
  daily_schedule_digest: {
    key: "daily_schedule_digest",
    label: "Daily Schedule Digest",
    description:
      "Front desk gets a calm 7am email with the day's appointments, cancellations, and any new bookings overnight.",
  },
  social_row: {
    key: "social_row",
    label: "Social Profiles Row",
    description:
      "Footer row links Instagram, LinkedIn, Facebook, and TikTok — whichever ones you actually use, none of the ones you don't.",
  },
  insurance_sliding_scale: {
    key: "insurance_sliding_scale",
    label: "Insurance & Sliding Scale Badge",
    description:
      "A clear badge on every page that lists what you accept and your sliding-scale floor — so the right-fit client never asks first.",
    longPitch:
      "The number-one question in your DMs is 'do you take my insurance?' We answer it before they have to ask, with a small, calm badge that names the plans you accept (or 'cash-pay only'), states your sliding-scale floor, and links to a dedicated explainer page in plain English and Spanish. Visitors who can't afford you self-select out before booking — and the ones who can, book confidently.",
    bullets: [
      "Editable list of accepted plans (we update for you)",
      "Sliding-scale floor surfaced in the hero badge",
      "Dedicated EN + ES explainer page with FAQ",
      "Cuts 'do you take my insurance?' inquiries by ~40%",
    ],
  },
  online_booking: {
    key: "online_booking",
    label: "Online Booking",
    description:
      "Prospect requests a slot, you one-tap approve via email + SMS, the slot is confirmed and synced to your calendar.",
    longPitch:
      "Every new patient sees the same flow: pick from your real-availability windows, drop their name and phone, and submit a request. The instant they tap Request, you get a one-tap approval email AND a one-tap approval SMS — approving from either channel confirms the slot, blocks it on your Google/Outlook/iCal, and triggers the patient's confirmation + 24h reminder + self-reschedule link. Decline with a single tap and the patient sees a polite alternative-times screen. No back-and-forth email tag, no double-booking, and no booking goes live without your explicit yes.",
    bullets: [
      "Prospect request → one-tap doctor approval via email AND SMS → confirmed slot",
      "Two-way sync with Google Calendar, Outlook, or iCal",
      "Real-availability windows so you never double-book",
      "Auto SMS + email confirmations and 24h reminders to the patient",
      "Patient self-reschedule link inside every reminder",
    ],
  },
  first_visit_video: {
    key: "first_visit_video",
    label: "First-Visit Video",
    description:
      "A 60-second walkthrough of the first visit — performed by a professional actor avatar from a script we write with you. No camera in your face.",
    longPitch:
      "Anxious first-time clients spend an average of 8 seconds on a therapist's homepage before bouncing. A short, warm video walkthrough — 'here's what the first visit is like, here's the door, here's where to sit' — is the single highest-converting element we ship. You don't need to be on camera. We interview you for 20 minutes, write the script in your voice, and produce it with a professional actor avatar (or, if you prefer, a real comedian-trained presenter). You approve the final cut, we caption it in English and Spanish, and host it ad-free with zero YouTube branding. One refresh per year is included if you change your office, hours, or specialties.",
    bullets: [
      "We write the script from a 20-min interview — you don't draft a word",
      "Performed by a professional actor avatar (or real presenter if you prefer)",
      "You never have to be on camera or in a studio",
      "Captions in English and Spanish, hosted ad-free with no YouTube branding",
      "One refresh per year included when your details change",
    ],
  },
  telehealth_bridge: {
    key: "telehealth_bridge",
    label: "Telehealth Bridge",
    description:
      "A branded session page on your site that opens your existing Doxy.me, Zoom for Healthcare, or SimplePractice room. You keep your provider — we make the patient experience feel like one continuous practice.",
    longPitch:
      "If you already have a HIPAA-grade telehealth account, you don't need another one. You need it to feel like part of your practice. We add a single branded page at yoursite.com/visit (or /sesion in Spanish) that opens your existing room in one tap. Patients land on a page that looks like the rest of your site — your photo, your colors, your voice — with a small 'before your visit' card (calm, headphones, water), a one-tap reschedule link, and a clear button into your waiting room. One permanent URL replaces the dozen unique Doxy links you copy-paste today. Studies put the no-show drop from a real prep page at 15-25%. We don't touch your video provider's billing or BAA — your existing relationship stays intact.",
    bullets: [
      "Branded /visit page that opens your existing Doxy / Zoom / SimplePractice room",
      "One permanent URL — give it once, reuse it for every patient",
      "Pre-session prep card (what to bring, how to test audio) drops no-shows 15-25%",
      "One-tap reschedule + cancel inside the same page",
      "Mobile-optimized — patients on phones don't drop into the gray Doxy default",
      "Your video provider, your BAA — we never touch your clinical telehealth contract",
    ],
    longPitchEs:
      "Si ya tienes una cuenta de telesalud HIPAA, no necesitas otra. Necesitas que se sienta como parte de tu práctica. Añadimos una sola página con tu marca en tusitio.com/sesion (o /visit en inglés) que abre tu sala existente con un toque. Los pacientes llegan a una página que se ve como el resto de tu sitio — tu foto, tus colores, tu voz — con una pequeña tarjeta 'antes de tu sesión' (silencio, auriculares, agua), un enlace de reprogramación de un toque, y un botón claro hacia tu sala de espera. Una URL permanente reemplaza los doce enlaces únicos de Doxy que copias hoy. Estudios muestran una caída de 15-25% en ausencias gracias a una página de preparación real. No tocamos la facturación ni el BAA de tu proveedor — tu relación existente queda intacta.",
    bulletsEs: [
      "Página /sesion con tu marca que abre tu sala Doxy / Zoom / SimplePractice existente",
      "Una sola URL permanente — la das una vez, la reusas para cada paciente",
      "Tarjeta de preparación pre-sesión (qué traer, cómo probar audio) reduce ausencias 15-25%",
      "Reprogramación + cancelación de un toque dentro de la misma página",
      "Optimizada para móvil — los pacientes en celular no caen en el Doxy gris por defecto",
      "Tu proveedor de video, tu BAA — nunca tocamos tu contrato clínico de telesalud",
    ],
  },
  // 2026-05-21 — `patient_onboarding_hub` capability dropped (Sprint 2 streamline).
  telehealth_full: {
    key: "telehealth_full",
    label: "Telehealth Full Setup",
    description:
      "We create your HIPAA-grade Doxy.me Pro account, configure it under your brand, and wire it to your site. You sign the BAA in two clicks and never touch the video billing again.",
    longPitch:
      "If you don't have a telehealth account yet — or you've been putting off setting one up because BAAs and HIPAA docs make you tense — we do the whole thing. We create your Doxy.me Pro account, configure your branded waiting room (logo, colors, hold message), walk you through the BAA signature in under two minutes (the only step legally required of you), and run a 30-minute onboarding video session so the first time isn't with a real patient. Your monthly invoice from us covers everything — Doxy.me Pro is on our card, you never see it. The branded /visit page from the Bridge add-on is included. If we ever change providers we tell you 90 days in advance and migrate at no extra cost.",
    bullets: [
      "Doxy.me Pro account created + branded waiting room configured",
      "BAA signature walkthrough — 2 minutes of your time, the only legally required step",
      "30-min onboarding video session so the first time isn't with a patient",
      "Branded /visit page on your site (Telehealth Bridge included)",
      "Single monthly invoice — Doxy.me Pro billing handled on our side",
      "Concierge onboarding + BAA + first 30-min training included",
    ],
    longPitchEs:
      "Si todavía no tienes una cuenta de telesalud — o has estado postergando configurar una porque los BAAs y los documentos HIPAA te ponen tenso — lo hacemos todo. Creamos tu cuenta Doxy.me Pro, configuramos tu sala de espera con tu marca (logo, colores, mensaje de espera), te guiamos por la firma del BAA en menos de dos minutos (el único paso legalmente requerido), y corremos una sesión de incorporación en video de 30 minutos para que la primera vez no sea con un paciente real. Tu factura mensual con nosotros cubre todo — Doxy.me Pro está en nuestra tarjeta, nunca lo ves. La página /sesion con tu marca del complemento Bridge está incluida. Si alguna vez cambiamos de proveedor te avisamos 90 días antes y migramos sin costo adicional.",
    bulletsEs: [
      "Cuenta Doxy.me Pro creada + sala de espera con tu marca configurada",
      "Acompañamiento para firmar el BAA — 2 minutos de tu tiempo, único paso legalmente requerido",
      "Sesión de incorporación de 30 min en video para que la primera vez no sea con un paciente",
      "Página /sesion con tu marca en tu sitio (Telehealth Bridge incluido)",
      "Una sola factura mensual — facturación de Doxy.me Pro manejada de nuestro lado",
      "Incorporación conserje + BAA + primera sesión de 30 min incluidos",
    ],
  },
  blog_publishing: {
    key: "blog_publishing",
    label: "Insights Journal",
    description:
      "We ghostwrite the first 3 posts to seed your journal, then ghostwrite one new piece every month — monthly ghostwriting included, no extra invoice.",
    longPitch:
      "Most therapists know they should be writing but never have the time. We do it for you. To launch your journal we ghostwrite the first 3 posts (kicking off month one) so you start with real depth, then every month after that we interview you for 20 minutes about a case theme, a modality you're leaning on, or a question patients keep asking — and ghostwrite a 600-word piece in your voice. You approve it in one click, and it ships. Over a year that's 14+ posts of real clinical authority that Google indexes, peers cite, and prospective patients actually read.",
    bullets: [
      "We ghostwrite the first 3 posts at launch — your journal opens with real depth",
      "Monthly ghostwriting included — 20-min interview, we draft the piece",
      "Editor-in-chief review for clinical tone and accuracy",
      "Auto-translated to Spanish and SEO-optimised",
      "One-click approve and publish, no CMS to learn",
    ],
  },
};

export type TierDef = {
  key: TierKey;
  label: string;
  monthlyCents: number;
  setupCents: number;
  description: string;
  capabilities: readonly CapabilityKey[];
  recommended?: boolean;
};

const BOUTIQUE_CAPABILITIES: readonly CapabilityKey[] = [
  "spanish_translation",
  "crisis_hotline_button",
  "office_tour",
  "google_business_presence",
  "daily_schedule_digest",
  "social_row",
  "insurance_sliding_scale",
];

const BOUTIQUE_PRO_CAPABILITIES: readonly CapabilityKey[] = [
  ...BOUTIQUE_CAPABILITIES,
  "online_booking",
  "first_visit_video",
  "telehealth_bridge",
  // 2026-05-21 — `patient_onboarding_hub` capability dropped (Sprint 2 streamline).
];

const BOUTIQUE_CONCIERGE_CAPABILITIES: readonly CapabilityKey[] = [
  ...BOUTIQUE_PRO_CAPABILITIES,
  "telehealth_full",
  "blog_publishing",
];

export const TIERS: Record<TierKey, TierDef> = {
  boutique: {
    key: "boutique",
    label: "Boutique",
    monthlyCents: 19900,
    setupCents: 0,
    description:
      "The essentials, beautifully done. Bilingual site, calm Crisis Resources button, office tour, Google presence, sliding-scale badge.",
    capabilities: BOUTIQUE_CAPABILITIES,
  },
  boutique_pro: {
    key: "boutique_pro",
    label: "Boutique Pro",
    monthlyCents: 29900,
    setupCents: 0,
    description:
      "Everything in Boutique, plus the four front-desk multipliers: online booking, first-visit video, telehealth bridge to your existing room, and a patient onboarding hub.",
    capabilities: BOUTIQUE_PRO_CAPABILITIES,
    recommended: true,
  },
  boutique_concierge: {
    key: "boutique_concierge",
    label: "Boutique Concierge",
    monthlyCents: 64900,
    setupCents: 0,
    description:
      "Everything in Pro, plus white-glove telehealth (we set up Doxy.me Pro under your brand) and a ghostwritten Insights Journal — 14+ pieces of clinical authority per year.",
    capabilities: BOUTIQUE_CONCIERGE_CAPABILITIES,
  },
};

export const resolveTierFeatures = (
  tierKey: TierKey,
): readonly CapabilityFeature[] =>
  TIERS[tierKey].capabilities.map((k) => CAPABILITIES[k]);

export const computeMonthlyCents = (tierKey: TierKey): number =>
  TIERS[tierKey].monthlyCents;

export const computeSetupCents = (tierKey: TierKey): number =>
  TIERS[tierKey].setupCents;

export const PricingCatalogResponse = z.object({
  tiers: z.array(z.unknown()),
  capabilities: z.array(z.unknown()),
});
