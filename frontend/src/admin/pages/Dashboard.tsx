import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { api, request, fmtCents, fmtDateTime, type EmailProblemRow } from "@admin/lib/api";
import { PageHeader } from "@admin/components/AdminLayout";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

const POOL_LABELS: Record<string, string> = {
  available: "Available",
  claimed: "Claimed",
  nurturing: "Nurturing",
  won: "Won",
  disqualified: "Disqualified",
  recycled: "Recycled",
};

const POOL_COLORS: Record<string, string> = {
  available: "hsl(var(--chart-1))",
  claimed: "hsl(var(--chart-2))",
  nurturing: "hsl(var(--chart-3))",
  won: "hsl(var(--chart-4))",
  disqualified: "hsl(var(--destructive))",
  recycled: "hsl(var(--muted-foreground))",
};

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="bg-card border border-card-border rounded-lg p-5 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-serif text-3xl mt-2 text-foreground">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

// Dashboard reminders — short, dated nudges that appear on the home
// admin dashboard until their dueDate passes. Hard-coded list (no DB
// table yet) — when one item passes its due date, prune it here on the
// next deploy. Items render newest-due-first.
type Reminder = {
  id: string;
  title: string;
  body: string;
  dueDate: string; // YYYY-MM-DD
  href?: string;
};
const REMINDERS: readonly Reminder[] = [
  {
    id: "seo-programmatic-measurement-2026-07",
    title: "Mesurer le SEO programmatique",
    body: "100 pages /therapists/[ville]/[spécialité] mises en ligne le 15 mai 2026. Vérifier dans Google Search Console les visites organiques + positions moyennes par requête, et identifier les 3 villes qui rankent le mieux.",
    dueDate: "2026-07-03",
    href: "https://search.google.com/search-console",
  },
];
function visibleReminders(): readonly Reminder[] {
  const today = new Date().toISOString().slice(0, 10);
  return REMINDERS.filter((r) => r.dueDate >= today).sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate)
  );
}
function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => api.dashboard(),
    refetchInterval: 30_000,
  });
  const { data: deliverability } = useQuery({
    queryKey: ["admin", "email", "deliverability"],
    queryFn: () => api.emailDeliverability(),
    refetchInterval: 60_000,
  });
  // Trailing-24h voice spend, polled aggressively (every 30s) so admins
  // catch a runaway dialer before the daily cap actually trips.
  const { data: voiceCost } = useQuery({
    queryKey: ["admin", "voice-cost-today"],
    queryFn: () => api.voiceCostToday(),
    refetchInterval: 30_000,
  });
  // [CLEANUP D.5] Articles-to-write count for the Editorial Queue. Polled
  // on the same cadence as the dashboard data so the badge stays fresh
  // as the editor publishes pieces throughout the day.
  const { data: editorialDue } = useQuery({
    queryKey: ["admin", "editorial", "due-count"],
    queryFn: () => request<{ count: number }>("/admin/editorial/due-count"),
    refetchInterval: 60_000,
  });

  // Sprint 1 (2026-05-22) — drives the "Portails à préparer" card.
  // Polls every 30s so a fresh request from Candice surfaces quickly
  // without the admin having to refresh.
  const qc = useQueryClient();
  const { data: portalReqs } = useQuery({
    queryKey: ["admin", "portal-requests", "pending"],
    queryFn: () => api.listPortalRequests("pending"),
    refetchInterval: 30_000,
  });
  const markHandled = useMutation({
    mutationFn: (id: number) => api.markPortalRequestHandled(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "portal-requests"] });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 md:p-10">
        <PageHeader title="Dashboard" />
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-6 md:p-10">
        <PageHeader title="Dashboard" />
        <div className="text-destructive text-sm">
          {error instanceof Error ? error.message : "Failed to load dashboard"}
        </div>
      </div>
    );
  }

  const poolData = Object.entries(data.leadsPool).map(([k, v]) => ({
    status: POOL_LABELS[k] ?? k,
    count: v,
    color: POOL_COLORS[k] ?? "hsl(var(--chart-1))",
  }));

  return (
    <div className="p-6 md:p-10">
      <PageHeader
        title="Dashboard"
        description="Live KPIs across the Ashford pipeline."
      />

      {/* LOT SEO-1 reminders panel — short dated nudges for the
       *  founder. Renders only if at least one reminder is still in
       *  the future. Card style matches the editorial-queue card. */}
      {visibleReminders().length > 0 && (
        <div className="mb-4 bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
            Rappels
          </div>
          <ul className="space-y-3">
            {visibleReminders().map((r) => {
              const days = daysUntil(r.dueDate);
              return (
                <li key={r.id} className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-serif text-base text-foreground">
                      {r.href ? (
                        <a
                          href={r.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline decoration-foreground/30 hover:decoration-foreground"
                        >
                          {r.title}
                        </a>
                      ) : (
                        r.title
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 leading-snug">
                      {r.body}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
                      Échéance
                    </div>
                    <div className="text-sm text-foreground">
                      {r.dueDate}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {days <= 0
                        ? "aujourd'hui"
                        : `dans ${days} jour${days === 1 ? "" : "s"}`}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {editorialDue && editorialDue.count > 0 && (
        <Link
          href="/editorial"
          className="block mb-4 bg-card border border-card-border rounded-lg p-4 hover:border-foreground/30 transition-colors"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Editorial queue
              </div>
              <div className="font-serif text-xl mt-1 text-foreground">
                {editorialDue.count} article
                {editorialDue.count === 1 ? "" : "s"} to write today
              </div>
            </div>
            <span className="text-sm text-muted-foreground">Open queue →</span>
          </div>
        </Link>
      )}

      {/* Sprint 1 (2026-05-22) — portal requests queue. Surfaces when a
          sales rep clicks "Demander un portail" on a lead detail page.
          Each card shows the prospect, the rep's optional note + the
          rep-notes thread on the lead so the founder has everything in
          one place before hand-crafting the portal. */}
      {portalReqs && portalReqs.portalRequests.length > 0 && (
        <div className="mb-4 bg-card border border-card-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Portails à préparer
            </div>
            <span className="text-xs text-muted-foreground">
              {portalReqs.portalRequests.length} en attente
            </span>
          </div>
          <ul className="space-y-3">
            {portalReqs.portalRequests.map((r) => (
              <li
                key={r.id}
                className="border border-card-border rounded-md p-3 bg-background/40"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/leads/${r.leadId}`}
                      className="font-serif text-base text-foreground underline decoration-foreground/30 hover:decoration-foreground"
                    >
                      {r.leadName}
                    </Link>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {r.leadPractice} · {r.leadCity}, {r.leadState}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Demandé par <b>{r.requestedByDisplayName}</b> ·{" "}
                      {fmtDateTime(r.createdAt)}
                    </div>
                    {r.message && (
                      <div className="mt-2 text-sm text-foreground bg-muted/40 rounded-md px-3 py-2 whitespace-pre-wrap">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">
                          Message du commercial
                        </span>
                        {r.message}
                      </div>
                    )}
                    {r.leadNotes && (
                      <div className="mt-2 text-xs text-muted-foreground bg-muted/20 rounded-md px-3 py-2 whitespace-pre-wrap line-clamp-4">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">
                          Notes existantes (lead)
                        </span>
                        {r.leadNotes}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    <button
                      onClick={() => markHandled.mutate(r.id)}
                      disabled={markHandled.isPending}
                      className="px-3 py-1.5 rounded-md border border-input bg-background text-xs font-medium hover:bg-muted disabled:opacity-60"
                    >
                      {markHandled.isPending
                        ? "Traitement…"
                        : "Marquer traité"}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="MRR" value={fmtCents(data.mrrCents)} hint={`${data.activeSubscriptions} active subs`} />
        <Kpi label="Sales this month" value={data.salesThisMonth} />
        <Kpi
          label="Open contact requests"
          value={data.openContactRequests}
          hint="Needs reply"
        />
        <Kpi
          label="Open custom dev quotes"
          value={data.openCustomDevQuotes}
          hint="Awaiting price"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
        <Kpi
          label="Churn this month"
          value={data.churn.thisMonth}
          hint={`${data.churn.ratePct}% rate · ${data.churn.previousMonth} last month`}
        />
        <Kpi
          label="Available leads"
          value={data.leadsPool.available ?? 0}
          hint="Ready for reps to claim"
        />
        <Kpi
          label="Claimed leads"
          value={data.leadsPool.claimed ?? 0}
          hint="In active outreach"
        />
        {voiceCost ? (
          <div
            className={`bg-card border rounded-lg p-5 shadow-sm ${
              voiceCost.tripped
                ? "border-destructive"
                : "border-card-border"
            }`}
            data-testid="kpi-voice-today"
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Voice today
            </div>
            <div className="font-serif text-3xl mt-2 text-foreground">
              ${voiceCost.spentUsd.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {voiceCost.tripped ? (
                <span className="text-destructive font-medium">
                  Daily cap reached — outbound paused
                </span>
              ) : (
                <>
                  ${voiceCost.remainingUsd.toFixed(2)} of $
                  {voiceCost.capUsd.toFixed(2)} remaining
                </>
              )}
            </div>
            {/* Volume context — admins read this to gauge whether a
                spike in spend is "lots of short calls" vs. "few but
                long" before clicking through to per-rep. */}
            <div
              className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground border-t border-card-border pt-2"
              data-testid="kpi-voice-today-volume"
            >
              <div>
                <span className="text-foreground font-medium tabular-nums">
                  {voiceCost.callCount}
                </span>{" "}
                calls
              </div>
              <div>
                <span className="text-foreground font-medium tabular-nums">
                  {voiceCost.connectedMinutes}
                </span>{" "}
                min connected
              </div>
            </div>
          </div>
        ) : (
          <Kpi label="Voice today" value="—" hint="Loading…" />
        )}
      </div>

      {/* Per-rep drill-down — only rendered when at least one rep has
          made a call today, so the dashboard stays clean on slow days.
          Compact list (not a chart) because admins use this to spot the
          *one* rep driving a spend spike, not for trend analysis. */}
      {voiceCost && voiceCost.byRep.length > 0 && (
        <section
          className="mt-4 bg-card border border-card-border rounded-lg p-5 shadow-sm"
          data-testid="voice-by-rep"
        >
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-serif text-base">Voice today · by rep</h2>
            <div className="text-xs text-muted-foreground">
              Resets at midnight Central
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-card-border">
                  <th className="text-left font-normal py-2">Rep</th>
                  <th className="text-right font-normal py-2">Calls</th>
                  <th className="text-right font-normal py-2">Minutes</th>
                  <th className="text-right font-normal py-2">Spend</th>
                </tr>
              </thead>
              <tbody>
                {voiceCost.byRep.map((r) => (
                  <tr
                    key={r.repId}
                    className="border-b border-card-border/50 last:border-0"
                  >
                    <td className="py-2">{r.repName ?? `Rep #${r.repId}`}</td>
                    <td className="text-right tabular-nums py-2">{r.calls}</td>
                    <td className="text-right tabular-nums py-2">
                      {r.minutes}
                    </td>
                    <td className="text-right tabular-nums py-2">
                      ${r.spentUsd.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <section className="bg-card border border-card-border rounded-lg p-5 shadow-sm">
          <h2 className="font-serif text-lg mb-4">Leads pool</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={poolData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {poolData.map((d) => (
                    <Cell key={d.status} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-card border border-card-border rounded-lg p-5 shadow-sm">
          <h2 className="font-serif text-lg mb-4">Top reps this month</h2>
          {data.topReps.length === 0 ? (
            <div className="text-sm text-muted-foreground">No sales yet this month.</div>
          ) : (
            <ul className="divide-y divide-border">
              {data.topReps.map((r) => (
                <li key={r.repId} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="font-medium text-foreground">{r.displayName}</div>
                    <div className="text-xs text-muted-foreground">@{r.username}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm">{r.salesCount} sales</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtCents(r.revenueCents)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="bg-card border border-card-border rounded-lg p-5 mt-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg">Email deliverability</h2>
          <span className="text-xs text-muted-foreground">
            Last 20 bounces / complaints / delays
          </span>
        </div>
        {!deliverability ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : deliverability.problems.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No deliverability problems in recent sends. Inbox reputation looks healthy.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="text-left">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Recipient</th>
                  <th className="py-2 pr-4">Subject</th>
                  <th className="py-2 pr-4">Why</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {deliverability.problems.map((p: EmailProblemRow) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                      {fmtDateTime(p.occurredAt)}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{p.toAddr}</td>
                    <td className="py-2 pr-4 truncate max-w-xs">{p.subject}</td>
                    <td className="py-2 pr-4 text-destructive text-xs">
                      {p.errorMessage ?? p.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-card border border-card-border rounded-lg p-5 mt-6 shadow-sm">
        <h2 className="font-serif text-lg mb-4">Recent sales</h2>
        {data.recentSales.length === 0 ? (
          <div className="text-sm text-muted-foreground">No sales recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="text-left">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Plan</th>
                  <th className="py-2 pr-4">Setup</th>
                  <th className="py-2 pr-4">Monthly</th>
                  <th className="py-2 pr-4">Rep</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.recentSales.slice(0, 10).map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 pr-4 text-muted-foreground">{fmtDateTime(s.occurredAt)}</td>
                    <td className="py-2 pr-4">{s.planKey}</td>
                    <td className="py-2 pr-4 font-mono">{fmtCents(s.setupAmountCents)}</td>
                    <td className="py-2 pr-4 font-mono">{fmtCents(s.monthlyAmountCents)}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {s.repId ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
