import { Router, type IRouter } from "express";
import { db, sales } from "@workspace/db";
import { eq, sql, and, gte } from "drizzle-orm";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { dateToIso } from "../../lib/serialize";

const router: IRouter = Router();

// Source of truth for rep comp. Keep these aligned with stripeWebhook.ts and
// the candidate quiz answers in lib/candidateQuiz.ts.
const CLOSING_BONUS_CENTS = 14900; // $149 per close
const BASE_PLAN_CENTS = 19900;     // $199/mo base plan

router.use("/dashboard", requireAuth);

router.get(
  "/dashboard/comp/summary",
  asyncHandler(async (req, res) => {
    const repId = req.user!.id;
    const startMonth = new Date();
    startMonth.setUTCDate(1);
    startMonth.setUTCHours(0, 0, 0, 0);

    const closingsThisMonth = await db
      .select({
        count: sql<number>`count(*)::int`,
        // First-month add-on bonus = everything above the $199 base, summed
        // across this month's sales. Historical rows that were stored with the
        // old $149 fallback will simply contribute $0, which is the correct
        // backfill behavior.
        addonBonusCents: sql<number>`coalesce(sum(greatest(${sales.monthlyAmountCents} - ${BASE_PLAN_CENTS}, 0)), 0)::int`,
      })
      .from(sales)
      .where(and(eq(sales.repId, repId), gte(sales.occurredAt, startMonth)));

    const totalSales = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sales)
      .where(eq(sales.repId, repId));

    const closings = closingsThisMonth[0]?.count ?? 0;
    const firstMonthAddonBonusThisMonthCents =
      closingsThisMonth[0]?.addonBonusCents ?? 0;
    const closingBonusThisMonthCents = closings * CLOSING_BONUS_CENTS;

    res.json({
      hourlyRateCents: req.user!.hourlyRateCents,
      closingsThisMonth: closings,
      closingBonusThisMonthCents,
      firstMonthAddonBonusThisMonthCents,
      totalBonusThisMonthCents:
        closingBonusThisMonthCents + firstMonthAddonBonusThisMonthCents,
      totalLifetimeSalesCount: totalSales[0]?.count ?? 0,
    });
  }),
);

router.get(
  "/dashboard/sales",
  asyncHandler(async (req, res) => {
    const repId = req.user!.id;
    const rows = await db
      .select()
      .from(sales)
      .where(eq(sales.repId, repId))
      .orderBy(sql`${sales.occurredAt} desc`)
      .limit(100);
    res.json({ sales: dateToIso(rows) });
  }),
);

export default router;
