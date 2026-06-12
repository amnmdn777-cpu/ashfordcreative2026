import { useI18n } from "@site/lib/i18n";
import { Seo } from "@site/lib/seo";

export default function LegalSmsConsent() {
  const { t, locale } = useI18n();

  const en = (
    <>
      <p>
        This page describes the Ashford Creative SMS Program, how consent
        is collected, and how you can opt out. Last updated: April 2026.
      </p>

      <h2>Program name</h2>
      <p>Ashford Creative Sales &amp; Account Notifications.</p>

      <h2>Program description</h2>
      <p>
        Ashford Creative is a U.S.-based web design agency serving licensed
        mental-health practitioners in Texas. We send a small number of
        business-to-business text messages to practitioners who have spoken
        with one of our sales representatives by phone and verbally
        authorized us to text them. Messages include:
      </p>
      <ul>
        <li>
          A one-time short link to a custom website preview built for the
          recipient's practice (sent within 24 hours of the qualifying call).
        </li>
        <li>
          Scheduled call-back recaps (date, time, and the same preview link)
          when the recipient asked us to follow up later.
        </li>
        <li>
          Two re-engagement messages (at roughly day 3 and day 8) if the
          recipient has not yet viewed the preview.
        </li>
        <li>
          Account notifications once the recipient becomes a customer:
          build-status updates, launch confirmation, payment receipts,
          and payment-failure alerts.
        </li>
      </ul>

      <h2>Message frequency</h2>
      <p>
        Recurring messages. Typical frequency is 2 to 5 messages per
        recipient per month. Customers receiving billing or build-status
        notifications may receive additional service messages tied to
        events on their account.
      </p>

      <h2>Message and data rates</h2>
      <p>
        Message and data rates may apply. Check with your wireless carrier
        for details about your messaging plan.
      </p>

      <h2>How consent is collected</h2>
      <p>
        Ashford Creative captures SMS consent through two distinct,
        documented pathways. In every case the recipient sees or hears
        the same material disclosure (program purpose, message types
        and frequency, message-and-data rates, STOP/HELP keywords, and
        the fact that consent is not a condition of purchase) before
        any text is sent. Every recipient on our SMS list has opted in
        through one of the following:
      </p>
      <ul>
        <li>
          <strong>Web-form opt-in.</strong> The recipient submits a
          request on our public contact form at{" "}
          <a href="https://www.ashfordhealthcreative.com/contact" className="break-all">
            https://www.ashfordhealthcreative.com/contact
          </a>{" "}
          or through the chatbot on our website. When a phone number is
          provided, an explicit, unchecked-by-default consent checkbox is
          rendered immediately above the submit button, with the verbatim
          disclosure quoted below. The form cannot be submitted with a
          phone number unless the box is checked. Each submission is
          logged with the verbatim disclosure text, an ISO timestamp, and
          the submitter's IP address.
        </li>
        <li>
          <strong>Verbal consent during a recorded business call.</strong>{" "}
          An Ashford Creative sales representative places an outbound
          call to the practitioner's published business phone number.
          Before sending any text message, the representative reads the
          disclosure below and waits for affirmative consent. The call
          recording, the timestamp, the representative's identifier, and
          the consenting phone number are retained as proof of consent.
        </li>
      </ul>

      <h2>Verbatim consent disclosure</h2>
      <p>
        Whether collected by web form or verbally, the disclosure
        presented to every recipient is, word-for-word:
      </p>
      <blockquote>{t("sms_consent_disclosure")}</blockquote>
      <p>
        Consent records (verbatim disclosure text, timestamp, IP address
        for web submissions, and call recording for verbal consent) are
        retained for the duration of the relationship plus four years.
        Consent is not a condition of any purchase. Mobile information
        (phone numbers and consent status) is never shared with third
        parties for their own marketing purposes.
      </p>

      <h2>Opt-out (STOP)</h2>
      <p>
        You can cancel the SMS Program at any time. Reply <strong>STOP</strong>
        to any message you receive from us. After you send STOP, we will
        send you one final confirmation message and we will not send you
        any further messages unless you opt back in. You can also email
        <a href="mailto:sms@ashfordhealthcreative.com"> sms@ashfordhealthcreative.com</a>
        and we will remove your number within one business day.
      </p>

      <h2>Help (HELP)</h2>
      <p>
        For help, reply <strong>HELP</strong> to any message you receive
        from us, or contact us at
        <a href="mailto:support@ashfordhealthcreative.com"> support@ashfordhealthcreative.com</a>
        or 1-512-555-0182. Our hours are Monday through Friday,
        9:00 a.m. to 6:00 p.m. Central Time.
      </p>

      <h2>Carrier disclaimer</h2>
      <p>
        Carriers (including but not limited to AT&amp;T, T-Mobile, Verizon,
        and Sprint) are not liable for delayed or undelivered messages.
      </p>

      <h2>Privacy</h2>
      <p>
        Phone numbers, consent records, and SMS history are handled in
        accordance with our
        <a href="/legal/privacy"> Privacy Policy</a>. We do not sell or
        share phone numbers or SMS opt-in data with third parties for
        their marketing purposes. SMS opt-in information is treated as
        confidential.
      </p>

      <h2>Terms</h2>
      <p>
        By participating in the SMS Program you also agree to our
        <a href="/legal/terms"> Terms of Service</a>.
      </p>

      <h2>Supported carriers</h2>
      <p>
        The Ashford Creative SMS Program is available on most major U.S.
        wireless carriers. Service is not guaranteed on all carriers and
        is subject to carrier and regional limitations.
      </p>

      <h2>Contact</h2>
      <p>
        Ashford Creative LLC, Austin, Texas. Questions about the SMS
        Program: <a href="mailto:sms@ashfordhealthcreative.com">sms@ashfordhealthcreative.com</a>.
      </p>
    </>
  );

  const es = (
    <>
      <p>
        Esta página describe el Programa de SMS de Ashford Creative, cómo
        se recopila el consentimiento y cómo puedes darte de baja.
        Última actualización: abril de 2026.
      </p>

      <h2>Nombre del programa</h2>
      <p>Notificaciones de Ventas y de Cuenta de Ashford Creative.</p>

      <h2>Descripción del programa</h2>
      <p>
        Ashford Creative es una agencia de diseño web con sede en EE. UU.
        que atiende a terapeutas con licencia en Texas. Enviamos un
        número reducido de mensajes de texto entre empresas a terapeutas
        que han hablado con uno de nuestros representantes de ventas por
        teléfono y nos han autorizado verbalmente a enviarles mensajes.
        Los mensajes incluyen:
      </p>
      <ul>
        <li>
          Un enlace corto único a una vista previa personalizada del sitio
          web construido para la práctica del destinatario (enviado dentro
          de las 24 horas siguientes a la llamada).
        </li>
        <li>
          Recordatorios de llamada de seguimiento (fecha, hora y el mismo
          enlace de vista previa) cuando el destinatario nos pidió volver
          a llamar más tarde.
        </li>
        <li>
          Dos mensajes de reactivación (aproximadamente el día 3 y el día
          8) si el destinatario aún no ha abierto la vista previa.
        </li>
        <li>
          Notificaciones de cuenta cuando el destinatario se convierte en
          cliente: actualizaciones del estado de construcción, confirmación
          de despliegue, recibos de pago y alertas de pago fallido.
        </li>
      </ul>

      <h2>Frecuencia de los mensajes</h2>
      <p>
        Mensajes recurrentes. La frecuencia típica es de 2 a 5 mensajes
        por destinatario al mes. Los clientes que reciben notificaciones
        de facturación o de estado de construcción pueden recibir
        mensajes de servicio adicionales vinculados a eventos en su
        cuenta.
      </p>

      <h2>Tarifas de mensajes y datos</h2>
      <p>
        Pueden aplicarse tarifas de mensajes y datos. Consulta con tu
        operador inalámbrico para más detalles sobre tu plan.
      </p>

      <h2>Cómo se recopila el consentimiento</h2>
      <p>
        Ashford Creative captura el consentimiento de SMS por dos vías
        documentadas y diferenciadas. En cada caso, el destinatario ve
        o escucha la misma divulgación material (propósito del programa,
        tipos y frecuencia de mensajes, tarifas de mensajes y datos,
        palabras clave STOP/HELP, y el hecho de que el consentimiento
        no es condición para ninguna compra) antes de que se envíe
        cualquier mensaje. Cada destinatario en nuestra lista de SMS
        ha optado por una de las siguientes:
      </p>
      <ul>
        <li>
          <strong>Aceptación por formulario web.</strong> El destinatario
          envía una solicitud en nuestro formulario público de contacto
          en{" "}
          <a href="https://www.ashfordhealthcreative.com/contact" className="break-all">
            https://www.ashfordhealthcreative.com/contact
          </a>{" "}
          o a través del chatbot del sitio. Cuando se proporciona un
          número de teléfono, se muestra una casilla de consentimiento
          explícita y desmarcada por defecto justo encima del botón de
          envío, con la divulgación textual citada abajo. El formulario
          no se puede enviar con un número de teléfono salvo que se
          marque esa casilla. Cada envío se registra con el texto
          textual de la divulgación, una marca de tiempo ISO y la
          dirección IP del remitente.
        </li>
        <li>
          <strong>Consentimiento verbal en una llamada grabada.</strong>{" "}
          Un representante de ventas de Ashford Creative hace una
          llamada saliente al número comercial publicado del terapeuta.
          Antes de enviar cualquier mensaje, el representante lee la
          divulgación de abajo y espera el consentimiento afirmativo. La
          grabación, la marca de tiempo, el identificador del
          representante y el número consentido se conservan como prueba.
        </li>
      </ul>

      <h2>Divulgación de consentimiento textual</h2>
      <p>
        Ya sea recopilada por formulario web o verbalmente, la
        divulgación presentada a cada destinatario es, palabra por
        palabra:
      </p>
      <blockquote>{t("sms_consent_disclosure")}</blockquote>
      <p>
        Los registros de consentimiento (texto textual de la divulgación,
        marca de tiempo, dirección IP en envíos web, y grabación para el
        consentimiento verbal) se conservan durante la duración de la
        relación más cuatro años. El consentimiento no es una condición
        para ninguna compra. La información móvil (números de teléfono y
        estado de consentimiento) nunca se comparte con terceros para
        sus propios fines de marketing.
      </p>

      <h2>Cancelación (STOP)</h2>
      <p>
        Puedes cancelar el Programa de SMS en cualquier momento. Responde
        <strong> STOP</strong> a cualquier mensaje que recibas de nosotros.
        Después de que envíes STOP, te enviaremos un mensaje final de
        confirmación y no te enviaremos más mensajes a menos que vuelvas
        a aceptar. También puedes escribir a
        <a href="mailto:sms@ashfordhealthcreative.com"> sms@ashfordhealthcreative.com</a>
        y eliminaremos tu número en un día hábil.
      </p>

      <h2>Ayuda (HELP)</h2>
      <p>
        Para obtener ayuda, responde <strong>HELP</strong> a cualquier
        mensaje, o contáctanos en
        <a href="mailto:support@ashfordhealthcreative.com"> support@ashfordhealthcreative.com</a>
        o al 1-512-555-0182. Nuestro horario es de lunes a viernes, de
        9:00 a. m. a 6:00 p. m., hora del centro.
      </p>

      <h2>Aviso de operadores</h2>
      <p>
        Los operadores (incluidos, entre otros, AT&amp;T, T-Mobile,
        Verizon y Sprint) no son responsables de los mensajes retrasados
        o no entregados.
      </p>

      <h2>Privacidad</h2>
      <p>
        Los números de teléfono, los registros de consentimiento y el
        historial de SMS se manejan de acuerdo con nuestra
        <a href="/legal/privacy"> Política de Privacidad</a>. No vendemos
        ni compartimos números de teléfono ni datos de aceptación de SMS
        con terceros para sus fines de marketing. La información de
        aceptación de SMS se trata como confidencial.
      </p>

      <h2>Términos</h2>
      <p>
        Al participar en el Programa de SMS también aceptas nuestros
        <a href="/legal/terms"> Términos de Servicio</a>.
      </p>

      <h2>Operadores compatibles</h2>
      <p>
        El Programa de SMS de Ashford Creative está disponible en la
        mayoría de los operadores inalámbricos importantes de EE. UU. El
        servicio no está garantizado en todos los operadores y está
        sujeto a las limitaciones del operador y de la región.
      </p>

      <h2>Contacto</h2>
      <p>
        Ashford Creative LLC, Austin, Texas. Preguntas sobre el Programa
        de SMS: <a href="mailto:sms@ashfordhealthcreative.com">sms@ashfordhealthcreative.com</a>.
      </p>
    </>
  );

  return (
    <>
      <Seo
        title={t("legal_sms_title")}
        description={
          locale === "es"
            ? "Política de consentimiento de SMS de Ashford Creative."
            : "SMS consent policy for Ashford Creative."
        }
        path="/legal/sms-consent"
      />
      <section className="py-20 px-6 lg:px-12 bg-cream">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-display text-4xl md:text-5xl text-ink mb-3">
            {t("legal_sms_title")}
          </h1>
          <p className="text-sm text-ink/55 mb-10 font-mono">
            {locale === "es" ? "Última actualización" : "Last updated"}: Apr 2026
          </p>
          <div className="prose-ashford break-words [&_a]:break-all">{locale === "es" ? es : en}</div>
        </div>
      </section>
    </>
  );
}
