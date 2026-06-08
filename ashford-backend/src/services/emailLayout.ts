import { env } from "../lib/env";

/**
 * Branded HTML wrapper for all customer-facing emails.
 *
 * Produces a responsive, table-based layout that renders consistently across
 * Gmail, Apple Mail, Outlook (desktop + web), and major mobile clients. All
 * styling is inline (no <style> blocks, no external assets) so we never get
 * the dreaded "Display images" prompt or stripped CSS.
 *
 * The plain-text fallback is kept identical to the input `bodyText` so reply
 * threading, accessibility, and spam filters all see the original prose.
 */

export type EmailLocale = "en" | "es";

export type WrapHtmlEmailOptions = {
  bodyText: string;
  ctaUrl?: string;
  ctaLabel?: string;
  locale?: EmailLocale;
  /**
   * Optional fully-qualified URL of a hero image rendered above the body
   * (typically a screenshot of the prospect's freshly-prepared site). The
   * recipient's mail client fetches it directly — must be HTTPS and served
   * with a permissive CORS policy or a long Cache-Control. We deliberately
   * use a plain `<img>` instead of an inline CID attachment because Gmail's
   * web client renders externally-hosted images more reliably than `cid:`
   * references on the first open.
   */
  heroImageUrl?: string;
  /** Caption rendered just below the hero image. Locale-aware default. */
  heroImageCaption?: string;
};

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const linkifyUrls = (escaped: string): string =>
  // Conservative URL regex applied to already-escaped HTML so we never wrap
  // angle brackets or quotes by mistake. Matches http/https only.
  escaped.replace(
    /(https?:\/\/[^\s<>"]+)/g,
    (m) =>
      `<a href="${m}" style="color:#3F6657;text-decoration:underline;">${m}</a>`,
  );

/**
 * Format the configured Twilio voice number into a US-style display
 * (e.g. "(512) 555-0100") so the email footer reads as a real phone
 * line instead of an opaque E.164 string. Returns the raw value if
 * formatting can't be inferred (international, short codes, etc).
 */
const formatVoiceNumber = (raw: string | undefined): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return trimmed;
};

const buildFooterCopy = (
  locale: EmailLocale,
): { line1: string; line2: string } => {
  // Resolved at call time (not module load) so a live env update flows
  // through without the API server having to restart all email senders.
  const voice = formatVoiceNumber(env.twilioVoiceNumber);
  if (locale === "es") {
    return {
      line1:
        "Ashford Creative - sitios web para profesionales de la salud mental en Texas.",
      line2: voice
        ? `Responde directamente a este correo, llámanos al ${voice}, o escribe a hello@ashfordcreative.org.`
        : "Responde directamente a este correo o escribe a hello@ashfordcreative.org.",
    };
  }
  return {
    line1:
      "Ashford Creative - boutique websites for Texas mental-health practices.",
    line2: voice
      ? `Reply directly to this email, call us at ${voice}, or write to hello@ashfordcreative.org for support.`
      : "Reply directly to this email or write to hello@ashfordcreative.org for support.",
  };
};

const DEFAULT_CTA_LABEL: Record<EmailLocale, string> = {
  en: "Open my preview",
  es: "Ver mi vista previa",
};

const DEFAULT_HERO_CAPTION: Record<EmailLocale, string> = {
  en: "Live preview of your draft site — click below to explore it.",
  es: "Vista previa de tu sitio - haz clic abajo para explorarlo.",
};

export const wrapHtmlEmail = ({
  bodyText,
  ctaUrl,
  ctaLabel,
  locale = "en",
  heroImageUrl,
  heroImageCaption,
}: WrapHtmlEmailOptions): string => {
  const lang: EmailLocale = locale === "es" ? "es" : "en";
  const footer = buildFooterCopy(lang);

  // Split on blank lines into paragraphs; preserve intra-paragraph line breaks
  // as <br/>. Linkify bare URLs after escaping so prospects can click them
  // even when the message body wasn't formatted with the CTA button.
  const paragraphs = bodyText
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const escaped = escapeHtml(p).replace(/\n/g, "<br/>");
      const withLinks = linkifyUrls(escaped);
      return `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#1f2937;">${withLinks}</p>`;
    })
    .join("");

  const button = ctaUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 8px;">
            <tr><td bgcolor="#3F6657" style="border-radius:6px;">
              <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:12px 26px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">${escapeHtml(ctaLabel ?? DEFAULT_CTA_LABEL[lang])}</a>
            </td></tr>
          </table>`
    : "";

  // Hero image is wrapped in an anchor when there's a CTA URL so a single
  // tap on the screenshot also opens the preview. We bias toward an
  // image-as-a-link because mobile users tap the picture instinctively.
  // Strict scheme check: only https:// URLs are embedded. Mail clients
  // strip http:// images on mixed-content grounds, and a malformed URL
  // (or future caller passing a `data:` / `javascript:` URI) would either
  // bloat the email or open a phishing surface — silently dropping is
  // safer than rendering a suspect <img>.
  const isSafeHttps =
    typeof heroImageUrl === "string" && /^https:\/\//i.test(heroImageUrl);
  const heroBlock = isSafeHttps
    ? (() => {
        const captionText = heroImageCaption ?? DEFAULT_HERO_CAPTION[lang];
        const img = `<img src="${escapeHtml(heroImageUrl!)}" width="600" alt="Site preview" style="display:block;width:100%;max-width:600px;height:auto;border-radius:8px;border:1px solid #e5e1d6;" />`;
        const wrapped = ctaUrl
          ? `<a href="${escapeHtml(ctaUrl)}" style="text-decoration:none;display:block;">${img}</a>`
          : img;
        return `<div style="margin:0 0 18px;">${wrapped}</div>
          <p style="margin:0 0 18px;font-size:13px;line-height:1.5;color:#6b7280;font-style:italic;">${escapeHtml(captionText)}</p>`;
      })()
    : "";

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Ashford Creative</title>
</head>
<body style="margin:0;padding:0;background:#f7f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f5f0;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;border:1px solid #ece8df;">
        <tr><td style="padding:24px 32px 14px;border-bottom:1px solid #ece8df;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;color:#3F6657;letter-spacing:0.4px;">Ashford Creative</div>
        </td></tr>
        <tr><td style="padding:28px 32px 20px;">
          ${heroBlock}
          ${paragraphs}
          ${button}
        </td></tr>
        <tr><td style="padding:18px 32px 26px;border-top:1px solid #ece8df;font-size:12px;line-height:1.55;color:#6b7280;">
          <div style="margin-bottom:6px;">${escapeHtml(footer.line1)}</div>
          <div>${escapeHtml(footer.line2)}</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};
