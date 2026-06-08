import { LifeBuoy, Phone, MessageSquare } from "lucide-react";
import type { TemplateContent } from "./types";
import { useI18n } from "@site/lib/i18n";

/** Always-rendered baseline crisis resources block. Required on every template. */
export function CrisisFooter({ content }: { content: TemplateContent }) {
  const { t } = useI18n();
  return (
    <section className="px-6 lg:px-12 py-10 border-t pal-bg-pp-6-on-ps pal-text-pi pal-border-pp-18">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <LifeBuoy className="w-4 h-4 pal-text-pp" />
          <span className="font-mono text-[11px] tracking-[0.2em] uppercase pal-text-pp">
            {t("crisis_eyebrow")}
          </span>
        </div>
        <p className="text-base leading-relaxed mb-4 max-w-3xl">
          {t("crisis_body", { practiceName: content.practiceName })}
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <a href="tel:988" className="inline-flex items-center gap-2 px-4 py-2 rounded-sm font-medium pal-bg-pp pal-text-ps">
            <Phone className="w-3.5 h-3.5" /> {t("crisis_call_988")}
          </a>
          <a href="sms:741741?body=HELLO" className="inline-flex items-center gap-2 px-4 py-2 rounded-sm font-medium border pal-border-pp pal-text-pp">
            <MessageSquare className="w-3.5 h-3.5" /> {t("crisis_text_741")}
          </a>
        </div>
        <p className="text-xs mt-6 pal-text-pm">
          {t("crisis_disclaimer", { practiceName: content.practiceName })}
        </p>
      </div>
    </section>
  );
}
