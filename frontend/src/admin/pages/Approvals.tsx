import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  APPROVAL_KIND_LABELS,
  fmtCents,
  fmtDateTime,
  type ApprovalRequestDto,
} from "@admin/lib/api";
import { PageHeader } from "@admin/components/AdminLayout";

type Filter = "pending" | "approved,denied" | "pending,approved,denied";

export default function ApprovalsPage() {
  const [filter, setFilter] = useState<Filter>("pending");
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "approvals", filter],
    queryFn: () => api.listApprovals(filter),
    refetchInterval: 30_000,
  });

  const decide = useMutation({
    mutationFn: (vars: {
      id: number;
      decision: "approved" | "denied";
      decisionNote?: string;
    }) =>
      api.decideApproval(vars.id, {
        decision: vars.decision,
        decisionNote: vars.decisionNote,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "approvals"] });
    },
  });

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description="Rep-initiated requests for discounts, free months, refunds, and custom pricing."
      />

      <div className="flex gap-2 text-xs">
        {(
          [
            ["pending", "Pending"],
            ["approved,denied", "Decided"],
            ["pending,approved,denied", "All"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key as Filter)}
            className={`px-3 py-1 rounded-full border ${
              filter === key
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && (
        <p className="text-sm text-destructive">
          Failed to load approvals: {(error as Error).message}
        </p>
      )}

      {!isLoading && rows.length === 0 && (
        <div className="bg-card border border-card-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          Nothing here. Reps will surface here when they request your sign-off.
        </div>
      )}

      <ul className="space-y-3">
        {rows.map((r) => (
          <ApprovalRow
            key={r.id}
            row={r}
            busy={decide.isPending && decide.variables?.id === r.id}
            onDecide={(decision, decisionNote) =>
              decide.mutate({ id: r.id, decision, decisionNote })
            }
            onRefunded={() =>
              qc.invalidateQueries({ queryKey: ["admin", "approvals"] })
            }
          />
        ))}
      </ul>
    </div>
  );
}

function ApprovalRow({
  row,
  onDecide,
  busy,
  onRefunded,
}: {
  row: ApprovalRequestDto;
  onDecide: (decision: "approved" | "denied", decisionNote?: string) => void;
  busy: boolean;
  onRefunded: () => void;
}) {
  const [note, setNote] = useState("");
  const isPending = row.status === "pending";
  const isRefund = row.kind === "refund_invoice";

  const payloadEntries = row.payload
    ? Object.entries(row.payload).filter(([, v]) => v !== null && v !== "")
    : [];

  return (
    <li className="bg-card border border-card-border rounded-lg p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-serif text-base">
              {APPROVAL_KIND_LABELS[row.kind]}
            </span>
            <StatusPill status={row.status} />
            {row.leadId && (
              <Link
                href={`/leads/${row.leadId}`}
                className="text-xs text-muted-foreground underline"
              >
                Lead #{row.leadId}
              </Link>
            )}
            {row.saleId && (
              <span className="text-xs text-muted-foreground">
                Sale #{row.saleId}
              </span>
            )}
          </div>
          <p className="text-sm text-foreground mt-2 whitespace-pre-wrap">
            {row.reason}
          </p>
          {payloadEntries.length > 0 && (
            <dl className="mt-2 text-xs text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1">
              {payloadEntries.map(([k, v]) => (
                <div key={k} className="flex gap-1">
                  <dt className="font-medium">{k}:</dt>
                  <dd>{String(v)}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Rep #{row.repId} · {fmtDateTime(row.createdAt)}
          </p>
          {row.status !== "pending" && (
            <p className="text-xs text-muted-foreground mt-1">
              {row.status === "approved" ? "Approved" : "Denied"}{" "}
              {fmtDateTime(row.decidedAt)}
              {row.decisionNote ? ` — "${row.decisionNote}"` : ""}
            </p>
          )}
        </div>
      </div>

      {isPending && isRefund && (
        <RefundPanel row={row} note={note} onRefunded={onRefunded} />
      )}

      {isPending && (
        <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-end">
          <label className="flex-1 text-xs">
            <span className="block text-muted-foreground mb-1">
              Note (optional, sent to rep)
            </span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                isRefund
                  ? "e.g. partial refund per customer agreement"
                  : "e.g. approved up to 50% off setup"
              }
              className="w-full text-sm border border-input rounded-md px-3 py-2 bg-background"
            />
          </label>
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => onDecide("denied", note || undefined)}
              className="text-sm border border-destructive text-destructive rounded-md px-3 py-2 hover:bg-destructive/10 disabled:opacity-50"
            >
              Deny
            </button>
            {!isRefund && (
              <button
                disabled={busy}
                onClick={() => onDecide("approved", note || undefined)}
                className="text-sm bg-foreground text-background rounded-md px-3 py-2 hover:opacity-90 disabled:opacity-50"
              >
                Approve
              </button>
            )}
          </div>
        </div>
      )}

      {!isPending && isRefund && <RefundResultDisplay row={row} />}
    </li>
  );
}

function RefundPanel({
  row,
  note,
  onRefunded,
}: {
  row: ApprovalRequestDto;
  note: string;
  onRefunded: () => void;
}) {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  const requestedAmountCents =
    typeof payload.amountCents === "number" ? payload.amountCents : null;
  const seedInvoiceId =
    typeof payload.invoiceId === "string" ? payload.invoiceId : "";

  const defaultAmountDollars = useMemo(() => {
    if (requestedAmountCents !== null) {
      return (requestedAmountCents / 100).toFixed(2);
    }
    return "";
  }, [requestedAmountCents]);

  const [invoiceId, setInvoiceId] = useState(seedInvoiceId);
  const [amount, setAmount] = useState(defaultAmountDollars);
  const [error, setError] = useState<string | null>(null);

  const refund = useMutation({
    mutationFn: async () => {
      const dollars = Number(amount);
      if (!Number.isFinite(dollars) || dollars <= 0) {
        throw new Error("Enter a refund amount greater than zero.");
      }
      const trimmedInvoice = invoiceId.trim();
      if (!trimmedInvoice) {
        throw new Error("Enter the Stripe invoice id (starts with in_…).");
      }
      return api.refundApproval(row.id, {
        amountCents: Math.round(dollars * 100),
        invoiceId: trimmedInvoice,
        decisionNote: note || undefined,
      });
    },
    onMutate: () => setError(null),
    onSuccess: () => {
      onRefunded();
    },
    onError: (err) => setError((err as Error).message || "Refund failed."),
  });

  return (
    <div className="mt-3 rounded-md border border-dashed border-border bg-muted/30 p-3">
      <div className="text-xs font-medium text-foreground mb-2">
        Issue refund via Stripe
      </div>
      <div className="grid sm:grid-cols-3 gap-2 text-xs">
        <label className="block sm:col-span-2">
          <span className="block text-muted-foreground mb-1">
            Stripe invoice ID
          </span>
          <input
            type="text"
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
            placeholder="in_1AbCdEfGhIjKlMnO"
            className="w-full text-sm border border-input rounded-md px-3 py-2 bg-background font-mono"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </label>
        <label className="block">
          <span className="block text-muted-foreground mb-1">
            Refund amount (USD)
            {requestedAmountCents !== null && (
              <span className="ml-1 text-foreground/60">
                · rep asked for {fmtCents(requestedAmountCents)}
              </span>
            )}
          </span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full text-sm border border-input rounded-md px-3 py-2 bg-background font-mono"
          />
        </label>
      </div>
      {error && (
        <p className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Issuing the refund here will resolve this approval and notify the rep.
        </p>
        <button
          type="button"
          disabled={refund.isPending}
          onClick={() => refund.mutate()}
          className="text-sm bg-foreground text-background rounded-md px-3 py-2 hover:opacity-90 disabled:opacity-50"
        >
          {refund.isPending ? "Refunding…" : "Refund via Stripe"}
        </button>
      </div>
    </div>
  );
}

function RefundResultDisplay({ row }: { row: ApprovalRequestDto }) {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  const refundId =
    typeof payload.refundId === "string" ? payload.refundId : null;
  if (!refundId) return null;
  const invoiceId =
    typeof payload.invoiceId === "string" ? payload.invoiceId : null;
  const refundedCents =
    typeof payload.refundedAmountCents === "number"
      ? payload.refundedAmountCents
      : null;
  const refundedAt =
    typeof payload.refundedAt === "string" ? payload.refundedAt : null;
  return (
    <div className="mt-3 rounded-md border border-green-200 dark:border-green-900/50 bg-green-50/60 dark:bg-green-950/30 p-3 text-xs">
      <div className="font-medium text-green-900 dark:text-green-200">
        Refund issued
      </div>
      <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-green-900/80 dark:text-green-200/80">
        <div className="flex gap-1">
          <dt className="font-medium">Refund:</dt>
          <dd className="font-mono">{refundId}</dd>
        </div>
        {invoiceId && (
          <div className="flex gap-1">
            <dt className="font-medium">Invoice:</dt>
            <dd className="font-mono">{invoiceId}</dd>
          </div>
        )}
        {refundedCents !== null && (
          <div className="flex gap-1">
            <dt className="font-medium">Amount:</dt>
            <dd>{fmtCents(refundedCents)}</dd>
          </div>
        )}
        {refundedAt && (
          <div className="flex gap-1">
            <dt className="font-medium">When:</dt>
            <dd>{fmtDateTime(refundedAt)}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function StatusPill({ status }: { status: ApprovalRequestDto["status"] }) {
  const cls =
    status === "pending"
      ? "bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200"
      : status === "approved"
        ? "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200"
        : "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200";
  return (
    <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${cls}`}>
      {status}
    </span>
  );
}
