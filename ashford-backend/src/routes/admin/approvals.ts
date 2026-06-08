import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import {
  decideApprovalRequest,
  listApprovalsByStatus,
  refundApprovalInvoice,
} from "../../services/approvals";
import { writeAudit } from "../../services/auditLog";
import {
  requireAuth,
  requireAdmin,
} from "../../middleware/requireAuth";
import { asyncHandler } from "../../middleware/asyncHandler";

const router: IRouter = Router();

router.use("/admin/approvals", requireAuth, requireAdmin);

const statusSchema = z.enum(["pending", "approved", "denied"]);
const decideSchema = z.object({
  decision: z.enum(["approved", "denied"]),
  decisionNote: z.string().max(2000).optional(),
});

router.get(
  "/admin/approvals",
  asyncHandler(async (req, res) => {
    const statusParam = (req.query.status as string | undefined) ?? "pending";
    const statuses = statusParam.split(",").map((s) => s.trim());
    const valid = statuses.filter(
      (s): s is "pending" | "approved" | "denied" =>
        statusSchema.safeParse(s).success,
    );
    const rows = await listApprovalsByStatus(
      valid.length ? valid : ["pending"],
    );
    res.json(rows);
  }),
);

const refundSchema = z.object({
  amountCents: z.number().int().positive(),
  invoiceId: z.string().trim().min(3).max(192).optional(),
  decisionNote: z.string().max(2000).optional(),
});

router.post(
  "/admin/approvals/:id/refund",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "bad id" });
      return;
    }
    const parsed = refundSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid", details: parsed.error.message });
      return;
    }
    const result = await refundApprovalInvoice({
      id,
      decidedByRepId: req.user!.id,
      amountCents: parsed.data.amountCents,
      invoiceId: parsed.data.invoiceId,
      decisionNote: parsed.data.decisionNote,
    });
    if (!result.ok) {
      res.status(422).json({
        error: {
          code: result.error.code,
          message: result.error.message,
          type: result.error.type,
        },
      });
      return;
    }
    res.json({
      approval: result.approval,
      refund: {
        refundId: result.refund.refundId,
        invoiceId: result.refund.invoiceId,
        chargeId: result.refund.chargeId,
        amountCents: result.refund.amountCents,
        status: result.refund.status,
        createdAt: result.refund.createdAt.toISOString(),
      },
    });
  }),
);

router.post(
  "/admin/approvals/:id/decide",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "bad id" });
      return;
    }
    const parsed = decideSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid", details: parsed.error.message });
      return;
    }
    const updated = await decideApprovalRequest({
      id,
      decidedByRepId: req.user!.id,
      decision: parsed.data.decision,
      decisionNote: parsed.data.decisionNote,
    });
    if (!updated) {
      res.status(409).json({ error: "already_decided_or_not_found" });
      return;
    }
    await writeAudit(req, {
      action: `approval.${parsed.data.decision}`,
      targetType: "approval_request",
      targetId: updated.id,
      // The "before" view we have is implicit (status was "pending"
      // since decideApprovalRequest only updates pending rows). Record
      // it explicitly so downstream readers don't have to infer.
      before: { status: "pending" },
      after: {
        status: updated.status,
        decisionNote: parsed.data.decisionNote ?? null,
        kind: updated.kind,
        leadId: updated.leadId,
      },
    });
    res.json(updated);
  }),
);

export default router;
