// 2026-05-14 audit fix #8 (long-term scraper hardening).
//
// Aggregator pages (Psychology Today, Headway, Grow Therapy, Alma,
// Headlight, …) end every profile with a footer block — "Show more 8,718
// more providers in CA…", "Take a short quiz to find your therapist",
// "Find a therapist today". Our scrapers anchor bio extraction on
// "Personal Statement" / bio selectors, but the stop tokens occasionally
// miss and the footer bleeds into the captured bio. The defense in
// resolvePersona.ts blanks the leaked text downstream, but every new
// aggregator format produces a new pattern that escapes the blacklist.
//
// This module is the single-source sanitizer applied at the *capture*
// boundary in every scraper. Rules:
//   1. Cut the bio at the first known aggregator-footer phrase.
//   2. If what remains is below a credibility threshold (≤ 30 chars),
//      reject the whole extraction (return null) so the downstream
//      pipeline falls back to a different source instead of carrying
//      garbage forward.
//   3. Never fall back to `document.body.innerText`. Scrapers that hit
//      this path return null on miss — empty is better than wrong.

const AGGREGATOR_FOOTER_CUTOFFS: RegExp[] = [
  /\bShow more\b.*\bproviders\b/i,
  /\b\d{1,3}(,\d{3})+\s+more\s+providers\b/i,
  /\bTake a (short |quick )?quiz\b/i,
  /\bfind (a |your )?therapist (today|now)\b/i,
  /\bbrowse (our |all )?therapists?\b/i,
  /\b(view|see) all (therapists?|providers?|professionals?)\b/i,
  /\bRefine your search\b/i,
  /\bSee fewer providers\b/i,
];

const AGGREGATOR_FULLMATCH: RegExp[] = [
  /^Looking to contact .+? regarding/i,
  /^Contact us\b.+?services/i,
  /^Find a therapist/i,
  /^Search results/i,
  /^Welcome to (Care|Headway|Alma|Headlight|Psychology Today|Grow Therapy)\b/i,
];

const MIN_BIO_CHARS = 30;

/**
 * Sanitize a captured bio string. Cuts off known aggregator footer
 * boilerplate and rejects the result outright if it doesn't look like
 * a real bio.
 *
 * @returns the cleaned bio, or null if the cleaned result is too short
 *          to be credible.
 */
export function sanitizeScrapedBio(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let text = raw.trim();
  if (!text) return null;
  for (const re of AGGREGATOR_FULLMATCH) {
    if (re.test(text)) return null;
  }
  for (const re of AGGREGATOR_FOOTER_CUTOFFS) {
    const m = text.match(re);
    if (m && m.index !== undefined) {
      text = text.slice(0, m.index).trim();
    }
  }
  text = text.replace(/\s+/g, " ").trim();
  if (text.length < MIN_BIO_CHARS) return null;
  return text;
}
