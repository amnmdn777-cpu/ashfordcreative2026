import { env } from "../lib/env";
import type { EmailLocale } from "./emailLayout";

/**
 * Dedicated HTML renderer for the rep-sent "send payment link" email.
 *
 * Why this lives outside `wrapHtmlEmail`:
 *   - The generic envelope is shared by digests, alerts and customer
 *     transactional mail; bending it to host a hero-with-overlay screenshot
 *     and a price-led ledger card would bloat it past the point of useful
 *     reuse.
 *   - The 2026-04-28 redesign (canvas mockup "Preview-Led B") is intended to
 *     replace a checkout email whose only failure mode was rendering the
 *     long Stripe URL inline as a wall of unbreakable text in Gmail. The
 *     fix here is twofold: (1) never embed the raw URL in the HTML body —
 *     the CTA href carries it; the plain-text body still has it as a
 *     fallback; and (2) lead with the prospect's actual draft screenshot so
 *     the email reads like a milestone rather than a transactional receipt.
 *
 * Compatibility notes:
 *   - Layout is table-based with inline styles. Outlook desktop loses
 *     `border-radius` and the headline-over-image overlay (it can't honour
 *     CSS `position:absolute` inside a table cell), so we degrade Outlook
 *     to a flat dark band that renders the headline below the image
 *     instead of on top — same words, less drama, never broken.
 *   - The hero `<img>` is fetched directly by the recipient's mail client
 *     from `/api/portal-screenshot/:slug.png?t=...`. We do NOT inline the
 *     bytes — Resend has a 40MB limit per send and the screenshot helper
 *     handles caching + token-gated access already.
 *   - When no hero URL is provided (capture failed, or this lead has no
 *     portal yet), the entire hero block is replaced by a clean cream brand
 *     header so the layout never ships a broken-image icon.
 */

export type CheckoutEmailContext = {
  /** Lead first name. Renders in the greeting paragraph and salutation. */
  leadFirstName: string;
  /** Practice name. Renders inside the editorial headline. */
  practice: string;
  /**
   * Tier label rendered as the ledger eyebrow ("BOUTIQUE", "BOUTIQUE PRO").
   * Free-form so legacy rep-quoted flows can pass "PLAN A" / "PLAN B" while
   * the new self-serve tier flow passes TIERS[tierKey].label.
   */
  tierLabel: string;
  /** Total monthly price in cents (already including any add-ons). */
  monthlyPriceCents: number;
  /** One-time setup fee in cents (0 → "no setup fee" badge). */
  setupCents: number;
  /** Localized add-on labels surfaced inside the ledger's "Includes …" row. */
  addonLabels: string[];
  /** Locale switches headline, greeting, CTA, trust line and footer copy. */
  locale: EmailLocale;
  /** Stripe Checkout URL — wired to the CTA button's `href` only. */
  ctaUrl: string;
  /** Rep first name — drives the avatar monogram and signature. */
  repFirstName: string;
  /**
   * Optional public HTTPS URL of the lead's portal screenshot. When omitted
   * (capture pending / failed) the hero block is suppressed and a clean
   * brand header is rendered in its place.
   */
  heroImageUrl?: string;
  /**
   * Batch 4.c (Phase B proposal copy): optional list of "what's new" feature
   * highlights to render above the signoff — typically the four Phase B
   * features bundled in the quoted tier. When omitted the section is
   * suppressed entirely so legacy callers keep their existing layout.
   */
  phaseBHighlights?: { titleEn: string; titleEs: string; bodyEn: string; bodyEs: string }[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

/** Brand tokens lifted from the approved canvas mockup (PreviewLed.tsx). */
const C = {
  bodyBg: "#F1ECDF",
  card: "#FBF9F4",
  cardBorder: "#E8E2D2",
  cardSoft: "#F4EFE3",
  ink: "#1A1A1A",
  inkSoft: "#3A3A3A",
  inkMuted: "#6B6453",
  inkLabel: "#9A8E72",
  forest: "#3F6657",
  cream: "#E8E2D2",
  heroBg: "#1F2026",
  heroOverlayInk: "#FFFFFF",
} as const;

const sanitizeRepInitial = (name: string): string =>
  (name.trim().charAt(0) || "A").toUpperCase();

/** Validates the hero URL: only HTTPS slips through, everything else falls back to the no-hero variant. */
const validateHeroUrl = (raw: string | undefined): string | undefined =>
  raw && /^https:\/\//i.test(raw) ? raw : undefined;

const formatVoiceNumber = (raw: string | undefined): string | null => {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw.trim();
};

const formatPrice = (cents: number): string => {
  const dollars = Math.floor(cents / 100);
  const remainder = cents % 100;
  return remainder === 0
    ? `$${dollars}`
    : `$${dollars}.${remainder.toString().padStart(2, "0")}`;
};

// ---------------------------------------------------------------------------
// Locale-aware copy
// ---------------------------------------------------------------------------

type CheckoutCopy = {
  livePreviewPill: string;
  headlinePart1: (practice: string) => string;
  headlinePart2: string;
  greeting: (firstName: string) => string;
  planPrefix: string;
  planDescriptor: string;
  perMo: string;
  noSetupFee: string;
  setupFee: (formatted: string) => string;
  includesLabel: (labels: string[]) => string;
  includesEmpty: string;
  cancelAnytime: string;
  cta: string;
  trust: string;
  signoffIntro: (firstName: string) => string;
  signoffOrg: string;
  footerOrg: string;
  footerContactWithPhone: (phone: string) => string;
  footerContactNoPhone: string;
  preheader: (practice: string) => string;
  heroAlt: string;
  phaseBHeading: string;
};

const COPY: Record<EmailLocale, CheckoutCopy> = {
  en: {
    livePreviewPill: "Live preview",
    headlinePart1: (practice: string) => practice,
    headlinePart2: "is ready to publish.",
    greeting: (firstName: string) =>
      `${firstName} — your site is built and waiting. Tap the preview below when you have a minute. When you're ready, the button under it puts it live on your domain this week.`,
    planPrefix: "Plan",
    planDescriptor: "Boutique site · monthly",
    perMo: "/mo",
    noSetupFee: "no setup fee",
    setupFee: (formatted: string) => `${formatted} one-time setup`,
    includesLabel: (labels: string[]) => `Includes ${labels.join(", ")}`,
    includesEmpty: "Hosted + maintained by us",
    cancelAnytime: "Cancel anytime",
    cta: "Open secure checkout",
    trust: "Stripe-secured · we never see your card",
    signoffIntro: (firstName: string) =>
      `${firstName}, once you're done I'll put it on your domain and email you the keys.`,
    signoffOrg: "Ashford Creative · Austin",
    footerOrg:
      "Ashford Creative — boutique websites for Texas mental-health practices.",
    footerContactWithPhone: (phone: string) =>
      `Reply directly · ${phone} · hello@ashfordhealthcreative.com`,
    footerContactNoPhone:
      "Reply directly · hello@ashfordhealthcreative.com",
    preheader: (practice: string) =>
      `${practice} is ready — take a look and let me know what you think.`,
    heroAlt: "Site preview",
    phaseBHeading: "What's included that's new",
  },
  es: {
    livePreviewPill: "Vista previa",
    headlinePart1: (practice: string) => practice,
    headlinePart2: "está listo para publicar.",
    greeting: (firstName: string) =>
      `${firstName} — tu sitio está construido y esperando. Échale un vistazo cuando tengas un minuto. Cuando estés listo, el botón debajo lo deja activo en tu dominio esta semana.`,
    planPrefix: "Plan",
    planDescriptor: "Sitio boutique · mensual",
    perMo: "/mes",
    noSetupFee: "sin costo de configuración",
    setupFee: (formatted: string) => `${formatted} configuración inicial`,
    includesLabel: (labels: string[]) => `Incluye ${labels.join(", ")}`,
    includesEmpty: "Hospedaje + mantenimiento incluido",
    cancelAnytime: "Cancela cuando quieras",
    cta: "Abrir el pago seguro",
    trust: "Asegurado por Stripe · nunca vemos tu tarjeta",
    signoffIntro: (firstName: string) =>
      `${firstName}, cuando termines lo subo a tu dominio y te envío las llaves.`,
    signoffOrg: "Ashford Creative · Austin",
    footerOrg:
      "Ashford Creative — sitios web para profesionales de la salud mental en Texas.",
    footerContactWithPhone: (phone: string) =>
      `Responde directamente · ${phone} · hello@ashfordhealthcreative.com`,
    footerContactNoPhone:
      "Responde directamente · hello@ashfordhealthcreative.com",
    preheader: (practice: string) =>
      `${practice} está listo — échale un vistazo y dime qué piensas.`,
    heroAlt: "Vista previa del sitio",
    phaseBHeading: "Lo nuevo que está incluido",
  },
} as const;

// ---------------------------------------------------------------------------
// Block builders
// ---------------------------------------------------------------------------

/**
 * Hero with the prospect's screenshot + editorial headline overlaid on it.
 *
 * Strategy ("bulletproof background image" pattern):
 *   - Modern clients (Gmail web/Android/iOS, Apple Mail, Outlook.com /
 *     Outlook 365 web) honour `background-image` on a block element, so the
 *     screenshot fills the hero box and the pills + Cormorant headline
 *     render on top of it inside a fixed-height frame.
 *   - Outlook desktop (MSO) ignores CSS `background-image`; we feed it a
 *     `<v:rect>` with `<v:fill type="frame">` inside conditional comments
 *     so the same screenshot becomes the panel background and the
 *     `<v:textbox>` contents render over it.
 *   - When images are blocked entirely (Gmail "Display images" prompt
 *     off, or the recipient's mail client refuses external assets), the
 *     `bgcolor` / `background-color` fallback (#1F2026) keeps the dark
 *     panel intact and the cream-on-dark headline remains legible.
 *   - The whole panel is wrapped in the CTA `<a>` so a single tap on the
 *     hero opens checkout — mobile recipients tap the picture
 *     instinctively, and we want that gesture to do the right thing.
 *
 * Heights: 340px tall to match the canvas mockup. Width is fixed at 600px
 * because VML cannot honour percentage widths — the surrounding 600px
 * card already enforces this width on all clients.
 */
const renderHero = (
  ctx: CheckoutEmailContext,
  copy: typeof COPY.en,
  heroUrl: string,
): string => {
  const safeUrl = escapeHtml(heroUrl);
  const safeCta = escapeHtml(ctx.ctaUrl);
  const headlineMarkup = `
    <div style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <span style="display:inline-block;background:rgba(0,0,0,0.55);color:#FFFFFF;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;padding:6px 12px;border-radius:999px;mso-padding-alt:6px 12px;">${escapeHtml(copy.livePreviewPill)}</span>
    </div>
    <div style="margin-top:140px;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.1;color:${C.heroOverlayInk};font-weight:400;text-shadow:0 2px 12px rgba(0,0,0,0.55);">${escapeHtml(copy.headlinePart1(ctx.practice))}</div>
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.2;color:${C.cream};font-style:italic;font-weight:400;margin-top:6px;text-shadow:0 2px 12px rgba(0,0,0,0.55);">${escapeHtml(copy.headlinePart2)}</div>
    </div>`;

  return `
    <tr><td bgcolor="${C.heroBg}" style="padding:0;background:${C.heroBg};">
      <a href="${safeCta}" style="text-decoration:none;color:inherit;display:block;">
        <!--[if gte mso 9]>
        <v:rect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" fill="true" stroke="false" style="width:600px;height:340px;">
          <v:fill type="frame" src="${safeUrl}" color="${C.heroBg}" />
          <v:textbox inset="0,0,0,0">
        <![endif]-->
        <div style="background-color:${C.heroBg};background-image:url('${safeUrl}');background-position:center top;background-size:cover;background-repeat:no-repeat;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center" style="width:600px;max-width:600px;">
            <tr><td height="340" valign="top" style="height:340px;padding:22px 32px;background-color:transparent;mso-line-height-rule:exactly;">
              ${headlineMarkup}
            </td></tr>
          </table>
        </div>
        <!--[if gte mso 9]>
          </v:textbox>
        </v:rect>
        <![endif]-->
        <img src="${safeUrl}" alt="${escapeHtml(copy.heroAlt)}" width="1" height="1" style="display:none !important;visibility:hidden;width:1px;height:1px;border:0;outline:none;" />
      </a>
    </td></tr>`;
};

/**
 * Brand header used when no hero screenshot is available. Same height
 * profile as the hero so the rest of the layout doesn't shift.
 */
const renderBrandHeader = (copy: typeof COPY.en): string => `
  <tr><td bgcolor="${C.heroBg}" style="padding:48px 32px 44px;background:${C.heroBg};text-align:center;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:${C.cream};letter-spacing:0.6px;font-style:italic;">Ashford Creative</div>
    <div style="margin-top:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:rgba(255,255,255,0.6);">${escapeHtml(copy.livePreviewPill)}</div>
  </td></tr>`;

const renderLedger = (
  ctx: CheckoutEmailContext,
  copy: typeof COPY.en,
): string => {
  const setupBadge =
    ctx.setupCents > 0
      ? copy.setupFee(formatPrice(ctx.setupCents))
      : copy.noSetupFee;
  const includesText =
    ctx.addonLabels.length > 0
      ? copy.includesLabel(ctx.addonLabels)
      : copy.includesEmpty;
  const monthly = formatPrice(ctx.monthlyPriceCents);

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.cardBorder};border-radius:6px;border-collapse:separate;">
      <tr>
        <td style="padding:18px 22px;border-bottom:1px solid ${C.cardBorder};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td valign="top" align="left">
                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:${C.inkLabel};">${escapeHtml(ctx.tierLabel)}</div>
                <div style="font-family:Georgia,'Times New Roman',serif;font-size:19px;color:${C.ink};margin-top:4px;">${escapeHtml(copy.planDescriptor)}</div>
              </td>
              <td valign="top" align="right" style="white-space:nowrap;">
                <div style="font-family:Georgia,'Times New Roman',serif;font-size:32px;color:${C.ink};line-height:1;">${escapeHtml(monthly)}<span style="font-size:14px;color:${C.inkMuted};font-style:italic;">${escapeHtml(copy.perMo)}</span></div>
                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:1.6px;color:${C.inkLabel};margin-top:6px;text-transform:uppercase;">${escapeHtml(setupBadge)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td bgcolor="${C.cardSoft}" style="padding:12px 22px;background:${C.cardSoft};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="left" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:${C.inkMuted};">${escapeHtml(includesText)}</td>
              <td align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:${C.inkMuted};white-space:nowrap;">${escapeHtml(copy.cancelAnytime)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
};

const renderCta = (
  ctx: CheckoutEmailContext,
  copy: typeof COPY.en,
): string => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center" bgcolor="${C.ink}" style="border-radius:6px;background:${C.ink};">
      <a href="${escapeHtml(ctx.ctaUrl)}" style="display:block;padding:16px 22px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;letter-spacing:0.4px;border-radius:6px;">${escapeHtml(copy.cta)} →</a>
    </td></tr>
  </table>
  <p style="margin:14px 0 0;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:${C.inkLabel};letter-spacing:0.4px;">${escapeHtml(copy.trust)}</p>`;

const renderSignoff = (
  ctx: CheckoutEmailContext,
  copy: typeof COPY.en,
): string => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${C.cardBorder};margin-top:6px;">
    <tr>
      <td width="56" valign="top" style="padding:24px 14px 0 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr><td width="44" height="44" align="center" valign="middle" bgcolor="${C.forest}" style="border-radius:22px;color:#FFFFFF;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:18px;line-height:44px;">${escapeHtml(sanitizeRepInitial(ctx.repFirstName))}</td></tr>
        </table>
      </td>
      <td valign="top" style="padding:24px 0 0;">
        <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.7;color:${C.inkSoft};">${escapeHtml(copy.signoffIntro(ctx.leadFirstName))}</p>
        <p style="margin:8px 0 0;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:20px;color:${C.ink};">${escapeHtml(ctx.repFirstName)}</p>
        <p style="margin:2px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:${C.inkLabel};">${escapeHtml(copy.signoffOrg)}</p>
      </td>
    </tr>
  </table>`;

/**
 * Batch 4.c — Phase B "what's new" highlights block. Renders above the
 * signoff so the prospect sees the four marquee features (telehealth /visit,
 * online booking, ghostwriter, onboarding hub) on their proposal. Bilingual:
 * each highlight carries both EN and ES copy; the caller picks which one to
 * pass per-feature based on the rendering locale.
 */
const renderPhaseBHighlights = (
  highlights: NonNullable<CheckoutEmailContext["phaseBHighlights"]>,
  copy: typeof COPY.en,
  lang: EmailLocale,
): string => {
  if (highlights.length === 0) return "";
  const rows = highlights
    .map((h) => {
      const title = lang === "es" ? h.titleEs : h.titleEn;
      const body = lang === "es" ? h.bodyEs : h.bodyEn;
      return `
        <tr><td style="padding:10px 0;border-bottom:1px solid ${C.cardBorder};">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;color:${C.ink};margin-bottom:3px;">${escapeHtml(title)}</div>
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${C.inkMuted};">${escapeHtml(body)}</div>
        </td></tr>`;
    })
    .join("");
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:${C.inkLabel};margin-bottom:10px;">${escapeHtml(copy.phaseBHeading)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${rows}
    </table>`;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const renderCheckoutEmailHtml = (ctx: CheckoutEmailContext): string => {
  const lang: EmailLocale = ctx.locale === "es" ? "es" : "en";
  const copy = COPY[lang];
  const heroUrl = validateHeroUrl(ctx.heroImageUrl);
  const phone = formatVoiceNumber(env.twilioVoiceNumber);
  const footerContact = phone
    ? copy.footerContactWithPhone(phone)
    : copy.footerContactNoPhone;
  const preheader = copy.preheader(ctx.practice);

  const heroBlock = heroUrl
    ? renderHero(ctx, copy, heroUrl)
    : renderBrandHeader(copy);

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Ashford Creative</title>
</head>
<body style="margin:0;padding:0;background:${C.bodyBg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:${C.bodyBg};line-height:1px;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bodyBg}" style="background:${C.bodyBg};">
    <tr><td align="center" style="padding:32px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.card}" style="max-width:600px;width:100%;background:${C.card};border:1px solid ${C.cardBorder};border-radius:10px;overflow:hidden;">
        ${heroBlock}
        <tr><td style="padding:28px 40px 0;">
          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.7;color:${C.inkSoft};">${escapeHtml(copy.greeting(ctx.leadFirstName))}</p>
        </td></tr>
        <tr><td style="padding:24px 40px 0;">
          ${renderLedger(ctx, copy)}
        </td></tr>
        <tr><td style="padding:24px 40px 0;">
          ${renderCta(ctx, copy)}
        </td></tr>
        ${
          ctx.phaseBHighlights && ctx.phaseBHighlights.length > 0
            ? `<tr><td style="padding:24px 40px 0;">${renderPhaseBHighlights(ctx.phaseBHighlights, copy, lang)}</td></tr>`
            : ""
        }
        <tr><td style="padding:28px 40px 32px;">
          ${renderSignoff(ctx, copy)}
        </td></tr>
        <tr><td bgcolor="${C.cardSoft}" style="padding:18px 40px 22px;background:${C.cardSoft};border-top:1px solid ${C.cardBorder};">
          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:${C.inkMuted};">${escapeHtml(copy.footerOrg)}</p>
          <p style="margin:6px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:${C.inkMuted};">${escapeHtml(footerContact)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};
