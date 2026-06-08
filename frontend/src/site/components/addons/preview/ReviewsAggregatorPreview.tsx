import { Star, ShieldCheck, Quote } from "lucide-react";

/**
 * Click-preview drawer body for the `reviews_aggregator` default
 * feature. Shows a unified review card pulling from Google +
 * Healthgrades, anchored with a 4.8★ summary header. Source pills make
 * it obvious nothing is invented; consent badge reassures the doc that
 * patient PHI is never displayed.
 */

const Stars = ({ count }: { count: number }) => (
  <div className="inline-flex items-center gap-0.5">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={
          i < count
            ? "w-3 h-3 fill-gold text-gold"
            : "w-3 h-3 text-ink/15"
        }
      />
    ))}
  </div>
);

const SourcePill = ({ source }: { source: "Google" | "Healthgrades" }) => (
  <span
    className={
      "inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-mono px-1.5 py-0.5 rounded " +
      (source === "Google"
        ? "bg-sage/10 text-sage"
        : "bg-gold/10 text-gold")
    }
  >
    <span className="w-1 h-1 rounded-full bg-current" />
    {source}
  </span>
);

export const ReviewsAggregatorPreview = () => {
  const reviews = [
    {
      name: "Hannah K.",
      city: "Austin, TX",
      rating: 5,
      source: "Google" as const,
      excerpt:
        "Dr. Alvarado is the first therapist who actually felt like a fit. Calm, smart, and asks the right questions early.",
      when: "2 weeks ago",
    },
    {
      name: "Marcus P.",
      city: "Round Rock",
      rating: 5,
      source: "Healthgrades" as const,
      excerpt:
        "Booking was simple, the office is welcoming, and the work is real. I've recommended her to two friends already.",
      when: "1 month ago",
    },
    {
      name: "Renee S.",
      city: "Cedar Park",
      rating: 4,
      source: "Google" as const,
      excerpt:
        "Helpful and patient. Telehealth appointments started on time every week. Insurance billing was painless.",
      when: "6 weeks ago",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-ink/10 overflow-hidden">
        <div className="bg-ink-deep text-cream px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-cream/60 font-mono mb-1">
              What patients say
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl">4.8</span>
              <Stars count={5} />
              <span className="text-[11px] text-cream/65 font-mono">
                · 64 reviews
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <SourcePill source="Google" />
            <SourcePill source="Healthgrades" />
          </div>
        </div>

        <div className="divide-y divide-ink/5">
          {reviews.map((r) => (
            <div key={r.name} className="p-4">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[13px] font-medium text-ink">
                  {r.name}{" "}
                  <span className="text-ink/45 font-normal text-[11px]">
                    · {r.city}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Stars count={r.rating} />
                  <SourcePill source={r.source} />
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Quote className="w-3 h-3 text-ink/25 mt-1 shrink-0" />
                <p className="text-[13px] text-ink/80 leading-relaxed">
                  {r.excerpt}
                </p>
              </div>
              <div className="text-[10px] text-ink/40 font-mono mt-1.5">
                {r.when}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-cream-warm rounded-xl border border-ink/10 p-3 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-sage shrink-0 mt-0.5" />
        <div className="text-[11px] text-ink/70 leading-relaxed">
          Reviews are pulled with patient consent only. We never display
          identifying or clinical information — first name + last initial,
          city only, no diagnoses.
        </div>
      </div>

      <div className="text-[11px] text-ink/55 italic leading-relaxed">
        New reviews land within an hour, low-rated outliers go through a
        24h moderation queue, and you keep one-click veto on anything you
        don't want to surface.
      </div>
    </div>
  );
};
