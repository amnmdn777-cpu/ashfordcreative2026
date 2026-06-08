import { BadgeDollarSign, ShieldCheck, Heart } from "lucide-react";

/**
 * Click-preview drawer body for `insurance_sliding_scale`. Shows the
 * branded badge as it would appear above the fold on a real practice
 * site: accepted plans on the left, sliding-scale floor on the right,
 * and a tiny EN/ES toggle to communicate that the explainer page is
 * always bilingual.
 */
export const InsuranceSlidingScalePreview = () => {
  const plans = ["Aetna", "BCBS Texas", "Cigna", "United (HMO/PPO)"];
  return (
    <div className="space-y-3">
      <div className="bg-cream-warm rounded-xl border border-ink/10 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[11px] uppercase tracking-widest text-sage font-mono inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3" />
            Insurance & Fees
          </div>
          <div className="text-[10px] uppercase tracking-widest text-ink/50 font-mono">
            EN | <span className="text-ink/30">ES</span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <div className="text-xs text-ink/60 mb-2">Plans accepted</div>
            <ul className="space-y-1.5">
              {plans.map((p) => (
                <li
                  key={p}
                  className="flex items-center gap-2 text-sm text-ink/85"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-sage shrink-0" />
                  {p}
                </li>
              ))}
              <li className="flex items-center gap-2 text-sm text-ink/55 pt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-ink/20 shrink-0" />
                Out-of-network — superbills provided
              </li>
            </ul>
          </div>

          <div className="border-l border-ink/10 pl-5">
            <div className="text-xs text-ink/60 mb-2 inline-flex items-center gap-1.5">
              <Heart className="w-3 h-3 text-sage" />
              Sliding scale
            </div>
            <div className="flex items-baseline gap-1.5">
              <BadgeDollarSign className="w-5 h-5 text-sage" />
              <span className="font-display text-3xl text-ink">$80</span>
              <span className="text-sm text-ink/60">— $180 / session</span>
            </div>
            <p className="text-xs text-ink/65 mt-2 leading-relaxed">
              Reduced fee for full-time students, caregivers, and those
              between insurance. No paperwork required.
            </p>
          </div>
        </div>
      </div>

      <div className="text-[11px] text-ink/55 italic leading-relaxed">
        Renders inline on every page of your site. Cuts "do you take my
        insurance?" inquiries by ~40% in our pilot cohort.
      </div>
    </div>
  );
};
