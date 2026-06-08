import { Mail, FileText, Camera, Car, Calendar } from "lucide-react";
import { useI18n } from "@site/lib/i18n";

/**
 * Click-preview drawer body for `welcome_kit`. Renders a faux email
 * preview of the on-brand welcome message, plus a tiny checklist of
 * the eight things the front-desk button automates so the gatekeeper
 * sees their workload shrink in one image.
 *
 * `practitionerName` flows down from AddonPreviewDrawer (via the
 * portal's drawer mount) so a real prospect (e.g. Aaron Edmiston /
 * Blueprint Therapy Services) sees their own name as the email
 * "from" address — never the SAMPLE "Dr. Maya Alvarado". Sample
 * surfaces (Pricing marketing page, public TemplateRoute) omit the
 * prop and fall back to Maya, matching the inline section pattern
 * landed in #219. Copy is i18n via `addon_welcome_email_*` keys
 * (shared with WelcomeKitInline).
 */
export const WelcomeKitPreview = ({
  practitionerName,
}: {
  practitionerName?: string;
}) => {
  const { t } = useI18n();
  const fromName = practitionerName?.trim() || "Dr. Maya Alvarado";
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-ink/10 overflow-hidden">
        <div className="border-b border-ink/10 px-4 py-3 flex items-center gap-2 bg-cream/50">
          <Mail className="w-4 h-4 text-sage" />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] text-ink truncate">
              {t("addon_welcome_email_subject")}
            </div>
            <div className="text-[10px] text-ink/55 truncate">
              {t("addon_welcome_email_from", { practitioner: fromName })}
            </div>
          </div>
        </div>

        <div className="p-5 space-y-3">
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
          <ul className="space-y-1.5 pl-1 text-sm text-ink/80">
            <li className="flex items-start gap-2">
              <FileText className="w-3.5 h-3.5 mt-0.5 text-sage shrink-0" />
              <span>{t("addon_welcome_email_item_intake")}</span>
            </li>
            <li className="flex items-start gap-2">
              <Camera className="w-3.5 h-3.5 mt-0.5 text-sage shrink-0" />
              <span>{t("addon_welcome_email_item_insurance")}</span>
            </li>
            <li className="flex items-start gap-2">
              <Car className="w-3.5 h-3.5 mt-0.5 text-sage shrink-0" />
              <span>{t("addon_welcome_email_item_parking")}</span>
            </li>
            <li className="flex items-start gap-2">
              <Calendar className="w-3.5 h-3.5 mt-0.5 text-sage shrink-0" />
              <span>{t("addon_welcome_email_item_calendar")}</span>
            </li>
          </ul>
          <p className="text-sm text-ink/70 leading-relaxed pt-2 italic">
            {t("addon_welcome_email_signoff")}
          </p>
        </div>
      </div>

      <div className="bg-cream-warm rounded-xl border border-ink/10 p-4">
        <div className="text-[11px] uppercase tracking-widest text-ink/55 font-mono mb-2">
          {t("addon_welcome_what_eyebrow")}
        </div>
        <p className="text-sm text-ink/75 leading-relaxed">
          {t("addon_welcome_what_body")}
        </p>
      </div>
    </div>
  );
};
