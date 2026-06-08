import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Sparkles, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { api } from "@rep/lib/api";
import { PageHeader } from "@rep/components/RepLayout";
import { ScoreBadge, type Tier } from "@rep/components/ScoreBadge";

type SortKey = "score" | "name" | "city" | "practice" | "specialty";
type SortDir = "asc" | "desc";

// Normalize US phone formatting at render so the queue isn't a mix of
// "5125551234", "+15125551234", and "(512) 555-1234" depending on which
// source the lead was imported from (LOT 7.9).
function formatPhoneCell(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const ten =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length !== 10) return raw;
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

export default function AvailableLeadsPage() {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [topQualityOnly, setTopQualityOnly] = useState(false);
  // Website presence filter: "" = all, "yes" = has site, "no" = no site.
  const [hasWebsite, setHasWebsite] = useState<"" | "yes" | "no">("");
  const [page, setPage] = useState(1);
  // #221 sortable headers. Default mirrors the historical server-side
  // ordering (score DESC) so existing reps see no surprise on first
  // load. Clicking a column toggles direction; clicking a different
  // column resets direction to a sensible default (DESC for score so
  // the best leads stay at top, ASC for text columns).
  const [sortBy, setSortBy] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [, navigate] = useLocation();

  const handleSort = (key: SortKey) => {
    if (key === sortBy) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir(key === "score" ? "desc" : "asc");
    }
    setPage(1);
  };

  const { data, isLoading } = useQuery({
    queryKey: [
      "available",
      name,
      city,
      specialty,
      topQualityOnly,
      hasWebsite,
      page,
      sortBy,
      sortDir,
    ],
    queryFn: () =>
      api.availableLeads({
        name: name || undefined,
        city: city || undefined,
        specialty: specialty || undefined,
        topQualityOnly: topQualityOnly || undefined,
        hasWebsite: hasWebsite || undefined,
        page,
        pageSize: 25,
        sortBy,
        sortDir,
      }),
  });

  // Opening a lead from the available pool just navigates to the detail
  // page — it no longer claims the lead. The rep explicitly promotes it
  // to Work in Progress from the lead detail when they're ready.
  return (
    <div className="px-4 md:px-8 py-8 md:py-10 max-w-7xl">
      <PageHeader
        title="Available leads"
        description="Texas mental-health practitioners ready to be contacted. Sorted by quality score — tier A first, then B, then C."
      />

      <div className="bg-card border border-card-border rounded-xl p-4 mb-4 shadow-sm flex flex-wrap gap-3 items-end">
        <label className="block flex-1 min-w-[200px]">
          <span className="text-xs text-muted-foreground">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setPage(1);
            }}
            placeholder="e.g., Sarah Wilson"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="block flex-1 min-w-[160px]">
          <span className="text-xs text-muted-foreground">City</span>
          <input
            type="text"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setPage(1);
            }}
            placeholder="e.g., Austin"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="block flex-1 min-w-[160px]">
          <span className="text-xs text-muted-foreground">Specialty</span>
          <input
            type="text"
            value={specialty}
            onChange={(e) => {
              setSpecialty(e.target.value);
              setPage(1);
            }}
            placeholder="e.g., LCSW"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        {/* Tier-A-only toggle — surfaces just the top-tier leads
            (score ≥ 70). NULL-scored leads are excluded from this
            filter on purpose: they haven't proven themselves yet, so
            they shouldn't crowd a focus session. #212. */}
        <button
          type="button"
          onClick={() => {
            setTopQualityOnly((v) => !v);
            setPage(1);
          }}
          aria-pressed={topQualityOnly}
          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
            topQualityOnly
              ? "border-red-500/40 bg-red-500/10 text-red-700"
              : "border-input bg-background text-muted-foreground hover:text-foreground"
          }`}
          title="Show only tier A leads (score ≥ 37)"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Tier A only
        </button>
        {/* Website presence filter — pitch "we'll refresh your site" vs
            "you don't have one yet, let's build it" target very
            different conversations. */}
        <label className="block min-w-[160px]">
          <span className="text-xs text-muted-foreground">Website</span>
          <select
            value={hasWebsite}
            onChange={(e) => {
              setHasWebsite(e.target.value as "" | "yes" | "no");
              setPage(1);
            }}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All</option>
            <option value="yes">Has website</option>
            <option value="no">No website</option>
          </select>
        </label>
        {(name || city || specialty || topQualityOnly || hasWebsite) && (
          <button
            onClick={() => {
              setName("");
              setCity("");
              setSpecialty("");
              setTopQualityOnly(false);
              setHasWebsite("");
              setPage(1);
            }}
            className="text-sm text-muted-foreground hover:text-foreground px-3 py-2"
          >
            Clear
          </button>
        )}
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <SortableTh label="Score" sortKey="score" active={sortBy} dir={sortDir} onClick={handleSort} />
                <SortableTh label="Name" sortKey="name" active={sortBy} dir={sortDir} onClick={handleSort} />
                <SortableTh label="Practice" sortKey="practice" active={sortBy} dir={sortDir} onClick={handleSort} />
                <SortableTh label="Specialty" sortKey="specialty" active={sortBy} dir={sortDir} onClick={handleSort} />
                <SortableTh label="City" sortKey="city" active={sortBy} dir={sortDir} onClick={handleSort} />
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-left px-4 py-3">Website</th>
                {/* LOT 3.12 — Tier interest. Today renders "—" until the
                 *  lead row exposes selfServeMeta.tierKey from the API. */}
                <th className="text-left px-4 py-3">Tier</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    Loading…
                  </td>
                </tr>
              )}
              {data && data.leads.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No leads match your filters.
                  </td>
                </tr>
              )}
              {data?.leads.map((l) => (
                <tr key={l.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <ScoreBadge
                      tier={l.scoreTier as Tier | null | undefined}
                      score={l.leadScore}
                      breakdown={l.scoreBreakdown}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{l.name}</td>
                  <td className="px-4 py-3">{l.practice}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {l.specialty}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {l.city}, {l.state}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatPhoneCell(l.phone)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[200px]">
                    {l.currentWebsite ? (
                      <a
                        href={l.currentWebsite}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary underline hover:no-underline truncate inline-block max-w-full align-middle"
                        title={l.currentWebsite}
                      >
                        {l.currentWebsite.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </a>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-flex px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      —
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => navigate(`/leads/${l.id}`)}
                      className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90"
                    >
                      Open Lead
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm flex-wrap gap-3">
            <span className="text-muted-foreground">
              Page {data.page} of {data.totalPages} · {data.total} leads
            </span>
            <Pager
              page={data.page}
              totalPages={data.totalPages}
              onChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Clickable column header (#221). Surfaces the current sort state with
 * an arrow icon so reps can see at a glance which column is driving the
 * order. Inactive columns render a faded double-arrow as the affordance.
 */
function SortableTh({
  label,
  sortKey,
  active,
  dir,
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
}) {
  const isActive = active === sortKey;
  const Icon = !isActive ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className="text-left px-4 py-3">
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        aria-sort={isActive ? (dir === "asc" ? "ascending" : "descending") : "none"}
        className={`inline-flex items-center gap-1.5 uppercase tracking-wider text-xs hover:text-foreground transition-colors ${
          isActive ? "text-foreground font-semibold" : "text-muted-foreground"
        }`}
      >
        {label}
        <Icon className={`w-3 h-3 ${isActive ? "opacity-100" : "opacity-40"}`} />
      </button>
    </th>
  );
}

/**
 * Compact numbered pager: First · Prev · 1 … 4 5 [6] 7 8 … 99 · Next · Last.
 * Renders a sliding window of 5 numbered buttons around the active page so
 * reps with 100+ pages of leads can jump rather than mash Next.
 */
function Pager({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  const windowSize = 5;
  const half = Math.floor(windowSize / 2);
  let start = Math.max(1, page - half);
  const end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);
  const btn =
    "px-3 py-1.5 rounded-md border border-input bg-background hover:bg-muted disabled:opacity-50";
  const numBtn = (n: number) =>
    `min-w-[36px] px-2.5 py-1.5 rounded-md border text-sm ${
      n === page
        ? "border-primary bg-primary text-primary-foreground font-semibold"
        : "border-input bg-background hover:bg-muted"
    }`;
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <button disabled={page <= 1} onClick={() => onChange(1)} className={btn}>
        « First
      </button>
      <button
        disabled={page <= 1}
        onClick={() => onChange(Math.max(1, page - 1))}
        className={btn}
      >
        Prev
      </button>
      {start > 1 && (
        <>
          <button onClick={() => onChange(1)} className={numBtn(1)}>
            1
          </button>
          {start > 2 && <span className="px-1 text-muted-foreground">…</span>}
        </>
      )}
      {pages.map((n) => (
        <button key={n} onClick={() => onChange(n)} className={numBtn(n)}>
          {n}
        </button>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && (
            <span className="px-1 text-muted-foreground">…</span>
          )}
          <button
            onClick={() => onChange(totalPages)}
            className={numBtn(totalPages)}
          >
            {totalPages}
          </button>
        </>
      )}
      <button
        disabled={page >= totalPages}
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        className={btn}
      >
        Next
      </button>
      <button
        disabled={page >= totalPages}
        onClick={() => onChange(totalPages)}
        className={btn}
      >
        Last »
      </button>
    </div>
  );
}
