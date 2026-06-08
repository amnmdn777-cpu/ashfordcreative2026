import { z } from "zod";
import { TemplateKey, PreviewContent, PreviewWebsitePage } from "./preview";
import { TierKey } from "./pricing";

/**
 * Public-facing payload for a personalized prospect portal. The shape is
 * intentionally minimal so we can render the portal page from a single GET
 * with no extra round-trips.
 */
const HexColor = z.string().regex(/^#[0-9a-fA-F]{3,8}$/);
export const PortalCustomizations = z.object({
  paletteKey: z.string().optional(),
  typographyKey: z.string().optional(),
  headline: z.string().max(160).optional(),
  about: z.string().max(2000).optional(),
  copyOverrides: z.record(z.string(), z.string()).optional(),
  /** Per-key palette overrides applied on top of `paletteKey`. */
  colorOverrides: z
    .object({
      primary: HexColor.optional(),
      accent: HexColor.optional(),
      surface: HexColor.optional(),
      ink: HexColor.optional(),
      muted: HexColor.optional(),
    })
    .optional(),
  /** Free-form font family strings (CSS font-family value). */
  fontDisplay: z.string().max(120).optional(),
  fontBody: z.string().max(120).optional(),
  /**
   * Domain the prospect (or rep) chose from the live picker. Stored as a
   * bare string (e.g. "drmariarivas.com") so it survives portal refreshes
   * and shows up in the rep's LeadDetail and ReserveModal flows.
   */
  chosenDomain: z.string().max(253).optional(),
  /**
   * Rep-chosen pricing plan for the outbound preview email + follow-up
   * payment link. Set from the "Send preview email" modal in the rep
   * dashboard. Defaults to "boutique" when unset.
   */
  pricingPlan: TierKey.optional(),
});
export type PortalCustomizations = z.infer<typeof PortalCustomizations>;

/**
 * Normalized enrichment surface for the prospect portal. Built server-side
 * from the latest `lead_enrichment.payload` (currently Google Places only)
 * so the portal can render the prospect's *own* photos, real address, real
 * Google reviews and real hours instead of generic SAMPLE defaults.
 *
 * `photoUrls` are pre-built proxy URLs pointing at our own
 * `/api/public/portals/:slug/photos/:idx` endpoint — never raw Google URLs,
 * because those would expose our `GOOGLE_PLACES_API_KEY` in the prospect's
 * browser. The proxy 302-redirects to the redirected googleusercontent URL
 * after stripping the key.
 *
 * Every field is nullable / array-default-empty so consumers can use simple
 * `enrichment?.foo ?? fallback` chaining without exhaustive null checks.
 */
export const PortalEnrichmentReview = z.object({
  author: z.string(),
  rating: z.number().int().min(1).max(5),
  text: z.string(),
  relativeTime: z.string().nullable(),
  source: z.string().default("Google"),
});
export type PortalEnrichmentReview = z.infer<typeof PortalEnrichmentReview>;

export const PortalEnrichmentHours = z.object({
  day: z.string(),
  open: z.string(),
});
export type PortalEnrichmentHours = z.infer<typeof PortalEnrichmentHours>;

export const PortalEnrichmentFieldsCompleteness = z.object({
  filled: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});
export type PortalEnrichmentFieldsCompleteness = z.infer<
  typeof PortalEnrichmentFieldsCompleteness
>;

/**
 * Headway provider profile (https://headway.co). Only present when the
 * Headway enrichment source matched a public profile for this lead. The
 * "money" field is `acceptedInsurances` — Headway is the most reliable
 * source for that signal in mental-health verticals.
 */
export const HeadwayProfile = z.object({
  profileUrl: z.string(),
  photoUrl: z.string().nullable(),
  bio: z.string().nullable(),
  specialties: z.array(z.string()),
  modalities: z.array(z.string()),
  acceptedInsurances: z.array(z.string()),
  languages: z.array(z.string()),
  inPerson: z.boolean(),
  virtual: z.boolean(),
  location: z.object({
    city: z.string().nullable(),
    state: z.string().nullable(),
  }),
  pricePerSession: z
    .object({ min: z.number().nullable(), max: z.number().nullable() })
    .nullable(),
  acceptsSlidingScale: z.boolean(),
  matchScore: z.number(),
  npiMatch: z.boolean(),
});
export type HeadwayProfile = z.infer<typeof HeadwayProfile>;

export const PortalEnrichment = z.object({
  placeId: z.string().nullable(),
  formattedAddress: z.string().nullable(),
  formattedPhone: z.string().nullable(),
  website: z.string().nullable(),
  rating: z.number().nullable(),
  totalReviews: z.number().int().nullable(),
  photoUrls: z.array(z.string()),
  hero: z.string().nullable(),
  services: z.array(z.string()),
  team: z.array(
    z.object({
      name: z.string(),
      credentials: z.string().nullable(),
      bio: z.string().nullable(),
      photo: z.string().nullable(),
    }),
  ),
  reviews: z.array(PortalEnrichmentReview),
  hours: z.array(PortalEnrichmentHours),
  fetchedAt: z.string(),
  fieldsCompleteness: PortalEnrichmentFieldsCompleteness,
  fieldSources: z.record(z.string(), z.string()),
  /**
   * Headway directory profile, when matched. The portal merge layer reads
   * this from the latest `headway` enrichment row for the lead. Optional
   * because most leads will not have a Headway listing. The rep dashboard
   * surfaces a "Headway profile" mini-block in the snapshot column when
   * present.
   */
  headway: HeadwayProfile.nullable().optional(),
});
export type PortalEnrichment = z.infer<typeof PortalEnrichment>;

export const PortalAddon = z.object({
  slug: z.string(),
  name: z.string(),
  shortDescription: z.string(),
  monthlyCents: z.number().int().nonnegative(),
  perPatientCents: z.number().int().nonnegative().nullable().optional(),
  setupCents: z.number().int().nonnegative(),
  bundleSlug: z.string().nullable().optional(),
  /**
   * Pre-bundling sticker price for free/included add-ons. The portal
   * renders this struck through next to the "Included" badge so the
   * prospect feels the value of the bundle. Omit for paid add-ons.
   */
  originalMonthlyCents: z.number().int().nonnegative().nullable().optional(),
});
export type PortalAddon = z.infer<typeof PortalAddon>;

export const PortalPublicResponse = z.object({
  slug: z.string(),
  /**
   * Echo of the access token the client provided. The frontend captures it
   * once on initial GET and re-sends with every mutation, so the prospect
   * doesn't have to keep `?t=` in the URL after the first navigation.
   */
  accessToken: z.string(),
  /**
   * Image-only signature embedded in the `<meta og:image>` URL so link
   * unfurlers (iMessage, Slack, Discord, Twitter) can fetch the
   * personalized OG image without exposing the full access token. The
   * signature only authorizes the OG endpoint.
   */
  ogSignature: z.string(),
  practice: z.string(),
  name: z.string(),
  specialty: z.string(),
  city: z.string(),
  state: z.string(),
  phone: z.string(),
  email: z.string().nullable().optional(),
  /**
   * Lead-pinned locale (`en` | `es`). The portal mounts in this locale
   * regardless of the visitor's browser preference or any persisted
   * site-wide language choice. The rep selects this when creating the
   * lead so we serve the prospect a single, intentional language.
   */
  locale: z.enum(["en", "es"]).default("en"),
  profileBlurb: z.string().nullable().optional(),
  selectedTemplate: TemplateKey,
  customizations: PortalCustomizations,
  enrichmentSnapshot: z.record(z.string(), z.unknown()).nullable().optional(),
  /**
   * Real, normalized enrichment data (currently from Google Places). Lets the
   * portal render the prospect's own photos, address, hours, and Google
   * reviews instead of the SAMPLE defaults. `null` when no enrichment row
   * exists yet for this lead — the orchestrator runs fire-and-forget on
   * portal creation so this typically populates within seconds.
   */
  enrichment: PortalEnrichment.nullable(),
  /**
   * Rich, preview-quality personalized content (real practice name,
   * AI-rewritten mission, services with descriptions, hero image, team
   * with bios, etc.) — built server-side via the same `buildPreviewContent`
   * pipeline the rep-side ProspectPreview uses. The portal client prefers
   * this over the legacy `enrichment` field when present, so the prospect
   * sees their own data instead of SAMPLE defaults (Maya Alvarado, etc.).
   * `null` if buildPreviewContent failed; the client falls back to the
   * lighter `enrichment` field then the SAMPLE defaults.
   */
  previewContent: PreviewContent.nullable(),
  /**
   * Pages we crawled from the prospect's existing website (re-imagined
   * with AI-rewritten intros). Empty array when no crawl ran. Surfaced
   * in the portal as a "Your site, re-imagined" section with a tab nav.
   */
  pages: z.array(PreviewWebsitePage).default([]),
  addons: z.array(PortalAddon),
  /**
   * Last persisted cart so the prospect's add-on selection survives a
   * reload. `null` if they have not touched the cart yet.
   */
  cart: z
    .object({
      templateKey: TemplateKey,
      addonSlugs: z.array(z.string()),
    })
    .nullable(),
  /**
   * Assigned rep contact card. `null` for unclaimed (pool) leads — the
   * portal hides the "Talk to a human" floating button entirely in that
   * case rather than surfacing a generic mailbox.
   *
   * `firstName` is derived server-side (first token of `displayName`) so
   * the help panel can greet the prospect with a person, not a full name.
   * `phone`, `email`, and `avatarUrl` are nullable: a rep that hasn't
   * filled in a value simply gets that row hidden in the panel.
   */
  rep: z.object({
    displayName: z.string(),
    firstName: z.string(),
    promoCode: z.string(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  }).nullable(),
  baseMonthlyCents: z.number().int().default(19900),
  baseSetupCents: z.number().int().default(0),
});
export type PortalPublicResponse = z.infer<typeof PortalPublicResponse>;

export const PortalPatchCustomizationsRequest = z.object({
  selectedTemplate: TemplateKey.optional(),
  customizations: PortalCustomizations.optional(),
});
export type PortalPatchCustomizationsRequest = z.infer<
  typeof PortalPatchCustomizationsRequest
>;

export const PortalEventType = z.enum([
  "opened",
  "template_view",
  "template_selected",
  "customize",
  "addon_view",
  "addon_toggle",
  "cart_update",
  "reserve_clicked",
  "reserve_succeeded",
  "share_link_copied",
  "exit",
  // Trust-signal interactions on the prospect portal. Both surface in the
  // rep timeline as pre-call signals: a prospect who opened the help panel
  // or expanded multiple FAQ entries is actively de-risking.
  "help_panel_open",
  "faq_open",
]);
export type PortalEventType = z.infer<typeof PortalEventType>;

export const PortalEventRequest = z.object({
  eventType: PortalEventType,
  templateKey: TemplateKey.optional(),
  addonSlug: z.string().max(48).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  sessionId: z.string().max(64).optional(),
  durationMs: z.number().int().nonnegative().optional(),
});
export type PortalEventRequest = z.infer<typeof PortalEventRequest>;

export const PortalCartRequest = z.object({
  templateKey: TemplateKey,
  addonSlugs: z.array(z.string().max(48)).max(20),
});
export type PortalCartRequest = z.infer<typeof PortalCartRequest>;

export const PortalReserveRequest = z.object({
  templateKey: TemplateKey,
  /**
   * Tier the prospect is reserving. Defaults to `boutique` so frontends still
   * on the legacy shim (which doesn't send a tier yet) keep working. Phase 1B
   * makes the portal a tier picker and removes the default.
   */
  tierKey: TierKey.default("boutique"),
  /**
   * Legacy: pre-tier portal carts shipped a flat addon slug list. Retained as
   * an optional read-only metadata signal so the rep dashboard can still
   * surface what the prospect was eyeing, but ignored by checkout pricing.
   */
  addonSlugs: z.array(z.string().max(48)).max(20).default([]),
  customerEmail: z.string().email(),
  customerName: z.string().max(120).optional(),
  /**
   * The domain the prospect picked from the live picker (any surface). Stamped
   * onto the Stripe subscription/PaymentIntent metadata so the post-payment
   * webhook can hand it straight to the registrar without a second round
   * trip. Optional — empty when the prospect skipped the picker.
   */
  chosenDomain: z.string().max(253).optional(),
});
export type PortalReserveRequest = z.infer<typeof PortalReserveRequest>;

export const PortalReserveResponse = z.object({
  mode: z.enum(["payment_intent", "checkout_session", "fallback"]),
  clientSecret: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  publishableKey: z.string().nullable().optional(),
});
export type PortalReserveResponse = z.infer<typeof PortalReserveResponse>;

/**
 * Subset of `PortalEnrichment` that the inline Google Profile Sync card
 * actually displays as identity (the headline-adjacent practice info).
 * The card needs ALL three to be honest — anything less means we'd be
 * silently substituting a sample value next to the prospect's real
 * practice name (e.g. real address next to a fake "(512) 555-0198"
 * phone, or real phone next to a fake "4.9 (38)" rating). That
 * partial-mix is the "looks broken" failure mode reps were hitting
 * during walkthroughs.
 *
 * Both surfaces (the inline preview AND the rep dashboard's enrichment
 * health row) MUST share this predicate so a green dashboard never
 * lies about an amber portal.
 */
export const GOOGLE_INLINE_CORE_FIELDS = [
  "formattedAddress",
  "formattedPhone",
  "rating",
] as const;

/**
 * True iff every Google-inline core identity field landed from the
 * `google_places` source, per the portal's `fieldSources` map.
 *
 * Pass the portal's `fieldSources` (a `Record<string,string>` mapping
 * each visible field name to the source key that contributed it).
 * When `fieldSources` is undefined / null (e.g. portal not loaded
 * yet), returns `false` — the caller should treat that as "unknown,
 * show neutral state".
 */
export const isGoogleInlineFullySynced = (
  fieldSources: Record<string, string> | null | undefined,
): boolean => {
  if (!fieldSources) return false;
  return GOOGLE_INLINE_CORE_FIELDS.every(
    (f) => fieldSources[f] === "google_places",
  );
};

/**
 * Pre-call AI briefing computed from portal activity + enrichment. Soft-fails
 * (returns nulls) if no LLM key is configured.
 */
export const BriefingResponse = z.object({
  /** Pre-call summary paragraph (6–10 sentences) from LLM or heuristic fallback. */
  summary: z.string(),
  /** 5–7 short talking points the rep can lean on. */
  talkingPoints: z.array(z.string()),
  /** 0–3 cautions surfaced from portal activity / enrichment gaps. */
  redFlags: z.array(z.string()),
  /** ISO timestamp the briefing was generated. */
  generatedAt: z.string(),
  /** Which generator produced this briefing. */
  sourceLabel: z.enum(["openai", "anthropic", "heuristic"]),
});
export type BriefingResponse = z.infer<typeof BriefingResponse>;
