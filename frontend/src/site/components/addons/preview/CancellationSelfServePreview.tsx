import { CalendarX2, ArrowRight, Sun, Sunrise } from "lucide-react";

/**
 * Click-preview drawer body for `cancellation_self_serve`. Renders a
 * "before / after" split: the patient's reschedule link on top, the
 * front-desk morning digest underneath, so the gatekeeper sees they
 * never have to read another "something came up" email.
 */
export const CancellationSelfServePreview = () => (
  <div className="space-y-4">
    {/* Patient side */}
    <div className="bg-white rounded-xl border border-ink/10 overflow-hidden">
      <div className="border-b border-ink/5 px-4 py-2.5 bg-cream/50 flex items-center gap-2">
        <CalendarX2 className="w-3.5 h-3.5 text-ink/55" />
        <span className="text-[11px] uppercase tracking-widest text-ink/55 font-mono">
          Patient · reschedule link
        </span>
      </div>

      <div className="p-5">
        <div className="text-sm text-ink/85 mb-3">
          Need to move your <strong>Tuesday 1:30 PM</strong> appointment?
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {["Wed 10am", "Wed 4pm", "Thu 9am", "Fri 1pm"].map((slot, i) => (
            <button
              key={slot}
              type="button"
              className={
                "border rounded-md py-2 px-3 text-xs transition-colors " +
                (i === 0
                  ? "border-sage bg-sage/5 text-sage font-medium"
                  : "border-ink/10 text-ink/70 hover:border-ink/30")
              }
            >
              {slot}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="w-full bg-ink text-cream rounded-md py-2.5 text-sm font-medium inline-flex items-center justify-center gap-1.5"
        >
          Confirm new time
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

        <div className="text-[11px] text-ink/55 mt-2 text-center">
          Allowed up to 24 hours before your appointment
        </div>
      </div>
    </div>

    {/* Front-desk side */}
    <div className="bg-cream-warm rounded-xl border border-ink/10 overflow-hidden">
      <div className="border-b border-ink/10 px-4 py-2.5 flex items-center gap-2">
        <Sunrise className="w-3.5 h-3.5 text-gold" />
        <span className="text-[11px] uppercase tracking-widest text-ink/55 font-mono">
          Front desk · 7:00 AM digest
        </span>
      </div>

      <div className="p-4 space-y-2 text-sm">
        <div className="flex items-start gap-2 text-ink/85">
          <span className="text-sage font-mono text-xs mt-0.5">↻</span>
          <span>
            <strong>Sarah W.</strong> moved Tue 1:30 PM →{" "}
            <strong>Wed 10:00 AM</strong>
          </span>
        </div>
        <div className="flex items-start gap-2 text-ink/85">
          <span className="text-gold font-mono text-xs mt-0.5">+</span>
          <span>
            <strong>James R.</strong> booked free consult, Thu 4:00 PM
          </span>
        </div>
        <div className="flex items-start gap-2 text-ink/55">
          <Sun className="w-3 h-3 mt-0.5 text-ink/40" />
          <span>3 reminders auto-sent for tomorrow's slate</span>
        </div>
      </div>
    </div>

    <div className="text-[11px] text-ink/55 italic leading-relaxed">
      Cuts ~30% of front-desk inbox volume. Logs cancellation reasons
      so you can spot a no-show pattern before it costs you a slot.
    </div>
  </div>
);
