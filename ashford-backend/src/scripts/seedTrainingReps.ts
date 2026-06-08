/**
 * scripts/seedTrainingReps.ts — idempotent seeding of two named
 * training reps (Candice + Veronica) for the 2026-04-27 launch.
 *
 * Why a separate script: same reason as seedTestLeads.ts —
 * `seed.ts` TRUNCATEs sales_reps. This one only upserts these two
 * rows by `username`, leaving the rest of the rep roster intact.
 *
 * SECURITY NOTE — TRAINING PASSWORDS, ROTATE BEFORE GO-LIVE:
 *   Both reps ship with weak, deliberately memorable passwords so the
 *   founder can demo login during the live training session without
 *   fumbling for a password manager. Both reps MUST rotate their
 *   passwords (Settings → Change password) within 24 hours of their
 *   first login. The post-launch checklist in replit.md tracks this.
 *
 * Promo codes (CANDICE / VERONICA) are surfaced in their dashboard
 * and embedded in the prospect-portal short links they send out so
 * commission attribution flows back automatically.
 *
 * Usage:
 *   pnpm --filter @workspace/api-server exec tsx \
 *     src/scripts/seedTrainingReps.ts
 */

import { db, salesReps } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "../lib/password";

type TrainingRepSpec = {
  username: string;
  displayName: string;
  /** Plain-text training password — hashed below before insert. */
  trainingPassword: string;
  promoCode: string;
  phone: string;
  email: string;
};

const TRAINING_REPS: TrainingRepSpec[] = [
  {
    username: "candice",
    displayName: "Candice",
    trainingPassword: "Candice",
    promoCode: "CANDICE",
    phone: "+15125550111",
    email: "candice+demo@ashfordcreative.org",
  },
  {
    username: "veronica",
    displayName: "Veronica",
    trainingPassword: "Veronica",
    promoCode: "VERONICA",
    phone: "+15125550112",
    email: "veronica+demo@ashfordcreative.org",
  },
  {
    username: "lovette",
    displayName: "Lovette",
    trainingPassword: "Lovette",
    promoCode: "LOVETTE",
    phone: "+15125550113",
    email: "lovette+demo@ashfordcreative.org",
  },
];

async function upsertRep(
  spec: TrainingRepSpec,
): Promise<"inserted" | "updated"> {
  // We re-hash on every run. bcrypt is non-deterministic so the stored
  // hash will rotate, but the underlying password the rep types stays
  // the same — desirable for repeatable training sessions.
  const passwordHash = await hashPassword(spec.trainingPassword);

  const existing = await db
    .select({ id: salesReps.id })
    .from(salesReps)
    .where(eq(salesReps.username, spec.username))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(salesReps)
      .set({
        displayName: spec.displayName,
        passwordHash,
        promoCode: spec.promoCode,
        phone: spec.phone,
        email: spec.email,
        role: "rep",
        isActive: true,
        // Reset onboarding so the training session walks them through
        // the in-app guided tour again.
        // 2026-05-21 — `hasCompletedOnboarding` dropped (rep training gate killed).
        updatedAt: new Date(),
      })
      .where(eq(salesReps.id, existing[0].id));
    // 2026-05-21 — `onboardingAcknowledgments` table dropped (rep training gate killed).
    return "updated";
  }

  await db.insert(salesReps).values({
    username: spec.username,
    displayName: spec.displayName,
    passwordHash,
    role: "rep",
    promoCode: spec.promoCode,
    hourlyRateCents: 2500,
    phone: spec.phone,
    email: spec.email,
    isActive: true,
    // 2026-05-21 — `hasCompletedOnboarding` dropped (rep training gate killed).
  });
  return "inserted";
}

async function main(): Promise<void> {
  console.log(
    `seedTrainingReps: upserting ${TRAINING_REPS.length} training reps…`,
  );
  let inserted = 0;
  let updated = 0;
  for (const spec of TRAINING_REPS) {
    const result = await upsertRep(spec);
    if (result === "inserted") inserted++;
    else updated++;
    console.log(
      `  ${result.padEnd(8)}  ${spec.username.padEnd(12)} promo=${spec.promoCode}`,
    );
  }
  console.log(`done — inserted ${inserted}, updated ${updated}`);
  console.warn(
    "⚠️  Both reps were seeded with their first name as the training " +
      "password. Confirm they rotate it within 24 hours of first login " +
      "(post-launch checklist item in replit.md).",
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("seedTrainingReps failed:", err);
  process.exit(1);
});
