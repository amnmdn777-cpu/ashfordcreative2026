import { useMemo } from "react";
import { TIERS, type TierKey, type CapabilityKey } from "@workspace/api-zod";

/**
 * LOT 3.4 — Template tier-gating helper.
 *
 * Returns a boolean predicate: `should(capabilityKey)` answers "should
 * this template render the section for this capability, given the
 * current prospect/subscription tier?"
 *
 * Resolution order for tier:
 *   1. Explicit `tierKey` prop passed to the template
 *   2. window.__PROSPECT_TIER (injected by portal renderer)
 *   3. Fallback: "boutique_concierge" — show everything in marketing
 *      demos and prospect previews (the upgrade story still works because
 *      the prospect portal uses #2 to lock to their chosen tier).
 *
 * Usage:
 *   const { show } = useTierGate(props.tierKey);
 *   {show("online_booking") && <BookingWidget />}
 *
 * TODO(template-tier-gating): wire every template port to call this
 * helper. Today most templates render every section unconditionally;
 * the gate is in place but not yet adopted at all section sites.
 */
export function useTierGate(explicitTier?: TierKey | null) {
  return useMemo(() => {
    let tier: TierKey = "boutique_concierge";
    if (explicitTier) {
      tier = explicitTier;
    } else if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = (window as any).__PROSPECT_TIER;
      if (w === "boutique" || w === "boutique_pro" || w === "boutique_concierge") {
        tier = w;
      }
    }
    const caps = new Set<CapabilityKey>(TIERS[tier].capabilities);
    return {
      tier,
      show: (k: CapabilityKey): boolean => caps.has(k),
    };
  }, [explicitTier]);
}
