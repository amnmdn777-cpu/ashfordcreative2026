import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  DollarSign,
  TrendingUp,
  Users,
  CalendarClock,
  Bell,
  ArrowRight,
  Flame,
} from "lucide-react";
import { Award, Repeat } from "lucide-react";
import { HOT_LEAD_WINDOW_MS } from "@workspace/api-zod";
import { api, fmtCents, fmtDate, type HotLeadDto, type SaleRow, type TierKey } from "@rep/lib/api";
import { PageHeader } from "@rep/components/RepLayout";
import { FutureUpsellsCard } from "@rep/components/FutureUpsellsCard";
import { PhaseBTrainingPanel } from "@rep/components/PhaseBTrainingPanel";
import { useAuth } from "@rep/lib/auth";

function Kpi({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  icon: typeof DollarSign;
  hint?: string;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon size={14} className="text-accent" />
        {label}
      </div>
      <div className="font-serif text-3xl mt-2 text-foreground">{value}</div>
      {hint && (
        <div className="text-xs text-muted-foreground mt-1">{hint}</div>
      )}
    </div>
  );
}

function isToday(iso: string) {
  const d = new Date(iso);
  const t = new Date();
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const comp = useQuery({ queryKey: ["comp"], queryFn: api.compSummary });
  const mine = useQuery({
    queryKey: ["leads", "mine", "active"],
    queryFn: () => api.myLeads("active"),
  });
  const callbacks = useQuery({
    queryKey: ["callbacks"],
    queryFn: api.listCallbacks,
  });
  // CLEANUP C.2 — MRR by tier (computed client-side from the existing
  // /dashboard/sales endpoint; one row per sale carries planKey +
  // monthlyAmountCents, which sums into running MRR per tier).
  const salesQ = useQuery({ queryKey: ["sales"], queryFn: api.listSales });
  const tierBreakdown = useMemo(
    () => mrrByTier(salesQ.data?.sales ?? []),
    [salesQ.data],
  );
  const unread = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => api.notifications(true),
  });
  // Refetch every 60s so the section keeps in sync with new hot alerts and
  // naturally drops leads whose 60-minute window expires.
  const hot = useQuery({
    queryKey: ["leads", "hot"],
    queryFn: api.hotLeads,
    refetchInterval: 60_000,
  });
  const hotLeads = useMemo(
    () =>
      (hot.data?.leads ?? []).filter(
        (l) =>
          l.lastHotAlertAt !== null &&
          Date.now() - new Date(l.lastHotAlertAt).getTime() <
            HOT_LEAD_WINDOW_MS,
      ),
    [hot.data],
  );

  const callbacksToday =
    callbacks.data?.callbacks.filter((c) => isToday(c.scheduledFor)) ?? [];
  const upcoming =
    callbacks.data?.callbacks
      .slice()
      .sort(
        (a, b) =>
          +new Date(a.scheduledFor) - +new Date(b.scheduledFor),
      )
      .slice(0, 5) ?? [];

  return (
    <div className="px-4 md:px-8 py-8 md:py-10 max-w-7xl">
      <PageHeader
        title={`Hi ${user?.displayName.split(" ")[0] ?? ""},`}
        description="Here's where you stand and what needs attention."
        actions={
          <Link
            href="/available"
            className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
          >
            Find new leads <ArrowRight size={14} />
          </Link>
        }
      />

      <HotLeadsSection leads={hotLeads} loading={hot.isLoading} />

      <PhaseBTrainingPanel />

      {/* CLEANUP C.2 — MRR by tier. Counts + monthly recurring revenue per
       *  tier, computed client-side from the rep's own sales list. */}
      <MrrByTierCard
        breakdown={tierBreakdown}
        loading={salesQ.isLoading}
      />


      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-10">
        <Kpi
          label="Closings this month"
          value={String(comp.data?.closingsThisMonth ?? "—")}
          icon={TrendingUp}
        />
        <Kpi
          label="Closing bonuses this month"
          value={
            comp.data ? fmtCents(comp.data.closingBonusThisMonthCents) : "—"
          }
          icon={DollarSign}
          hint="$149 per closing"
        />
        <Kpi
          label="Add-on bonuses this month"
          value={
            comp.data
              ? fmtCents(comp.data.firstMonthAddonBonusThisMonthCents)
              : "—"
          }
          icon={Repeat}
          hint="First month's add-on revenue"
        />
        <Kpi
          label="Lifetime sales"
          value={String(comp.data?.totalLifetimeSalesCount ?? "—")}
          icon={Award}
          hint="All-time closings"
        />
        <Kpi
          label="Active leads"
          value={String(mine.data?.leads.length ?? "—")}
          icon={Users}
        />
        <Kpi
          label="Callbacks today"
          value={String(callbacksToday.length)}
          icon={CalendarClock}
        />
        <Kpi
          label="Unread alerts"
          value={String(unread.data?.notifications.length ?? 0)}
          icon={Bell}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl">Upcoming callbacks</h2>
            <Link
              href="/callbacks"
              className="text-sm text-accent hover:underline"
            >
              See all
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">
              No callbacks scheduled.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {upcoming.map((c) => (
                <li key={c.id} className="py-3 flex items-center gap-3">
                  <CalendarClock
                    size={16}
                    className="text-accent shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      Lead #{c.leadId}{" "}
                      <span className="text-muted-foreground">
                        — {fmtDate(c.scheduledFor)}{" "}
                        {new Date(c.scheduledFor).toLocaleTimeString(
                          undefined,
                          { hour: "numeric", minute: "2-digit" },
                        )}
                      </span>
                    </div>
                    {c.note && (
                      <div className="text-xs text-muted-foreground truncate">
                        {c.note}
                      </div>
                    )}
                  </div>
                  <Link
                    href={`/leads/${c.leadId}`}
                    className="text-xs text-accent hover:underline"
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl">My active leads</h2>
            <Link
              href="/my-leads"
              className="text-sm text-accent hover:underline"
            >
              See all
            </Link>
          </div>
          {!mine.data || mine.data.leads.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">
              No active leads. Open some from{" "}
              <Link href="/available" className="text-accent hover:underline">
                Available leads
              </Link>
              .
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {mine.data.leads.slice(0, 6).map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/leads/${l.id}`}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-muted/50 -mx-2 px-2 rounded"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {l.name}{" "}
                        <span className="text-muted-foreground font-normal">
                          · {l.practice}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {l.specialty} · {l.city}, {l.state}
                      </div>
                    </div>
                    <ArrowRight
                      size={14}
                      className="text-muted-foreground shrink-0"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <FutureUpsellsCard />
    </div>
  );
}

// Renders the relative age of a hot alert (e.g. "3m ago") and re-renders
// every 30s so the timer stays fresh while the rep is on the dashboard.
function HotAge({ iso }: { iso: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const ageMs = Math.max(0, now - new Date(iso).getTime());
  const mins = Math.floor(ageMs / 60_000);
  const label = mins < 1 ? "just now" : `${mins}m ago`;
  return <span className="text-xs text-orange-900/70 dark:text-orange-200/70">{label}</span>;
}

// CLEANUP C.2 — shared by Dashboard + Commission. Groups sales rows by
// plan_key into count + summed monthly recurring revenue per tier.
export type TierBreakdownRow = {
  key: TierKey;
  label: string;
  count: number;
  mrrCents: number;
};
const TIER_LABELS: Record<TierKey, string> = {
  boutique: "Boutique",
  boutique_pro: "Boutique Pro",
  boutique_concierge: "Boutique Concierge",
};
export function mrrByTier(sales: SaleRow[]): {
  rows: TierBreakdownRow[];
  totalCount: number;
  totalMrrCents: number;
} {
  const empty: Record<TierKey, TierBreakdownRow> = {
    boutique: { key: "boutique", label: TIER_LABELS.boutique, count: 0, mrrCents: 0 },
    boutique_pro: { key: "boutique_pro", label: TIER_LABELS.boutique_pro, count: 0, mrrCents: 0 },
    boutique_concierge: { key: "boutique_concierge", label: TIER_LABELS.boutique_concierge, count: 0, mrrCents: 0 },
  };
  for (const s of sales) {
    const r = empty[s.planKey];
    if (!r) continue;
    r.count += 1;
    r.mrrCents += s.monthlyAmountCents;
  }
  const rows = [empty.boutique, empty.boutique_pro, empty.boutique_concierge];
  return {
    rows,
    totalCount: rows.reduce((a, r) => a + r.count, 0),
    totalMrrCents: rows.reduce((a, r) => a + r.mrrCents, 0),
  };
}

function MrrByTierCard({
  breakdown,
  loading,
}: {
  breakdown: ReturnType<typeof mrrByTier>;
  loading: boolean;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm mb-6">
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          MRR by tier
        </div>
        <div className="text-xs text-muted-foreground">
          {loading
            ? "—"
            : `${breakdown.totalCount} active · ${fmtCents(breakdown.totalMrrCents)}/mo total`}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        {breakdown.rows.map((r) => (
          <div key={r.key} className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">{r.label}</div>
            <div className="font-serif text-2xl">
              {loading ? "—" : r.count}
            </div>
            <div className="text-xs text-muted-foreground">
              {loading ? "—" : `${fmtCents(r.mrrCents)}/mo`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HotLeadsSection({
  leads,
  loading,
}: {
  leads: HotLeadDto[];
  loading: boolean;
}) {
  // Hide the section entirely while loading the first time so we don't flash
  // an empty state. Once loaded, always render so the empty case is visible.
  if (loading && leads.length === 0) return null;
  return (
    <section
      className="mb-8 rounded-xl border border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/40 shadow-sm"
      data-testid="section-hot-leads"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-orange-200 dark:border-orange-800/60">
        <div className="flex items-center gap-2">
          <Flame size={16} className="text-orange-600 dark:text-orange-300" />
          <h2 className="font-serif text-lg text-orange-950 dark:text-orange-100">
            Hot now
          </h2>
          {leads.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full border border-orange-300 bg-orange-100 text-orange-900 dark:border-orange-700 dark:bg-orange-900/60 dark:text-orange-200">
              {leads.length}
            </span>
          )}
        </div>
        <span className="text-xs text-orange-900/70 dark:text-orange-200/70">
          Reopened in the last 60 min — call now.
        </span>
      </div>
      {leads.length === 0 ? (
        <div
          className="px-5 py-6 text-sm text-orange-900/80 dark:text-orange-200/80"
          data-testid="hot-leads-empty"
        >
          No hot leads right now. We'll surface any prospect who reopens their
          preview here.
        </div>
      ) : (
        <ul className="divide-y divide-orange-200 dark:divide-orange-800/60">
          {leads.map((l) => (
            <li key={l.id}>
              <Link
                href={`/leads/${l.id}`}
                className="px-5 py-3 flex items-center gap-3 hover:bg-orange-100/60 dark:hover:bg-orange-900/30"
                data-testid={`hot-lead-row-${l.id}`}
              >
                <span
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-orange-300 bg-orange-100 text-orange-900 dark:border-orange-700 dark:bg-orange-900/60 dark:text-orange-200 shrink-0"
                  data-testid="badge-hot-lead"
                >
                  <Flame size={12} />
                  Hot
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {l.name}{" "}
                    <span className="text-muted-foreground font-normal">
                      · {l.practice}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {l.specialty} · {l.city}, {l.state}
                  </div>
                </div>
                {l.lastHotAlertAt && <HotAge iso={l.lastHotAlertAt} />}
                <ArrowRight
                  size={14}
                  className="text-orange-700 dark:text-orange-300 shrink-0"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
