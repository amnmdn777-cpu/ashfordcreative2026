import { Resend } from "resend";
import { TIERS, type TierKey } from "@workspace/api-zod";
import { env } from "../lib/env";
import { db, emailMessages } from "@workspace/db";
import { logger } from "../lib/logger";
import { wrapHtmlEmail } from "./emailLayout";

const client = env.resendApiKey ? new Resend(env.resendApiKey) : null;

type Locale = "en" | "es";

export type WelcomeEmailParams = {
  to: string;
  customerName?: string | null;
  tierKey: TierKey;
  monthlyTotalCents: number;
  // 2026-05-21 — `onboardingUrl` dropped (client onboarding flow killed).
  managePortalUrl: string;
  locale?: Locale;
  saleId: number;
  leadId?: number | null;
  // Optional first name of the rep who closed the sale. When present we
  // sign as "— Sarah · Ashford Creative, Austin" so the boutique tone
  // carries through post-checkout. Falls back to a generic Ashford signoff.
  repFirstName?: string | null;
};

const buildSenderAddress = (): string => {
  const baseEmail = env.resendFromEmail ?? "hello@ashfordcreative.org";
  const emailOnly = baseEmail.includes("<")
    ? baseEmail.replace(/.*<([^>]+)>.*/, "$1")
    : baseEmail;
  return `"Ashford Creative" <${emailOnly}>`;
};

const fmt = (cents: number) => `$${(cents / 100).toFixed(0)}`;

const buildContent = (params: WelcomeEmailParams): { subject: string; body: string } => {
  const locale: Locale = params.locale === "es" ? "es" : "en";
  const firstName =
    params.customerName?.trim().split(/\s+/)[0] ??
    (locale === "es" ? "hola" : "there");
  const monthly = fmt(params.monthlyTotalCents);
  const rep = params.repFirstName?.trim() || null;
  const signoff =
    locale === "es"
      ? rep
        ? `— ${rep} · Ashford Creative, Austin`
        : `— Ashford Creative, Austin`
      : rep
        ? `— ${rep} · Ashford Creative, Austin`
        : `— Ashford Creative, Austin`;

  // 2026-05-21 — Welcome rewritten: rep contacts client in 24h, no form.
  if (locale === "es") {
    const subject = "¡Bienvenido a Ashford Creative!";
    const body =
      `Hola ${firstName},\n\n` +
      `¡Gracias por elegir a Ashford Creative! Tu pago fue procesado correctamente.\n\n` +
      `Resumen de tu plan:\n` +
      `• ${TIERS[params.tierKey].label}\n` +
      `• ${monthly}/mes\n\n` +
      `Próximos pasos\n` +
      `Tu rep te contacta en las próximas 24 horas para empezar a construir tu sitio. No tienes nada que llenar — ya tenemos lo que necesitamos de nuestra conversación.\n\n` +
      `Administrar tu facturación\n` +
      `${params.managePortalUrl}\n\n` +
      `¿Preguntas? Responde a este correo o escribe directamente a hello@ashfordcreative.org.\n\n` +
      `${signoff}\n`;
    return { subject, body };
  }

  const subject = "Welcome to Ashford Creative";
  const body =
    `Hi ${firstName},\n\n` +
    `Thanks for choosing Ashford Creative! Your payment went through successfully.\n\n` +
    `Plan summary:\n` +
    `• ${TIERS[params.tierKey].label}\n` +
    `• ${monthly}/month\n\n` +
    `What happens next\n` +
    `Your rep will reach out within the next 24 hours to start building your site. There's nothing for you to fill out — we already have what we need from our conversation.\n\n` +
    `Manage your billing\n` +
    `${params.managePortalUrl}\n\n` +
    `Questions? Just reply to this email or write directly to hello@ashfordcreative.org.\n\n` +
    `${signoff}\n`;
  return { subject, body };
};


/**
 * Deterministic idempotency key for a welcome email tied to a specific sale.
 * Stored in `email_messages.in_reply_to_id` and used by the Stripe webhook to
 * dedupe across retries. Sale-scoped so a returning customer's later purchase
 * still gets its own welcome email.
 */
export const welcomeEmailIdempotencyKey = (saleId: number): string =>
  `welcome:sale:${saleId}`;

// ---------------------------------------------------------------------------
// Payment-failed (dunning) email
// ---------------------------------------------------------------------------

export type PaymentFailedEmailParams = {
  to: string;
  customerName?: string | null;
  amountDueCents: number;
  nextRetryAt: Date | null;
  managePortalUrl: string;
  invoiceId: string;
  saleId: number;
  leadId?: number | null;
  locale?: Locale;
  // See WelcomeEmailParams.repFirstName.
  repFirstName?: string | null;
};

/**
 * Idempotency key for a customer-facing payment-failed email. Stripe will
 * retry a failed payment several times; we send at most one email per
 * Stripe invoice ID across all those retries.
 */
export const paymentFailedEmailIdempotencyKey = (invoiceId: string): string =>
  `payment_failed:invoice:${invoiceId}`;

const buildPaymentFailedContent = (
  params: PaymentFailedEmailParams,
): { subject: string; body: string } => {
  const locale: Locale = params.locale === "es" ? "es" : "en";
  const firstName =
    params.customerName?.trim().split(/\s+/)[0] ??
    (locale === "es" ? "hola" : "there");
  const amount = fmt(params.amountDueCents);
  const retryLine = params.nextRetryAt
    ? params.nextRetryAt.toLocaleDateString(
        locale === "es" ? "es-US" : "en-US",
        { month: "long", day: "numeric", year: "numeric" },
      )
    : null;

  const rep = params.repFirstName?.trim() || null;
  const signoff = rep
    ? `— ${rep} · Ashford Creative, Austin`
    : `— Ashford Creative, Austin`;

  if (locale === "es") {
    const subject = "Tu pago no se procesó — actualiza tu tarjeta";
    const body =
      `Hola ${firstName},\n\n` +
      `Tu banco rechazó el cobro de tu suscripción de Ashford Creative (${amount}).\n\n` +
      (retryLine
        ? `Stripe volverá a intentarlo automáticamente alrededor del ${retryLine}.\n\n`
        : `Stripe volverá a intentarlo automáticamente en los próximos días.\n\n`) +
      `Para actualizar tu tarjeta o método de pago ahora, abre tu portal de facturación:\n\n` +
      `${params.managePortalUrl}\n\n` +
      `Tu sitio sigue activo — solo necesitamos un método de pago vigente para continuar.\n\n` +
      `¿Preguntas? Responde a este correo o escribe a hello@ashfordcreative.org.\n\n` +
      `${signoff}\n`;
    return { subject, body };
  }

  const subject = "Your payment didn't go through — please update your card";
  const body =
    `Hi ${firstName},\n\n` +
    `Your bank declined the latest charge on your Ashford Creative subscription (${amount}).\n\n` +
    (retryLine
      ? `Stripe will automatically try again around ${retryLine}.\n\n`
      : `Stripe will automatically try again over the next few days.\n\n`) +
    `To update your card or payment method now, open your billing portal:\n\n` +
    `${params.managePortalUrl}\n\n` +
    `Your site is still up — we just need a working payment method to keep things going.\n\n` +
    `Questions? Reply to this email or write to hello@ashfordcreative.org.\n\n` +
    `${signoff}\n`;
  return { subject, body };
};

export const sendPaymentFailedEmail = async (
  params: PaymentFailedEmailParams,
): Promise<{ id: number; status: string; resendId: string | null }> => {
  const { subject, body } = buildPaymentFailedContent(params);
  const from = buildSenderAddress();
  const replyTo = `hello@${(env.resendFromEmail ?? "hello@ashfordcreative.org").split("@")[1] ?? "ashfordcreative.org"}`;
  const locale = params.locale === "es" ? "es" : "en";
  const htmlBody = wrapHtmlEmail({
    bodyText: body,
    ctaUrl: params.managePortalUrl,
    ctaLabel: locale === "es" ? "Actualizar mi tarjeta" : "Update my card",
    locale,
  });
  const idempotencyKey = paymentFailedEmailIdempotencyKey(params.invoiceId);

  if (!client) {
    logger.warn(
      { to: params.to, subject, invoiceId: params.invoiceId },
      "Resend not configured — payment-failed email recorded as dev_skipped",
    );
    const [row] = await db
      .insert(emailMessages)
      .values({
        direction: "outbound",
        fromAddr: from,
        toAddr: params.to,
        subject,
        body,
        leadId: params.leadId ?? undefined,
        status: "dev_skipped",
        inReplyToId: idempotencyKey,
      })
      .returning();
    return { id: row.id, status: "dev_skipped", resendId: null };
  }

  try {
    const result = await client.emails.send({
      from,
      to: params.to,
      replyTo,
      subject,
      html: htmlBody,
      text: body,
    });
    if (result.error) throw new Error(result.error.message);
    const [row] = await db
      .insert(emailMessages)
      .values({
        direction: "outbound",
        fromAddr: from,
        toAddr: params.to,
        subject,
        body,
        leadId: params.leadId ?? undefined,
        status: "sent",
        resendId: result.data?.id,
        inReplyToId: idempotencyKey,
      })
      .returning();
    logger.info(
      { invoiceId: params.invoiceId, saleId: params.saleId, to: params.to, resendId: result.data?.id },
      "payment-failed email sent",
    );
    return { id: row.id, status: "sent", resendId: result.data?.id ?? null };
  } catch (err) {
    logger.error(
      { err, invoiceId: params.invoiceId, saleId: params.saleId },
      "payment-failed email send failed",
    );
    const [row] = await db
      .insert(emailMessages)
      .values({
        direction: "outbound",
        fromAddr: from,
        toAddr: params.to,
        subject,
        body,
        leadId: params.leadId ?? undefined,
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        // NB: we DO NOT set inReplyToId here so a transient send error can be
        // retried by a future invocation rather than being marked as already-sent.
      })
      .returning();
    return { id: row.id, status: "failed", resendId: null };
  }
};

// ---------------------------------------------------------------------------
// Welcome email
// ---------------------------------------------------------------------------

export const sendWelcomeEmail = async (
  params: WelcomeEmailParams,
): Promise<{ id: number; status: string; resendId: string | null }> => {
  const { subject, body } = buildContent(params);
  const from = buildSenderAddress();
  const replyTo = `hello@${(env.resendFromEmail ?? "hello@ashfordcreative.org").split("@")[1] ?? "ashfordcreative.org"}`;
  const locale = params.locale === "es" ? "es" : "en";
  const htmlBody = wrapHtmlEmail({
    bodyText: body,
    // 2026-05-21 — CTA points at billing now (onboarding flow removed).
    ctaUrl: params.managePortalUrl,
    ctaLabel: locale === "es" ? "Mi facturación" : "My billing",
    locale,
  });

  // Sale-scoped idempotency marker stored in `inReplyToId` (free-form
  // varchar). The webhook caller queries this exact value to decide whether
  // a welcome email was already recorded for this specific sale.
  const idempotencyKey = welcomeEmailIdempotencyKey(params.saleId);

  if (!client) {
    logger.warn(
      { to: params.to, subject, saleId: params.saleId },
      "Resend not configured — welcome email recorded as dev_skipped",
    );
    const [row] = await db
      .insert(emailMessages)
      .values({
        direction: "outbound",
        fromAddr: from,
        toAddr: params.to,
        subject,
        body,
        leadId: params.leadId ?? undefined,
        status: "dev_skipped",
        inReplyToId: idempotencyKey,
      })
      .returning();
    return { id: row.id, status: "dev_skipped", resendId: null };
  }

  try {
    const result = await client.emails.send({
      from,
      to: params.to,
      replyTo,
      subject,
      html: htmlBody,
      text: body,
    });
    if (result.error) throw new Error(result.error.message);
    const [row] = await db
      .insert(emailMessages)
      .values({
        direction: "outbound",
        fromAddr: from,
        toAddr: params.to,
        subject,
        body,
        leadId: params.leadId ?? undefined,
        status: "sent",
        resendId: result.data?.id,
        inReplyToId: idempotencyKey,
      })
      .returning();
    logger.info(
      { saleId: params.saleId, to: params.to, resendId: result.data?.id },
      "welcome email sent",
    );
    return { id: row.id, status: "sent", resendId: result.data?.id ?? null };
  } catch (err) {
    logger.error({ err, saleId: params.saleId }, "welcome email send failed");
    const [row] = await db
      .insert(emailMessages)
      .values({
        direction: "outbound",
        fromAddr: from,
        toAddr: params.to,
        subject,
        body,
        leadId: params.leadId ?? undefined,
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      .returning();
    return { id: row.id, status: "failed", resendId: null };
  }
};
