import { env } from "../../lib/env";
import { logger } from "../../lib/logger";
import type { Candidate, EnrichmentSource, LeadInput } from "./types";

/**
 * Texas Behavioral Health Executive Council (BHEC) license verification.
 *
 * BHEC is the umbrella regulator for Texas LPC, LMFT, LCSW, and Psychologist
 * licenses. Their public verification portal lets anyone look up a clinician
 * by name and returns: license number, license type, status (Active /
 * Expired / Suspended / Probation), original issue date, and expiration
 * date. This is the most authoritative credibility signal we can give a
 * rep — "license active and in good standing" beats every directory
 * listing combined.
 *
 * Approach: there is no public BHEC JSON API. We POST to their search
 * endpoint via ScraperAPI (when a key is configured, for anti-bot bypass)
 * or directly otherwise, and parse the result table with regex. Soft-fails
 * to null on any error so the rest of the enrichment run is unaffected.
 *
 * Lead state filter: this source only runs for Texas leads. Other states
 * have their own boards (CA BBS, NY OPD, …) that would need separate
 * adapters; rather than calling BHEC for a non-TX lead and getting a
 * guaranteed empty result, we short-circuit to null.
 *
 * Verification portal: https://vo.licensing.hpc.texas.gov/datamart/searchByName.do
 */
const BHEC_SEARCH_URL =
  "https://vo.licensing.hpc.texas.gov/datamart/searchByName.do";
const USER_AGENT =
  "Mozilla/5.0 (compatible; AshfordEnrichmentBot/1.0; +https://ashford.co)";

export interface BhecLicense {
  /** Raw license number as printed on the verification page. */
  licenseNumber: string;
  /** Profession / license type (e.g. "Licensed Professional Counselor"). */
  licenseType: string | null;
  /** Status string verbatim from BHEC ("Active", "Expired", …). */
  status: string | null;
  /** Original issue date if present. ISO date string when parseable. */
  issuedDate: string | null;
  /** Expiration date if present. ISO date string when parseable. */
  expirationDate: string | null;
  /** Full name as listed on the license. */
  fullName: string | null;
}

class TexasBhecSource implements EnrichmentSource {
  readonly key = "texas_bhec";
  readonly label = "Texas BHEC license verification";

  isConfigured(): boolean {
    // Public registry — always configured. ScraperAPI just makes us more
    // reliable when BHEC fronts the form with a JS challenge.
    return true;
  }

  async fetch(lead: LeadInput): Promise<Candidate | null> {
    if (lead.state.toUpperCase() !== "TX") return null;
    const parts = lead.name.trim().split(/\s+/);
    const first = parts[0] ?? "";
    const last = parts[parts.length - 1] ?? "";
    if (!first || !last || first === last) return null;
    try {
      const formBody = new URLSearchParams({
        currentPageNumber: "1",
        firstName: first,
        lastName: last,
        // BHEC accepts an empty profession to mean "all".
        profession: "",
        licStatus: "",
        npiNumber: "",
        licenseNumber: "",
        // Two-letter state filter, BHEC ignores when blank.
        state: "TX",
      }).toString();

      const target = env.scraperapiKey
        ? `https://api.scraperapi.com/?api_key=${encodeURIComponent(
            env.scraperapiKey,
          )}&url=${encodeURIComponent(BHEC_SEARCH_URL)}&render=false&method=post&body=${encodeURIComponent(
            formBody,
          )}`
        : BHEC_SEARCH_URL;

      const init: RequestInit = env.scraperapiKey
        ? {
            method: "GET",
            signal: AbortSignal.timeout(20_000),
          }
        : {
            method: "POST",
            headers: {
              "user-agent": USER_AGENT,
              "content-type": "application/x-www-form-urlencoded",
              accept: "text/html",
            },
            body: formBody,
            signal: AbortSignal.timeout(20_000),
          };

      const res = await fetch(target, init);
      if (!res.ok) return null;
      const html = await res.text();
      const licenses = parseBhecResults(html);
      const matched = licenses.filter((l) =>
        nameMatches(l.fullName, first, last),
      );
      const chosen = matched.length > 0 ? matched : licenses.slice(0, 3);
      if (chosen.length === 0) return null;
      const top = chosen[0];
      const summaryParts: string[] = [];
      summaryParts.push(
        `BHEC ${top.licenseNumber}${top.status ? ` — ${top.status}` : ""}`,
      );
      if (top.licenseType) summaryParts.push(top.licenseType);
      if (top.expirationDate) summaryParts.push(`expires ${top.expirationDate}`);
      const activeCount = chosen.filter(
        (l) => (l.status ?? "").toLowerCase().includes("active"),
      ).length;
      return {
        confidence: matched.length === 1 ? 90 : matched.length > 0 ? 70 : 40,
        summary: summaryParts.join(" · "),
        payload: {
          state: "TX",
          totalMatches: licenses.length,
          nameMatches: matched.length,
          activeLicenses: activeCount,
          licenses: chosen,
        },
      };
    } catch (err) {
      logger.warn({ err, leadId: lead.id }, "texas_bhec enrichment failed");
      return null;
    }
  }
}

export const texasBhecSource = new TexasBhecSource();

// ---------------------------------------------------------------------------
// HTML parsing helpers
// ---------------------------------------------------------------------------

const stripTags = (s: string): string =>
  s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const decodeEntities = (s: string): string =>
  s
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();

/**
 * Parse the BHEC results table. The portal renders one `<tr>` per license
 * with cells in a stable order: Name, License #, License Type, Status,
 * Issued, Expires. Best-effort — when the markup shifts we degrade to an
 * empty list rather than throw.
 */
export const parseBhecResults = (html: string): BhecLicense[] => {
  const out: BhecLicense[] = [];
  // Find the results table by its caption/id. Falls back to any table whose
  // header row mentions "License Number".
  const tableMatch =
    html.match(
      /<table[^>]*id=["']?(?:results|searchResults)["']?[^>]*>([\s\S]*?)<\/table>/i,
    ) ??
    html.match(
      /<table[\s\S]*?<th[^>]*>\s*License\s+Number\s*<\/th>([\s\S]*?)<\/table>/i,
    );
  if (!tableMatch) return out;
  const tbody = tableMatch[1] ?? "";
  const rows = Array.from(tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi));
  for (const row of rows) {
    const cells = Array.from(
      row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi),
    ).map((m) => decodeEntities(stripTags(m[1])));
    if (cells.length < 4) continue;
    // Skip header rows (cells contain literal column titles).
    if (/license\s*number/i.test(cells.join(" "))) continue;
    const [name, licenseNumber, licenseType, status, issued, expires] = [
      cells[0] ?? "",
      cells[1] ?? "",
      cells[2] ?? "",
      cells[3] ?? "",
      cells[4] ?? "",
      cells[5] ?? "",
    ];
    if (!licenseNumber || !/^[A-Z0-9-]{3,}$/i.test(licenseNumber)) continue;
    out.push({
      licenseNumber,
      licenseType: licenseType || null,
      status: status || null,
      issuedDate: normalizeDate(issued),
      expirationDate: normalizeDate(expires),
      fullName: name || null,
    });
    if (out.length >= 5) break;
  }
  return out;
};

const normalizeDate = (s: string): string | null => {
  if (!s) return null;
  const m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) {
    const [, mo, d, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  return null;
};

const nameMatches = (
  fullName: string | null,
  first: string,
  last: string,
): boolean => {
  if (!fullName) return false;
  const lower = fullName.toLowerCase();
  return lower.includes(first.toLowerCase()) && lower.includes(last.toLowerCase());
};
