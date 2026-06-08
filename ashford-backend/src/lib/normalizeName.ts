/**
 * Person-name normalization for messy lead imports.
 *
 * Real-world bug that motivated this util: lead 573 landed in the DB
 * as "Cynthia Los De Los Santos" — the surname "De Los Santos" had a
 * stray "Los" prepended (Headway / Psychology Today scrape glitch),
 * which then propagated into the prospect portal hero ("Meet Cynthia
 * Los De Los"). The fix needs to be sustainable, not a manual UPDATE,
 * because the underlying scrape will keep producing similar artefacts.
 *
 * Two patterns are collapsed:
 *
 *  1. Adjacent identical tokens: "John John Smith" → "John Smith".
 *  2. Connector-loop duplicates: when the SAME connector ("Los", "De",
 *     "La", "Del", "Da", "Di", "Du", "Van", "Von", "Den") appears at
 *     position i and again at position j > i, AND every token between
 *     them is also a connector, drop position i. This turns
 *     "Cynthia Los De Los Santos" → "Cynthia De Los Santos" without
 *     touching legitimate names like "Maria De La Cruz".
 *
 * The function is idempotent (running twice yields the same result),
 * preserves original casing on retained tokens, and is conservative —
 * tokens that aren't recognised connectors are never reordered or
 * dropped. Used at lead-import sites AND inside `sanitizeLeadForRep`
 * so even pre-existing rows render cleanly without a destructive
 * backfill (the standalone backfill script under
 * `scripts/backfill-lead-names.ts` is opt-in for ops cleanup).
 */

const CONNECTORS = new Set([
  // Spanish
  "de",
  "del",
  "la",
  "las",
  "los",
  "y",
  // Portuguese / Italian
  "da",
  "das",
  "do",
  "dos",
  "di",
  "du",
  // Dutch / German
  "van",
  "von",
  "der",
  "den",
  "ter",
  "te",
]);

const isConnector = (tok: string) => CONNECTORS.has(tok.toLowerCase());

export function normalizePersonName(input: string | null | undefined): string {
  if (!input) return "";
  // Collapse internal whitespace first; trim ends.
  const tokens = input
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((t) => t.length > 0);
  if (tokens.length <= 1) return tokens.join(" ");

  // Pass 1: drop adjacent duplicates (case-insensitive).
  const dedupAdjacent: string[] = [];
  for (const t of tokens) {
    const prev = dedupAdjacent[dedupAdjacent.length - 1];
    if (prev && prev.toLowerCase() === t.toLowerCase()) continue;
    dedupAdjacent.push(t);
  }

  // Pass 2: connector-loop collapse.
  // Walk left-to-right; whenever the current token is a connector that
  // re-appears later with only connectors between, drop the current
  // token (we keep the *later* occurrence because it's the real start
  // of the compound surname). Repeat until stable.
  const collapseLoop = (arr: string[]): string[] => {
    for (let i = 0; i < arr.length; i++) {
      const ti = arr[i].toLowerCase();
      if (!isConnector(ti)) continue;
      for (let j = i + 1; j < arr.length; j++) {
        const tj = arr[j].toLowerCase();
        if (tj === ti) {
          // Check tokens between are all connectors.
          let allConnectors = true;
          for (let k = i + 1; k < j; k++) {
            if (!isConnector(arr[k])) {
              allConnectors = false;
              break;
            }
          }
          if (allConnectors) {
            const next = [...arr.slice(0, i), ...arr.slice(i + 1)];
            return collapseLoop(next);
          }
          break;
        }
        if (!isConnector(arr[j])) break;
      }
    }
    return arr;
  };

  return collapseLoop(dedupAdjacent).join(" ");
}
