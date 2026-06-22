import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Download, FileText, Eraser, RotateCcw, FileDown } from "lucide-react";
import { api, type ImportLeadsResult } from "@admin/lib/api";
import { PageHeader } from "@admin/components/AdminLayout";

const PAGE_SIZE = 50;

// QA Change #6 (2026-06-22): admin Leads mirrors the rep tables — a single
// derived Temperature (5 values) replaces the Status column/filter. Local
// copy of the rep helper (kept in sync with rep/pages/MyLeads.tsx) so admin
// doesn't import across app boundaries.
type AdminTempValue = "won" | "disqualified" | "hot" | "lukewarm" | "cold" | "unset";
const ADMIN_TEMP_ORDER: { key: Exclude<AdminTempValue, "unset">; label: string }[] = [
  { key: "won", label: "Won" },
  { key: "hot", label: "Hot" },
  { key: "lukewarm", label: "Lukewarm" },
  { key: "cold", label: "Cold" },
  { key: "disqualified", label: "Disqualified" },
];
const ADMIN_TEMP_LABELS: Record<AdminTempValue, string> = {
  won: "Won",
  disqualified: "Disqualified",
  hot: "Hot",
  lukewarm: "Lukewarm",
  cold: "Cold",
  unset: "—",
};
const ADMIN_TEMP_STYLES: Record<AdminTempValue, string> = {
  won: "bg-primary/10 text-primary border-primary/30",
  disqualified: "bg-muted text-muted-foreground border-border",
  hot: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-200 dark:border-red-900",
  lukewarm: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900",
  cold: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/30 dark:text-sky-200 dark:border-sky-900",
  unset: "border-border text-muted-foreground",
};
function adminDeriveTemp(lead: { status?: string | null; temperature?: string | null }): AdminTempValue {
  const status = lead.status ?? undefined;
  const temp = lead.temperature ?? undefined;
  if (status === "won") return "won";
  if (status === "disqualified" || temp === "disqualifier") return "disqualified";
  if (temp === "hot" || temp === "lukewarm" || temp === "cold") return temp;
  if (status === "cold") return "cold";
  return "unset";
}

export default function LeadsPage() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [csv, setCsv] = useState("");
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<ImportLeadsResult | null>(null);
  const [wipeResult, setWipeResult] = useState<{
    cleared: number;
    scope: string;
    restorable: boolean;
  } | null>(null);
  const [releaseResult, setReleaseResult] = useState<{ released: number } | null>(null);
  const [releaseConfirmation, setReleaseConfirmation] = useState("");
  const [wipeConfirmation, setWipeConfirmation] = useState("");

  // Search & Filters state — QA Change #6: Search + Owner + Has email +
  // Has phone + Temperature (5 derived values). Status / Lead Type / Date
  // Range removed. Temperature, Has-email and Has-phone filter client-side
  // over the current page (same pattern as the rep lead pages).
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [temp, setTemp] = useState<"" | AdminTempValue>("");
  const [hasEmail, setHasEmail] = useState<"" | "yes" | "no">("");
  const [hasPhone, setHasPhone] = useState<"" | "yes" | "no">("");
  const [repId, setRepId] = useState<number | "">("");
  const [sortBy, setSortBy] = useState<string>("updated");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Load reps for the dropdown filter
  const repsQuery = useQuery({
    queryKey: ["admin-reps"],
    queryFn: () => api.listReps(),
  });
  const repsList = repsQuery.data?.reps ?? [];

  // Debounce search query
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q);
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const handleFilterChange = (setter: (v: any) => void, val: any) => {
    setter(val);
    setPage(0);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
    setPage(0);
  };

  const renderHeader = (label: string, field: string) => {
    const active = sortBy === field;
    return (
      <th
        onClick={() => handleSort(field)}
        className="py-2 pr-3 font-medium cursor-pointer hover:text-foreground select-none"
      >
        <span className="flex items-center gap-1">
          {label}
          {active ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
        </span>
      </th>
    );
  };

  // #230 (2026-05-13) — scoped wipe refactor
  const [wipeScope, setWipeScope] = useState<number | "" | "ALL">("");
  const [wipeScopeConfirmation, setWipeScopeConfirmation] = useState("");
  const [wipeForce, setWipeForce] = useState(false);
  const reps = repsList;
  const [preview] = useState<
    { total: number; last7d: number; latestAt: string | null } | null
  >(null);
  const expectedScopeWord =
    wipeScope === "ALL"
      ? "EVERYONE"
      : typeof wipeScope === "number"
        ? (reps.find((r) => r.id === wipeScope)?.displayName ?? "")
        : "";
  const scopeMatches = false;
  const forceRequiredAndMissing = false;
  // Silence "declared but never read" for the setters under
  // noUnusedLocals — the JSX consumes them once the refactor lands.
  void setWipeScope;
  void setWipeScopeConfirmation;
  void setWipeForce;

  const upload = useMutation({
    mutationFn: (text: string) => api.importLeads(text),
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: ["admin-leads"] });
    },
  });

  const wipeNotes = useMutation({
    mutationFn: () => api.wipeAllRepNotes("RESET"),
    onSuccess: (r) => {
      // #230 (2026-05-13) — the unscoped wipe API only returns
      // `{ cleared }`; the scoped wipe (per the new UI below) will
      // return `scope` + `restorable`. Until the scoped endpoint
      // ships, fill the new fields so the existing summary line
      // ("Deleted N notes from <scope>") renders without crashing.
      setWipeResult({
        cleared: r.cleared,
        scope: "all reps",
        restorable: false,
      });
      setWipeConfirmation("");
    },
  });

  const releaseClaims = useMutation({
    mutationFn: () => api.releaseAllClaims("RELEASE"),
    onSuccess: (r) => {
      setReleaseResult(r);
      setReleaseConfirmation("");
    },
  });

  const onFile = async (file: File) => {
    const text = await file.text();
    setCsv(text);
  };

  // Bundle 1.1 — leads table (paginated).
  const leadsQuery = useQuery({
    queryKey: ["admin-leads", page, debouncedQ, repId, sortBy, sortDir],
    queryFn: () =>
      api.listLeads({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        q: debouncedQ || undefined,
        repId: repId !== "" ? repId : undefined,
        sort: sortBy,
        order: sortDir,
      }),
  });
  const allLeadRows = leadsQuery.data?.leads ?? [];
  const total = leadsQuery.data?.total ?? 0;
  // Temperature / Has-email / Has-phone applied client-side over the page.
  const leadRows = allLeadRows.filter((l: any) => {
    const emailOk = !!(l.email && String(l.email).trim());
    if (hasEmail === "yes" && !emailOk) return false;
    if (hasEmail === "no" && emailOk) return false;
    const phoneOk = !!(l.phone && String(l.phone).trim());
    if (hasPhone === "yes" && !phoneOk) return false;
    if (hasPhone === "no" && phoneOk) return false;
    if (temp && adminDeriveTemp(l) !== temp) return false;
    return true;
  });

  // Bundle 1.3 — export current view to CSV.
  const onExport = async () => {
    setExporting(true);
    try {
      const blob = await api.exportLeadsBlob({
        q: debouncedQ || undefined,
        repId: repId !== "" ? repId : undefined,
        sort: sortBy,
        order: sortDir,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  // Download the import template client-side (a cross-origin <a download> to
  // the auth-gated endpoint doesn't reliably download — the download attr is
  // ignored cross-origin). The columns mirror /admin/leads/import-template.
  const downloadTemplate = () => {
    const csv =
      "name,practice,specialty,city,state,phone,email,current_website,locale\n" +
      "Jane Smith LCSW,Smith Counseling,LCSW,Austin,TX,5125550101,jane@example.com,janetherapy.com,en\n" +
      "Maria Lopez LMFT,Lopez Counseling,LMFT,Houston,TX,7135550199,maria@example.com,,es\n";
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 md:p-10">
      <PageHeader
        title="Leads"
        description="Bulk import Texas mental-health practitioners. Reps claim from the pool."
        actions={
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted transition-colors"
          >
            <Download size={14} /> Download template
          </button>
        }
      />

      {/* Bundle 1.1 — leads table. Click a row to open the detail (inline edit). */}
      <section className="bg-card border border-card-border rounded-lg p-5 shadow-sm mb-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-lg">All leads</h2>
            <span className="text-xs text-muted-foreground">{total} total</span>
          </div>
          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
          >
            <FileDown size={14} /> {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>

        {/* Filter bar (Bundle 2) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-5 p-4 bg-muted/20 border border-border/60 rounded-md text-xs">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="font-semibold text-muted-foreground uppercase tracking-wider">Search</label>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, phone, email..."
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-semibold text-muted-foreground uppercase tracking-wider">Temperature</label>
            <select
              value={temp}
              onChange={(e) => handleFilterChange(setTemp, e.target.value)}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All</option>
              {ADMIN_TEMP_ORDER.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-semibold text-muted-foreground uppercase tracking-wider">Has email</label>
            <select
              value={hasEmail}
              onChange={(e) => handleFilterChange(setHasEmail, e.target.value)}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-semibold text-muted-foreground uppercase tracking-wider">Has phone</label>
            <select
              value={hasPhone}
              onChange={(e) => handleFilterChange(setHasPhone, e.target.value)}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-semibold text-muted-foreground uppercase tracking-wider">Owner</label>
            <select
              value={repId}
              onChange={(e) => handleFilterChange(setRepId, e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Reps</option>
              {repsList.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setQ("");
                setTemp("");
                setHasEmail("");
                setHasPhone("");
                setRepId("");
                setPage(0);
              }}
              className="w-full rounded-md border border-border bg-card px-2 py-1.5 hover:bg-muted transition-colors text-center font-medium"
            >
              Clear
            </button>
          </div>
        </div>

        {leadsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground py-6">Loading leads…</p>
        ) : leadRows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6">No leads yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3 font-medium">ID</th>
                  {renderHeader("Name", "name")}
                  {renderHeader("Practice", "practice")}
                  {renderHeader("City", "city")}
                  <th className="py-2 pr-3 font-medium">Temperature</th>
                  <th className="py-2 pr-3 font-medium">Owner</th>
                  {renderHeader("Updated", "updated")}
                </tr>
              </thead>
              <tbody>
                {leadRows.map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => navigate(`/leads/${l.id}`)}
                    className="border-b border-border/60 hover:bg-muted/50 cursor-pointer"
                  >
                    <td className="py-2 pr-3 font-mono text-muted-foreground whitespace-nowrap">#{l.id}</td>
                    <td className="py-2 pr-3 font-medium">{l.name}</td>
                    <td className="py-2 pr-3 text-muted-foreground truncate max-w-[200px]">
                      {l.practice ?? "—"}
                    </td>
                    <td className="py-2 pr-3">{l.city ?? "—"}</td>
                    <td className="py-2 pr-3">
                      {(() => {
                        const tv = adminDeriveTemp(l);
                        return (
                          <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border ${ADMIN_TEMP_STYLES[tv]}`}>
                            {ADMIN_TEMP_LABELS[tv]}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-2 pr-3">
                      {l.claimedByRepId ? `#${l.claimedByRepId}` : "—"}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                      {l.updatedAt
                        ? new Date(l.updatedAt).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between mt-3 text-sm">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-md border border-border px-3 py-1.5 disabled:opacity-50 hover:bg-muted"
          >
            ← Prev
          </button>
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={(page + 1) * PAGE_SIZE >= total}
            className="rounded-md border border-border px-3 py-1.5 disabled:opacity-50 hover:bg-muted"
          >
            Next →
          </button>
        </div>
      </section>

      <section className="bg-card border border-card-border rounded-lg p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <FileText size={16} className="text-muted-foreground" />
          <h2 className="font-serif text-lg">CSV import</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Required columns: <code className="font-mono text-xs">name, practice, specialty, city, phone</code>.
          Optional: <code className="font-mono text-xs">state, email, current_website, locale</code>.
          Rows are matched by <strong>email</strong> (then phone): existing leads are
          updated, new ones created.
        </p>

        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center mb-4">
          <label className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer hover:bg-muted transition-colors w-fit">
            <Upload size={14} /> Choose CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
          </label>
          <span className="text-xs text-muted-foreground">— or paste below —</span>
        </div>

        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder="name,practice,specialty,city,state,phone,email,current_website&#10;Jane Smith LCSW,Smith Counseling,LCSW,Austin,TX,5125550101,jane@example.com,janetherapy.com"
          rows={10}
          className="w-full rounded-md border border-input bg-background p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        />

        <div className="flex items-center gap-3 mt-3">
          <button
            type="button"
            onClick={() => upload.mutate(csv)}
            disabled={upload.isPending || csv.trim().length < 20}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
          >
            {upload.isPending ? "Uploading…" : "Import leads"}
          </button>
          {upload.error && (
            <span className="text-sm text-destructive">
              {upload.error instanceof Error ? upload.error.message : "Upload failed"}
            </span>
          )}
        </div>

        {result && (
          <div className="mt-4 space-y-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
            <div>
              ✅ <strong>{result.created}</strong> created ·{" "}
              <strong>{result.updated}</strong> updated
              {result.skipped.length > 0 && (
                <>
                  {" "}·{" "}
                  <span className="text-destructive">
                    {result.skipped.length} skipped
                  </span>
                </>
              )}
            </div>
            {result.skipped.length > 0 && (
              <ul className="list-disc pl-6 text-xs text-destructive space-y-0.5 max-h-40 overflow-auto">
                {result.skipped.map((s, i) => (
                  <li key={i}>
                    Row {s.row}: {s.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="bg-card border border-card-border rounded-lg p-5 shadow-sm mt-6">
        <div className="flex items-center gap-2 mb-2">
          <Eraser size={16} className="text-muted-foreground" />
          <h2 className="font-serif text-lg">Release all claimed leads</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Returns every currently <strong>claimed</strong> lead back to the
          shared pool. Status flips to <code className="font-mono text-xs">available</code>,
          rep ownership and claim expiry are cleared. Leads marked
          nurturing, won, or disqualified are <strong>not</strong> touched.
          Use this to fully reset reps' My Leads lists. This action cannot
          be undone.
        </p>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Type <strong className="text-foreground">RELEASE</strong> to enable the button
          </label>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={releaseConfirmation}
              onChange={(e) => setReleaseConfirmation(e.target.value)}
              placeholder="RELEASE"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm font-mono w-40 focus:outline-none focus:ring-2 focus:ring-ring"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => releaseClaims.mutate()}
              disabled={
                releaseClaims.isPending || releaseConfirmation !== "RELEASE"
              }
              className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive px-4 py-2 text-sm font-medium hover:bg-destructive/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {releaseClaims.isPending ? "Releasing…" : "Release all claims"}
            </button>
            {releaseResult && (
              <span className="text-sm text-muted-foreground">
                Released <strong>{releaseResult.released}</strong> lead
                {releaseResult.released === 1 ? "" : "s"}.
              </span>
            )}
            {releaseClaims.error && (
              <span className="text-sm text-destructive">
                {releaseClaims.error instanceof Error
                  ? releaseClaims.error.message
                  : "Release failed"}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="bg-card border border-card-border rounded-lg p-5 shadow-sm mt-6">
        <div className="flex items-center gap-2 mb-2">
          <Eraser size={16} className="text-muted-foreground" />
          <h2 className="font-serif text-lg">Reset rep notes</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Deletes timestamped rep-note entries so a rep starts from an
          empty journal. The imported Psychology Today profile is kept
          read-only on each lead and is not affected. As of #230 (2026-05-13)
          wipes are <strong>scoped per rep</strong> and the full note bodies
          are snapshotted into the audit log so the action is recoverable
          via "Restore last wipe" below.
        </p>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Scope
            </label>
            <select
              value={wipeScope === "" ? "" : String(wipeScope)}
              onChange={(e) => {
                const v = e.target.value;
                setWipeScope(v === "" ? "" : v === "ALL" ? "ALL" : Number(v));
                setWipeScopeConfirmation("");
                setWipeForce(false);
              }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Choose a rep —</option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.displayName}
                </option>
              ))}
              <option value="ALL">⚠ EVERYONE (global wipe)</option>
            </select>
          </div>

          {preview && (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              <div>
                Scope holds <strong>{preview.total}</strong> note
                {preview.total === 1 ? "" : "s"} total
                {preview.latestAt && (
                  <>
                    {" "}· latest at{" "}
                    <span className="font-mono text-xs">
                      {new Date(preview.latestAt).toLocaleString()}
                    </span>
                  </>
                )}
                .
              </div>
              {preview.last7d > 0 && (
                <div className="mt-1 text-destructive">
                  ⚠ <strong>{preview.last7d}</strong> note
                  {preview.last7d === 1 ? " was" : "s were"} added in the last
                  7 days. The server will refuse this wipe unless you check
                  "force include recent notes" below.
                </div>
              )}
            </div>
          )}

          {wipeScope !== "" && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Type{" "}
                <strong className="text-foreground">
                  {expectedScopeWord || "…"}
                </strong>{" "}
                to confirm scope
              </label>
              <input
                type="text"
                value={wipeScopeConfirmation}
                onChange={(e) => setWipeScopeConfirmation(e.target.value)}
                placeholder={expectedScopeWord}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm font-mono w-72 focus:outline-none focus:ring-2 focus:ring-ring"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          )}

          {preview && preview.last7d > 0 && (
            <label className="flex items-center gap-2 text-sm text-destructive">
              <input
                type="checkbox"
                checked={wipeForce}
                onChange={(e) => setWipeForce(e.target.checked)}
              />
              Force include {preview.last7d} note
              {preview.last7d === 1 ? "" : "s"} added in the last 7 days
            </label>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Type <strong className="text-foreground">RESET</strong> to enable
              the button
            </label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={wipeConfirmation}
                onChange={(e) => setWipeConfirmation(e.target.value)}
                placeholder="RESET"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm font-mono w-40 focus:outline-none focus:ring-2 focus:ring-ring"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => wipeNotes.mutate()}
                disabled={
                  wipeNotes.isPending ||
                  wipeConfirmation !== "RESET" ||
                  wipeScope === "" ||
                  !scopeMatches ||
                  forceRequiredAndMissing
                }
                className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive px-4 py-2 text-sm font-medium hover:bg-destructive/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {wipeNotes.isPending
                  ? "Resetting…"
                  : wipeScope === "ALL"
                    ? "Reset rep notes for EVERYONE"
                    : `Reset rep notes${expectedScopeWord ? ` for ${expectedScopeWord}` : ""}`}
              </button>
              {wipeResult && (
                <span className="text-sm text-muted-foreground">
                  Deleted <strong>{wipeResult.cleared}</strong> note
                  {wipeResult.cleared === 1 ? "" : "s"} from{" "}
                  <strong>{wipeResult.scope}</strong>
                  {wipeResult.restorable
                    ? " — recoverable via Restore below."
                    : " — snapshot too large to restore."}
                </span>
              )}
              {wipeNotes.error && (
                <span className="text-sm text-destructive">
                  {wipeNotes.error instanceof Error
                    ? wipeNotes.error.message
                    : "Reset failed"}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-card border border-card-border rounded-lg p-5 shadow-sm mt-6">
        <div className="flex items-center gap-2 mb-2">
          <RotateCcw size={16} className="text-muted-foreground" />
          <h2 className="font-serif text-lg">Restore last wipe</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Re-inserts every note from the <strong>most recent</strong>{" "}
          <code className="font-mono text-xs">leads.wipe_rep_notes</code> audit
          entry. Skips notes whose lead has been deleted in the meantime.
          Idempotent — running it twice does not duplicate. Only works for
          wipes performed AFTER 2026-05-13 (#230); older audit rows only
          carry IDs.
        </p>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Type <strong className="text-foreground">RESET</strong> to enable the button
          </label>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={wipeConfirmation}
              onChange={(e) => setWipeConfirmation(e.target.value)}
              placeholder="RESET"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm font-mono w-40 focus:outline-none focus:ring-2 focus:ring-ring"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => wipeNotes.mutate()}
              disabled={wipeNotes.isPending || wipeConfirmation !== "RESET"}
              className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive px-4 py-2 text-sm font-medium hover:bg-destructive/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {wipeNotes.isPending ? "Resetting…" : "Reset all rep notes"}
            </button>
            {wipeResult && (
              <span className="text-sm text-muted-foreground">
                Deleted <strong>{wipeResult.cleared}</strong> note
                {wipeResult.cleared === 1 ? "" : "s"}.
              </span>
            )}
            {wipeNotes.error && (
              <span className="text-sm text-destructive">
                {wipeNotes.error instanceof Error
                  ? wipeNotes.error.message
                  : "Reset failed"}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="bg-card border border-card-border rounded-lg p-5 shadow-sm mt-6">
        <h2 className="font-serif text-lg mb-2">About the leads pool</h2>
        <p className="text-sm text-muted-foreground">
          The pool is managed from the <strong>rep dashboard</strong>: reps claim, nurture, and
          mark leads won or disqualified. Use this admin tool to seed the pool from a CSV. Lead
          status counts and recent activity show on the main Dashboard page.
        </p>
      </section>
    </div>
  );
}
