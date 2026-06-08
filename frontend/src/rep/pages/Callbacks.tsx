import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { CalendarClock } from "lucide-react";
import { api, fmtDateTime } from "@rep/lib/api";
import type { CallbackDto } from "@workspace/api-zod";
import { PageHeader } from "@rep/components/RepLayout";

function bucket(c: CallbackDto): "today" | "week" | "later" {
  const d = new Date(c.scheduledFor);
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  if (d >= startOfToday && d < endOfToday) return "today";
  if (d < endOfWeek) return "week";
  return "later";
}

export default function CallbacksPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["callbacks"],
    queryFn: api.listCallbacks,
  });

  const grouped = useMemo(() => {
    const t: CallbackDto[] = [];
    const w: CallbackDto[] = [];
    const l: CallbackDto[] = [];
    (data?.callbacks ?? [])
      .slice()
      .sort(
        (a, b) =>
          +new Date(a.scheduledFor) - +new Date(b.scheduledFor),
      )
      .forEach((c) => {
        const b = bucket(c);
        if (b === "today") t.push(c);
        else if (b === "week") w.push(c);
        else l.push(c);
      });
    return { today: t, week: w, later: l };
  }, [data]);

  return (
    <div className="px-4 md:px-8 py-8 md:py-10 max-w-5xl">
      <PageHeader
        title="Callbacks"
        description="Reminders for follow-up calls you've scheduled."
      />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-6">
          <Section title="Today" items={grouped.today} />
          <Section title="This week" items={grouped.week} />
          <Section title="Later" items={grouped.later} />
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  items,
}: {
  title: string;
  items: CallbackDto[];
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/30">
        <h2 className="font-serif text-lg">
          {title}{" "}
          <span className="text-sm text-muted-foreground font-sans">
            ({items.length})
          </span>
        </h2>
      </div>
      {items.length === 0 ? (
        <div className="px-5 py-6 text-sm text-muted-foreground">
          Nothing scheduled.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((c) => (
            <li key={c.id} className="px-5 py-4 flex items-center gap-3">
              <CalendarClock
                size={16}
                className="text-accent shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm">
                  <Link
                    href={`/leads/${c.leadId}`}
                    className="font-medium hover:underline"
                  >
                    Lead #{c.leadId}
                  </Link>{" "}
                  <span className="text-muted-foreground">
                    — {fmtDateTime(c.scheduledFor)}
                  </span>
                </div>
                {c.note && (
                  <div className="text-xs text-muted-foreground truncate">
                    {c.note}
                  </div>
                )}
              </div>
              <Link
                href={`/leads/${c.leadId}`}
                className="text-xs text-accent hover:underline"
              >
                Open lead
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
