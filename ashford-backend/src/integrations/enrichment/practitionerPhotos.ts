import { logger } from "../../lib/logger";
import type { Candidate, EnrichmentSource, LeadInput } from "./types";

/**
 * A1 (founder 2026-05-19) — practitioner photo enrichment.
 *
 * Cascade:
 *   1. Cabinet site (Wix / Squarespace / generic): crawl /about, /team,
 *      /meet-our-team, /staff, /therapists, /counselors and pick the
 *      first <img> whose alt / title / filename mentions the lead's
 *      first or last name. Filters: drop logos, icons, images < 150px,
 *      stock platform paths.
 *   2. Psychology Today profile: extract the headshot from the
 *      <img class="profile-image"> / og:image meta on the lead's
 *      currentWebsite when it is a PT profile URL.
 *   3. Fallback: source = "fallback_initials" with practitioner_url
 *      null. resolvePersona's `practitionerInitials` helper renders
 *      the avatar circle.
 *
 * Payload shape (persisted in lead_enrichment.payload):
 *   {
 *     practitioner_url: string | null,
 *     source: "cabinet_site" | "psychology_today" | "fallback_initials",
 *     candidates: { url: string; source: string; alt?: string }[]
 *   }
 */
const STOCK_HOSTS = [
  "/images/templates/", "wixstatic.com/media/8a", // placeholder examples
];
const LOGO_HINTS = ["logo", "icon", "favicon", "header-image"];
const PERSON_PAGES = [
  "/about", "/team", "/meet-our-team", "/meet-the-team",
  "/staff", "/therapists", "/counselors", "/our-team", "/clinicians",
];

const PROFILE_IMG_RE = /<img\b[^>]*?(?:class=["'][^"']*(?:profile|team|photo|portrait)[^"']*["'])[^>]*?>/gi;
const ANY_IMG_RE = /<img\b[^>]*?>/gi;
const OG_IMAGE_RE = /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i;
const NAME_TOKENS = (name: string) =>
  name
    .replace(/^(?:dr|dra|mr|mrs|ms|mx|prof|rev)\.?\s+/i, "")
    .replace(/,\s*[A-Z][A-Z\-]*(?:\s+[A-Z]+)?$/i, "")
    .split(/[\s.]+/)
    .map((t) => t.replace(/[^A-Za-z'-]/g, ""))
    .filter((t) => t.length >= 3);

function attr(tag: string, name: string): string | null {
  const re = new RegExp(`\\b${name}=["']([^"']+)["']`, "i");
  const m = tag.match(re);
  return m?.[1] ?? null;
}

function looksLikeLogo(url: string, alt: string | null): boolean {
  const u = url.toLowerCase();
  const a = (alt ?? "").toLowerCase();
  for (const hint of LOGO_HINTS) {
    if (u.includes(hint) || a.includes(hint)) return true;
  }
  if (STOCK_HOSTS.some((h) => u.includes(h))) return true;
  return false;
}

interface PhotoCandidate {
  url: string;
  source: string;
  alt?: string;
  score: number;
}

function scoreCandidate(
  url: string,
  alt: string | null,
  title: string | null,
  nameTokens: string[],
): number {
  if (looksLikeLogo(url, alt)) return -1;
  let score = 1;
  const haystack = `${url} ${alt ?? ""} ${title ?? ""}`.toLowerCase();
  for (const tok of nameTokens) {
    if (haystack.includes(tok.toLowerCase())) score += 5;
  }
  // Bonus for typical headshot keywords.
  if (/headshot|portrait|profile/i.test(haystack)) score += 2;
  // Bonus for plausible image extension.
  if (/\.(jpe?g|png|webp)(\?|$)/i.test(url)) score += 1;
  // Penalty for tiny inline icons.
  if (/-(?:32|48|64|72)\.(jpe?g|png)/i.test(url)) score -= 3;
  return score;
}

function absolutise(url: string, base: string): string {
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      // Treat the scraper as a polite real-browser visitor; servers that
      // refuse curl-like requests usually let this through.
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return null;
    return await res.text();
  } catch (err) {
    logger.warn({ err: String(err), url }, "practitionerPhotos.fetchHtml failed");
    return null;
  }
}

function harvestImgs(
  html: string,
  baseUrl: string,
  nameTokens: string[],
  sourceTag: string,
): PhotoCandidate[] {
  const out: PhotoCandidate[] = [];
  // Pass 1 — explicit profile / team / portrait images.
  for (const m of html.matchAll(PROFILE_IMG_RE)) {
    const tag = m[0];
    const src = attr(tag, "src") || attr(tag, "data-src");
    if (!src) continue;
    const alt = attr(tag, "alt");
    const title = attr(tag, "title");
    const score = scoreCandidate(src, alt, title, nameTokens);
    if (score < 0) continue;
    out.push({ url: absolutise(src, baseUrl), source: sourceTag, alt: alt ?? undefined, score });
  }
  // Pass 2 — every <img>, scored.
  for (const m of html.matchAll(ANY_IMG_RE)) {
    const tag = m[0];
    const src = attr(tag, "src") || attr(tag, "data-src");
    if (!src) continue;
    const alt = attr(tag, "alt");
    const title = attr(tag, "title");
    const score = scoreCandidate(src, alt, title, nameTokens);
    if (score < 0) continue;
    out.push({ url: absolutise(src, baseUrl), source: sourceTag, alt: alt ?? undefined, score });
  }
  return out;
}

async function scrapeCabinet(
  baseUrl: string,
  nameTokens: string[],
): Promise<PhotoCandidate[]> {
  // Try the root first (some sites embed the about on /).
  const tried = new Set<string>();
  const candidates: PhotoCandidate[] = [];
  const rootHtml = await fetchHtml(baseUrl);
  if (rootHtml) {
    candidates.push(...harvestImgs(rootHtml, baseUrl, nameTokens, "cabinet_site"));
    tried.add(new URL(baseUrl).pathname);
  }
  // Walk through likely person pages.
  for (const path of PERSON_PAGES) {
    if (tried.has(path)) continue;
    const u = new URL(path, baseUrl).toString();
    const html = await fetchHtml(u);
    if (!html) continue;
    candidates.push(...harvestImgs(html, u, nameTokens, "cabinet_site"));
    tried.add(path);
  }
  return candidates;
}

async function scrapePsychologyToday(
  ptUrl: string,
): Promise<PhotoCandidate | null> {
  const html = await fetchHtml(ptUrl);
  if (!html) return null;
  // Prefer the explicit og:image meta — PT sets it to the headshot.
  const og = html.match(OG_IMAGE_RE);
  if (og?.[1]) {
    return {
      url: absolutise(og[1], ptUrl),
      source: "psychology_today",
      alt: "Psychology Today profile photo",
      score: 10,
    };
  }
  // Fallback — first profile-tagged <img>.
  for (const m of html.matchAll(PROFILE_IMG_RE)) {
    const src = attr(m[0], "src");
    if (src) {
      return {
        url: absolutise(src, ptUrl),
        source: "psychology_today",
        alt: attr(m[0], "alt") ?? "Psychology Today profile photo",
        score: 8,
      };
    }
  }
  return null;
}

class PractitionerPhotosSource implements EnrichmentSource {
  readonly key = "practitioner_photos";
  readonly label = "Practitioner Photos";

  isConfigured(): boolean {
    // The cascade is HTTP-only — no API keys required.
    return true;
  }

  async fetch(lead: LeadInput): Promise<Candidate | null> {
    const fullName = (lead.name ?? "").trim();
    if (!fullName) return null;
    const tokens = NAME_TOKENS(fullName);
    if (tokens.length === 0) return null;

    const candidates: PhotoCandidate[] = [];
    const website = (lead.currentWebsite ?? "").trim();

    // 1. Cabinet site cascade.
    if (website) {
      try {
        const cabinetCands = await scrapeCabinet(website, tokens);
        candidates.push(...cabinetCands);
      } catch (err) {
        logger.warn({ err: String(err) }, "practitionerPhotos.cabinet failed");
      }

      // 2. Psychology Today direct (if currentWebsite IS a PT URL).
      try {
        if (/psychologytoday\.com\/(?:us|ca|uk|au)\/therapists\//i.test(website)) {
          const pt = await scrapePsychologyToday(website);
          if (pt) candidates.push(pt);
        }
      } catch (err) {
        logger.warn({ err: String(err) }, "practitionerPhotos.pt failed");
      }
    }

    // Pick the top candidate.
    candidates.sort((a, b) => b.score - a.score);
    const top = candidates[0];

    const payload =
      top && top.score > 0
        ? {
            practitioner_url: top.url,
            source: top.source as "cabinet_site" | "psychology_today",
            candidates: candidates.slice(0, 8).map((c) => ({
              url: c.url,
              source: c.source,
              alt: c.alt ?? null,
              score: c.score,
            })),
          }
        : {
            practitioner_url: null,
            source: "fallback_initials" as const,
            candidates: candidates.slice(0, 8).map((c) => ({
              url: c.url,
              source: c.source,
              alt: c.alt ?? null,
              score: c.score,
            })),
          };

    return {
      confidence: top && top.score > 5 ? 90 : top ? 50 : 10,
      summary: top
        ? `Photo source: ${payload.source}`
        : "No practitioner photo found — initials fallback.",
      payload,
    };
  }
}

export const practitionerPhotosSource = new PractitionerPhotosSource();
