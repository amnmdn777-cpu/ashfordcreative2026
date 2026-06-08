import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Phone, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { api } from "@rep/lib/api";
import { useAuth } from "@rep/lib/auth";

/**
 * Rep Settings — Integrations panel.
 *
 * Today this only hosts the per-rep Dialpad OAuth Connect / Disconnect
 * controls (task #226). The page is the post-OAuth landing target —
 * `?dialpad=connected|error&msg=…` is shown as a banner so the rep
 * gets immediate feedback on whether her seat was successfully linked.
 */
export default function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [location, navigate] = useLocation();

  const banner = useMemo(() => {
    const url = new URL(window.location.href);
    const status = url.searchParams.get("dialpad");
    const msg = url.searchParams.get("msg");
    if (!status) return null;
    return { status, msg };
  }, [location]);

  // Strip the query params after we read them once, so a refresh
  // doesn't keep re-flashing the banner.
  useEffect(() => {
    if (!banner) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("dialpad");
    url.searchParams.delete("msg");
    const next =
      url.pathname +
      (url.searchParams.toString() ? `?${url.searchParams}` : "");
    window.history.replaceState({}, "", next);
  }, [banner]);

  const status = useQuery({
    queryKey: ["dialpad-integration-status"],
    queryFn: () => api.dialpadIntegrationStatus(),
    refetchOnWindowFocus: true,
    enabled: !!user && user.role === "rep",
  });

  const disconnect = useMutation({
    mutationFn: () => api.dialpadDisconnect(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["dialpad-integration-status"] });
    },
  });

  if (!user || user.role !== "rep") {
    return (
      <div className="px-6 py-10 max-w-3xl">
        <p className="text-muted-foreground">Reps only.</p>
      </div>
    );
  }

  const s = status.data;

  return (
    <div className="px-4 md:px-8 py-8 md:py-10 max-w-3xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage how your seat connects to outside services.
        </p>
      </div>

      {banner && (
        <div
          role="status"
          className={`rounded-md border px-4 py-3 text-sm flex items-start gap-2 ${
            banner.status === "connected"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-amber-300 bg-amber-50 text-amber-900"
          }`}
        >
          {banner.status === "connected" ? (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          )}
          <div>
            <div className="font-medium">
              {banner.status === "connected"
                ? "Dialpad connected."
                : "Dialpad connection issue."}
            </div>
            {banner.msg && (
              <div className="mt-1 text-xs opacity-80">{banner.msg}</div>
            )}
          </div>
        </div>
      )}

      <section className="rounded-lg border border-border bg-card p-5">
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md bg-muted p-2 text-foreground">
              <Phone size={18} />
            </div>
            <div>
              <h2 className="font-serif text-lg leading-tight">Dialpad</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Connect your own Dialpad seat so prospects see{" "}
                <span className="font-medium text-foreground">your</span>{" "}
                number — not the shared admin line — when you call or text
                from a lead page.
              </p>
            </div>
          </div>
        </header>

        <div className="mt-4 border-t border-border pt-4">
          {status.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              Checking status…
            </div>
          ) : !s?.configured ? (
            <p className="text-sm text-muted-foreground">
              Per-rep Dialpad OAuth isn't configured on this server yet.
              Calls and texts continue to use the shared admin line.
            </p>
          ) : s.connected ? (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="text-sm">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 size={16} />
                  <span className="font-medium">
                    Connected{s.dialpadEmail ? ` as ${s.dialpadEmail}` : ""}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Outbound calls and SMS go out from your Dialpad number.
                </div>
                {/* When Dialpad's `recordings_export` scope was granted
                    (rep ticked the recordings/transcript permission at
                    consent), Vi can return per-call transcripts +
                    summaries to the call detail panel. Surface that as
                    a small badge so Candice + the rep can verify the
                    consent flow worked end-to-end. */}
                {Array.isArray(s.scopes) &&
                  s.scopes.includes("recordings_export") && (
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
                      <CheckCircle2 size={12} />
                      Vi summaries enabled
                    </div>
                  )}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Disconnect Dialpad? You won't be able to place calls or send SMS until you reconnect.",
                    )
                  ) {
                    disconnect.mutate();
                  }
                }}
                disabled={disconnect.isPending}
                className="px-3 py-1.5 rounded-md text-sm border border-border hover:bg-muted disabled:opacity-50"
              >
                {disconnect.isPending ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="text-sm text-muted-foreground">
                You haven't connected Dialpad yet. The Call and SMS buttons
                on each lead are disabled until you do.
              </div>
              <a
                href={api.dialpadStartUrl()}
                className="px-3 py-1.5 rounded-md text-sm bg-accent text-accent-foreground hover:opacity-90"
              >
                Connect Dialpad
              </a>
            </div>
          )}
          {disconnect.isError && (
            <div className="mt-3 text-xs text-destructive">
              {(disconnect.error as Error)?.message ?? "Disconnect failed."}
            </div>
          )}
        </div>
      </section>

      <button
        type="button"
        onClick={() => navigate("/")}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to dashboard
      </button>
    </div>
  );
}
