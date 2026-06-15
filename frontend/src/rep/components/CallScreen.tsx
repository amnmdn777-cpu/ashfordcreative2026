import { useEffect, useState } from "react";
import { PhoneOff, AlertTriangle } from "lucide-react";
import { useDialer } from "@rep/contexts/DialerProvider";
import { Button } from "@rep/components/ui/button";

/**
 * Floating call card. Audio + mute + DTMF + hangup all happen on the
 * rep's Dialpad device — this card is a passive UI hint that a call was
 * just placed, plus a "Dismiss" affordance to clear it from screen.
 */

const fmtDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

export function CallScreen() {
  const { active, errorMessage, hangUp, clearError } = useDialer();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  // A failed placeCall throws before `active` is set, so without this the
  // rep saw nothing at all when a call could not be placed (403/409/502).
  if (!active && errorMessage) {
    return (
      <div
        data-testid="call-error"
        className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-destructive/40 bg-card shadow-xl"
      >
        <div className="flex items-start gap-2 p-3">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wide text-destructive">
              Call failed
            </div>
            <p className="text-sm text-foreground mt-0.5 wrap-break-word">
              {errorMessage}
            </p>
          </div>
        </div>
        <div className="p-3 pt-0">
          <Button
            variant="outline"
            className="w-full"
            onClick={clearError}
            data-testid="call-error-dismiss"
          >
            Dismiss
          </Button>
        </div>
      </div>
    );
  }

  if (!active) return null;
  const elapsedSec = Math.floor((Date.now() - active.startedAt) / 1000);

  return (
    <div
      data-testid="call-screen"
      className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-border bg-card shadow-xl"
    >
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {active.direction === "outbound" ? "Calling" : "On call"}
          </div>
          {active.leadName ? (
            <div className="font-medium truncate" data-testid="call-lead-name">
              {active.leadName}
            </div>
          ) : null}
          {active.practiceName ? (
            <div
              className="text-xs text-muted-foreground truncate"
              data-testid="call-practice-name"
            >
              {active.practiceName}
            </div>
          ) : null}
          <div
            className={
              active.leadName
                ? "text-xs text-muted-foreground truncate"
                : "font-medium truncate"
            }
          >
            {active.remoteNumber}
          </div>
        </div>
        <div className="text-sm tabular-nums text-muted-foreground">
          {fmtDuration(elapsedSec)}
        </div>
      </div>

      <div className="p-3 space-y-3">
        <p className="text-xs text-muted-foreground">
          Pick up on your Dialpad device to talk. Mute, keypad, and hang-up
          live on the device itself.
        </p>
        <Button
          variant="outline"
          className="w-full"
          onClick={hangUp}
          data-testid="call-hangup"
        >
          <PhoneOff className="h-4 w-4 mr-2" />
          Dismiss
        </Button>
      </div>
    </div>
  );
}
