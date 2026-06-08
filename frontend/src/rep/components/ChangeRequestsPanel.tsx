import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, MessageSquareWarning } from "lucide-react";
import { api } from "@rep/lib/api";

type Props = {
  leadId: number;
  onError?: (err: unknown) => void;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function ChangeRequestsPanel({ leadId, onError }: Props) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["lead-change-requests", leadId],
    queryFn: () => api.listChangeRequests(leadId),
  });
  const resolve = useMutation({
    mutationFn: (id: number) => api.resolveChangeRequest(leadId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-change-requests", leadId] });
    },
    onError,
  });

  const requests = q.data?.requests ?? [];
  if (requests.length === 0) return null;

  const open = requests.filter((r) => r.status !== "resolved");
  const resolved = requests.filter((r) => r.status === "resolved");

  return (
    <section
      data-testid="change-requests-panel"
      className="my-6 rounded-xl border border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/20 p-5 shadow-sm"
    >
      <div className="flex items-center gap-2 mb-3">
        <MessageSquareWarning size={16} className="text-amber-700 dark:text-amber-300" />
        <h2 className="font-serif text-lg text-foreground">
          Change requests from the client
        </h2>
        {open.length > 0 && (
          <span className="ml-1 text-xs font-medium px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
            {open.length} open
          </span>
        )}
      </div>
      <p className="text-xs text-foreground/70 mb-4">
        Submitted by the client from their portal's "Request a change" form.
      </p>

      {open.length > 0 && (
        <ul className="space-y-3 mb-3">
          {open.map((r) => (
            <li
              key={r.id}
              className="rounded-md border border-amber-500/40 bg-card p-3"
            >
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="text-[10px] uppercase tracking-widest text-amber-700 dark:text-amber-300">
                  Open · submitted {timeAgo(r.createdAt)}
                </span>
                <button
                  type="button"
                  onClick={() => resolve.mutate(r.id)}
                  disabled={resolve.isPending}
                  className="text-xs font-medium px-2 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {resolve.isPending ? "Saving…" : "Mark resolved"}
                </button>
              </div>
              <pre className="whitespace-pre-wrap text-sm text-foreground/90 font-sans leading-relaxed">
                {r.body}
              </pre>
            </li>
          ))}
        </ul>
      )}

      {resolved.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none">
            {resolved.length} resolved
          </summary>
          <ul className="mt-2 space-y-2">
            {resolved.map((r) => (
              <li
                key={r.id}
                className="rounded-md border border-border bg-muted/30 p-3"
              >
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                  <CheckCircle2 size={11} className="text-emerald-600" />
                  Resolved {r.resolvedAt ? timeAgo(r.resolvedAt) : ""} ·
                  submitted {timeAgo(r.createdAt)}
                </div>
                <pre className="whitespace-pre-wrap text-xs text-foreground/70 font-sans">
                  {r.body}
                </pre>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
