import { Video, Coffee, Headphones, Droplet, RotateCw } from "lucide-react";
import { useI18n } from "@site/lib/i18n";

/**
 * Inline preview for `telehealth_bridge`. Renders the branded /visit
 * landing card a patient sees just before the session — your photo +
 * therapist name, calm "before your visit" prep card, one big "Enter
 * waiting room" button, and an inline reschedule link. Goal: prove
 * the prospect that a $25/mo wrapper around their existing Doxy room
 * actually FEELS premium.
 */
export const TelehealthBridgeInline = () => {
  const { locale } = useI18n();
  const es = locale === "es";
  return (
    <section
      id="addon-inline-telehealth_bridge"
      className="ashford-addon-inline scroll-mt-24 py-16"
    >
      <div className="max-w-5xl mx-auto px-8 sm:px-12">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8 pb-6 border-b border-ink/10">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-sage font-medium mb-1.5">
              {es ? "Complemento en vivo" : "Live add-on"}
            </div>
            <h3 className="font-[var(--font-display)] text-3xl text-ink leading-tight">
              {es ? "Puente de telesalud" : "Telehealth Bridge"}
            </h3>
            <p className="text-sm text-ink/70 mt-1.5 font-[var(--font-serif)]">
              {es
                ? "Una página /sesion con tu marca encima de tu sala Doxy o Zoom existente."
                : "A branded /visit page on top of your existing Doxy or Zoom room."}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono text-xs uppercase tracking-widest text-ink/50">
              +$25/{es ? "mes" : "mo"}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest bg-sage/10 text-sage-light px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-sage animate-pulse" />
              {es ? "En tu sitio" : "On your site"}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-ink/10 shadow-sm p-6 sm:p-8 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <div className="text-[11px] uppercase tracking-widest text-ink/50 font-mono">
              yoursite.com/{es ? "sesion" : "visit"}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-sage font-mono inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sage" />
              {es ? "Sesión hoy a las 2:00 pm" : "Session today at 2:00 pm"}
            </div>
          </div>

          <div className="flex items-center gap-4 mb-6 pb-5 border-b border-ink/10">
            <div className="w-14 h-14 rounded-full bg-sage/15 flex items-center justify-center shrink-0">
              <Video className="w-6 h-6 text-sage" />
            </div>
            <div>
              <div className="font-display text-xl text-ink">
                Dr. Maria Rivera, LCSW
              </div>
              <div className="text-xs text-ink/55 mt-0.5">
                {es
                  ? "Estás a un toque de la sala de espera"
                  : "You're one tap from the waiting room"}
              </div>
            </div>
          </div>

          <div className="mb-5">
            <div className="text-[11px] uppercase tracking-widest text-ink/50 mb-3">
              {es ? "Antes de tu sesión" : "Before your visit"}
            </div>
            <ul className="space-y-2.5">
              {[
                {
                  Icon: Coffee,
                  en: "Find a quiet space — close the door",
                  es: "Encuentra un lugar tranquilo — cierra la puerta",
                },
                {
                  Icon: Headphones,
                  en: "Headphones recommended for privacy",
                  es: "Auriculares recomendados para privacidad",
                },
                {
                  Icon: Droplet,
                  en: "Glass of water nearby",
                  es: "Vaso de agua cerca",
                },
              ].map((p) => (
                <li
                  key={p.en}
                  className="flex items-center gap-3 text-sm text-ink/80"
                >
                  <p.Icon className="w-3.5 h-3.5 text-sage shrink-0" />
                  {es ? p.es : p.en}
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            className="w-full bg-sage text-cream rounded-lg py-3.5 text-sm font-medium hover:bg-sage-dark transition-colors inline-flex items-center justify-center gap-2"
          >
            <Video className="w-4 h-4" />
            {es ? "Entrar en la sala de espera" : "Enter waiting room"}
          </button>

          <button
            type="button"
            className="w-full mt-2.5 text-xs text-ink/55 hover:text-ink/80 inline-flex items-center justify-center gap-1.5"
          >
            <RotateCw className="w-3 h-3" />
            {es ? "Necesito reprogramar" : "I need to reschedule"}
          </button>
        </div>

        <p className="text-[12px] text-ink/55 italic leading-relaxed text-center mt-6 max-w-2xl mx-auto">
          {es
            ? "Tu sala Doxy/Zoom existente, envuelta en tu marca. Una sola URL permanente reemplaza los enlaces únicos. Cae las ausencias 15-25%."
            : "Your existing Doxy/Zoom room, wrapped in your brand. One permanent URL replaces the unique links. Drops no-shows 15-25%."}
        </p>
      </div>
    </section>
  );
};
