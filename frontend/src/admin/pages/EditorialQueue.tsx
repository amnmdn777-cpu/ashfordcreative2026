/**
 * [CLEANUP D.3] Editorial Queue — "Articles to write today".
 *
 * Lists pending article_schedule rows whose due_date has arrived. The
 * editor opens one and writes the article by hand.
 */
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { request } from "@admin/lib/api";
import { PageHeader } from "@admin/components/AdminLayout";

type DueRow = {
  id: number;
  leadId: number;
  dueDate: string;
  topicHint: string | null;
  status: "pending" | "written" | "skipped";
  notes: string | null;
  leadName: string;
  practice: string | null;
  specialty: string;
  city: string;
};

export default function EditorialQueuePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "editorial", "due"],
    queryFn: () => request<{ items: DueRow[] }>("/admin/editorial/due"),
    refetchInterval: 60_000,
  });

  const items = data?.items ?? [];

  return (
    <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto">
      <PageHeader
        title="Editorial Queue"
        description="Articles to write today. One reminder per scheduled slot — open the draft and type the piece by hand."
      />

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      {error && (
        <p className="text-sm text-destructive">
          Failed to load queue: {(error as Error).message}
        </p>
      )}

      {!isLoading && items.length === 0 && (
        <div className="bg-card border border-card-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          Nothing due today. The next scheduled article will appear here
          when its due date arrives.
        </div>
      )}

      <ul className="space-y-3">
        {items.map((row) => (
          <li
            key={row.id}
            className="bg-card border border-card-border rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
          >
            <div className="min-w-0">
              <div className="font-serif text-lg text-foreground truncate">
                {row.leadName}
              </div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mt-0.5">
                {row.specialty} · {row.city}
                {row.practice ? ` · ${row.practice}` : ""}
              </div>
              <div className="text-sm text-foreground/80 mt-2">
                <span className="text-muted-foreground">Topic:</span>{" "}
                {row.topicHint || "—"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Due {row.dueDate}
              </div>
            </div>
            <Link
              href={`/editorial/${row.id}/edit`}
              className="shrink-0 inline-flex items-center justify-center px-4 py-2 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90"
            >
              Open draft
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
