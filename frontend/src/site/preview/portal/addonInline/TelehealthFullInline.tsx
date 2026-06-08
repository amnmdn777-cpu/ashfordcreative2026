import { Video, FileSignature, GraduationCap, CreditCard, ShieldCheck, Check } from "lucide-react";
import { useI18n } from "@site/lib/i18n";

/**
 * Inline preview for `telehealth_full`. Walks the prospect through the
 * 4-step concierge setup (account, BAA, training, branded page) so they
 * understand exactly what the $99/mo + $149 setup buys: zero
 * configuration on their side, single monthly invoice, and a Doxy.me
 * Pro account they don't have to manage.
 */
export const TelehealthFullInline = () => {
  const { locale } = useI18n();
  const es = locale === "es";

  const steps = [
    {
      Icon: Video,
      en: { t: "We create your Doxy.me Pro account", s: "Connect your existing HIPAA-compliant telehealth tool, branded waiting room with your logo" },
      es: { t: "Creamos tu cuenta Doxy.me Pro", s: "Conecte su herramienta de telesalud existente, sala de espera con tu logo" },
    },
    {
      Icon: FileSignature,
      en: { t: "Sign your BAA in 2 minutes", s: "We email you the doc, e-sign on your phone — only legally required step" },
      es: { t: "Firma tu BAA en 2 minutos", s: "Te enviamos el doc, firma electrónica desde tu teléfono — único paso legal requerido" },
    },
    {
      Icon: GraduationCap,
      en: { t: "30-min onboarding session with us", s: "First video call isn't with a real patient — practice with our team" },
      es: { t: "Sesión de incorporación de 30 min", s: "La primera videollamada no es con un paciente real — practica con nuestro equipo" },
    },
    {
      Icon: ShieldCheck,
      en: { t: "Branded /visit page wired to your site", s: "Telehealth Bridge included — one permanent URL for every patient" },
      es: { t: "Página /sesion con tu marca", s: "Telehealth Bridge incluido — una URL permanente para cada paciente" },
    },
  ];

  return (
    <section
      id="addon-inline-telehealth_full"
      className="ashford-addon-inline scroll-mt-24 py-16"
    >
      <div className="max-w-5xl mx-auto px-8 sm:px-12">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8 pb-6 border-b border-ink/10">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-sage font-medium mb-1.5">
              {es ? "Complemento conserje" : "Concierge add-on"}
            </div>
            <h3 className="font-[var(--font-display)] text-3xl text-ink leading-tight">
              {es ? "Configuración completa de telesalud" : "Telehealth Full Setup"}
            </h3>
            <p className="text-sm text-ink/70 mt-1.5 font-[var(--font-serif)]">
              {es
                ? "Sin cuenta de telesalud todavía. Lo configuramos todo, firmas el BAA, terminado."
                : "No telehealth account yet. We set it all up, you sign the BAA, done."}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className="font-mono text-xs uppercase tracking-widest text-ink/50">
              +$99/{es ? "mes" : "mo"}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-ink/40">
              + $149 {es ? "instalación única" : "one-time setup"}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-ink/10 shadow-sm p-6 sm:p-8">
          <div className="text-[11px] uppercase tracking-widest text-sage font-mono mb-5">
            {es ? "Lo que entregamos en 5 días hábiles" : "What we deliver in 5 business days"}
          </div>

          <ol className="space-y-4">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-4">
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-10 h-10 rounded-full bg-sage/15 text-sage flex items-center justify-center">
                    <step.Icon className="w-4 h-4" />
                  </div>
                  {i < steps.length - 1 && (
                    <div className="w-px flex-1 bg-ink/10 mt-1.5" />
                  )}
                </div>
                <div className="flex-1 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] text-ink/40 uppercase tracking-wider">
                      {es ? "Paso" : "Step"} {i + 1}
                    </span>
                    <span className="text-sm font-medium text-ink">
                      {es ? step.es.t : step.en.t}
                    </span>
                  </div>
                  <div className="text-xs text-ink/60 leading-relaxed">
                    {es ? step.es.s : step.en.s}
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-6 pt-6 border-t border-ink/10 grid sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-2.5">
              <CreditCard className="w-4 h-4 text-sage mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-medium text-ink mb-0.5">
                  {es ? "Una sola factura mensual" : "Single monthly invoice"}
                </div>
                <div className="text-[11px] text-ink/60 leading-relaxed">
                  {es
                    ? "Doxy.me Pro facturado en nuestra tarjeta — nunca lo ves."
                    : "Doxy.me Pro billed on our card — you never see it."}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-sage mt-0.5 shrink-0" strokeWidth={3} />
              <div>
                <div className="text-xs font-medium text-ink mb-0.5">
                  {es ? "Migración sin costo" : "Migration at no extra cost"}
                </div>
                <div className="text-[11px] text-ink/60 leading-relaxed">
                  {es
                    ? "Si cambiamos de proveedor, te avisamos 90 días antes."
                    : "If we ever change provider, 90-day notice and free migration."}
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-[12px] text-ink/55 italic leading-relaxed text-center mt-6 max-w-2xl mx-auto">
          {es
            ? "Conecte su herramienta de telesalud existente — completa, conserje, en una sola línea de tu factura mensual."
            : "Connect your existing HIPAA-compliant telehealth tool — complete, concierge, on a single line of your monthly invoice."}
        </p>
      </div>
    </section>
  );
};
