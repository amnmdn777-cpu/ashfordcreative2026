import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileText } from "lucide-react";
import { api, fmtCents, fmtDateTime } from "@admin/lib/api";
import { PageHeader } from "@admin/components/AdminLayout";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-zinc-100 text-zinc-700",
  consent_recorded: "bg-blue-100 text-blue-900",
  content_collected: "bg-amber-100 text-amber-900",
  completed: "bg-emerald-100 text-emerald-900",
};

export default function OnboardingsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "onboardings"],
    queryFn: () => api.listOnboardings(),
    refetchInterval: 60_000,
  });

  const baseOrigin = window.location.origin;
  const adminBase = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <div className="p-6 md:p-10">
      <PageHeader
        title="Client onboarding"
        description="Post-payment intake, content collection, and content briefs ready for the build queue."
      />

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {error && (
        <div className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load"}
        </div>
      )}

      <div className="space-y-3">
        {data?.onboardings.map(({ onboarding, sale, lead }) => {
          const token = (onboarding as any).token as string | undefined;
          const onboardingUrl = token
            ? `${baseOrigin}${adminBase}/onboarding/${token}`
            : null;
          const briefUrl = api.briefMdUrl(onboarding.id);
          return (
            <div
              key={onboarding.id}
              className="bg-card border border-card-border rounded-lg p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                <div>
                  <div className="font-mono text-xs text-muted-foreground">
                    Onboarding #{onboarding.id} · Sale #{onboarding.saleId} · Plan{" "}
                    {sale?.planKey ?? "—"}
                  </div>
                  <div className="font-medium text-foreground">
                    {lead?.practice ?? "—"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {lead?.name} · {lead?.city}
                  </div>
                </div>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                    STATUS_COLORS[onboarding.status] ?? "bg-muted"
                  }`}
                >
                  {onboarding.status.replace(/_/g, " ")}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-3">
                <Field label="Template" value={onboarding.templateKey ?? "—"} />
                <Field label="Palette" value={onboarding.chosenPaletteKey ?? "—"} />
                <Field label="Add-ons" value={`${onboarding.selectedAddons.length}`} />
                <Field label="Monthly" value={fmtCents(onboarding.monthlyTotalCents)} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-muted-foreground mt-3">
                <div>
                  Scrape consent:{" "}
                  {onboarding.scrapeConsentAt ? `✅ ${fmtDateTime(onboarding.scrapeConsentAt)}` : "—"}
                </div>
                <div>
                  Content collected:{" "}
                  {onboarding.contentCollectedAt
                    ? `✅ ${fmtDateTime(onboarding.contentCollectedAt)}`
                    : "—"}
                </div>
                <div>
                  Completed:{" "}
                  {onboarding.completedAt ? `✅ ${fmtDateTime(onboarding.completedAt)}` : "—"}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-border">
                {onboardingUrl && (
                  <a
                    href={onboardingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
                  >
                    <ExternalLink size={12} /> Open onboarding link
                  </a>
                )}
                <a
                  href={briefUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90"
                >
                  <FileText size={12} /> View build brief (.md)
                </a>
                <a
                  href={briefUrl}
                  download={`brief-${onboarding.id}.md`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
                >
                  Download brief
                </a>
              </div>
            </div>
          );
        })}
        {data && data.onboardings.length === 0 && (
          <div className="text-sm text-muted-foreground">
            No onboardings yet. They're created automatically when a sale closes via Stripe.
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-md p-2.5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm mt-0.5 truncate">{value}</div>
    </div>
  );
}
