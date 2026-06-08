-- LOT 1.2 — expand admin_audit_log so middleware can record full
-- mutation context: actor role, before/after snapshots, request ip,
-- user-agent. Historical rows (pre-migration) keep NULLs for the new
-- columns; their original payload in `diff` is untouched. New rows
-- written by the audit helper populate all columns and also mirror
-- the `after` payload into `diff` for back-compat with the existing
-- Audit.tsx renderer.

ALTER TABLE "admin_audit_log"
  ADD COLUMN IF NOT EXISTS "actor_role" varchar(16),
  ADD COLUMN IF NOT EXISTS "before" jsonb,
  ADD COLUMN IF NOT EXISTS "after" jsonb,
  ADD COLUMN IF NOT EXISTS "ip" varchar(64),
  ADD COLUMN IF NOT EXISTS "user_agent" varchar(512);

-- Speeds up `/admin/audit` reads when filtered by action/target. The
-- existing actor_idx already covers the actor filter.
CREATE INDEX IF NOT EXISTS "audit_log_action_idx"
  ON "admin_audit_log" ("action");
CREATE INDEX IF NOT EXISTS "audit_log_target_idx"
  ON "admin_audit_log" ("target_type", "target_id");
