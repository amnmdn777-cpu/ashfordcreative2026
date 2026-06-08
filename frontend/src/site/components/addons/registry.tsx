import type { ComponentType } from "react";
import {
  DEFAULT_FEATURES,
  type AddonDef,
  type DefaultFeature,
} from "@workspace/api-zod";
import { OnlineBookingPreview } from "./preview/OnlineBookingPreview";
import { InsuranceSlidingScalePreview } from "./preview/InsuranceSlidingScalePreview";
import { FirstVisitVideoPreview } from "./preview/FirstVisitVideoPreview";
import { InsightsJournalPreview } from "./preview/InsightsJournalPreview";
import { WelcomeKitPreview } from "./preview/WelcomeKitPreview";
import { TelehealthBridgePreview } from "./preview/TelehealthBridgePreview";
import { TelehealthFullPreview } from "./preview/TelehealthFullPreview";
import { SpanishTranslationPreview } from "./preview/SpanishTranslationPreview";
import { CrisisHotlineButtonPreview } from "./preview/CrisisHotlineButtonPreview";
import { OfficeTourPreview } from "./preview/OfficeTourPreview";
import { DailyScheduleDigestPreview } from "./preview/DailyScheduleDigestPreview";
import { GoogleBusinessLocatorPreview } from "./preview/GoogleBusinessLocatorPreview";
import { SocialRowPreview } from "./preview/SocialRowPreview";

/**
 * Click-preview registry for the Pricing-page drawer. Keys cover BOTH
 * the paid `AddonDef.key` values from catalog 2.0 AND the free
 * `DefaultFeature.key` values that ship with every $199/mo plan. Values
 * are small React components that render a brand-styled, hardcoded
 * mock of the feature so the prospect can FEEL the deliverable in two
 * seconds. We deliberately do not render real interactive demos here
 * — the prospect's job is to picture the result, not test the system.
 *
 * If a future add-on ships without a preview, the drawer falls back
 * to a graceful "preview coming soon" stub. New addons should land a
 * preview the same week they're added so the catalog and the drawer
 * never drift.
 */
/**
 * Props the drawer plumbs into every preview component. Today only
 * WelcomeKitPreview reads `practitionerName` (so the email "from"
 * line shows the prospect's real name on real-lead portals instead
 * of the SAMPLE "Dr. Maya Alvarado" — task #221, mirroring the
 * inline-section pattern from #219), but typing the registry this
 * way means future previews can opt-in to the same prospect data
 * without re-plumbing the call site in AddonPreviewDrawer.
 */
export type AddonPreviewProps = {
  practitionerName?: string;
};

export const ADDON_PREVIEWS: Partial<
  Record<string, ComponentType<AddonPreviewProps>>
> = {
  // Paid add-ons (catalog 2.0)
  online_booking: OnlineBookingPreview,
  insurance_sliding_scale: InsuranceSlidingScalePreview,
  first_visit_video: FirstVisitVideoPreview,
  blog_publishing: InsightsJournalPreview,
  // Patient Onboarding Hub merges the old welcome_kit + intake_forms_hub
  // into a single product. Reuses the welcome-email mockup as the hero
  // preview; the form-signing flow is described in the longPitch bullets.
  // 2026-05-21 — `patient_onboarding_hub` capability dropped (Sprint 2 streamline).
  telehealth_bridge: TelehealthBridgePreview,
  telehealth_full: TelehealthFullPreview,
  // Default features included in every $199/mo plan (#212)
  spanish_translation: SpanishTranslationPreview,
  crisis_hotline_button: CrisisHotlineButtonPreview,
  office_tour: OfficeTourPreview,
  // Google Business Presence merges the old reviews_aggregator +
  // google_business_locator + google_profile_sync into one feature.
  // Map preview is the visual anchor (same product mechanism).
  google_business_presence: GoogleBusinessLocatorPreview,
  daily_schedule_digest: DailyScheduleDigestPreview,
  social_row: SocialRowPreview,
};

/**
 * Adapt a `DefaultFeature` (key/label/description triple shipped from
 * api-zod) into the `AddonDef` shape the preview drawer expects. We
 * pin monthlyCents/setupCents to 0 and reuse the description as the
 * long pitch so the drawer's body looks identical to a paid add-on
 * — the only difference is the footer (rendered by AddonPreviewDrawer
 * in `included` mode), which swaps the price + add CTA for an
 * "Always included" badge. Bullets are intentionally empty so the
 * drawer doesn't render a stub list. #212.
 */
export const defaultFeatureAsAddon = (f: DefaultFeature): AddonDef => ({
  key: f.key,
  label: f.label,
  description: f.description,
  longPitch: f.description,
  bullets: [],
  monthlyCents: 0,
  setupCents: 0,
  // `included: true` keeps semantics aligned with paid add-ons that ship
  // free in the base plan — the drawer also receives `mode="included"`
  // so the footer renders the "Always included" badge instead of CTA.
  included: true,
});

/**
 * Lookup map for default features by key — used by the 3 surfaces
 * (Pricing, TemplateRoute, ProspectPortal) so they can resolve the
 * drawer payload from a chip key without re-implementing the adapter.
 */
export const DEFAULT_FEATURE_BY_KEY: Record<string, DefaultFeature> =
  Object.fromEntries(DEFAULT_FEATURES.map((f) => [f.key, f]));
