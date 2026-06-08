import { useQuery } from "@tanstack/react-query";
import { Mail, Phone, MessageCircle } from "lucide-react";
import { api, fmtDateTime } from "@admin/lib/api";
import { PageHeader } from "@admin/components/AdminLayout";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-amber-100 text-amber-900",
  claimed: "bg-blue-100 text-blue-900",
  converted: "bg-emerald-100 text-emerald-900",
  closed: "bg-zinc-100 text-zinc-700",
};

const PREFERRED_ICON = {
  callback: Phone,
  sms: MessageCircle,
  email: Mail,
} as const;

export default function ContactRequestsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "contactRequests"],
    queryFn: () => api.contactRequests(),
    refetchInterval: 30_000,
  });

  return (
    <div className="p-6 md:p-10">
      <PageHeader
        title="Contact requests"
        description="Inbound requests from the public site (chatbot, contact form). Reps work them from their dashboard."
      />

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {error && (
        <div className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load"}
        </div>
      )}

      <div className="space-y-3">
        {data?.contactRequests.map((c) => {
          const Icon = PREFERRED_ICON[c.preferredContact] ?? Phone;
          return (
            <div
              key={c.id}
              className="bg-card border border-card-border rounded-lg p-4 shadow-sm flex flex-col md:flex-row md:items-start md:justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-medium">{c.name}</span>
                  {c.practice && (
                    <span className="text-sm text-muted-foreground">· {c.practice}</span>
                  )}
                  <span
                    className={`text-xs rounded-full px-2 py-0.5 ${
                      STATUS_COLORS[c.status] ?? "bg-muted"
                    }`}
                  >
                    {c.status}
                  </span>
                  <span className="text-xs text-muted-foreground">· source: {c.source}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-1">
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="hover:underline">
                      {c.email}
                    </a>
                  )}
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="hover:underline">
                      {c.phone}
                    </a>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Icon size={12} /> prefers {c.preferredContact}
                  </span>
                  {c.bestTimeToReach && (
                    <span>· best: {c.bestTimeToReach}</span>
                  )}
                </div>
                {c.message && (
                  <p className="text-sm bg-muted/40 rounded p-2 mt-2 whitespace-pre-wrap">
                    {c.message}
                  </p>
                )}
                {c.internalNote && (
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    Internal: {c.internalNote}
                  </p>
                )}
              </div>
              <div className="text-xs text-muted-foreground shrink-0">
                {fmtDateTime(c.createdAt)}
              </div>
            </div>
          );
        })}
        {data && data.contactRequests.length === 0 && (
          <div className="text-sm text-muted-foreground">No contact requests yet.</div>
        )}
      </div>
    </div>
  );
}
