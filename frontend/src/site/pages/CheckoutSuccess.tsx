import { useI18n } from "@site/lib/i18n";
import { Seo } from "@site/lib/seo";

/**
 * 2026-05-21 — rewritten alongside the Sprint 2 kill of the client
 * onboarding flow. The previous copy promised an "onboarding link in
 * your inbox" the client had to open and fill in. The new copy reflects
 * the boutique posture: the rep already has everything from the sales
 * call, so the client has nothing to do.
 */
export default function CheckoutSuccess() {
  const { locale } = useI18n();

  return (
    <>
      <Seo
        title={locale === "es" ? "Pago confirmado" : "Payment confirmed"}
        description={
          locale === "es"
            ? "Tu cargo se procesó. Tu rep te contacta en las próximas 24 horas."
            : "Your charge went through. Your rep will reach out within 24 hours."
        }
        path="/checkout/success"
      />
      <section className="py-24 px-6 lg:px-12 bg-cream min-h-[60vh]">
        <div className="max-w-2xl mx-auto text-center">
          <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-gold mb-4">
            {locale === "es" ? "Pago confirmado" : "Payment confirmed"}
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-ink mb-6">
            {locale === "es"
              ? "Pago confirmado. Nosotros nos encargamos del resto."
              : "Payment confirmed. We've got it from here."}
          </h1>
          <p className="font-serif text-[19px] text-ink/80 leading-[1.6] mb-8">
            {locale === "es"
              ? "Tu pago se procesó. No hay nada que llenar — tu rep ya tiene todo lo necesario de nuestra conversación. Te contacta en las próximas 24 horas para empezar a construir tu sitio."
              : "Your payment went through. There's nothing to fill out — your rep already has what we need from our conversation. They'll reach out within 24 hours to start building your site."}
          </p>
          <div className="bg-paper border border-ink/10 rounded-sm p-6 text-left">
            <h2 className="font-display text-xl text-ink mb-3">
              {locale === "es" ? "¿Qué sigue?" : "What's next?"}
            </h2>
            <ol className="space-y-2 text-sm text-ink/80 list-decimal list-inside">
              <li>
                {locale === "es"
                  ? "Recibirás un correo de confirmación desde hello@ashfordcreative.org (revisa también la carpeta de spam)."
                  : "You'll get a confirmation email from hello@ashfordcreative.org (check spam too, just in case)."}
              </li>
              <li>
                {locale === "es"
                  ? "Tu rep te contacta en las próximas 24 horas con las primeras maquetas y plantillas."
                  : "Your rep will reach out within 24 hours with your first mockups and template options."}
              </li>
              <li>
                {locale === "es"
                  ? "Tu sitio queda en vivo unos días después — sin tarea, sin formularios."
                  : "Your site goes live a few days later — no homework, no forms."}
              </li>
            </ol>
          </div>
          <p className="text-sm text-ink/60 mt-8">
            {locale === "es" ? "¿Preguntas? " : "Questions? "}
            <a
              className="underline"
              href="mailto:hello@ashfordcreative.org"
            >
              hello@ashfordcreative.org
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
