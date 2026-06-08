import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, DollarSign } from "lucide-react";
import { api, fmtCents, fmtDateTime } from "@admin/lib/api";
import { PageHeader } from "@admin/components/AdminLayout";

const STATUS_COLORS: Record<string, string> = {
  requested: "bg-amber-100 text-amber-900",
  quoted: "bg-blue-100 text-blue-900",
  sent: "bg-violet-100 text-violet-900",
  paid: "bg-emerald-100 text-emerald-900",
  declined: "bg-zinc-100 text-zinc-700",
};

export default function CustomDevPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "customDev"],
    queryFn: () => api.customDevQueue(),
  });

  const [drafts, setDrafts] = useState<Record<number, { amount: string; note: string }>>(
    {},
  );

  const setDraft = (id: number, k: "amount" | "note", v: string) =>
    setDrafts((s) => ({
      ...s,
      [id]: { ...(s[id] ?? { amount: "", note: "" }), [k]: v },
    }));

  const quote = useMutation({
    mutationFn: ({ id, cents, note }: { id: number; cents: number; note?: string }) =>
      api.quoteCustomDev(id, cents, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "customDev"] }),
  });

  const send = useMutation({
    mutationFn: (id: number) => api.sendCustomDev(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "customDev"] }),
  });

  return (
    <div className="p-6 md:p-10">
      <PageHeader
        title="Custom dev quotes"
        description="Quote and send custom feature requests. Sending creates a Stripe payment link."
      />

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {error && (
        <div className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load quotes"}
        </div>
      )}

      {data && data.quotes.length === 0 && (
        <div className="text-sm text-muted-foreground">No custom dev quotes yet.</div>
      )}

      <div className="space-y-4">
        {data?.quotes.map((q) => {
          const draft = drafts[q.id] ?? { amount: "", note: "" };
          const cents = Math.round(Number(draft.amount) * 100);
          return (
            <div
              key={q.id}
              className="bg-card border border-card-border rounded-lg p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                <div>
                  <div className="font-mono text-xs text-muted-foreground">#{q.id}</div>
                  <div className="text-sm">
                    Lead: <strong>{q.leadId ?? "—"}</strong> · Sale:{" "}
                    <strong>{q.saleId ?? "—"}</strong> · Rep:{" "}
                    <strong>{q.repId}</strong>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Created {fmtDateTime(q.createdAt)}
                    {q.sentAt && ` · Sent ${fmtDateTime(q.sentAt)}`}
                    {q.paidAt && ` · Paid ${fmtDateTime(q.paidAt)}`}
                  </div>
                </div>
                <span
                  className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                    STATUS_COLORS[q.status] ?? "bg-muted"
                  }`}
                >
                  {q.status}
                </span>
              </div>

              <div className="text-sm mb-2">
                <strong>Features:</strong>{" "}
                {q.featureKeys.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  q.featureKeys.map((f: string) => (
                    <span
                      key={f}
                      className="inline-block bg-secondary text-secondary-foreground rounded px-2 py-0.5 text-xs mr-1 mb-1"
                    >
                      {f}
                    </span>
                  ))
                )}
              </div>
              {q.customDescription && (
                <p className="text-sm bg-muted/40 rounded p-2.5 my-2 whitespace-pre-wrap">
                  {q.customDescription}
                </p>
              )}

              {q.quotedAmountCents !== null && (
                <div className="text-sm mt-2">
                  Quoted: <strong className="font-mono">{fmtCents(q.quotedAmountCents)}</strong>
                  {q.adminNote && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Note: {q.adminNote}
                    </div>
                  )}
                </div>
              )}

              {q.stripePaymentLinkUrl && (
                <a
                  href={q.stripePaymentLinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs text-primary underline mt-1"
                >
                  Open payment link →
                </a>
              )}

              {(q.status === "requested" || q.status === "quoted") && (
                <div className="mt-4 flex flex-col md:flex-row md:items-end gap-2 border-t border-border pt-3">
                  <label className="block flex-1">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      Quote amount ($)
                    </span>
                    <div className="relative mt-1">
                      <DollarSign
                        size={14}
                        className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                      />
                      <input
                        type="number"
                        step="0.01"
                        min={50}
                        value={draft.amount}
                        onChange={(e) => setDraft(q.id, "amount", e.target.value)}
                        className="w-full rounded-md border border-input bg-background pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="500.00"
                      />
                    </div>
                  </label>
                  <label className="block flex-1">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      Internal note (optional)
                    </span>
                    <input
                      value={draft.note}
                      onChange={(e) => setDraft(q.id, "note", e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={!cents || cents < 5000 || quote.isPending}
                    onClick={() =>
                      quote.mutate({ id: q.id, cents, note: draft.note || undefined })
                    }
                    className="rounded-md bg-secondary text-secondary-foreground px-3 py-2 text-sm font-medium hover:bg-secondary/80 disabled:opacity-60"
                  >
                    {q.quotedAmountCents == null ? "Save quote" : "Update quote"}
                  </button>
                  {q.quotedAmountCents != null && q.status === "quoted" && (
                    <button
                      type="button"
                      disabled={send.isPending}
                      onClick={() => send.mutate(q.id)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
                    >
                      <Send size={14} /> Send to prospect
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
