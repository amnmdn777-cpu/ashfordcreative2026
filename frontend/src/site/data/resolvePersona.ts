import type { TemplateContent, Review } from "@site/templates/types";
import { isSampleContent } from "@site/templates/sampleContent";
import { PERSONAS, type FocusArea, type FeeLine, type PersonaProfile } from "./personas";

/**
 * Persona view consumed by templates.
 *
 * Adapter rule:
 *   - When `props.content` looks like a real lead (not the shared
 *     sampleContent reference / sentinel name AND `team[0].name` is
 *     non-empty), the lead's data wins **field-by-field**: name,
 *     credentials, photo, bio, focus areas (services), fees, insurance.
 *     A field that's absent on the lead falls through to the persona —
 *     so a partial lead still renders coherently.
 *   - Otherwise the persona is returned verbatim, with portal-derived
 *     fields (phone / email / address / reviews / contact) zero-filled
 *     from `props.content` if available.
 *
 * Falls back to PERSONAS.atrium when the requested key is missing —
 * keeps the gallery from white-screening if a key gets renamed.
 */
export interface ResolvedPersona extends PersonaProfile {
  bookingUrl: string;
  portraitSrc: string;
  /** A1: deterministic 1-2 letter initials for the avatar fallback. */
  practitionerInitials: string;
  phone: string;
  phoneHref: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  reviews: Review[];
  insuranceList: string[];
  contact: TemplateContent["contact"];
  /** True when this view was driven by real prospect content. */
  isLead: boolean;
  /** True when this view comes from any real prospect record (lead OR
   *  practice-only). Templates use it to gate stock assets. */
  isReal: boolean;
  /**
   * True when this view comes from a real prospect record but the
   * team roster is empty — i.e. we have a real business (practiceName,
   * locations, bio crawled off the site) but no individual clinician
   * record. In that case templates should suppress persona-specific
   * UI (license_number, persona email, persona credentials) and lead
   * with the practice's identity instead.
   */
  isPracticeOnly: boolean;
  /** Practice-derived hero copy (EN+ES), populated only when
   *  isPracticeOnly. Templates prefer these over their chrome strings
   *  so the hero reads the prospect's mission instead of a persona stub. */
  heroEyebrow: { en: string; es: string } | null;
  heroHeadline: { en: string; es: string } | null;
  heroSubhead: { en: string; es: string } | null;
  /**
   * First-name token of `name`, with any leading honorific (Dr./Dra./
   * Mr./Ms./Mrs.) stripped first. Used by templates to interpolate the
   * `{firstName}` placeholder in chrome strings (e.g. "About {firstName}"
   * → "About Zach"). For practice-only previews falls back to the first
   * word of the practice name. Empty string only if both name and
   * practice name are blank (shouldn't happen in practice).
   */
  firstName: string;
}

/**
 * True when `email` is a plausible practice email — its domain matches one of
 * the prospect's candidate domains (the 3 suggestions surfaced as "Your free
 * domain" in the portal). Personal gmail/yahoo/etc. addresses won't match and
 * should be hidden in practice-only previews to avoid leaking the rep's
 * intake address into the public preview.
 */
export function isPracticeEmail(
  email: string,
  practiceDomains: string[],
): boolean {
  if (!email) return false;
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain) return false;
  return practiceDomains.some((d) => {
    const norm = d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    return norm === domain;
  });
}

/**
 * Pulls the city out of a free-form address string by scanning for a
 * "City TX 77380" / "City, TX" segment. Handles trailing ", USA" / suite
 * numbers / multi-word cities. Returns "" if nothing matches.
 *
 * Example: '10210 Grogans Mill Rd #145, The Woodlands TX 77380, USA'
 *       -> 'The Woodlands'
 */
function parseCity(addr: string): { city: string; state: string } {
  if (!addr) return { city: "", state: "" };
  const m = addr.match(/([A-Z][a-zA-Z\s.'-]+?),?\s+(TX|Texas)\b\s*(\d{5})?/);
  if (m && m[1]) {
    return { city: m[1].trim().replace(/\s+/g, " "), state: "TX" };
  }
  return { city: "", state: "" };
}

/**
 * Best-effort EN → ES translation for hero copy derived from a crawled
 * site's mission statement. Pattern-matches the common stems we see on
 * Texas counseling sites; for anything unmatched, returns a generic ES
 * fallback so the hero never displays English under the `es` locale.
 */
function translateHeroToEs(en: string, city: string, state: string): string {
  const src = en.trim();
  if (!src) return "";
  const cityState = [city, state].filter(Boolean).join(", ");

  const patterns: Array<[RegExp, string]> = [
    [
      /^If you need a licensed professional counselor in ([^,]+),\s*([A-Z]{2}|Texas),?\s*call.*/i,
      "Si necesitas un consejero profesional con licencia en $1, $2, llama.",
    ],
    [
      /^Depend on us for mental health care services.*/i,
      "Cuenta con nosotros para servicios de salud mental.",
    ],
    [
      /^Therapy that meets you where you are.*/i,
      "Terapia que te encuentra donde estás.",
    ],
    [
      /^(Welcome to|Welcome at)\s+(.+)/i,
      "Bienvenido a $2",
    ],
    [
      /^We (?:provide|offer)\s+(.+)/i,
      "Ofrecemos $1",
    ],
  ];

  for (const [re, rep] of patterns) {
    if (re.test(src)) return src.replace(re, rep);
  }

  return cityState
    ? `Servicios profesionales de salud mental en ${cityState}. Llama para una consulta confidencial.`
    : "Servicios profesionales de salud mental. Llama para una consulta confidencial.";
}

/**
 * Synthesize a plausible 2-3 sentence "starter bio" from the pieces of
 * prospect data we already have on the lead (firstName, city, state,
 * practice name, primary service, tagline). Used when the lead has no
 * crawled bio of their own — we'd otherwise fall through to the persona's
 * demo bio ("Hi, I'm Maya, I work with…"), which is the leak that started
 * this whole audit. The output is boutique-fancy per the editorial voice
 * rules: no jargon, no marketing-speak, present-tense first person.
 */
function synthesizeBio(args: {
  locale: "en" | "es";
  personName: string;
  city: string;
  state: string;
  practiceName: string;
  primaryService: string;
  tagline: string;
}): string {
  const { locale, personName, city, state, practiceName, primaryService, tagline } =
    args;
  const cityLine = city ? (state ? `${city}, ${state}` : city) : "";
  // Lowercase the primary service so it reads naturally inside the
  // sentence ("anxiety, life transitions…"). If the crawler returned a
  // verbose service name, cap it at ~50 chars so the line stays compact.
  const service = primaryService
    ? primaryService.toLowerCase().slice(0, 50).replace(/[.,;:!?]\s*$/, "")
    : "";

  if (locale === "es") {
    if (!personName) {
      // No human name available — third-person voice anchored on the
      // practice so we never write "Hola, soy Care" under a practice
      // that has no clinician on the roster.
      const subject = practiceName || "La consulta";
      const where = cityLine
        ? `${subject} ofrece servicios de terapia con licencia en ${cityLine}.`
        : `${subject} ofrece servicios de terapia con licencia.`;
      const work = service
        ? `La consulta acompaña a adultos en ${service} y en el trabajo más profundo del cambio personal.`
        : "La consulta acompaña a adultos en momentos de ansiedad, transiciones de vida y en el trabajo más profundo del cambio personal.";
      const tag = tagline?.trim() || "";
      return [where, work, tag].filter(Boolean).join(" ").trim();
    }
    const greeting = `Hola, soy ${personName}.`;
    const where =
      practiceName && cityLine
        ? `Atiendo en ${practiceName} en ${cityLine}.`
        : practiceName
          ? `Atiendo en ${practiceName}.`
          : cityLine
            ? `Atiendo en ${cityLine}.`
            : "";
    const work = service
      ? `Acompaño a adultos en ${service} y en el trabajo más profundo del cambio personal.`
      : "Acompaño a adultos en momentos de ansiedad, transiciones de vida y en el trabajo más profundo del cambio personal.";
    const tag = tagline?.trim() || "";
    return [greeting, where, work, tag].filter(Boolean).join(" ").trim();
  }

  if (!personName) {
    const subject = practiceName || "The practice";
    const where = cityLine
      ? `${subject} provides licensed therapy services in ${cityLine}.`
      : `${subject} provides licensed therapy services.`;
    const work = service
      ? `The practice works alongside adults navigating ${service} and the deeper work of personal change.`
      : "The practice works alongside adults navigating anxiety, life transitions, and the deeper work of personal change.";
    const tag = tagline?.trim() || "";
    return [where, work, tag].filter(Boolean).join(" ").trim();
  }

  const greeting = `Hi, I'm ${personName}.`;
  // When the practice name is the same as (or contains) the clinician's
  // first name, skip the "I see clients at X" phrase to avoid the awkward
  // "Hi, I'm Judy. I see clients at Judy Harun." pattern that arises when
  // the lead has no separate practice brand (V4 brand-junk fallback uses
  // the clinician's name as the practice fallback).
  const practiceIsClinicianName =
    practiceName.toLowerCase().includes(personName.toLowerCase());
  const where = practiceIsClinicianName
    ? cityLine
      ? `I see clients in ${cityLine}.`
      : ""
    : practiceName && cityLine
      ? `I see clients at ${practiceName} in ${cityLine}.`
      : practiceName
        ? `I see clients at ${practiceName}.`
        : cityLine
          ? `I see clients in ${cityLine}.`
          : "";
  const work = service
    ? `I work alongside adults navigating ${service} and the deeper work of personal change.`
    : "I work alongside adults navigating anxiety, life transitions, and the deeper work of personal change.";
  const tag = tagline?.trim() || "";
  return [greeting, where, work, tag].filter(Boolean).join(" ").trim();
}

/**
 * A1 (founder 2026-05-19): deterministic initials for the avatar
 * fallback. Strips honorifics + credentials, returns first letter of
 * first token + first letter of last token. Single-token names ->
 * first two letters. Always uppercase.
 *   "Emery Rodriguez"       -> "ER"
 *   "Dr. Thomas C. Johnson" -> "TJ"
 *   "G. Carrera, LPC"       -> "GC"
 *   "Madonna"               -> "MA"
 *   ""                      -> "?"
 */
export function deterministicInitials(fullName: string | null | undefined): string {
  if (!fullName) return "?";
  const cleaned = fullName
    .trim()
    .replace(/^(?:dr|dra|mr|mrs|ms|mx|prof|rev)\.?\s+/i, "")
    .replace(/,\s*[A-Z][A-Z\-]*(?:\s+[A-Z]+)?$/i, "");
  const tokens = cleaned
    .split(/[\s.]+/)
    .map((t) => t.replace(/[^A-Za-z\u2019\'-]/g, ""))
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return "?";
  if (tokens.length === 1) return tokens[0]!.slice(0, 2).toUpperCase();
  const first = tokens[0]!.charAt(0).toUpperCase();
  const last = tokens[tokens.length - 1]!.charAt(0).toUpperCase();
  return `${first}${last}`;
}

function firstSentence(text: string, cap: number): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  // A7 (founder 2026-05-19): never chop a headline mid-word. We first
  // look for a sentence terminator anywhere in the text — if the first
  // sentence is reasonably short (≤ 140 chars), we return it whole
  // even when it slightly overshoots `cap`. If no terminator is found,
  // we fall back to truncating at the last word boundary BEFORE `cap`
  // with a proper ellipsis, never mid-word.
  const HARD_CAP = 140;
  const sentenceMatch = trimmed.match(/^[^.!?\n]+[.!?]/);
  if (sentenceMatch) {
    const sentence = sentenceMatch[0].trim();
    // If the first complete sentence fits in HARD_CAP, prefer it whole.
    if (sentence.length <= HARD_CAP) return sentence;
    // Otherwise fall through to word-boundary truncation.
  }
  // No terminator (or sentence too long) — cap at min(cap, HARD_CAP).
  const limit = Math.min(cap, HARD_CAP);
  if (trimmed.length <= limit) return trimmed;
  const sliced = trimmed.slice(0, limit);
  const lastSpace = sliced.lastIndexOf(" ");
  const head = (lastSpace > 12 ? sliced.slice(0, lastSpace) : sliced).trim();
  // Trailing punctuation cleanup before the ellipsis.
  return head.replace(/[,;:\u00b7]+$/, "") + "\u2026";
}

/**
 * Drops reviews that look like they were mis-matched to the wrong
 * Google listing (apartment complex, leasing office, etc.) or that
 * are too short to be useful. Returning an empty array makes the
 * Reviews section hide itself (it null-renders on empty input).
 */
const JUNK_REVIEW_KEYWORDS = [
  "apartment",
  "maintenance staff",
  "leasing",
  "landlord",
  "tenant",
  // word-boundary "rent" so "current" / "different" don't trip it
  /\brent\b/i,
  /\bunit\b/i,
  "complex",
  /\bpool\b/i,
  /\bgym\b/i,
  "parking",
];

// Common first names that appear in reviews but rarely identify a
// different practitioner (admin staff, family members the reviewer
// mentions in passing). Tweaked from the Tier 1 audit so we don't
// flip valid reviews that simply name a partner / kid.
const REVIEW_NAME_ALLOWLIST = new Set([
  "thank", "thanks", "hello", "hi", "dear", "yes", "no", "ok",
  "google", "yelp", "facebook", "instagram",
]);

/** Tokenises a review body and returns the set of capitalised tokens
 *  that look like proper names (Title Case, 3+ chars, not at start of
 *  sentence so we don\'t false-positive every sentence opener). */
function reviewProperNames(body: string): string[] {
  if (!body) return [];
  // Split into rough sentences first so we can skip sentence-initial
  // capitalisation. Then capture multi-char Title-Case tokens.
  const out = new Set<string>();
  const sentences = body.split(/[.!?]+\s+/);
  for (const sentence of sentences) {
    const tokens = sentence.split(/\s+/);
    // Skip token #0 — it's the sentence opener, almost always Capitalised.
    for (let i = 1; i < tokens.length; i++) {
      const tok = tokens[i]!.replace(/[^A-Za-z'\u2019-]/g, "");
      if (tok.length < 3) continue;
      if (!/^[A-Z][a-z]+/.test(tok)) continue;
      const lower = tok.toLowerCase();
      if (REVIEW_NAME_ALLOWLIST.has(lower)) continue;
      out.add(tok);
    }
  }
  return Array.from(out);
}

/** A5 (founder 2026-05-19): drop reviews with rating < 4 and reviews
 *  that mention a Title-Case name that isn\'t the lead\'s. The lead\'s
 *  first + last names + full name + practice name all whitelist the
 *  review through. Admin override happens upstream (out of scope of
 *  this pure function). */
function filterReviewsForLead(
  reviews: Review[],
  leadName: string,
  practiceName: string,
): Review[] {
  const MIN_RATING = 4;
  const leadTokens = `${leadName} ${practiceName}`
    .split(/[^A-Za-z\u2019']+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 3);
  const leadSet = new Set(leadTokens);
  return reviews.filter((r) => {
    const body = (r.body ?? "").trim();
    if (body.length < 20) return false;
    // 1. Junk keywords (apartment / leasing etc.) — keep existing.
    const lower = body.toLowerCase();
    for (const kw of JUNK_REVIEW_KEYWORDS) {
      if (typeof kw === "string") {
        if (lower.includes(kw)) return false;
      } else if (kw.test(body)) {
        return false;
      }
    }
    // 2. Rating gate.
    if (typeof r.rating === "number" && r.rating < MIN_RATING) return false;
    // 3. Other-practitioner name gate.
    if (leadSet.size > 0) {
      const names = reviewProperNames(body);
      const foreign = names.filter((n) => !leadSet.has(n.toLowerCase()));
      // If we found foreign Title-Case names AND none of the lead tokens
      // appear in the body, the review almost certainly references a
      // different practitioner — drop it.
      const mentionsLead = names.some((n) => leadSet.has(n.toLowerCase()))
        || leadTokens.some((tok) => lower.includes(tok));
      if (foreign.length > 0 && !mentionsLead) return false;
    }
    return true;
  });
}

/** @deprecated kept as a thin alias so legacy call sites still work
 *  while we migrate the rest of the codebase. */
function filterJunkReviews(reviews: Review[]): Review[] {
  // No lead context available → only the junk-keywords + rating gates apply.
  return filterReviewsForLead(reviews, "", "");
}

interface ResolvePersonaArgs {
  content: TemplateContent;
}

export function resolvePersona(
  templateKey: string,
  props: ResolvePersonaArgs,
): ResolvedPersona {
  const persona = PERSONAS[templateKey] ?? PERSONAS.garden;
  const c = props.content;

  // ── Lead detection ────────────────────────────────────────────────
  // A real prospect record is *any* TemplateContent that isn't the
  // shared sample reference. Whether we also have a clinician roster
  // is a separate question (isPracticeOnly).
  const teamMember = c.team?.[0];
  const teamName = teamMember?.name?.trim() ?? "";
  const isReal = !isSampleContent(c);
  const isLead = isReal && teamName.length > 0;
  // "Practice only" = real prospect but no individual clinician in the
  // crawled team. Common for partnerships and PLLCs we have a website
  // crawl for but no Headway/PT roster. In this branch the practice
  // name + crawled mission + locations win over the persona, and the
  // template should NOT print persona-specific identity (license
  // number, persona email, persona portrait).
  const isPracticeOnly = isReal && teamName.length === 0;

  // ── Editorial fields ──
  // Name precedence: real clinician → practice name (when crawled) →
  // persona. We never display the persona name "Sam Castillo" /
  // "Joanna Reyes-Kim" / etc. under a real prospect's preview URL.
  const practiceName = (c.practiceName ?? "").trim();

  // Source-platform junk names. Care.com / Psychology Today scrapers
  // sometimes capture the brand H1 ("Care") as the practitioner name
  // instead of the real clinician. When the team[0].name is one of these
  // tokens, fall through to the bio extractor below — "About Care" under
  // a Plano family therapist is one of the worst-feeling preview bugs.
  // Brand tokens are compared after normalization (lowercase, non-alnum
  // stripped) so "Psychology Today", "psychology-today", "psychologytoday"
  // and "PSYCH TODAY" all collapse to the same key. Mirrors the
  // server-side blocklist in api-server/.../enrichment/brandBlocklist.ts.
  const JUNK_NAMES_NORMALIZED = new Set([
    "care", "carecom",
    "psychology", "psychologytoday", "psych", "psychtoday",
    "headway", "headwayco",
    "alma", "almacom",
    "growtherapy", "grow",
    "talkspace", "betterhelp",
    "zencare", "zencareco",
    "zocdoc", "healthgrades", "therapyden", "goodtherapy",
    "openpath", "openpathcollective", "inclusivetherapists", "monarch",
    "therapy", "counseling", "wellness",
    "about", "welcome", "home", "services", "contact",
    "team", "staff", "provider", "clinician", "therapist",
    "profile", "biography", "bio",
    // Junk brand / aggregator tokens that scrapers mis-cast as a name.
    // Added 2026-05-14 after the Curtesia/care.headway and Judy/PT
    // previews leaked "About Care" / "About Headlight" as H2.
    "headlight", "helloalma", "simplepractice", "theranest", "network",
    "mentalhealth", "mentalhealthcare", "thementalhealthnetwork",
  ]);
  const normalizeBrand = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const isJunkName = (n: string) => {
    const trimmed = n.trim();
    if (!trimmed) return true;
    return JUNK_NAMES_NORMALIZED.has(normalizeBrand(trimmed));
  };

  // Try to extract a real first name from a bio's opening "Hi, I'm X."
  // / "I am X," / "My name is X" / "Soy X" pattern. Used to recover
  // from junk-name leads where the H1 was "Care" but the bio body
  // clearly identifies the clinician.
  const extractNameFromBio = (text: string): string => {
    if (!text) return "";
    const patterns: RegExp[] = [
      /\bHi(?:,|\s)+I[''']?m\s+([A-Z][a-zA-Z'-]+)/,
      /\bI[''']?m\s+([A-Z][a-zA-Z'-]+)\s*[,.]/,
      /\bMy name is\s+([A-Z][a-zA-Z'-]+)/i,
      /\bHola(?:,|\s)+soy\s+([A-Z][a-zA-Z'-]+)/i,
      /\bMe llamo\s+([A-Z][a-zA-Z'-]+)/i,
      /\bMi nombre es\s+([A-Z][a-zA-Z'-]+)/i,
    ];
    for (const re of patterns) {
      const m = text.match(re);
      if (m && m[1] && !JUNK_NAMES_NORMALIZED.has(normalizeBrand(m[1]))) {
        return m[1];
      }
    }
    return "";
  };

  // Recovered name from the bio when the team H1 is junk. We check the
  // crawled mission AND the team member's bio (both EN and ES) — the
  // "Hi, I'm Joanna" pattern can live in either field depending on which
  // crawler populated it.
  const bioSources = [
    teamMember?.bio_en,
    teamMember?.bio_es,
    teamMember?.bio,
    c.mission,
  ].filter((s): s is string => typeof s === "string" && s.length > 0);
  let recoveredFirstName = "";
  for (const src of bioSources) {
    recoveredFirstName = extractNameFromBio(src);
    if (recoveredFirstName) break;
  }

  // If teamName is junk AND we recovered a real first name from the bio,
  // promote the recovered name. We use just the first name (we don't
  // know the surname) — better "About Joanna" than "About Care".
  const teamNameIsJunk = isJunkName(teamName);
  const practiceNameIsJunk = isJunkName(practiceName);
  const recoveredOverride = (teamNameIsJunk || (isPracticeOnly && practiceNameIsJunk))
    && recoveredFirstName
    ? recoveredFirstName
    : "";

  // Suppress a junk teamName even when bio-recovery failed. Better to
  // fall through to the practice name (or the persona stub on showcase
  // surfaces) than to render "About Care" / "Hi I'm Headway".
  const safeTeamName = isLead && teamName && !teamNameIsJunk ? teamName : "";
  const safePracticeName = practiceName && !practiceNameIsJunk ? practiceName : "";
  // For ANY real prospect (lead OR practice-only), we must NEVER fall
  // through to `persona.name` — that's what produced the
  // "© 2026 Joanna Reyes-Kim, LMFT" footer + "About Care / Joanna
  // Reyes-Kim" pairing on Curtesia's care.headway preview (2026-05-14
  // audit). When all sanitized names are empty, prefer the raw
  // practiceName / teamName (even if junk) over the demo persona —
  // "About Care" is ugly but at least it's the prospect's own scraped
  // brand, not a stranger's identity stamped under their preview.
  const name = recoveredOverride
    ? recoveredOverride
    : safeTeamName
      ? safeTeamName
      : isReal && safePracticeName
        ? safePracticeName
        : isReal
          ? (practiceName.trim() || teamName.trim() || "")
          : persona.name;
  // Practice-only previews don't have a clinician credential to honestly
  // attach; suppress it rather than fabricate one from the persona stub.
  const credentials =
    isLead && teamMember?.credentials?.trim()
      ? teamMember.credentials.trim()
      : isPracticeOnly
        ? ""
        : persona.credentials;
  // Practice-only: skip the persona portrait under a real prospect —
  // better to render whatever heroImage was crawled (often a logo or
  // office shot) than the demo-person headshot. About primitive treats
  // an empty string as "no photo" and lays out without it.
  const portraitSrc = isLead && teamMember?.photo
    ? teamMember.photo
    : isPracticeOnly
      ? (c.heroImage || "")
      : (persona.photo_url || c.heroImage || "");

  // Bio: prefer locale-specific lead fields (`bio_en` / `bio_es`) when
  // the prospect-portal flow has them; fall back to the deprecated
  // locale-less `bio` alias. For real prospects (lead OR practice-only)
  // use the crawled `mission` copy when present. The persona stub
  // ("Hi, I'm Maya…") is ONLY used as a final fallback on showcase /
  // gallery surfaces where there's no real prospect — for any real
  // lead we synthesize a clean starter bio below from firstName + city
  // + practice instead. Mixing in the persona stub was how Maya leaked
  // into prospect previews when their own bio hadn't been crawled.
  const leadBioEn = isLead ? (teamMember?.bio_en?.trim() || teamMember?.bio?.trim() || "") : "";
  const leadBioEs = isLead ? (teamMember?.bio_es?.trim() || teamMember?.bio?.trim() || "") : "";
  const crawledMission = isReal ? (c.mission ?? "").trim() : "";
  let bio_en = leadBioEn || crawledMission || (isReal ? "" : persona.bio_en);
  let bio_es = leadBioEs || crawledMission || (isReal ? "" : persona.bio_es);

  // Focus areas: lead's `services` (name + description) maps onto
  // persona's `focus_areas` (title + body). Real prospects (including
  // practice-only) win when their services array is non-empty.
  // Fix #78 (audit 2026-05-18): never fall back to persona.focus_areas
  // (Sunrise/Riya postpartum sample) for real prospects. When a real lead
  // has no structured services but has specialties in their snapshot,
  // derive 3 focus areas from those. When neither is available, return
  // an empty array rather than leak persona content.
  const leadServices = isReal ? c.services ?? [] : [];
  const leadSpecialties = isReal
    ? ((c as unknown as { specialties?: string[] }).specialties ?? [])
    : [];
  let focus_areas: FocusArea[];
  if (leadServices.length > 0) {
    focus_areas = leadServices.map((s) => ({ title: s.name, body: s.description }));
  } else if (isReal && leadSpecialties.length >= 3) {
    focus_areas = leadSpecialties.slice(0, 3).map((sp) => ({
      title: sp,
      body: `Specialised support for ${sp.toLowerCase()} - in person and online across Texas.`,
    }));
  } else if (isReal) {
    focus_areas = [];
  } else {
    focus_areas = persona.focus_areas;
  }

  // Fees: real prospects carry `pricingTiers` cast onto the content
  // object by the previewContent layer. When non-empty, prefer it.
  const leadFees = isReal
    ? ((c as unknown as {
        pricingTiers?: { amount: number | null; label: string }[];
      }).pricingTiers ?? [])
    : [];
  const fees: FeeLine[] = leadFees.length > 0
    ? leadFees.map((t) => ({
        label: t.label,
        price: t.amount != null ? `$${t.amount}` : "Free",
      }))
    : persona.fees;

  // A4 (founder 2026-05-19): for real leads, NEVER fall back on the
  // persona's sample carrier list — that's how Tracy ended up with a
  // hallucinated Cigna, Ashley with TriCare she doesn't accept, Monica
  // with BCBS Texas she doesn't accept, Luis with two invented carriers.
  // When the carrier list is empty we surface a single neutral bilingual
  // chip instead. Sample persona insurance is reserved for the showcase
  // (isReal === false) only.
  const INSURANCE_NEUTRAL = "Call to confirm coverage \u00b7 Llamar para confirmar";
  let insuranceList: string[];
  if (isReal) {
    insuranceList = c.insurance && c.insurance.length > 0
      ? c.insurance
      : [INSURANCE_NEUTRAL];
  } else {
    insuranceList = c.insurance && c.insurance.length > 0
      ? c.insurance
      : persona.insurance;
  }

  // ── Portal-derived fields (always taken from props.content when present) ──
  const bookingUrl =
    (c as { bookingWidget?: { url: string } | null }).bookingWidget?.url
    ?? persona.booking_url;

  const phone = c.contact?.phone ?? "";
  const phoneHref = phone ? `tel:${phone.replace(/[^0-9+]/g, "")}` : "";
  const rawEmail = c.contact?.email ?? "";
  // For practice-only previews, hide emails that aren't on the practice's
  // own domain — gmail/yahoo addresses scraped from a "contact us" page
  // are usually the rep's intake address, not something the public should
  // see in a preview. The candidate domains come from the portal's
  // "Your free domain" suggestions.
  const domainSuggestions = (c as unknown as {
    domainSuggestions?: { domain: string; available: boolean }[];
  }).domainSuggestions ?? [];
  const candidateDomains = domainSuggestions.map((d) => d.domain);
  const email = isPracticeOnly && rawEmail && !isPracticeEmail(rawEmail, candidateDomains)
    ? ""
    : rawEmail;

  const loc = c.locations?.[0];
  const addr = loc?.address ?? "";
  const segs = addr.split(",").map((s) => s.trim()).filter(Boolean);
  let addressLine1 = "";
  let addressLine2 = "";
  if (segs.length >= 4) {
    addressLine1 = segs.slice(0, -2).join(", ");
    addressLine2 = segs.slice(-2).join(", ");
  } else if (segs.length === 3) {
    addressLine1 = segs.slice(0, -1).join(", ");
    addressLine2 = segs[segs.length - 1] ?? "";
  } else if (segs.length === 2) {
    addressLine1 = segs[0] ?? "";
    addressLine2 = segs[1] ?? "";
  } else if (addr) {
    addressLine1 = addr;
  } else if (!isReal) {
    addressLine1 = `${persona.city}, ${persona.state}`;
  }
  // For real prospects with no address segments, leave the lines
  // blank rather than seeding the persona's city. The Footer
  // primitive already null-renders an empty address line.

  // City / state: pull from the parsed address segments when available
  // (last `, STATE ZIP` segment yields the state code; the segment
  // before it is typically the city). For real prospects we never fall
  // through to the persona's city — "Austin, TX" stamped under a
  // Conroe practice was one of the worst-feeling preview bugs.
  let city = persona.city;
  let state = persona.state;
  if (isReal) {
    const parsed = parseCity(addr);
    if (parsed.city) {
      city = parsed.city;
      state = parsed.state;
    } else if (segs.length >= 2) {
      const tailSeg = segs[segs.length - 1] ?? "";
      const cityCandidate = segs[segs.length - 2] ?? "";
      const stateZipMatch = tailSeg.match(/^([A-Z]{2})(?:\s+\d{5})?$/i);
      if (stateZipMatch) {
        state = stateZipMatch[1]!.toUpperCase();
        if (cityCandidate) city = cityCandidate;
      }
    }
    if (!segs.length && !parsed.city) {
      city = "";
      state = "";
    }
  }

  // ── Practice-only hero copy override ──────────────────────────────
  // When we have no clinician record but a real practice mission, derive
  // hero copy from the crawled site instead of letting the persona's
  // demo strings ("Executive Therapy Houston…") show through. EN+ES use
  // the same source text (we don't translate mission copy); the locale
  // shape exists so templates can wire this through their existing
  // useI18n() locale plumbing without branching.
  // Filter junk mission patterns scraped from aggregator template
  // pages — e.g. Psychology Today's "Looking to contact X regarding
  // one of the many mental health services" boilerplate. These were
  // captured as the lead's mission and then fed into the hero
  // headline, producing nonsense H1s on Judy/PT. When the mission
  // matches a known junk pattern, blank it so the hero falls back
  // to the generic "Therapy that meets you where you are." copy.
  const JUNK_MISSION_PATTERNS: RegExp[] = [
    /^Looking to contact .+? regarding/i,
    /^Contact us\b.+?services/i,
    /^Find a therapist/i,
    /^Search results/i,
    /^Welcome to (Care|Headway|Alma|Headlight|Psychology Today|Grow Therapy)\b/i,
    /\bShow more\b.*\bproviders\b/i,
    /\b\d{1,3}(,\d{3})+\s+more\s+providers\b/i,
    /\bTake a (short |quick )?quiz\b/i,
    /\bfind (a |your )?therapist (today|now)\b/i,
    /\bbrowse (our |all )?therapists?\b/i,
    /\b(view|see) all (therapists?|providers?|professionals?)\b/i,
    // 2026-05-20: aggregator <meta description> dumps (Psychology Today,
    // Headway, care.headway). They start "<Name>, <Title>, <City>, TX,
    // <ZIP>, (<area>) <num>-<num>, <bio>…" — using that as a mission
    // produced monster H1s like "Cynthia Los De Los Santos, Marriage &
    // Family Therapist, Houston, TX, 77002, (346) 409-7761, Hello!".
    // Any mission that contains a US phone number or "ST ZIP" pattern is
    // structurally not a mission statement; blanket it as junk and let
    // the hero fall back to the safe default headline.
    /\(\d{3}\)\s*\d{3}-\d{4}/,
    /\b[A-Z]{2},?\s+\d{5}(-\d{4})?\b/,
  ];
  const rawMission = (c.mission ?? "").trim();
  const missionIsJunk = JUNK_MISSION_PATTERNS.some((re) => re.test(rawMission));
  const cleanMission = missionIsJunk ? "" : rawMission;
  if (missionIsJunk && bio_en === rawMission) bio_en = "";
  if (missionIsJunk && bio_es === rawMission) bio_es = "";

  // Hero override for ALL real prospects (lead OR practice-only).
  // Previously this only fired for isPracticeOnly, which left leads
  // with a clinician roster falling through to strings.ts hero copy —
  // and those strings hard-code persona cities ("...in Plano",
  // "...DALLAS · TELEHEALTH IN TEXAS"). Yulonda's preview (Killeen)
  // was showing "FAMILY & TRAUMA-INFORMED THERAPY · PLANO" in the
  // hero eyebrow before this fix. Synthesizing the eyebrow + headline
  // + subhead from the lead's own crawled city / mission ensures real
  // leads never display another therapist's city. Updated 2026-05-14.
  let heroEyebrow: { en: string; es: string } | null = null;
  let heroHeadline: { en: string; es: string } | null = null;
  let heroSubhead: { en: string; es: string } | null = null;
  if (isReal) {
    // A6 (founder 2026-05-19): Cynthia's eyebrow rendered 17 PT
    // categories concatenated ("ANXIETY, AUTISM, BEHAVIORAL ISSUES, …,
    // OTHER, …, WOMEN\u2019S ISSUES \u00b7 HOUSTON"). The root cause is
    // services[0].name occasionally holding a CSV blob from a malformed
    // scrape. Pick the top-1 specialty, drop the "Other" generic
    // bucket, then cap the full eyebrow at 60 chars.
    const rawPrimary = (c.services?.[0]?.name ?? "").trim();
    const splitCandidates = rawPrimary
      .split(/[,;\u2022\u00b7|]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !/^other$/i.test(s));
    const primaryService = (splitCandidates[0] ?? rawPrimary).trim();
    const eyebrowCity = city || (segs.length >= 2
      ? (segs[segs.length - 2] ?? "").trim()
      : "") || "Texas";
    const capEyebrow = (eb: string, max = 60): string => {
      if (eb.length <= max) return eb;
      const sliced = eb.slice(0, max);
      const lastSpace = sliced.lastIndexOf(" ");
      const trimmed = (lastSpace > 12 ? sliced.slice(0, lastSpace) : sliced).trim();
      return `${trimmed}\u2026`;
    };
    const eyebrowEn = primaryService
      ? `${primaryService} \u00b7 ${eyebrowCity}`
      : `Therapy \u00b7 ${eyebrowCity}`;
    const eyebrowEs = primaryService
      ? `${primaryService} \u00b7 ${eyebrowCity}`
      : `Terapia \u00b7 ${eyebrowCity}`;
    heroEyebrow = {
      en: capEyebrow(eyebrowEn).toUpperCase(),
      es: capEyebrow(eyebrowEs).toUpperCase(),
    };

    // A7 (founder 2026-05-19): the rep-authored override
    // `customizations.headline` (persisted via PortalCustomizations Zod
    // schema) wins over the mission-derived headline. ProspectPortal
    // copies it onto `content.headlineOverride` before render so we
    // don\'t need to thread a new prop through every template.
    const headlineOverride = (
      (c as unknown as { headlineOverride?: string | null }).headlineOverride ?? ""
    ).trim();
    const missionFirst = firstSentence(cleanMission, 80);
    const baseEn = headlineOverride || missionFirst;
    const headlineEn = baseEn || "Therapy that meets you where you are.";
    const headlineEs = headlineOverride
      ? translateHeroToEs(headlineOverride, city, state)
      : (missionFirst
        ? translateHeroToEs(missionFirst, city, state)
        : "Terapia que te encuentra donde est\u00e1s.");
    heroHeadline = { en: headlineEn, es: headlineEs };

    const subText = cleanMission || (c.tagline ?? "").trim();
    if (subText) {
      heroSubhead = {
        en: subText,
        es: translateHeroToEs(subText, city, state),
      };
    }
  }

  // License number is a clinician-level credential. The lead schema
  // doesn't carry license_number on TeamMember, and printing the persona's
  // stub ("TX LMFT 12345") under a real prospect's footer leaks demo data.
  // Suppress for any real prospect (lead OR practice-only); only show for
  // the persona-driven gallery / showcase route.
  const license_number = isReal ? "" : persona.license_number;

  // First-name token. Strip a leading honorific (Dr./Dra./Mr./Ms./Mrs.)
  // before splitting so "Dr. Helena Sun-Reyes" → "Helena", not "Dr.".
  // Split on whitespace AND commas so "Maya Alvarado, LCSW" → "Maya"
  // (lead names with credential suffixes are common). Practice-only
  // falls back to the first word of the practice name — "About Serenity"
  // beats "About Maya" when the lead is a practice with no clinician.
  const stripHonorific = (n: string) =>
    n.replace(/^(Dr\.?|Dra\.?|Mr\.?|Ms\.?|Mrs\.?)\s+/i, "");
  let firstName = recoveredOverride
    ? recoveredOverride
    : isPracticeOnly
      ? (stripHonorific(practiceName).split(/[\s,]+/)[0] ?? "")
      : (stripHonorific(name).split(/[\s,]+/)[0] ?? name);
  // Final safety net: if the resolved firstName itself is junk
  // ("Care", "Therapy"...) and we have a recovered name, use that.
  if (isJunkName(firstName) && recoveredFirstName) {
    firstName = recoveredFirstName;
  }
  // 2026-05-14 V3: if firstName STILL resolves to a junk brand token
  // ("Care", "Headlight", "Headway"...), blank it out. Templates that
  // interpolate "About {firstName}" / "Meet {firstName}" must fall
  // back to a generic phrase when this is empty (see each template's
  // `fn` helper). Without this guard, Curtesia/care.headway rendered
  // "About Care" as the H2 and Judy/PT rendered "About Headlight".
  if (isJunkName(firstName)) {
    firstName = "";
  }

  // Synthesize a starter bio when a real lead has no own crawled bio
  // (and no practice mission either). Without this we'd fall through to
  // the persona stub ("Hi, I'm Maya, I help adults navigating…"), which
  // is how Maya leaked into Zach's preview. We weave together the
  // pieces we DO know — firstName, city/state, practiceName, primary
  // service, tagline — into one coherent paragraph. EN + ES separately
  // so the locale toggle never falls back to the wrong language.
  // Person-name token for the bio greeter. Distinct from `firstName`
  // above — that one falls back to the practice name's first word so
  // chrome strings like "About {firstName}" render as "About Serenity"
  // for practice-only previews. The bio greeter has stricter rules:
  // it must be a real human first name, otherwise we rewrite the bio
  // in third-person rather than say "Hi, I'm Care" under a practice
  // whose H1 was "Care.com".
  //
  // Priority:
  //   (a) team[0].name (when present and not junk)
  //   (b) recoveredFirstName parsed from a "Hi, I'm X" bio opener
  //   (c) "" → triggers third-person voice in synthesizeBio
  const personFirstName = (() => {
    if (isLead && teamName && !teamNameIsJunk) {
      return stripHonorific(teamName).split(/[\s,]+/)[0] ?? "";
    }
    return recoveredFirstName;
  })();

  if (isReal && !bio_en) {
    bio_en = synthesizeBio({
      locale: "en",
      personName: personFirstName,
      city,
      state,
      practiceName,
      primaryService: c.services?.[0]?.name ?? "",
      tagline: c.tagline ?? "",
    });
  }
  if (isReal && !bio_es) {
    bio_es = synthesizeBio({
      locale: "es",
      personName: personFirstName,
      city,
      state,
      practiceName,
      primaryService: c.services?.[0]?.name ?? "",
      tagline: c.tagline ?? "",
    });
  }

  // Booking URL: persona stubs ("https://cal.com/joanna-reyes-kim/15min")
  // are wrong for any real practice. If we don't have a real bookingWidget
  // url for the prospect, fall back to "#" so templates render the CTA
  // but it doesn't open the persona's fake cal.com page.
  const resolvedBookingUrl = isReal && bookingUrl === persona.booking_url
    ? "#"
    : bookingUrl;

  // For any real prospect (lead OR practice-only) suppress persona
  // fields that hard-code the demo therapist's identity. Persona
  // testimonials quote "Joanna helped us…" / "Maya is the first
  // therapist…" by name; office_tour captions are written in the
  // persona's voice; photo_alt names the persona; modalities and
  // populations are the persona's clinical profile. None of these are
  // honest under a real prospect's preview, and the section primitives
  // null-render on empty input.
  const safeTestimonials = isReal ? undefined : persona.testimonials;
  const safeOfficeTour = isReal ? undefined : persona.office_tour;
  const safePhotoAlt = isReal ? undefined : persona.photo_alt;
  const safeModalities = isReal ? [] : persona.modalities;
  const safePopulations = isReal ? [] : persona.populations;

  // 2026-05-14 audit: defense-by-origin instead of defense-by-filter.
  // For real prospects we build the output from an empty base and only
  // copy in fields that came from the prospect record (or are explicitly
  // synthesized above). The persona object is consulted ONLY when this
  // is not a real prospect (showcase / gallery routes).
  const base: PersonaProfile = isReal
    ? {
        name: "",
        credentials: "",
        city: "",
        state: "",
        modalities: [],
        populations: [],
        focus_areas: [],
        fees: [],
        insurance: [],
        telehealth: false,
        bio_en: "",
        bio_es: "",
        photo_url: "",
        booking_url: "",
        license_number: "",
        photo_alt: undefined,
        testimonials: undefined,
        office_tour: undefined,
      }
    : persona;

  return {
    ...base,
    name,
    credentials,
    city,
    state,
    bio_en,
    bio_es,
    focus_areas,
    fees,
    insurance: insuranceList,
    license_number,
    modalities: safeModalities,
    populations: safePopulations,
    testimonials: safeTestimonials,
    office_tour: safeOfficeTour,
    photo_alt: safePhotoAlt,
    bookingUrl: resolvedBookingUrl,
    portraitSrc,
    practitionerInitials: deterministicInitials(name),
    phone,
    phoneHref,
    email,
    addressLine1,
    addressLine2,
    reviews: filterReviewsForLead(c.reviews ?? [], name, practiceName),
    insuranceList,
    contact: c.contact,
    isLead,
    isReal,
    isPracticeOnly,
    heroEyebrow,
    heroHeadline,
    heroSubhead,
    firstName,
  };
}
