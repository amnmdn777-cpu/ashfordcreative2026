// Apply a single .sql file to $DATABASE_URL in one transaction.
//
// Used as a bootstrap escape hatch when `drizzle-kit migrate` can't run.
// Our DB was originally provisioned via `drizzle-kit push`, which does
// not populate the `drizzle.__drizzle_migrations` tracking table — so a
// later `migrate` tries to re-apply migration 0000 from scratch and
// errors on every "already exists" object. This script lets us cherry-
// pick the pending .sql files directly. The migrations themselves are
// authored to be idempotent (IF NOT EXISTS / IF EXISTS / DO-block
// column-presence checks), so re-runs are safe.
//
// Usage (from repo root):
//   pnpm --filter @workspace/db apply-sql lib/db/drizzle/0013_lead_status_cold.sql
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const file = process.argv[2];
if (!file) {
  console.error("usage: tsx applySql.ts <path/to/migration.sql>");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL must be set");
  process.exit(1);
}

const sql = readFileSync(resolve(file), "utf8");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

await client.connect();
try {
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log(`Applied: ${file}`);
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`Failed: ${file}`);
  console.error(err);
  process.exit(1);
} finally {
  await client.end();
}
