import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Phone } from "lucide-react";
import { api, fmtDate } from "@rep/lib/api";
import { PageHeader } from "@rep/components/RepLayout";

// QA Change #1 (2026-06-22): the "Status" concept (Work in Progress /
// Cold / Won / Disqualified) is retired. Leads now carry a single
// Temperature classification with five values. We DERIVE it from the
// legacy status + temperature columns so no DB migration is required:
// workflow-final states (won / disqualified) win, then the rep's
// temperature read, then "unset".
export type TempValue = "won" | "disqualified" | "new" | "hot" | "lukewarm" | "cold" | "unset";

export const TEMP_ORDER: { key: Exclude<TempValue, "unset">; label: string }[] = [
  { key: "won", label: "Won" },
  { key: "new", label: "New" },
  { key: "hot", label: "Hot" },
  { key: "lukewarm", label: "Lukewarm" },
  { key: "cold", label: "Cold" },
  { key: "disqualified", label: "Disqualified" },
];

export const TEMP_LABELS: Record<TempValue, string> = {
  won: "Won",
  new: "New",
  disqualified: "Disqualified",
  hot: "Hot",
  lukewarm: "Lukewarm",
  cold: "Cold",
  unset: "—",
};

export const TEMP_STYLES: Record<TempValue, string> = {
  won: "bg-primary/10 text-primary border-primary/30",
  new: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-900",
  disqualified: "bg-muted text-muted-foreground border-border",
  hot: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-200 dark:border-red-900",
  lukewarm: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900",
  cold: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/30 dark:text-sky-200 dark:border-sky-900",
  unset: "border-border text-muted-foreground",
};

export function deriveTemperature(lead: {
  status?: string | null;
  temperature?: string | null;
}): TempValue {
  const status = lead.status ?? undefined;
  const temp = lead.temperature ?? undefined;
  if (status === "won") return "won";
  if (status === "disqualified" || temp === "disqualifier") return "disqualified";
  if (temp === "new") return "new";
  if (temp === "hot" || temp === "lukewarm" || temp === "cold") return temp;
  if (status === "cold") return "cold";
  return "unset";
}

// Normalize US phone formatting at render so the table isn't a mix of raw
// import formats (mirrors AvailableLeads.formatPhoneCell).
function formatPhoneCell(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const ten =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length !== 10) return raw;
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

export default function MyLeadsPage() {
  // Typo-tolerant search box (server-side trigram match — see
  // services/leads.ts `getRepLeads`). Lets a rep type "Dolores" and find
  // "Delores Hendrix-Giles" in their own claimed pool.
  const [name, setName] = useState("");
  // QA Change #2 (2026-06-22): filter bar is Name / City / Specialty +
  // Has email / Has phone / Temperature. The old QC / Website / date-range
  // filters and the status tabs are removed.
  const [city, setCity] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [hasEmail, setHasEmail] = useState<"" | "yes" | "no">("");
  const [hasPhone, setHasPhone] = useState<"" | "yes" | "no">("");
  const [temp, setTemp] = useState<"" | TempValue>("");
  // One unified table over every lead the rep owns (no status tabs).
  const { data, isLoading } = useQuery({
    queryKey: ["leads", "mine", "all", name],
    queryFn: () => api.myLeads("all", name || undefined),
    // EB#2 (2026-06-23): always refetch when the rep returns to the list so
    // "Last activity" reflects notes/emails/calls just logged on a lead,
    // without needing a full page reload.
    refetchOnMount: "always",
  });
  const filteredData = (data?.leads ?? []).filter((lead: any) => {
    if (city.trim() && !(lead.city ?? "").toLowerCase().includes(city.trim().toLowerCase())) return false;
    if (specialty.trim() && !(lead.specialty ?? "").toLowerCase().includes(specialty.trim().toLowerCase())) return false;
    const emailOk = !!(lead.email && String(lead.email).trim());
    if (hasEmail === "yes" && !emailOk) return false;
    if (hasEmail === "no" && emailOk) return false;
    const phoneOk = !!(lead.phone && String(lead.phone).trim());
    if (hasPhone === "yes" && !phoneOk) return false;
    if (hasPhone === "no" && phoneOk) return false;
    if (temp && deriveTemperature(lead) !== temp) return false;
    return true;
  });

  // FR#3 (2026-06-23): clickable column sorting, persisted in localStorage.
  // Default = most-recent activity first (what Candice asked for).
  type SortKey = "id" | "name" | "practice" | "specialty" | "city" | "temperature" | "lastActivityAt";
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>(() => {
    try {
      const raw = localStorage.getItem("myLeadsSort");
      if (raw) return JSON.parse(raw) as { key: SortKey; dir: "asc" | "desc" };
    } catch { /* ignore */ }
    return { key: "lastActivityAt", dir: "desc" };
  });
  const toggleSort = (key: SortKey) => {
    setSort((s) => {
      const next: { key: SortKey; dir: "asc" | "desc" } =
        s.key === key
          ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
          : { key, dir: key === "lastActivityAt" ? "desc" : "asc" };
      try { localStorage.setItem("myLeadsSort", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const TEMP_RANK: Record<string, number> = { won: 5, hot: 4, new: 3.5, lukewarm: 3, cold: 2, disqualified: 1, unset: 0 };
  const sortedData = [...filteredData].sort((a: any, b: any) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    let av: number | string;
    let bv: number | string;
    switch (sort.key) {
      case "id": av = a.id; bv = b.id; break;
      case "temperature": av = TEMP_RANK[deriveTemperature(a)] ?? 0; bv = TEMP_RANK[deriveTemperature(b)] ?? 0; break;
      case "lastActivityAt":
        av = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
        bv = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
        break;
      default:
        av = (a[sort.key] ?? "").toString().toLowerCase();
        bv = (b[sort.key] ?? "").toString().toLowerCase();
    }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
  const SortTh = ({ label, k }: { label: string; k: SortKey }) => (
    <th
      onClick={() => toggleSort(k)}
      className="text-left px-4 py-3 cursor-pointer select-none hover:text-foreground"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sort.key === k ? (sort.dir === "asc" ? "▲" : "▼") : ""}
      </span>
    </th>
  );

  return (
    <div className="px-4 md:px-8 py-8 md:py-10 w-full">
      <PageHeader
        title="My leads"
        description="Every lead you've opened, in one list. Filter by temperature."
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
          <span className="text-xs text-muted-foreground">Has email</span>
          <select value={hasEmail} onChange={(e) => setHasEmail(e.target.value as "" | "yes" | "no")} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        <label className="block min-w-[140px]">
          <span className="text-xs text-muted-foreground">Has phone</span>
          <select value={hasPhone} onChange={(e) => setHasPhone(e.target.value as "" | "yes" | "no")} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        <label className="block min-w-[150px]">
          <span className="text-xs text-muted-foreground">Temperature</span>
          <select value={temp} onChange={(e) => setTemp(e.target.value as "" | TempValue)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">All</option>
            {TEMP_ORDER.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </label>
        {(city || specialty || hasEmail || hasPhone || temp) && (
          <button type="button" onClick={() => { setCity(""); setSpecialty(""); setHasEmail(""); setHasPhone(""); setTemp(""); }} className="text-xs text-muted-foreground hover:text-foreground underline">Clear filters</button>
        )}
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <SortTh label="ID" k="id" />
                <SortTh label="Name" k="name" />
                <SortTh label="Practice" k="practice" />
                <SortTh label="Specialty" k="specialty" />
                <SortTh label="City" k="city" />
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-left px-4 py-3">Email</th>
                <SortTh label="Temperature" k="temperature" />
                <SortTh label="Last activity" k="lastActivityAt" />
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
              {data && filteredData.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No leads in this view.
                  </td>
                </tr>
              )}
              {sortedData.map((l: any) => (
                <tr key={l.id} className="hover:bg-muted/30">
                  {/* QA Change #3 (2026-06-22): show the lead number (ID)
                      instead of the score/scoring badge. */}
                  <td className="px-4 py-3 whitespace-nowrap font-mono text-muted-foreground">
                    #{l.id}
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
                    {l.specialty}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {l.city}, {l.state}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatPhoneCell(l.phone)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                    {l.email ?? ""}
                  </td>
                  <td className="px-4 py-3">
                    <div className="inline-flex flex-wrap items-center gap-1.5">
                      {(() => {
                        const tv = deriveTemperature(l);
                        return (
                          <span
                            className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border ${TEMP_STYLES[tv]}`}
                          >
                            {TEMP_LABELS[tv]}
                          </span>
                        );
                      })()}
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
