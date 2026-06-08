import crypto from "node:crypto";
import { env } from "../lib/env";
import { logger } from "../lib/logger";

/**
 * TextBelt outbound-SMS client + webhook signature verifier.
 *
 * https://docs.textbelt.com — POST https://textbelt.com/text with form
 * params: phone, message, key, replyWebhookUrl. Successful response is
 * { success: true, textId, quotaRemaining }. Replies POST to the
 * `replyWebhookUrl` with HMAC-SHA256 signature in headers.
 *
 * The free `key="textbelt"` quota is 1 send/IP/day with no inbound
 * replies. As soon as TEXTBELT_API_KEY is set to a paid key, every
 * send AND inbound reply route through that account. We default to
 * the free key so dev/CI can prove the wiring without buying credits.
 */

const FREE_TEST_KEY = "textbelt";

/**
 * "Configured" means the provider should be selected by the sendSms
 * priority chain. We require an explicit TEXTBELT_API_KEY (any value,
 * including the literal "textbelt" free key) so that an unset env var
 * does NOT silently take over and shadow a still-configured fallback
 * provider. To run on the free tier in dev, set TEXTBELT_API_KEY=textbelt
 * explicitly.
 */
export const isTextbeltConfigured = (): boolean =>
  !!env.textbeltApiKey && env.textbeltApiKey.trim().length > 0;

/** True only when the configured key is a paid key (not the free-tier
 * test key). Reply webhooks only fire on paid keys, so signature
 * verification + the inbound webhook route both gate on this. */
export const isTextbeltLiveKey = (): boolean => {
  const k = env.textbeltApiKey?.trim();
  return !!k && k !== FREE_TEST_KEY;
};

const textbeltKey = (): string =>
  env.textbeltApiKey && env.textbeltApiKey.trim().length > 0
    ? env.textbeltApiKey.trim()
    : FREE_TEST_KEY;

const textbeltApiBase = (): string =>
  env.textbeltApiBaseUrl.replace(/\/$/, "");

const replyWebhookUrl = (): string => {
  const base = env.publicBaseUrl.replace(/\/$/, "");
  return `${base}/api/webhooks/textbelt/sms`;
};

export type TextbeltSendResult = {
  ok: boolean;
  /** TextBelt's `textId` — used to look up the original lead+rep when
   * a reply webhook fires. Stored in twilio_messages.twilio_sid. */
  textId: string | null;
  /** Provider remaining-credit count, when the response surfaced one. */
  quotaRemaining: number | null;
  error: string | null;
};

/**
 * Send a single SMS via TextBelt. Replies are routed to our webhook
 * automatically when a real (non-test) key is configured; with the
 * free key we omit replyWebhookUrl because the free tier rejects it.
 */
export const sendSmsViaTextbelt = async (params: {
  to: string;
  message: string;
  leadId?: number;
  repId?: number;
}): Promise<TextbeltSendResult> => {
  const url = `${textbeltApiBase()}/text`;
  const form = new URLSearchParams();
  form.set("phone", params.to);
  form.set("message", params.message);
  form.set("key", textbeltKey());
  if (isTextbeltLiveKey()) {
    form.set("replyWebhookUrl", replyWebhookUrl());
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: form.toString(),
    });
  } catch (err) {
    logger.error(
      { err, to: params.to, leadId: params.leadId, repId: params.repId },
      "textbelt send failed (network)",
    );
    return {
      ok: false,
      textId: null,
      quotaRemaining: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  let body: unknown = null;
  let rawText: string | null = null;
  try {
    rawText = await res.text();
    if (rawText) body = JSON.parse(rawText);
  } catch {
    body = null;
  }

  type TbShape = {
    success?: boolean;
    textId?: string | number;
    quotaRemaining?: number;
    error?: string;
  };
  const parsed = (body && typeof body === "object" ? body : {}) as TbShape;

  const success = res.ok && parsed.success === true;
  const textId = parsed.textId != null ? String(parsed.textId) : null;
  const quotaRemaining =
    typeof parsed.quotaRemaining === "number" ? parsed.quotaRemaining : null;

  if (!success) {
    const errMsg =
      parsed.error ??
      (rawText && rawText.length < 500 ? rawText : null) ??
      `HTTP ${res.status}`;
    logger.error(
      {
        status: res.status,
        to: params.to,
        leadId: params.leadId,
        repId: params.repId,
        errMsg,
      },
      "textbelt send rejected",
    );
    return { ok: false, textId, quotaRemaining, error: errMsg };
  }

  return { ok: true, textId, quotaRemaining, error: null };
};

/**
 * Verify TextBelt's reply-webhook signature. The header
 * `X-Textbelt-Signature` is HMAC-SHA256(timestamp + rawBody, apiKey)
 * hex-encoded. We reject timestamps more than 5 minutes old to prevent
 * replay. Returns true only when configured AND signature is valid.
 *
 * NB: We require a real paid key to verify — the free "textbelt" key
 * does not produce reply webhooks at all, so receiving one with no
 * paid key configured is by definition spoofed.
 */
export const verifyTextbeltSignature = (params: {
  signatureHeader: string | undefined;
  timestampHeader: string | undefined;
  rawBody: string;
}): boolean => {
  if (!isTextbeltLiveKey()) return false;
  const sig = params.signatureHeader?.trim();
  const ts = params.timestampHeader?.trim();
  if (!sig || !ts) return false;

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  const ageSec = Math.abs(Date.now() / 1000 - tsNum);
  if (ageSec > 60 * 5) {
    logger.warn({ ageSec }, "textbelt webhook timestamp too old");
    return false;
  }

  const expected = crypto
    .createHmac("sha256", textbeltKey())
    .update(ts + params.rawBody)
    .digest("hex");

  // Constant-time compare to dodge timing attacks.
  const a = Buffer.from(expected, "hex");
  let b: Buffer;
  try {
    b = Buffer.from(sig, "hex");
  } catch {
    return false;
  }
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};
