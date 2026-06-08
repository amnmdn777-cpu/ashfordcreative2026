import type { ComponentType } from "react";
import { AlwaysOnSpanishInline } from "./AlwaysOnSpanishInline";
import { FirstVisitVideoInline } from "./FirstVisitVideoInline";
import { FrontDoorQuizInline } from "./FrontDoorQuizInline";
import { InsightsJournalInline } from "./InsightsJournalInline";
import { InsuranceSlidingScaleInline } from "./InsuranceSlidingScaleInline";
import { MatchFilterInline } from "./MatchFilterInline";
import { OpenCalendarInline } from "./OpenCalendarInline";
import { TelehealthBridgeInline } from "./TelehealthBridgeInline";
import { TelehealthFullInline } from "./TelehealthFullInline";
import { WelcomeKitInline } from "./WelcomeKitInline";
import { WellnessCheckInline } from "./WellnessCheckInline";

// Catalog 2.0: every public add-on chip gets a full-width inline demo
// rendered under the template route when toggled on. The founder
// reported on 2026-04-28 that toggling a non-booking chip looked
// broken because nothing appeared under the template — this map now
// covers every chip so every selection visibly appends a section.
// 2026-05 (#214) added telehealth_bridge / telehealth_full /
// insurance_precheck so the 3 newly-priced add-ons can be FELT, not
// just read about in the drawer copy.
/**
 * Props passed to every inline section. Today only WelcomeKitInline
 * reads `practitionerName` (so the email "from" address shows the
 * prospect's real name instead of the SAMPLE "Dr. Maya Alvarado" —
 * task #219), but typing the whole map this way means future inline
 * sections can opt-in to the same prospect data without re-plumbing
 * the call site in ProspectPortal.
 */
export type AddonInlineProps = {
  practitionerName?: string;
  // #221 — when the prospect already has this add-on bundled at no
  // extra cost (catalog `monthlyCents===0 && setupCents===0` for
  // their plan), the inline preview's RibbonHeader must show
  // "Included" instead of "+$15/mo". Otherwise the live add-on
  // section contradicts the toolbar's "ALSO INCLUDED" band right
  // above it ("+$15/MO • ON YOUR SITE" reads as a paid upsell that
  // they're nonetheless getting — confusing).
  included?: boolean;
};

export const ADDON_INLINE_COMPONENTS: Record<
  string,
  ComponentType<AddonInlineProps>
> = {
  online_booking: OpenCalendarInline,
  blog_publishing: InsightsJournalInline,
  // Patient Onboarding Hub (welcome_kit + intake_forms_hub merged 2026-05).
  // Reuses WelcomeKitInline as the visual centrepiece — the email
  // mockup is the high-fidelity surface; the forms-signing leg is
  // described in the drawer/catalog copy.
  // 2026-05-21 — `patient_onboarding_hub` capability dropped (Sprint 2 streamline).
  insurance_sliding_scale: InsuranceSlidingScaleInline,
  insurance: InsuranceSlidingScaleInline,
  first_visit_video: FirstVisitVideoInline,
  telehealth_bridge: TelehealthBridgeInline,
  telehealth_full: TelehealthFullInline,
  // 2026-05-05 (#218): wire up every catalog slug that has an existing
  // inline component but was never registered — toggling these chips
  // looked broken because nothing visibly mounted under the template.
  // Each slug below mirrors the addon_catalog table.
  ai_quiz: FrontDoorQuizInline,
  modalities_filter: MatchFilterInline,
  spanish_pro: AlwaysOnSpanishInline,
  phq9_screener: WellnessCheckInline,
};

export const ADDON_DISPLAY_NAMES: Record<string, string> = {
  online_booking: "Online Booking",
  blog_publishing: "Insights Journal",
  // 2026-05-21 — `patient_onboarding_hub` display name dropped.
  insurance_sliding_scale: "Insurance & Sliding Scale Badge",
  first_visit_video: "First-Visit Video",
  telehealth_bridge: "Telehealth Bridge",
  telehealth_full: "Telehealth Full Setup",
};
