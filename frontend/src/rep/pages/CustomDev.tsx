import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  fmtCents,
  fmtDate,
  CUSTOM_DEV_FEATURE_LABELS,
} from "@rep/lib/api";
import type { CustomDevFeatureKey } from "@workspace/api-zod";
import { PageHeader } from "@rep/components/RepLayout";

const FEATURE_KEYS = Object.keys(
  CUSTOM_DEV_FEATURE_LABELS,
) as CustomDevFeatureKey[];

const STATUS_STYLES: Record<string, string> = {
  requested: "bg-muted text-muted-foreground border-border",
  quoted: "bg-chart-3/10 text-chart-3 border-chart-3/30",
  sent: "bg-accent/10 text-accent border-accent/30",
  paid: "bg-primary/10 text-primary border-primary/30",
  declined: "bg-destructive/10 text-destructive border-destructive/30",
};

export default function CustomDevPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [leadId, setLeadId] = useState("");
  const [features, setFeatures] = useState<CustomDevFeatureKey[]>([]);
  const [description, setDescription] = useState("");

  const list = useQuery({
    queryKey: ["quotes"],
    queryFn: api.listQuotes,
  });
  const create = useMutation({
    mutationFn: () =>
      api.createQuote({
        leadId: leadId ? Number(leadId) : undefined,
        featureKeys: features,
        customDescription: description || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      setError(null);
      setInfo("Quote requested. Ashford will price it shortly.");
      setLeadId("");
      setFeatures([]);
      setDescription("");
    },
    onError: (err) => {
      setInfo(null);
      setError(err instanceof Error ? err.message : "Failed");
    },
  });

  const toggle = (k: CustomDevFeatureKey) =>
    setFeatures((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k],
    );

  return (
    <div className="px-4 md:px-8 py-8 md:py-10 max-w-5xl">
      <PageHeader
        title="Custom dev quotes"
        description="Request a quote for client work that goes beyond the standard Boutique/Pro/Concierge tiers."
      />

      <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm mb-6">
        <h2 className="font-serif text-lg mb-4">Request a quote</h2>
        {(error || info) && (
          <div
            className={`text-sm rounded-md px-3 py-2 mb-4 border ${
              error
                ? "text-destructive bg-destructive/10 border-destructive/30"
                : "text-primary bg-primary/10 border-primary/30"
            }`}
          >
            {error ?? info}
          </div>
        )}
        <label className="block mb-4">
          <span className="text-xs text-muted-foreground">
            Related lead ID (optional)
          </span>
          <input
            type="number"
            value={leadId}
            onChange={(e) => setLeadId(e.target.value)}
            className="mt-1 w-full md:w-48 rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="e.g., 42"
          />
        </label>
        <div className="mb-4">
          <span className="text-xs text-muted-foreground">Features</span>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {FEATURE_KEYS.map((k) => (
              <label
                key={k}
                className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm ${
                  features.includes(k)
                    ? "border-primary bg-primary/5"
                    : "border-input bg-background hover:bg-muted/50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={features.includes(k)}
                  onChange={() => toggle(k)}
                />
                {CUSTOM_DEV_FEATURE_LABELS[k]}
              </label>
            ))}
          </div>
        </div>
        <label className="block mb-4">
          <span className="text-xs text-muted-foreground">
            Description (what does the client want?)
          </span>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="e.g., add a HIPAA-compliant intake form with file uploads"
          />
        </label>
        <button
          type="button"
          disabled={
            create.isPending ||
            (features.length === 0 && !description.trim())
          }
          onClick={() => create.mutate()}
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
        >
          {create.isPending ? "Sending…" : "Request quote"}
        </button>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30">
          <h2 className="font-serif text-lg">
            My quotes{" "}
            <span className="text-sm text-muted-foreground font-sans">
              ({list.data?.quotes.length ?? 0})
            </span>
          </h2>
        </div>
        {list.isLoading ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            Loading…
          </div>
        ) : list.data?.quotes.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            No quotes yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5">Created</th>
                  <th className="text-left px-4 py-2.5">Lead</th>
                  <th className="text-left px-4 py-2.5">Features</th>
                  <th className="text-left px-4 py-2.5">Status</th>
                  <th className="text-right px-4 py-2.5">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.data?.quotes.map((q) => (
                  <tr key={q.id}>
                    <td className="px-4 py-3 text-muted-foreground">
                      {fmtDate(q.createdAt)}
                    </td>
                    <td className="px-4 py-3">{q.leadId ?? "—"}</td>
                    <td className="px-4 py-3 max-w-xs">
                      <div className="truncate">
                        {q.featureKeys.length > 0
                          ? q.featureKeys
                              .map(
                                (k: string) =>
                                  CUSTOM_DEV_FEATURE_LABELS[
                                    k as CustomDevFeatureKey
                                  ] ?? k,
                              )
                              .join(", ")
                          : q.customDescription ?? "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border ${
                          STATUS_STYLES[q.status] ??
                          "border-border text-muted-foreground"
                        }`}
                      >
                        {q.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {q.quotedAmountCents != null
                        ? fmtCents(q.quotedAmountCents)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
