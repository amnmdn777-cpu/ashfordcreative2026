// LOT 2.3 — fixed-priority resolver for `previewContent.practiceName`.
//
// Background: lead 531 (Gail) shipped with practiceName="Hostinger Horizons"
// because the website's `<title>` was the builder's default. The synthesizer
// was picking website_meta over LinkedIn because confidence (70 vs 60) was
// higher — but for practiceName, confidence is the wrong signal. A
// builder-default <title> is high-confidence garbage; a LinkedIn headline
// like "Jane Smith, LPC at Be Well Behavioral Health" is low-confidence
// gold.
//
// Hard-coded waterfall (NOT confidence-ranked):
//   1. linkedin_apify     — trailing "at <PracticeName>" parsed from the
//                            top profile's title.
//   2. Google Places      — GMB-owned business name; canonical when present.
//   3. website <h1>       — homepage banner, excluding generic ("Home"...).
//   4. website <title>    — excluding known CMS/builder default values
//                            (Hostinger Horizons, Wix.com, Squarespace…).
//   5. lead.practice      — CRM value typed by the rep.
//   6. ai_synthesis       — last resort.
//
// `<meta name="generator">` is intentionally NEVER consulted for practice
// name. It's a platform fingerprint, not a business name. See LOT 2.4 for
// where that signal IS used (web-stack scoring).

const GENERIC_H1S = new Set<string>([
  "home",
  "welcome",
  "welcome!",
  "hello",
  "about",
  "about us",
  "homepage",
  "index",
  "untitled",
]);

// 2026-05-14 V4: aggregator network brands. When a lead's website is one
// of these directory networks (Headway, Care.com, Headlight Health,
// Psychology Today, Grow Therapy, Alma, etc.), the H1 / <title> of the
// site is the network's own brand — NOT the clinician's practice. Treat
// those exactly like builder default titles and skip them, falling
// through to LinkedIn / lead.practice / AI synthesis. Without this, the
// preview portal would display "Headlight" / "Care" / "Psychology Today"
// as the prospect's practice name — free advertising for competitors.
const AGGREGATOR_BRANDS = new Set<string>([
  "care",
  "carecom",
  "care.com",
  "headway",
  "headwayco",
  "alma",
  "almacom",
  "helloalma",
  "grow",
  "grow therapy",
  "growtherapy",
  "talkspace",
  "betterhelp",
  "zencare",
  "zencareco",
  "zocdoc",
  "healthgrades",
  "therapyden",
  "goodtherapy",
  "psychology today",
  "psychologytoday",
  "openpath",
  "monarch",
  "inclusive therapists",
  "headlight",
  "headlight health",
  "simplepractice",
  "theranest",
]);
function isAggregatorBrand(s: string): boolean {
  const lower = s.trim().toLowerCase();
  if (!lower) return false;
  if (AGGREGATOR_BRANDS.has(lower)) return true;
  // Also strip punctuation/whitespace for fuzzy matches.
  const norm = lower.replace(/[^a-z0-9]/g, "");
  return AGGREGATOR_BRANDS.has(norm);
}

// Case-insensitive substring match — many builders emit the platform name
// somewhere in the title ("Wix.com Website Builder · Free Site Builder").
const BUILDER_TITLE_FRAGMENTS = [
  "hostinger horizons",
  "hostinger",
  "wix.com",
  "wix website builder",
  "squarespace",
  "showit",
  "webflow",
  "sitebuilder",
  "site builder",
  "wordpress with elementor",
  "godaddy website builder",
  "weebly",
  "duda",
  "untitled",
];

export type LinkedInProfile = {
  title?: string | null;
  url?: string | null;
  snippet?: string | null;
};

export type LinkedInPayload = {
  profiles?: LinkedInProfile[];
} | null | undefined;

export type WebsiteMetaPayload = {
  title?: string | null;
  h1?: string | null;
  generator?: string | null;
} | null | undefined;

export type GooglePlacesPayload = {
  name?: string | null;
} | null | undefined;

export type PracticeNameSources = {
  linkedin?: LinkedInPayload;
  googlePlaces?: GooglePlacesPayload;
  websiteMeta?: WebsiteMetaPayload;
  leadPractice?: string | null;
  aiPracticeName?: string | null;
};

export type PracticeNameResolution = {
  value: string;
  source:
    | "linkedin_apify"
    | "google_places"
    | "website_meta"
    | "lead_record"
    | "ai_synthesis";
} | null;

// Parse "Name - License at PracticeName" → PracticeName.
// LinkedIn titles vary: "Jane Smith — LPC, LMFT at Acme Counseling", or
// "Jane Smith | Therapist at Acme | LinkedIn". We:
//   1. Strip the trailing " | LinkedIn" suffix if present.
//   2. Find the LAST " at " (case-insensitive) and return the rest.
//   3. Strip any trailing "| Something" tail.
export function parseLinkedInPracticeName(
  headline: string | null | undefined,
): string | null {
  if (!headline) return null;
  let s = headline.trim();
  if (!s) return null;
  s = s.replace(/\s*\|\s*linkedin\s*$/i, "").trim();
  const idx = s.search(/\sat\s/i);
  if (idx < 0) return null;
  // Use lastIndexOf to handle "Therapist at X at Y" patterns: prefer the
  // last " at " which usually demarcates the employer.
  const lastIdx = s.toLowerCase().lastIndexOf(" at ");
  const tail = s.slice(lastIdx + 4).trim();
  const cleaned = tail.split(/\s*[|·•]\s*/)[0]?.trim();
  if (!cleaned) return null;
  // Guard against degenerate "at Self" / "at Private Practice".
  if (/^(self|self-employed|private practice)$/i.test(cleaned)) return null;
  return cleaned;
}

function isGenericH1(h1: string): boolean {
  const lower = h1.trim().toLowerCase();
  if (!lower) return true;
  if (GENERIC_H1S.has(lower)) return true;
  if (lower.length < 3) return true;
  // V4: aggregator brands (Headlight / Care / Headway / etc.) are treated
  // as generic so they don't get promoted to the prospect's practice name.
  if (isAggregatorBrand(lower)) return true;
  return false;
}

function isBuilderTitle(title: string): boolean {
  const lower = title.trim().toLowerCase();
  if (!lower) return true;
  if (BUILDER_TITLE_FRAGMENTS.some((frag) => lower.includes(frag))) return true;
  // V4: skip titles that ARE an aggregator brand or contain one as a
  // significant fragment (e.g. "Psychology Today - Headlight"). The
  // cleanTitle helper strips after the first separator; check both the
  // cleaned head AND any segment containing the brand.
  const head = lower.split(/\s*[|·—–]\s*/)[0]?.trim() ?? "";
  if (isAggregatorBrand(head)) return true;
  // Aggregator brand appears anywhere as a standalone word or hyphen-
  // separated segment.
  const segments = lower.split(/\s*[-|·—–]\s*/).map((s) => s.trim());
  if (segments.some((s) => isAggregatorBrand(s))) return true;
  return false;
}

function cleanTitle(title: string): string {
  // Strip the standard "| Tagline" or "· Tagline" suffix many sites use.
  return title.split(/\s*[|·—–]\s*/)[0]!.trim();
}

export function resolvePracticeName(
  sources: PracticeNameSources,
): PracticeNameResolution {
  // 1. LinkedIn
  const linkedInTitle = sources.linkedin?.profiles?.[0]?.title;
  const fromLinkedIn = parseLinkedInPracticeName(linkedInTitle);
  if (fromLinkedIn) {
    return { value: fromLinkedIn, source: "linkedin_apify" };
  }

  // 2. Google Places (GMB)
  const placesName = sources.googlePlaces?.name;
  if (typeof placesName === "string" && placesName.trim() && !isAggregatorBrand(placesName)) {
    return { value: placesName.trim(), source: "google_places" };
  }

  // 3. Website <h1> (non-generic)
  const h1 = sources.websiteMeta?.h1;
  if (typeof h1 === "string" && !isGenericH1(h1)) {
    return { value: h1.trim(), source: "website_meta" };
  }

  // 4. Website <title> (excluding builder defaults)
  const title = sources.websiteMeta?.title;
  if (typeof title === "string" && !isBuilderTitle(title)) {
    const cleaned = cleanTitle(title);
    if (cleaned) return { value: cleaned, source: "website_meta" };
  }

  // 5. CRM lead.practice
  if (sources.leadPractice && sources.leadPractice.trim() && !isAggregatorBrand(sources.leadPractice)) {
    return { value: sources.leadPractice.trim(), source: "lead_record" };
  }

  // 6. AI synthesis
  if (sources.aiPracticeName && sources.aiPracticeName.trim()) {
    return { value: sources.aiPracticeName.trim(), source: "ai_synthesis" };
  }

  return null;
}
