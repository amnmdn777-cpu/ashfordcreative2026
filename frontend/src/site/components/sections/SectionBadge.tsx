import React from "react";

/**
 * Per-section tier chip + auto-numbered circle.
 *
 * Founder feedback 2026-05-17: every section in a template should carry
 * a small badge telling the prospect (a) the section's serial number in
 * the template's flow and (b) which tier (Boutique / Pro / Concierge)
 * unlocks it. The counter is driven by CSS — see `section-badges.css` —
 * so the same primitive works across all 9 templates without explicit
 * index threading.
 */
export type SectionTier = "boutique" | "pro" | "concierge";

const TIER_LABEL: Record<SectionTier, string> = {
  boutique: "BOUTIQUE",
  pro: "BOUTIQUE PRO",
  concierge: "BOUTIQUE CONCIERGE",
};

interface SectionBadgeProps {
  tier: SectionTier;
  /** Force a specific number; otherwise the CSS counter handles it. */
  forceIndex?: number;
  className?: string;
}

export function SectionBadge({ tier, forceIndex, className = "" }: SectionBadgeProps) {
  return (
    <div className={`section-badge section-badge--${tier} ${className}`} aria-hidden>
      <span className="section-badge__num" data-force-index={forceIndex ?? ""}>
        {forceIndex ? forceIndex : null}
      </span>
      <span className="section-badge__tier">{TIER_LABEL[tier]}</span>
    </div>
  );
}

export default SectionBadge;
