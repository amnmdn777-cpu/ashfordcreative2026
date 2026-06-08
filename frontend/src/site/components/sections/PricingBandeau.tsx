import React from "react";

/**
 * Pricing tiers band for the portal WOW pass. Renders up to 3
 * pricing-tier cards (label + amount + rationale) sourced from
 * `previewContent.pricingTiers`. When tiers are empty, callers may
 * fall back to `pricePerSession.{min,max}` and pass a single-card
 * "range" mode (handled outside this primitive).
 */
export interface PricingTier {
  label: string;
  amount: number | null;
  rationale?: string | null;
}

export interface PricingBandeauProps {
  eyebrow: string;
  title: string;
  perSessionLabel: string;
  tiers: PricingTier[];
}

export function PricingBandeau({
  eyebrow,
  title,
  perSessionLabel,
  tiers,
}: PricingBandeauProps) {
  if (!tiers || tiers.length === 0) return null;
  const shown = tiers.slice(0, 3);
  return (
    <section
      className="w-full px-6 md:px-12 py-20 md:py-24"
      style={{ backgroundColor: "var(--color-surface)" }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-1 mb-10">
          <span
            className="text-[11px] uppercase tracking-[0.22em]"
            style={{ color: "var(--color-text-muted)" }}
          >
            {eyebrow}
          </span>
          <h2
            className="text-3xl md:text-4xl leading-tight"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--color-text)",
            }}
          >
            {title}
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {shown.map((tier, i) => (
            <div
              key={`${tier.label}-${i}`}
              className="p-6 flex flex-col gap-3 border"
              style={{
                backgroundColor: "var(--color-surface-soft, var(--color-surface))",
                borderColor:
                  "color-mix(in srgb, var(--color-primary) 18%, transparent)",
                borderRadius: "var(--radius-md, 12px)",
              }}
            >
              <span
                className="text-[10px] uppercase tracking-[0.22em]"
                style={{ color: "var(--color-text-muted)" }}
              >
                {tier.label}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span
                  className="text-4xl"
                  style={{
                    fontFamily: "var(--font-display)",
                    color: "var(--color-text)",
                  }}
                >
                  {tier.amount != null ? `$${tier.amount}` : "—"}
                </span>
                {tier.amount != null && (
                  <span
                    className="text-xs"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {perSessionLabel}
                  </span>
                )}
              </div>
              {tier.rationale ? (
                <p
                  className="text-sm leading-relaxed"
                  style={{
                    color: "var(--color-text)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {tier.rationale}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default PricingBandeau;
