import { sendEmail } from "../integrations/resend";
import {
  buildPreviewScreenshotUrl,
  captureTemplateScreenshot,
} from "../services/templateScreenshot";
import { renderDripEmail, type DripTouch } from "../services/dripEmailRenderer";
import { env } from "../lib/env";

/**
 * Test-send a single email to a real inbox.
 *
 * Usage:
 *   pnpm --filter @workspace/api-server tsx src/scripts/sendTestPreviewEmail.ts \
 *     [recipient@example.com] [template_slug] [--touch=day1|day3|day7|day14|day30]
 *
 * Examples:
 *   # Day 1 (default — backwards compatible with the original script)
 *   tsx ... sendTestPreviewEmail.ts amnmdn777@gmail.com atrium
 *
 *   # Day 14 before/after touch
 *   tsx ... sendTestPreviewEmail.ts amnmdn777@gmail.com atrium --touch=day14
 */

const VALID_TOUCHES: ReadonlySet<DripTouch> = new Set([
  "day1",
  "day3",
  "day7",
  "day14",
  "day30",
]);

const positional = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));

const recipient = positional[0] ?? "amnmdn777@gmail.com";
const slug = positional[1] ?? "garden";
const touchFlag = flags
  .find((f) => f.startsWith("--touch="))
  ?.split("=")[1] as DripTouch | undefined;
const touch: DripTouch =
  touchFlag && VALID_TOUCHES.has(touchFlag) ? touchFlag : "day1";

const previewUrl = `${env.publicBaseUrl}/template/${slug}`;
const heroImageUrl = buildPreviewScreenshotUrl(slug);

async function main() {
  console.log(`[test] sending ${touch} preview email to ${recipient}`);
  console.log(`[test] CTA url: ${previewUrl}`);
  console.log(`[test] hero img: ${heroImageUrl}`);

  // Warm the cache so the very first email open isn't gated on a cold
  // Chromium launch. We track whether capture succeeded so we don't ship
  // a broken-image <img> to the recipient when the screenshot pipeline
  // fails — the fallback path inside the renderer kicks in instead.
  let heroAvailable = false;
  try {
    const { cached, buffer } = await captureTemplateScreenshot(slug);
    console.log(
      `[test] screenshot ${cached ? "cache HIT" : "captured"}: ${buffer.length} bytes`,
    );
    heroAvailable = true;
  } catch (err) {
    console.warn(`[test] screenshot failed (using brand fallback hero):`, err);
  }

  const rendered = renderDripEmail({
    touch,
    leadFirstName: "Marisol",
    practice: "Crescent Wellness",
    repFirstName: "Sofía",
    repFullName: "Sofía Reyes",
    locale: "en",
    ctaUrl: previewUrl,
    heroImageUrl: heroAvailable ? heroImageUrl : undefined,
  });

  const result = await sendEmail({
    to: recipient,
    subject: rendered.subject,
    body: rendered.textBody,
    htmlOverride: rendered.htmlBody,
    fromRepDisplayName: "Sofía Reyes",
    locale: "en",
  });
  console.log(`[test] subject: ${rendered.subject}`);
  console.log(`[test] result:`, result);
  process.exit(result.status === "failed" ? 1 : 0);
}

main().catch((err) => {
  console.error("[test] crashed:", err);
  process.exit(2);
});
