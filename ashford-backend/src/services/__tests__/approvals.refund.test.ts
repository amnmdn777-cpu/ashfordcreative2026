import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * These tests lock down `refundApprovalInvoice` — the money-moving Stripe
 * refund flow that resolves an approval, writes an audit log row, and
 * notifies the requesting rep.
 *
 * We mock the database, the Stripe wrapper, and the notification service so
 * the suite is hermetic. The real `StripeRefundFailure` class is preserved
 * (not mocked) so `instanceof` checks inside the service still behave
 * correctly.
 */

const {
  limitQueue,
  updateReturningQueue,
  insertCalls,
  updateCalls,
  resetUpdateSet,
  getLastUpdateSet,
  dbChain,
  fakeApprovalRequests,
  fakeAdminAuditLog,
  fakeSalesReps,
  fakeLeads,
} = vi.hoisted(() => {
  const limitQueue: unknown[][] = [];
  const updateReturningQueue: unknown[][] = [];
  const insertCalls: { table: unknown; values: unknown }[] = [];
  const updateCalls: { table: unknown; set?: unknown }[] = [];
  let lastUpdateSet: unknown = undefined;

  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(limitQueue.shift() ?? [])),
    update: vi.fn((table: unknown) => {
      updateCalls.push({ table });
      return chain;
    }),
    set: vi.fn((s: unknown) => {
      lastUpdateSet = s;
      if (updateCalls.length)
        updateCalls[updateCalls.length - 1].set = s;
      return chain;
    }),
    returning: vi.fn(() => Promise.resolve(updateReturningQueue.shift() ?? [])),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((v: unknown) => {
        insertCalls.push({ table, values: v });
        return Promise.resolve(undefined);
      }),
    })),
  });

  return {
    limitQueue,
    updateReturningQueue,
    insertCalls,
    updateCalls,
    resetUpdateSet: () => {
      lastUpdateSet = undefined;
    },
    getLastUpdateSet: () => lastUpdateSet,
    dbChain: chain,
    fakeApprovalRequests: { __name: "approval_requests" },
    fakeAdminAuditLog: { __name: "admin_audit_log" },
    fakeSalesReps: { __name: "sales_reps" },
    fakeLeads: { __name: "leads" },
  };
});

vi.mock("@workspace/db", () => ({
  db: dbChain,
  approvalRequests: fakeApprovalRequests,
  adminAuditLog: fakeAdminAuditLog,
  salesReps: fakeSalesReps,
  leads: fakeLeads,
}));

vi.mock("drizzle-orm", () => ({
  eq: (a: unknown, b: unknown) => ({ __op: "eq", a, b }),
  and: (...parts: unknown[]) => ({ __op: "and", parts }),
  desc: (a: unknown) => ({ __op: "desc", a }),
  inArray: (a: unknown, b: unknown) => ({ __op: "inArray", a, b }),
}));

const { notifyMock, notifyOwnerMock, refundInvoiceMock } = vi.hoisted(() => ({
  notifyMock: vi.fn(async () => undefined),
  notifyOwnerMock: vi.fn(async () => undefined),
  refundInvoiceMock: vi.fn(),
}));

vi.mock("../notifications", () => ({
  notify: notifyMock,
  notifyOwner: notifyOwnerMock,
}));

vi.mock("../../integrations/stripe", async () => {
  // Keep the real StripeRefundFailure class so `instanceof` in the service
  // correctly recognises Stripe-side failures we throw from our mock.
  const actual =
    await vi.importActual<typeof import("../../integrations/stripe")>(
      "../../integrations/stripe",
    );
  return {
    ...actual,
    refundInvoice: refundInvoiceMock,
  };
});

import { refundApprovalInvoice } from "../approvals";
import { StripeRefundFailure } from "../../integrations/stripe";
import { HttpError } from "../../lib/errors";

const baseApproval = {
  id: 42,
  leadId: 7,
  saleId: null as number | null,
  repId: 11,
  kind: "refund_invoice" as const,
  reason: "Customer cancelled within trial window",
  payload: { invoiceId: "in_test_123" } as Record<string, unknown>,
  status: "pending" as const,
  decidedByRepId: null as number | null,
  decidedAt: null as Date | null,
  decisionNote: null as string | null,
  createdAt: new Date("2026-04-20T10:00:00Z"),
};

const buildRefundResult = (
  overrides: Partial<{
    refundId: string;
    invoiceId: string;
    chargeId: string;
    amountCents: number;
    status: string | null;
    createdAt: Date;
  }> = {},
) => ({
  refundId: overrides.refundId ?? "re_abc123",
  invoiceId: overrides.invoiceId ?? "in_test_123",
  chargeId: overrides.chargeId ?? "ch_xyz789",
  amountCents: overrides.amountCents ?? 5000,
  status: overrides.status ?? "succeeded",
  createdAt: overrides.createdAt ?? new Date("2026-04-25T12:00:00Z"),
});

beforeEach(() => {
  limitQueue.length = 0;
  updateReturningQueue.length = 0;
  insertCalls.length = 0;
  updateCalls.length = 0;
  resetUpdateSet();
  notifyMock.mockClear();
  notifyOwnerMock.mockClear();
  refundInvoiceMock.mockReset();
  for (const fn of [
    dbChain.select,
    dbChain.from,
    dbChain.where,
    dbChain.limit,
    dbChain.update,
    dbChain.set,
    dbChain.returning,
    dbChain.insert,
  ] as ReturnType<typeof vi.fn>[]) {
    fn.mockClear();
  }
});

describe("refundApprovalInvoice — happy path", () => {
  it("issues the refund, marks the approval approved, writes an audit row, and notifies the rep", async () => {
    // 1) initial select for the approval row
    limitQueue.push([{ ...baseApproval }]);
    // 2) update().returning() returns the updated row
    updateReturningQueue.push([
      {
        ...baseApproval,
        status: "approved",
        decidedByRepId: 99,
        decidedAt: new Date("2026-04-25T12:00:00Z"),
      },
    ]);

    const refund = buildRefundResult();
    refundInvoiceMock.mockResolvedValueOnce(refund);

    const result = await refundApprovalInvoice({
      id: 42,
      decidedByRepId: 99,
      amountCents: 5000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");

    // Stripe call uses the derived idempotency key shape.
    expect(refundInvoiceMock).toHaveBeenCalledTimes(1);
    expect(refundInvoiceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: "in_test_123",
        amountCents: 5000,
        idempotencyKey: "approval-42-refund-5000",
        metadata: expect.objectContaining({
          approvalId: "42",
          decidedByRepId: "99",
          leadId: "7",
          saleId: "",
        }),
      }),
    );

    // Approval row gets the merged payload with refund metadata.
    const setCall = getLastUpdateSet() as Record<string, unknown>;
    expect(setCall.status).toBe("approved");
    expect(setCall.decidedByRepId).toBe(99);
    const mergedPayload = setCall.payload as Record<string, unknown>;
    expect(mergedPayload.refundId).toBe("re_abc123");
    expect(mergedPayload.invoiceId).toBe("in_test_123");
    expect(mergedPayload.chargeId).toBe("ch_xyz789");
    expect(mergedPayload.refundedAmountCents).toBe(5000);
    expect(mergedPayload.refundStatus).toBe("succeeded");
    expect(mergedPayload.refundedAt).toBe(
      new Date("2026-04-25T12:00:00Z").toISOString(),
    );

    // Exactly one audit log row, against the audit table.
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].table).toBe(fakeAdminAuditLog);
    expect(insertCalls[0].values).toMatchObject({
      actorRepId: 99,
      action: "approval.refund_issued",
      targetType: "approval_request",
      targetId: "42",
      diff: {
        invoiceId: "in_test_123",
        chargeId: "ch_xyz789",
        refundId: "re_abc123",
        amountCents: 5000,
        refundStatus: "succeeded",
      },
    });

    // Rep notification fired with the right shape.
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        repId: 11,
        type: "approval.decided",
        title: "Refund issued: $50.00",
        linkUrl: "/dashboard/leads/7",
        payload: expect.objectContaining({
          approvalId: 42,
          decision: "approved",
          refundId: "re_abc123",
          invoiceId: "in_test_123",
          amountCents: 5000,
        }),
      }),
    );

    // The returned refund result mirrors what Stripe gave us.
    expect(result.refund.refundId).toBe("re_abc123");
    expect(result.approval.status).toBe("approved");
  });
});

describe("refundApprovalInvoice — Stripe failure path", () => {
  it("leaves the approval pending, writes no audit row, sends no notification, and returns a structured error", async () => {
    limitQueue.push([{ ...baseApproval }]);

    refundInvoiceMock.mockRejectedValueOnce(
      new StripeRefundFailure({
        code: "charge_already_refunded",
        type: "invalid_request_error",
        message: "Charge ch_xyz789 has already been fully refunded.",
      }),
    );

    const result = await refundApprovalInvoice({
      id: 42,
      decidedByRepId: 99,
      amountCents: 5000,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error).toEqual({
      code: "charge_already_refunded",
      type: "invalid_request_error",
      message: "Charge ch_xyz789 has already been fully refunded.",
    });

    // No state mutation: no update, no audit row, no notification.
    expect(dbChain.update).not.toHaveBeenCalled();
    expect(insertCalls).toHaveLength(0);
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("rethrows non-Stripe failures so they surface as 5xx", async () => {
    limitQueue.push([{ ...baseApproval }]);
    refundInvoiceMock.mockRejectedValueOnce(new Error("network exploded"));

    await expect(
      refundApprovalInvoice({
        id: 42,
        decidedByRepId: 99,
        amountCents: 5000,
      }),
    ).rejects.toThrow("network exploded");

    expect(insertCalls).toHaveLength(0);
    expect(notifyMock).not.toHaveBeenCalled();
  });
});

describe("refundApprovalInvoice — validation guards", () => {
  it("throws 400 when called on a non-refund_invoice approval", async () => {
    limitQueue.push([
      { ...baseApproval, kind: "setup_fee_discount" as const },
    ]);

    await expect(
      refundApprovalInvoice({
        id: 42,
        decidedByRepId: 99,
        amountCents: 5000,
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: "Only refund_invoice approvals can be refunded",
    } satisfies Partial<HttpError>);

    expect(refundInvoiceMock).not.toHaveBeenCalled();
    expect(insertCalls).toHaveLength(0);
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("throws 404 when the approval id does not exist", async () => {
    limitQueue.push([]);

    await expect(
      refundApprovalInvoice({
        id: 999,
        decidedByRepId: 99,
        amountCents: 5000,
      }),
    ).rejects.toMatchObject({
      status: 404,
    } satisfies Partial<HttpError>);

    expect(refundInvoiceMock).not.toHaveBeenCalled();
  });

  it("throws 409 when the approval is already resolved", async () => {
    limitQueue.push([{ ...baseApproval, status: "approved" as const }]);

    await expect(
      refundApprovalInvoice({
        id: 42,
        decidedByRepId: 99,
        amountCents: 5000,
      }),
    ).rejects.toMatchObject({
      status: 409,
    } satisfies Partial<HttpError>);

    expect(refundInvoiceMock).not.toHaveBeenCalled();
  });

  it("throws 400 when the amount is not a positive integer of cents", async () => {
    limitQueue.push([{ ...baseApproval }]);
    await expect(
      refundApprovalInvoice({
        id: 42,
        decidedByRepId: 99,
        amountCents: 0,
      }),
    ).rejects.toMatchObject({ status: 400 } satisfies Partial<HttpError>);

    limitQueue.push([{ ...baseApproval }]);
    await expect(
      refundApprovalInvoice({
        id: 42,
        decidedByRepId: 99,
        amountCents: 12.5,
      }),
    ).rejects.toMatchObject({ status: 400 } satisfies Partial<HttpError>);

    expect(refundInvoiceMock).not.toHaveBeenCalled();
  });

  it("throws 400 when no invoice id is on the approval and none is supplied", async () => {
    limitQueue.push([{ ...baseApproval, payload: {} }]);
    await expect(
      refundApprovalInvoice({
        id: 42,
        decidedByRepId: 99,
        amountCents: 5000,
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("Stripe invoice id is required"),
    });
    expect(refundInvoiceMock).not.toHaveBeenCalled();
  });
});

describe("refundApprovalInvoice — idempotency under concurrent clicks", () => {
  it("two concurrent calls with the same amount use the same idempotency key (so Stripe dedupes to one refund)", async () => {
    // Both reads see a still-pending approval (the race window).
    limitQueue.push([{ ...baseApproval }], [{ ...baseApproval }]);
    // First update wins (status flips to approved).
    updateReturningQueue.push([
      { ...baseApproval, status: "approved" as const, decidedByRepId: 99 },
    ]);
    // Second update finds nothing because the WHERE includes status=pending.
    updateReturningQueue.push([]);
    // The "finalRow re-read" fallback after the lost race.
    limitQueue.push([
      { ...baseApproval, status: "approved" as const, decidedByRepId: 99 },
    ]);

    // Simulate Stripe's server-side idempotency: identical key -> identical
    // result, and we only count it as one logical refund.
    const stripeStore = new Map<string, ReturnType<typeof buildRefundResult>>();
    refundInvoiceMock.mockImplementation(
      async ({ idempotencyKey }: { idempotencyKey: string }) => {
        if (stripeStore.has(idempotencyKey)) {
          return stripeStore.get(idempotencyKey)!;
        }
        const result = buildRefundResult({
          refundId: `re_${stripeStore.size + 1}`,
        });
        stripeStore.set(idempotencyKey, result);
        return result;
      },
    );

    const [a, b] = await Promise.all([
      refundApprovalInvoice({ id: 42, decidedByRepId: 99, amountCents: 5000 }),
      refundApprovalInvoice({ id: 42, decidedByRepId: 99, amountCents: 5000 }),
    ]);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);

    // Both wrapper calls used the same key — that's what makes Stripe dedupe.
    const keysSeen = new Set(
      refundInvoiceMock.mock.calls.map(
        ([arg]: [{ idempotencyKey: string }]) => arg.idempotencyKey,
      ),
    );
    expect(keysSeen).toEqual(new Set(["approval-42-refund-5000"]));
    // Only one logical Stripe refund produced.
    expect(stripeStore.size).toBe(1);

    // Both callers see the same refund id.
    if (a.ok && b.ok) {
      expect(a.refund.refundId).toBe(b.refund.refundId);
    }
  });

  it("a retry at a different amount uses a different idempotency key (so the admin can correct the amount)", async () => {
    // First attempt: $50.00 — fails with a recoverable Stripe error.
    limitQueue.push([{ ...baseApproval }]);
    refundInvoiceMock.mockRejectedValueOnce(
      new StripeRefundFailure({
        code: "amount_too_large",
        type: "invalid_request_error",
        message: "Refund amount exceeds the charge amount.",
      }),
    );
    const first = await refundApprovalInvoice({
      id: 42,
      decidedByRepId: 99,
      amountCents: 5000,
    });
    expect(first.ok).toBe(false);

    // Second attempt: $40.00 — succeeds.
    limitQueue.push([{ ...baseApproval }]);
    updateReturningQueue.push([
      { ...baseApproval, status: "approved" as const, decidedByRepId: 99 },
    ]);
    refundInvoiceMock.mockResolvedValueOnce(
      buildRefundResult({ amountCents: 4000 }),
    );
    const second = await refundApprovalInvoice({
      id: 42,
      decidedByRepId: 99,
      amountCents: 4000,
    });
    expect(second.ok).toBe(true);

    const keys = refundInvoiceMock.mock.calls.map(
      ([arg]: [{ idempotencyKey: string }]) => arg.idempotencyKey,
    );
    expect(keys).toEqual([
      "approval-42-refund-5000",
      "approval-42-refund-4000",
    ]);
  });
});
