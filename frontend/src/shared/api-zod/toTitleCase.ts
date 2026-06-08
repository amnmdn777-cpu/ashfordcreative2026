// Title-case practice names without splitting mid-word.
//
// The previous inline implementation in artifacts/api-server/src/scripts/importLeads.ts
// used `(?<=\w)the(?=\w)` etc. to break apart mashed domain stems like
// `growtherapy` → `grow therapy`. That regex also matched the `the` *inside*
// `therapy`, producing `grow the rapy` → `Grow The Rapy`. ~50 leads in prod
// have this corruption (`The Rapy`, `And Counseling`, `Psycho The Rapy`).
//
// `splitPracticeStem` rebuilds a domain stem into separated words using a
// single-pass alternation regex sorted longest-first, so each character is
// consumed by at most one keyword and the `therapy` substring is taken as a
// whole before `the` ever gets a chance to match.
//
// `toTitleCase` then capitalizes word by word, keeping interior small words
// lowercase ("Outside the Box"), uppercasing all-consonant short tokens as
// acronyms ("BWBH"), and uppercasing single letters in dotted initialisms
// ("W.A.Y.S").

// Sorted longest-first so JS alternation prefers `psychotherapy` over `therapy`.
// `the`/`and` are deliberately omitted — they appear as substrings inside
// legitimate words (`therapy` contains `the`, `heatherfry` contains `the`,
// `andrea` contains `and`) and were the source of the "The Rapy" corruption.
// Trade-off: we lose the ability to split mashed `xandcounseling` into
// `x and counseling`, but we never re-corrupt a real word.
const PRACTICE_KEYWORDS = [
  "psychotherapy",
  "counseling",
  "psychology",
  "psychiatry",
  "associates",
  "behavioral",
  "consulting",
  "wellness",
  "therapy",
  "services",
  "couples",
  "centre",
  "center",
  "family",
  "health",
  "mental",
  "clinic",
  "group",
] as const;

const KEYWORD_RE = new RegExp(`(${PRACTICE_KEYWORDS.join("|")})`, "g");

const SMALL_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "in",
  "on",
  "at",
  "by",
  "for",
  "to",
  "with",
]);

const VOWEL_RE = /[aeiouy]/i;

export function splitPracticeStem(stem: string): string {
  return stem
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(KEYWORD_RE, " $1 ")
    .replace(/\s+/g, " ")
    .trim();
}

function casePart(part: string, isFirst: boolean): string {
  if (!part) return part;
  // Preserve runs of 2+ uppercase letters as-is (BWBH, W.A.Y.S already cased).
  if (/[A-Z]{2,}/.test(part)) return part;

  const lower = part.toLowerCase();

  // Dotted initialism: every letter-segment between dots is a single char.
  if (lower.includes(".")) {
    const segs = lower.split(".");
    if (segs.every((s) => s.length <= 1)) {
      return segs.map((s) => s.toUpperCase()).join(".");
    }
  }

  // No-vowel short token → acronym (bwbh → BWBH, ny → NY).
  const letters = lower.replace(/[^a-z]/g, "");
  if (letters.length >= 2 && letters.length <= 5 && !VOWEL_RE.test(letters)) {
    return part.toUpperCase();
  }

  if (!isFirst && SMALL_WORDS.has(lower)) return lower;

  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function toTitleCase(input: string): string {
  if (!input) return input;
  const tokens = input.split(/(\s+)/); // keep whitespace runs
  let wordIdx = 0;
  return tokens
    .map((tok) => {
      if (/^\s+$/.test(tok)) return tok;
      const cased = casePart(tok, wordIdx === 0);
      wordIdx += 1;
      return cased;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}
