import { z } from "zod";

/**
 * Money envelope used throughout the public domain contract. `amount` is in
 * the currency's major unit (e.g. dollars, never cents).
 */
export const Money = z.object({
  amount: z.number().nonnegative(),
  currency: z.string().length(3),
});
export type Money = z.infer<typeof Money>;

/** Domain availability status. `invalid` covers both malformed input and
 *  TLDs the registrar can't sell us. */
export const DomainStatus = z.enum([
  "available",
  "premium",
  "taken",
  "invalid",
]);
export type DomainStatus = z.infer<typeof DomainStatus>;

export const DomainOffer = z.object({
  domain: z.string(),
  status: DomainStatus,
  retailPrice: Money,
  ourPrice: Money,
  /** Plan slug that bundles this domain at no charge. `"A"` is the only
   *  plan that includes a free domain; absent for taken/invalid. */
  includedInPlan: z.literal("A").optional(),
  /** One-time surcharge for premium domains, on top of the included plan. */
  premiumSurcharge: Money.optional(),
});
export type DomainOffer = z.infer<typeof DomainOffer>;

/** /check returns the flat DomainOffer for the requested name. */
export const DomainCheckResult = DomainOffer;
export type DomainCheckResult = DomainOffer;

export const DomainSuggestResponse = z.object({
  seed: z.string(),
  offers: z.array(DomainOffer),
});
export type DomainSuggestResponse = z.infer<typeof DomainSuggestResponse>;

/** Surface emitting the request, used for funnel telemetry. */
export const DomainSourceSurface = z.enum([
  "hero",
  "portal",
  "template",
  "chatbot",
  "rep",
  "unknown",
]);
export type DomainSourceSurface = z.infer<typeof DomainSourceSurface>;
