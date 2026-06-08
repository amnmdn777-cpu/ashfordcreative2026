import { Mail, FileText, Camera, Car, Calendar } from "lucide-react";
import { useI18n } from "@site/lib/i18n";
import { RibbonHeader } from "./RibbonHeader";

/**
 * Inline preview for `welcome_kit`. Adapts the small click-preview
 * (components/addons/preview/WelcomeKitPreview.tsx) into a full-width
 * branded section that lives under the template route, matching the
 * Online Booking inline layout (RibbonHeader + max-w-5xl card).
 *
 * `practitionerName` flows down from ProspectPortal so a real prospect
 * (e.g. Aaron Edmiston / Blueprint Therapy Services) sees their own
 * name as the email "from" address — never the SAMPLE "Dr. Maya
 * Alvarado". Sample portals (no real lead) still receive Maya as the
 * default because that's what `personalizedContent.team[0].name`
 * resolves to from `SAMPLES`.
 */
export const WelcomeKitInline = ({
  practitionerName,
  included,
}: {
  practitionerName?: string;
  included?: boolean;
}) => {
  const { t } = useI18n();
  const fromName = practitionerName?.trim() || "Dr. Maya Alvarado";
  return (
    <section
      id="addon-inline-welcome_kit"
      className="ashford-addon-inline scroll-mt-24 py-16"
    >
      <div className="max-w-5xl mx-auto px-8 sm:px-12">
        <RibbonHeader
          nameKey="addon_welcome_kit_label"
          taglineKey="addon_welcome_kit_short"
          price="$10"
          included={included}
        />

        {/* #221 — was `grid md:grid-cols-[1fr,auto] max-w-3xl mx-auto`
            with a 260px cap on the side panel. On iPad portrait that
            combo collapsed: the email card hogged the 768px row and
            the "front-desk button" card wrapped under it but stayed
            stuck to ~260px on the left, looking like a stranded
            sidebar. Switched to a 2fr/1fr split that only activates
            at lg+ (so the side card always stacks cleanly at iPad
            widths and below) and dropped both width caps so the
            stacked card spans the full max-w-5xl section width like
            its sibling. */}
        <div className="grid lg:grid-cols-[2fr,1fr] gap-6 items-start">
          <div className="bg-white rounded-2xl border border-ink/10 overflow-hidden shadow-sm">
            <div className="border-b border-ink/10 px-5 py-3 flex items-center gap-2.5 bg-cream/50">
              <Mail className="w-4 h-4 text-sage" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-ink truncate font-medium">
                  {t("addon_welcome_email_subject")}
                </div>
                <div className="text-[11px] text-ink/55 truncate">
                  {t("addon_welcome_email_from", { practitioner: fromName })}
                </div>
              </div>
            </div>

            <div className="p-6 space-y-3">
              <div className="text-[11px] uppercase tracking-widest text-ink/55 font-mono">
                {t("addon_welcome_email_greeting")}
              </div>
              <p className="text-sm text-ink/85 leading-relaxed">
                {t("addon_welcome_email_body_pre")}{" "}
                <span className="text-sage font-medium">
                  {t("addon_welcome_email_body_when")}
                </span>
                . {t("addon_welcome_email_body_post")}
              </p>
              <ul className="space-y-2 pl-1 text-sm text-ink/80 pt-1">
                <li className="flex items-start gap-2.5">
                  <FileText className="w-3.5 h-3.5 mt-0.5 text-sage shrink-0" />
                  <span>{t("addon_welcome_email_item_intake")}</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Camera className="w-3.5 h-3.5 mt-0.5 text-sage shrink-0" />
                  <span>{t("addon_welcome_email_item_insurance")}</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Car className="w-3.5 h-3.5 mt-0.5 text-sage shrink-0" />
                  <span>{t("addon_welcome_email_item_parking")}</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Calendar className="w-3.5 h-3.5 mt-0.5 text-sage shrink-0" />
                  <span>{t("addon_welcome_email_item_calendar")}</span>
                </li>
              </ul>
              <p className="text-sm text-ink/70 leading-relaxed pt-2 italic font-[var(--font-serif)]">
                {t("addon_welcome_email_signoff")}
              </p>
            </div>
          </div>

          <div className="bg-cream rounded-2xl border border-ink/10 p-5 w-full">
            <div className="text-[11px] uppercase tracking-widest text-ink/55 font-mono mb-2">
              {t("addon_welcome_what_eyebrow")}
            </div>
            <p className="text-sm text-ink/75 leading-relaxed">
              {t("addon_welcome_what_body")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
