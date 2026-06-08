import {
  pgTable,
  serial,
  varchar,
  timestamp,
  integer,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { salesReps } from "./reps";
import { leads } from "./leads";

// Tier enum (post 2026-05 refactor). Legacy "A" and "B" values were wiped
// alongside their test-data sales rows in the same migration; the enum no
// longer carries them. See artifacts/api-server/docs/pricing-migration-decisions.md.
export const planEnum = pgEnum("plan_key", [
  "boutique",
  "boutique_pro",
  "boutique_concierge",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "past_due",
  "canceled",
  "trialing",
  "unpaid",
  "incomplete",
]);

export const stripeEvents = pgTable("stripe_events", {
  id: serial("id").primaryKey(),
  stripeEventId: varchar("stripe_event_id", { length: 128 }).notNull().unique(),
  eventType: varchar("event_type", { length: 96 }).notNull(),
  payload: jsonb("payload").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sales = pgTable(
  "sales",
  {
    id: serial("id").primaryKey(),
    repId: integer("rep_id").references(() => salesReps.id, {
      onDelete: "set null",
    }),
    leadId: integer("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    stripeSessionId: varchar("stripe_session_id", { length: 192 }),
    stripeCustomerId: varchar("stripe_customer_id", { length: 128 }),
    planKey: planEnum("plan_key").notNull(),
    setupAmountCents: integer("setup_amount_cents").notNull().default(0),
    monthlyAmountCents: integer("monthly_amount_cents").notNull().default(14900),
    promoCode: varchar("promo_code", { length: 12 }),
    closingBonusCents: integer("closing_bonus_cents").notNull().default(14900),
    acceptedTermsVersion: varchar("accepted_terms_version", { length: 32 }),
    acceptedTermsAt: timestamp("accepted_terms_at", { withTimezone: true }),
    acceptedTermsIp: varchar("accepted_terms_ip", { length: 64 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    repIdx: index("sales_rep_idx").on(t.repId),
    leadIdx: index("sales_lead_idx").on(t.leadId),
  }),
);

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id")
    .notNull()
    .references(() => sales.id, { onDelete: "cascade" }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 192 }),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  addonKeys: jsonb("addon_keys").$type<string[]>().notNull().default([]),
  calendlyUrl: varchar("calendly_url", { length: 256 }),
  doxyUrl: varchar("doxy_url", { length: 256 }),
  monthlyTotalCents: integer("monthly_total_cents").notNull().default(14900),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Sale = typeof sales.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type StripeEvent = typeof stripeEvents.$inferSelect;
