import { env } from "../lib/env";
import { logger } from "../lib/logger";

/**
 * SMS Mobile API (smsmobileapi.com) outbound-SMS client.
 *
 * The service is an Android/iOS app paired to a phone number — the API
 * accepts a job and the app forwards the message through the phone's
 * carrier. This replaces DialPad as the outbound-SMS path.
 *
 * Soft-fails when SMS_MOBILE_API_TOKEN is unset so dev environments and
 * CI stay green; the calling code (sendSms in dialpad.ts) treats a
 * missing configuration as "fall back to legacy DialPad SMS".
 */

export const isSmsMobileApiConfigured = (): boolean =>
  !!env.smsMobileApiToken;

export type SmsMobileApiSendResult = {
  /** True when the upstream accepted the job. */
  ok: boolean;
  /** Provider-side message id when one is returned. */
  messageId: string | null;
  /** Error message when ok=false; null on success. */
  error: string | null;
};

/**
 * POST /sendsms/ on smsmobileapi.com.
 *
 * Request:  application/x-www-form-urlencoded with fields
 *           apikey, recipients (E.164), message
 * Response: JSON of the form { result: { error, message, message_id, ... } }
 *           where error="0" / 0 / false means success. We accept a few
 *           variants defensively because their docs show both shapes.
 */
export const sendSmsViaSmsMobileApi = async (params: {
  to: string;
  message: string;
  /** Optional log-context fields, surfaced in error logs only. */
  leadId?: number;
  repId?: number;
}): Promise<SmsMobileApiSendResult> => {
  if (!env.smsMobileApiToken) {
    return {
      ok: false,
      messageId: null,
      error: "SMS_MOBILE_API_TOKEN missing",
    };
  }

  const base = env.smsMobileApiBaseUrl.replace(/\/$/, "");
  const url = `${base}/sendsms/`;

  const form = new URLSearchParams();
  form.set("apikey", env.smsMobileApiToken);
  form.set("recipients", params.to);
  form.set("message", params.message);

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
      {
        err,
        to: params.to,
        leadId: params.leadId,
        repId: params.repId,
      },
      "sms-mobile-api send failed (network)",
    );
    return {
      ok: false,
      messageId: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Read the body as JSON when possible, fall back to text so we still
  // capture useful error context when the upstream returns HTML.
  let parsed: unknown = null;
  let rawText: string | null = null;
  try {
    rawText = await res.text();
    if (rawText && rawText.trim().length > 0) {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = null;
      }
    }
  } catch {
    /* swallow — we'll synthesize an error from res.status below */
  }

  // Drill down into the typical { result: {...} } envelope; tolerate
  // payloads that put the fields at the top level instead.
  type ResultShape = {
    error?: number | string | boolean;
    message?: string;
    message_id?: string | number;
    id?: string | number;
  };
  let resultObj: ResultShape | null = null;
  if (parsed && typeof parsed === "object") {
    const maybeWrapper = parsed as { result?: unknown };
    if (
      maybeWrapper.result &&
      typeof maybeWrapper.result === "object"
    ) {
      resultObj = maybeWrapper.result as ResultShape;
    } else {
      resultObj = parsed as ResultShape;
    }
  }

  const errorField = resultObj?.error;
  const errorIsExplicitFailure =
    errorField !== undefined &&
    errorField !== null &&
    errorField !== false &&
    String(errorField) !== "0" &&
    String(errorField) !== "";
  const errorIsExplicitSuccess =
    errorField !== undefined &&
    (errorField === false ||
      errorField === 0 ||
      String(errorField) === "0");

  const messageId =
    resultObj?.message_id != null
      ? String(resultObj.message_id)
      : resultObj?.id != null
        ? String(resultObj.id)
        : null;

  // Strict success: HTTP 2xx AND (explicit success flag OR a provider
  // message id). Anything else — empty body, HTML error page, unrecognized
  // shape, malformed JSON — counts as a failure so we don't silently log
  // undelivered messages as "sent" in the timeline.
  const looksLikeSuccess =
    res.ok && (errorIsExplicitSuccess || messageId !== null);

  if (!looksLikeSuccess || errorIsExplicitFailure) {
    const errMsg =
      resultObj?.message ??
      (rawText && rawText.length < 500 ? rawText : null) ??
      `unrecognized response (HTTP ${res.status})`;
    logger.error(
      {
        status: res.status,
        to: params.to,
        leadId: params.leadId,
        repId: params.repId,
        errMsg,
        hasMessageId: messageId !== null,
      },
      "sms-mobile-api send rejected",
    );
    return { ok: false, messageId, error: errMsg };
  }

  return { ok: true, messageId, error: null };
};
