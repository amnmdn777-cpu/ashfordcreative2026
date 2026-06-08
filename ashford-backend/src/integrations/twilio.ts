/**
 * @deprecated Twilio SMS retired 2026-04-27 (task #181). Use
 * `integrations/dialpad.ts`. Only the unmounted legacy route files
 * `routes/webhooks/twilio.ts` + `routes/webhooks/twilioVoice.ts` still
 * import from here; both will be deleted in the 30-day cleanup pass
 * (follow-up #183). DO NOT add new imports.
 */
import twilio from "twilio";
import { env } from "../lib/env";
import { db, twilioMessages, smsOptOuts } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const client =
  env.twilioAccountSid && env.twilioAuthToken
    ? twilio(env.twilioAccountSid, env.twilioAuthToken)
    : null;

/** True when Twilio has the credentials *and* an outbound `from` number
 * configured. The dashboard surfaces this as a banner so reps know whether
 * SMS sends will actually leave the building or get persisted as
 * `dev_skipped`. */
export const isTwilioConfigured = (): boolean =>
  !!(client && env.twilioFromNumber);

export type SendSmsParams = {
  to: string;
  body: string;
  leadId?: number;
  repId?: number;
  fromRepFirstName?: string;
};

/**
 * Canonicalize a phone number to a stable form for opt-out matching. Twilio
 * always sends inbound `From` in E.164 (`+15125550100`) but outbound callers
 * inside our app may pass user-entered formats like `(512) 555-0100` or
 * `512-555-0100`. We strip everything except digits and a leading `+` so both
 * sides compare equally. If a number has no country code we assume US (`+1`).
 */
export const normalizePhone = (phone: string): string => {
  const trimmed = (phone ?? "").trim();
  if (!trimmed) return "";
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (hasPlus) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
};

/**
 * Returns true if `phone` is on the opt-out list and we must not send any
 * further SMS to it. The list is populated by the inbound Twilio webhook when
 * an inbound STOP / UNSUBSCRIBE / CANCEL keyword is detected. Both sides go
 * through `normalizePhone` so user-entered formats still match the E.164
 * value Twilio writes on inbound.
 */
export const isPhoneOptedOut = async (phone: string): Promise<boolean> => {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  const [row] = await db
    .select({ id: smsOptOuts.id })
    .from(smsOptOuts)
    .where(eq(smsOptOuts.phone, normalized))
    .limit(1);
  return !!row;
};

export const sendSms = async (
  params: SendSmsParams,
): Promise<{ id: number; status: string; sid: string | null }> => {
  const fromNumber = env.twilioFromNumber ?? "+15555550100";
  const finalBody = params.fromRepFirstName
    ? `${params.body}\n\n— ${params.fromRepFirstName}, Ashford Creative`
    : params.body;

  // Carrier compliance: never send to a number that has opted out. We still
  // persist a row so the rep can see the attempted send was suppressed.
  if (await isPhoneOptedOut(params.to)) {
    logger.warn(
      { to: params.to, leadId: params.leadId, repId: params.repId },
      "SMS suppressed — recipient has opted out (STOP)",
    );
    const [row] = await db
      .insert(twilioMessages)
      .values({
        direction: "outbound",
        fromNumber,
        toNumber: params.to,
        body: finalBody,
        leadId: params.leadId,
        repId: params.repId,
        status: "dev_skipped",
        errorMessage: "recipient_opted_out",
      })
      .returning();
    return { id: row.id, status: "opted_out", sid: null };
  }

  if (!client || !env.twilioFromNumber) {
    logger.warn(
      { to: params.to, body: finalBody.slice(0, 80) },
      "Twilio not configured — persisting as dev_skipped",
    );
    const [row] = await db
      .insert(twilioMessages)
      .values({
        direction: "outbound",
        fromNumber,
        toNumber: params.to,
        body: finalBody,
        leadId: params.leadId,
        repId: params.repId,
        status: "dev_skipped",
      })
      .returning();
    return { id: row.id, status: "dev_skipped", sid: null };
  }

  try {
    const msg = await client.messages.create({
      from: fromNumber,
      to: params.to,
      body: finalBody,
    });
    const [row] = await db
      .insert(twilioMessages)
      .values({
        direction: "outbound",
        fromNumber,
        toNumber: params.to,
        body: finalBody,
        leadId: params.leadId,
        repId: params.repId,
        status: "sent",
        twilioSid: msg.sid,
      })
      .returning();
    return { id: row.id, status: "sent", sid: msg.sid };
  } catch (err) {
    logger.error({ err, to: params.to }, "Twilio send failed");
    const [row] = await db
      .insert(twilioMessages)
      .values({
        direction: "outbound",
        fromNumber,
        toNumber: params.to,
        body: finalBody,
        leadId: params.leadId,
        repId: params.repId,
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      .returning();
    return { id: row.id, status: "failed", sid: null };
  }
};

export const recordInboundSms = async (params: {
  fromNumber: string;
  toNumber: string;
  body: string;
  twilioSid: string;
  leadId?: number;
  repId?: number;
}) => {
  const [row] = await db
    .insert(twilioMessages)
    .values({
      direction: "inbound",
      fromNumber: params.fromNumber,
      toNumber: params.toNumber,
      body: params.body,
      leadId: params.leadId,
      repId: params.repId,
      status: "received",
      twilioSid: params.twilioSid,
    })
    .returning();
  return row;
};
