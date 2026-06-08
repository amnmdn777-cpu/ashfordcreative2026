/**
 * @deprecated Phase 1A scaffold — frontend-only legacy exports.
 *
 * This file re-exports the pre-2026-05 catalog shape (PLANS A/B, ADDONS,
 * DEFAULT_FEATURES, ADDON_PACKS, computeMonthlyTotalCents) so the
 * ashford-site / ashford-rep / ashford-admin / mockup-sandbox frontends
 * compile while the api-server has already migrated to the new TIERS
 * model in `./pricing.ts`.
 *
 * THE API SERVER MUST NOT IMPORT FROM THIS FILE. New code consumes
 * `TIERS`, `CAPABILITIES`, `resolveTierFeatures`, `computeMonthlyCents`
 * directly from `./pricing.ts`.
 *
 * Phase 1B deletes this file entirely after rewriting:
 *   - artifacts/ashford-site/src/pages/Pricing.tsx          → 3-tier layout
 *   - artifacts/ashford-site/src/pages/TemplateRoute.tsx    → tier picker
 *   - artifacts/ashford-site/src/components/addons/registry.tsx → tier-feature display
 *   - artifacts/ashford-site/src/components/AddonPreviewDrawer.tsx → tier preview drawer
 *   - artifacts/ashford-site/src/preview/portal/ProspectPortal.tsx → tier-aware portal
 *   - artifacts/ashford-site/src/preview/portal/addonInline/IncludedFeaturesShowcase.tsx
 *   - artifacts/ashford-site/src/pages/PractitionerDetail.tsx
 *   - artifacts/ashford-site/src/templates/types.ts
 *   - artifacts/ashford-rep/src/pages/LeadDetail.tsx        → tier display
 *   - artifacts/ashford-rep/src/pages/resources/ReferenceGuide.tsx
 *   - artifacts/ashford-rep/src/lib/futureUpsells.ts
 *   - artifacts/ashford-admin/src/pages/PublicOnboarding.tsx → tier picker
 *   - artifacts/ashford-site/src/lib/strings.ts             → "starts at $199/mo"
 *   - artifacts/mockup-sandbox/src/components/mockups/prospect-portal/*
 *   - audit-reports/included-features-coverage.md
 *
 * Decisions: artifacts/api-server/docs/pricing-migration-decisions.md
 */
import { z } from "zod";

/** @deprecated Use TierKey from "./pricing". */
export const PlanKey = z.enum(["A", "B"]);
/** @deprecated Use TierKey from "./pricing". */
export type PlanKey = z.infer<typeof PlanKey>;

/** @deprecated Use TierDef from "./pricing". */
export type PlanDef = {
  key: "A" | "B";
  label: string;
  setupCents: number;
  monthlyCents: number;
  description: string;
  features: string[];
  recommended?: boolean;
};

/** @deprecated Use TIERS from "./pricing". */
export const PLANS: Record<"A" | "B", PlanDef> = {
  A: {
    key: "A",
    label: "New Domain",
    setupCents: 0,
    monthlyCents: 19900,
    description:
      "We pick + register your domain. $0 setup. Most therapists choose this.",
    features: [
      "We register a new domain for you",
      "$0 setup, just monthly hosting",
      "5 template choices, 3 palettes each",
      "Spanish translation included",
      "Crisis Resources footer (988)",
      "HIPAA-aware contact form",
    ],
    recommended: true,
  },
  B: {
    key: "B",
    label: "Bring Your Own Domain",
    setupCents: 29900,
    monthlyCents: 19900,
    description:
      "Keep your existing domain. We migrate, design, and host. One-time setup.",
    features: [
      "Migrate your existing domain (BYOD)",
      "5 template choices, 3 palettes each",
      "Spanish translation included",
      "Crisis Resources footer (988)",
      "HIPAA-aware contact form",
      "Mandatory hosting included",
    ],
  },
};

/** @deprecated Use TierDef.capabilities from "./pricing". */
export type AddonAngle = "client" | "doc" | "gatekeeper";

/** @deprecated Use CapabilityFeature from "./pricing". */
export type AddonDef = {
  key: string;
  label: string;
  monthlyCents: number;
  description: string;
  longPitch?: string;
  bullets?: string[];
  setupCents?: number;
  included?: boolean;
  originalMonthlyCents?: number;
  beta?: boolean;
  repPitch?: string;
  cogsCents?: number;
  longPitchEs?: string;
  bulletsEs?: string[];
  fairUseLimit?: { perMonth: number; unit: string };
};

/** @deprecated */
export type AddonPackDef = {
  key: string;
  label: string;
  monthlyCents: number;
  includedAddonKeys: string[];
  description: string;
  highlight?: string;
};

/** @deprecated */
export type AddonTier = "essentials" | "premium";

/** @deprecated */
export type AddonDefWithTier = AddonDef & {
  tier: AddonTier;
  angle: AddonAngle;
};

const tierFromCents = (cents: number): AddonTier =>
  cents > 1500 ? "premium" : "essentials";

const ADDON_DEFS: Array<AddonDef & { angle: AddonAngle }> = [
  {
    key: "online_booking",
    angle: "client",
    label: "Online Booking",
    monthlyCents: 2000,
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
  {
    key: "insurance_sliding_scale",
    angle: "client",
    label: "Insurance & Sliding Scale Badge",
    monthlyCents: 0,
    originalMonthlyCents: 1500,
    included: true,
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
  {
    key: "first_visit_video",
    angle: "client",
    label: "First-Visit Video",
    monthlyCents: 1500,
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
  {
    key: "telehealth_bridge",
    angle: "client",
    label: "Telehealth Bridge",
    monthlyCents: 2500,
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
    repPitch:
      "If they already have Doxy or Zoom, sell the Bridge: $25/mo to wrap their existing room in their brand. One permanent /visit URL replaces the dozen unique links they paste today, drops no-shows 15-25%. Don't pitch the Full Setup unless they say they have NO telehealth account.",
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
  {
    key: "telehealth_full",
    angle: "client",
    label: "Telehealth Full Setup",
    monthlyCents: 9900,
    setupCents: 14900,
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
      "$149 one-time setup covers concierge onboarding + BAA + first 30-min training",
    ],
    repPitch:
      "If they have NO telehealth account and BAAs make them tense, this is the no-brainer: $99/mo + $149 setup, we create the Doxy Pro account, walk them through the BAA in 2 minutes, run a 30-min training session. They never see Doxy's invoice — single bill from us. Your commission absorbs the $35/mo Doxy Pro COGS, blended margin ~75% year one.",
    cogsCents: 3500,
    longPitchEs:
      "Si todavía no tienes una cuenta de telesalud — o has estado postergando configurar una porque los BAAs y los documentos HIPAA te ponen tenso — lo hacemos todo. Creamos tu cuenta Doxy.me Pro, configuramos tu sala de espera con tu marca (logo, colores, mensaje de espera), te guiamos por la firma del BAA en menos de dos minutos (el único paso legalmente requerido), y corremos una sesión de incorporación en video de 30 minutos para que la primera vez no sea con un paciente real. Tu factura mensual con nosotros cubre todo — Doxy.me Pro está en nuestra tarjeta, nunca lo ves. La página /sesion con tu marca del complemento Bridge está incluida. Si alguna vez cambiamos de proveedor te avisamos 90 días antes y migramos sin costo adicional.",
    bulletsEs: [
      "Cuenta Doxy.me Pro creada + sala de espera con tu marca configurada",
      "Acompañamiento para firmar el BAA — 2 minutos de tu tiempo, único paso legalmente requerido",
      "Sesión de incorporación de 30 min en video para que la primera vez no sea con un paciente",
      "Página /sesion con tu marca en tu sitio (Telehealth Bridge incluido)",
      "Una sola factura mensual — facturación de Doxy.me Pro manejada de nuestro lado",
      "$149 instalación única cubre incorporación conserje + BAA + primera sesión de 30 min",
    ],
  },
  {
    key: "blog_publishing",
    angle: "doc",
    label: "Insights Journal",
    monthlyCents: 2000,
    description:
      "We ghostwrite the first 3 posts to seed your journal, then ghostwrite one new piece every month — monthly ghostwriting included, no extra invoice.",
    longPitch:
      "Most therapists know they should be writing but never have the time. We do it for you. To launch your journal we ghostwrite the first 3 posts (kicking off month one) so you start with real depth, then every month after that we interview you for 20 minutes about a case theme, a modality you're leaning on, or a question patients keep asking — and ghostwrite a 600-word piece in your voice. You approve it in one click, and it ships. Monthly ghostwriting is included in the $20/mo — never an extra invoice. Over a year that's 14+ posts of real clinical authority that Google indexes, peers cite, and prospective patients actually read.",
    bullets: [
      "We ghostwrite the first 3 posts at launch — your journal opens with real depth",
      "Monthly ghostwriting included — 20-min interview, we draft the piece",
      "Editor-in-chief review for clinical tone and accuracy",
      "Auto-translated to Spanish and SEO-optimised",
      "One-click approve and publish, no CMS to learn",
    ],
  },
  // 2026-05-21 — `patient_onboarding_hub` legacy entry dropped (Sprint 2 streamline).
];

/** @deprecated Use TIERS from "./pricing". */
export const ADDONS: Record<string, AddonDefWithTier> = Object.fromEntries(
  ADDON_DEFS.map((a) => [
    a.key,
    { ...a, tier: tierFromCents(a.monthlyCents) },
  ]),
);

/** @deprecated */
export const RETIRED_ADDONS: readonly string[] = [
  "spanish_pro",
  "identity_pages",
  "modalities_filter",
  "phq9_screener",
  "ai_quiz",
  "google_profile_sync",
  "welcome_kit",
  "intake_forms_hub",
  "cancellation_self_serve",
  "insurance_precheck",
];

/** @deprecated Use CAPABILITY_KEYS from "./pricing". */
export const DEFAULT_FEATURE_KEYS = [
  "spanish_translation",
  "crisis_hotline_button",
  "office_tour",
  "google_business_presence",
  "daily_schedule_digest",
  "social_row",
] as const;
/** @deprecated */
export type DefaultFeatureKey = (typeof DEFAULT_FEATURE_KEYS)[number];

/** @deprecated */
export type DefaultFeature = {
  key: DefaultFeatureKey;
  label: string;
  description: string;
};

/** @deprecated Use CAPABILITIES from "./pricing". */
export const DEFAULT_FEATURES: readonly DefaultFeature[] = [
  {
    key: "spanish_translation",
    label: "Spanish Translation",
    description:
      "Every site ships fully bilingual EN/ES at launch. We translate continuously when you update copy — no extra fee.",
  },
  {
    key: "crisis_hotline_button",
    label: "Crisis Resources Button",
    description:
      "A floating, always-visible 988 button with the option to call or text — present on every page, every template.",
  },
  {
    key: "office_tour",
    label: "Office Tour Photo Strip",
    description:
      "A small photo grid of your real office — door, waiting room, your chair — so first-time patients know exactly what to expect.",
  },
  {
    key: "google_business_presence",
    label: "Google Business Presence",
    description:
      "One Google integration covering three things: auto-synced reviews from Google + Healthgrades, a live map + directions on every page, and your contact info + hours pulled straight from your Google Business Profile.",
  },
  {
    key: "daily_schedule_digest",
    label: "Daily Schedule Digest",
    description:
      "Front desk gets a calm 7am email with the day's appointments, cancellations, and any new bookings overnight.",
  },
  {
    key: "social_row",
    label: "Social Profiles Row",
    description:
      "Footer row links Instagram, LinkedIn, Facebook, and TikTok — whichever ones you actually use, none of the ones you don't.",
  },
];

/** @deprecated Packs are retired; kept as empty record for callsite compat. */
export const ADDON_PACKS: Record<string, AddonPackDef> = {};

/** @deprecated Use computeMonthlyCents(tierKey) from "./pricing". */
export const computeMonthlyTotalCents = (
  planKey: "A" | "B",
  selectedKeys: string[],
): number => {
  let total = PLANS[planKey].monthlyCents;
  const seen = new Set<string>();
  for (const k of selectedKeys) {
    if (seen.has(k)) continue;
    seen.add(k);
    if (ADDON_PACKS[k]) {
      total += ADDON_PACKS[k].monthlyCents;
      for (const inc of ADDON_PACKS[k].includedAddonKeys) seen.add(inc);
    } else if (ADDONS[k]) {
      total += ADDONS[k].monthlyCents;
    }
  }
  return total;
};
