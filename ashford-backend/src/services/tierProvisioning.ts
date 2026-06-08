import { logger } from "../lib/logger";
import type { TierKey } from "@workspace/api-zod";
import { db, sales } from "@workspace/db";
import { eq } from "drizzle-orm";
import { seedEditorialSchedule } from "./editorialSchedule";

/**
 * LOT 3.5 — Per-tier provisioning hooks called from the Stripe webhook
 * on customer.subscription.created.
 *
 * Each function is a stub that logs + leaves a TODO. The webhook calls
 * provisionTier(planKey, saleId) which dispatches by tier. None of these
 * have side-effects today; they exist so the integration seam is in
 * place and the first paid Pro/Concierge sale doesn't silently fall
 * through the cracks.
 */

export async function provisionBoutique(saleId: number): Promise<void> {
  logger.info({ saleId }, "[tier-provisioning] Boutique provisioning (no-op stub)");
  // TODO(tier-provisioning): no-op for foundation tier — existing flows
  // already cover everything Boutique ships.
}

export async function provisionPro(saleId: number): Promise<void> {
  logger.info({ saleId }, "[tier-provisioning] Pro provisioning (no-op stub)");
  // TODO(tier-provisioning):
  //   - Stand up patient_onboarding_hub workspace
  //   - Schedule first_visit_video interview
  //   - Initialize telehealth_bridge admin field (telehealthRoomUrl)
  //   - Send "Pro welcome" email with intake links
}

export async function provisionConcierge(saleId: number): Promise<void> {
  logger.info({ saleId }, "[tier-provisioning] Concierge provisioning");
  // [CLEANUP D.2] Seed the editorial schedule — 14 article reminder slots
  // across the next 12 months so the editor sees a steady cadence of
  // human-written pieces queued up in the admin UI. Soft-fail: never
  // block the webhook on a seeding error.
  try {
    const [sale] = await db
      .select({ leadId: sales.leadId })
      .from(sales)
      .where(eq(sales.id, saleId))
      .limit(1);
    if (sale?.leadId) {
      await seedEditorialSchedule(sale.leadId);
    } else {
      logger.warn({ saleId }, "[tier-provisioning] Concierge sale has no leadId");
    }
  } catch (err) {
    logger.error({ err, saleId }, "[tier-provisioning] editorial seed failed");
  }
  // TODO(tier-provisioning):
  //   - Trigger Doxy.me Pro account creation runbook (admin task surface)
  //   - Send "Concierge welcome" white-glove email
  //   - Notify ops via SMS that a Concierge sale needs hand-on attention
}

export async function provisionTier(planKey: TierKey, saleId: number): Promise<void> {
  switch (planKey) {
    case "boutique":
      return provisionBoutique(saleId);
    case "boutique_pro":
      return provisionPro(saleId);
    case "boutique_concierge":
      return provisionConcierge(saleId);
    default: {
      const exhaustive: never = planKey;
      void exhaustive;
      logger.warn({ planKey, saleId }, "[tier-provisioning] unknown tier");
    }
  }
}
