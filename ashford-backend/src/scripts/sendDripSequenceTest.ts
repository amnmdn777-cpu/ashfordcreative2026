import { sendEmail } from "../integrations/resend";
import {
  buildPreviewScreenshotUrl,
  captureTemplateScreenshot,
} from "../services/templateScreenshot";
import { renderDripEmail, type DripTouch } from "../services/dripEmailRenderer";
import { env } from "../lib/env";

/**
 * Sends all 5 drip touches (D+1, D+3, D+7, D+14, D+30) back-to-back to a
 * single recipient so the design can be reviewed end-to-end inside one
 * inbox. Each send is spaced ~1.5s apart to keep timestamps distinguishable
 * and avoid hitting Resend's burst rate-limit.
 *
 * Usage:
 *   pnpm --filter @workspace/api-server tsx \
 *     src/scripts/sendDripSequenceTest.ts [recipient@example.com] [template_slug]
 */

const TOUCHES: readonly DripTouch[] = ["day1", "day3", "day7", "day14", "day30"];

const positional = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const recipient = positional[0] ?? "amnmdn777@gmail.com";
const slug = positional[1] ?? "garden";
const previewUrl = `${env.publicBaseUrl}/template/${slug}`;
const heroImageUrl = buildPreviewScreenshotUrl(slug);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function main() {
  console.log(`[seq] sending all 5 drip touches to ${recipient}`);
  console.log(`[seq] CTA url: ${previewUrl}`);

  // Warm the screenshot cache once so subsequent touches reuse the same hero.
  let heroAvailable = false;
  try {
    const { cached, buffer } = await captureTemplateScreenshot(slug);
    console.log(
      `[seq] screenshot ${cached ? "cache HIT" : "captured"}: ${buffer.length} bytes`,
    );
    heroAvailable = true;
  } catch (err) {
    console.warn(`[seq] screenshot failed (will use brand fallback):`, err);
  }

  let failed = 0;
  for (let i = 0; i < TOUCHES.length; i++) {
    const touch = TOUCHES[i];
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
    console.log(
      `[seq] ${touch.padEnd(5)} → ${result.status} (id ${result.id}, resend ${result.resendId ?? "—"})`,
    );
    if (result.status === "failed") failed++;

    if (i < TOUCHES.length - 1) await sleep(1500);
  }

  console.log(`[seq] done — ${TOUCHES.length - failed}/${TOUCHES.length} succeeded`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[seq] crashed:", err);
  process.exit(2);
});
