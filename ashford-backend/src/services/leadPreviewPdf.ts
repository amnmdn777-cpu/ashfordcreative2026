import { db, leads as leadsTbl } from "@workspace/db";
import { eq } from "drizzle-orm";
import { PALETTES, type PaletteDef } from "@workspace/api-zod";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { ensurePortalForLead } from "./portals";
import { getSharedPuppeteerBrowser } from "./templateScreenshot";

/**
 * Generates a single PDF that bundles a 1-page brochure cover (prospect
 * name + key selling points + checkout link) with a full-page capture of
 * the live prospect portal. Designed to be email-friendly: A4 portrait,
 * embedded fonts via system fallbacks, link annotations preserved, target
 * file size under 2 MB for typical previews so it survives Gmail's
 * 25 MB attachment cap with room to spare.
 *
 * The rep dashboard exposes this behind a "Télécharger PDF" button next
 * to "Voir preview" so the rep can drop the file straight into an email
 * to the practitioner without sending them a tracked link.
 */

const safe = (raw: string | null | undefined, fallback = ""): string => {
  const value = (raw ?? fallback).toString();
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const paletteFor = (templateKey: string | null | undefined): PaletteDef => {
  const fallback = PALETTES["garden_sage"]!;
  if (!templateKey) return fallback;
  // PALETTES is keyed by palette name, not template key — find by templateKey
  const match = Object.values(PALETTES).find(
    (p) => p.templateKey === templateKey,
  );
  return match ?? fallback;
};

const firstName = (full: string): string =>
  full
    .replace(/^(?:dr|mr|mrs|ms|mx|prof)\.?\s+/i, "")
    .trim()
    .split(/\s+/)[0] ?? full;

/**
 * Some leads were imported with a directory profile URL in the `practice`
 * column instead of the actual practice name (e.g. the Grow Therapy import
 * pipeline stored the profile link before the name was resolved).
 * Detect any http(s) URL and fall back to a human-readable label so the
 * brochure cover never renders a raw URL as the headline.
 */
const sanitizePractice = (practice: string, fallbackName: string): string => {
  const trimmed = practice.trim();
  // Detect bare URLs (with or without protocol) and profile-link patterns.
  if (
    /^https?:\/\//i.test(trimmed) ||
    /^www\./i.test(trimmed) ||
    /growtherapy\.com|psychologytoday\.com|therapyden\.com|headway\.co|zocdoc\.com/i.test(trimmed)
  ) {
    // Build a friendly fallback: "[First] [Last]'s Practice"
    const fn = firstName(fallbackName);
    const parts = fallbackName
      .replace(/^(?:dr|mr|mrs|ms|mx|prof)\.?\s+/i, "")
      .trim()
      .split(/\s+/);
    const last = parts.length > 1 ? ` ${parts[parts.length - 1]}` : "";
    return `${fn}${last}'s Practice`;
  }
  return trimmed || fallbackName;
};

const buildBrochureHtml = (input: {
  practice: string;
  name: string;
  specialty: string;
  city: string;
  state: string;
  palette: PaletteDef;
  previewUrl: string;
  repName: string;
  locale: string;
}): string => {
  const { palette } = input;
  const ES = input.locale === "es";
  const greetingFr = ES
    ? `Hola ${safe(firstName(input.name))} —`
    : `Hi ${safe(firstName(input.name))} —`;
  const promise = ES
    ? "Una vista previa de tu sitio web profesional, hecho a medida."
    : "A first look at your new website, built around your practice.";
  const points = ES
    ? [
        "Sitio web profesional, listo en 48 horas",
        "Bilingüe Español + Inglés — el mismo día",
        "Formulario de contacto + reservas en línea",
        "Soporte continuo — no necesitas saber tecnología",
      ]
    : [
        "Professional website live within 48 hours",
        "Bilingual Spanish + English — same day",
        "Contact form + online booking baked in",
        "We keep it running — nothing technical for you",
      ];
  const ctaLabel = ES ? "Ver tu sitio completo" : "View your full preview";
  const planLabel = ES
    ? "Plan mensual a partir de $199/mes, todo incluido"
    : "Monthly plan from $199/mo, all-in";
  const fromRep = ES
    ? `Preparado por ${safe(input.repName)}`
    : `Prepared by ${safe(input.repName)}`;
  const eyebrow = ES ? "Vista previa del sitio" : "Website preview";
  // A soft tint of the accent for the bullet "chips" — falls back to a
  // translucent accent when the palette doesn't define a soft surface.
  const chipBg = palette.surfaceSoft ?? `${palette.accent}14`;

  // QA Bug #6 (2026-06-22): redesigned cover — a calmer, more premium
  // layout. An accent rule frames the page, the practice name leads as a
  // large serif headline, the selling points sit in tidy tinted chips, and
  // a single confident CTA closes the page. Pure inline styles + system
  // fonts so it renders identically through Puppeteer's print pipeline.
  return `
<section id="ashford-brochure-cover" data-pdf-cover style="
  break-after: page;
  page-break-after: always;
  background: ${palette.surface};
  color: ${palette.ink};
  width: 100%;
  min-height: 100vh;
  box-sizing: border-box;
  font-family: 'Georgia', 'Times New Roman', serif;
  display: flex;
  flex-direction: column;
  border-top: 6px solid ${palette.accent};
">
  <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; padding: 64px 64px 56px;">
    <header style="display: flex; justify-content: space-between; align-items: flex-start; gap: 24px;">
      <div>
        <div style="font-size: 12px; letter-spacing: 4px; text-transform: uppercase; color: ${palette.primary}; font-weight: 700; font-family: 'Helvetica','Arial',sans-serif; margin-bottom: 8px;">
          Ashford&nbsp;Creative
        </div>
        <div style="font-size: 13px; letter-spacing: 1px; text-transform: uppercase; color: ${palette.muted}; font-family: 'Helvetica','Arial',sans-serif;">
          ${eyebrow}
        </div>
      </div>
      <div style="font-size: 12px; color: ${palette.muted}; text-align: right; max-width: 220px; font-family: 'Helvetica','Arial',sans-serif; line-height: 1.5;">
        ${fromRep}<br/>
        ${safe(input.specialty)} · ${safe(input.city)}, ${safe(input.state)}
      </div>
    </header>

    <div style="margin: 40px 0;">
      <div style="font-size: 16px; color: ${palette.muted}; margin-bottom: 14px;">
        ${greetingFr}
      </div>
      <h1 style="font-size: 52px; line-height: 1.08; margin: 0; color: ${palette.primary}; font-weight: 400; letter-spacing: -0.5px;">
        ${safe(input.practice)}
      </h1>
      <div style="width: 64px; height: 3px; background: ${palette.accent}; margin: 24px 0;"></div>
      <p style="font-size: 21px; line-height: 1.5; color: ${palette.ink}; margin: 0; max-width: 560px;">
        ${promise}
      </p>
    </div>

    <ul style="list-style: none; padding: 0; margin: 0 0 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
      ${points
        .map(
          (p) => `
        <li style="display: flex; gap: 12px; align-items: center; font-size: 14.5px; color: ${palette.ink}; background: ${chipBg}; border: 1px solid ${palette.muted}1f; border-radius: 12px; padding: 14px 16px; font-family: 'Helvetica','Arial',sans-serif;">
          <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: ${palette.accent}; color: ${palette.surface}; font-size: 13px; flex-shrink: 0;">&#10003;</span>
          <span>${safe(p)}</span>
        </li>
      `,
        )
        .join("")}
    </ul>

    <footer style="border-top: 1px solid ${palette.muted}33; padding-top: 24px; display: flex; justify-content: space-between; align-items: center; gap: 16px;">
      <div>
        <div style="font-size: 13px; color: ${palette.muted}; margin-bottom: 10px; font-family: 'Helvetica','Arial',sans-serif;">
          ${planLabel}
        </div>
        <a href="${safe(input.previewUrl)}" style="
          display: inline-block;
          background: ${palette.primary};
          color: ${palette.surface};
          padding: 14px 26px;
          border-radius: 999px;
          font-size: 15px;
          font-family: 'Helvetica', 'Arial', sans-serif;
          font-weight: 600;
          text-decoration: none;
          letter-spacing: 0.3px;
        ">
          ${ctaLabel} &rarr;
        </a>
      </div>
      <div style="font-size: 12px; color: ${palette.muted}; text-align: right; font-family: 'Helvetica','Arial',sans-serif; letter-spacing: 0.5px;">
        ashfordhealthcreative.com
      </div>
    </footer>
  </div>
</section>
`;
};

/**
 * Renders the prospect's portal page to a single A4 PDF with a brochure
 * cover prepended. Returns the PDF buffer + a filename-safe slug derived
 * from the practice name.
 */
export const renderLeadPreviewPdf = async (
  leadId: number,
): Promise<{ pdf: Buffer; filename: string }> => {
  const [lead] = await db
    .select()
    .from(leadsTbl)
    .where(eq(leadsTbl.id, leadId))
    .limit(1);
  if (!lead) throw new Error(`Lead ${leadId} not found`);

  const portal = await ensurePortalForLead(leadId);
  const previewUrl = `${env.siteBaseUrl}/preview/${encodeURIComponent(
    portal.slug,
  )}?t=${encodeURIComponent(portal.accessToken)}&internal=1&pdf=1`;

  const palette = paletteFor(portal.selectedTemplate);

  // Sanitize the practice name — some leads were imported with a directory
  // profile URL in this column. Strip it and fall back to a human name.
  const practiceName = sanitizePractice(lead.practice, lead.name);

  const brochureHtml = buildBrochureHtml({
    practice: practiceName,
    name: lead.name,
    specialty: lead.specialty,
    city: lead.city,
    state: lead.state,
    palette,
    previewUrl: `${env.publicBaseUrl}/preview/${encodeURIComponent(portal.slug)}?t=${encodeURIComponent(portal.accessToken)}`,
    repName: "Your Ashford Creative rep",
    locale: lead.locale,
  });

  const browser = await getSharedPuppeteerBrowser();
  const page = await browser.newPage();
  try {
    // A4 portrait at 96 DPI: 794 × 1123. Use 1024 width so site's
    // mobile/tablet breakpoints behave nicely once rendered into A4.
    await page.setViewport({ width: 1024, height: 1400, deviceScaleFactor: 1 });
    // Force reduced-motion so the templates' framer-motion `whileInView`
    // scroll-in animations resolve to their visible state up front —
    // otherwise below-the-fold sections render at opacity:0 (occupying
    // height but invisible) in a non-scrolling headless capture.
    await page.emulateMediaFeatures([
      { name: "prefers-reduced-motion", value: "reduce" },
    ]);
    await page.goto(previewUrl, {
      waitUntil: "networkidle2",
      timeout: 40_000,
    });
    // Wait for the React SPA to finish hydrating. `networkidle2` only means
    // HTTP traffic has settled — the JS bundle may still be mounting components.
    // We wait for a real portal section element before proceeding; if it never
    // appears (e.g. an error page) we fall back after 10 s so we don't hang.
    await Promise.race([
      page
        .waitForSelector(
          "[data-section], section, main, #root > div, .portal-root",
          { timeout: 10_000 },
        )
        .catch(() => undefined), // ignore timeout — snapshot whatever is there
      new Promise((r) => setTimeout(r, 10_000)),
    ]);
    // Extra settle for fonts, lazy images, and CSS transitions. The Clarity
    // template lazy-loads section imagery; too short a wait captured a
    // half-rendered (blank) body — give it a beat longer.
    await new Promise((r) => setTimeout(r, 2500));

    // Inject the brochure as the very first element of <body>, hide
    // any rep-only overlays (`?internal=1` flips a global flag in the
    // SPA) and any floating chat/CTA bubbles, and force `print` media
    // styles so prose flows cleanly across PDF pages.
    await page.evaluate((html: string) => {
      // Hide preview/rep toolbars and floating action bubbles.
      const hideSelectors = [
        "[data-portal-toolbar]",
        "[data-preview-controls]",
        "[data-rep-overlay]",
        "[data-floating-cta]",
        ".chatbot-launcher",
        ".CrisisFloatingButton",
        "[aria-label='Help']",
      ];
      const style = document.createElement("style");
      style.textContent = `
        ${hideSelectors.join(",")} { display: none !important; }
        html, body { background: #ffffff !important; }
        /* P1-10: the portal SPA mounts inside fixed-height / overflow:auto
           scroll containers. In print those clip to a single empty viewport,
           which is why the exported PDF was just the cover + one blank page.
           Neutralise the height/overflow constraints on every wrapper so the
           full site flows across PDF pages. */
        html, body, #root, #root > div, #root > div > div, [data-portal-root], .portal-root {
          height: auto !important;
          max-height: none !important;
          min-height: 0 !important;
          overflow: visible !important;
        }
        /* page break behaviour */
        section, .section, [data-section] {
          break-inside: avoid-page;
          page-break-inside: avoid;
        }
        a { color: inherit; }
        @page { size: A4; margin: 0; }
      `;
      document.head.appendChild(style);

      const wrap = document.createElement("div");
      wrap.innerHTML = html;
      const cover = wrap.firstElementChild;
      if (cover && document.body) {
        document.body.insertBefore(cover, document.body.firstChild);
      }
    }, brochureHtml);

    // Wait one more tick so the injected DOM and fonts settle before
    // the PDF is taken.
    await new Promise((r) => setTimeout(r, 400));

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    // Use the sanitized practice name so the filename is never a URL slug.
    const slug = `${practiceName}-${lead.name}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64);
    const filename = `ashford-${slug || `lead-${leadId}`}.pdf`;

    logger.info(
      { leadId, slug: portal.slug, bytes: pdf.length },
      "lead preview pdf generated",
    );
    return { pdf: Buffer.from(pdf), filename };
  } finally {
    await page.close().catch(() => undefined);
  }
};
