import Stripe from "stripe";
import { TIERS, type TierKey } from "@workspace/api-zod";
import { env } from "../lib/env";
import { logger } from "../lib/logger";

export const stripe: Stripe | null = env.stripeSecretKey
  ? new Stripe(env.stripeSecretKey, { apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion })
  : null;

/**
 * Find an existing Customer by email or create a fresh one. Used by Checkout
 * paths so we can pass an explicit `customer` id and `customer_update` to
 * persist the billing address Stripe Tax needs to compute destination tax.
 */
export const resolveCustomerByEmail = async (
  client: Stripe,
  email: string,
  metadata: Record<string, string> = {},
): Promise<string> => {
  const existing = await client.customers.list({ email, limit: 1 });
  if (existing.data[0]) return existing.data[0].id;
  const created = await client.customers.create({ email, metadata });
  return created.id;
};

export type CreateCheckoutParams = {
  tierKey: TierKey;
  monthlyTotalCents: number;
  setupCents: number;
  promoCode?: string;
  leadId?: number;
  repId?: number;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  /** Optional client IP captured at the API edge — stamped on the sale row alongside Terms acceptance. */
  acceptedTermsIp?: string;
  /** Locale propagated to Stripe Checkout UI and welcome email. */
  locale?: "en" | "es";
};

/** Version stamped on the sale when the customer accepts the Terms of Service at Checkout. */
export const TERMS_OF_SERVICE_VERSION = "v1.0-2026-04-23";

/** Stripe Tax codes — keep in sync with services/stripeCatalogSync.ts. */
export const TAX_CODE_SAAS = "txcd_10103001";
export const TAX_CODE_SAAS_SETUP = "txcd_10103000";
/** Sales tax is added on top of the listed price (vs. inclusive). */
export const TAX_BEHAVIOR_EXCLUSIVE = "exclusive" as const;

// Returns the URL to redirect the prospect to. In dev (no stripe key), returns a mock URL.
export const createCheckoutSession = async (
  params: CreateCheckoutParams,
): Promise<{ url: string; sessionId: string | null }> => {
  const tierLabel = TIERS[params.tierKey].label;
  if (!stripe) {
    const mockId = `cs_dev_${Date.now()}`;
    logger.warn(
      { params: { tierKey: params.tierKey, leadId: params.leadId } },
      "Stripe not configured — returning dev mock checkout URL",
    );
    return {
      url: `${params.successUrl}?session_id=${mockId}&dev=1`,
      sessionId: mockId,
    };
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: "usd",
        recurring: { interval: "month" },
        unit_amount: params.monthlyTotalCents,
        tax_behavior: TAX_BEHAVIOR_EXCLUSIVE,
        product_data: {
          name: `Ashford Creative — ${tierLabel} (monthly)`,
          description:
            "Boutique website + reseller hosting for mental-health practitioners.",
          tax_code: TAX_CODE_SAAS,
        },
      },
      quantity: 1,
    },
  ];

  if (params.setupCents > 0) {
    lineItems.unshift({
      price_data: {
        currency: "usd",
        unit_amount: params.setupCents,
        tax_behavior: TAX_BEHAVIOR_EXCLUSIVE,
        product_data: {
          name: `${tierLabel} setup (one-time)`,
          tax_code: TAX_CODE_SAAS_SETUP,
        },
      },
      quantity: 1,
    });
  }

  // Resolve a Customer up-front so we can pass `customer_update` (required by
  // Stripe to persist the billing address onto the Customer for Stripe Tax).
  const customerId = params.customerEmail
    ? await resolveCustomerByEmail(stripe, params.customerEmail, {
        leadId: params.leadId ? String(params.leadId) : "",
        repId: params.repId ? String(params.repId) : "",
      })
    : undefined;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: lineItems,
    ...(customerId ? { customer: customerId } : { customer_email: params.customerEmail }),
    success_url: `${params.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: params.cancelUrl,
    locale: params.locale === "es" ? "es" : "en",
    // STRIPE_REQUIRE_TOS_CONSENT gates consent_collection because Stripe
    // rejects the session if no ToS URL is set on the account.
    ...(process.env.STRIPE_REQUIRE_TOS_CONSENT === "true"
      ? { consent_collection: { terms_of_service: "required" as const } }
      : {}),
    billing_address_collection: "required",
    // STRIPE_AUTOMATIC_TAX_ENABLED gates automatic_tax because Stripe rejects
    // the session if the account has no head-office address registered.
    automatic_tax: {
      enabled: process.env.STRIPE_AUTOMATIC_TAX_ENABLED === "true",
    },
    ...(customerId
      ? { customer_update: { address: "auto" as const, name: "auto" as const } }
      : {}),
    metadata: {
      tierKey: params.tierKey,
      leadId: params.leadId ? String(params.leadId) : "",
      repId: params.repId ? String(params.repId) : "",
      promoCode: params.promoCode ?? "",
      acceptedTermsIp: params.acceptedTermsIp ?? "",
    },
    subscription_data: {
      metadata: {
        tierKey: params.tierKey,
        leadId: params.leadId ? String(params.leadId) : "",
        repId: params.repId ? String(params.repId) : "",
        promoCode: params.promoCode ?? "",
      },
    },
  });

  return { url: session.url ?? params.successUrl, sessionId: session.id };
};

export type CreatePaymentLinkParams = {
  description: string;
  amountCents: number;
  metadata?: Record<string, string>;
};

export const createCustomDevPaymentLink = async (
  params: CreatePaymentLinkParams,
): Promise<{ url: string; id: string | null }> => {
  if (!stripe) {
    const mockId = `plink_dev_${Date.now()}`;
    logger.warn(
      { description: params.description, amountCents: params.amountCents },
      "Stripe not configured — returning dev mock payment link",
    );
    return {
      url: `https://example.com/pay/${mockId}`,
      id: mockId,
    };
  }

  const product = await stripe.products.create({
    name: params.description,
  });
  const price = await stripe.prices.create({
    currency: "usd",
    unit_amount: params.amountCents,
    product: product.id,
  });
  // Payment Links don't support consent_collection — custom-dev quotes capture
  // Terms acceptance on the customDevQuotes row when the customer accepts.
  const link = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: {
      ...params.metadata,
      tos_version: TERMS_OF_SERVICE_VERSION,
    },
    automatic_tax: {
      enabled: process.env.STRIPE_AUTOMATIC_TAX_ENABLED === "true",
    },
    tax_id_collection: { enabled: true },
    customer_creation: "always",
    billing_address_collection: "required",
  });
  return { url: link.url, id: link.id };
};

export type RefundResult = {
  refundId: string;
  invoiceId: string;
  chargeId: string;
  amountCents: number;
  status: string | null;
  createdAt: Date;
};

export type StripeRefundError = {
  code: string;
  message: string;
  type: string;
};

export class StripeRefundFailure extends Error {
  detail: StripeRefundError;
  constructor(detail: StripeRefundError) {
    super(detail.message);
    this.detail = detail;
  }
}

/**
 * Issue a refund for a Stripe invoice. Looks up the invoice, resolves the
 * underlying charge, then calls `stripe.refunds.create` with a caller-supplied
 * idempotency key (so a duplicate click cannot produce two refunds).
 *
 * Throws `StripeRefundFailure` on any Stripe-side error so the route layer can
 * render a structured message back to the admin without resolving the approval.
 */
export const refundInvoice = async (params: {
  invoiceId: string;
  amountCents: number;
  idempotencyKey: string;
  metadata?: Record<string, string>;
}): Promise<RefundResult> => {
  if (!stripe) {
    throw new StripeRefundFailure({
      code: "stripe_not_configured",
      type: "configuration_error",
      message:
        "Stripe is not configured in this environment — set STRIPE_SECRET_KEY to issue refunds.",
    });
  }
  if (!Number.isFinite(params.amountCents) || params.amountCents <= 0) {
    throw new StripeRefundFailure({
      code: "invalid_amount",
      type: "validation_error",
      message: "Refund amount must be a positive number of cents.",
    });
  }

  let invoice: Stripe.Invoice;
  try {
    invoice = await stripe.invoices.retrieve(params.invoiceId);
  } catch (err) {
    const detail = mapStripeError(err, "invoice_lookup_failed");
    logger.warn(
      { invoiceId: params.invoiceId, err },
      "stripe invoice lookup failed",
    );
    throw new StripeRefundFailure(detail);
  }

  const chargeId =
    typeof invoice.charge === "string"
      ? invoice.charge
      : invoice.charge?.id ?? null;
  if (!chargeId) {
    throw new StripeRefundFailure({
      code: "no_charge_on_invoice",
      type: "validation_error",
      message: `Invoice ${params.invoiceId} has no associated charge to refund (status: ${invoice.status ?? "unknown"}).`,
    });
  }

  const amountPaid = invoice.amount_paid ?? 0;
  if (amountPaid > 0 && params.amountCents > amountPaid) {
    throw new StripeRefundFailure({
      code: "amount_exceeds_paid",
      type: "validation_error",
      message: `Refund amount ($${(params.amountCents / 100).toFixed(2)}) exceeds the invoice's paid amount ($${(amountPaid / 100).toFixed(2)}).`,
    });
  }

  let refund: Stripe.Refund;
  try {
    refund = await stripe.refunds.create(
      {
        charge: chargeId,
        amount: params.amountCents,
        metadata: params.metadata,
      },
      { idempotencyKey: params.idempotencyKey },
    );
  } catch (err) {
    const detail = mapStripeError(err, "refund_failed");
    logger.warn(
      { invoiceId: params.invoiceId, chargeId, err },
      "stripe refund failed",
    );
    throw new StripeRefundFailure(detail);
  }

  return {
    refundId: refund.id,
    invoiceId: params.invoiceId,
    chargeId,
    amountCents: refund.amount,
    status: refund.status,
    createdAt: new Date(refund.created * 1000),
  };
};

const mapStripeError = (err: unknown, fallbackCode: string): StripeRefundError => {
  if (err instanceof Stripe.errors.StripeError) {
    return {
      code: err.code ?? fallbackCode,
      type: err.type ?? "stripe_error",
      message: err.message,
    };
  }
  if (err instanceof Error) {
    return { code: fallbackCode, type: "unknown", message: err.message };
  }
  return {
    code: fallbackCode,
    type: "unknown",
    message: "An unknown error occurred while talking to Stripe.",
  };
};
