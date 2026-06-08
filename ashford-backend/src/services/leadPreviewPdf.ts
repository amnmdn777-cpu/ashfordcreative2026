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
    ? "Plan mensual a partir de $149/mes"
    : "Monthly plan from $149/mo";
  const fromRep = ES
    ? `Preparado por ${safe(input.repName)} — Ashford Creative`
    : `Prepared by ${safe(input.repName)} — Ashford Creative`;

  return `
<section id="ashford-brochure-cover" data-pdf-cover style="
  break-after: page;
  page-break-after: always;
  background: ${palette.surface};
  color: ${palette.ink};
  width: 100%;
  min-height: 100vh;
  padding: 56px 56px 48px;
  box-sizing: border-box;
  font-family: 'Georgia', 'Times New Roman', serif;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
">
  <header style="display: flex; justify-content: space-between; align-items: flex-start; gap: 24px;">
    <div>
      <div style="font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: ${palette.muted}; margin-bottom: 6px;">
        Ashford Creative
      </div>
      <div style="font-size: 13px; color: ${palette.muted};">
        ${safe(input.specialty)} · ${safe(input.city)}, ${safe(input.state)}
      </div>
    </div>
    <div style="font-size: 11px; color: ${palette.muted}; text-align: right; max-width: 220px;">
      ${fromRep}
    </div>
  </header>

  <div style="margin: 32px 0;">
    <div style="font-size: 14px; color: ${palette.muted}; margin-bottom: 12px;">
      ${greetingFr}
    </div>
    <h1 style="font-size: 44px; line-height: 1.12; margin: 0 0 8px; color: ${palette.primary}; font-weight: 400;">
      ${safe(input.practice)}
    </h1>
    <p style="font-size: 19px; line-height: 1.5; color: ${palette.ink}; margin: 18px 0 0; max-width: 540px;">
      ${promise}
    </p>
  </div>

  <ul style="list-style: none; padding: 0; margin: 0 0 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px 28px;">
    ${points
      .map(
        (p) => `
      <li style="display: flex; gap: 10px; align-items: flex-start; font-size: 14px; color: ${palette.ink};">
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${palette.accent}; margin-top: 7px; flex-shrink: 0;"></span>
        <span>${safe(p)}</span>
      </li>
    `,
      )
      .join("")}
  </ul>

  <footer style="border-top: 1px solid ${palette.muted}33; padding-top: 20px; display: flex; justify-content: space-between; align-items: center; gap: 16px;">
    <div>
      <div style="font-size: 13px; color: ${palette.muted}; margin-bottom: 4px;">
        ${planLabel}
      </div>
      <a href="${safe(input.previewUrl)}" style="
        display: inline-block;
        background: ${palette.primary};
        color: ${palette.surface};
        padding: 12px 22px;
        border-radius: 999px;
        font-size: 14px;
        font-family: 'Helvetica', 'Arial', sans-serif;
        font-weight: 600;
        text-decoration: none;
        letter-spacing: 0.3px;
      ">
        ${ctaLabel} →
      </a>
    </div>
    <div style="font-size: 11px; color: ${palette.muted}; text-align: right;">
      ashfordcreative.org
    </div>
  </footer>
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

  const brochureHtml = buildBrochureHtml({
    practice: lead.practice,
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
    await page.goto(previewUrl, {
      waitUntil: "networkidle2",
      timeout: 35_000,
    });
    // Settle for any client-side animations / fonts.
    await new Promise((r) => setTimeout(r, 1200));

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

    const slug = `${lead.practice}-${lead.name}`
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
