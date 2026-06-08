/**
 * One-shot DialPad webhook registration.
 *
 * Run after setting DIALPAD_API_KEY + DIALPAD_WEBHOOK_SECRET in your env:
 *
 *   pnpm --filter @workspace/api-server exec tsx scripts/registerDialpadWebhooks.ts
 *
 * What it does:
 *   1. Resolves the public webhook URL (PUBLIC_BASE_URL or REPLIT_DEV_DOMAIN).
 *   2. Creates (or reuses) a DialPad webhook destination at /api/webhooks/dialpad
 *      with our HS256 secret.
 *   3. Subscribes that webhook to call.* events (ringing, ended, etc.).
 *   4. Subscribes to Vi transcript events when the AI add-on is on
 *      (soft-fails with a warning otherwise).
 *
 * Idempotent — safe to re-run after any URL change. DialPad's webhook
 * upsert keys on `hook_url` so you'll get the same id back.
 */

import {
  isDialpadConfigured,
  isDialpadWebhookConfigured,
  upsertWebhook,
  subscribeCallEvents,
  subscribeVoiceIntelligence,
} from "../src/integrations/dialpad";
import { env } from "../src/lib/env";

async function main(): Promise<void> {
  if (!isDialpadConfigured()) {
    console.error(
      "DIALPAD_API_KEY is not set. Add it to your environment and re-run.",
    );
    process.exit(1);
  }
  if (!isDialpadWebhookConfigured()) {
    console.error(
      "DIALPAD_WEBHOOK_SECRET is not set. Generate any random ≥32-char string,",
      "add it to your environment, and re-run.",
    );
    process.exit(1);
  }

  const base = env.publicBaseUrl.replace(/\/$/, "");
  if (base.startsWith("http://localhost")) {
    console.error(
      `Refusing to register a localhost webhook URL (${base}). DialPad must reach us`,
      "from the public internet — set PUBLIC_BASE_URL to your deploy URL or use",
      "your Replit dev domain.",
    );
    process.exit(1);
  }
  const hookUrl = `${base}/api/webhooks/dialpad`;
  console.log(`Registering DialPad webhook → ${hookUrl}`);

  const webhook = await upsertWebhook(hookUrl, env.dialpadWebhookSecret!);
  console.log(`  webhook id: ${webhook.id}`);

  console.log("Subscribing to call.* events…");
  await subscribeCallEvents(webhook.id);
  console.log("  ✓ call events subscribed");

  console.log("Subscribing to Vi transcript events (requires AI add-on)…");
  const viResult = await subscribeVoiceIntelligence(webhook.id);
  if (viResult === null) {
    console.log(
      "  ⚠ Vi subscription rejected — workspace may not have the AI add-on.",
      "  Calls will still be auto-logged; only transcripts/summaries are skipped.",
    );
  } else {
    console.log("  ✓ Vi events subscribed");
  }

  console.log("Done. Place a test call from your DialPad line — it should");
  console.log(
    "appear on the matching lead's timeline within a few seconds, with the",
  );
  console.log(
    "transcript + summary populating once Vi finishes processing (~1–3 min).",
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
