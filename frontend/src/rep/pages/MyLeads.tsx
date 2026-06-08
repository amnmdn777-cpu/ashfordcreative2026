import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { Phone } from "lucide-react";
import { api, fmtDate } from "@rep/lib/api";
import { PageHeader } from "@rep/components/RepLayout";
import { ScoreBadge } from "@rep/components/ScoreBadge";

// "Work in Progress" is the rep-facing label for the `nurturing` status.
// The previous "Active" tab (showing the `claimed` status) is gone — reps
// no longer auto-claim a lead just by opening it, so there is no
// intermediate "claimed but not worked" bucket to surface.
const TABS: {
  key: "nurturing" | "won" | "disqualified" | "cold" | "all";
  label: string;
}[] = [
  { key: "nurturing", label: "Work in Progress" },
  { key: "cold", label: "Cold" },
  { key: "won", label: "Won" },
  { key: "disqualified", label: "Disqualified" },
  { key: "all", label: "All" },
];

const STATUS_STYLES: Record<string, string> = {
  claimed: "bg-accent/10 text-accent border-accent/30",
  nurturing: "bg-chart-3/10 text-chart-3 border-chart-3/30",
  won: "bg-primary/10 text-primary border-primary/30",
  disqualified: "bg-muted text-muted-foreground border-border",
  cold: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/30 dark:text-sky-200 dark:border-sky-900",
};

const STATUS_LABELS: Record<string, string> = {
  nurturing: "Work in progress",
  claimed: "Work in progress",
};

export default function MyLeadsPage() {
  // Allow deep-linking via /my-leads/<tab> (e.g. the sidebar's Cold leads
  // entry). Unknown segments fall back to "active".
  const [, params] = useRoute<{ tab?: string }>("/my-leads/:tab");
  const initialTab =
    (TABS.find((t) => t.key === params?.tab)?.key) ?? "nurturing";
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>(initialTab);
  // Typo-tolerant search box (server-side trigram match — see
  // services/leads.ts `getRepLeads`). Lets a rep type "Dolores" and find
  // "Delores Hendrix-Giles" in their own claimed pool.
  const [name, setName] = useState("");
  // Founder feedback 2026-05-19: City / Specialty / No-website filters
  // parity with Available leads, applied client-side over the rep's pool.
  const [city, setCity] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [hasWebsite, setHasWebsite] = useState<"" | "yes" | "no">("");
  // B7 (founder 2026-05-19) — filter by QC status.
  const [qcFilter, setQcFilter] = useState<"" | "validated" | "stale" | "none">("");
  const { data, isLoading } = useQuery({
    queryKey: ["leads", "mine", tab, name],
    queryFn: () => api.myLeads(tab, name || undefined),
  });
  const filteredData = (data ?? []).filter((lead: any) => {
    if (city.trim() && !(lead.city ?? "").toLowerCase().includes(city.trim().toLowerCase())) return false;
    if (specialty.trim() && !(lead.specialty ?? "").toLowerCase().includes(specialty.trim().toLowerCase())) return false;
    if (hasWebsite === "yes" && !lead.currentWebsite) return false;
    if (hasWebsite === "no" && lead.currentWebsite) return false;
    if (qcFilter && (lead.qcStatus ?? "none") !== qcFilter) return false;
    return true;
  });

  return (
    <div className="px-4 md:px-8 py-8 md:py-10 max-w-7xl">
      <PageHeader
        title="My leads"
        description="Leads you've opened, by stage."
      />

      <div className="bg-card border border-card-border rounded-xl p-4 mb-4 shadow-sm flex flex-wrap gap-3 items-end">
        <label className="block flex-1 min-w-[200px]">
          <span className="text-xs text-muted-foreground">Search by name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Dolores or Wilson Therapy" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </label>
        <label className="block flex-1 min-w-[160px]">
          <span className="text-xs text-muted-foreground">City</span>
          <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g., Austin" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </label>
        <label className="block flex-1 min-w-[160px]">
          <span className="text-xs text-muted-foreground">Specialty</span>
          <input type="text" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="e.g., LCSW" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </label>
        <label className="block min-w-[140px]">
          <span className="text-xs text-muted-foreground">Website</span>
          <select value={hasWebsite} onChange={(e) => setHasWebsite(e.target.value as "" | "yes" | "no")} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">All</option>
            <option value="yes">Has website</option>
            <option value="no">No website</option>
          </select>
        </label>
        <label className="block min-w-[140px]">
          <span className="text-xs text-muted-foreground">QC</span>
          <select value={qcFilter} onChange={(e) => setQcFilter(e.target.value as "" | "validated" | "stale" | "none")} data-testid="myleads-qc-filter" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">All</option>
            <option value="validated">✓ Validated</option>
            <option value="stale">⚠ Outdated</option>
            <option value="none">No QC</option>
          </select>
        </label>
        {(city || specialty || hasWebsite || qcFilter) && (
          <button type="button" onClick={() => { setCity(""); setSpecialty(""); setHasWebsite(""); setQcFilter(""); }} className="text-xs text-muted-foreground hover:text-foreground underline">Clear filters</button>
        )}
      </div>

      <div className="flex gap-1 mb-4 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "nurturing" && (
        <div className="mb-4 rounded-md border border-chart-3/30 bg-chart-3/5 px-4 py-3 text-sm text-foreground/80">
          <span className="font-medium text-foreground">Work in Progress</span>{" "}
          = leads you've picked up and are actively working. They stay yours
          and won't get recycled to other reps as long as you keep activity
          on them (SMS, email, callback, or preview).
        </div>
      )}

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Score</th>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Practice</th>
                <th className="text-left px-4 py-3">City</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    Loading…
                  </td>
                </tr>
              )}
              {data && data.leads.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No leads in this view.
                  </td>
                </tr>
              )}
              {data?.leads.map((l) => (
                <tr key={l.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <ScoreBadge
                      tier={l.scoreTier as "A" | "B" | "C" | null | undefined}
                      score={l.leadScore}
                      breakdown={l.scoreBreakdown}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/leads/${l.id}`}
                      className="hover:underline"
                    >
                      {l.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{l.practice}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {l.city}, {l.state}
                  </td>
                  <td className="px-4 py-3">
                    <div className="inline-flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border ${
                          STATUS_STYLES[l.status] ??
                          "border-border text-muted-foreground"
                        }`}
                      >
                        {STATUS_LABELS[l.status] ?? l.status}
                      </span>
                      {l.needsFollowUpCall && (
                        <span
                          data-testid={`needs-call-badge-${l.id}`}
                          title="Preview email sent over 24h ago and the prospect hasn't opened it. Time for a follow-up call."
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-50/60 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
                        >
                          <Phone size={10} />
                          Needs call
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {fmtDate(l.lastActivityAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
