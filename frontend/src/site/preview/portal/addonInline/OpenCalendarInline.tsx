import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { useI18n } from "@site/lib/i18n";
import type { StringKey } from "@site/lib/strings";
import { RibbonHeader } from "./RibbonHeader";

export const OpenCalendarInline = ({ included }: { included?: boolean }) => {
  const { t } = useI18n();
  const days: { dayKey: StringKey; date: string; status: "full" | "active" | "limited" }[] = [
    { dayKey: "addon_calendar_day_mon", date: "12", status: "full" },
    { dayKey: "addon_calendar_day_tue", date: "13", status: "active" },
    { dayKey: "addon_calendar_day_wed", date: "14", status: "limited" },
    { dayKey: "addon_calendar_day_thu", date: "15", status: "full" },
    { dayKey: "addon_calendar_day_fri", date: "16", status: "full" },
  ];
  return (
    <section id="addon-inline-online_booking" className="ashford-addon-inline scroll-mt-24 py-16">
      <div className="max-w-5xl mx-auto px-8 sm:px-12">
        <RibbonHeader
          nameKey="addon_calendar_label"
          taglineKey="addon_calendar_short"
          price="$20"
          included={included}
        />

        <div className="bg-white rounded-2xl shadow-sm border border-ink/5 max-w-2xl mx-auto overflow-hidden">
          <div className="p-6 border-b border-ink/5 flex items-center justify-between bg-ink/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sage/10 flex items-center justify-center text-sage">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-medium text-ink">{t("addon_calendar_schedule")}</h4>
                <div className="text-xs text-ink/60">{t("addon_calendar_with")}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-ink">{t("addon_calendar_minutes")}</div>
              <div className="text-xs text-ink/50">{t("addon_calendar_video")}</div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {/* Days strip */}
            <div className="flex justify-between mb-8">
              {days.map((d, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className="text-[10px] uppercase tracking-wider text-ink/50 font-medium">{t(d.dayKey)}</div>
                  <button className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors
                    ${d.status === 'active' ? 'bg-sage text-white shadow-md' :
                      d.status === 'full' ? 'text-ink/30 cursor-not-allowed line-through decoration-ink/20' :
                      'text-ink hover:bg-ink/5'}
                  `}>
                    {d.date}
                  </button>
                  <div className="w-1 h-1 rounded-full bg-sage/40 opacity-0 data-[show=true]:opacity-100" data-show={d.status === 'limited'}></div>
                </div>
              ))}
            </div>

            {/* Times */}
            <div className="mb-8">
              <h5 className="text-sm font-medium text-ink mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-ink/40" /> {t("addon_calendar_tuesday")}
              </h5>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button className="py-2.5 rounded-lg border border-ink/10 text-sm text-ink hover:border-sage hover:text-sage transition-colors">10:00 AM</button>
                <button className="py-2.5 rounded-lg border border-ink/10 text-sm text-ink hover:border-sage hover:text-sage transition-colors">11:30 AM</button>
                <button className="py-2.5 rounded-lg border-2 border-sage bg-sage/5 text-sm font-medium text-sage">2:00 PM</button>
                <button className="py-2.5 rounded-lg border border-ink/10 text-sm text-ink hover:border-sage hover:text-sage transition-colors">4:30 PM</button>
              </div>
            </div>

            {/* Confirmation CTA */}
            <div className="bg-paper p-5 rounded-xl border border-ink/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-ink">{t("addon_calendar_consult_summary")}</div>
                <div className="text-xs text-ink/60 font-[var(--font-serif)]">{t("addon_calendar_consult_label")}</div>
              </div>
              <button className="px-6 py-2.5 bg-sage text-white text-sm font-medium rounded-lg hover:bg-sage-light transition-colors shadow-sm whitespace-nowrap">
                {t("addon_calendar_book_slot")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
