import { LifeBuoy, Phone, MessageSquare, ShieldCheck, Clock } from "lucide-react";

/**
 * Click-preview drawer body for the `crisis_hotline_button` default
 * feature. Shows the floating button anchored bottom-right of a sample
 * page, plus the expanded panel a visitor sees after tapping it. Calm
 * palette on purpose — this badge never looks alarming, even though
 * it's solving the most serious problem on the site.
 */
export const CrisisHotlineButtonPreview = () => (
  <div className="space-y-3">
    <div className="relative bg-cream-warm rounded-xl border border-ink/10 overflow-hidden h-72">
      {/* Faux site backdrop */}
      <div className="p-5 border-b border-ink/5 bg-white/60">
        <div className="text-[10px] uppercase tracking-widest text-ink/40 font-mono mb-2">
          drmaya.com / contact
        </div>
        <div className="font-display text-lg text-ink/85 leading-tight mb-1.5">
          Reach the practice
        </div>
        <div className="h-2 w-3/4 bg-ink/10 rounded mb-1.5" />
        <div className="h-2 w-2/3 bg-ink/10 rounded mb-1.5" />
        <div className="h-2 w-4/5 bg-ink/10 rounded" />
      </div>
      <div className="p-5">
        <div className="h-2 w-1/2 bg-ink/10 rounded mb-2" />
        <div className="h-2 w-3/4 bg-ink/10 rounded mb-2" />
        <div className="h-2 w-2/3 bg-ink/10 rounded" />
      </div>

      {/* Expanded crisis panel */}
      <div className="absolute right-4 bottom-4 w-[260px] bg-white rounded-xl shadow-2xl border border-ink/10 overflow-hidden">
        <div className="bg-ink text-cream px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LifeBuoy className="w-4 h-4 text-cream" />
            <span className="font-display text-sm">In a crisis?</span>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-cream/65 font-mono">
            <Clock className="w-3 h-3" />
            24 / 7
          </span>
        </div>
        <div className="p-3 space-y-2">
          <a
            className="flex items-center gap-2 rounded-md bg-sage/10 hover:bg-sage/15 px-3 py-2.5 text-sm text-ink"
            href="tel:988"
          >
            <Phone className="w-4 h-4 text-sage" />
            <span>
              Call <strong>988</strong> — Suicide & Crisis Lifeline
            </span>
          </a>
          <a
            className="flex items-center gap-2 rounded-md bg-cream-warm hover:bg-cream px-3 py-2.5 text-sm text-ink"
            href="sms:741741"
          >
            <MessageSquare className="w-4 h-4 text-ink/70" />
            <span>
              Text <strong>HOME to 741741</strong>
            </span>
          </a>
          <div className="text-[10px] text-ink/50 px-1 leading-relaxed">
            If you are in immediate danger, call 911. Free, confidential, in
            English & Spanish.
          </div>
        </div>
      </div>
    </div>

    <div className="grid sm:grid-cols-3 gap-2">
      {[
        { icon: ShieldCheck, label: "On every page", sub: "Always one tap away" },
        { icon: Phone, label: "Call or text", sub: "988 + Crisis Text Line" },
        { icon: Clock, label: "Bilingual 24/7", sub: "EN + ES coverage" },
      ].map(({ icon: Icon, label, sub }) => (
        <div
          key={label}
          className="bg-white rounded-xl border border-ink/10 p-3 text-center"
        >
          <Icon className="w-4 h-4 text-sage mx-auto mb-1.5" />
          <div className="text-[12px] font-medium text-ink leading-tight">
            {label}
          </div>
          <div className="text-[10px] text-ink/55 mt-0.5">{sub}</div>
        </div>
      ))}
    </div>

    <div className="text-[11px] text-ink/55 italic leading-relaxed">
      Required for the APA's "ethical web presence" guidance. Calm by design —
      never a flashing red banner — so visitors feel held, not alarmed.
    </div>
  </div>
);
