import { Search, Clock, CheckCircle2, AlertCircle, Mail, ShieldQuestion } from "lucide-react";
import { useI18n } from "@site/lib/i18n";

/**
 * Inline preview for `insurance_precheck`. Renders the admin-side
 * verification panel a front-desk staffer would see: 4-field form on
 * the left, cleanly-formatted Stedi response on the right (deductible,
 * OOP, copay, in/out-of-network), and the one-click "send estimation
 * to patient" CTA. Bêta: ships Q3 2026; the chip surfaces a BETA pill
 * via AddonChip rendering.
 */
export const InsurancePrecheckInline = () => {
  const { locale } = useI18n();
  const es = locale === "es";

  return (
    <section
      id="addon-inline-insurance_precheck"
      className="ashford-addon-inline scroll-mt-24 py-16"
    >
      <div className="max-w-5xl mx-auto px-8 sm:px-12">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8 pb-6 border-b border-ink/10">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-sage font-medium mb-1.5 inline-flex items-center gap-2">
              {es ? "Herramienta de admin" : "Admin tool"}
              <span className="bg-gold/15 text-gold-dark font-mono text-[9.5px] px-1.5 py-0.5 rounded uppercase tracking-wider">
                {es ? "Beta · Q3 2026" : "Beta · Ships Q3 2026"}
              </span>
            </div>
            <h3 className="font-[var(--font-display)] text-3xl text-ink leading-tight">
              {es ? "Pre-verificación de seguro" : "Insurance Pre-Check"}
            </h3>
            <p className="text-sm text-ink/70 mt-1.5 font-[var(--font-serif)]">
              {es
                ? "8 segundos por verificación en lugar de 20 min en espera con el pagador."
                : "8 seconds per check instead of 20 minutes on hold with the payer."}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className="font-mono text-xs uppercase tracking-widest text-ink/50">
              +$19/{es ? "mes" : "mo"}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-ink/40">
              {es ? "Uso justo ilimitado" : "Unlimited fair use"}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-ink/10 shadow-sm overflow-hidden">
          <div className="border-b border-ink/10 px-6 py-3.5 bg-cream-warm/50 flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-widest text-ink/55 font-mono inline-flex items-center gap-2">
              <Search className="w-3 h-3" />
              {es ? "admin · Verificación de elegibilidad" : "admin · Eligibility check"}
            </div>
            <div className="text-[10px] text-sage font-mono inline-flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              {es ? "Respuesta en 8 segundos" : "8-second response"}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-ink/10">
            <div className="p-6 space-y-3">
              <div className="text-[11px] uppercase tracking-wider text-ink/45 mb-1">
                {es ? "Datos del paciente" : "Patient details"}
              </div>
              {[
                { l: es ? "Nombre" : "Name", v: "Sofia Martinez" },
                { l: es ? "Fecha de nacimiento" : "Date of birth", v: "1989-06-12" },
                { l: es ? "ID de miembro" : "Member ID", v: "BCB-447829301" },
                { l: es ? "Pagador" : "Payer", v: "Blue Cross Blue Shield TX" },
              ].map((f) => (
                <div key={f.l}>
                  <div className="text-[10px] uppercase tracking-wider text-ink/45 mb-1">
                    {f.l}
                  </div>
                  <div className="text-sm text-ink bg-cream-warm/40 rounded border border-ink/10 px-2.5 py-1.5 font-mono">
                    {f.v}
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="w-full bg-sage text-cream rounded-lg py-2.5 text-sm font-medium hover:bg-sage-dark transition-colors mt-2 inline-flex items-center justify-center gap-2"
              >
                <ShieldQuestion className="w-4 h-4" />
                {es ? "Verificar elegibilidad" : "Verify eligibility"}
              </button>
            </div>

            <div className="p-6 bg-sage/[0.03]">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-sage" />
                <div className="text-[11px] uppercase tracking-wider text-sage font-mono font-medium">
                  {es ? "Activo · En red" : "Active · In-network"}
                </div>
              </div>
              <dl className="space-y-2.5 text-sm">
                {[
                  { l: es ? "Deducible restante" : "Deductible remaining", v: "$340 / $1,500" },
                  { l: es ? "Máx. de bolsillo" : "Out-of-pocket max", v: "$2,150 / $4,500" },
                  { l: es ? "Copago salud mental" : "Mental-health copay", v: "$25 / session" },
                  { l: es ? "Año del plan" : "Plan year", v: "Jan 1 → Dec 31, 2026" },
                ].map((row) => (
                  <div key={row.l} className="flex items-baseline justify-between gap-3 pb-2 border-b border-ink/5">
                    <dt className="text-xs text-ink/60">{row.l}</dt>
                    <dd className="text-sm font-medium text-ink font-mono">{row.v}</dd>
                  </div>
                ))}
              </dl>
              <button
                type="button"
                className="w-full mt-4 border border-sage/40 bg-white text-sage rounded-lg py-2 text-xs font-medium hover:bg-sage/5 transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5" />
                {es ? "Enviar estimación al paciente" : "Send estimation to patient"}
              </button>
            </div>
          </div>

          <div className="px-6 py-3 border-t border-ink/10 bg-cream-warm/30 text-[11px] text-ink/55 inline-flex items-center gap-2">
            <AlertCircle className="w-3 h-3 text-ink/45" />
            {es
              ? "Cobertura ~80% de pagadores US. Pequeños/regionales se marcan antes — tu front-desk no pierde tiempo."
              : "Covers ~80% of US payers. Small/regional plans flagged upfront — your front desk doesn't waste time."}
          </div>
        </div>

        <p className="text-[12px] text-ink/55 italic leading-relaxed text-center mt-6 max-w-2xl mx-auto">
          {es
            ? "Honesto: la pre-autorización compleja todavía requiere una llamada. Esto elimina el 80% de las llamadas de elegibilidad de rutina."
            : "Honest: complex pre-authorization still needs a phone call. This eliminates 80% of routine eligibility calls."}
        </p>
      </div>
    </section>
  );
};
