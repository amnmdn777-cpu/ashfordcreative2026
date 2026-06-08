/**
 * [CLEANUP D.1] Editorial pipeline schema.
 *
 * Two tables back the human-written Insights Journal:
 *   - `article_schedule` — 14 scheduled article slots per Concierge lead,
 *     auto-seeded on Stripe webhook activation. Each row is a reminder for
 *     the editor to write a piece by `due_date`.
 *   - `blog_posts` (extended in this file) — the actual draft/published
 *     article. Linked back to the schedule row that prompted it.
 *
 * No automation, no AI. The editor opens the schedule row, types title +
 * body in EN and ES, then publishes. The schedule row's status moves from
 * `pending` → `written` → (when the post is published) the linked blog
 * post flips `status='published'`.
 *
 * Practitioners table does not exist in this repo; everything anchors on
 * `leads.id` (the same pattern used by 0020 for calendly/doxy URLs).
 */
import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  date,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { leads } from "./leads";

export const articleScheduleStatusEnum = pgEnum("article_schedule_status", [
  "pending",
  "written",
  "skipped",
]);

export const editorialPostStatusEnum = pgEnum("editorial_post_status", [
  "draft",
  "published",
]);

export const articleSchedule = pgTable(
  "article_schedule",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    dueDate: date("due_date").notNull(),
    topicHint: varchar("topic_hint", { length: 256 }),
    status: articleScheduleStatusEnum("status").notNull().default("pending"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    leadIdx: index("article_schedule_lead_idx").on(t.leadId),
    dueIdx: index("article_schedule_due_idx").on(t.dueDate),
  }),
);

export type ArticleScheduleRow = typeof articleSchedule.$inferSelect;
export type InsertArticleSchedule = typeof articleSchedule.$inferInsert;

/**
 * `editorial_posts` — the actual article the editor writes. Separate from
 * the legacy `blog_posts` table (which holds the marketing-site Ashford
 * blog) so the two pipelines never collide. The editor renders these on
 * the practitioner's public site filtered by `lead_id`.
 */
export const editorialPosts = pgTable(
  "editorial_posts",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    scheduleId: integer("schedule_id").references(() => articleSchedule.id, {
      onDelete: "set null",
    }),
    status: editorialPostStatusEnum("status").notNull().default("draft"),
    title: varchar("title", { length: 256 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    bodyEn: text("body_en").notNull().default(""),
    bodyEs: text("body_es").notNull().default(""),
    metaDescription: varchar("meta_description", { length: 320 }),
    topicBrief: text("topic_brief"),
    dueDate: date("due_date"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    leadIdx: index("editorial_posts_lead_idx").on(t.leadId),
    statusIdx: index("editorial_posts_status_idx").on(t.status),
    slugIdx: index("editorial_posts_slug_idx").on(t.slug),
  }),
);

export type EditorialPostRow = typeof editorialPosts.$inferSelect;
export type InsertEditorialPost = typeof editorialPosts.$inferInsert;
