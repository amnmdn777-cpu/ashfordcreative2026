/**
 * Release every lead currently claimed by a given rep back into the
 * public pool (#225, founder Candice 2026-05-08). Candice was claiming
 * leads while testing the rep dashboard and they are now blocking the
 * active sales rep from picking them up.
 *
 * For each affected lead, sets:
 *   - claimedByRepId  = NULL
 *   - claimedAt       = NULL
 *   - claimExpiresAt  = NULL
 *   - status          = 'available'
 * and sends the rep a `lead.recycled`-style notification so the audit
 * trail explains why the lead bounced back to `available` (mirrors the
 * pattern in `recycleStaleClaims`).
 *
 * Defaults to username `candice`; pass `--username=<name>` to target a
 * different rep. Defaults to dry-run; pass `--apply` to commit.
 *
 * Run:   pnpm --filter @workspace/api-server tsx \
 *          src/scripts/releaseRepClaims.ts                       # dry run, candice
 *        pnpm --filter @workspace/api-server tsx \
 *          src/scripts/releaseRepClaims.ts --apply               # commit
 *        pnpm --filter @workspace/api-server tsx \
 *          src/scripts/releaseRepClaims.ts --username=alex --apply
 */
import { and, eq } from "drizzle-orm";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { db, leads, salesReps, pool } from "@workspace/db";
import { writeAuditExplicit } from "../services/auditLog";
import { notify } from "../services/notifications";

function readArg(name: string, fallback: string): string {
  const flag = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(flag));
  return hit ? hit.slice(flag.length) : fallback;
}

async function main(): Promise<void> {
  const username = readArg("username", "candice");
  const apply = process.argv.includes("--apply");

  const [rep] = await db
    .select()
    .from(salesReps)
    .where(eq(salesReps.username, username))
    .limit(1);
  if (!rep) {
    // eslint-disable-next-line no-console
    console.error(`[release-claims] rep "${username}" not found`);
    process.exit(1);
  }

  const claimed = await db
    .select({
      id: leads.id,
      name: leads.name,
      practice: leads.practice,
      status: leads.status,
    })
    .from(leads)
    .where(eq(leads.claimedByRepId, rep.id));

  // eslint-disable-next-line no-console
  console.log(
    `[release-claims] rep "${username}" (id=${rep.id}) currently claims ${claimed.length} leads`,
  );
  for (const c of claimed) {
    // eslint-disable-next-line no-console
    console.log(`  lead #${c.id} (${c.name}) status=${c.status}`);
  }

  if (!apply) {
    // eslint-disable-next-line no-console
    console.log("[release-claims] dry run — pass --apply to commit");
    await pool.end();
    return;
  }

  if (claimed.length === 0) {
    // eslint-disable-next-line no-console
    console.log("[release-claims] nothing to release");
    await pool.end();
    return;
  }

  // Confirmation prompt — destructive bulk write, opt-out via --yes for
  // CI/scripted runs.
  if (!process.argv.includes("--yes")) {
    const rl = readline.createInterface({ input, output });
    const ans = (
      await rl.question(
        `[release-claims] About to release ${claimed.length} leads from "${username}". Type "yes" to continue: `,
      )
    )
      .trim()
      .toLowerCase();
    rl.close();
    if (ans !== "yes") {
      // eslint-disable-next-line no-console
      console.log("[release-claims] aborted");
      await pool.end();
      return;
    }
  }

  const now = new Date();
  for (const c of claimed) {
    await db
      .update(leads)
      .set({
        claimedByRepId: null,
        claimedAt: null,
        claimExpiresAt: null,
        status: "available",
        updatedAt: now,
      })
      .where(and(eq(leads.id, c.id), eq(leads.claimedByRepId, rep.id)));
    // LOT 1.2 carryover — route audit insert through writeAuditExplicit
    // helper so the before/after columns are populated (script context;
    // no Request available).
    await writeAuditExplicit({
      actor: { id: rep.id, role: "admin" },
      ip: null,
      userAgent: null,
      action: "claim_released_admin",
      targetType: "lead",
      targetId: c.id,
      before: { claimedByRepId: rep.id, status: c.status },
      after: {
        claimedByRepId: null,
        status: "available",
        reason: "ops:releaseRepClaims",
        username,
      },
    });
    await notify({
      repId: rep.id,
      type: "lead.recycled",
      title: `Lead released: ${c.practice}`,
      body: `An admin released this lead back to the public pool (ops:releaseRepClaims).`,
      payload: { leadId: c.id, reason: "ops:releaseRepClaims" },
      linkUrl: `/dashboard/leads/${c.id}`,
    });
  }
  // eslint-disable-next-line no-console
  console.log(`[release-claims] released ${claimed.length} leads`);
  await pool.end();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[release-claims] failed:", err);
  process.exit(1);
});
