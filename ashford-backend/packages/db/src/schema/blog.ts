import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  title: varchar("title", { length: 256 }).notNull(),
  excerpt: text("excerpt").notNull(),
  bodyMd: text("body_md").notNull(),
  heroImage: varchar("hero_image", { length: 256 }),
  authorName: varchar("author_name", { length: 96 }).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = typeof blogPosts.$inferInsert;

export const blogComments = pgTable(
  "blog_comments",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => blogPosts.id, { onDelete: "cascade" }),
    authorName: varchar("author_name", { length: 96 }).notNull(),
    authorPractice: varchar("author_practice", { length: 192 }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    postIdx: index("blog_comments_post_idx").on(t.postId),
  }),
);

export const blogLikes = pgTable(
  "blog_likes",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => blogPosts.id, { onDelete: "cascade" }),
    fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("blog_likes_post_fp_uniq").on(t.postId, t.fingerprint),
  }),
);

export type BlogComment = typeof blogComments.$inferSelect;
export type BlogLike = typeof blogLikes.$inferSelect;
