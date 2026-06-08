/**
 * Stripe catalog sync — pushes TIERS into Stripe as Products + Prices.
 * Runs on boot (30s stagger) and every 24h, gated by a pg advisory lock.
 *
 * Lookup keys follow `ashford_tier_<key>_monthly` (and `_setup` when the
 * tier carries a one-time setup fee). Price drift creates a new Price
 * with `transfer_lookup_key: true` and archives the old one — existing
 * subscriptions keep billing at the OLD price ID until renewal.
 *
 * Legacy cleanup: the same run archives any pre-2026-05 Products that
 * still exist in Stripe under the legacy `ashford_plan_a/b_*` or
 * `ashford_addon_*` lookup keys. Stripe forbids deletion once a Price
 * has been used; archival is the canonical way to retire them.
 *
 * Failure handling:
 *   - Per-item try/catch — one failed item doesn't abort the rest.
 *   - Outcomes are aggregated and logged (created/updated/unchanged/error).
 *   - When the Stripe singleton is null (no credentials), the sync is
 *     skipped with a warning instead of throwing.
 *
 * Manual trigger:
 *   - `runStripeCatalogSyncOnce("manual")` can be invoked from the admin
 *     route (see `routes/admin/index.ts`) so the operator can force a
 *     sync after editing pricing without waiting 24h.
 *   - One-shot CLI: `artifacts/api-server/scripts/syncStripeTiers.ts`
 */

import type Stripe from "stripe";
import { pool } from "@workspace/db";
import { TIERS, type TierDef } from "@workspace/api-zod";

import { stripe } from "../integrations/stripe";
import { logger } from "../lib/logger";

const STRIPE_CATALOG_SYNC_LOCK_KEY = 0x73746331; // "stc1"
const STRIPE_CATALOG_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
const BOOT_STAGGER_MS = 30_000;

const ASHFORD_KIND_META = "ashford_kind";
const ASHFORD_KEY_META = "ashford_key";

const TAX_CODE_SAAS = "txcd_10103001";
const TAX_CODE_SAAS_SETUP = "txcd_10103000";
const TAX_BEHAVIOR_EXCLUSIVE = "exclusive" as const;

type SyncOutcome = "created" | "updated" | "unchanged" | "error" | "skipped";

type CatalogItem = {
  lookupKey: string;
  productName: string;
  productDescription: string;
  metadata: Record<string, string>;
  taxCode: string;
  unitAmount: number;
  currency: "usd";
  recurring: { interval: "month" } | null;
};

const TIER_DESCRIPTION_FALLBACK =
  "Boutique website + reseller hosting for mental-health practitioners.";

const tierToCatalogItems = (tier: TierDef): CatalogItem[] => {
  const items: CatalogItem[] = [
    {
      lookupKey: `ashford_tier_${tier.key}_monthly`,
      productName: `Ashford Creative — ${tier.label} (monthly)`,
      productDescription:
        tier.description?.trim() || TIER_DESCRIPTION_FALLBACK,
      metadata: {
        [ASHFORD_KIND_META]: "tier",
        [ASHFORD_KEY_META]: tier.key,
      },
      taxCode: TAX_CODE_SAAS,
      unitAmount: tier.monthlyCents,
      currency: "usd",
      recurring: { interval: "month" },
    },
  ];
  if (tier.setupCents > 0) {
    items.push({
      lookupKey: `ashford_tier_${tier.key}_setup`,
      productName: `${tier.label} setup (one-time)`,
      productDescription: `One-time setup fee for ${tier.label}.`,
      metadata: {
        [ASHFORD_KIND_META]: "tier_setup",
        [ASHFORD_KEY_META]: tier.key,
      },
      taxCode: TAX_CODE_SAAS_SETUP,
      unitAmount: tier.setupCents,
      currency: "usd",
      recurring: null,
    });
  }
  return items;
};

const recurringMatches = (
  existing: Stripe.Price,
  desired: CatalogItem["recurring"],
): boolean => {
  if (desired === null) return existing.recurring === null;
  return existing.recurring?.interval === desired.interval;
};

const findOrCreateProduct = async (
  s: Stripe,
  item: CatalogItem,
): Promise<Stripe.Product> => {
  const found = await s.products.search({
    query: `metadata['${ASHFORD_KIND_META}']:'${item.metadata[ASHFORD_KIND_META]}' AND metadata['${ASHFORD_KEY_META}']:'${item.metadata[ASHFORD_KEY_META]}'`,
    limit: 1,
  });
  if (found.data.length > 0) {
    const product = found.data[0]!;
    const needsUpdate =
      product.name !== item.productName ||
      product.description !== item.productDescription ||
      product.active !== true ||
      product.tax_code !== item.taxCode;
    if (needsUpdate) {
      return await s.products.update(product.id, {
        name: item.productName,
        description: item.productDescription,
        metadata: item.metadata,
        active: true,
        tax_code: item.taxCode,
      });
    }
    return product;
  }
  return await s.products.create({
    name: item.productName,
    description: item.productDescription,
    metadata: item.metadata,
    tax_code: item.taxCode,
  });
};

const productOwnedByItem = (
  product: Stripe.Product,
  item: CatalogItem,
): boolean =>
  product.metadata?.[ASHFORD_KIND_META] ===
    item.metadata[ASHFORD_KIND_META] &&
  product.metadata?.[ASHFORD_KEY_META] === item.metadata[ASHFORD_KEY_META];

const syncOneItem = async (
  s: Stripe,
  item: CatalogItem,
): Promise<SyncOutcome> => {
  try {
    const existingByLookup = await s.prices.list({
      lookup_keys: [item.lookupKey],
      limit: 10,
      expand: ["data.product"],
    });
    const livePrice = existingByLookup.data.find((p) => p.active === true);
    const archivedHoldsKey = existingByLookup.data.some(
      (p) => p.active === false,
    );

    if (livePrice) {
      const product = livePrice.product as Stripe.Product;

      if (!productOwnedByItem(product, item)) {
        logger.warn(
          {
            lookupKey: item.lookupKey,
            stripeProductId: product.id,
            stripeProductMetadata: product.metadata,
            expectedMetadata: item.metadata,
          },
          "stripe catalog sync: lookup_key resolves to a product that doesn't belong to us — refusing to modify",
        );
        return "skipped";
      }

      const matches =
        livePrice.unit_amount === item.unitAmount &&
        livePrice.currency === item.currency &&
        recurringMatches(livePrice, item.recurring) &&
        livePrice.tax_behavior === TAX_BEHAVIOR_EXCLUSIVE;

      if (matches) {
        const productDrift =
          product.name !== item.productName ||
          product.description !== item.productDescription ||
          product.active !== true ||
          product.tax_code !== item.taxCode;
        if (productDrift) {
          await s.products.update(product.id, {
            name: item.productName,
            description: item.productDescription,
            metadata: item.metadata,
            active: true,
            tax_code: item.taxCode,
          });
          return "updated";
        }
        return "unchanged";
      }

      await s.prices.create({
        product: product.id,
        unit_amount: item.unitAmount,
        currency: item.currency,
        ...(item.recurring ? { recurring: item.recurring } : {}),
        lookup_key: item.lookupKey,
        transfer_lookup_key: true,
        tax_behavior: TAX_BEHAVIOR_EXCLUSIVE,
        metadata: item.metadata,
      });
      await s.prices.update(livePrice.id, { active: false });
      return "updated";
    }

    const product = await findOrCreateProduct(s, item);
    await s.prices.create({
      product: product.id,
      unit_amount: item.unitAmount,
      currency: item.currency,
      ...(item.recurring ? { recurring: item.recurring } : {}),
      lookup_key: item.lookupKey,
      ...(archivedHoldsKey ? { transfer_lookup_key: true } : {}),
      tax_behavior: TAX_BEHAVIOR_EXCLUSIVE,
      metadata: item.metadata,
    });
    return "created";
  } catch (err) {
    logger.error(
      {
        err,
        lookupKey: item.lookupKey,
        unitAmount: item.unitAmount,
      },
      "stripe catalog sync: item failed",
    );
    return "error";
  }
};

export type StripeCatalogSyncSummary = {
  reason: "scheduled" | "boot" | "manual";
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  error: number;
  skipped: number;
  durationMs: number;
};

/**
 * Legacy Stripe catalog keys retired in the 2026-05 tier migration. The sync
 * pass archives any Products still living in Stripe under these lookup keys.
 * Idempotent: re-running after archival is a no-op.
 */
const LEGACY_LOOKUP_KEYS_TO_ARCHIVE: readonly string[] = [
  // Legacy A/B plans
  "ashford_plan_a_monthly",
  "ashford_plan_a_setup",
  "ashford_plan_b_monthly",
  "ashford_plan_b_setup",
  // Active addons folded into tiers
  "ashford_addon_online_booking_monthly",
  "ashford_addon_insurance_sliding_scale_monthly",
  "ashford_addon_first_visit_video_monthly",
  "ashford_addon_telehealth_bridge_monthly",
  "ashford_addon_telehealth_full_monthly",
  "ashford_addon_blog_publishing_monthly",
  "ashford_addon_patient_onboarding_hub_monthly",
  // Pre-existing retired addons (already archived in prior syncs — included
  // defensively in case a partial revival happened in the Stripe dashboard).
  "ashford_addon_spanish_pro_monthly",
  "ashford_addon_identity_pages_monthly",
  "ashford_addon_modalities_filter_monthly",
  "ashford_addon_phq9_screener_monthly",
  "ashford_addon_ai_quiz_monthly",
  "ashford_addon_google_profile_sync_monthly",
  "ashford_addon_welcome_kit_monthly",
  "ashford_addon_intake_forms_hub_monthly",
  "ashford_addon_cancellation_self_serve_monthly",
  "ashford_addon_insurance_precheck_monthly",
];

const archiveLegacyLookupKey = async (
  s: Stripe,
  lookupKey: string,
): Promise<SyncOutcome> => {
  try {
    const byLookup = await s.prices.list({
      lookup_keys: [lookupKey],
      limit: 5,
      expand: ["data.product"],
    });
    if (byLookup.data.length === 0) {
      return "unchanged";
    }
    const product = byLookup.data[0]?.product as Stripe.Product | undefined;
    let touchedPrice = false;
    for (const p of byLookup.data) {
      if (p.active) {
        await s.prices.update(p.id, { active: false });
        touchedPrice = true;
      }
    }
    if (product?.active) {
      await s.products.update(product.id, { active: false });
      return "updated";
    }
    return touchedPrice ? "updated" : "unchanged";
  } catch (err) {
    logger.error(
      { err, lookupKey },
      "stripe catalog sync: failed to archive legacy lookup key",
    );
    return "error";
  }
};

export const runStripeCatalogSyncOnce = async (
  reason: "scheduled" | "boot" | "manual",
): Promise<StripeCatalogSyncSummary> => {
  const startedAt = Date.now();
  const summary: StripeCatalogSyncSummary = {
    reason,
    total: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    error: 0,
    skipped: 0,
    durationMs: 0,
  };

  if (!stripe) {
    logger.warn(
      { reason },
      "stripe catalog sync: skipping (Stripe client not initialized — credentials missing)",
    );
    summary.durationMs = Date.now() - startedAt;
    return summary;
  }

  const items: CatalogItem[] = Object.values(TIERS).flatMap(
    tierToCatalogItems,
  );
  summary.total = items.length;

  for (const item of items) {
    const outcome = await syncOneItem(stripe, item);
    summary[outcome] += 1;
  }

  for (const lookupKey of LEGACY_LOOKUP_KEYS_TO_ARCHIVE) {
    const outcome = await archiveLegacyLookupKey(stripe, lookupKey);
    summary[outcome] += 1;
    summary.total += 1;
  }

  summary.durationMs = Date.now() - startedAt;
  logger.info(summary, "stripe catalog sync: complete");
  return summary;
};

let running = false;

const tickWithLock = async (): Promise<void> => {
  const client = await pool.connect();
  let acquired = false;
  try {
    const lockRes = await client.query<{ acquired: boolean }>(
      "select pg_try_advisory_lock($1) as acquired",
      [STRIPE_CATALOG_SYNC_LOCK_KEY],
    );
    acquired = lockRes.rows[0]?.acquired === true;
    if (!acquired) {
      logger.debug(
        "stripe catalog sync: another replica holds the lock, skipping",
      );
      return;
    }
    await runStripeCatalogSyncOnce("scheduled");
  } finally {
    if (acquired) {
      try {
        await client.query("select pg_advisory_unlock($1)", [
          STRIPE_CATALOG_SYNC_LOCK_KEY,
        ]);
      } catch (err) {
        logger.warn(
          { err },
          "stripe catalog sync: pg_advisory_unlock failed; lock will release on session end",
        );
      }
    }
    client.release();
  }
};

export const startStripeCatalogSyncScheduler = (): void => {
  if (process.env.NODE_ENV === "test") return;

  const tick = (): void => {
    if (running) return;
    running = true;
    void tickWithLock().finally(() => {
      running = false;
    });
  };

  setTimeout(() => {
    tick();
    setInterval(tick, STRIPE_CATALOG_SYNC_INTERVAL_MS);
  }, BOOT_STAGGER_MS);

  logger.info(
    { intervalMs: STRIPE_CATALOG_SYNC_INTERVAL_MS },
    "stripe catalog sync scheduler armed (daily, advisory-lock guarded, 30s boot stagger)",
  );
};
