import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { salesReps } from "./reps";
import { leads } from "./leads";

export const callbackSchedules = pgTable(
  "callback_schedules",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    repId: integer("rep_id")
      .notNull()
      .references(() => salesReps.id, { onDelete: "cascade" }),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    note: text("note"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    repIdx: index("callbacks_rep_idx").on(t.repId, t.scheduledFor),
    leadIdx: index("callbacks_lead_idx").on(t.leadId),
  }),
);

export type CallbackSchedule = typeof callbackSchedules.$inferSelect;
