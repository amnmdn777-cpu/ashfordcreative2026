import { logger } from "../lib/logger";

/**
 * LOT 3.9 — google_business_presence live sync STUB.
 *
 * Per-subscription cron job that would normally:
 *   - Refresh hours, phone, address from Google Business Profile API
 *   - Pull latest reviews from Google + Healthgrades
 *   - Persist into a per-sub `gbp_snapshot` row consumed by templates
 *
 * Today this is a no-op that logs a Sentry breadcrumb so we can
 * verify the cron is firing in prod. The admin field for
 * `googleBusinessProfileId` will be added to the subscription record
 * when we wire the real sync.
 *
 * TODO(gbp-sync):
 *   - Add admin field `googleBusinessProfileId` on subscriptions
 *   - OAuth flow for Google Business Profile API access
 *   - Persist normalized snapshot
 *   - Throttle to respect Google quota (~1 req/sub/day)
 */

export async function syncGoogleBusinessForSubscription(subId: number): Promise<void> {
  logger.info({ subId }, "[gbp-sync] no-op (stub)");
  // TODO(gbp-sync): call Google Business Profile API + persist snapshot
}

export async function syncAllGoogleBusiness(): Promise<{ scanned: number }> {
  logger.info("[gbp-sync] daily sync running (no-op stub)");
  // TODO(gbp-sync): iterate active subscriptions, call syncGoogleBusinessForSubscription
  return { scanned: 0 };
}
