import { BadgeDollarSign, ShieldCheck, Heart } from "lucide-react";
import { useI18n } from "@site/lib/i18n";
import { RibbonHeader } from "./RibbonHeader";

/**
 * Inline preview for `insurance_sliding_scale`. Full-width branded
 * "Insurance & Fees" card section with accepted plans on the left and
 * sliding-scale floor on the right.
 */
export const InsuranceSlidingScaleInline = ({ included }: { included?: boolean }) => {
  const { t } = useI18n();
  const plans = ["Aetna", "BCBS Texas", "Cigna", "United (HMO/PPO)"];
  return (
    <section
      id="addon-inline-insurance_sliding_scale"
      className="ashford-addon-inline scroll-mt-24 py-16"
    >
      <div className="max-w-5xl mx-auto px-8 sm:px-12">
        <RibbonHeader
          nameKey="addon_insurance_label"
          taglineKey="addon_insurance_short"
          price="$15"
          included={included}
        />

        <div className="bg-white rounded-2xl border border-ink/10 shadow-sm p-6 sm:p-8 max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <div className="text-[11px] uppercase tracking-widest text-sage font-mono inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              {t("addon_insurance_card_eyebrow")}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-ink/50 font-mono">
              EN | <span className="text-ink/30">ES</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <div className="text-xs text-ink/60 mb-2.5">
                {t("addon_insurance_plans_label")}
              </div>
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
                  {t("addon_insurance_oon")}
                </li>
              </ul>
            </div>

            <div className="sm:border-l sm:border-ink/10 sm:pl-6">
              <div className="text-xs text-ink/60 mb-2.5 inline-flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-sage" />
                {t("addon_insurance_scale_label")}
              </div>
              <div className="flex items-baseline gap-1.5">
                <BadgeDollarSign className="w-5 h-5 text-sage" />
                <span className="font-display text-3xl text-ink">$80</span>
                <span className="text-sm text-ink/60">
                  {t("addon_insurance_scale_range")}
                </span>
              </div>
              <p className="text-xs text-ink/65 mt-2.5 leading-relaxed">
                {t("addon_insurance_scale_body")}
              </p>
            </div>
          </div>
        </div>

        <p className="text-[12px] text-ink/55 italic leading-relaxed text-center mt-6 max-w-2xl mx-auto">
          {t("addon_insurance_footer")}
        </p>
      </div>
    </section>
  );
};
