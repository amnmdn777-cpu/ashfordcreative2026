// Directory/marketplace brand names that have been observed leaking into
// `<h1>` of provider profile pages (Headway, Psychology Today, etc.).
// When a scraper picks one of these up as the practitioner's name, the
// portal preview ends up rendering "Hi I'm Care" / "Hi I'm Psychology
// Today" instead of the real clinician.
//
// Compare against `normalizeBrandName()` (lowercase + non-alphanumerics
// stripped) so "Psychology Today", "psychology-today", "psychologytoday"
// and "PSYCH TODAY" all collapse to the same token.

const NORMALIZED_BRANDS = new Set<string>([
  "care",
  "carecom",
  "psychology",
  "psychologytoday",
  "psych",
  "psychtoday",
  "headway",
  "headwayco",
  "alma",
  "almacom",
  "growtherapy",
  "grow",
  "talkspace",
  "betterhelp",
  "zencare",
  "zencareco",
  "zocdoc",
  "healthgrades",
  "therapyden",
  "goodtherapy",
  "openpathcollective",
  "openpath",
  "inclusivetherapists",
  "monarchsimplepractice",
  "monarch",
  "therapy",
  "counseling",
  "wellness",
  "provider",
  "clinician",
  "therapist",
  "profile",
  "biography",
  "bio",
  "about",
  "welcome",
  "home",
  "services",
  "contact",
  "team",
  "staff",
]);

export function normalizeBrandName(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isPlatformBrandName(input: string | null | undefined): boolean {
  if (!input) return true;
  const trimmed = input.trim();
  if (!trimmed) return true;
  return NORMALIZED_BRANDS.has(normalizeBrandName(trimmed));
}
