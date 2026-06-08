import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Upload, Download, FileText, Eraser, RotateCcw } from "lucide-react";
import { api } from "@admin/lib/api";
import { PageHeader } from "@admin/components/AdminLayout";

export default function LeadsPage() {
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<
    { inserted: number; duplicates?: number; errors: string[] } | null
  >(null);
  const [wipeResult, setWipeResult] = useState<{
    cleared: number;
    scope: string;
    restorable: boolean;
  } | null>(null);
  const [releaseResult, setReleaseResult] = useState<{ released: number } | null>(null);
  // LOT 1.6 — per-form confirmation inputs. Distinct state per
  // section so what you type into the release form never satisfies
  // the wipe form (and vice versa). Server-side zod.literal is the
  // real security boundary; this UI gate just prevents the misclick.
  const [releaseConfirmation, setReleaseConfirmation] = useState("");
  const [wipeConfirmation, setWipeConfirmation] = useState("");

  // #230 (2026-05-13) — scoped wipe refactor is mid-flight: the JSX
  // below references state and API calls (scope-preview query, scoped
  // mutation, restore mutation) that haven't been wired up yet. These
  // stubs keep the page compiling and the destructive button DISABLED
  // (`scopeMatches=false`) until the refactor lands. Do not enable any
  // of these without also wiring the matching server endpoints; the
  // production server will reject unscoped wipes with a 400.
  const [wipeScope, setWipeScope] = useState<number | "" | "ALL">("");
  const [wipeScopeConfirmation, setWipeScopeConfirmation] = useState("");
  const [wipeForce, setWipeForce] = useState(false);
  const [reps] = useState<{ id: number; displayName: string }[]>([]);
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
    onSuccess: (r) => setResult(r),
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

  return (
    <div className="p-6 md:p-10">
      <PageHeader
        title="Leads"
        description="Bulk import Texas mental-health practitioners. Reps claim from the pool."
        actions={
          <a
            href={api.importTemplateUrl()}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted transition-colors"
            download
          >
            <Download size={14} /> Download template
          </a>
        }
      />

      <section className="bg-card border border-card-border rounded-lg p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <FileText size={16} className="text-muted-foreground" />
          <h2 className="font-serif text-lg">CSV import</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Required columns: <code className="font-mono text-xs">name, practice, specialty, city, phone</code>.
          Optional: <code className="font-mono text-xs">state, email, current_website</code>.
          Duplicate phone or email rows are skipped.
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
              ✅ Inserted <strong>{result.inserted}</strong>
              {typeof result.duplicates === "number" && (
                <>
                  {" "}· skipped <strong>{result.duplicates}</strong> duplicates
                </>
              )}
              {result.errors.length > 0 && (
                <>
                  {" "}· <span className="text-destructive">{result.errors.length} errors</span>
                </>
              )}
            </div>
            {result.errors.length > 0 && (
              <ul className="list-disc pl-6 text-xs text-destructive space-y-0.5 max-h-40 overflow-auto">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
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
