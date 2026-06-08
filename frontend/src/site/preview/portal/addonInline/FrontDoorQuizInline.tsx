import { CheckCircle2 } from "lucide-react";
import { useI18n } from "@site/lib/i18n";
import { RibbonHeader } from "./RibbonHeader";

export const FrontDoorQuizInline = ({ included }: { included?: boolean }) => {
  const { t } = useI18n();
  return (
    <section id="addon-inline-ai_quiz" className="ashford-addon-inline scroll-mt-24 py-16">
      <div className="max-w-5xl mx-auto px-8 sm:px-12">
        <RibbonHeader
          nameKey="addon_quiz_label"
          taglineKey="addon_quiz_short"
          price="$35"
          included={included}
        />

        <div className="max-w-2xl mx-auto space-y-4">
          {/* Step 1: Collapsed/Completed */}
          <div className="bg-white/60 rounded-2xl p-5 border border-ink/5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <CheckCircle2 className="w-5 h-5 text-sage" />
              <div>
                <div className="text-xs font-medium text-ink/50 uppercase tracking-widest mb-1">
                  {t("addon_quiz_step_label", { n: 1 })}
                </div>
                <div className="text-sm text-ink font-medium">{t("addon_quiz_step1_q")}</div>
              </div>
            </div>
            <div className="text-sm text-ink/70 font-[var(--font-serif)] bg-white px-3 py-1.5 rounded-md shadow-sm border border-ink/5">
              {t("addon_quiz_step1_a")}
            </div>
          </div>

          {/* Step 2: Active */}
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-ink/10 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-sage"></div>

            <div className="text-xs font-medium text-sage uppercase tracking-widest mb-2">
              {t("addon_quiz_step_of", { n: 2, total: 3 })}
            </div>
            <h4 className="font-[var(--font-display)] text-2xl text-ink mb-6">{t("addon_quiz_step2_q")}</h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="border border-ink/10 rounded-xl p-4 cursor-pointer hover:bg-ink/[0.02] transition-colors flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-ink/5 flex items-center justify-center">
                  <div className="w-6 h-1 flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-ink/30 animate-pulse"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-ink/30 animate-pulse [animation-delay:200ms]"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-ink/30 animate-pulse [animation-delay:400ms]"></div>
                  </div>
                </div>
                <span className="text-sm font-medium text-ink/80">{t("addon_quiz_step2_opt1")}</span>
              </div>

              <div className="border-2 border-sage bg-sage/5 rounded-xl p-4 cursor-pointer flex flex-col items-center text-center gap-3 relative shadow-sm">
                <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-sage flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
                <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center border border-sage/20">
                  <div className="w-4 h-4 border-2 border-sage border-t-transparent rounded-full transform rotate-45"></div>
                </div>
                <span className="text-sm font-medium text-ink">{t("addon_quiz_step2_opt2")}</span>
              </div>

              <div className="border border-ink/10 rounded-xl p-4 cursor-pointer hover:bg-ink/[0.02] transition-colors flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-ink/5 flex items-center justify-center">
                  <div className="w-4 h-4 border border-ink/40 rounded-full flex items-center justify-center">
                    <div className="w-0.5 h-2 bg-ink/40 -mt-1"></div>
                  </div>
                </div>
                <span className="text-sm font-medium text-ink/80">{t("addon_quiz_step2_opt3")}</span>
              </div>

              <div className="border border-ink/10 rounded-xl p-4 cursor-pointer hover:bg-ink/[0.02] transition-colors flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-ink/5 flex items-center justify-center">
                  <div className="w-5 h-2.5 rounded-full bg-ink/20"></div>
                </div>
                <span className="text-sm font-medium text-ink/80">{t("addon_quiz_step2_opt4")}</span>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button className="px-6 py-2.5 bg-ink text-white text-sm font-medium rounded-lg hover:bg-ink-deep transition-colors shadow-sm">
                {t("addon_quiz_continue")}
              </button>
            </div>
          </div>

          {/* Step 3: Preview/Locked */}
          <div className="bg-ink/[0.02] rounded-2xl p-5 border border-ink/5 border-dashed flex items-center justify-between opacity-60">
            <div className="flex items-center gap-4">
              <div className="w-5 h-5 rounded-full border-2 border-ink/20"></div>
              <div>
                <div className="text-xs font-medium text-ink/40 uppercase tracking-widest mb-1">
                  {t("addon_quiz_step_label", { n: 3 })}
                </div>
                <div className="text-sm text-ink/60 font-medium">{t("addon_quiz_step3_text")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
