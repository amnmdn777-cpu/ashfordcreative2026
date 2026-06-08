import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { ChevronLeft } from "lucide-react";
import { api } from "@admin/lib/api";
import { PageHeader } from "@admin/components/AdminLayout";
import { CallTimelineList } from "@admin/components/CallTimelineEntries";

export default function TranscriptDetailPage() {
  const [, params] = useRoute<{ leadId: string }>("/transcripts/:leadId");
  const leadId = params ? Number(params.leadId) : NaN;

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "transcripts", "lead", leadId],
    queryFn: () => api.leadTimeline(leadId),
    enabled: Number.isFinite(leadId),
    refetchInterval: 60_000,
  });

  const lead = data?.lead;
  const calls = data?.calls ?? [];

  return (
    <div className="p-6 md:p-10">
      <Link
        href="/transcripts"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft size={14} /> All transcripts
      </Link>

      <PageHeader
        title={lead?.name ?? (isLoading ? "Loading…" : `Lead #${leadId}`)}
        description={lead?.practice ?? undefined}
      />

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {error && (
        <div className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load"}
        </div>
      )}

      {data && <CallTimelineList calls={calls} />}
    </div>
  );
}
