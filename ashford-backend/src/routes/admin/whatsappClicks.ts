import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, whatsappClicks, leads } from "@workspace/db";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import {
  requireAuth,
  requireAdmin,
} from "../../middleware/requireAuth";
import { asyncHandler } from "../../middleware/asyncHandler";

const router: IRouter = Router();

router.use("/admin/whatsapp", requireAuth, requireAdmin);

/**
 * GET /admin/whatsapp/clicks
 *   ?limit=200&days=30&template=<key>&search=<page-path-substring>
 *
 * Returns the click log with the optional joined lead (when the click
 * came from an authenticated portal). Page-path search is a simple
 * ILIKE — fine for the volumes we expect (well under 1000 clicks/month).
 */

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
  days: z.coerce.number().int().min(1).max(365).default(60),
  template: z.string().max(64).optional(),
  search: z.string().max(128).optional(),
});

router.get(
  "/admin/whatsapp/clicks",
  asyncHandler(async (req, res) => {
    const q = QuerySchema.parse(req.query);
    const cutoff = new Date(Date.now() - q.days * 24 * 60 * 60 * 1000);

    const conds = [gte(whatsappClicks.clickedAt, cutoff)];
    if (q.template) conds.push(eq(whatsappClicks.templateKey, q.template));
    if (q.search) {
      conds.push(sql`${whatsappClicks.pagePath} ILIKE ${"%" + q.search + "%"}`);
    }

    const rows = await db
      .select({
        id: whatsappClicks.id,
        sessionId: whatsappClicks.sessionId,
        templateKey: whatsappClicks.templateKey,
        pagePath: whatsappClicks.pagePath,
        referrer: whatsappClicks.referrer,
        locale: whatsappClicks.locale,
        leadId: whatsappClicks.leadId,
        userAgent: whatsappClicks.userAgent,
        ipAddress: whatsappClicks.ipAddress,
        note: whatsappClicks.note,
        clickedAt: whatsappClicks.clickedAt,
        leadName: leads.contactName,
        leadEmail: leads.contactEmail,
      })
      .from(whatsappClicks)
      .leftJoin(leads, eq(leads.id, whatsappClicks.leadId))
      .where(and(...conds))
      .orderBy(desc(whatsappClicks.clickedAt))
      .limit(q.limit);

    res.json({
      clicks: rows.map((r) => ({
        ...r,
        clickedAt: r.clickedAt.toISOString(),
      })),
    });
  }),
);

/**
 * GET /admin/whatsapp/summary?days=30
 *
 * Aggregate KPIs for the page header: total clicks, unique sessions,
 * per-template breakdown. Cheap two-query roll-up — no materialized
 * view needed at the volumes we care about.
 */
router.get(
  "/admin/whatsapp/summary",
  asyncHandler(async (req, res) => {
    const days = Math.min(
      365,
      Math.max(1, Number(req.query.days ?? 30) || 30),
    );
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totals] = await db
      .select({
        clicks: sql<number>`count(*)::int`,
        uniqueSessions: sql<number>`count(distinct ${whatsappClicks.sessionId})::int`,
      })
      .from(whatsappClicks)
      .where(gte(whatsappClicks.clickedAt, cutoff));

    const byTemplate = await db
      .select({
        templateKey: whatsappClicks.templateKey,
        clicks: sql<number>`count(*)::int`,
      })
      .from(whatsappClicks)
      .where(gte(whatsappClicks.clickedAt, cutoff))
      .groupBy(whatsappClicks.templateKey)
      .orderBy(desc(sql`count(*)`));

    res.json({
      days,
      clicks: totals?.clicks ?? 0,
      uniqueSessions: totals?.uniqueSessions ?? 0,
      byTemplate: byTemplate.map((r) => ({
        templateKey: r.templateKey ?? "(unknown)",
        clicks: r.clicks,
      })),
    });
  }),
);

export default router;
