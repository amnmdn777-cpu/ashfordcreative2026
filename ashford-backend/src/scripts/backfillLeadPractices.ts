/**
 * LOT 2.1 — Backfill corrupted lead practice names.
 *
 * `scripts/importLeads.ts` used to split keywords like `the`/`and` inside
 * other words (regex `(?<=\w)the(?=\w)`), turning `therapy` into `the rapy`.
 * ~50 rows in prod end up as "Bwbh The Rapy", "Outside The Boxpsycho The
 * Rapy", "Hea The Rfry The Rapy", etc.
 *
 * For each corrupted row:
 *   1. practice_original := current practice   (only if NULL, idempotent)
 *   2. derive a clean stem by lowercasing + stripping spaces
 *   3. re-run splitPracticeStem + toTitleCase on the stem
 *   4. UPDATE leads SET practice = new_practice
 *
 * Run: pnpm --filter @workspace/api-server tsx \
 *        src/scripts/backfillLeadPractices.ts            # dry run
 *      pnpm --filter @workspace/api-server tsx \
 *        src/scripts/backfillLeadPractices.ts --apply    # commit
 */
import { sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { splitPracticeStem, toTitleCase } from "@workspace/api-zod";

const CORRUPTION_RE = /the rapy|and counseling|psycho the rapy|the rapist/i;

function rebuildPractice(corrupted: string): string {
  // Strip whitespace + lowercase to recover an approximation of the original
  // domain stem, then re-run the (now correct) split + title-case pipeline.
  const stem = corrupted.replace(/\s+/g, "").toLowerCase();
  const split = splitPracticeStem(stem);
  return toTitleCase(split);
}

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`[backfillLeadPractices] mode: ${apply ? "APPLY" : "DRY RUN"}`);

  type Row = { id: number; practice: string; practice_original: string | null };
  const result = await db.execute<Row>(sql`
    SELECT id, practice, practice_original
    FROM leads
    WHERE practice ~* 'The Rapy|And Counseling|Psycho The Rapy|The Rapist'
    ORDER BY id ASC
  `);
  const candidates = (result as unknown as { rows?: Row[] }).rows ?? [];

  console.log(`[backfillLeadPractices] matched ${candidates.length} corrupted rows`);

  let touched = 0;
  let skipped = 0;
  for (const row of candidates) {
    if (!CORRUPTION_RE.test(row.practice)) {
      skipped += 1;
      continue;
    }
    const next = rebuildPractice(row.practice);
    if (next === row.practice) {
      skipped += 1;
      continue;
    }
    console.log(`  lead#${row.id}: "${row.practice}" → "${next}"`);
    if (apply) {
      await db.execute(sql`
        UPDATE leads
        SET
          practice = ${next},
          practice_original = COALESCE(practice_original, ${row.practice})
        WHERE id = ${row.id}
      `);
    }
    touched += 1;
  }

  console.log(
    `[backfillLeadPractices] done. touched=${touched} skipped=${skipped} apply=${apply}`,
  );
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

