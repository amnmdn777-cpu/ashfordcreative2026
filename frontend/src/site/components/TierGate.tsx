import type { ReactNode } from "react";
import { useTier, type TierKey } from "@site/hooks/useTier";
import { useI18n } from "@site/lib/i18n";

/**
 * CRITICAL #4 — Tier gate. Renders children only when the current tier
 * (from TierContext) is at or above `min`. Otherwise renders a tiny,
 * bilingual upsell line — or nothing if `silent`.
 *
 * Ordering: boutique(0) < pro(1) < concierge(2).
 */
type MinTier = "pro" | "concierge";

const TIER_RANK: Record<TierKey, number> = {
  boutique: 0,
  boutique_pro: 1,
  boutique_concierge: 2,
};

const MIN_RANK: Record<MinTier, number> = {
  pro: 1,
  concierge: 2,
};

const MIN_LABEL_EN: Record<MinTier, string> = {
  pro: "Pro",
  concierge: "Concierge",
};

interface TierGateProps {
  min: MinTier;
  children: ReactNode;
  /** When true, render nothing instead of the upsell line. Default false. */
  silent?: boolean;
}

export function TierGate({ min, children, silent = false }: TierGateProps) {
  const tier = useTier();
  const ok = TIER_RANK[tier] >= MIN_RANK[min];
  const { locale } = useI18n();
  if (ok) return <>{children}</>;
  if (silent) return null;
  const label = MIN_LABEL_EN[min];
  const msg =
    locale === "es"
      ? `Disponible en el plan ${label}`
      : `Available on the ${label} plan`;
  return (
    <div
      data-testid={`tier-gate-upsell-${min}`}
      className="text-[11px] font-mono uppercase tracking-widest opacity-50 px-6 py-3 text-center"
      style={{ color: "var(--color-text-muted, currentColor)" }}
    >
      {msg}
    </div>
  );
}

export default TierGate;
