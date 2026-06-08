import { z } from "zod";

// Catalog: garden, sunrise, constellation, polaroid, playful_modern,
// front_porch, hello_friend. atrium + quiet_practice were retired
// 2026-05 along with framework + navy_editorial; legacy stored values
// are normalised by `normalizeTemplateKey` at the boundary.
export const TemplateKey = z.enum([
  "garden",
  "sunrise",
  "constellation",
  "polaroid",
  "playful_modern",
  "front_porch",
  "hello_friend",
]);
export type TemplateKey = z.infer<typeof TemplateKey>;

// One canonical palette per template.
export const PaletteKey = z.enum([
  "garden_sage",
  "sunrise_coral",
  "constellation_amber",
  "polaroid_paper",
  "playful_modern_peach",
  "front_porch_cedar",
  "hello_friend_indigo",
]);
export type PaletteKey = z.infer<typeof PaletteKey>;

export const CreatePreviewLinkRequest = z.object({
  leadId: z.number().int(),
});
export type CreatePreviewLinkRequest = z.infer<typeof CreatePreviewLinkRequest>;

export const PreviewLinkResponse = z.object({
  token: z.string(),
  url: z.string(),
});
export type PreviewLinkResponse = z.infer<typeof PreviewLinkResponse>;

export const PreviewLeadInfo = z.object({
  practice: z.string(),
  name: z.string(),
  specialty: z.string(),
  city: z.string(),
  state: z.string(),
  phone: z.string(),
  profileBlurb: z.string().nullable(),
  rep: z.object({
    displayName: z.string(),
    promoCode: z.string(),
  }),
});
export type PreviewLeadInfo = z.infer<typeof PreviewLeadInfo>;

/**
 * One internal page discovered on the prospect's existing website. The
 * preview surfaces these as a "Pages we'll bring over" callout so the
 * prospect sees we'll re-create their existing site structure.
 */
export const PreviewWebsitePage = z.object({
  url: z.string(),
  path: z.string(),
  title: z.string().nullable(),
  h1: z.string().nullable(),
  summary: z.string().nullable(),
  /** Up to 4 leading paragraphs (>=60 chars each) lifted from the page body. */
  paragraphs: z.array(z.string()).default([]),
  /** Up to 4 absolute image URLs from the page (filtered to >=200px hints). */
  images: z.array(z.string()).default([]),
  /** "home" | "about" | "services" | "team" | "contact" | "fees" | "blog" | "other" */
  kind: z.string(),
  /** AI-rewritten intro for this page in the new template's voice. The
   * preview surfaces this so the prospect sees their existing copy
   * actually re-imagined, not just listed by URL. */
  rewrittenIntro: z.string().nullable().default(null),
});
export type PreviewWebsitePage = z.infer<typeof PreviewWebsitePage>;

/**
 * Personalized template content for a single prospect, derived from the
 * latest enrichment payloads (Google Places, Psychology Today, NPI, the
 * prospect's own website crawl, etc.). Each populated field is a real
 * value scraped from a known source. Empty arrays / null values mean we
 * had no signal — the renderer falls back to its template-default sample
 * for those slots.
 */
export const PreviewContentTeamMember = z.object({
  name: z.string(),
  credentials: z.string().nullable(),
  bio: z.string().nullable(),
  photo: z.string().nullable(),
});
export type PreviewContentTeamMember = z.infer<typeof PreviewContentTeamMember>;

export const PreviewContentReview = z.object({
  author: z.string(),
  body: z.string(),
  rating: z.number().int().min(1).max(5),
  source: z.string(),
});
export type PreviewContentReview = z.infer<typeof PreviewContentReview>;

export const PreviewContentLocation = z.object({
  name: z.string(),
  address: z.string(),
  hours: z.array(z.object({ day: z.string(), open: z.string() })),
});
export type PreviewContentLocation = z.infer<typeof PreviewContentLocation>;

export const PreviewContentService = z.object({
  name: z.string(),
  description: z.string().nullable().default(null),
});
export type PreviewContentService = z.infer<typeof PreviewContentService>;

/**
 * Hand-curated testimonial pulled from the prospect's own site (NOT a
 * Google review). These are usually richer and longer than directory
 * reviews and tell a different trust story — "the prospect picked these
 * to put on their site themselves".
 */
export const PreviewContentTestimonial = z.object({
  author: z.string().nullable(),
  body: z.string(),
  /** Where on the prospect's site we found it (URL or path). */
  source: z.string().nullable().default(null),
});
export type PreviewContentTestimonial = z.infer<typeof PreviewContentTestimonial>;

/**
 * Long-form testimonial used by the Navy Editorial template. Same
 * shape as `testimonials` but expects 300-800 char `body` length so
 * the editorial layout has enough copy to fill a full section.
 * Anonymized leads keep the trust signal while protecting client
 * identity.
 */
export const PreviewContentLongTestimonial = z.object({
  author: z.string().nullable(),
  body: z.string(),
  anonymized: z.boolean().default(false),
});
export type PreviewContentLongTestimonial = z.infer<
  typeof PreviewContentLongTestimonial
>;

/**
 * Methodology diagram input for the Framework template. The
 * practitioner's approach broken into 4-7 named stages/rings/pillars
 * (e.g. EMDR's 8-phase protocol, IFS's parts-and-Self model,
 * William Federico's six-ring mandala). The Framework renderer
 * builds an SVG diagram from this data — caller doesn't supply
 * coordinates or paths, just the names + descriptions.
 */
export const PreviewContentMethodology = z.object({
  title: z.string(),
  /** Short subtitle / philosophy statement under the title. */
  subtitle: z.string().nullable().default(null),
  rings: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
      }),
    )
    .min(3)
    .max(8),
});
export type PreviewContentMethodology = z.infer<
  typeof PreviewContentMethodology
>;

/**
 * Practice-level statistics for the Framework template's "expertise
 * receipts" strip (William Federico style: "2,000+ clients · 84%
 * outcome improvement · 12 years in practice"). Pulled from NPI +
 * directory listings + rep-curated values.
 */
export const PreviewContentClinicalStats = z.object({
  yearsInPractice: z.number().nullable().default(null),
  clientsServed: z.number().nullable().default(null),
  /** Free-form short label rows (e.g. "84% report symptom relief"). */
  outcomeMetrics: z.array(z.string()).default([]),
  /** Specialty areas with depth labels — extracted from NPI taxonomy
   * + directory specialties cross-referenced. */
  specialtyAreas: z.array(z.string()).default([]),
});
export type PreviewContentClinicalStats = z.infer<
  typeof PreviewContentClinicalStats
>;

/**
 * Pricing tier with rationale (Navy Editorial). Some private-pay
 * therapists publish their pricing reasoning explicitly to attract
 * the right clients ("$200/session because the work demands my full
 * attention; sliding scale tier 1 at $120 reserved for X reasons").
 */
export const PreviewContentPricingTier = z.object({
  /** Dollar amount per session. Null for "contact me". */
  amount: z.number().nullable(),
  /** Short label, e.g. "Standard", "Sliding scale tier 1". */
  label: z.string(),
  /** 1-3 sentence rationale visible on the template. */
  rationale: z.string().nullable().default(null),
});
export type PreviewContentPricingTier = z.infer<
  typeof PreviewContentPricingTier
>;

/**
 * Press / featured-in entry for the Playful Modern template's
 * credibility strip. Logo URL is optional because trademark licenses
 * vary; when null the template renders the publication name in a
 * monospace label instead.
 */
export const PreviewContentFeaturedIn = z.object({
  name: z.string(),
  logoUrl: z.string().nullable().default(null),
  articleUrl: z.string().nullable().default(null),
});
export type PreviewContentFeaturedIn = z.infer<
  typeof PreviewContentFeaturedIn
>;

/**
 * Visual identity extracted from the prospect's existing website. Lets
 * templates surface their real logo, accent color, and typeface so the
 * preview reads as "your brand, redesigned" rather than "a generic
 * theme with your name on it". All fields nullable — when absent the
 * template falls back to its own palette.
 */
export const PreviewContentBrand = z.object({
  /** Absolute URL to the logo image (PNG/SVG/JPEG). First-party hosts only. */
  logoUrl: z.string().nullable().default(null),
  /** Absolute URL to the favicon. Used for tab/preview chrome. */
  faviconUrl: z.string().nullable().default(null),
  /** Brand accent color extracted from `<meta name="theme-color">` or
   * the most prominent CSS color on the homepage. Hex format `#rrggbb`. */
  accentColor: z.string().nullable().default(null),
  /** Primary typeface family loaded by the prospect's site, e.g.
   * "Playfair Display" or "Inter". Lifted from `font-family` declarations.
   *
   * **Metadata only — DO NOT inject into the prospect-facing UI.**
   * This field exists so the rep dashboard can hint at the prospect's
   * existing typographic identity ("they use Playfair Display, the
   * Atrium template's Cormorant pairs nicely"). Applying an arbitrary
   * font-family from a third-party site to our own templates would
   * defeat the design system — extracted fonts may be unsupported,
   * unlicensed, or simply ugly. The five canonical templates each
   * ship with a curated typeface; let them win. */
  fontFamily: z.string().nullable().default(null),
});
export type PreviewContentBrand = z.infer<typeof PreviewContentBrand>;

/**
 * Public social handles / profile URLs we discovered. All optional —
 * the preview surfaces a row of icons for whatever it has.
 */
export const PreviewContentSocialLinks = z.object({
  instagram: z.string().nullable().default(null),
  facebook: z.string().nullable().default(null),
  linkedin: z.string().nullable().default(null),
  tiktok: z.string().nullable().default(null),
  youtube: z.string().nullable().default(null),
  psychologyToday: z.string().nullable().default(null),
  headway: z.string().nullable().default(null),
});
export type PreviewContentSocialLinks = z.infer<typeof PreviewContentSocialLinks>;

export const PreviewContent = z.object({
  /** Real practice name from enrichment / lead, e.g. "Lifeworks Online". */
  practiceName: z.string().nullable(),
  /** Short tagline — typically the rep-written profileBlurb. */
  tagline: z.string().nullable(),
  /** Longer mission statement; falls back to website meta description. */
  mission: z.string().nullable(),
  heroImage: z.string().nullable(),
  /** Service list — name + optional description. Promoted from plain
   * strings so AI-synthesized payloads can attach short blurbs that the
   * templates render under each service tile. Backward-compatible: a
   * mapper can produce {name, description: null} from any old string list. */
  services: z.array(PreviewContentService),
  team: z.array(PreviewContentTeamMember),
  reviews: z.array(PreviewContentReview),
  /** Hand-curated testimonials from the prospect's own site. */
  testimonials: z.array(PreviewContentTestimonial).default([]),
  locations: z.array(PreviewContentLocation),
  contact: z.object({
    phone: z.string().nullable(),
    email: z.string().nullable(),
    website: z.string().nullable(),
  }),
  /** Public social profile URLs (Instagram, LinkedIn, PT, Headway…). */
  socialLinks: PreviewContentSocialLinks.default({
    instagram: null,
    facebook: null,
    linkedin: null,
    tiktok: null,
    youtube: null,
    psychologyToday: null,
    headway: null,
  }),
  /** Visual identity (logo, accent, font) lifted from the existing site. */
  brand: PreviewContentBrand.default({
    logoUrl: null,
    faviconUrl: null,
    accentColor: null,
    fontFamily: null,
  }),
  /** Clinical specialties / populations served (e.g. "Anxiety", "LGBTQ+",
   * "Trauma-EMDR"). PT + Headway are the strongest sources. */
  specialties: z.array(z.string()).default([]),
  /** Insurances the practice accepts. Trust signal #1 for therapy
   * prospects — almost always lifted verbatim from Headway / PT. */
  acceptedInsurances: z.array(z.string()).default([]),
  /** Languages spoken in session (multi-source: PT, Headway, NPI). */
  languages: z.array(z.string()).default([]),
  /** Therapy modalities / techniques used (CBT, EMDR, IFS, …). */
  modalities: z.array(z.string()).default([]),
  /** Whether the practice offers in-person sessions. Null when unknown. */
  offersInPerson: z.boolean().nullable().default(null),
  /** Whether the practice offers telehealth / virtual sessions. */
  offersTelehealth: z.boolean().nullable().default(null),
  /** True iff the practice advertises a sliding-scale fee. */
  acceptsSlidingScale: z.boolean().nullable().default(null),
  /** Per-session price band when known (USD). */
  pricePerSession: z
    .object({ min: z.number().nullable(), max: z.number().nullable() })
    .nullable()
    .default(null),
  rating: z.number().nullable(),
  totalReviews: z.number().int().nullable(),
  /** Methodology diagram data for the Framework template. Optional
   * because most leads don't have a structured methodology — when
   * absent, the rep can draft one in the dashboard and save it. */
  methodology: PreviewContentMethodology.nullable().default(null),
  /** Practice-level expertise receipts for the Framework template. */
  clinicalStats: PreviewContentClinicalStats.nullable().default(null),
  /** Pricing tiers with rationale for the Navy Editorial template. */
  pricingTiers: z.array(PreviewContentPricingTier).default([]),
  /** Long-form testimonials (300-800 chars) for the Navy Editorial
   * template. Distinct from the shorter `testimonials` field which
   * the other templates render as cards. */
  testimonialsLong: z.array(PreviewContentLongTestimonial).default([]),
  /** Press / featured-in entries for the Playful Modern template. */
  featuredIn: z.array(PreviewContentFeaturedIn).default([]),
  /** Defining conditions/issues the practice treats — used by the
   * Playful Modern template's scrolling carousel. Often the same
   * data as `specialties` but with a different display target, so
   * we keep it as its own field for surface-level overrides. */
  conditionsCarousel: z.array(z.string()).default([]),
  /** Optional intro video URL (Vimeo/YouTube/etc.) — used by
   * Playful Modern + Navy Editorial. Extracted by the Zencare/PT
   * scrapers via `extractVideoCandidates`. */
  introVideoUrl: z.string().nullable().default(null),
  /** Booking widget detected on the prospect's existing site
   * (Calendly / IntakeQ / SimplePractice / etc.) so every template
   * can render a "Book a 15-min consult" CTA that just works. When
   * null, templates fall back to a `tel:` link via the contact
   * phone — therapists almost universally have *some* booking
   * widget so the null fallback should be rare. */
  bookingWidget: z
    .object({
      provider: z.string(),
      url: z.string(),
    })
    .nullable()
    .default(null),
  /** Available domain suggestions surfaced as a wow moment on the
   * preview ("drmayaalvarado.com is available, we'll grab it for
   * free"). The portal can promote one to the prospect's chosen
   * domain when they hit Reserve. */
  domainSuggestions: z
    .array(z.object({ domain: z.string(), available: z.boolean() }))
    .default([]),
  /** AI-drafted blog posts pre-written from the practitioner's PT
   * bio + specialties, ready to publish day-1 of the launch. Each
   * has a tone-matched title, slug, excerpt, and 3-paragraph body. */
  draftedJournalEntries: z
    .array(
      z.object({
        title: z.string(),
        slug: z.string(),
        excerpt: z.string(),
        body: z.string(),
        readingMinutes: z.number().int().min(1).max(30),
      }),
    )
    .default([]),
  /** Pages we've already drafted for the prospect from their existing
   * site + directory profiles — About, Services, Fees, FAQ,
   * Conditions, Insurance — each one ready to slot into the new
   * site's page navigation. */
  draftedPages: z
    .array(
      z.object({
        kind: z.string(),
        slug: z.string(),
        title: z.string(),
        h1: z.string().nullable(),
        body: z.array(z.string()),
        sourceUrl: z.string().nullable(),
      }),
    )
    .default([]),
  /** Per-field source attribution: { practiceName: "google_places", ... } */
  fieldSources: z.record(z.string(), z.string()),
});
export type PreviewContent = z.infer<typeof PreviewContent>;

export const PreviewResponse = z.object({
  info: PreviewLeadInfo,
  content: PreviewContent,
  /** Pages we crawled from the prospect's existing website, if any. */
  pagesFromWebsite: z.array(PreviewWebsitePage),
});
export type PreviewResponse = z.infer<typeof PreviewResponse>;

// Discriminated union by eventType so each variant carries exactly the right payload.
export const PreviewEventRequest = z.discriminatedUnion("eventType", [
  z.object({ eventType: z.literal("opened") }),
  z.object({
    eventType: z.literal("viewed_template"),
    templateKey: TemplateKey,
  }),
  z.object({
    eventType: z.literal("preferred_template"),
    templateKey: TemplateKey,
  }),
  z.object({
    eventType: z.literal("requested_changes"),
    templateKey: TemplateKey.optional(),
    changeRequestText: z.string().min(1).max(2000),
  }),
  z.object({
    eventType: z.literal("requested_callback"),
    changeRequestText: z.string().max(2000).optional(),
  }),
]);
export type PreviewEventRequest = z.infer<typeof PreviewEventRequest>;
