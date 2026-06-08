import express, { Router, type IRouter } from "express";
import { logger } from "../../lib/logger";
import { env, isProd } from "../../lib/env";
import {
  isDialpadConfigured,
  isDialpadWebhookConfigured,
  verifyWebhookJwt,
} from "../../integrations/dialpad";
import {
  upsertCallFromDialpad,
  ingestDialpadSummary,
  ingestDialpadTranscript,
} from "../../services/dialpadCallSync";

/**
 * DialPad webhook receiver.
 *
 * DialPad signs the entire request body as a compact JWT (HS256). We mount
 * with `express.text()` (NOT `express.json()`) so the raw token survives
 * to `verifyWebhookJwt`, which re-decodes after a constant-time HMAC check.
 *
 * One endpoint handles all event types (call.*, transcript.*, summary.*) —
 * branching by `event_type` inside the handler. This matches DialPad's
 * single-hook architecture and means operators register one URL.
 *
 * The endpoint is mounted BEFORE express.json in app.ts (same pattern as
 * Stripe + Resend) so the body parser doesn't consume the JWT.
 */

const router: IRouter = Router();

// Always 200 promptly so DialPad doesn't retry on slow ingestion.
// Retries on 5xx are fine in theory, but the upstream-side cooldown is
// minutes long and we want transcript/summary events to flow continuously.
const ack = (res: express.Response): void => {
  res.status(200).type("text/plain").send("ok");
};

const dialpadJsonAck = (res: express.Response, status = 200): void => {
  res.status(status).json({ ok: status === 200 });
};

router.post(
  "/webhooks/dialpad",
  express.text({ type: "*/*", limit: "1mb" }),
  async (req, res) => {
    // 503 (vs 200) when not configured so DialPad's webhook test in their
    // admin UI surfaces the misconfiguration instead of looking healthy.
    if (!isDialpadConfigured() || !isDialpadWebhookConfigured()) {
      if (isProd) {
        logger.error("dialpad webhook hit but integration not configured");
      }
      dialpadJsonAck(res, 503);
      return;
    }

    const raw = typeof req.body === "string" ? req.body : "";
    if (!raw) {
      dialpadJsonAck(res, 400);
      return;
    }

    const payload = verifyWebhookJwt(raw, env.dialpadWebhookSecret!);
    if (!payload) {
      logger.warn(
        { len: raw.length },
        "dialpad: webhook signature/format invalid",
      );
      res.status(401).type("text/plain").send("invalid signature");
      return;
    }

    // Best-effort event extraction. DialPad keys vary slightly across
    // event subscriptions (call vs transcript vs summary). We accept
    // any of the known shapes and pull the call id + event type.
    const eventType =
      pickString(payload, ["event_type", "type", "name"]) ?? "unknown";
    const callId =
      pickString(payload, ["call_id", "id"]) ??
      pickStringFromNested(payload, "call", ["id", "call_id"]) ??
      pickStringFromNested(payload, "data", ["call_id", "id"]);

    logger.info({ eventType, callId }, "dialpad: webhook received");

    // ACK immediately, then process out-of-band so a slow API fetch can't
    // block the next webhook delivery.
    ack(res);

    if (!callId) return;

    void (async () => {
      try {
        // Lower-cased contains for forward-compat with new event names.
        const t = eventType.toLowerCase();
        if (t.includes("transcript")) {
          await ingestDialpadTranscript(callId);
        } else if (t.includes("summary") || t.includes("recap")) {
          await ingestDialpadSummary(callId);
        } else {
          // Default: any call.* event refreshes the call row from the API.
          await upsertCallFromDialpad(callId);
        }
      } catch (err) {
        logger.error(
          { err, eventType, callId },
          "dialpad: webhook handler failed (after ACK)",
        );
      }
    })();
  },
);

// Helper: shallow string pick.
function pickString(
  obj: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

// Helper: pick a string from a nested object (e.g. payload.call.id).
function pickStringFromNested(
  obj: Record<string, unknown>,
  parent: string,
  keys: string[],
): string | null {
  const inner = obj[parent];
  if (!inner || typeof inner !== "object") return null;
  return pickString(inner as Record<string, unknown>, keys);
}

export default router;
