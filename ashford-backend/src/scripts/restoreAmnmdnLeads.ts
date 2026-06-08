/**
 * One-shot repair: restore original email addresses on the two leads
 * whose email column was overwritten with the test address
 * `amnmdn777@gmail.com` during a manual override flow on prod (Candice
 * spot-checked, May 2026).
 *
 * The two affected leads have NO `psychology_today` enrichment row, so
 * we cannot re-derive the original emails programmatically (unlike the
 * sibling `restoreJamonteEmail.ts` script which restores from the PT
 * payload). The originals were instead recovered from the development
 * database and are hardcoded below.
 *
 * Safety guard: only updates a lead when its current email exactly
 * equals the override fingerprint (`amnmdn777@gmail.com`). If the rep
 * has already corrected the address by hand, this script is a no-op.
 *
 * Idempotent — re-running on a healed lead is a no-op.
 *
 * Run:   pnpm --filter @workspace/api-server tsx \
 *          src/scripts/restoreAmnmdnLeads.ts            # dry run
 *        pnpm --filter @workspace/api-server tsx \
 *          src/scripts/restoreAmnmdnLeads.ts --apply    # writes
 */
import { and, eq } from "drizzle-orm";
import { db, leads, pool } from "@workspace/db";

const OVERRIDE_FINGERPRINT = "amnmdn777@gmail.com";

// Originals recovered from the development database (canonical pre-bug
// state). Lead #2 is a seed/test row whose original email is itself a
// placeholder (`sw1@example.com`); restoring it returns the lead to its
// pre-override state, which is the requested behaviour.
const RESTORATIONS: ReadonlyArray<{
  id: number;
  name: string;
  email: string;
}> = [
  { id: 566, name: "Jamonte Banks", email: "jrbanks1609@gmail.com" },
  { id: 2, name: "Sarah Wilson", email: "sw1@example.com" },
];

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const updates: Array<{ id: number; name: string; email: string }> = [];

  for (const target of RESTORATIONS) {
    const [row] = await db
      .select({ id: leads.id, name: leads.name, email: leads.email })
      .from(leads)
      .where(eq(leads.id, target.id));
    if (!row) {
      // eslint-disable-next-line no-console
      console.log(`  lead #${target.id} not found — skipping`);
      continue;
    }
    if ((row.email ?? "").toLowerCase() !== OVERRIDE_FINGERPRINT) {
      // eslint-disable-next-line no-console
      console.log(
        `  lead #${row.id} (${row.name}) email is "${row.email}" — not the override fingerprint, skipping`,
      );
      continue;
    }
    updates.push(target);
  }

  for (const u of updates) {
    // eslint-disable-next-line no-console
    console.log(`  lead #${u.id} (${u.name}) ← ${u.email}`);
  }
  // eslint-disable-next-line no-console
  console.log(`[restore-amnmdn] ${updates.length} lead(s) to restore`);

  if (!apply) {
    // eslint-disable-next-line no-console
    console.log("[restore-amnmdn] dry run — pass --apply to write");
    await pool.end();
    return;
  }
  for (const u of updates) {
    await db
      .update(leads)
      .set({ email: u.email, updatedAt: new Date() })
      .where(
        and(eq(leads.id, u.id), eq(leads.email, OVERRIDE_FINGERPRINT)),
      );
  }
  // eslint-disable-next-line no-console
  console.log(`[restore-amnmdn] restored email on ${updates.length} lead(s)`);
  await pool.end();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[restore-amnmdn] failed:", err);
  process.exit(1);
});
