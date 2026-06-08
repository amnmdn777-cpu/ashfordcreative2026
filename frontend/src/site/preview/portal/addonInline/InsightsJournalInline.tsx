import { useI18n } from "@site/lib/i18n";
import { RibbonHeader } from "./RibbonHeader";

export const InsightsJournalInline = ({ included }: { included?: boolean }) => {
  const { t } = useI18n();
  return (
    <section id="addon-inline-blog_publishing" className="ashford-addon-inline scroll-mt-24 py-16">
      <div className="max-w-5xl mx-auto px-8 sm:px-12">
        <RibbonHeader
          nameKey="addon_blog_label"
          taglineKey="addon_blog_short"
          price="$10"
          included={included}
        />

        <div className="grid md:grid-cols-3 gap-8">
          {/* Post 1 */}
          <div className="flex flex-col group cursor-pointer">
            <div className="aspect-[4/3] bg-ink/5 rounded-xl mb-5 overflow-hidden border border-ink/10 flex items-center justify-center">
              <div className="w-full h-full bg-gradient-to-br from-paper to-cream flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border border-ink/10 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-sage/40"></div>
                </div>
              </div>
            </div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-sage mb-3">{t("addon_blog_p1_cat")}</div>
            <h4 className="font-[var(--font-display)] text-xl text-ink mb-3 group-hover:text-sage transition-colors">{t("addon_blog_p1_title")}</h4>
            <p className="font-[var(--font-serif)] text-sm text-ink/70 line-clamp-2 mb-4 flex-grow">
              {t("addon_blog_p1_excerpt")}
            </p>
            <div className="text-xs text-ink/40 font-medium">{t("addon_blog_p1_read")}</div>
          </div>

          {/* Post 2 */}
          <div className="flex flex-col group cursor-pointer">
            <div className="aspect-[4/3] bg-ink/5 rounded-xl mb-5 overflow-hidden border border-ink/10 flex items-center justify-center">
              <div className="w-full h-full bg-gradient-to-tr from-paper to-cream flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border border-ink/10 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-gold/40"></div>
                </div>
              </div>
            </div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-sage mb-3">{t("addon_blog_p2_cat")}</div>
            <h4 className="font-[var(--font-display)] text-xl text-ink mb-3 group-hover:text-sage transition-colors">{t("addon_blog_p2_title")}</h4>
            <p className="font-[var(--font-serif)] text-sm text-ink/70 line-clamp-2 mb-4 flex-grow">
              {t("addon_blog_p2_excerpt")}
            </p>
            <div className="text-xs text-ink/40 font-medium">{t("addon_blog_p2_read")}</div>
          </div>

          {/* Post 3 */}
          <div className="flex flex-col group cursor-pointer">
            <div className="aspect-[4/3] bg-ink/5 rounded-xl mb-5 overflow-hidden border border-ink/10 flex items-center justify-center">
              <div className="w-full h-full bg-gradient-to-b from-paper to-cream flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border border-ink/10 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-ink/20"></div>
                </div>
              </div>
            </div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-sage mb-3">{t("addon_blog_p3_cat")}</div>
            <h4 className="font-[var(--font-display)] text-xl text-ink mb-3 group-hover:text-sage transition-colors">{t("addon_blog_p3_title")}</h4>
            <p className="font-[var(--font-serif)] text-sm text-ink/70 line-clamp-2 mb-4 flex-grow">
              {t("addon_blog_p3_excerpt")}
            </p>
            <div className="text-xs text-ink/40 font-medium">{t("addon_blog_p3_read")}</div>
          </div>
        </div>
      </div>
    </section>
  );
};
