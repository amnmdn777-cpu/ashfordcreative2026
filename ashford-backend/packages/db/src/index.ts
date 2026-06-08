import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

// Postgres trigram extension. Used by lead search (services/leads.ts) for
// typo-tolerant name matching ("Dolores" → "Dr. Delores Hendrix-Giles") via
// `word_similarity()`. We track readiness in `pgTrgmReady` so callers can
// gate the trigram clause behind an availability check — referencing
// `word_similarity(...)` when the extension isn't installed throws
// `function does not exist` and fails the entire query, which would defeat
// the substring-LIKE fallback the search relies on. Idempotent + non-
// blocking: a missing CREATE EXTENSION privilege only degrades search to
// substring matching; the rest of the app boots normally.
let trgmReady = false;
const trgmInit = pool
  .query("CREATE EXTENSION IF NOT EXISTS pg_trgm")
  .then(() => {
    trgmReady = true;
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.warn(
      "pg_trgm extension setup failed (fuzzy lead search disabled):",
      err,
    );
  });

/**
 * True once `CREATE EXTENSION pg_trgm` has resolved successfully. Callers
 * that emit trigram functions (`word_similarity`, `similarity`, `%`) MUST
 * check this flag and fall back to plain `ILIKE` when false; otherwise
 * Postgres will raise on every query that touches the function.
 */
export const isPgTrgmReady = (): boolean => trgmReady;

/**
 * Resolves once the trigram extension probe has finished (either with
 * success or with a logged failure). Useful in tests and at the end of
 * boot; production callers should use `isPgTrgmReady()` per-request so a
 * slow CREATE EXTENSION never blocks request handling.
 */
export const pgTrgmInitialized = (): Promise<void> => trgmInit;

export * from "./schema";
