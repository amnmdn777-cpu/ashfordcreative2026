import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { ChevronLeft } from "lucide-react";
import { api, fmtCents, fmtDate } from "@admin/lib/api";
import { PageHeader } from "@admin/components/AdminLayout";
import { RepChatPanel } from "@admin/components/RepChatPanel";

export default function RepDetailPage() {
  const params = useParams<{ id: string }>();
  const repId = Number(params.id);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "reps"],
    queryFn: () => api.listReps(),
  });

  const rep = data?.reps.find((r) => r.id === repId);

  return (
    <div className="p-6 md:p-10 max-w-6xl">
      <Link
        href="/reps"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
      >
        <ChevronLeft size={14} /> Back to reps
      </Link>

      {isLoading && (
        <div className="text-sm text-muted-foreground">Loading…</div>
      )}
      {error && (
        <div className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load."}
        </div>
      )}
      {!isLoading && !rep && (
        <div className="text-sm text-muted-foreground">Rep not found.</div>
      )}

      {rep && (
        <>
          <PageHeader
            title={rep.displayName}
            description={`@${rep.username} · promo ${rep.promoCode} · ${rep.role}`}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
                <h2 className="font-serif text-lg mb-3">Profile</h2>
                <dl className="text-sm space-y-2">
                  <Row label="Username" value={`@${rep.username}`} />
                  <Row label="Role" value={rep.role} />
                  <Row label="Promo code" value={rep.promoCode} mono />
                  <Row
                    label="Hourly rate"
                    value={`${fmtCents(rep.hourlyRateCents)}/hr`}
                  />
                  <Row
                    label="Status"
                    value={rep.isActive ? "Active" : "Disabled"}
                  />
                  <Row label="Joined" value={fmtDate(rep.createdAt)} />
                </dl>
              </div>
            </div>

            <div className="lg:col-span-2">
              <RepChatPanel repId={rep.id} repName={rep.displayName} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-xs" : ""}>{value}</dd>
    </div>
  );
}
