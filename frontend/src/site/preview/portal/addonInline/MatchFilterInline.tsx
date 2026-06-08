import { useI18n } from "@site/lib/i18n";
import { RibbonHeader } from "./RibbonHeader";

export const MatchFilterInline = ({ included }: { included?: boolean }) => {
  const { t } = useI18n();
  return (
    <section id="addon-inline-modalities_filter" className="ashford-addon-inline scroll-mt-24 py-16">
      <div className="max-w-5xl mx-auto px-8 sm:px-12">
        <RibbonHeader
          nameKey="addon_match_label"
          taglineKey="addon_match_short"
          price="$15"
          included={included}
        />

        <div className="bg-white rounded-2xl shadow-sm border border-ink/5 p-8">
          <div className="mb-6">
            <h4 className="text-sm font-medium text-ink mb-3">{t("addon_match_filter_by")}</h4>
            <div className="flex flex-wrap gap-2">
              <button className="px-4 py-2 rounded-full text-sm border border-ink/10 text-ink/70 hover:border-ink/30 transition-colors">CBT</button>
              <button className="px-4 py-2 rounded-full text-sm border border-sage bg-sage text-white shadow-sm">EMDR</button>
              <button className="px-4 py-2 rounded-full text-sm border border-ink/10 text-ink/70 hover:border-ink/30 transition-colors">ACT</button>
              <button className="px-4 py-2 rounded-full text-sm border border-ink/10 text-ink/70 hover:border-ink/30 transition-colors">IFS</button>
              <button className="px-4 py-2 rounded-full text-sm border border-ink/10 text-ink/70 hover:border-ink/30 transition-colors">DBT</button>
              <button className="px-4 py-2 rounded-full text-sm border border-ink/10 text-ink/70 hover:border-ink/30 transition-colors">Somatic</button>
            </div>
          </div>

          <div className="border-t border-ink/5 pt-6">
            <div className="text-xs font-mono uppercase tracking-widest text-ink/40 mb-4">
              {t("addon_match_count_other", { n: 2 })}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Match 1 */}
              <div className="flex items-center gap-4 p-4 rounded-xl border border-ink/5 bg-paper/50 hover:bg-paper transition-colors cursor-pointer">
                <div className="w-12 h-12 rounded-lg bg-sage/10 flex items-center justify-center shrink-0">
                  <span className="font-[var(--font-display)] text-sage">SO</span>
                </div>
                <div>
                  <div className="font-medium text-ink">Sandra Owner, LCSW-S</div>
                  <div className="text-sm text-ink/60 font-[var(--font-serif)] truncate">{t("addon_match_card1")}</div>
                </div>
              </div>

              {/* Match 2 */}
              <div className="flex items-center gap-4 p-4 rounded-xl border border-ink/5 bg-paper/50 hover:bg-paper transition-colors cursor-pointer">
                <div className="w-12 h-12 rounded-lg bg-ink/5 flex items-center justify-center shrink-0">
                  <span className="font-[var(--font-display)] text-ink/60">ER</span>
                </div>
                <div>
                  <div className="font-medium text-ink">Elena Ramirez, LMFT</div>
                  <div className="text-sm text-ink/60 font-[var(--font-serif)] truncate">{t("addon_match_card2")}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
