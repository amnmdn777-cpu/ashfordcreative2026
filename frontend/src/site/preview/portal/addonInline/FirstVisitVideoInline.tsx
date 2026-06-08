import { Play, Volume2, Captions } from "lucide-react";
import { useI18n } from "@site/lib/i18n";
import { RibbonHeader } from "./RibbonHeader";

/** Inline preview for `first_visit_video`. Faux player + shoot panel. */
export const FirstVisitVideoInline = ({ included }: { included?: boolean }) => {
  const { t } = useI18n();
  return (
    <section
      id="addon-inline-first_visit_video"
      className="ashford-addon-inline scroll-mt-24 py-16"
    >
      <div className="max-w-5xl mx-auto px-8 sm:px-12">
        <RibbonHeader
          nameKey="addon_video_label"
          taglineKey="addon_video_short"
          price="$15"
          included={included}
        />

        <div className="grid md:grid-cols-[1.4fr,1fr] gap-6 max-w-3xl mx-auto items-start">
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-gradient-to-br from-sage/30 via-cream to-gold/30 border border-ink/10 shadow-sm">
            <div className="absolute inset-0 opacity-30 pal-fvv-glow" />

            <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-[10px] uppercase tracking-widest font-mono text-ink/70">
              <span>{t("addon_video_player_title")}</span>
              <span className="bg-ink/80 text-cream px-2 py-0.5 rounded">
                0:58
              </span>
            </div>

            <div className="absolute inset-0 flex items-center justify-center">
              <button
                type="button"
                aria-label={t("addon_video_play_aria")}
                className="w-16 h-16 rounded-full bg-cream/95 text-ink shadow-2xl flex items-center justify-center hover:scale-105 transition-transform"
              >
                <Play className="w-7 h-7 ml-1" fill="currentColor" />
              </button>
            </div>

            <div className="absolute bottom-3 inset-x-3">
              <div className="flex items-center gap-3 text-cream/90 text-xs">
                <Volume2 className="w-3.5 h-3.5" />
                <div className="flex-1 h-1 rounded-full bg-cream/30 overflow-hidden">
                  <div className="h-full w-2/5 bg-cream/90 rounded-full" />
                </div>
                <Captions className="w-3.5 h-3.5" />
              </div>
              <div className="mt-2 inline-block bg-ink/85 text-cream text-[11px] px-2.5 py-1 rounded leading-snug max-w-[85%]">
                {t("addon_video_caption")}
              </div>
            </div>
          </div>

          <div className="bg-paper rounded-2xl border border-ink/10 p-5">
            <div className="text-[11px] uppercase tracking-widest text-ink/55 font-mono mb-3">
              {t("addon_video_shoot_eyebrow")}
            </div>
            <ul className="space-y-2 text-sm text-ink/85">
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-sage mt-2 shrink-0" />
                <span>{t("addon_video_shoot_b1")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-sage mt-2 shrink-0" />
                <span>{t("addon_video_shoot_b2")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-sage mt-2 shrink-0" />
                <span>{t("addon_video_shoot_b3")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-sage mt-2 shrink-0" />
                <span>{t("addon_video_shoot_b4")}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};
