import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import {
  db,
  leads as leadsTbl,
  leadQcEvents,
  leadFieldLocks,
} from "@workspace/db";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth, requireAdmin } from "../../middleware/requireAuth";
import { notFound } from "../../lib/errors";

/**
 * Feature B (founder 2026-05-19) — Preview Quality Check API.
 *
 * Routes:
 *   POST  /api/admin/leads/:id/qc-validate           (admin or rep manual)
 *   POST  /api/admin/leads/:id/qc-accept-initials    (admin only)
 *   POST  /api/admin/leads/:id/qc-reset              (admin only)
 *   POST  /api/internal/leads/:id/qc-validate        (script token auth)
 *
 * All four enforce the photo gate (HTTP 422 with qc_blocked_no_photo)
 * unless `qcAcceptedWithoutPhoto` was already flipped by an admin.
 */

const router: IRouter = Router();

const LeadIdParam = z.coerce.number().int().positive();
const ValidateBody = z.object({
  cyclesCount: z.number().int().min(0).optional(),
  notes: z.string().max(2000).optional(),
  lockedFields: z.array(z.string().max(96)).default([]),
});

async function loadLead(leadId: number) {
  const rows = await db.select().from(leadsTbl).where(eq(leadsTbl.id, leadId));
  return rows[0] ?? null;
}

/** Photo gate: returns null when the lead is OK to validate, or a
 *  structured error payload when it's blocked. */
function photoGate(lead: { qcAcceptedWithoutPhoto?: boolean | null }): { error: string; message: string } | null {
  // Practitioner photo info lives on the enrichment side which the API
  // server reads via separate services. As a defensive fallback we
  // gate on the explicit `qcAcceptedWithoutPhoto` flag — when it's
  // false the upstream rep workflow must surface a real photo before
  // validating. The admin "accept initials" endpoint flips the flag.
  if (lead.qcAcceptedWithoutPhoto === true) return null;
  // TODO (follow-up): hook into the enrichment.photos resolver to
  // decide automatically; for now we conservatively require an admin
  // override (or a real photo upload that flips the flag).
  return {
    error: "qc_blocked_no_photo",
    message:
      "Cannot validate QC without a real practitioner photo. Use admin override to upload manually or mark as accepted-with-initials.",
  };
}

async function logEvent(
  leadId: number,
  eventType:
    | "validated"
    | "invalidated"
    | "reset"
    | "field_locked"
    | "field_unlocked"
    | "blocked_no_photo",
  actor: string,
  payload: unknown,
) {
  await db.insert(leadQcEvents).values({ leadId, eventType, actor, payload: payload as never });
}

async function applyLocks(leadId: number, fields: string[], lockedBy: string) {
  for (const fieldName of fields) {
    try {
      await db.insert(leadFieldLocks).values({ leadId, fieldName, lockedBy });
      await logEvent(leadId, "field_locked", lockedBy, { fieldName });
    } catch {
      // Unique-constraint violation = already locked. Idempotent.
    }
  }
}

async function clearLocks(leadId: number, actor: string) {
  await db.delete(leadFieldLocks).where(eq(leadFieldLocks.leadId, leadId));
  await logEvent(leadId, "field_unlocked", actor, { scope: "all" });
}

// Mount admin endpoints under requireAdmin.
router.use("/admin/leads", requireAuth, requireAdmin);

/** Admin / manual validate. */
router.post(
  "/admin/leads/:id/qc-validate",
  asyncHandler(async (req: Request, res: Response) => {
    const leadId = LeadIdParam.parse(req.params.id);
    const body = ValidateBody.parse(req.body);
    const lead = await loadLead(leadId);
    if (!lead) throw notFound("Lead not found");
    const block = photoGate(lead);
    if (block) {
      await logEvent(leadId, "blocked_no_photo", req.user!.username, { source: "manual" });
      res.status(422).json(block);
      return;
    }
    const validatedAt = new Date();
    await db
      .update(leadsTbl)
      .set({
        qcStatus: "validated",
        qcValidatedAt: validatedAt,
        qcValidatedBy: req.user!.displayName ?? req.user!.username,
        qcCyclesCount: body.cyclesCount ?? lead.qcCyclesCount ?? 0,
        qcNotes: body.notes ?? lead.qcNotes ?? null,
        qcSource: "manual",
      })
      .where(eq(leadsTbl.id, leadId));
    await applyLocks(leadId, body.lockedFields, req.user!.username);
    await logEvent(leadId, "validated", req.user!.username, {
      source: "manual",
      cyclesCount: body.cyclesCount ?? null,
    });
    res.json({ ok: true, qc_status: "validated", validated_at: validatedAt });
  }),
);

/** Admin override — accept without a real photo. */
router.post(
  "/admin/leads/:id/qc-accept-initials",
  asyncHandler(async (req: Request, res: Response) => {
    const leadId = LeadIdParam.parse(req.params.id);
    const lead = await loadLead(leadId);
    if (!lead) throw notFound("Lead not found");
    await db
      .update(leadsTbl)
      .set({ qcAcceptedWithoutPhoto: true })
      .where(eq(leadsTbl.id, leadId));
    await logEvent(leadId, "validated", req.user!.username, { override: "accept_initials" });
    res.json({ ok: true });
  }),
);

/** Admin "Start over" — clears QC + every lock. */
router.post(
  "/admin/leads/:id/qc-reset",
  asyncHandler(async (req: Request, res: Response) => {
    const leadId = LeadIdParam.parse(req.params.id);
    const lead = await loadLead(leadId);
    if (!lead) throw notFound("Lead not found");
    await db
      .update(leadsTbl)
      .set({
        qcStatus: "none",
        qcValidatedAt: null,
        qcValidatedBy: null,
        qcAcceptedWithoutPhoto: false,
        qcSource: null,
      })
      .where(eq(leadsTbl.id, leadId));
    await clearLocks(leadId, req.user!.username);
    await logEvent(leadId, "reset", req.user!.username, {});
    res.json({ ok: true });
  }),
);

/** Script / internal token auth. Distinct mount path so we can apply
 *  a token-only middleware without disturbing the admin session
 *  guards above. */
const internalRouter: IRouter = Router();
internalRouter.use((req: Request, res: Response, next: NextFunction) => {
  const expected = process.env.INTERNAL_API_TOKEN || "";
  const got = req.header("x-ashford-internal-token") || "";
  if (!expected || got !== expected) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
});
internalRouter.post(
  "/internal/leads/:id/qc-validate",
  asyncHandler(async (req: Request, res: Response) => {
    const leadId = LeadIdParam.parse(req.params.id);
    const body = ValidateBody.parse(req.body);
    const lead = await loadLead(leadId);
    if (!lead) throw notFound("Lead not found");
    const block = photoGate(lead);
    if (block) {
      await logEvent(leadId, "blocked_no_photo", "script", { source: "script" });
      res.status(422).json(block);
      return;
    }
    const validatedAt = new Date();
    await db
      .update(leadsTbl)
      .set({
        qcStatus: "validated",
        qcValidatedAt: validatedAt,
        qcValidatedBy: "automated_script",
        qcCyclesCount: body.cyclesCount ?? lead.qcCyclesCount ?? 0,
        qcNotes: body.notes ?? lead.qcNotes ?? null,
        qcSource: "script",
      })
      .where(eq(leadsTbl.id, leadId));
    await applyLocks(leadId, body.lockedFields, "script");
    await logEvent(leadId, "validated", "script", {
      source: "script",
      cyclesCount: body.cyclesCount ?? null,
    });
    res.json({ ok: true, qc_status: "validated", validated_at: validatedAt });
  }),
);

router.use(internalRouter);

export default router;
