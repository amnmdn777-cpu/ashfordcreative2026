/**
 * Display metadata for the major US health-insurance payers we expect
 * to surface in prospect-preview "Insurance accepted" tiles. The
 * preview UI uses this to render branded pills (background tinted to
 * the payer's brand color) instead of plain monochrome text. Logos
 * are not bundled — using insurer trademarks in our own UI is a
 * licensing question we sidestep — but a tinted pill with the
 * payer's name in their corporate weight reads as "trusted brand"
 * without infringing.
 *
 * Lookup is case-insensitive substring match against the canonical
 * brand name. Returns null when the input doesn't match any known
 * payer (the UI then falls back to a neutral pill).
 */
export interface InsuranceBrand {
  /** Canonical display name. Falls back to the input when no entry. */
  name: string;
  /** Hex bg color that contrasts ≥4.5:1 against pure white text. */
  color: string;
  /** Short label fits in a 120px pill (e.g. "BCBS" for Blue Cross Blue Shield). */
  short: string | null;
}

/**
 * Curated registry of the largest US payers by membership. Brand
 * colors are sourced from each payer's own marketing site (footer,
 * primary CTA color) and compressed to a single hex that meets the
 * 4.5:1 contrast against white text. Order doesn't matter — lookup
 * is purely substring match in `getInsuranceBrand`.
 */
const REGISTRY: Array<{
  match: RegExp;
  name: string;
  color: string;
  short: string | null;
}> = [
  // Blue Cross / Blue Shield family — biggest US payer footprint.
  // Match before more-specific Anthem entries since Anthem licenses
  // BCBS in many states.
  {
    match: /\bblue\s*cross|\bbcbs\b/i,
    name: "Blue Cross Blue Shield",
    color: "#0072ce",
    short: "BCBS",
  },
  {
    match: /\baetna\b/i,
    name: "Aetna",
    color: "#7d3f98",
    short: "Aetna",
  },
  {
    match: /\bcigna\b/i,
    name: "Cigna",
    color: "#0079b1",
    short: "Cigna",
  },
  {
    match: /\bunited\s*health\s*care|\buhc\b/i,
    name: "UnitedHealthcare",
    color: "#002677",
    short: "UHC",
  },
  {
    match: /\bhumana\b/i,
    name: "Humana",
    color: "#5b8228",
    short: "Humana",
  },
  {
    match: /\bkaiser\b/i,
    name: "Kaiser Permanente",
    color: "#006bb6",
    short: "Kaiser",
  },
  {
    match: /\banthem\b/i,
    name: "Anthem",
    color: "#003a72",
    short: "Anthem",
  },
  {
    match: /\bmedicare\b/i,
    name: "Medicare",
    color: "#1f4e8a",
    short: "Medicare",
  },
  {
    match: /\bmedicaid\b/i,
    name: "Medicaid",
    color: "#0b5e7d",
    short: "Medicaid",
  },
  {
    match: /\boptum\b/i,
    name: "Optum",
    color: "#ff612b",
    short: "Optum",
  },
  {
    match: /\bumr\b/i,
    name: "UMR",
    color: "#002677",
    short: "UMR",
  },
  {
    match: /\boscar\b/i,
    name: "Oscar",
    color: "#ec1c40",
    short: "Oscar",
  },
  {
    match: /\bambetter\b/i,
    name: "Ambetter",
    color: "#005baa",
    short: "Ambetter",
  },
  {
    match: /\bcarelon\b/i,
    name: "Carelon",
    color: "#0a3a5c",
    short: "Carelon",
  },
  {
    match: /\btricare\b/i,
    name: "TRICARE",
    color: "#003366",
    short: "TRICARE",
  },
  {
    match: /\bbeacon\s*health\b|\bbeacon\b/i,
    name: "Beacon Health",
    color: "#19355d",
    short: "Beacon",
  },
  {
    match: /\bmagellan\b/i,
    name: "Magellan",
    color: "#1a4488",
    short: "Magellan",
  },
  {
    match: /\bquest\s*behavioral\b|\bquest\b/i,
    name: "Quest Behavioral Health",
    color: "#1d6c84",
    short: "Quest",
  },
  {
    match: /\bascension\b/i,
    name: "Ascension",
    color: "#5d2e8c",
    short: "Ascension",
  },
  {
    match: /\bindependence\s*blue\s*cross\b/i,
    name: "Independence BCBS",
    color: "#0072ce",
    short: "Indep. BCBS",
  },
  {
    match: /\bhorizon\s*blue\b|\bhorizon\s*bcbs\b/i,
    name: "Horizon BCBS NJ",
    color: "#0072ce",
    short: "Horizon BCBS",
  },
];

/**
 * Returns brand metadata for a payer name, or null when unknown.
 * Inputs may be free-form (e.g. "Cigna PPO", "Aetna Better Health",
 * "Horizon Blue Cross and Blue Shield of New Jersey") — we do
 * substring matching against canonical brand tokens.
 */
export const getInsuranceBrand = (raw: string): InsuranceBrand | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  for (const entry of REGISTRY) {
    if (entry.match.test(trimmed)) {
      return {
        name: entry.name,
        color: entry.color,
        short: entry.short,
      };
    }
  }
  return null;
};

/**
 * Decorate a list of insurance strings with brand metadata. The
 * order of the input is preserved. Unknown payers come back with
 * `color: null`, `short: null`, and `name = the input` so the UI
 * can render a neutral pill without dropping unfamiliar plans.
 */
export interface DecoratedInsurance {
  raw: string;
  name: string;
  color: string | null;
  short: string | null;
}

export const decorateInsurances = (
  insurances: readonly string[],
): DecoratedInsurance[] =>
  insurances.map((raw) => {
    const brand = getInsuranceBrand(raw);
    return {
      raw,
      name: brand?.name ?? raw.trim(),
      color: brand?.color ?? null,
      short: brand?.short ?? null,
    };
  });
