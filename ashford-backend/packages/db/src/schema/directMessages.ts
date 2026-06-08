import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { salesReps } from "./reps";

export const directMessageDirectionEnum = pgEnum("direct_message_direction", [
  "rep_to_admin",
  "admin_to_rep",
]);

export const directMessages = pgTable(
  "direct_messages",
  {
    id: serial("id").primaryKey(),
    repId: integer("rep_id")
      .notNull()
      .references(() => salesReps.id, { onDelete: "cascade" }),
    senderRepId: integer("sender_rep_id").references(() => salesReps.id, {
      onDelete: "set null",
    }),
    direction: directMessageDirectionEnum("direction").notNull(),
    body: text("body").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => ({
    repIdx: index("direct_messages_rep_idx").on(t.repId, t.sentAt),
  }),
);

export type DirectMessage = typeof directMessages.$inferSelect;
export type InsertDirectMessage = typeof directMessages.$inferInsert;
