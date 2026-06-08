import { z } from "zod";

/**
 * Vocabulary of public-funnel events fired by the self-serve template flow.
 * Keep in sync with `lib/funnel.ts` on the ashford-site client and with the
 * admin self-serve report aggregator.
 */
export const FunnelEventName = z.enum([
  /** Visitor lands on /template/:key — fires once per session-per-template. */
  "template_view",
  /** Visitor switches to a different template card. */
  "template_pick",
  /** Visitor changes the palette swatch. */
  "palette_pick",
  /** Visitor toggles an addon on/off. */
  "addon_toggle",
  /** Visitor opens the customize panel (color/font overrides). */
  "customize_open",
  /** Visitor types/picks a custom domain in the reserve modal. */
  "domain_claim",
  /** Visitor opens the reserve modal (intent signal). */
  "reserve_open",
  /** Visitor submits the reserve modal (about to enter Stripe). */
  "reserve_submit",
  /** Server-side: Stripe Checkout URL was minted (paired with reserve_submit). */
  "checkout_start",
]);
export type FunnelEventName = z.infer<typeof FunnelEventName>;

/**
 * One funnel event. The route accepts either a single event or a batch
 * (array of these) — see `FunnelEventRequest` below.
 */
export const FunnelEventItem = z.object({
  event: FunnelEventName,
  /** Template slug the event happened on; optional for non-template events. */
  slug: z.string().max(64).optional(),
  /** Free-form payload — keep small; route enforces a hard size cap. */
  payload: z.record(z.string(), z.unknown()).optional(),
});
export type FunnelEventItem = z.infer<typeof FunnelEventItem>;

/**
 * Wire shape accepted by POST /api/public/funnel-events. Two forms:
 *  - Single (legacy): `{ sessionId, event, slug?, payload? }`
 *  - Batched:        `{ sessionId, events: [{ event, slug?, payload? }, ...] }`
 *
 * The server normalizes both to the same persistence path. Batches are
 * capped at 32 events / 8 KB total body to keep the public endpoint
 * cheap and unspoofable as a write amp surface.
 */
export const FunnelEventRequest = z.union([
  z.object({
    sessionId: z.string().min(8).max(64),
    event: FunnelEventName,
    slug: z.string().max(64).optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    sessionId: z.string().min(8).max(64),
    events: z.array(FunnelEventItem).min(1).max(32),
  }),
]);
export type FunnelEventRequest = z.infer<typeof FunnelEventRequest>;

export const FunnelEventResponse = z.object({
  ok: z.literal(true),
});
export type FunnelEventResponse = z.infer<typeof FunnelEventResponse>;
