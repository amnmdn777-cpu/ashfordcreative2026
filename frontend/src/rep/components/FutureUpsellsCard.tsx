import { useState } from "react";
import { Sparkles, ChevronDown, ChevronUp, Calendar, DollarSign } from "lucide-react";
import { FUTURE_UPSELLS } from "@rep/lib/futureUpsells";

/**
 * "Future upsells" panel for the rep dashboard.
 *
 * Collapsed by default — a single button reveals the roadmap of
 * products we plan to sell to existing customers post-launch. Reps
 * use this to plant seeds during the initial pitch ("we're also
 * shipping an AI receptionist in Q1, want me to flag you for
 * early access?") without overpromising firm pricing.
 *
 * All prices are tagged "estimate" so a rep doesn't quote them
 * as committed. When a product graduates to a live SKU, drop it
 * from `lib/futureUpsells.ts` — the card disappears the item
 * automatically.
 */
export function FutureUpsellsCard() {
  const [open, setOpen] = useState(false);

  return (
    <section className="mt-10 bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-6 py-4 hover:bg-muted/40 transition"
        data-testid="button-future-upsells-toggle"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-accent/15 text-accent flex items-center justify-center shrink-0">
            <Sparkles size={16} />
          </div>
          <div className="text-left min-w-0">
            <div className="font-serif text-lg text-foreground">
              Future upsells
            </div>
            <div className="text-xs text-muted-foreground">
              What we'll sell once the website is live and paid — plant
              the seed during your pitch.
            </div>
          </div>
        </div>
        {open ? (
          <ChevronUp size={18} className="text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown size={18} className="text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t border-card-border">
          <div className="px-6 py-3 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200">
            <strong>Heads up:</strong> all prices below are{" "}
            <em>estimates</em> — never quote as firm. Use these to gauge
            interest, not to close. We'll lock final pricing closer to
            each launch.
          </div>
          <ul className="divide-y divide-card-border">
            {FUTURE_UPSELLS.map((u) => (
              <li
                key={u.key}
                className="px-6 py-4"
                data-testid={`future-upsell-${u.key}`}
              >
                <div className="flex items-start justify-between gap-4 mb-1.5">
                  <div className="font-medium text-foreground">{u.label}</div>
                  <div className="text-xs text-muted-foreground inline-flex items-center gap-1 shrink-0">
                    <Calendar size={12} />
                    {u.eta}
                  </div>
                </div>
                <p className="text-sm text-foreground/85 leading-relaxed mb-1.5">
                  {u.oneLiner}
                </p>
                <p className="text-xs text-muted-foreground italic mb-2">
                  {u.problem}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <span className="text-muted-foreground inline-flex items-center gap-1">
                    <DollarSign size={11} />
                    est. ${u.estMonthly}/mo
                    {u.estSetup ? (
                      <span className="text-muted-foreground/80">
                        {" "}
                        + ${u.estSetup} setup
                      </span>
                    ) : null}
                  </span>
                  <span className="text-emerald-700 dark:text-emerald-300">
                    your bonus: ~${u.estFirstMonthBonus}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
