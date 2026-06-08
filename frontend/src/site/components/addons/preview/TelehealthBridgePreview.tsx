import { Video, Headphones, Coffee, RotateCw } from "lucide-react";

/**
 * Click-preview drawer body for `telehealth_bridge`. Compact rendition
 * of the branded /visit page — therapist photo block, "before your
 * visit" prep card, big enter-room button, inline reschedule. Same
 * shape as the inline showcase but sized for the drawer.
 */
export const TelehealthBridgePreview = () => (
  <div className="space-y-3">
    <div className="bg-cream-warm rounded-xl border border-ink/10 p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[11px] uppercase tracking-widest text-ink/50 font-mono">
          yoursite.com/visit
        </div>
        <div className="text-[10px] uppercase tracking-widest text-sage font-mono inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-sage" />
          Today · 2:00 pm
        </div>
      </div>

      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-ink/10">
        <div className="w-12 h-12 rounded-full bg-sage/15 flex items-center justify-center shrink-0">
          <Video className="w-5 h-5 text-sage" />
        </div>
        <div>
          <div className="font-display text-lg text-ink">Dr. Maria Rivera, LCSW</div>
          <div className="text-[11px] text-ink/55">One tap from the waiting room</div>
        </div>
      </div>

      <div className="text-[10px] uppercase tracking-widest text-ink/45 mb-2">
        Before your visit
      </div>
      <ul className="space-y-1.5 mb-4">
        <li className="flex items-center gap-2 text-xs text-ink/75">
          <Coffee className="w-3 h-3 text-sage shrink-0" />
          Find a quiet space — close the door
        </li>
        <li className="flex items-center gap-2 text-xs text-ink/75">
          <Headphones className="w-3 h-3 text-sage shrink-0" />
          Headphones recommended for privacy
        </li>
      </ul>

      <button
        type="button"
        className="w-full bg-sage text-cream rounded-lg py-2.5 text-xs font-medium inline-flex items-center justify-center gap-2"
      >
        <Video className="w-3.5 h-3.5" />
        Enter waiting room
      </button>
      <button
        type="button"
        className="w-full mt-1.5 text-[11px] text-ink/55 inline-flex items-center justify-center gap-1.5"
      >
        <RotateCw className="w-2.5 h-2.5" />
        I need to reschedule
      </button>
    </div>

    <div className="text-[11px] text-ink/55 italic leading-relaxed">
      Wraps your existing Doxy / Zoom / SimplePractice room in your brand.
      One permanent URL replaces the dozen unique links you paste today.
    </div>
  </div>
);
