/**
 * [CLEANUP D.3/D.4] Editorial pipeline admin API.
 *
 * Powers the Editorial Queue admin UI — the "Articles to write today"
 * surface where the human editor sees pending reminder rows from
 * `article_schedule` and types the article by hand into the linked
 * `editorial_posts` row.
 *
 * Pure CRUD on top of the two tables seeded by provisionConcierge — no
 * drafting, no rewriting, just storage for what the editor types.
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  db,
  articleSchedule,
  editorialPosts,
  leads,
} from "@workspace/db";
import { and, eq, sql, desc, lte } from "drizzle-orm";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth, requireAdmin } from "../../middleware/requireAuth";
import { badRequest, notFound } from "../../lib/errors";

const router: IRouter = Router();

router.use("/admin/editorial", requireAuth, requireAdmin);

const todayYmd = (): string => {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

/**
 * GET /admin/editorial/due — rows with due_date <= today and status='pending'
 * joined with the lead for name/specialty/city display.
 */
router.get(
  "/admin/editorial/due",
  asyncHandler(async (_req, res) => {
    const today = todayYmd();
    const rows = await db
      .select({
        id: articleSchedule.id,
        leadId: articleSchedule.leadId,
        dueDate: articleSchedule.dueDate,
        topicHint: articleSchedule.topicHint,
        status: articleSchedule.status,
        notes: articleSchedule.notes,
        leadName: leads.name,
        practice: leads.practice,
        specialty: leads.specialty,
        city: leads.city,
      })
      .from(articleSchedule)
      .innerJoin(leads, eq(leads.id, articleSchedule.leadId))
      .where(
        and(
          eq(articleSchedule.status, "pending"),
          lte(articleSchedule.dueDate, today),
        ),
      )
      .orderBy(articleSchedule.dueDate, articleSchedule.id);
    res.json({ items: rows });
  }),
);

/**
 * GET /admin/editorial/due-count — small badge count for the Dashboard home.
 */
router.get(
  "/admin/editorial/due-count",
  asyncHandler(async (_req, res) => {
    const today = todayYmd();
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(articleSchedule)
      .where(
        and(
          eq(articleSchedule.status, "pending"),
          lte(articleSchedule.dueDate, today),
        ),
      );
    res.json({ count: row?.count ?? 0 });
  }),
);

/**
 * GET /admin/editorial/:scheduleId — full row + lead + linked editorial_post
 * (if one already exists) for the editor form.
 */
router.get(
  "/admin/editorial/:scheduleId",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.scheduleId);
    const [row] = await db
      .select({
        schedule: articleSchedule,
        lead: leads,
      })
      .from(articleSchedule)
      .innerJoin(leads, eq(leads.id, articleSchedule.leadId))
      .where(eq(articleSchedule.id, id))
      .limit(1);
    if (!row) throw notFound("Schedule row not found");
    const [post] = await db
      .select()
      .from(editorialPosts)
      .where(eq(editorialPosts.scheduleId, id))
      .orderBy(desc(editorialPosts.updatedAt))
      .limit(1);
    res.json({
      schedule: {
        id: row.schedule.id,
        leadId: row.schedule.leadId,
        dueDate: row.schedule.dueDate,
        topicHint: row.schedule.topicHint,
        status: row.schedule.status,
        notes: row.schedule.notes,
      },
      lead: {
        id: row.lead.id,
        name: row.lead.name,
        practice: row.lead.practice,
        specialty: row.lead.specialty,
        city: row.lead.city,
      },
      post: post
        ? {
            id: post.id,
            status: post.status,
            title: post.title,
            slug: post.slug,
            bodyEn: post.bodyEn,
            bodyEs: post.bodyEs,
            metaDescription: post.metaDescription,
            publishedAt: post.publishedAt
              ? post.publishedAt.toISOString()
              : null,
          }
        : null,
    });
  }),
);

const SavePostBody = z.object({
  title: z.string().min(1).max(256),
  slug: z.string().min(1).max(160).optional(),
  bodyEn: z.string().default(""),
  bodyEs: z.string().default(""),
  metaDescription: z.string().max(320).nullable().optional(),
  publish: z.boolean().optional(),
});

/**
 * POST /admin/editorial/:scheduleId/save — upsert the editorial_post linked
 * to this schedule row. `publish=true` flips status='published' +
 * published_at=now(). Always marks article_schedule.status='written' on
 * first save.
 */
router.post(
  "/admin/editorial/:scheduleId/save",
  asyncHandler(async (req, res) => {
    const scheduleId = z.coerce.number().int().parse(req.params.scheduleId);
    const body = SavePostBody.parse(req.body);

    const [sched] = await db
      .select()
      .from(articleSchedule)
      .where(eq(articleSchedule.id, scheduleId))
      .limit(1);
    if (!sched) throw notFound("Schedule row not found");

    const slug = (body.slug && body.slug.length > 0
      ? body.slug
      : slugify(body.title)
    ).slice(0, 160);
    if (!slug) throw badRequest("Slug could not be derived from title");

    const willPublish = Boolean(body.publish);
    const now = new Date();

    const [existing] = await db
      .select()
      .from(editorialPosts)
      .where(eq(editorialPosts.scheduleId, scheduleId))
      .limit(1);

    let post: typeof editorialPosts.$inferSelect;
    if (existing) {
      const [updated] = await db
        .update(editorialPosts)
        .set({
          title: body.title,
          slug,
          bodyEn: body.bodyEn,
          bodyEs: body.bodyEs,
          metaDescription: body.metaDescription ?? null,
          status: willPublish ? "published" : existing.status,
          publishedAt: willPublish
            ? (existing.publishedAt ?? now)
            : existing.publishedAt,
          updatedAt: now,
        })
        .where(eq(editorialPosts.id, existing.id))
        .returning();
      post = updated;
    } else {
      const [inserted] = await db
        .insert(editorialPosts)
        .values({
          leadId: sched.leadId,
          scheduleId: sched.id,
          title: body.title,
          slug,
          bodyEn: body.bodyEn,
          bodyEs: body.bodyEs,
          metaDescription: body.metaDescription ?? null,
          dueDate: sched.dueDate,
          status: willPublish ? "published" : "draft",
          publishedAt: willPublish ? now : null,
        })
        .returning();
      post = inserted;
    }

    // First save marks the schedule row 'written'. Republishes don't
    // need to flip it again.
    if (sched.status === "pending") {
      await db
        .update(articleSchedule)
        .set({ status: "written" })
        .where(eq(articleSchedule.id, sched.id));
    }

    res.json({
      post: {
        id: post.id,
        status: post.status,
        title: post.title,
        slug: post.slug,
        bodyEn: post.bodyEn,
        bodyEs: post.bodyEs,
        metaDescription: post.metaDescription,
        publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
      },
    });
  }),
);

export default router;
