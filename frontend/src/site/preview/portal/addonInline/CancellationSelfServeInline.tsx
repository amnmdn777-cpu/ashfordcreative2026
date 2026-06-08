import { CalendarX2, ArrowRight, Sun, Sunrise } from "lucide-react";
import { useI18n } from "@site/lib/i18n";
import { RibbonHeader } from "./RibbonHeader";

/**
 * Inline preview for `cancellation_self_serve`. Full-width companion to
 * the small click-preview drawer body, rendered under the template
 * route when the chip is selected.
 */
export const CancellationSelfServeInline = ({ included }: { included?: boolean }) => {
  const { t } = useI18n();
  const slots = [
    { label: t("addon_cancel_slot_1"), active: true },
    { label: t("addon_cancel_slot_2"), active: false },
    { label: t("addon_cancel_slot_3"), active: false },
    { label: t("addon_cancel_slot_4"), active: false },
  ];
  return (
    <section
      id="addon-inline-cancellation_self_serve"
      className="ashford-addon-inline scroll-mt-24 py-16"
    >
      <div className="max-w-5xl mx-auto px-8 sm:px-12">
        <RibbonHeader
          nameKey="addon_cancel_label"
          taglineKey="addon_cancel_short"
          price="$10"
          included={included}
        />

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Patient side */}
          <div className="bg-white rounded-2xl border border-ink/10 overflow-hidden shadow-sm">
            <div className="border-b border-ink/5 px-5 py-3 bg-cream/40 flex items-center gap-2">
              <CalendarX2 className="w-3.5 h-3.5 text-ink/55" />
              <span className="text-[11px] uppercase tracking-widest text-ink/55 font-mono">
                {t("addon_cancel_patient_eyebrow")}
              </span>
            </div>

            <div className="p-5">
              <div className="text-sm text-ink/85 mb-4 leading-relaxed">
                {t("addon_cancel_prompt_pre")}{" "}
                <strong>{t("addon_cancel_prompt_when")}</strong>{" "}
                {t("addon_cancel_prompt_post")}
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                {slots.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    className={
                      "border rounded-md py-2 px-3 text-xs transition-colors " +
                      (s.active
                        ? "border-sage bg-sage/5 text-sage font-medium"
                        : "border-ink/10 text-ink/70")
                    }
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="w-full bg-ink text-cream rounded-md py-2.5 text-sm font-medium inline-flex items-center justify-center gap-1.5"
              >
                {t("addon_cancel_confirm")}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="text-[11px] text-ink/55 mt-2 text-center">
                {t("addon_cancel_window")}
              </div>
            </div>
          </div>

          {/* Front-desk side */}
          <div className="bg-paper rounded-2xl border border-ink/10 overflow-hidden">
            <div className="border-b border-ink/10 px-5 py-3 flex items-center gap-2">
              <Sunrise className="w-3.5 h-3.5 text-gold" />
              <span className="text-[11px] uppercase tracking-widest text-ink/55 font-mono">
                {t("addon_cancel_desk_eyebrow")}
              </span>
            </div>

            <div className="p-5 space-y-2.5 text-sm">
              <div className="flex items-start gap-2 text-ink/85">
                <span className="text-sage font-mono text-xs mt-0.5">↻</span>
                <span>
                  <strong>Sarah W.</strong>{" "}
                  {t("addon_cancel_desk_line1_action")}{" "}
                  <strong>{t("addon_cancel_desk_line1_to")}</strong>
                </span>
              </div>
              <div className="flex items-start gap-2 text-ink/85">
                <span className="text-gold font-mono text-xs mt-0.5">+</span>
                <span>
                  <strong>James R.</strong>{" "}
                  {t("addon_cancel_desk_line2")}
                </span>
              </div>
              <div className="flex items-start gap-2 text-ink/55">
                <Sun className="w-3 h-3 mt-0.5 text-ink/40" />
                <span>{t("addon_cancel_desk_line3")}</span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-[12px] text-ink/55 italic leading-relaxed text-center mt-6 max-w-2xl mx-auto">
          {t("addon_cancel_footer")}
        </p>
      </div>
    </section>
  );
};
