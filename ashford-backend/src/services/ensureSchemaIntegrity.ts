import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";

/**
 * 2026-05-14: Self-healing schema integrity boot hook.
 *
 * Replit's Drizzle migration sync compares the prod DB against the
 * journal in `lib/db/drizzle/meta/_journal.json`. Migrations whose
 * snapshot is missing from the journal (e.g. 0016+ for historical
 * reasons — see memory `feedback_ashford_drizzle_journal_drift`) can
 * be silently DROPPED on every Republish. The @Ashford-tag table
 * `admin_notifications` was a victim of that on 2026-05-14.
 *
 * Until the journal is fully rebuilt, we re-create drift-prone tables
 * on every server boot via CREATE TABLE IF NOT EXISTS. Idempotent and
 * cheap — postgres no-ops when the table already exists.
 */
export async function ensureSchemaIntegrity(): Promise<void> {
  try {
    // admin_notifications (audit fix #7 / migration 0023)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "admin_notifications" (
        "id" serial PRIMARY KEY NOT NULL,
        "kind" varchar(64) NOT NULL,
        "lead_id" integer REFERENCES "leads"("id") ON DELETE SET NULL,
        "rep_id" integer REFERENCES "sales_reps"("id") ON DELETE SET NULL,
        "body" text,
        "read_at" timestamp with time zone,
        "created_at" timestamp with time zone NOT NULL DEFAULT now()
      );
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "admin_notifications_unread_idx"
        ON "admin_notifications" ("read_at", "created_at" DESC);
    `);
    logger.info("ensureSchemaIntegrity: admin_notifications OK");
  } catch (err) {
    logger.error(
      { err },
      "ensureSchemaIntegrity failed — admin notifications may be unavailable",
    );
  }

  // portal_requests (Sprint 1 — portal request workflow, migration 0039).
  // Same journal-drift protection: CREATE TABLE IF NOT EXISTS on every
  // boot guarantees the rep "Demander un portail" button never 500s
  // after a Replit Republish that wipes the table.
  try {
    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'portal_request_status') THEN
          CREATE TYPE "portal_request_status" AS ENUM ('pending', 'handled');
        END IF;
      END $$;
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "portal_requests" (
        "id" serial PRIMARY KEY NOT NULL,
        "lead_id" integer NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
        "requested_by_rep_id" integer NOT NULL REFERENCES "sales_reps"("id") ON DELETE CASCADE,
        "message" text,
        "status" "portal_request_status" NOT NULL DEFAULT 'pending',
        "handled_by_rep_id" integer REFERENCES "sales_reps"("id") ON DELETE SET NULL,
        "handled_at" timestamp with time zone,
        "created_at" timestamp with time zone NOT NULL DEFAULT now()
      );
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "portal_requests_status_idx"
        ON "portal_requests" ("status", "created_at" DESC);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "portal_requests_lead_idx"
        ON "portal_requests" ("lead_id");
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "portal_requests_rep_idx"
        ON "portal_requests" ("requested_by_rep_id", "created_at" DESC);
    `);
    logger.info("ensureSchemaIntegrity: portal_requests OK");
  } catch (err) {
    logger.error(
      { err },
      "ensureSchemaIntegrity failed — portal_requests may be unavailable",
    );
  }
}
