import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, fmtCents, fmtDate, fmtDateTime, type SubscriptionRow } from "@admin/lib/api";
import { PageHeader } from "@admin/components/AdminLayout";
import { X } from "lucide-react";
import { TIERS, CAPABILITIES, type TierKey } from "@workspace/api-zod";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-900",
  trialing: "bg-blue-100 text-blue-900",
  past_due: "bg-amber-100 text-amber-900",
  unpaid: "bg-amber-100 text-amber-900",
  incomplete: "bg-zinc-100 text-zinc-700",
  canceled: "bg-rose-100 text-rose-900",
};

export default function SubscriptionsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "subscriptions"],
    queryFn: () => api.listSubscriptions(),
  });

  const [cancelTarget, setCancelTarget] = useState<SubscriptionRow | null>(null);
  const [transferTarget, setTransferTarget] = useState<SubscriptionRow | null>(null);
  const [upgradeTarget, setUpgradeTarget] = useState<SubscriptionRow | null>(null);
  const [capsTarget, setCapsTarget] = useState<SubscriptionRow | null>(null);

  return (
    <div className="p-6 md:p-10">
      <PageHeader
        title="Subscriptions"
        description="Manage active subscriptions. Cancellation is end-of-period via Stripe."
      />

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {error && (
        <div className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load"}
        </div>
      )}

      {data && (
        <div className="bg-card border border-card-border rounded-lg shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
              <tr className="text-left">
                <th className="py-2.5 px-4">#</th>
                <th className="py-2.5 px-4">Sale</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Monthly</th>
                <th className="py-2.5 px-4">Add-ons</th>
                <th className="py-2.5 px-4">Period end</th>
                <th className="py-2.5 px-4">Created</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.subscriptions.map((s) => (
                <tr key={s.id}>
                  <td className="py-2.5 px-4 font-mono text-xs">{s.id}</td>
                  <td className="py-2.5 px-4">{s.saleId}</td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                        STATUS_COLORS[s.status] ?? "bg-muted"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-mono">{fmtCents(s.monthlyTotalCents)}</td>
                  <td className="py-2.5 px-4 text-xs text-muted-foreground">
                    {s.addonKeys.length === 0 ? "—" : s.addonKeys.join(", ")}
                  </td>
                  <td className="py-2.5 px-4 text-xs text-muted-foreground">
                    {fmtDate(s.currentPeriodEnd)}
                  </td>
                  <td className="py-2.5 px-4 text-xs text-muted-foreground">
                    {fmtDate(s.createdAt)}
                  </td>
                  <td className="py-2.5 px-4 text-right space-x-2">
                    {s.status !== "canceled" && (
                      <button
                        type="button"
                        onClick={() => setCancelTarget(s)}
                        className="text-xs text-destructive hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                    {s.status === "active" && (
                      <button
                        type="button"
                        onClick={() => setUpgradeTarget(s)}
                        className="text-xs text-primary hover:underline"
                      >
                        Upgrade tier
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setCapsTarget(s)}
                      className="text-xs text-foreground hover:underline"
                    >
                      Capabilities
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransferTarget(s)}
                      className="text-xs text-foreground hover:underline"
                    >
                      Transfer domain
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.subscriptions.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No subscriptions yet.
            </div>
          )}
        </div>
      )}

      {cancelTarget && (
        <CancelModal
          sub={cancelTarget}
          onClose={() => setCancelTarget(null)}
        />
      )}
      {transferTarget && (
        <TransferDomainModal
          sub={transferTarget}
          onClose={() => setTransferTarget(null)}
        />
      )}
      {upgradeTarget && (
        <UpgradeTierModal
          sub={upgradeTarget}
          onClose={() => setUpgradeTarget(null)}
        />
      )}
      {capsTarget && (
        <CapabilitiesModal
          sub={capsTarget}
          onClose={() => setCapsTarget(null)}
        />
      )}
    </div>
  );
}

function CancelModal({
  sub,
  onClose,
}: {
  sub: SubscriptionRow;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<{ cancelAtPeriodEnd: boolean } | null>(null);

  const m = useMutation({
    mutationFn: () => api.cancelSubscription(sub.id, reason || undefined),
    onSuccess: (r) => {
      setDone({ cancelAtPeriodEnd: r.cancelAtPeriodEnd });
      qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
    },
  });

  return (
    <Modal title={`Cancel subscription #${sub.id}`} onClose={onClose}>
      {done ? (
        <div className="space-y-3">
          <div className="text-sm">
            {done.cancelAtPeriodEnd
              ? "✅ Stripe will end the subscription at the current period close. The local row stays active until the webhook confirms cancellation."
              : "⚠️ Stripe is not configured; the cancellation could not be scheduled. Investigate manually."}
          </div>
          <div className="text-right">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-3">
            Cancellation is scheduled at the end of the current billing period via Stripe. The
            client keeps their site until <strong>{fmtDate(sub.currentPeriodEnd)}</strong>.
          </p>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Internal reason (optional)
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          {m.error && (
            <div className="text-sm text-destructive mt-2">
              {m.error instanceof Error ? m.error.message : "Cancel failed"}
            </div>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 text-sm hover:bg-muted"
            >
              Keep
            </button>
            <button
              type="button"
              disabled={m.isPending}
              onClick={() => m.mutate()}
              className="rounded-md bg-destructive text-destructive-foreground px-3 py-2 text-sm font-medium hover:bg-destructive/90 disabled:opacity-60"
            >
              {m.isPending ? "Scheduling…" : "Schedule cancellation"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function TransferDomainModal({
  sub,
  onClose,
}: {
  sub: SubscriptionRow;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const m = useMutation({
    mutationFn: () => api.transferDomain(sub.id, email),
  });

  return (
    <Modal title={`Transfer domain for subscription #${sub.id}`} onClose={onClose}>
      {m.data ? (
        <div className="space-y-3">
          <div className="text-sm">
            Transfer fee: <strong className="font-mono">{fmtCents(m.data.transferFeeCents)}</strong>
          </div>
          {m.data.paymentLinkUrl ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{m.data.message}</p>
              <a
                href={m.data.paymentLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block break-all text-sm text-primary underline bg-muted/40 rounded p-2"
              >
                {m.data.paymentLinkUrl}
              </a>
            </div>
          ) : (
            <p className="text-sm text-amber-700">{m.data.message}</p>
          )}
          <div className="text-right">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-3">
            Plan B includes a domain we registered. Domain transfer is a one-time $199 fee. We
            generate a Stripe payment link to send to the customer.
          </p>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Customer email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          {m.error && (
            <div className="text-sm text-destructive mt-2">
              {m.error instanceof Error ? m.error.message : "Failed"}
            </div>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 text-sm hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!email || m.isPending}
              onClick={() => m.mutate()}
              className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
            >
              {m.isPending ? "Generating…" : "Generate payment link"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function UpgradeTierModal({
  sub,
  onClose,
}: {
  sub: SubscriptionRow;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [tierKey, setTierKey] = useState<string>("boutique_pro");
  const m = useMutation({
    mutationFn: () => api.upgradeSubscription(sub.id, tierKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
      onClose();
    },
  });
  return (
    <Modal title={`Upgrade subscription #${sub.id}`} onClose={onClose}>
      <p className="text-sm text-muted-foreground mb-3">
        Records the upgrade intent on the audit log. The actual Stripe
        price swap is performed by ops in the Stripe dashboard.
      </p>
      <label className="block">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Target tier
        </span>
        <select
          value={tierKey}
          onChange={(e) => setTierKey(e.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="boutique">Boutique ($199/mo)</option>
          <option value="boutique_pro">Boutique Pro ($299/mo)</option>
          <option value="boutique_concierge">Boutique Concierge ($649/mo)</option>
        </select>
      </label>
      {m.error && (
        <div className="text-sm text-destructive mt-2">
          {m.error instanceof Error ? m.error.message : "Failed"}
        </div>
      )}
      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-3 py-2 text-sm hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={m.isPending}
          onClick={() => m.mutate()}
          className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium disabled:opacity-60"
        >
          {m.isPending ? "Recording…" : "Record upgrade intent"}
        </button>
      </div>
    </Modal>
  );
}

/**
 * LOT 3.11 — Capabilities-per-customer view. Reads from canonical
 * TIERS + CAPABILITIES; the SubscriptionRow today does not carry a
 * planKey field, so we infer from monthlyTotalCents (the tier prices
 * are unique and stable). TODO: surface planKey on SubscriptionRow
 * directly and key off that.
 */
function CapabilitiesModal({
  sub,
  onClose,
}: {
  sub: SubscriptionRow;
  onClose: () => void;
}) {
  const inferredTier: TierKey = (() => {
    if (sub.monthlyTotalCents >= 60000) return "boutique_concierge";
    if (sub.monthlyTotalCents >= 25000) return "boutique_pro";
    return "boutique";
  })();
  const tier = TIERS[inferredTier];
  return (
    <Modal title={`Capabilities · ${tier.label}`} onClose={onClose}>
      <p className="text-sm text-muted-foreground mb-3">
        Subscription #{sub.id} ships these capabilities:
      </p>
      <ul className="text-sm space-y-1.5">
        {tier.capabilities.map((k) => (
          <li key={k} className="flex gap-2">
            <span className="text-emerald-600">✓</span>
            <span>
              <strong className="font-medium">{CAPABILITIES[k].label}</strong>
              <span className="text-muted-foreground">
                {" "}— {CAPABILITIES[k].description}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <div className="text-right mt-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm"
        >
          Done
        </button>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="bg-card border border-card-border rounded-xl shadow-xl w-full max-w-md p-6 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1 hover:bg-muted rounded"
          aria-label="Close"
        >
          <X size={16} />
        </button>
        <h2 className="font-serif text-xl mb-4 pr-8">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export { fmtDateTime };
