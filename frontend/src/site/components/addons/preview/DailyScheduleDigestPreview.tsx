import { Sunrise, Calendar, AlertCircle, Plus, Repeat } from "lucide-react";

/**
 * Click-preview drawer body for the `daily_schedule_digest` default
 * feature. Renders the 7am email exactly as the front desk reads it
 * on a Monday morning: brand header, today's slate with patient names,
 * an overnight-changes section, and an "anything missing?" footer.
 */

const Row = ({
  time,
  patient,
  type,
  state,
}: {
  time: string;
  patient: string;
  type: string;
  state: "ok" | "new" | "moved" | "no-show-risk";
}) => {
  const states: Record<string, { dot: string; tag: string; bg: string }> = {
    ok: { dot: "bg-ink/20", tag: "", bg: "" },
    new: {
      dot: "bg-sage",
      tag: "New",
      bg: "bg-sage/5",
    },
    moved: {
      dot: "bg-gold",
      tag: "Rescheduled",
      bg: "bg-gold/5",
    },
    "no-show-risk": {
      dot: "bg-red-500",
      tag: "Confirm",
      bg: "bg-red-500/5",
    },
  };
  const s = states[state];
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-md ${s.bg}`}
    >
      <span className="text-[11px] font-mono text-ink/55 w-14 shrink-0">
        {time}
      </span>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-ink truncate">{patient}</div>
        <div className="text-[11px] text-ink/55 truncate">{type}</div>
      </div>
      {s.tag && (
        <span className="text-[10px] uppercase tracking-widest font-mono text-ink/65 px-1.5 py-0.5 rounded bg-white border border-ink/10 shrink-0">
          {s.tag}
        </span>
      )}
    </div>
  );
};

export const DailyScheduleDigestPreview = () => (
  <div className="space-y-3">
    <div className="bg-white rounded-xl border border-ink/10 overflow-hidden">
      <div className="bg-cream-warm border-b border-ink/10 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sunrise className="w-4 h-4 text-gold" />
          <span className="font-display text-sm text-ink">
            Today at the practice
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-ink/45 font-mono">
          Mon · Mar 17 · 7:00 AM
        </span>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Calendar className="w-3.5 h-3.5 text-ink/55" />
            <span className="text-[10px] uppercase tracking-widest text-ink/55 font-mono">
              Schedule · 6 sessions
            </span>
          </div>
          <div className="space-y-1">
            <Row time="9:00" patient="Sarah Wilson" type="60-min · in-person" state="ok" />
            <Row time="10:30" patient="James Reyes" type="Free consult · telehealth" state="new" />
            <Row time="1:30" patient="Hannah Kim" type="60-min · in-person" state="moved" />
            <Row time="3:00" patient="Marcus Patel" type="45-min · telehealth" state="no-show-risk" />
            <Row time="4:00" patient="Renee Santos" type="60-min · in-person" state="ok" />
            <Row time="5:30" patient="Devon Lee" type="60-min · telehealth" state="ok" />
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Repeat className="w-3.5 h-3.5 text-ink/55" />
            <span className="text-[10px] uppercase tracking-widest text-ink/55 font-mono">
              Overnight changes
            </span>
          </div>
          <div className="space-y-1.5 text-[12px] text-ink/80 px-3">
            <div className="flex items-start gap-2">
              <Plus className="w-3 h-3 text-sage mt-0.5 shrink-0" />
              <span>
                <strong>James R.</strong> booked free consult, 10:30 AM
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Repeat className="w-3 h-3 text-gold mt-0.5 shrink-0" />
              <span>
                <strong>Hannah K.</strong> moved Tue 3pm → today 1:30 PM
              </span>
            </div>
            <div className="flex items-start gap-2">
              <AlertCircle className="w-3 h-3 text-red-500 mt-0.5 shrink-0" />
              <span>
                <strong>Marcus P.</strong> hasn't confirmed — auto-reminder
                sent at 6:45 AM
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-ink/5 bg-cream/40 px-5 py-2.5 flex items-center justify-between text-[10px] uppercase tracking-widest text-ink/45 font-mono">
        <span>Sent to front desk · 3 recipients</span>
        <span>From: Ashford</span>
      </div>
    </div>

    <div className="text-[11px] text-ink/55 italic leading-relaxed">
      Replaces the 15-minute "what's on for today" huddle. Front desk lands
      already aligned, and you walk in knowing exactly which patient needs
      the warmer welcome.
    </div>
  </div>
);
