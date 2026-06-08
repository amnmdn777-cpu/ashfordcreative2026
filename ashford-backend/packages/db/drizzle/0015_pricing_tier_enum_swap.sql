-- Phase 1A: replace legacy plan_key enum (A/B) with 3-tier model.
--
-- Context: only 17 sales rows existed pre-migration, all test data with no
-- live customer impact. Decisions: artifacts/api-server/docs/pricing-migration-decisions.md
--
-- Step 0  truncate sales (cascades to subscriptions). Run in the SAME txn as
--         the enum swap so we never sit in a half-migrated state.
-- Step 1  drop the column default that references the old enum.
-- Step 2  rename the old enum so we can create a fresh one at the canonical name.
-- Step 3  create the new enum carrying only the 3 tier values.
-- Step 4  re-type the sales.plan_key column to the new enum (no USING needed —
--         the column is empty after the truncate).
-- Step 5  drop the legacy enum type.

BEGIN;

-- 0. Wipe test sales + cascading subscriptions. The CASCADE on FK already
--    deletes subscription rows; an explicit TRUNCATE on both keeps the intent
--    auditable.
TRUNCATE TABLE "subscriptions" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "sales" RESTART IDENTITY CASCADE;

-- 1. There's no default on sales.plan_key today, but guard for future drift.
ALTER TABLE "sales" ALTER COLUMN "plan_key" DROP DEFAULT;

-- 2-3. Swap enum types.
ALTER TYPE "plan_key" RENAME TO "plan_key__legacy_ab";
CREATE TYPE "plan_key" AS ENUM ('boutique', 'boutique_pro', 'boutique_concierge');

-- 4. Re-point the column at the new enum. Table is empty so the cast is a no-op.
ALTER TABLE "sales"
  ALTER COLUMN "plan_key" TYPE "plan_key"
  USING "plan_key"::text::"plan_key";

-- 5. Drop the legacy enum (no other tables reference it).
DROP TYPE "plan_key__legacy_ab";

COMMIT;
