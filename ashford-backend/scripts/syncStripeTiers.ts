/**
 * One-shot Stripe catalog sync for the 2026-05 tier migration.
 *
 * Creates the 3 new tier Products in Stripe and archives the legacy
 * `ashford_plan_a/b_*` + `ashford_addon_*` Products. Idempotent: re-running
 * is safe and reports outcomes.
 *
 * USAGE (from repo root, with prod credentials available):
 *
 *   pnpm --filter @workspace/api-server exec tsx scripts/syncStripeTiers.ts
 *
 * On Replit the Stripe secret key is hydrated from the Replit connector at
 * boot — not a plain `STRIPE_SECRET_KEY` env var. This script calls the
 * same hydrator (`hydrateStripeFromConnector`) before invoking the sync, so
 * it works without a manual env export. If you're running outside Replit,
 * set `STRIPE_SECRET_KEY` and the hydrator will report `already_set`.
 *
 * Safety: archival is non-destructive (Stripe forbids deletion once a Price
 * has been used). Legacy Products will be marked `active = false` and remain
 * attached to any existing subscriptions until those renew or migrate.
 */

// Hydrate Stripe credentials from the Replit connector BEFORE any module that
// derives the `stripe` singleton from env.ts is imported. Matches the boot
// sequence in src/index.ts — without this the singleton lands as null and
// the sync refuses to run, even though the connector token is available a
// few hundred ms later.
import { hydrateStripeFromConnector } from "../src/lib/stripeBootstrap";

const main = async (): Promise<void> => {
  const hydration = await hydrateStripeFromConnector();
  if (!hydration.hydrated && hydration.reason !== "already_set") {
    console.warn(
      `[syncStripeTiers] Stripe connector hydration: ${hydration.reason}`,
    );
  } else {
    console.log(
      `[syncStripeTiers] Stripe credentials ready (source: ${hydration.hydrated ? "replit_connector" : "env"})`,
    );
  }

  // Dynamic imports so the stripe singleton evaluates AFTER hydration above.
  const { TIERS } = await import("@workspace/api-zod");
  const { stripe } = await import("../src/integrations/stripe");
  const { runStripeCatalogSyncOnce } = await import(
    "../src/services/stripeCatalogSync"
  );
  const { logger } = await import("../src/lib/logger");

  if (!stripe) {
    console.error(
      "[syncStripeTiers] Stripe singleton is null after hydration — refusing to run.",
    );
    process.exit(2);
  }

  console.log("[syncStripeTiers] starting tier sync against Stripe live API");
  const summary = await runStripeCatalogSyncOnce("manual");
  console.log("[syncStripeTiers] sync summary:", summary);

  console.log("\n[syncStripeTiers] tier Product IDs (paste into PR):");
  for (const tier of Object.values(TIERS)) {
    try {
      const found = await stripe.products.search({
        query: `metadata['ashford_kind']:'tier' AND metadata['ashford_key']:'${tier.key}'`,
        limit: 1,
      });
      const product = found.data[0];
      if (product) {
        console.log(`  ${tier.key.padEnd(22)} → ${product.id}  (${tier.label})`);
      } else {
        console.log(`  ${tier.key.padEnd(22)} → NOT FOUND`);
      }
    } catch (err) {
      logger.error({ err, tierKey: tier.key }, "tier lookup failed");
    }
  }

  console.log("\n[syncStripeTiers] archived legacy Product IDs:");
  for (const legacyKey of ["A", "B"]) {
    try {
      const found = await stripe.products.search({
        query: `metadata['ashford_kind']:'plan' AND metadata['ashford_key']:'${legacyKey}'`,
        limit: 1,
      });
      const product = found.data[0];
      if (product) {
        console.log(
          `  plan ${legacyKey.padEnd(20)} → ${product.id}  (active=${product.active})`,
        );
      } else {
        console.log(`  plan ${legacyKey.padEnd(20)} → not found (was never synced)`);
      }
    } catch (err) {
      logger.error({ err, legacyKey }, "legacy plan lookup failed");
    }
  }

  console.log("\n[syncStripeTiers] done.");
  process.exit(summary.error > 0 ? 1 : 0);
};

main().catch((err) => {
  console.error("[syncStripeTiers] fatal:", err);
  process.exit(1);
});
