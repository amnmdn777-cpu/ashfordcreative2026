import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, blogPosts, blogComments, blogLikes } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { CreateCommentRequest } from "@workspace/api-zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import { notFound } from "../../lib/errors";
import { sha256Hex } from "../../lib/tokens";
import { rateLimit } from "../../middleware/rateLimit";

const router: IRouter = Router();

router.get(
  ["/blog/posts", "/public/blog"],
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        id: blogPosts.id,
        slug: blogPosts.slug,
        title: blogPosts.title,
        excerpt: blogPosts.excerpt,
        heroImage: blogPosts.heroImage,
        authorName: blogPosts.authorName,
        publishedAt: blogPosts.publishedAt,
      })
      .from(blogPosts)
      .orderBy(desc(blogPosts.publishedAt))
      .limit(50);
    // Aggregate like counts in one query for the listed posts.
    const likeRows =
      rows.length > 0
        ? await db
            .select({
              postId: blogLikes.postId,
              count: sql<number>`count(*)::int`,
            })
            .from(blogLikes)
            .groupBy(blogLikes.postId)
        : [];
    const likeMap = new Map<number, number>();
    for (const r of likeRows) likeMap.set(r.postId, r.count);
    res.json({
      posts: rows.map((r) => ({
        ...r,
        publishedAt: r.publishedAt.toISOString(),
        likeCount: likeMap.get(r.id) ?? 0,
      })),
    });
  }),
);

router.get(
  ["/blog/posts/:slug", "/public/blog/:slug"],
  asyncHandler(async (req, res) => {
    const slug = z.string().min(1).parse(req.params.slug);
    const [post] = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.slug, slug))
      .limit(1);
    if (!post) throw notFound("Post not found");
    const [{ likes }] = await db
      .select({ likes: sql<number>`count(*)::int` })
      .from(blogLikes)
      .where(eq(blogLikes.postId, post.id));
    const comments = await db
      .select()
      .from(blogComments)
      .where(eq(blogComments.postId, post.id))
      .orderBy(blogComments.createdAt);
    res.json({
      post: {
        id: post.id,
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        bodyMd: post.bodyMd,
        heroImage: post.heroImage,
        authorName: post.authorName,
        publishedAt: post.publishedAt.toISOString(),
      },
      likes,
      comments: comments.map((c) => ({
        id: c.id,
        postId: c.postId,
        authorName: c.authorName,
        authorPractice: c.authorPractice,
        body: c.body,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  }),
);

router.post(
  ["/blog/posts/:slug/comments", "/public/blog/:slug/comments"],
  rateLimit({ name: "blog_comment", capacity: 5, refillPerSecond: 0.05 }),
  asyncHandler(async (req, res) => {
    const slug = z.string().min(1).parse(req.params.slug);
    const body = CreateCommentRequest.parse(req.body);
    const [post] = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.slug, slug))
      .limit(1);
    if (!post) throw notFound("Post not found");
    const [row] = await db
      .insert(blogComments)
      .values({
        postId: post.id,
        authorName: body.authorName,
        authorPractice: body.authorPractice,
        body: body.body,
      })
      .returning();
    res.json({
      comment: {
        ...row,
        createdAt: row.createdAt.toISOString(),
      },
    });
  }),
);

router.post(
  ["/blog/posts/:slug/like", "/public/blog/:slug/like"],
  rateLimit({ name: "blog_like", capacity: 30, refillPerSecond: 1 }),
  asyncHandler(async (req, res) => {
    const slug = z.string().min(1).parse(req.params.slug);
    const [post] = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.slug, slug))
      .limit(1);
    if (!post) throw notFound("Post not found");
    const fingerprint = sha256Hex(
      (req.ip ?? "0.0.0.0") + (req.get("user-agent") ?? ""),
    ).slice(0, 32);
    await db
      .insert(blogLikes)
      .values({ postId: post.id, fingerprint })
      .onConflictDoNothing();
    const [{ likes }] = await db
      .select({ likes: sql<number>`count(*)::int` })
      .from(blogLikes)
      .where(eq(blogLikes.postId, post.id));
    res.json({ likes });
  }),
);

export default router;
