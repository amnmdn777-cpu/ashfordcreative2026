import { createContext, useContext, type ReactNode } from "react";

/**
 * CRITICAL #4 — Template tier-gating context.
 *
 * Three tiers, ordered: boutique < boutique_pro < boutique_concierge.
 * The provider is mounted by the template preview route (TemplateRoute)
 * from the `?tier=` query param; consumers read via `useTier()` and gate
 * Pro/Concierge-only sections with `<TierGate min="pro">`.
 *
 * Kept intentionally minimal — see `@site/lib/useTierGate` for the
 * capability-key-based gate. This hook only owns the tier identity.
 */
export type TierKey = "boutique" | "boutique_pro" | "boutique_concierge";

export const TierContext = createContext<TierKey>("boutique");

interface TierProviderProps {
  tier: TierKey;
  children: ReactNode;
}

export function TierProvider({ tier, children }: TierProviderProps) {
  return <TierContext.Provider value={tier}>{children}</TierContext.Provider>;
}

export function useTier(): TierKey {
  return useContext(TierContext);
}
