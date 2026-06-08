import {
  db,
  approvalRequests,
  salesReps,
  leads,
} from "@workspace/db";
import { writeAuditExplicit } from "./auditLog";
import { eq, and, desc, inArray } from "drizzle-orm";
import { notify, notifyOwner } from "./notifications";
import {
  refundInvoice,
  StripeRefundFailure,
  type RefundResult,
  type StripeRefundError,
} from "../integrations/stripe";
import { badRequest, conflict, notFound } from "../lib/errors";

export type ApprovalKind =
  | "setup_fee_discount"
  | "free_first_month"
  | "refund_invoice"
  | "custom_addon_price";

const ALLOWED_KINDS: readonly ApprovalKind[] = [
  "setup_fee_discount",
  "free_first_month",
  "refund_invoice",
  "custom_addon_price",
];

export const isApprovalKind = (s: string): s is ApprovalKind =>
  (ALLOWED_KINDS as readonly string[]).includes(s);

export const createApprovalRequest = async (params: {
  repId: number;
  kind: ApprovalKind;
  reason: string;
  leadId?: number;
  saleId?: number;
  payload?: Record<string, unknown>;
}) => {
  const [row] = await db
    .insert(approvalRequests)
    .values({
      repId: params.repId,
      kind: params.kind,
      reason: params.reason,
      leadId: params.leadId,
      saleId: params.saleId,
      payload: params.payload,
    })
    .returning();

  // In-app notify all admins
  const admins = await db
    .select({ id: salesReps.id })
    .from(salesReps)
    .where(eq(salesReps.role, "admin"));
  const repRow = await db
    .select({ name: salesReps.displayName })
    .from(salesReps)
    .where(eq(salesReps.id, params.repId))
    .limit(1);
  const repName = repRow[0]?.name ?? `Rep #${params.repId}`;

  let leadLabel = "";
  if (params.leadId) {
    const l = await db
      .select({ name: leads.name, practice: leads.practice })
      .from(leads)
      .where(eq(leads.id, params.leadId))
      .limit(1);
    leadLabel = l[0]?.practice || l[0]?.name || `Lead #${params.leadId}`;
  }

  const title = `Approval needed: ${params.kind.replace(/_/g, " ")}`;
  const body = `${repName} requested approval${leadLabel ? ` for ${leadLabel}` : ""}: ${params.reason}`;
  const linkUrl = "/admin/approvals";

  await Promise.all(
    admins.map((a) =>
      notify({
        repId: a.id,
        type: "approval.requested",
        title,
        body,
        payload: { approvalId: row.id, kind: params.kind, repId: params.repId },
        linkUrl,
      }),
    ),
  );

  // Owner fan-out (email + SMS)
  await notifyOwner({
    type: "approval.requested",
    title,
    body,
    linkUrl: `/ashford-admin/approvals?focus=${row.id}`,
  });

  return row;
};

export const decideApprovalRequest = async (params: {
  id: number;
  decidedByRepId: number;
  decision: "approved" | "denied";
  decisionNote?: string;
}) => {
  const [updated] = await db
    .update(approvalRequests)
    .set({
      status: params.decision,
      decidedByRepId: params.decidedByRepId,
      decidedAt: new Date(),
      decisionNote: params.decisionNote,
    })
    .where(
      and(
        eq(approvalRequests.id, params.id),
        eq(approvalRequests.status, "pending"),
      ),
    )
    .returning();
  if (!updated) return null;

  // Notify the requesting rep
  await notify({
    repId: updated.repId,
    type: "approval.decided",
    title: `Approval ${params.decision}: ${updated.kind.replace(/_/g, " ")}`,
    body: params.decisionNote ?? `Your request was ${params.decision}.`,
    payload: { approvalId: updated.id, decision: params.decision },
    linkUrl: updated.leadId
      ? `/dashboard/leads/${updated.leadId}`
      : "/dashboard",
  });
  return updated;
};

export const listPendingApprovals = () =>
  db
    .select()
    .from(approvalRequests)
    .where(eq(approvalRequests.status, "pending"))
    .orderBy(desc(approvalRequests.createdAt))
    .limit(200);

export const listApprovalsForLead = (leadId: number) =>
  db
    .select()
    .from(approvalRequests)
    .where(eq(approvalRequests.leadId, leadId))
    .orderBy(desc(approvalRequests.createdAt));

export const listApprovalsByStatus = (statuses: ("pending" | "approved" | "denied")[]) =>
  db
    .select()
    .from(approvalRequests)
    .where(inArray(approvalRequests.status, statuses))
    .orderBy(desc(approvalRequests.createdAt))
    .limit(200);

export type RefundApprovalSuccess = {
  ok: true;
  approval: typeof approvalRequests.$inferSelect;
  refund: RefundResult;
};

export type RefundApprovalFailure = {
  ok: false;
  error: StripeRefundError;
};

/**
 * Issue a Stripe refund for a `refund_invoice` approval and, on success,
 * resolve the approval as approved while persisting the Stripe refund id on
 * the row. Stripe errors are returned as a structured `{ ok: false }` result
 * so the admin UI can render the message inline and let the admin retry — the
 * approval stays pending in that case.
 *
 * Idempotency: the Stripe idempotency key is derived from the approval id and
 * requested cents amount, so duplicate clicks at the same amount can never
 * produce two refunds while still letting the admin retry with a corrected
 * amount after a recoverable Stripe error.
 */
export const refundApprovalInvoice = async (params: {
  id: number;
  decidedByRepId: number;
  amountCents: number;
  invoiceId?: string;
  decisionNote?: string;
}): Promise<RefundApprovalSuccess | RefundApprovalFailure> => {
  const [row] = await db
    .select()
    .from(approvalRequests)
    .where(eq(approvalRequests.id, params.id))
    .limit(1);
  if (!row) throw notFound("Approval not found");
  if (row.kind !== "refund_invoice") {
    throw badRequest("Only refund_invoice approvals can be refunded");
  }
  if (row.status !== "pending") {
    throw conflict("Approval has already been resolved");
  }

  const payload = (row.payload ?? {}) as Record<string, unknown>;
  const invoiceId =
    params.invoiceId?.trim() ||
    (typeof payload.invoiceId === "string" ? payload.invoiceId.trim() : "");
  if (!invoiceId) {
    throw badRequest(
      "Stripe invoice id is required (provide it in the refund panel).",
    );
  }
  if (!Number.isInteger(params.amountCents) || params.amountCents <= 0) {
    throw badRequest("Refund amount must be a positive whole number of cents.");
  }

  const idempotencyKey = `approval-${row.id}-refund-${params.amountCents}`;

  let result: RefundResult;
  try {
    result = await refundInvoice({
      invoiceId,
      amountCents: params.amountCents,
      idempotencyKey,
      metadata: {
        approvalId: String(row.id),
        decidedByRepId: String(params.decidedByRepId),
        leadId: row.leadId ? String(row.leadId) : "",
        saleId: row.saleId ? String(row.saleId) : "",
      },
    });
  } catch (err) {
    if (err instanceof StripeRefundFailure) {
      return { ok: false, error: err.detail };
    }
    throw err;
  }

  const mergedPayload = {
    ...payload,
    invoiceId: result.invoiceId,
    refundId: result.refundId,
    chargeId: result.chargeId,
    refundedAmountCents: result.amountCents,
    refundedAt: result.createdAt.toISOString(),
    refundStatus: result.status,
  };

  const [updated] = await db
    .update(approvalRequests)
    .set({
      status: "approved",
      decidedByRepId: params.decidedByRepId,
      decidedAt: new Date(),
      decisionNote: params.decisionNote,
      payload: mergedPayload,
    })
    .where(
      and(
        eq(approvalRequests.id, row.id),
        eq(approvalRequests.status, "pending"),
      ),
    )
    .returning();

  // If a concurrent click already resolved the row, re-read so the caller
  // still sees the persisted Stripe refund result.
  const finalRow = updated
    ? updated
    : (
        await db
          .select()
          .from(approvalRequests)
          .where(eq(approvalRequests.id, row.id))
          .limit(1)
      )[0];

  // LOT 1.2 carryover — route through the writeAudit helper instead of
  // hand-inserting into adminAuditLog. This call site has no Request
  // (decision happens in a background-ish path that was originally
  // invoked from a route handler but is also used by ops scripts), so
  // we use the Explicit variant and pass actor metadata directly.
  await writeAuditExplicit({
    actor: { id: params.decidedByRepId, role: "admin" },
    ip: null,
    userAgent: null,
    action: "approval.refund_issued",
    targetType: "approval_request",
    targetId: row.id,
    before: null,
    after: {
      invoiceId: result.invoiceId,
      chargeId: result.chargeId,
      refundId: result.refundId,
      amountCents: result.amountCents,
      refundStatus: result.status,
    },
  });

  await notify({
    repId: row.repId,
    type: "approval.decided",
    title: `Refund issued: $${(result.amountCents / 100).toFixed(2)}`,
    body: `The owner approved your refund request and Stripe processed refund ${result.refundId} on invoice ${result.invoiceId}.`,
    payload: {
      approvalId: row.id,
      decision: "approved",
      refundId: result.refundId,
      invoiceId: result.invoiceId,
      amountCents: result.amountCents,
    },
    linkUrl: row.leadId ? `/dashboard/leads/${row.leadId}` : "/dashboard",
  });

  return { ok: true, approval: finalRow!, refund: result };
};
