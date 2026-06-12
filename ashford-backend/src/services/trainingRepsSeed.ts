import { db, salesReps, leads } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "../lib/password";
import { logger } from "../lib/logger";

type TrainingRepSpec = {
  username: string;
  displayName: string;
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
    email: "candice+demo@ashfordhealthcreative.com",
  },
  {
    username: "veronica",
    displayName: "Veronica",
    trainingPassword: "Veronica",
    promoCode: "VERONICA",
    phone: "+15125550112",
    email: "veronica+demo@ashfordhealthcreative.com",
  },
  {
    username: "lovette",
    displayName: "Lovette",
    trainingPassword: "Lovette",
    promoCode: "LOVETTE",
    phone: "+15125550113",
    email: "lovette+demo@ashfordhealthcreative.com",
  },
];

export async function ensureTrainingRepsSeeded(): Promise<void> {
  try {
    let inserted = 0;
    let unchanged = 0;
    for (const spec of TRAINING_REPS) {
      const existing = await db
        .select({ id: salesReps.id })
        .from(salesReps)
        .where(eq(salesReps.username, spec.username))
        .limit(1);

      if (existing.length > 0) {
        unchanged++;
        continue;
      }

      const passwordHash = await hashPassword(spec.trainingPassword);
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
      inserted++;
    }
    if (inserted > 0) {
      logger.info(
        { inserted, unchanged },
        "training-reps-seed: candice/veronica training reps seeded",
      );
    }

    // 2026-04-28 — removed the boot-time "release Sarah Wilson"
    // data-mutation block. It already ran on every prod boot since
    // launch and the lead-pool state is now correct, so leaving it in
    // would just be unscoped data churn on every server restart.
    // If the same situation happens again, run the fixup as a
    // one-shot script under `scripts/`, never on boot.
  } catch (err) {
    logger.error({ err }, "training-reps-seed: failed");
  }
}
