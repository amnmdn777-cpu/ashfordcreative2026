/**
 * [CLEANUP D.7] Public read-only endpoints for the Editorial Insights
 * Journal articles a human editor writes for each Concierge practitioner.
 *
 * Filtered by lead (practitioner) and `status='published'`. EN/ES body
 * selection is left to the client (the site reads `useLanguage()` and
 * renders body_en or body_es).
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, editorialPosts } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { asyncHandler } from "../../middleware/asyncHandler";
import { notFound } from "../../lib/errors";

const router: IRouter = Router();

/**
 * GET /api/editorial/posts?leadId=123 — list published posts for one
 * practitioner. Capped at 50 rows.
 */
router.get(
  "/editorial/posts",
  asyncHandler(async (req, res) => {
    const leadId = z.coerce.number().int().min(1).safeParse(req.query.leadId);
    if (!leadId.success) {
      res.json({ posts: [] });
      return;
    }
    const rows = await db
      .select({
        id: editorialPosts.id,
        slug: editorialPosts.slug,
        title: editorialPosts.title,
        bodyEn: editorialPosts.bodyEn,
        bodyEs: editorialPosts.bodyEs,
        metaDescription: editorialPosts.metaDescription,
        publishedAt: editorialPosts.publishedAt,
      })
      .from(editorialPosts)
      .where(
        and(
          eq(editorialPosts.leadId, leadId.data),
          eq(editorialPosts.status, "published"),
        ),
      )
      .orderBy(desc(editorialPosts.publishedAt))
      .limit(50);
    res.json({
      posts: rows.map((r) => ({
        ...r,
        publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
      })),
    });
  }),
);

/**
 * GET /api/editorial/posts/:postId — a single published post by id.
 */
router.get(
  "/editorial/posts/:postId",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.postId);
    const [row] = await db
      .select()
      .from(editorialPosts)
      .where(
        and(
          eq(editorialPosts.id, id),
          eq(editorialPosts.status, "published"),
        ),
      )
      .limit(1);
    if (!row) throw notFound("Post not found");
    res.json({
      post: {
        id: row.id,
        leadId: row.leadId,
        slug: row.slug,
        title: row.title,
        bodyEn: row.bodyEn,
        bodyEs: row.bodyEs,
        metaDescription: row.metaDescription,
        publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      },
    });
  }),
);

export default router;
