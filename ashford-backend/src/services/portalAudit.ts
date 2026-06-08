// 2026-05-21 — Stub. The full portalAudit implementation was lost during
// the Sprint 2 cleanup. Routes in admin/prepQueue.ts still reference it,
// so we expose the same surface but each call returns a 501-style payload
// at runtime. Restore from the May 19 batch work when the audit engine
// is rebuilt.

export const AUDITABLE_FIELD_KEYS = [] as const;

type AuditResult = {
  auditId: number | null;
  overallScore: number | null;
  gapsCount: number;
  fields: unknown[];
  status: "stub";
};

const STUB: AuditResult = {
  auditId: null,
  overallScore: null,
  gapsCount: 0,
  fields: [],
  status: "stub",
};

export async function runPortalAudit(
  _leadId: number,
  _adminId?: number,
): Promise<AuditResult> {
  return { ...STUB };
}

export async function applyPortalAudit(
  _auditId: number,
  _adminId: number,
  _fieldKeys?: string[],
): Promise<{ ok: boolean; appliedKeys: string[]; status: "stub" }> {
  return { ok: false, appliedKeys: [], status: "stub" };
}

export async function getLatestAudit(
  _leadId: number,
): Promise<null> {
  return null;
}

export async function getAuditHistory(
  _leadId: number,
): Promise<unknown[]> {
  return [];
}
