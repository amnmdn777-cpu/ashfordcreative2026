import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, fmtCents, fmtDate } from "@rep/lib/api";
import { PageHeader } from "@rep/components/RepLayout";
import { mrrByTier } from "@rep/pages/Dashboard";

// Comp constants — keep in sync with the API server (stripeWebhook.ts and
// dashboard/sales.ts) and the Payment Plans page.
const CLOSING_BONUS_CENTS = 14900; // $149 per close
const BASE_PLAN_CENTS = 19900;     // $199/mo base — anything above is rep's first-month bonus

const fmtBonus = (cents: number) => `$${(cents / 100).toFixed(0)}`;

export default function CommissionPage() {
  const comp = useQuery({ queryKey: ["comp"], queryFn: api.compSummary });
  const sales = useQuery({ queryKey: ["sales"], queryFn: api.listSales });

  const monthEarnings = comp.data?.totalBonusThisMonthCents ?? 0;
  // CLEANUP C.2 — per-tier MRR rollup from the rep's sales list.
  const tierBreakdown = useMemo(
    () => mrrByTier(sales.data?.sales ?? []),
    [sales.data],
  );

  return (
    <div className="px-4 md:px-8 py-8 md:py-10 max-w-5xl">
      <PageHeader
        title="Commission"
        description="What you've earned and where it comes from."
      />

      {/* CLEANUP C.2 — MRR by tier. Counts + monthly recurring revenue per
       *  tier across every sale you've closed. */}
      <div className="bg-card border border-card-border rounded-xl p-5 mb-6">
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            MRR by tier
          </div>
          <div className="text-xs text-muted-foreground">
            {sales.isLoading
              ? "—"
              : `${tierBreakdown.totalCount} active · ${fmtCents(tierBreakdown.totalMrrCents)}/mo total`}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          {tierBreakdown.rows.map((r) => (
            <div key={r.key} className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">{r.label}</div>
              <div className="font-serif text-2xl">
                {sales.isLoading ? "—" : r.count}
              </div>
              <div className="text-xs text-muted-foreground">
                {sales.isLoading ? "—" : `${fmtCents(r.mrrCents)}/mo`}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card
          label="Bonuses this month"
          value={fmtCents(monthEarnings)}
          hint="Closing bonuses + first-month add-on bonuses"
        />
        <Card
          label="Closings this month"
          value={String(comp.data?.closingsThisMonth ?? "—")}
          hint={`${fmtCents(
            comp.data?.closingBonusThisMonthCents ?? 0,
          )} · $149 each`}
        />
        <Card
          label="Add-on bonuses this month"
          value={fmtCents(comp.data?.firstMonthAddonBonusThisMonthCents ?? 0)}
          hint="First month's add-on revenue is yours"
        />
      </div>

      <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm mb-8">
        <h2 className="font-serif text-lg mb-2">How this works</h2>
        <ul className="text-sm text-foreground/80 space-y-2">
          <li>
            <span className="font-medium">$149 closing bonus</span> for every
            client you sign onto a $199/mo plan, regardless of plan or add-ons.
          </li>
          <li>
            <span className="font-medium">First month's add-on revenue is yours.</span>{" "}
            Everything above the $199 base in month 1 (Online Booking,
            Insights Journal, First-Visit Video, etc.) is paid to you. Full
            bundle close = $149 closing + $120 add-ons ={" "}
            <strong>$269 from one deal</strong>.
          </li>
          <li>
            <span className="font-medium">Custom dev — 10%</span> of any custom
            project that closes through you (logged separately under Custom
            Dev Quotes).
          </li>
          <li>
            <span className="font-medium">No monthly residual.</span> Comp is
            paid up front, not over time.
          </li>
          <li>
            <span className="font-medium">Lifetime sales:</span>{" "}
            {comp.data?.totalLifetimeSalesCount ?? "—"} closings, all-time.
          </li>
        </ul>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30">
          <h2 className="font-serif text-lg">All sales</h2>
        </div>
        {sales.isLoading ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            Loading…
          </div>
        ) : (sales.data?.sales.length ?? 0) === 0 ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            No sales yet — your first $149 bonus is waiting.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5">Date</th>
                  <th className="text-left px-4 py-2.5">Lead</th>
                  <th className="text-left px-4 py-2.5">Plan</th>
                  <th className="text-right px-4 py-2.5">Setup</th>
                  <th className="text-right px-4 py-2.5">Monthly</th>
                  <th className="text-right px-4 py-2.5">Closing bonus</th>
                  <th className="text-right px-4 py-2.5">Add-ons (1st mo)</th>
                  <th className="text-right px-4 py-2.5">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sales.data?.sales.map((s) => {
                  const addonCents = Math.max(
                    0,
                    s.monthlyAmountCents - BASE_PLAN_CENTS,
                  );
                  const totalCents = CLOSING_BONUS_CENTS + addonCents;
                  return (
                    <tr key={s.id}>
                      <td className="px-4 py-3 text-muted-foreground">
                        {fmtDate(s.occurredAt)}
                      </td>
                      <td className="px-4 py-3">
                        {s.leadId ? `#${s.leadId}` : "—"}
                      </td>
                      <td className="px-4 py-3">{s.planKey}</td>
                      <td className="px-4 py-3 text-right">
                        {fmtCents(s.setupAmountCents)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {fmtCents(s.monthlyAmountCents)}
                      </td>
                      <td className="px-4 py-3 text-right text-primary">
                        {fmtBonus(CLOSING_BONUS_CENTS)}
                      </td>
                      <td className="px-4 py-3 text-right text-primary">
                        {addonCents > 0 ? fmtBonus(addonCents) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-primary">
                        {fmtBonus(totalCents)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="font-serif text-3xl mt-2 text-foreground">{value}</div>
      {hint && (
        <div className="text-xs text-muted-foreground mt-1">{hint}</div>
      )}
    </div>
  );
}
