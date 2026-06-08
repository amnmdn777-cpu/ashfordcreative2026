import {
  pgTable,
  serial,
  varchar,
  boolean,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["rep", "admin"]);

export const salesReps = pgTable("sales_reps", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 128 }).notNull(),
  displayName: varchar("display_name", { length: 128 }).notNull(),
  role: userRoleEnum("role").notNull().default("rep"),
  promoCode: varchar("promo_code", { length: 12 }).notNull().unique(),
  hourlyRateCents: integer("hourly_rate_cents").notNull().default(2500),
  isActive: boolean("is_active").notNull().default(true),
  // 2026-05-21 — `hasCompletedOnboarding` dropped (rep training gate killed).
  // Optional public-facing contact info surfaced in the prospect portal's
  // "Talk to a human" panel. All nullable so legacy reps remain valid;
  // the portal hides the corresponding tap-to-call / tap-to-email when missing.
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 160 }),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  // Last time this rep was selected as the answerer for an inbound call.
  // The inbound TwiML's round-robin chooser orders active reps by this
  // column ascending (NULLs first) so the rep who has waited longest
  // gets the next ring. Updated atomically each time a rep is dialed.
  lastInboundCallAt: timestamp("last_inbound_call_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SalesRep = typeof salesReps.$inferSelect;
export type InsertSalesRep = typeof salesReps.$inferInsert;

// 2026-05-21 — `onboardingAcknowledgments` table dropped (rep training gate killed).
