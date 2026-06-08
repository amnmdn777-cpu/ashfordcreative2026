import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, fmtDateTime, type AuditEntry } from "@admin/lib/api";
import { PageHeader } from "@admin/components/AdminLayout";

interface RepSummary {
  repId: number;
  displayName: string;
  username: string;
  last24h: number;
  last7d: number;
  leadsViewed: Set<string>;
  lastSeenAt: string;
  otherActionsCount: number;
}

function summarizeByRep(entries: AuditEntry[]): RepSummary[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const byRep = new Map<number, RepSummary>();

  for (const e of entries) {
    const actor = e.actor;
    if (!actor) continue;
    let s = byRep.get(actor.id);
    if (!s) {
      s = {
        repId: actor.id,
        displayName: actor.displayName,
        username: actor.username,
        last24h: 0,
        last7d: 0,
        leadsViewed: new Set<string>(),
        lastSeenAt: e.occurredAt,
        otherActionsCount: 0,
      };
      byRep.set(actor.id, s);
    }
    const age = now - new Date(e.occurredAt).getTime();
    if (age <= dayMs) s.last24h++;
    if (age <= 7 * dayMs) s.last7d++;
    if (e.action === "lead.read" && e.targetId) {
      s.leadsViewed.add(String(e.targetId));
    } else {
      s.otherActionsCount++;
    }
    if (new Date(e.occurredAt).getTime() > new Date(s.lastSeenAt).getTime()) {
      s.lastSeenAt = e.occurredAt;
    }
  }
  return Array.from(byRep.values()).sort((a, b) => b.last7d - a.last7d);
}

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

function sentenceFor(s: RepSummary): string {
  if (s.last7d === 0) return "No activity in the last 7 days.";
  const parts: string[] = [];
  const leads = s.leadsViewed.size;
  if (leads > 0) {
    parts.push(`opened ${leads} lead${leads === 1 ? "" : "s"}`);
  }
  if (s.otherActionsCount > 0) {
    parts.push(
      `${s.otherActionsCount} other action${s.otherActionsCount === 1 ? "" : "s"}`,
    );
  }
  const what = parts.length > 0 ? parts.join(", ") : `${s.last7d} actions`;
  return `${what} in the last 7 days. Last seen ${timeAgo(s.lastSeenAt)}.`;
}

export default function AuditPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: () => api.listAudit(),
  });

  const summary = useMemo(
    () => (data ? summarizeByRep(data.entries) : []),
    [data],
  );

  return (
    <div className="p-6 md:p-10">
      <PageHeader
        title="Audit log"
        description="Recent admin actions across the system. Most recent 200 entries."
      />

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {error && (
        <div className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load"}
        </div>
      )}

      {summary.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg shadow-sm p-5 mb-6">
          <h2 className="font-serif text-lg mb-1">Who's been working</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Plain-language summary of rep activity from the entries below.
          </p>
          <ul className="space-y-3">
            {summary.map((s) => (
              <li
                key={s.repId}
                className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3 border-l-2 border-primary/30 pl-3"
              >
                <div className="font-medium text-sm whitespace-nowrap">
                  {s.displayName}{" "}
                  <span className="text-xs text-muted-foreground">
                    @{s.username}
                  </span>
                </div>
                <div className="text-sm text-foreground/80">
                  {sentenceFor(s)}
                </div>
                <div className="text-xs text-muted-foreground sm:ml-auto whitespace-nowrap">
                  {s.last24h} in 24h · {s.last7d} in 7d
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data && data.entries.length === 0 && (
        <div className="bg-card border border-card-border rounded-lg p-6 text-sm text-muted-foreground shadow-sm">
          No audit entries yet. Actions taken via the admin tools will appear here as they're
          recorded.
        </div>
      )}

      {data && data.entries.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
              <tr className="text-left">
                <th className="py-2.5 px-4">When</th>
                <th className="py-2.5 px-4">Actor</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Target</th>
                <th className="py-2.5 px-4">Before / After</th>
                <th className="py-2.5 px-4">Request</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.entries.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="py-2.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
                    {fmtDateTime(e.occurredAt)}
                  </td>
                  <td className="py-2.5 px-4">
                    {e.actor ? (
                      <>
                        <div className="font-medium">{e.actor.displayName}</div>
                        <div className="text-xs text-muted-foreground">@{e.actor.username}</div>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">system</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-xs">
                    {e.actorRole ?? "—"}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs">{e.action}</td>
                  <td className="py-2.5 px-4 font-mono text-xs text-muted-foreground">
                    {/* React renders these as text nodes via JSX — no
                     *  dangerouslySetInnerHTML, so the target_id slug
                     *  field is XSS-safe by construction. */}
                    {e.targetType ?? "—"}
                    {e.targetId ? ` #${e.targetId}` : ""}
                  </td>
                  <td className="py-2.5 px-4">
                    {e.before || e.after ? (
                      <pre className="text-[11px] font-mono bg-muted/40 rounded p-2 max-w-xs whitespace-pre-wrap overflow-auto max-h-32">
                        {JSON.stringify({ before: e.before, after: e.after }, null, 2)}
                      </pre>
                    ) : e.diff ? (
                      <pre className="text-[11px] font-mono bg-muted/40 rounded p-2 max-w-xs whitespace-pre-wrap overflow-auto max-h-32">
                        {JSON.stringify(e.diff, null, 2)}
                      </pre>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-[11px] text-muted-foreground">
                    {e.ip ?? "—"}
                    {e.userAgent ? (
                      <div className="truncate max-w-[180px]" title={e.userAgent}>
                        {e.userAgent}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
