import { useState } from "react";
import { Phone, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useDialer } from "@rep/contexts/DialerProvider";
import { Button } from "@rep/components/ui/button";

/**
 * Confirmation modal launched from the LeadDetail "Call" action card. We
 * intentionally don't auto-dial on click — reps occasionally bump that
 * button by accident, and once Twilio places the call we've already
 * incurred per-minute cost. A 1-step confirmation is cheap insurance.
 */
export function CallModal({
  leadId,
  practiceName,
  defaultPhone,
  onClose,
  onError,
}: {
  leadId: number | null;
  practiceName?: string | null;
  defaultPhone: string | null | undefined;
  onClose: () => void;
  onError: (msg: string) => void;
}) {
  const { placeCall, status, errorMessage } = useDialer();
  const qc = useQueryClient();
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [submitting, setSubmitting] = useState(false);

  const dial = async () => {
    if (!phone.trim()) {
      onError("Enter a phone number to call.");
      return;
    }
    setSubmitting(true);
    try {
      await placeCall({ leadId, toNumber: phone.trim(), practiceName });
      // Refresh lead-detail and My Leads queries so the new calls row
      // is reflected immediately in the call timeline AND so the #208
      // "needs follow-up call" cue (badge + callout) clears without
      // requiring a manual refresh. Both queries derive freshness from
      // the same calls/portal data, so a single invalidation covers
      // both visual surfaces.
      if (leadId != null) {
        qc.invalidateQueries({ queryKey: ["lead", leadId] });
      }
      qc.invalidateQueries({ queryKey: ["leads", "mine"] });
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not place the call.");
    } finally {
      setSubmitting(false);
    }
  };

  const dialerReady = status === "ready" || status === "in-call";

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-background/80 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-xl">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-serif text-lg leading-tight">Call prospect</h3>
            {practiceName && (
              <p className="text-sm text-muted-foreground">{practiceName}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="block text-sm mb-1" htmlFor="call-phone">
          Phone
        </label>
        <input
          id="call-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded border border-border bg-background px-3 py-2 mb-3"
          placeholder="(512) 555-0100"
          data-testid="call-phone-input"
        />

        {!dialerReady && status !== "connecting" && (
          <div className="mb-3 text-xs text-amber-600 dark:text-amber-400">
            {status === "unavailable"
              ? "Voice channel is currently unavailable."
              : "Connecting to dialer…"}
          </div>
        )}
        {errorMessage && (
          <div className="mb-3 text-xs text-destructive">{errorMessage}</div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={dial}
            disabled={submitting || !dialerReady}
            data-testid="call-dial-confirm"
          >
            <Phone className="h-4 w-4 mr-1" />
            {submitting ? "Dialing…" : "Call"}
          </Button>
        </div>
      </div>
    </div>
  );
}
