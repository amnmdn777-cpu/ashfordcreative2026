/**
 * scripts/launchAudit.ts — deterministic launch-day audit (task #181).
 *
 * Re-runnable companion to docs/launch-audit-2026-04-27.md. Walks every
 * check that does NOT require a real human (Stripe charge, Resend
 * inbox delivery, Dialpad PSTN round-trip) and prints a structured
 * pass/fail table. Exit code is non-zero iff any deterministic check
 * fails so this can be wired into CI later.
 *
 * Run:
 *   pnpm --filter @workspace/api-server exec tsx src/scripts/launchAudit.ts
 */

import { db, leads, salesReps } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { env } from "../lib/env";
import { isDialpadVoiceConfigured, isDialpadSmsConfigured } from "../integrations/dialpad";
import { isSmsMobileApiConfigured } from "../integrations/smsMobileApi";
import { isTextbeltLiveKey } from "../integrations/textbelt";

type Result = "PASS" | "FAIL" | "NEEDS_USER";
interface Row {
  id: string;
  name: string;
  result: Result;
  detail: string;
}

const rows: Row[] = [];
function add(id: string, name: string, result: Result, detail: string) {
  rows.push({ id, name, result, detail });
}

async function main() {
  add(
    "stripe-keys",
    "Stripe live secret + webhook secret present",
    env.stripeSecretKey && env.stripeWebhookSecret ? "PASS" : "NEEDS_USER",
    `STRIPE_SECRET_KEY=${env.stripeSecretKey ? "set" : "missing"}, STRIPE_WEBHOOK_SECRET=${
      env.stripeWebhookSecret ? "set" : "missing"
    }`,
  );
  add(
    "stripe-prefix",
    "STRIPE_SECRET_KEY uses sk_live_ prefix",
    env.stripeSecretKey?.startsWith("sk_live_") ? "PASS" : "NEEDS_USER",
    "Live charge end-to-end requires manual run with a real card.",
  );
  add(
    "resend",
    "Resend API key configured",
    env.resendApiKey ? "PASS" : "NEEDS_USER",
    `RESEND_API_KEY=${env.resendApiKey ? "set" : "missing"}; SPF/DKIM/DMARC verification is dashboard-only.`,
  );
  // Outbound SMS: TextBelt is the primary path as of 2026-04-29 (replaced
  // SMS Mobile API the same day — that one required a phone-app open).
  // SMS Mobile API + DialPad SMS remain as dormant fallbacks.
  add(
    "textbelt",
    "TextBelt (outbound + inbound replies) configured with paid key",
    isTextbeltLiveKey() ? "PASS" : "NEEDS_USER",
    "TEXTBELT_API_KEY — paid key required for two-way SMS. Without it, sends fall back to the free 'textbelt' key (1/IP/day, no replies).",
  );
  add(
    "sms-mobile-api-fallback",
    "SMS Mobile API fallback (informational)",
    isSmsMobileApiConfigured() ? "PASS" : "NEEDS_USER",
    "SMS_MOBILE_API_TOKEN — dormant fallback only. Primary path is TextBelt.",
  );
  add(
    "dialpad-sms-fallback",
    "DialPad SMS fallback (informational)",
    isDialpadSmsConfigured() ? "PASS" : "NEEDS_USER",
    "DialPad SMS sending is dormant when TextBelt is configured. Inbound DialPad SMS webhook still active.",
  );
  add(
    "dialpad-voice",
    "Dialpad voice configured",
    isDialpadVoiceConfigured() ? "PASS" : "FAIL",
    "DIALPAD_API_KEY + DIALPAD_USER_ID + DIALPAD_FROM_NUMBER",
  );

  const expectedLeads = [
    "sarah.chen+demo@ashfordcreative.org",
    "james.miller+demo@ashfordcreative.org",
    "elena.rodriguez+demo@ashfordcreative.org",
  ];
  const seededLeads = await db
    .select({ email: leads.email, status: leads.status })
    .from(leads)
    .where(inArray(leads.email, expectedLeads));
  const allAvailable =
    seededLeads.length === 3 && seededLeads.every((l) => l.status === "available");
  add(
    "test-leads",
    "Three test leads seeded with status='available'",
    allAvailable ? "PASS" : "FAIL",
    `found=${seededLeads.length}/3, statuses=${seededLeads.map((l) => l.status).join(",")}`,
  );

  const reps = await db
    .select({ username: salesReps.username, role: salesReps.role, isActive: salesReps.isActive })
    .from(salesReps)
    .where(
      and(inArray(salesReps.username, ["candice", "veronica"]), eq(salesReps.role, "rep")),
    );
  add(
    "training-reps",
    "Two training reps seeded with role='rep' and active",
    reps.length === 2 && reps.every((r) => r.isActive) ? "PASS" : "FAIL",
    `found=${reps.map((r) => r.username).join(",")}`,
  );

  const colW = [4, 24, 12, 60];
  const fmt = (s: string, w: number) => s.padEnd(w).slice(0, w);
  console.log(
    fmt("#", colW[0]) + fmt("check", colW[1]) + fmt("result", colW[2]) + "detail",
  );
  console.log("-".repeat(colW.reduce((a, b) => a + b, 0)));
  rows.forEach((r, i) => {
    console.log(
      fmt(String(i + 1), colW[0]) +
        fmt(r.name, colW[1]) +
        fmt(r.result, colW[2]) +
        r.detail,
    );
  });

  const failed = rows.filter((r) => r.result === "FAIL");
  const needsUser = rows.filter((r) => r.result === "NEEDS_USER");
  const passed = rows.filter((r) => r.result === "PASS");
  console.log(
    `\nsummary: PASS=${passed.length}  NEEDS_USER=${needsUser.length}  FAIL=${failed.length}`,
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
