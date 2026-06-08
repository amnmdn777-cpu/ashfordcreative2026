import { Calendar, Clock, Video } from "lucide-react";

/**
 * Click-preview drawer body for the `online_booking` add-on. Renders a
 * branded mock of the calendar widget patients see — a 5-day strip,
 * three time slots for the highlighted day, and the consult-type pill.
 * Intentionally static (no real Stripe/Cal hookup) — the prospect
 * needs to feel the design and the rhythm, not test the booking flow.
 */
export const OnlineBookingPreview = () => {
  const days = [
    { label: "Mon", date: "12", state: "full" },
    { label: "Tue", date: "13", state: "active" },
    { label: "Wed", date: "14", state: "limited" },
    { label: "Thu", date: "15", state: "full" },
    { label: "Fri", date: "16", state: "open" },
  ] as const;
  const slots = ["10:00 AM", "1:30 PM", "4:00 PM"];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-ink/10 overflow-hidden">
      <div className="p-5 border-b border-ink/5 flex items-center justify-between bg-cream/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-sage/10 flex items-center justify-center text-sage">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="font-medium text-ink text-[15px]">
              Schedule a free 15-min consult
            </div>
            <div className="text-xs text-ink/60">Dr. Maya Alvarado, LCSW</div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-widest text-sage font-mono">
          <Video className="w-3 h-3" />
          Telehealth
        </span>
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex justify-between mb-6">
          {days.map((d) => (
            <div key={d.date} className="flex flex-col items-center gap-1.5">
              <div className="text-[10px] uppercase tracking-wider text-ink/50 font-medium">
                {d.label}
              </div>
              <button
                type="button"
                className={
                  "w-10 h-10 rounded-full text-sm font-medium transition-colors " +
                  (d.state === "active"
                    ? "bg-sage text-white shadow-md"
                    : d.state === "full"
                      ? "text-ink/30 cursor-not-allowed line-through"
                      : "text-ink hover:bg-ink/5")
                }
                disabled={d.state === "full"}
              >
                {d.date}
              </button>
              <div
                className={
                  "w-1 h-1 rounded-full " +
                  (d.state === "limited" ? "bg-sage/50" : "bg-transparent")
                }
              />
            </div>
          ))}
        </div>

        <div className="text-[11px] uppercase tracking-widest text-ink/55 font-mono mb-3">
          Tuesday, March 13 — available
        </div>
        <div className="grid grid-cols-3 gap-2">
          {slots.map((s, i) => (
            <button
              key={s}
              type="button"
              className={
                "border rounded-md py-2.5 text-sm transition-colors " +
                (i === 0
                  ? "border-sage bg-sage/5 text-sage font-medium"
                  : "border-ink/10 hover:border-ink/30 text-ink/80")
              }
            >
              <Clock className="inline-block w-3 h-3 mr-1.5 opacity-60" />
              {s}
            </button>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-ink/5 text-[11px] text-ink/55 leading-relaxed">
          Synced with your Google Calendar. Reminders auto-sent 24h ahead.
          Patient self-reschedules from the same link.
        </div>
      </div>
    </div>
  );
};
