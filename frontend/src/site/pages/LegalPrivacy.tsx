import { useI18n } from "@site/lib/i18n";
import { Seo } from "@site/lib/seo";

export default function LegalPrivacy() {
  const { t, locale } = useI18n();
  const en = (
    <>
      <p>
        Ashford Creative ("we", "us") builds and operates websites for mental
        health practitioners. This Privacy Policy describes what we collect,
        why, and how we handle it.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Site interactions on ashfordhealthcreative.com:</strong> contact
          form and chatbot submissions (name, email, phone, message), and
          basic access logs (IP address and visit time) for security.
        </li>
        <li>
          <strong>Blog interactions:</strong> blog comments you post (name,
          optional practice, body), and an anonymous local fingerprint stored
          in your browser to deduplicate "likes."
        </li>
        <li>
          <strong>Getting started:</strong> if you become a customer, the
          information you choose to provide about your practice (services,
          modalities, team bios, photos, hours).
        </li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To respond to your inquiries and build and look after your site.</li>
        <li>To send service-related SMS and email (never marketing without consent).</li>
        <li>To detect abuse and keep the service secure.</li>
      </ul>
      <h2>SMS / text messaging</h2>
      <p>
        If you provide us your mobile phone number and verbally consent
        during a recorded sales call, we will send you a small number of
        business text messages: a one-time link to your custom website
        preview, scheduled call-back recaps, and account notifications if
        you become a customer. Message frequency is typically 2 to 5
        messages per month. Message and data rates may apply. You can
        reply STOP at any time to cancel, and HELP for help. We do not
        share mobile phone numbers, SMS opt-in data, or consent records
        with any third party for that third party's marketing or
        promotional purposes. SMS opt-in information is treated as
        confidential. Full details are on our
        <a href="/legal/sms-consent"> SMS Consent</a> page.
      </p>
      <h2>Data we do not collect</h2>
      <p>
        We do not run third-party advertising trackers. We do not sell your
        information. We do not collect protected health information (PHI) of
        your patients on the public website — your contact form is for
        prospective-client inquiries that you handle directly.
      </p>
      <h2>Retention</h2>
      <p>
        We keep contact form and chatbot submissions for as long as needed to
        serve you, then 24 months for audit. Content you share when getting
        started is kept for the life of your account plus 90 days. You can
        request deletion at any time.
      </p>
      <h2>Cookies</h2>
      <p>
        We use a single first-party cookie to keep you logged in if you have a
        rep or admin account. Visitors of the public site receive no tracking
        cookies. The blog stores a random "fingerprint" string in localStorage
        only to deduplicate likes — it is not shared with any third party.
      </p>
      <h2>Contact</h2>
      <p>
        Questions? Email <a href="mailto:privacy@ashfordhealthcreative.com">privacy@ashfordhealthcreative.com</a>.
      </p>
    </>
  );

  const es = (
    <>
      <p>
        Ashford Creative («nosotros») construye y opera sitios web para
        terapeutas de salud mental. Esta Política de Privacidad describe qué
        recopilamos, por qué y cómo lo manejamos.
      </p>
      <h2>Qué recopilamos</h2>
      <ul>
        <li>
          <strong>Interacciones en ashfordhealthcreative.com:</strong> envíos del
          formulario de contacto y del chatbot (nombre, correo, teléfono,
          mensaje), y registros básicos de acceso (dirección IP y hora de
          visita) por seguridad.
        </li>
        <li>
          <strong>Interacciones en el blog:</strong> comentarios que publicas
          (nombre, práctica opcional, texto), y una huella anónima local
          almacenada en tu navegador para deduplicar «me gusta».
        </li>
        <li>
          <strong>Incorporación:</strong> si te conviertes en cliente,
          la información que decidas proporcionar sobre tu práctica (servicios,
          modalidades, bios, fotos, horarios).
        </li>
      </ul>
      <h2>Cómo la usamos</h2>
      <ul>
        <li>Para responder a tus consultas y construir y cuidar tu sitio.</li>
        <li>Para enviar SMS y correos relacionados con el servicio (nunca marketing sin consentimiento).</li>
        <li>Para detectar abuso y proteger el servicio.</li>
      </ul>
      <h2>SMS / mensajes de texto</h2>
      <p>
        Si nos proporcionas tu número de móvil y das consentimiento verbal
        durante una llamada de ventas grabada, te enviaremos un número
        reducido de mensajes de texto comerciales: un enlace único a tu
        vista previa de sitio web, recordatorios de llamadas de
        seguimiento y notificaciones de cuenta si te conviertes en
        cliente. La frecuencia típica es de 2 a 5 mensajes al mes. Pueden
        aplicarse tarifas de mensajes y datos. Puedes responder STOP en
        cualquier momento para cancelar y HELP para obtener ayuda. No
        compartimos números de teléfono móvil, datos de aceptación de
        SMS ni registros de consentimiento con ningún tercero para los
        fines de marketing o promocionales de ese tercero. La información
        de aceptación de SMS se trata como confidencial. Detalles
        completos en nuestra página de
        <a href="/legal/sms-consent"> Consentimiento de SMS</a>.
      </p>
      <h2>Datos que no recopilamos</h2>
      <p>
        No usamos rastreadores publicitarios de terceros. No vendemos tu
        información. No recopilamos información de salud protegida (PHI) de
        tus pacientes en el sitio público — tu formulario de contacto es para
        consultas de pacientes prospectivos que tú manejas directamente.
      </p>
      <h2>Retención</h2>
      <p>
        Mantenemos los envíos del formulario y chatbot el tiempo necesario para
        atenderte, después 24 meses por auditoría. El contenido que compartes
        al comenzar se conserva durante la vida de tu cuenta más 90 días.
        Puedes solicitar eliminación en cualquier momento.
      </p>
      <h2>Cookies</h2>
      <p>
        Usamos una sola cookie de primera parte para mantener tu sesión si
        tienes cuenta de representante o admin. Los visitantes del sitio
        público no reciben cookies de seguimiento.
      </p>
      <h2>Contacto</h2>
      <p>
        ¿Preguntas? Escribe a <a href="mailto:privacy@ashfordhealthcreative.com">privacy@ashfordhealthcreative.com</a>.
      </p>
    </>
  );

  return (
    <>
      <Seo
        title={t("legal_privacy_title")}
        description={
          locale === "es"
            ? "Política de privacidad de Ashford Creative."
            : "Privacy policy for Ashford Creative."
        }
        path="/legal/privacy"
      />
      <section className="py-20 px-6 lg:px-12 bg-cream">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-display text-4xl md:text-5xl text-ink mb-3">
            {t("legal_privacy_title")}
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
