import { z } from "zod";

export const BlogPostSummary = z.object({
  id: z.number().int(),
  slug: z.string(),
  title: z.string(),
  excerpt: z.string(),
  heroImage: z.string().nullable(),
  authorName: z.string(),
  publishedAt: z.string(),
});
export type BlogPostSummary = z.infer<typeof BlogPostSummary>;

export const BlogPostFull = BlogPostSummary.extend({
  bodyMd: z.string(),
});
export type BlogPostFull = z.infer<typeof BlogPostFull>;

export const BlogCommentDto = z.object({
  id: z.number().int(),
  postId: z.number().int(),
  authorName: z.string(),
  authorPractice: z.string().nullable(),
  body: z.string(),
  createdAt: z.string(),
});
export type BlogCommentDto = z.infer<typeof BlogCommentDto>;

export const CreateCommentRequest = z.object({
  authorName: z.string().min(1).max(96),
  authorPractice: z.string().max(192).optional(),
  body: z.string().min(2).max(2000),
});
export type CreateCommentRequest = z.infer<typeof CreateCommentRequest>;
