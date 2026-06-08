import { logger } from "../lib/logger";

/**
 * LOT 3.B3 — first_visit_video 1-year refresh entitlement (skeleton).
 *
 * Promise: "One refresh per year included when your details change."
 * Today there's no admin surface that tracks refresh consumption. This
 * stub provides the API contract; a real implementation would persist
 * to a `first_visit_video_entitlements` table keyed by subscription_id.
 *
 * TODO(first-visit-video-tracking):
 *   - Add DB table first_visit_video_entitlements(subscription_id PK,
 *     last_refresh_at timestamptz, refresh_count_this_year int)
 *   - Admin UI surface (SubscriptionsPage) to trigger a refresh
 *   - Cron that resets refresh_count_this_year on the anniversary
 */

type Entitlement = {
  subscriptionId: number;
  lastRefreshAt: string | null;
  refreshesThisYear: number;
};

// In-memory store — replace with DB table.
const inMemoryEntitlements = new Map<number, Entitlement>();

export function getFirstVisitVideoEntitlement(subId: number): Entitlement {
  const existing = inMemoryEntitlements.get(subId);
  if (existing) return existing;
  const fresh: Entitlement = {
    subscriptionId: subId,
    lastRefreshAt: null,
    refreshesThisYear: 0,
  };
  inMemoryEntitlements.set(subId, fresh);
  return fresh;
}

export function consumeFirstVisitVideoRefresh(subId: number): {
  ok: boolean;
  reason?: string;
} {
  const e = getFirstVisitVideoEntitlement(subId);
  if (e.refreshesThisYear >= 1) {
    return { ok: false, reason: "annual_quota_used" };
  }
  e.refreshesThisYear += 1;
  e.lastRefreshAt = new Date().toISOString();
  logger.info({ subId }, "[first-visit-video] refresh consumed (stub)");
  return { ok: true };
}
