import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Phone, FileText, RefreshCw } from "lucide-react";
import { api, fmtDateTime } from "@admin/lib/api";
import { PageHeader } from "@admin/components/AdminLayout";

export default function TranscriptsPage() {
  const qc = useQueryClient();
  const [lastRun, setLastRun] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "transcripts", "leads"],
    queryFn: () => api.listLeadsWithCalls(),
    refetchInterval: 60_000,
  });

  const backfill = useMutation({
    mutationFn: () => api.backfillCalls(30),
    onSuccess: (r) => {
      setLastRun(
        `Synced ${r.fetched} call${r.fetched === 1 ? "" : "s"} from DialPad — ${
          r.upserted
        } saved, ${r.withTranscript} with transcript, ${r.withSummary} with summary.${
          r.errors > 0 ? ` ${r.errors} error${r.errors === 1 ? "" : "s"}.` : ""
        }`,
      );
      qc.invalidateQueries({ queryKey: ["admin", "transcripts"] });
    },
    onError: (err) => {
      setLastRun(
        `Sync failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    },
  });

  return (
    <div className="p-6 md:p-10">
      <PageHeader
        title="Transcripts"
        description="Every lead that's been on a call. Click one to see the recordings, transcripts, and summaries."
        actions={
          <button
            type="button"
            onClick={() => backfill.mutate()}
            disabled={backfill.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="transcripts-refresh"
          >
            <RefreshCw
              size={14}
              className={backfill.isPending ? "animate-spin" : ""}
            />
            {backfill.isPending ? "Syncing…" : "Refresh from DialPad"}
          </button>
        }
      />

      {lastRun && (
        <div
          className="mb-4 rounded border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
          data-testid="transcripts-last-run"
        >
          {lastRun}
        </div>
      )}

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {error && (
        <div className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load"}
        </div>
      )}

      {data && data.leads.length === 0 && !isLoading && (
        <div className="rounded border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No calls have been recorded yet. Click <strong>Refresh from DialPad</strong> to
          pull the last 30 days of calls.
        </div>
      )}

      <div className="space-y-2">
        {data?.leads.map((row) => (
          <Link
            key={row.leadId}
            href={`/transcripts/${row.leadId}`}
            className="block bg-card border border-card-border rounded-lg p-4 shadow-sm hover:bg-muted/40 transition-colors"
            data-testid={`transcripts-lead-${row.leadId}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">
                  {row.leadName ?? `Lead #${row.leadId}`}
                </div>
                {row.practice && (
                  <div className="text-sm text-muted-foreground truncate">
                    {row.practice}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  Last call {fmtDateTime(row.lastCallAt)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Phone size={12} /> {row.callCount} call
                  {row.callCount === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <FileText size={12} /> {row.transcriptCount} transcript
                  {row.transcriptCount === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
