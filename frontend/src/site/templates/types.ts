import type { ReactNode } from "react";
import { z } from "zod";
import type { PaletteDef, TemplateKey } from "@workspace/api-zod";

export type AddonKey =
  | "booking_widget"
  | "match_quiz"
  | "phq9"
  | "gad7"
  | "platform_badges"
  | "modalities_filter"
  | "identity_tags"
  | "sliding_scale"
  | "encrypted_intake"
  | "podcast_embed"
  | "directory";

export const ALL_ADDONS: AddonKey[] = [
  "booking_widget",
  "match_quiz",
  "phq9",
  "gad7",
  "platform_badges",
  "modalities_filter",
  "identity_tags",
  "sliding_scale",
  "encrypted_intake",
  "podcast_embed",
  "directory",
];

export interface Service {
  name: string;
  description: string;
  iconKey?: string;
}

export interface TeamMember {
  /** URL-safe slug for the practitioner sub-page route. Required for templates that link out. */
  slug: string;
  name: string;
  credentials: string;
  photo: string;
  /**
   * @deprecated Use `bio_en` / `bio_es`. Kept as a fallback alias so legacy
   * lead records (and the EN sample) keep rendering. New code should write
   * locale-specific bios; templates read whichever locale is active and fall
   * back to `bio` only when the locale-specific field is empty.
   */
  bio: string;
  /** Locale-specific bio for the prospect-portal flow (preferred). */
  bio_en?: string;
  /** Locale-specific bio for the prospect-portal flow (preferred). */
  bio_es?: string;
  /** Optional long-form bio paragraphs for the practitioner detail sub-page. */
  longBio?: string[];
  modalities: string[];
  identities?: string[];
  pronouns?: string;
  /** Optional clinical/legal disclaimer specific to this clinician. */
  disclaimer?: string;
}

export interface Review {
  author: string;
  body: string;
  rating: number;
  source?: string;
}

export interface Location {
  name: string;
  address: string;
  hours: { day: string; open: string }[];
  mapHint?: string;
}

export interface TemplateContent {
  practiceName: string;
  tagline: string;
  mission: string;
  yearFounded?: number;
  heroImage: string;
  services: Service[];
  team: TeamMember[];
  reviews: Review[];
  locations: Location[];
  contact: {
    phone: string;
    email: string;
    instagram?: string;
    linkedin?: string;
    facebook?: string;
    tiktok?: string;
    youtube?: string;
    /** Psychology Today profile slug or full URL. */
    psychologyToday?: string;
    /** Headway provider profile slug or full URL. */
    headway?: string;
  };
  addons: AddonKey[];
  /** Optional thin top-of-page banner (e.g. "Now accepting new patients"). */
  announcement?: string;
  /** Optional list of accepted insurance plans, surfaced by templates that opt in. */
  insurance?: string[];
  /**
   * Optional small secondary pill rendered near the hero (e.g. "Available
   * in English & Spanish"). Set by the portal personalisation layer when
   * the lead's enrichment indicates the practitioner offers a second
   * language — kept OUT of the H1/tagline because most prospects don't
   * lead with bilingualism. Templates that opt in render this as a small
   * non-headline badge; others ignore it. Localized at the call site.
   */
  bilingualBadge?: string | null;
  /**
   * Optional clinical specialties / populations served (e.g. "Anxiety",
   * "Trauma", "LGBTQ+"). Sourced verbatim from the prospect's directory
   * profiles (Headway, Psychology Today). Surfaced by templates that
   * have a "What we treat" or specialty-pill section.
   */
  specialties?: string[];
  /** Languages spoken in session, e.g. ["English", "Spanish"]. */
  languages?: string[];
  /** Therapy modalities used (CBT, EMDR, IFS, …). */
  modalities?: string[];
  /** Hand-curated testimonials from the prospect's own site. Distinct
   * from `reviews` (Google) — these are quotes the prospect chose to
   * surface themselves, often longer and more specific. */
  testimonials?: Array<{ author: string | null; body: string }>;
  /** Visual identity lifted from the prospect's existing site. When a
   * field is present, opting templates can render the prospect's real
   * logo / brand color so the preview reads as "your brand, redesigned"
   * rather than "a generic theme with your name on it".
   *
   * **`fontFamily` is metadata only**: the rep dashboard surfaces it
   * as a hint when picking a template, but no template should apply
   * it as a CSS variable. Each of the nine templates ships with its
   * own curated typeface; injecting an arbitrary third-party font
   * defeats the design system and risks unsupported / ugly output.
   * Server-side harmony gates already drop unreadable accent colors
   * and non-logo URLs before they reach this object — see
   * `previewContentHarmony.ts`.
   */
  brand?: {
    logoUrl: string | null;
    faviconUrl: string | null;
    accentColor: string | null;
    fontFamily: string | null;
  };
}

export interface TemplateProps {
  content: TemplateContent;
  palette: PaletteDef;
  templateKey: TemplateKey;
  /**
   * Optional content slot rendered inside the template, immediately
   * before its `<footer>` block. The portal toolbar / template route
   * uses this to inject the "Live add-ons preview" sections AND the
   * shared `<TemplateDefaults>` (reviews + map) so they appear in the
   * correct visual order — above the per-template footer rather than
   * after it. Without this slot, the founder reported on 2026-04-28
   * that the footer (with copyright + "Design by Ashford Creative"
   * credit + Begin Consultation CTA) was being shoved into the middle
   * of the page the moment any add-on was enabled, since the route
   * was rendering add-ons AFTER the template component (and the
   * footer is baked INSIDE each template).
   */
  tail?: ReactNode;
}

// Zod schema for runtime validation of TemplateContent (e.g., when loading
// practice content from a CMS or rep-edited JSON). Source of truth for the
// shape stays the TS interfaces above; the schema mirrors them.
export const AddonKeySchema = z.enum([
  "booking_widget",
  "match_quiz",
  "phq9",
  "gad7",
  "platform_badges",
  "modalities_filter",
  "identity_tags",
  "sliding_scale",
  "encrypted_intake",
  "podcast_embed",
  "directory",
]);

export const ServiceSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  iconKey: z.string().optional(),
});

export const TeamMemberSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  credentials: z.string(),
  photo: z.string(),
  bio: z.string(),
  bio_en: z.string().optional(),
  bio_es: z.string().optional(),
  longBio: z.array(z.string()).optional(),
  modalities: z.array(z.string()),
  identities: z.array(z.string()).optional(),
  pronouns: z.string().optional(),
  disclaimer: z.string().optional(),
});

export const ReviewSchema = z.object({
  author: z.string().min(1),
  body: z.string().min(1),
  rating: z.number().min(1).max(5),
  source: z.string().optional(),
});

export const LocationSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  hours: z.array(z.object({ day: z.string(), open: z.string() })),
  mapHint: z.string().optional(),
});

export const TemplateContentSchema = z.object({
  practiceName: z.string().min(1),
  tagline: z.string().min(1),
  mission: z.string().min(1),
  yearFounded: z.number().int().optional(),
  heroImage: z.string(),
  services: z.array(ServiceSchema),
  team: z.array(TeamMemberSchema),
  reviews: z.array(ReviewSchema),
  locations: z.array(LocationSchema),
  contact: z.object({
    phone: z.string(),
    email: z.string().email(),
    instagram: z.string().optional(),
    linkedin: z.string().optional(),
    facebook: z.string().optional(),
    tiktok: z.string().optional(),
    youtube: z.string().optional(),
    psychologyToday: z.string().optional(),
    headway: z.string().optional(),
  }),
  addons: z.array(AddonKeySchema),
  announcement: z.string().optional(),
  insurance: z.array(z.string()).optional(),
  bilingualBadge: z.string().nullable().optional(),
  specialties: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  modalities: z.array(z.string()).optional(),
  testimonials: z
    .array(
      z.object({
        author: z.string().nullable(),
        body: z.string(),
      }),
    )
    .optional(),
  brand: z
    .object({
      logoUrl: z.string().nullable(),
      faviconUrl: z.string().nullable(),
      accentColor: z.string().nullable(),
      fontFamily: z.string().nullable(),
    })
    .optional(),
}) satisfies z.ZodType<TemplateContent>;
