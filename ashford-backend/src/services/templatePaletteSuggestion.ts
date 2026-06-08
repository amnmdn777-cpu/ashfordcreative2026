import { PALETTES, type TemplateKey } from "@workspace/api-zod";

/**
 * Suggest the catalog template whose primary color is closest to the
 * prospect's brand accent (extracted from their existing site by the
 * `website_meta` scraper). When the rep mints a fresh preview, we
 * default-select this template so the prospect lands on the closest
 * visual match to what they already have — feeling familiar instead
 * of "branded by someone else".
 *
 * Returns null when:
 *   - no brand accent was extracted (template default falls through)
 *   - the prospect's accent is desaturated/grey (no meaningful fit)
 *
 * Pure function; no DB or network. Exported separately so the
 * rep dashboard can also surface "we recommend Garden because their
 * site is sage" without round-tripping through the preview build.
 */
export interface PaletteSuggestion {
  templateKey: TemplateKey;
  paletteKey: string;
  primary: string;
  /** HSL distance 0..1, where 0 = identical hue/sat/lum, 1 = opposite. */
  distance: number;
  /** Confidence in the suggestion: "strong" < 0.15, "ok" < 0.30, "weak" otherwise. */
  fit: "strong" | "ok" | "weak";
}

export const suggestTemplateForBrand = (
  brandAccent: string | null | undefined,
): PaletteSuggestion | null => {
  if (!brandAccent) return null;
  const target = parseHex(brandAccent);
  if (!target) return null;
  const targetHsl = rgbToHsl(target);
  // If the prospect's accent is very desaturated (s < 0.10), the
  // hue carries no meaning — every template is equidistant. Skip.
  if (targetHsl.s < 0.1) return null;

  let best: PaletteSuggestion | null = null;
  for (const palette of Object.values(PALETTES)) {
    const candidate = parseHex(palette.primary);
    if (!candidate) continue;
    const candidateHsl = rgbToHsl(candidate);
    const distance = colorDistanceHsl(targetHsl, candidateHsl);
    if (!best || distance < best.distance) {
      best = {
        templateKey: palette.templateKey,
        paletteKey: palette.key,
        primary: palette.primary,
        distance,
        fit:
          distance < 0.15 ? "strong" : distance < 0.3 ? "ok" : "weak",
      };
    }
  }
  return best;
};

// ---------------------------------------------------------------------------
// Color helpers — same shape as `previewContentHarmony.colorDistance` but
// returns intermediate HSL so we can also gate on saturation. Local copy
// to keep this module standalone (it gets re-used by the rep dashboard
// which mustn't pull in the whole harmony pipeline).
// ---------------------------------------------------------------------------

const parseHex = (raw: string): { r: number; g: number; b: number } | null => {
  const m = raw.trim().match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
};

const rgbToHsl = (rgb: {
  r: number;
  g: number;
  b: number;
}): { h: number; s: number; l: number } => {
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
};

const colorDistanceHsl = (
  a: { h: number; s: number; l: number },
  b: { h: number; s: number; l: number },
): number => {
  const dh = Math.min(Math.abs(a.h - b.h), 360 - Math.abs(a.h - b.h)) / 180;
  const ds = Math.abs(a.s - b.s);
  const dl = Math.abs(a.l - b.l);
  return Math.min(1, 0.7 * dh + 0.15 * ds + 0.15 * dl);
};
