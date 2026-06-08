import type { Request } from "express";
import { db, adminAuditLog } from "@workspace/db";
import { logger } from "../lib/logger";

/**
 * LOT 1.2 — single entry point for admin_audit_log writes. Every
 * admin-side mutation (rep enable/disable/role-change, lead release-all,
 * subscription edits, approval decisions, auth events, lead detail
 * reads from LOT 1.1) routes through here so the table is populated
 * consistently and so future schema migrations only need to touch one
 * insert path.
 *
 * Two variants:
 *   - `writeAudit(req, ...)`  — caller has an authenticated Request,
 *     actor/ip/user-agent are extracted automatically.
 *   - `writeAuditExplicit(...)` — caller doesn't (auth events, where
 *     `req.user` is unset, or failed logins where there is no actor).
 *
 * All writes are best-effort: a failure logs at WARN and is swallowed
 * so the surrounding business action still returns 2xx. An audit
 * failure must never break a customer-facing mutation. (Trade-off: an
 * outage of the audit path will go undetected from the response side;
 * we rely on the WARN line + Sentry to surface it.)
 */

export interface AuditPayload {
  action: string;
  targetType: string | null;
  targetId: string | null | number;
  before?: unknown;
  after?: unknown;
}

const MAX_JSON_BYTES = 16 * 1024;

const truncate = (v: unknown): unknown => {
  if (v === undefined || v === null) return v ?? null;
  try {
    const s = JSON.stringify(v);
    if (s.length <= MAX_JSON_BYTES) return v;
    return { _truncated: true, bytes: s.length, preview: s.slice(0, 1024) };
  } catch (err) {
    return { _unserializable: true, err: String(err) };
  }
};

const extractIp = (req: Request): string | null =>
  (req.ip ?? null) || null;

const extractUserAgent = (req: Request): string | null => {
  const ua = req.get("user-agent");
  if (!ua) return null;
  return ua.length > 512 ? ua.slice(0, 512) : ua;
};

export async function writeAudit(
  req: Request,
  payload: AuditPayload,
): Promise<void> {
  const actorId = req.user?.id ?? null;
  const actorRole = req.user?.role ?? null;
  await insertRow({
    actorId,
    actorRole,
    action: payload.action,
    targetType: payload.targetType,
    targetId:
      payload.targetId === null ? null : String(payload.targetId),
    before: truncate(payload.before),
    after: truncate(payload.after),
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
  });
}

export interface ExplicitAuditPayload extends AuditPayload {
  actor: { id: number; role: string } | null;
  ip: string | null;
  userAgent: string | null;
}

export async function writeAuditExplicit(
  payload: ExplicitAuditPayload,
): Promise<void> {
  await insertRow({
    actorId: payload.actor?.id ?? null,
    actorRole: payload.actor?.role ?? null,
    action: payload.action,
    targetType: payload.targetType,
    targetId:
      payload.targetId === null ? null : String(payload.targetId),
    before: truncate(payload.before),
    after: truncate(payload.after),
    ip: payload.ip,
    userAgent: payload.userAgent,
  });
}

interface RowInput {
  actorId: number | null;
  actorRole: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent: string | null;
}

async function insertRow(row: RowInput): Promise<void> {
  try {
    await db.insert(adminAuditLog).values({
      actorRepId: row.actorId,
      actorRole: row.actorRole,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      before: row.before ?? null,
      after: row.after ?? null,
      // Mirror `after` into `diff` so the existing Audit.tsx page (which
      // only knows about `diff`) keeps rendering useful content until
      // it gets rewritten to split before/after.
      diff: row.after ?? null,
      ip: row.ip,
      userAgent: row.userAgent,
    });
  } catch (err) {
    logger.warn(
      { err, action: row.action, targetType: row.targetType },
      "audit log write failed — business action proceeded uninstrumented",
    );
  }
}

/**
 * Helper for the common "load the row, mutate, audit" pattern. Returns
 * `{ before, after }` already shaped for the audit payload so the
 * caller can pass it through without repeating the field-plucking
 * boilerplate at every site.
 */
export const snapshotKeys = <T extends object, K extends keyof T>(
  row: T | null | undefined,
  keys: readonly K[],
): Pick<T, K> | null => {
  if (!row) return null;
  const out = {} as Pick<T, K>;
  for (const k of keys) out[k] = row[k];
  return out;
};
