import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Bell, Check } from "lucide-react";
import { api, fmtDateTime } from "@rep/lib/api";
import { PageHeader } from "@rep/components/RepLayout";

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications", "all"],
    queryFn: () => api.notifications(false),
  });
  const markRead = useMutation({
    mutationFn: (id: number) => api.markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markAll = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <div className="px-4 md:px-8 py-8 md:py-10 max-w-4xl">
      <PageHeader
        title="Notifications"
        description="Lead replies, expirations, and system alerts."
        actions={
          <button
            type="button"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60"
          >
            Mark all read
          </button>
        }
      />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (data?.notifications.length ?? 0) === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-10 text-center text-muted-foreground">
          You're all caught up.
        </div>
      ) : (
        <ul className="bg-card border border-card-border rounded-xl shadow-sm divide-y divide-border overflow-hidden">
          {data?.notifications.map((n) => (
            <li
              key={n.id}
              className={`px-5 py-4 flex items-start gap-3 ${
                n.readAt ? "" : "bg-accent/5"
              }`}
            >
              <Bell
                size={16}
                className={`shrink-0 mt-0.5 ${
                  n.readAt ? "text-muted-foreground" : "text-accent"
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{n.title}</div>
                {n.body && (
                  <div className="text-sm text-foreground/80 mt-0.5 whitespace-pre-wrap">
                    {n.body}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  {fmtDateTime(n.createdAt)}
                  {n.leadId && (
                    <>
                      {" · "}
                      <Link
                        href={`/leads/${n.leadId}`}
                        className="text-accent hover:underline"
                      >
                        Open lead #{n.leadId}
                      </Link>
                    </>
                  )}
                </div>
              </div>
              {!n.readAt && (
                <button
                  type="button"
                  onClick={() => markRead.mutate(n.id)}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <Check size={12} /> Mark read
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
