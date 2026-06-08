import { db, customDevQuotes, leads } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { notFound } from "../lib/errors";
import { createCustomDevPaymentLink } from "../integrations/stripe";
import { sendSms } from "../integrations/dialpad";
import { sendEmail } from "../integrations/resend";
import { logger } from "../lib/logger";
import { notify, notifyOwner } from "../services/notifications";
import { salesReps } from "@workspace/db";

export const createQuoteRequest = async (params: {
  repId: number;
  leadId?: number;
  saleId?: number;
  featureKeys: string[];
  customDescription?: string;
}) => {
  const [row] = await db
    .insert(customDevQuotes)
    .values({
      repId: params.repId,
      leadId: params.leadId,
      saleId: params.saleId,
      featureKeys: params.featureKeys,
      customDescription: params.customDescription,
      status: "requested",
    })
    .returning();

  // Fan out: in-app notify all admins, plus owner email/SMS.
  try {
    const admins = await db
      .select({ id: salesReps.id })
      .from(salesReps)
      .where(eq(salesReps.role, "admin"));
    const featuresLabel = params.featureKeys.length
      ? params.featureKeys.join(", ")
      : "custom scope";
    const title = "Custom-dev quote requested";
    const body = `Rep #${params.repId} requested a quote on ${featuresLabel}.${
      params.customDescription ? ` Notes: ${params.customDescription.slice(0, 240)}` : ""
    }`;
    await Promise.all(
      admins.map((a) =>
        notify({
          repId: a.id,
          type: "custom_dev.quote_requested",
          title,
          body,
          payload: { quoteId: row.id, leadId: params.leadId, repId: params.repId },
          linkUrl: `/admin/custom-dev`,
        }),
      ),
    );
    await notifyOwner({
      type: "custom_dev.quote_requested",
      title,
      body,
      linkUrl: `/ashford-admin/custom-dev`,
    });
  } catch (err) {
    logger.error({ err, quoteId: row.id }, "custom-dev quote notify failed (non-fatal)");
  }

  return row;
};

export const setQuoteAmount = async (
  quoteId: number,
  quotedAmountCents: number,
  adminNote?: string,
) => {
  const [row] = await db
    .update(customDevQuotes)
    .set({ quotedAmountCents, adminNote, status: "quoted" })
    .where(eq(customDevQuotes.id, quoteId))
    .returning();
  if (!row) throw notFound("Quote not found");
  return row;
};

export const sendQuoteToProspect = async (quoteId: number) => {
  const [quote] = await db
    .select()
    .from(customDevQuotes)
    .where(eq(customDevQuotes.id, quoteId))
    .limit(1);
  if (!quote) throw notFound("Quote not found");
  if (!quote.quotedAmountCents)
    throw new Error("Quote must have an amount before sending.");

  const desc = `Custom development — ${quote.featureKeys.join(", ") || "scoped work"}`;
  const link = await createCustomDevPaymentLink({
    description: desc,
    amountCents: quote.quotedAmountCents,
    metadata: {
      // Spec contract metadata key is snake_case. We also send the legacy
      // camelCase key for backward compatibility with any in-flight events.
      quote_id: String(quoteId),
      quoteId: String(quoteId),
      lead_id: quote.leadId ? String(quote.leadId) : "",
      leadId: quote.leadId ? String(quote.leadId) : "",
    },
  });

  const [updated] = await db
    .update(customDevQuotes)
    .set({
      status: "sent",
      sentAt: new Date(),
      stripePaymentLinkUrl: link.url,
      stripePaymentLinkId: link.id,
    })
    .where(eq(customDevQuotes.id, quoteId))
    .returning();

  // Spec Step 15: deliver the quote to the prospect via SMS + email when contact info exists.
  let smsResult: { id: number; status: string } | null = null;
  let emailResult: { id: number; status: string } | null = null;
  if (quote.leadId) {
    const [lead] = await db
      .select({
        id: leads.id,
        name: leads.name,
        phone: leads.phone,
        email: leads.email,
      })
      .from(leads)
      .where(eq(leads.id, quote.leadId))
      .limit(1);
    if (lead) {
      const dollars = (quote.quotedAmountCents / 100).toFixed(2);
      const smsBody = `Your custom development quote from Ashford Creative is ready: $${dollars}. Pay securely here: ${link.url}`;
      const emailBody = `Hi${lead.name ? " " + lead.name.split(" ")[0] : ""},\n\n${desc} — total $${dollars}.\n\nPay securely here: ${link.url}\n\nReply with any questions.`;
      try {
        if (lead.phone) {
          const r = await sendSms({
            to: lead.phone,
            body: smsBody,
            leadId: lead.id,
            repId: updated.repId ?? undefined,
          });
          smsResult = { id: r.id, status: r.status };
        }
      } catch (err) {
        logger.warn({ err, leadId: lead.id }, "quote SMS send failed");
      }
      try {
        if (lead.email) {
          const r = await sendEmail({
            to: lead.email,
            subject: "Your custom development quote from Ashford Creative",
            body: emailBody,
            leadId: lead.id,
            repId: updated.repId ?? undefined,
          });
          emailResult = { id: r.id, status: r.status };
        }
      } catch (err) {
        logger.warn({ err, leadId: lead.id }, "quote email send failed");
      }
    }
  }
  return { quote: updated, sms: smsResult, email: emailResult };
};

export const listAllQuotes = () =>
  db.select().from(customDevQuotes).orderBy(desc(customDevQuotes.createdAt));

export const listRepQuotes = (repId: number) =>
  db
    .select()
    .from(customDevQuotes)
    .where(eq(customDevQuotes.repId, repId))
    .orderBy(desc(customDevQuotes.createdAt));
