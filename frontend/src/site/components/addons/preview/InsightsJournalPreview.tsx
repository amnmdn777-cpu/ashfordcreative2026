import { Newspaper, Calendar, Mic, CheckCircle2 } from "lucide-react";

/**
 * Click-preview drawer body for `blog_publishing` (rebranded "Insights
 * Journal"). Shows the value chain visually: 20-min interview →
 * ghostwritten draft → one-click publish. Concrete and process-y so the
 * doc sees what they actually do (almost nothing) vs what they get (a
 * compounding library of clinical authority).
 */
export const InsightsJournalPreview = () => (
  <div className="space-y-4">
    <div className="bg-white rounded-xl border border-ink/10 overflow-hidden">
      <div className="bg-ink-deep text-cream px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4" />
          <span className="font-display text-sm">Insights Journal</span>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-cream/60 font-mono">
          drmaya.com / journal
        </span>
      </div>

      <div className="p-5">
        <div className="text-[10px] uppercase tracking-widest text-sage font-mono mb-1.5">
          Latest · March 2026
        </div>
        <h4 className="font-display text-xl text-ink leading-tight mb-2">
          Why I stopped diagnosing burnout in the first session
        </h4>
        <p className="text-sm text-ink/70 leading-relaxed mb-3">
          A short essay on holding the question open for two more weeks —
          and what changes when patients realise burnout is a verb, not a
          condition…
        </p>
        <div className="text-[11px] text-ink/50 font-mono">
          5 min read · Translated to Spanish · 412 reads this month
        </div>
      </div>
    </div>

    <div className="grid sm:grid-cols-3 gap-2">
      {[
        { icon: Mic, label: "20-min interview", sub: "We call you" },
        { icon: Newspaper, label: "Ghostwritten draft", sub: "In your voice" },
        { icon: CheckCircle2, label: "One-click publish", sub: "EN + ES" },
      ].map(({ icon: Icon, label, sub }) => (
        <div
          key={label}
          className="bg-cream-warm rounded-xl border border-ink/10 p-3 text-center"
        >
          <Icon className="w-5 h-5 mx-auto text-sage mb-1.5" />
          <div className="text-[12px] font-medium text-ink leading-tight">
            {label}
          </div>
          <div className="text-[10px] text-ink/55 mt-0.5">{sub}</div>
        </div>
      ))}
    </div>

    <div className="text-[11px] text-ink/55 italic leading-relaxed inline-flex items-center gap-1.5">
      <Calendar className="w-3 h-3" />
      One post per month · 12 essays per year · Nothing for you to learn or maintain
    </div>
  </div>
);
