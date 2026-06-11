import { useI18n } from "@site/lib/i18n";
import { Seo } from "@site/lib/seo";

export default function LegalTerms() {
  const { t, locale } = useI18n();

  const en = (
    <>
      <p>
        These Terms of Service govern your use of Ashford Creative's website
        and services. By using our services you agree to these terms.
      </p>
      <h2>The service</h2>
      <p>
        We design, build, and quietly keep websites running for mental health
        practitioners across three monthly plans (Boutique $199, Boutique Pro
        $299, Concierge $649). Each plan includes a yearly renewal of a web
        address, a Google-friendly site structure, Spanish translation, and a
        HIPAA-aware contact form. Boutique Pro and Concierge additionally
        include the telehealth /visit landing page, online booking, and the
        patient onboarding hub; Concierge adds the ghostwritten Insights
        Journal. 100% tax-deductible business expense (IRS §162). We send a
        W-9 and itemized invoices at year-end for your CPA.
      </p>
      <h2>Refund policy</h2>
      <p>
        Full refund details live on our <a href="/legal/refund">Refund Policy</a> page.
        Summary:
      </p>
      <ul>
        <li>
          <strong>30-day money-back on setup</strong> if your site has not yet
          been published live. Once the site is live, setup fees are non-refundable.
        </li>
        <li>
          <strong>Monthly cancellation:</strong> cancel anytime in the first
          90 days with no notice required. After 90 days, 30 days written
          notice. We bill the next monthly cycle, then stop. No prorated
          refund.
        </li>
        <li>
          <strong>Web address transfer-out:</strong> if you ever cancel and want
          to take the web address with you, we hand it over at no extra fee —
          your web address is always yours.
        </li>
      </ul>
      <h2>Modifications</h2>
      <p>
        Minor content updates (text, photos, hours, services) are unlimited
        and free. Structural changes after launch (adding pages, integrations,
        custom features) are billed à la carte — typically $150–$400 for a
        single-page addition. We will never charge you to fix our mistakes.
      </p>
      <h2>Content & ownership</h2>
      <p>
        You own your content. We own the template code. While you are an
        active subscriber, you have a license to use the rendered site and
        all content we produce for you. On cancellation, you may export your
        content (we provide a content export within 14 days of request).
      </p>
      <h2>SMS Program terms</h2>
      <p>
        Our outbound sales representatives may text your business mobile
        number after you give verbal consent during a recorded sales
        call. By participating in the SMS Program you agree to receive
        recurring messages, including a one-time link to your custom
        website preview, scheduled call-back recaps, and account
        notifications if you become a customer. Frequency varies but
        averages 2 to 5 messages per month. Message and data rates may
        apply. Reply STOP at any time to cancel. Reply HELP for help.
        Carriers are not liable for delayed or undelivered messages. We
        do not share mobile information or SMS opt-in data with third
        parties for their marketing purposes. Full disclosures are on
        our <a href="/legal/sms-consent">SMS Consent</a> page; data
        handling is described in our
        <a href="/legal/privacy"> Privacy Policy</a>.
      </p>
      <h2>Acceptable use</h2>
      <p>
        We do not host content that violates law, infringes third-party
        rights, or is misleading about clinical credentials. We may suspend
        or terminate accounts that do.
      </p>
      <h2>Disclaimers</h2>
      <p>
        We provide a website. We do not provide legal, medical, or insurance
        advice. We are not a covered entity under HIPAA — you remain
        responsible for your patients' PHI. Our contact form is designed to
        avoid PHI capture, but you are responsible for what you publish.
      </p>
      <h2>Liability</h2>
      <p>
        Our maximum aggregate liability is limited to the fees you paid in
        the 12 months preceding the claim. We disclaim incidental,
        consequential, and punitive damages.
      </p>
      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of the State of Texas. Disputes
        are resolved in the state or federal courts located in Travis County,
        Texas.
      </p>
      <h2>Contact</h2>
      <p>
        Questions? Email <a href="mailto:legal@ashfordhealthcreative.com">legal@ashfordhealthcreative.com</a>.
      </p>
    </>
  );

  const es = (
    <>
      <p>
        Estos Términos de Servicio rigen tu uso del sitio y servicios de
        Ashford Creative. Al usar nuestros servicios aceptas estos términos.
      </p>
      <h2>El servicio</h2>
      <p>
        Diseñamos, construimos y mantenemos en silencio sitios web para
        terapeutas de salud mental con tres planes mensuales (Boutique $199,
        Boutique Pro $299, Concierge $649). Cada plan incluye la renovación
        anual de una dirección web, una estructura amigable con Google,
        traducción al español y un formulario consciente de HIPAA. Boutique
        Pro y Concierge incluyen además la página de telesalud /visit, reserva
        en línea y el centro de bienvenida del paciente; Concierge añade la
        Insights Journal escrita por nosotros. Gasto comercial 100% deducible
        (IRS §162). Enviamos un W-9 y facturas detalladas a fin de año para
        su contador.
      </p>
      <h2>Política de reembolso</h2>
      <p>
        Los detalles completos están en nuestra página de <a href="/legal/refund">Política de Reembolso</a>.
        Resumen:
      </p>
      <ul>
        <li>
          <strong>Garantía de 30 días sobre el setup</strong> si tu sitio aún
          no se ha desplegado. Una vez desplegado, las tarifas de setup no son
          reembolsables.
        </li>
        <li>
          <strong>Cancelación mensual:</strong> cancela en los primeros 90
          días sin necesidad de aviso. Después de 90 días, con 30 días de
          aviso por escrito. Facturamos el ciclo siguiente y detenemos. Sin
          reembolso prorrateado.
        </li>
        <li>
          <strong>Transferencia de dirección web:</strong> si cancelas y deseas
          llevarte la dirección web, te la entregamos sin cargo adicional — tu
          dirección web siempre es tuya.
        </li>
      </ul>
      <h2>Modificaciones</h2>
      <p>
        Las actualizaciones menores de contenido (texto, fotos, horarios,
        servicios) son ilimitadas y gratuitas. Los cambios estructurales tras
        el lanzamiento se facturan à la carte — generalmente $150–$400 por
        adición de una página. Nunca te cobraremos por arreglar nuestros
        errores.
      </p>
      <h2>Contenido y propiedad</h2>
      <p>
        Tu eres dueño de tu contenido. Nosotros somos dueños del código de
        plantilla. Mientras seas suscriptor activo, tienes licencia para usar
        el sitio renderizado y todo el contenido que produzcamos. En
        cancelación puedes exportar tu contenido.
      </p>
      <h2>Términos del Programa de SMS</h2>
      <p>
        Nuestros representantes de ventas pueden enviarte mensajes de
        texto a tu móvil comercial después de que des consentimiento
        verbal durante una llamada de ventas grabada. Al participar en
        el Programa de SMS aceptas recibir mensajes recurrentes,
        incluyendo un enlace único a tu vista previa de sitio web,
        recordatorios de llamadas y notificaciones de cuenta si te
        conviertes en cliente. La frecuencia varía pero promedia 2 a 5
        mensajes al mes. Pueden aplicarse tarifas de mensajes y datos.
        Responde STOP en cualquier momento para cancelar. Responde HELP
        para obtener ayuda. Los operadores no son responsables de los
        mensajes retrasados o no entregados. No compartimos información
        móvil ni datos de aceptación de SMS con terceros para sus fines
        de marketing. Las divulgaciones completas están en nuestra
        página de <a href="/legal/sms-consent">Consentimiento de SMS</a>;
        el manejo de datos se describe en nuestra
        <a href="/legal/privacy"> Política de Privacidad</a>.
      </p>
      <h2>Ley aplicable</h2>
      <p>
        Estos términos se rigen por las leyes del Estado de Texas. Las
        disputas se resuelven en los tribunales estatales o federales del
        Condado de Travis, Texas.
      </p>
      <h2>Contacto</h2>
      <p>
        ¿Preguntas? Escribe a <a href="mailto:legal@ashfordhealthcreative.com">legal@ashfordhealthcreative.com</a>.
      </p>
    </>
  );

  return (
    <>
      <Seo
        title={t("legal_terms_title")}
        description={
          locale === "es"
            ? "Términos de servicio de Ashford Creative."
            : "Terms of service for Ashford Creative."
        }
        path="/legal/terms"
      />
      <section className="py-20 px-6 lg:px-12 bg-cream">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-display text-4xl md:text-5xl text-ink mb-3">
            {t("legal_terms_title")}
          </h1>
          <p className="text-sm text-ink/55 mb-10 font-mono">
            {locale === "es" ? "Última actualización" : "Last updated"}: Apr 2026
          </p>
          <div className="prose-ashford">{locale === "es" ? es : en}</div>
        </div>
      </section>
    </>
  );
}
