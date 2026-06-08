import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import {
  createApprovalRequest,
  isApprovalKind,
  listApprovalsForLead,
} from "../../services/approvals";
import { requireAuth, requireOnboardingComplete } from "../../middleware/requireAuth";
import { asyncHandler } from "../../middleware/asyncHandler";
import { db, approvalRequests, leads, sales } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router: IRouter = Router();

router.use("/dashboard", requireAuth, requireOnboardingComplete);

const createSchema = z.object({
  kind: z.string().refine(isApprovalKind, "invalid kind"),
  reason: z.string().min(3).max(2000),
  leadId: z.number().int().positive().optional(),
  saleId: z.number().int().positive().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

router.post(
  "/dashboard/approvals",
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid", details: parsed.error.message });
      return;
    }
    // Ownership: rep may only attach approval to a lead they currently own,
    // or a sale they personally closed.
    if (parsed.data.leadId) {
      const [l] = await db
        .select({ ownerId: leads.claimedByRepId })
        .from(leads)
        .where(eq(leads.id, parsed.data.leadId))
        .limit(1);
      if (!l || l.ownerId !== req.user!.id) {
        res.status(403).json({ error: "forbidden_lead" });
        return;
      }
    }
    if (parsed.data.saleId) {
      const [s] = await db
        .select({ ownerId: sales.repId })
        .from(sales)
        .where(eq(sales.id, parsed.data.saleId))
        .limit(1);
      if (!s || s.ownerId !== req.user!.id) {
        res.status(403).json({ error: "forbidden_sale" });
        return;
      }
    }
    const row = await createApprovalRequest({
      repId: req.user!.id,
      kind: parsed.data.kind as Parameters<
        typeof createApprovalRequest
      >[0]["kind"],
      reason: parsed.data.reason,
      leadId: parsed.data.leadId,
      saleId: parsed.data.saleId,
      payload: parsed.data.payload,
    });
    res.status(201).json(row);
  }),
);

router.get(
  "/dashboard/approvals",
  asyncHandler(async (req, res) => {
    const leadIdParam = req.query.leadId;
    if (leadIdParam) {
      const leadId = Number(leadIdParam);
      if (!Number.isFinite(leadId)) {
        res.status(400).json({ error: "bad leadId" });
        return;
      }
      // Scope: only approvals on this lead AND created by the requesting rep.
      // Prevents enumerating other reps' approvals/decision notes via leadId.
      const rows = await db
        .select()
        .from(approvalRequests)
        .where(
          and(
            eq(approvalRequests.leadId, leadId),
            eq(approvalRequests.repId, req.user!.id),
          ),
        )
        .orderBy(desc(approvalRequests.createdAt))
        .limit(100);
      res.json(rows);
      return;
    }
    const rows = await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.repId, req.user!.id))
      .orderBy(desc(approvalRequests.createdAt))
      .limit(100);
    res.json(rows);
  }),
);

export default router;
