import {
  pgTable,
  serial,
  varchar,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { salesReps } from "./reps";

export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: serial("id").primaryKey(),
    actorRepId: integer("actor_rep_id").references(() => salesReps.id, {
      onDelete: "set null",
    }),
    // Snapshot of the actor's role at write time. Kept denormalized so
    // audit history survives role changes (a rep promoted to admin
    // doesn't retroactively rewrite their old "rep" entries).
    actorRole: varchar("actor_role", { length: 16 }),
    action: varchar("action", { length: 96 }).notNull(),
    targetType: varchar("target_type", { length: 64 }),
    targetId: varchar("target_id", { length: 64 }),
    // Pre-mutation snapshot of the affected row(s). Null for create-only
    // actions and auth events. The helper truncates large payloads.
    before: jsonb("before"),
    // Post-mutation snapshot. New rows ALSO mirror this into `diff` for
    // back-compat with the existing Audit.tsx renderer; once that page
    // is rewritten to split before/after we can stop populating `diff`.
    after: jsonb("after"),
    // Legacy column kept populated for back-compat — mirrors `after`
    // for new rows. Old rows (pre-1.2 migration) still carry their
    // historical payload here.
    diff: jsonb("diff"),
    ip: varchar("ip", { length: 64 }),
    userAgent: varchar("user_agent", { length: 512 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    actorIdx: index("audit_log_actor_idx").on(t.actorRepId),
    actionIdx: index("audit_log_action_idx").on(t.action),
    targetIdx: index("audit_log_target_idx").on(t.targetType, t.targetId),
  }),
);

export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
