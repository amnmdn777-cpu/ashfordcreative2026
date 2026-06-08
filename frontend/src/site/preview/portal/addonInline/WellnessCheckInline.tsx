import { Lock } from "lucide-react";
import { useI18n } from "@site/lib/i18n";
import { RibbonHeader } from "./RibbonHeader";

export const WellnessCheckInline = ({ included }: { included?: boolean }) => {
  const { t } = useI18n();
  return (
    <section id="addon-inline-phq9_screener" className="ashford-addon-inline scroll-mt-24 py-16">
      <div className="max-w-5xl mx-auto px-8 sm:px-12">
        <RibbonHeader
          nameKey="addon_phq9_label"
          taglineKey="addon_phq9_short"
          price="$20"
          included={included}
        />

        <div className="bg-white rounded-2xl shadow-sm border border-ink/5 max-w-2xl mx-auto p-8 sm:p-10">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-8">
            <div className="flex-1 h-1.5 bg-sage rounded-full"></div>
            <div className="flex-1 h-1.5 bg-sage rounded-full"></div>
            <div className="flex-1 h-1.5 bg-sage rounded-full"></div>
            <div className="flex-1 h-1.5 bg-sage rounded-full"></div>
            <div className="flex-1 h-1.5 bg-ink/10 rounded-full"></div>
            <div className="flex-1 h-1.5 bg-ink/10 rounded-full"></div>
            <div className="flex-1 h-1.5 bg-ink/10 rounded-full"></div>
            <div className="flex-1 h-1.5 bg-ink/10 rounded-full"></div>
            <div className="flex-1 h-1.5 bg-ink/10 rounded-full"></div>
            <span className="text-[10px] font-mono text-ink/40 ml-2">4/9</span>
          </div>

          <h4 className="font-[var(--font-display)] text-2xl text-ink leading-tight mb-8">
            {t("addon_phq9_question")}
          </h4>

          <div className="space-y-3 mb-10">
            <label className="flex items-center gap-4 p-4 rounded-xl border border-ink/10 cursor-pointer hover:bg-ink/[0.02] transition-colors">
              <div className="w-5 h-5 rounded-full border border-ink/20 flex shrink-0"></div>
              <span className="text-ink/80 text-sm">{t("addon_phq9_opt1")}</span>
            </label>

            <label className="flex items-center gap-4 p-4 rounded-xl border-2 border-sage bg-sage/[0.03] cursor-pointer">
              <div className="w-5 h-5 rounded-full border-2 border-sage flex shrink-0 items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-sage"></div>
              </div>
              <span className="text-ink font-medium text-sm">{t("addon_phq9_opt2")}</span>
            </label>

            <label className="flex items-center gap-4 p-4 rounded-xl border border-ink/10 cursor-pointer hover:bg-ink/[0.02] transition-colors">
              <div className="w-5 h-5 rounded-full border border-ink/20 flex shrink-0"></div>
              <span className="text-ink/80 text-sm">{t("addon_phq9_opt3")}</span>
            </label>

            <label className="flex items-center gap-4 p-4 rounded-xl border border-ink/10 cursor-pointer hover:bg-ink/[0.02] transition-colors">
              <div className="w-5 h-5 rounded-full border border-ink/20 flex shrink-0"></div>
              <span className="text-ink/80 text-sm">{t("addon_phq9_opt4")}</span>
            </label>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-ink/50 font-medium">
            <Lock className="w-3.5 h-3.5" />
            {t("addon_phq9_disclaimer")}
          </div>
        </div>
      </div>
    </section>
  );
};
