import { useI18n } from "@site/lib/i18n";
import { RibbonHeader } from "./RibbonHeader";

export const AlwaysOnSpanishInline = ({ included }: { included?: boolean }) => {
  const { t } = useI18n();
  return (
    <section id="addon-inline-spanish_pro" className="ashford-addon-inline scroll-mt-24 py-16">
      <div className="max-w-5xl mx-auto px-8 sm:px-12">
        <RibbonHeader
          nameKey="addon_spanish_pro_label"
          taglineKey="addon_spanish_pro_short"
          price="$10"
          included={included}
        />

        <div className="bg-white rounded-2xl shadow-sm border border-ink/5 overflow-hidden">
          <div className="border-b border-ink/5 bg-ink/[0.02] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-ink">{t("addon_spanish_pro_section")}</span>
              <div className="flex items-center bg-white border border-ink/10 rounded-full p-0.5 shadow-sm">
                <span className="px-3 py-1 text-xs font-medium text-ink bg-paper rounded-full shadow-sm">En</span>
                <span className="px-3 py-1 text-xs font-medium text-ink/50">Es</span>
              </div>
            </div>
            <span className="text-xs text-ink/40 font-mono">/services/approach</span>
          </div>

          <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-ink/5">
            <div className="p-8">
              <div className="text-xs font-mono uppercase tracking-widest text-sage mb-4">{t("addon_spanish_pro_orig")}</div>
              <h4 className="font-[var(--font-display)] text-2xl text-ink mb-4">{t("addon_spanish_pro_orig_h")}</h4>
              <p className="font-[var(--font-serif)] text-ink/80 leading-relaxed mb-4">
                {t("addon_spanish_pro_orig_p1")}
              </p>
              <p className="font-[var(--font-serif)] text-ink/80 leading-relaxed">
                {t("addon_spanish_pro_orig_p2")}
              </p>
            </div>
            <div className="p-8 bg-ink/[0.01]">
              <div className="text-xs font-mono uppercase tracking-widest text-sage mb-4 flex items-center gap-2">
                {t("addon_spanish_pro_translated")}
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-sage-light"></span>
              </div>
              <h4 className="font-[var(--font-display)] text-2xl text-ink mb-4">{t("addon_spanish_pro_es_h")}</h4>
              <p className="font-[var(--font-serif)] text-ink/80 leading-relaxed mb-4">
                {t("addon_spanish_pro_es_p1")}
              </p>
              <p className="font-[var(--font-serif)] text-ink/80 leading-relaxed">
                {t("addon_spanish_pro_es_p2")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
