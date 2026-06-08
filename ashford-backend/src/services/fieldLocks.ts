import { db, leadFieldLocks } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

/**
 * Feature B (founder 2026-05-19) — field-lock helpers.
 *
 * Validated leads keep listed fields immutable. Any pipeline writer
 * (enrichment orchestrator, preview regen, template / locale switch,
 * portal customization writeback) must consult `getLockedFields(leadId)`
 * before overwriting persisted lead data and skip every field name on
 * the returned list.
 */

/** Returns the full list of locked field names for a lead. */
export async function getLockedFields(leadId: number): Promise<string[]> {
  const rows = await db
    .select({ name: leadFieldLocks.fieldName })
    .from(leadFieldLocks)
    .where(eq(leadFieldLocks.leadId, leadId));
  return rows.map((r) => r.name);
}

/** Returns a Set for fast membership checks. */
export async function getLockedFieldSet(leadId: number): Promise<Set<string>> {
  const names = await getLockedFields(leadId);
  return new Set(names);
}

/**
 * Drops any keys that are locked from a candidate update payload.
 * Callers pass the SAME shape they would have written and receive
 * a filtered copy. Useful in update mutations and the preview
 * regen path.
 */
export async function applyLocks<T extends Record<string, unknown>>(
  leadId: number,
  candidate: T,
): Promise<{ writable: Partial<T>; skipped: string[] }> {
  const locked = await getLockedFieldSet(leadId);
  const writable: Partial<T> = {};
  const skipped: string[] = [];
  for (const k of Object.keys(candidate)) {
    if (locked.has(k)) {
      skipped.push(k);
    } else {
      (writable as Record<string, unknown>)[k] = candidate[k];
    }
  }
  return { writable, skipped };
}

/**
 * Convenience: same as applyLocks but synchronous given a pre-fetched
 * lock set. Use when the writer already loaded the set for batching
 * reasons.
 */
export function applyLocksSync<T extends Record<string, unknown>>(
  locked: Set<string>,
  candidate: T,
): { writable: Partial<T>; skipped: string[] } {
  const writable: Partial<T> = {};
  const skipped: string[] = [];
  for (const k of Object.keys(candidate)) {
    if (locked.has(k)) {
      skipped.push(k);
    } else {
      (writable as Record<string, unknown>)[k] = candidate[k];
    }
  }
  return { writable, skipped };
}
