/**
 * portalSections.ts — canonical section order for the therapist portal.
 *
 * Source of truth for which sections appear on the prospect portal and
 * in what order. Two axes drive the final composition:
 *   1. Tier — gates which sections the prospect is allowed to see.
 *   2. Template — some templates reorder a couple of sections to fit
 *      their aesthetic.
 */

import type { TierKey } from "./pricing";

export const PORTAL_SECTION_KEYS = [
  "hero",
  "about",
  "services",
  "office_tour",
  "fees",
  "booking",
  "telehealth",
  "reviews",
  "google_map",
  "faq",
  "crisis",
  "footer",
] as const;

export type PortalSectionKey = (typeof PORTAL_SECTION_KEYS)[number];

export const CANONICAL_SECTION_ORDER: readonly PortalSectionKey[] = [
  "hero",
  "about",
  "services",
  "office_tour",
  "fees",
  "booking",
  "telehealth",
  "reviews",
  "google_map",
  "faq",
  "crisis",
  "footer",
] as const;

export const TIER_VISIBILITY: Record<TierKey, Record<PortalSectionKey, boolean>> = {
  boutique: {
    hero: true, about: true, services: true, office_tour: true, fees: true,
    booking: false, telehealth: false, reviews: true, google_map: true,
    faq: true, crisis: true, footer: true,
  },
  boutique_pro: {
    hero: true, about: true, services: true, office_tour: true, fees: true,
    booking: true, telehealth: true, reviews: true, google_map: true,
    faq: true, crisis: true, footer: true,
  },
  boutique_concierge: {
    hero: true, about: true, services: true, office_tour: true, fees: true,
    booking: true, telehealth: true, reviews: true, google_map: true,
    faq: true, crisis: true, footer: true,
  },
};

export const TEMPLATE_SECTION_ORDER: Partial<
  Record<string, readonly PortalSectionKey[]>
> = {
  polaroid: [
    "hero", "about", "reviews", "services", "office_tour", "fees",
    "booking", "telehealth", "google_map", "faq", "crisis", "footer",
  ],
  hello_friend: [
    "hero", "services", "about", "reviews", "office_tour", "fees",
    "booking", "telehealth", "google_map", "faq", "crisis", "footer",
  ],
};

export const MANDATORY_SECTIONS: readonly PortalSectionKey[] = [
  "crisis",
  "footer",
];

export function resolvePortalSections(input: {
  tier: TierKey;
  template?: string | null;
}): PortalSectionKey[] {
  const baseOrder =
    (input.template && TEMPLATE_SECTION_ORDER[input.template]) ||
    CANONICAL_SECTION_ORDER;
  const visibility = TIER_VISIBILITY[input.tier];
  const visible = baseOrder.filter((k) => visibility[k]);
  for (const m of MANDATORY_SECTIONS) {
    if (!visible.includes(m)) visible.push(m);
  }
  const footerIdx = visible.indexOf("footer");
  if (footerIdx !== -1 && footerIdx !== visible.length - 1) {
    visible.splice(footerIdx, 1);
    visible.push("footer");
  }
  return visible;
}

export function tierSectionCount(tier: TierKey): number {
  return resolvePortalSections({ tier }).length;
}
