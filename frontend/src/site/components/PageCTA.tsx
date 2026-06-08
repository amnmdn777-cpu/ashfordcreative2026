import { useChatbot } from "./ChatbotProvider";
import { useI18n } from "@site/lib/i18n";

export function PageCTA() {
  const { open } = useChatbot();
  const { t } = useI18n();
  return (
    <section className="py-24 px-6 lg:px-12 bg-ink-deep text-cream">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="font-display text-3xl md:text-5xl mb-5 leading-tight">
          {t("cta_title")}
        </h2>
        <p className="text-base md:text-lg text-cream/75 mb-10 max-w-xl mx-auto leading-relaxed">
          {t("cta_subtitle")}
        </p>
        <button
          onClick={open}
          className="px-8 py-4 bg-gold text-ink font-medium hover:bg-cream transition-all rounded-sm"
        >
          {t("talk_to_us")}
        </button>
      </div>
    </section>
  );
}
