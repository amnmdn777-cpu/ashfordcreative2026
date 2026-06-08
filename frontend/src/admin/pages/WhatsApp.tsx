import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { MessageCircle, ExternalLink, Search } from "lucide-react";
import { api, fmtDateTime } from "@admin/lib/api";
import { PageHeader } from "@admin/components/AdminLayout";

/**
 * Admin → WhatsApp tab. Read-only log of every click on the site's
 * floating "Chat on WhatsApp" pill (which hands the visitor off to
 * Candice's personal WhatsApp via wa.me/<digits>).
 *
 * What we CAN show:
 *   - When, from which template + page, what locale
 *   - Joined lead (when the click came from an authenticated portal)
 *   - Per-template breakdown over the selected window
 *
 * What we CANNOT show (and intentionally don't try to):
 *   - The actual messages exchanged with Candice
 *   - Whether Candice replied / converted / lost the lead
 * The founder explicitly asked for the click-tracking version only —
 * filling those gaps would require the WhatsApp Business API on a
 * dedicated number, which they've declined.
 */

const DAY_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "60 days", value: 60 },
  { label: "180 days", value: 180 },
];

export default function WhatsAppPage() {
  const [days, setDays] = useState(30);
  const [template, setTemplate] = useState<string>("");
  const [search, setSearch] = useState("");

  const { data: summary } = useQuery({
    queryKey: ["admin", "whatsappSummary", days],
    queryFn: () => api.whatsappSummary(days),
    refetchInterval: 60_000,
  });

  const { data: clicksData, isLoading } = useQuery({
    queryKey: ["admin", "whatsappClicks", days, template, search],
    queryFn: () =>
      api.whatsappClicks({
        days,
        template: template || undefined,
        search: search || undefined,
      }),
    refetchInterval: 30_000,
  });

  const clicks = clicksData?.clicks ?? [];

  return (
    <div className="p-6 md:p-10">
      <PageHeader
        title="WhatsApp"
        description="Visitors who clicked the floating WhatsApp pill on the site. Conversations themselves happen on Candice's phone — we only log the click."
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            Window
          </div>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-transparent border border-input rounded px-2 py-1 text-sm w-full"
          >
            {DAY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            Total clicks
          </div>
          <div className="text-2xl font-serif">{summary?.clicks ?? "—"}</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            Unique visitors
          </div>
          <div className="text-2xl font-serif">
            {summary?.uniqueSessions ?? "—"}
          </div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            Top template
          </div>
          <div className="text-sm font-medium truncate">
            {summary?.byTemplate[0]
              ? `${summary.byTemplate[0].templateKey} (${summary.byTemplate[0].clicks})`
              : "—"}
          </div>
        </div>
      </div>

      {/* Per-template breakdown */}
      {summary && summary.byTemplate.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg p-4 mb-6">
          <div className="text-sm font-medium mb-3">By template</div>
          <div className="flex flex-wrap gap-2">
            {summary.byTemplate.map((t) => (
              <button
                key={t.templateKey}
                type="button"
                onClick={() =>
                  setTemplate(template === t.templateKey ? "" : t.templateKey)
                }
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  template === t.templateKey
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-input hover:bg-muted"
                }`}
              >
                {t.templateKey} · {t.clicks}
              </button>
            ))}
            {template && (
              <button
                type="button"
                onClick={() => setTemplate("")}
                className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-muted/80"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search page path…"
          className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-input rounded-md"
        />
      </div>

      {/* Click log */}
      {isLoading && (
        <div className="text-sm text-muted-foreground">Loading…</div>
      )}
      {!isLoading && clicks.length === 0 && (
        <div className="bg-card border border-card-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No WhatsApp clicks in this window yet.
        </div>
      )}

      <div className="space-y-2">
        {clicks.map((c) => (
          <div
            key={c.id}
            className="bg-card border border-card-border rounded-lg p-3 md:p-4 flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-sm"
          >
            <div className="md:w-44 shrink-0 text-xs text-muted-foreground">
              {fmtDateTime(c.clickedAt)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                {c.templateKey && (
                  <span className="text-[10px] uppercase tracking-wider bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded">
                    {c.templateKey}
                  </span>
                )}
                {c.locale && (
                  <span className="text-[10px] uppercase tracking-wider bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded">
                    {c.locale}
                  </span>
                )}
                {c.leadId && (
                  <Link
                    href={`/leads/${c.leadId}`}
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {c.leadName ?? `Lead #${c.leadId}`}
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
              <div className="font-mono text-xs truncate text-foreground/80">
                {c.pagePath ?? "(no path)"}
              </div>
              {c.referrer && (
                <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                  from {c.referrer}
                </div>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground md:w-32 truncate">
              {c.ipAddress ?? ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
