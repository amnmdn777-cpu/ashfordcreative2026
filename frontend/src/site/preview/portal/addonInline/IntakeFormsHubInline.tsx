import { ClipboardList, FileSignature, Lock, Smartphone } from "lucide-react";
import { useI18n } from "@site/lib/i18n";
import type { StringKey } from "@site/lib/strings";
import { RibbonHeader } from "./RibbonHeader";

/**
 * Inline preview for `intake_forms_hub`. Phone mockup of the patient
 * intake-form experience plus a "form library" panel showing what the
 * front desk gets back.
 */
export const IntakeFormsHubInline = ({ included }: { included?: boolean }) => {
  const { t } = useI18n();
  const forms: { labelKey: StringKey; state: "signed" | "pending" | "skipped" }[] = [
    { labelKey: "addon_intake_form_intake", state: "signed" },
    { labelKey: "addon_intake_form_consent", state: "signed" },
    { labelKey: "addon_intake_form_telehealth", state: "signed" },
    { labelKey: "addon_intake_form_sliding", state: "pending" },
    { labelKey: "addon_intake_form_release", state: "skipped" },
  ];
  const stateLabel: Record<"signed" | "pending" | "skipped", StringKey> = {
    signed: "addon_intake_state_signed",
    pending: "addon_intake_state_pending",
    skipped: "addon_intake_state_skipped",
  };
  const options = [
    { labelKey: "addon_intake_opt_current" as StringKey, active: false },
    { labelKey: "addon_intake_opt_past" as StringKey, active: true },
    { labelKey: "addon_intake_opt_no" as StringKey, active: false },
  ];

  return (
    <section
      id="addon-inline-intake_forms_hub"
      className="ashford-addon-inline scroll-mt-24 py-16"
    >
      <div className="max-w-5xl mx-auto px-8 sm:px-12">
        <RibbonHeader
          nameKey="addon_intake_label"
          taglineKey="addon_intake_short"
          price="$15"
          included={included}
        />

        <div className="grid md:grid-cols-[260px,1fr] gap-6 max-w-3xl mx-auto items-start">
          {/* Phone mockup */}
          <div className="bg-ink-deep rounded-[28px] p-2 shadow-xl mx-auto md:mx-0">
            <div className="bg-cream rounded-[22px] overflow-hidden">
              <div className="bg-sage text-cream px-4 py-3 flex items-center gap-2">
                <Smartphone className="w-3.5 h-3.5" />
                <span className="text-[11px] font-mono uppercase tracking-widest">
                  {t("addon_intake_phone_url")}
                </span>
              </div>
              <div className="p-4 space-y-3">
                <div className="text-[10px] uppercase tracking-widest text-sage font-mono">
                  {t("addon_intake_step_label")}
                </div>
                <div className="text-sm font-medium text-ink leading-tight">
                  {t("addon_intake_question")}
                </div>
                <div className="space-y-1.5">
                  {options.map((o) => (
                    <button
                      key={o.labelKey}
                      type="button"
                      className={
                        "w-full text-left text-xs px-3 py-2 rounded-lg border transition-colors " +
                        (o.active
                          ? "border-sage bg-sage/5 text-sage font-medium"
                          : "border-ink/15 text-ink/80")
                      }
                    >
                      {t(o.labelKey)}
                    </button>
                  ))}
                </div>
                <div className="pt-2 border-t border-ink/5 flex items-center justify-between">
                  <Lock className="w-3 h-3 text-ink/40" />
                  <button
                    type="button"
                    className="text-[11px] bg-ink text-cream px-3 py-1.5 rounded-md font-medium"
                  >
                    {t("addon_intake_sign_continue")}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Form library */}
          <div className="bg-white rounded-2xl border border-ink/10 shadow-sm p-5">
            <div className="text-[11px] uppercase tracking-widest text-ink/55 font-mono mb-3 inline-flex items-center gap-1.5">
              <ClipboardList className="w-3 h-3" />
              {t("addon_intake_library_eyebrow")}
            </div>
            <ul className="space-y-2.5">
              {forms.map((f) => (
                <li
                  key={f.labelKey}
                  className="flex items-center justify-between gap-3 text-sm border-b border-ink/5 pb-2 last:border-0 last:pb-0"
                >
                  <span
                    className={
                      f.state === "skipped"
                        ? "text-ink/40 line-through"
                        : "text-ink/85"
                    }
                  >
                    {t(f.labelKey)}
                  </span>
                  <span
                    className={
                      "text-[10px] uppercase tracking-widest font-mono " +
                      (f.state === "signed"
                        ? "text-sage"
                        : f.state === "pending"
                          ? "text-gold"
                          : "text-ink/35")
                    }
                  >
                    {t(stateLabel[f.state])}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="text-[12px] text-ink/55 italic leading-relaxed text-center mt-6 max-w-2xl mx-auto inline-flex items-center justify-center gap-1.5 w-full">
          <FileSignature className="w-3 h-3" />
          {t("addon_intake_footer")}
        </p>
      </div>
    </section>
  );
};
