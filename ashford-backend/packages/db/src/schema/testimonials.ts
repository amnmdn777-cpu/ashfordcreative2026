import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";

// Composite testimonials shown on the public marketing site. Each row is a
// blended quote stitched together from real client feedback (names and
// minor identifying details are anonymized/composited per spec).
export const testimonials = pgTable("testimonials", {
  id: serial("id").primaryKey(),
  authorName: varchar("author_name", { length: 96 }).notNull(),
  authorTitle: varchar("author_title", { length: 96 }).notNull(),
  authorPractice: varchar("author_practice", { length: 192 }).notNull(),
  city: varchar("city", { length: 96 }).notNull(),
  state: varchar("state", { length: 32 }).notNull().default("TX"),
  quote: text("quote").notNull(),
  avatarUrl: varchar("avatar_url", { length: 256 }),
  displayOrder: integer("display_order").notNull().default(0),
  isComposite: integer("is_composite").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Testimonial = typeof testimonials.$inferSelect;
export type InsertTestimonial = typeof testimonials.$inferInsert;
