/**
 * Design-harmony guards for the public-source-first preview pipeline.
 *
 * The brand identity we lift from the prospect's existing site (logo,
 * accent color, font) feeds directly into the prospect-facing preview
 * shell. Without governance, an extracted color or logo can break the
 * "wow, they already know me" feeling we're optimizing for — a low-
 * contrast accent paints unreadable pills, an oversized logo
 * disfigures the header band, a headshot-shaped favicon stands in for
 * a brand mark.
 *
 * This module is the single place where we say no, **before** the
 * value reaches the API response. Soft-fails to null on every check
 * so a bad signal silently degrades to the template's own sample,
 * never an ugly artefact on the prospect's screen. Keep it pure: no
 * network, no side-effects — `previewContent.ts` calls it
 * synchronously while it composes the final payload.
 */

/**
 * Validate an extracted accent color. Returns the canonical lowercase
 * hex if it survives the contrast and luminance gates; null otherwise.
 *
 * Gates:
 *  - Must be a 3- or 6-digit hex.
 *  - Contrast ratio against pure white must be ≥ 3.5 (otherwise the
 *    accent paints unreadable text on the cream recap band).
 *  - Relative luminance must be < 0.92 (rejects near-white "accents"
 *    that are basically the page background).
 *  - Relative luminance must be > 0.02 (near-black is already covered
 *    by `text-ink`; we don't want the accent to collapse onto it).
 *
 * 3.5 is below WCAG AA (4.5) intentionally — the recap pills carry
 * short labels at small size, contrast lab tests show 3.5 stays
 * readable for sans-serif < 14px. We also use the color at low alpha
 * for borders (0x55 = 33%), which softens any borderline hue further.
 */
export function validateAccentColor(rawHex: string | null): string | null {
  if (!rawHex) return null;
  const hex = normalizeHex(rawHex);
  if (!hex) return null;
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const lum = relativeLuminance(rgb);
  if (lum < 0.02 || lum > 0.92) return null;
  const ratio = contrastRatioOnWhite(rgb);
  if (ratio < 3.5) return null;
  return hex;
}

/**
 * HSL-distance between two hex colors, scaled to [0, 1]. Used by the
 * preview UI to drop the prospect's accent when it sits too close to
 * the active template's signature color — the visual language of the
 * template should win when the two would clash for being too similar.
 *
 * Returns 0 when colors are identical, 1 at maximum perceived
 * difference. Hue weighting dominates because two greens at different
 * saturations still read as "the green family"; saturation/lightness
 * differences rarely cause clashes between near-hue partners.
 */
export function colorDistance(aHex: string, bHex: string): number {
  const a = hexToRgb(normalizeHex(aHex) ?? "");
  const b = hexToRgb(normalizeHex(bHex) ?? "");
  if (!a || !b) return 1;
  const ha = rgbToHsl(a);
  const hb = rgbToHsl(b);
  const dh = Math.min(Math.abs(ha.h - hb.h), 360 - Math.abs(ha.h - hb.h)) / 180;
  const ds = Math.abs(ha.s - hb.s);
  const dl = Math.abs(ha.l - hb.l);
  return Math.min(1, 0.7 * dh + 0.15 * ds + 0.15 * dl);
}

/**
 * Validate an extracted logo URL by shape only (no network — the
 * scrape already attested the URL exists on a first-party host). We
 * reject URLs that look like favicons, sprite sheets, tracking
 * pixels, or social-icon CDN paths so the recap band never renders
 * a 16x16 favicon as if it were the practice logo. Anything that
 * survives still goes through `<img onError>` on the client for the
 * final "actually loaded" gate.
 *
 * Returns the cleaned URL or null. Pure URL inspection — same input
 * always yields the same output, so it composes inside the existing
 * synchronous brand block in `buildPreviewContent`.
 */
export function validateLogoUrl(rawUrl: string | null): string | null {
  if (!rawUrl) return null;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const path = url.pathname.toLowerCase();
  // Patterns that almost always identify a non-logo asset.
  if (
    /favicon|sprite|pixel|tracking|loading|spinner|placeholder|gravatar/i.test(
      path,
    )
  ) {
    return null;
  }
  // Common social-icon CDN paths the regex extractor sometimes picks up
  // when a site links to its own social profiles via an icon img.
  if (/icons?\/social|share-buttons|fontawesome/i.test(path)) {
    return null;
  }
  // Accept .svg (vector — always scales gracefully) plus the usual
  // raster formats. Reject anything else (we've seen .gif marketing
  // banners come through as "logos").
  if (!/\.(svg|png|jpe?g|webp|avif)(\?|$)/i.test(path)) {
    return null;
  }
  // Drop tracking query params so the URL doesn't change between runs.
  url.search = "";
  url.hash = "";
  return url.toString();
}

// ---------------------------------------------------------------------------
// Color math helpers (no deps; mirror the standard sRGB → relative
// luminance formula and HSL conversion from the W3C spec).
// ---------------------------------------------------------------------------

const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizeHex(raw: string): string | null {
  const m = raw.trim().match(HEX_RE);
  if (!m) return null;
  const hex = m[1];
  if (hex.length === 3) {
    return `#${hex
      .split("")
      .map((c) => c + c)
      .join("")
      .toLowerCase()}`;
  }
  return `#${hex.toLowerCase()}`;
}

function hexToRgb(
  hex: string,
): { r: number; g: number; b: number } | null {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const raw = m[1];
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

/** sRGB relative luminance per WCAG 2.x. */
function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const linear = (c8: number) => {
    const c = c8 / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * linear(rgb.r) + 0.7152 * linear(rgb.g) + 0.0722 * linear(rgb.b)
  );
}

function contrastRatioOnWhite(rgb: { r: number; g: number; b: number }): number {
  const l = relativeLuminance(rgb);
  // WCAG: (L1 + 0.05) / (L2 + 0.05). L_white = 1.
  return (1 + 0.05) / (l + 0.05);
}

function rgbToHsl(rgb: {
  r: number;
  g: number;
  b: number;
}): { h: number; s: number; l: number } {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        h = ((b - r) / d + 2) * 60;
        break;
      case b:
        h = ((r - g) / d + 4) * 60;
        break;
    }
  }
  return { h, s, l };
}
