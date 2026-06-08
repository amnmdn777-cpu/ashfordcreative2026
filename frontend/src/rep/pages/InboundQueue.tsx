import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmtDateTime } from "@rep/lib/api";
import { PageHeader } from "@rep/components/RepLayout";

// Compact "is this lead SMS-able?" indicator. Phone-bearing inbound
// requests must carry a `smsConsent=true` audit row (web-form path) for
// the rep to text them. Inbox shows this verbatim so the rep never has
// to guess and never accidentally texts a no-consent number.
function SmsConsentBadge({
  consented,
  consentAt,
}: {
  consented: boolean;
  consentAt: string | null;
}) {
  if (consented) {
    return (
      <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 text-[11px]">
        <span aria-hidden>✓</span>
        <span>SMS consent on file</span>
        {consentAt && (
          <span className="text-emerald-700/70">
            · {fmtDateTime(consentAt)}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 px-2 py-0.5 text-[11px]">
      <span aria-hidden>!</span>
      <span>No SMS consent — call only, do not text</span>
    </div>
  );
}

export default function InboundQueuePage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const queue = useQuery({
    queryKey: ["inbound", "queue"],
    queryFn: api.inboundQueue,
  });
  const mine = useQuery({
    queryKey: ["inbound", "mine"],
    queryFn: api.inboundMine,
  });
  const claim = useMutation({
    mutationFn: (id: number) => api.claimInbound(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inbound"] });
      setError(null);
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Could not open lead"),
  });
  const close = useMutation({
    mutationFn: (id: number) => api.patchInbound(id, { status: "closed" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbound"] }),
  });

  return (
    <div className="px-4 md:px-8 py-8 md:py-10 max-w-7xl">
      <PageHeader
        title="Inbound queue"
        description="People who reached out via the chatbot or contact form. Open what you'll work."
      />

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2 mb-4">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <h2 className="font-serif text-lg">
              Open{" "}
              <span className="text-sm text-muted-foreground font-sans">
                ({queue.data?.contactRequests.length ?? 0})
              </span>
            </h2>
          </div>
          {queue.isLoading ? (
            <div className="px-5 py-6 text-sm text-muted-foreground">
              Loading…
            </div>
          ) : queue.data?.contactRequests.length === 0 ? (
            <div className="px-5 py-6 text-sm text-muted-foreground">
              No open inbound requests.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {queue.data?.contactRequests.map((c) => (
                <li key={c.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {c.name}
                        {c.practice && (
                          <span className="text-muted-foreground font-normal">
                            {" "}
                            · {c.practice}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.preferredContact} · {c.email ?? "—"} ·{" "}
                        {c.phone ?? "—"} · {fmtDateTime(c.createdAt)}
                      </div>
                      {c.phone && (
                        <SmsConsentBadge
                          consented={c.smsConsent}
                          consentAt={c.smsConsentAt}
                        />
                      )}
                      {c.message && (
                        <p className="text-sm mt-2 whitespace-pre-wrap">
                          {c.message}
                        </p>
                      )}
                      {c.bestTimeToReach && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Best time: {c.bestTimeToReach}
                        </p>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        Source: {c.source}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        claim.mutate(c.id);
                      }}
                      disabled={claim.isPending}
                      className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 disabled:opacity-60"
                    >
                      Open Lead
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <h2 className="font-serif text-lg">
              Mine{" "}
              <span className="text-sm text-muted-foreground font-sans">
                ({mine.data?.contactRequests.length ?? 0})
              </span>
            </h2>
          </div>
          {mine.isLoading ? (
            <div className="px-5 py-6 text-sm text-muted-foreground">
              Loading…
            </div>
          ) : mine.data?.contactRequests.length === 0 ? (
            <div className="px-5 py-6 text-sm text-muted-foreground">
              You haven't opened anything yet.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {mine.data?.contactRequests.map((c) => (
                <li key={c.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {c.name}
                        {c.practice && (
                          <span className="text-muted-foreground font-normal">
                            {" "}
                            · {c.practice}
                          </span>
                        )}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({c.status})
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.preferredContact} · {c.email ?? "—"} ·{" "}
                        {c.phone ?? "—"}
                      </div>
                      {c.phone && (
                        <SmsConsentBadge
                          consented={c.smsConsent}
                          consentAt={c.smsConsentAt}
                        />
                      )}
                      {c.message && (
                        <p className="text-sm mt-2 whitespace-pre-wrap">
                          {c.message}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => close.mutate(c.id)}
                      disabled={close.isPending || c.status === "closed"}
                      className="rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-60"
                    >
                      Close
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
