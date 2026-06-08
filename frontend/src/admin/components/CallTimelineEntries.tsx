import { useState } from "react";
import { Phone, PhoneIncoming, PhoneMissed, Voicemail } from "lucide-react";
import { fmtDateTime, type LeadTimelineCall } from "@admin/lib/api";

const fmtCents = (c: number) =>
  `$${(c / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
const fmtDuration = (s: number | null) => {
  if (!s || s <= 0) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
};

const STATUS_LABEL: Record<LeadTimelineCall["status"], string> = {
  queued: "Dialing…",
  ringing: "Ringing",
  "in-progress": "Connected",
  completed: "Completed",
  "no-answer": "No answer",
  busy: "Busy",
  failed: "Failed",
  canceled: "Canceled",
};

const isMissed = (c: LeadTimelineCall): boolean =>
  c.direction === "inbound" &&
  (c.status === "no-answer" || c.status === "failed" || !!c.voicemailDurationSec);

export function CallTimelineEntry({ call }: { call: LeadTimelineCall }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = isMissed(call)
    ? call.voicemailDurationSec
      ? Voicemail
      : PhoneMissed
    : call.direction === "inbound"
      ? PhoneIncoming
      : Phone;

  return (
    <li
      className="rounded border border-border bg-card p-3 text-sm"
      data-testid={`call-timeline-${call.id}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <div className="font-medium truncate">
              {call.direction === "outbound"
                ? `Called ${call.toNumber}`
                : call.voicemailDurationSec
                  ? `Voicemail from ${call.fromNumber}`
                  : `Inbound from ${call.fromNumber}`}
            </div>
            <div className="text-xs text-muted-foreground">
              {fmtDateTime(call.startedAt ?? call.createdAt)} ·{" "}
              {STATUS_LABEL[call.status]} · {fmtDuration(call.durationSec)}{" "}
              {call.costCents > 0 && `· ${fmtCents(call.costCents)}`}
              {call.provider === "dialpad" && (
                <span
                  className="ml-2 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary"
                  data-testid={`call-provider-badge-${call.id}`}
                >
                  DialPad
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {call.audioUrl && (
        <audio
          controls
          preload="none"
          src={call.audioUrl}
          className="mt-2 w-full"
          data-testid={`call-audio-${call.id}`}
        />
      )}

      {call.summary && (
        <div className="mt-3 rounded bg-muted/50 p-2">
          <p className="text-foreground">{call.summary.summary}</p>
          {call.summary.talkingPoints.length > 0 && (
            <>
              <div className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
                Talking points
              </div>
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                {call.summary.talkingPoints.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </>
          )}
          {call.summary.nextActions.length > 0 && (
            <>
              <div className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
                Next actions
              </div>
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                {call.summary.nextActions.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {call.transcript && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-primary hover:underline"
            data-testid={`call-transcript-toggle-${call.id}`}
          >
            {expanded ? "Hide transcript" : "Show transcript"}
            {call.transcript.transcriptLang
              ? ` (${call.transcript.transcriptLang})`
              : ""}
          </button>
          {expanded && (
            <div className="mt-1 whitespace-pre-wrap rounded border border-border bg-background p-2 text-xs text-muted-foreground">
              {call.transcript.transcriptText}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function CallTimelineList({ calls }: { calls: LeadTimelineCall[] }) {
  if (calls.length === 0) {
    return (
      <div className="rounded border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
        No calls recorded for this lead yet.
      </div>
    );
  }
  return (
    <ol className="space-y-2">
      {calls.map((c) => (
        <CallTimelineEntry key={c.id} call={c} />
      ))}
    </ol>
  );
}
