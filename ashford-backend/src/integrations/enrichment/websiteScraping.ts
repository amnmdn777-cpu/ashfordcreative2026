import { env } from "../../lib/env";
import { logger } from "../../lib/logger";
import type { Candidate, EnrichmentSource, LeadInput } from "./types";

/**
 * Website meta + structure scraping. Three-tier fetch strategy:
 *   1. Direct `fetch` with a realistic User-Agent (free, fast — works
 *      for the ~60% of healthcare sites that are server-rendered).
 *   2. ScraperAPI fallback when present and direct fetch fails or
 *      returns thin HTML (anti-bot bypass).
 *
 * Pulls — pure regex, no cheerio dep:
 *   - `<title>`, meta description / keywords, OpenGraph tags
 *   - hero image (og:image, fallback first reasonable <img>)
 *   - **JSON-LD structured data** (LocalBusiness, MedicalBusiness,
 *      Person) — Google's preferred format, gives us authoritative
 *      practice name / address / hours / specialties / founder for
 *      free, no parsing of marketing fluff required
 *   - services list (heading "services" / "treatments" / "specialties"
 *     followed by a list)
 *   - team list (heading "team" / "our therapists" / "meet" followed by a
 *     list of names)
 *   - a US-style street address from the body
 *   - **brand identity**: logo URL, favicon, theme color, primary
 *      font-family
 *   - **social handles**: Instagram, Facebook, LinkedIn, TikTok, YouTube,
 *      PT, Headway profiles linked from the site
 *   - **testimonials** the prospect already curated on their own site
 *      (different from Google reviews — usually richer, hand-picked)
 *   - **sitemap.xml** path discovery for downstream deep-crawl sources
 *
 * Best-effort: returns whatever it can find; the portal merge layer
 * treats missing fields as gaps, not failures.
 *
 * Docs: https://docs.scraperapi.com/getting-started
 */
class WebsiteScrapingSource implements EnrichmentSource {
  readonly key = "website_meta";
  readonly label = "Website meta scrape";

  isConfigured(): boolean {
    // No API key strictly required — we can hit the lead's own site
    // directly with a friendly User-Agent. ScraperAPI is just a
    // reliability boost for sites with anti-bot.
    return true;
  }

  async fetch(lead: LeadInput): Promise<Candidate | null> {
    if (!lead.currentWebsite) return null;
    const target = normalizeUrl(lead.currentWebsite);
    if (!target) return null;
    try {
      const html = await fetchWithFallback(target);
      if (!html) return null;
      const meta = extractMeta(html);
      const hero = extractHero(html, target, meta);
      const services = extractListUnderHeading(html, [
        "services",
        "treatments",
        "specialties",
        "what we offer",
        "what we treat",
      ]);
      const teamHeadings = [
        "team",
        "our team",
        "our therapists",
        "meet",
        "providers",
        "clinicians",
      ];
      const teamNames = extractListUnderHeading(html, teamHeadings);
      const teamStructured = extractTeamStructured(html, teamHeadings);
      const streetAddress = extractAddress(html);
      const jsonLd = extractJsonLd(html);
      const brand = extractBrand(html, target, meta);
      const socialLinks = extractSocialLinks(html, target);
      const testimonials = extractTestimonials(html);
      const sitemapUrl = await discoverSitemap(target);
      const hasSignal =
        !!meta.title ||
        !!meta.description ||
        !!meta.og.title ||
        !!hero ||
        services.length > 0 ||
        teamNames.length > 0 ||
        !!streetAddress ||
        !!jsonLd ||
        !!brand.logoUrl ||
        Object.values(socialLinks).some((v) => !!v) ||
        testimonials.length > 0;
      if (!hasSignal) return null;
      const summaryParts = [
        meta.title ? `Title: ${truncate(meta.title, 90)}` : null,
        meta.description ? `Meta: ${truncate(meta.description, 140)}` : null,
        services.length ? `services(${services.length})` : null,
        teamNames.length ? `team(${teamNames.length})` : null,
        hero ? "hero" : null,
        streetAddress ? "address" : null,
        jsonLd ? "json-ld" : null,
        brand.logoUrl ? "logo" : null,
        testimonials.length ? `testimonials(${testimonials.length})` : null,
      ].filter(Boolean);
      return {
        confidence: 70,
        summary: summaryParts.join(" · "),
        payload: {
          targetUrl: target,
          fetchedBytes: html.length,
          ...meta,
          hero,
          services,
          team: teamNames,
          teamStructured,
          streetAddress,
          jsonLd,
          brand,
          socialLinks,
          testimonials,
          sitemapUrl,
        },
      };
    } catch (err) {
      logger.warn({ err, leadId: lead.id }, "website meta enrichment failed");
      return null;
    }
  }
}

const normalizeUrl = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
};

const truncate = (s: string, n: number): string =>
  s.length <= n ? s : `${s.slice(0, n - 1)}…`;

const META_RE = /<meta\b[^>]*?>/gi;
const TITLE_RE = /<title[^>]*>([^<]*)<\/title>/i;
const FIRST_H1_RE = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i;
const IMG_RE = /<img\b[^>]*?>/gi;

const decodeHtmlEntities = (s: string): string =>
  s
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();

const stripTags = (html: string): string =>
  html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const attr = (tag: string, name: string): string | null => {
  const re = new RegExp(`${name}\\s*=\\s*"([^"]*)"|${name}\\s*=\\s*'([^']*)'`, "i");
  const m = tag.match(re);
  if (!m) return null;
  return decodeHtmlEntities(m[1] ?? m[2] ?? "");
};

const absolutize = (src: string, base: string): string | null => {
  try {
    return new URL(src, base).toString();
  } catch {
    return null;
  }
};

const extractMeta = (html: string) => {
  const out = {
    title: null as string | null,
    description: null as string | null,
    keywords: null as string | null,
    // LOT 2.3 / 2.4 — site builder fingerprint. NEVER use this as the
    // practice name (it'd surface "Hostinger Horizons" as the brand);
    // it IS used by the web-stack scorer to award full points when the
    // value matches a known DIY platform.
    generator: null as string | null,
    // LOT 2.3 — first <h1> on the homepage, used as a higher-confidence
    // signal for practiceName than the <title> (which is often a CMS
    // default).
    h1: null as string | null,
    og: {
      title: null as string | null,
      description: null as string | null,
      image: null as string | null,
      siteName: null as string | null,
    },
  };
  const titleMatch = html.match(TITLE_RE);
  if (titleMatch?.[1]) out.title = decodeHtmlEntities(titleMatch[1]);
  const h1Match = html.match(FIRST_H1_RE);
  if (h1Match?.[1]) {
    const cleaned = stripTags(h1Match[1]);
    if (cleaned) out.h1 = cleaned;
  }
  const matches = html.match(META_RE) ?? [];
  for (const tag of matches) {
    const name = (attr(tag, "name") ?? "").toLowerCase();
    const property = (attr(tag, "property") ?? "").toLowerCase();
    const content = attr(tag, "content");
    if (!content) continue;
    if (name === "description") out.description = content;
    else if (name === "keywords") out.keywords = content;
    else if (name === "generator") out.generator = content;
    else if (property === "og:title") out.og.title = content;
    else if (property === "og:description") out.og.description = content;
    else if (property === "og:image") out.og.image = content;
    else if (property === "og:site_name") out.og.siteName = content;
  }
  return out;
};

const extractHero = (
  html: string,
  base: string,
  meta: ReturnType<typeof extractMeta>,
): string | null => {
  if (meta.og.image) {
    return absolutize(meta.og.image, base);
  }
  const imgs = html.match(IMG_RE) ?? [];
  for (const tag of imgs) {
    const src = attr(tag, "src") ?? attr(tag, "data-src");
    if (!src) continue;
    if (/sprite|icon|logo|favicon|tracking|pixel/i.test(src)) continue;
    const abs = absolutize(src, base);
    if (abs) return abs;
  }
  return null;
};

const extractListUnderHeading = (
  html: string,
  keywords: string[],
): string[] => {
  const lower = html.toLowerCase();
  for (const kw of keywords) {
    const re = new RegExp(
      `<(h1|h2|h3|h4)[^>]*>[^<]*${kw.replace(/\s+/g, "\\s+")}[^<]*</\\1>`,
      "i",
    );
    const m = lower.match(re);
    if (!m || m.index == null) continue;
    const after = html.slice(m.index + m[0].length, m.index + m[0].length + 4000);
    const liMatches = Array.from(after.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi));
    if (liMatches.length >= 2) {
      return liMatches
        .slice(0, 8)
        .map((mm) => decodeHtmlEntities(stripTags(mm[1])))
        .filter((s) => s.length > 1 && s.length < 200);
    }
    const h3Matches = Array.from(
      after.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi),
    );
    if (h3Matches.length >= 2) {
      return h3Matches
        .slice(0, 8)
        .map((mm) => decodeHtmlEntities(stripTags(mm[1])))
        .filter((s) => s.length > 1 && s.length < 200);
    }
  }
  return [];
};

/**
 * Pull structured team entries from a "Team / Providers / Clinicians" section.
 * Each entry pairs a person's name (the inner text of an <h3>/<h4>) with a
 * short bio (the inner text of the very next <p>). Best-effort, regex-only.
 */
const extractTeamStructured = (
  html: string,
  keywords: string[],
): Array<{ name: string; credentials: string | null; bio: string | null }> => {
  const lower = html.toLowerCase();
  for (const kw of keywords) {
    const re = new RegExp(
      `<(h1|h2|h3|h4)[^>]*>[^<]*${kw.replace(/\s+/g, "\\s+")}[^<]*</\\1>`,
      "i",
    );
    const m = lower.match(re);
    if (!m || m.index == null) continue;
    const after = html.slice(m.index + m[0].length, m.index + m[0].length + 8000);
    const entries: Array<{
      name: string;
      credentials: string | null;
      bio: string | null;
    }> = [];
    const cardRe =
      /<h(?:3|4)[^>]*>([\s\S]*?)<\/h(?:3|4)>\s*(?:<[^p>][\s\S]*?>\s*)*<p[^>]*>([\s\S]*?)<\/p>/gi;
    for (const card of after.matchAll(cardRe)) {
      const rawName = decodeHtmlEntities(stripTags(card[1] ?? "")).trim();
      const rawBio = decodeHtmlEntities(stripTags(card[2] ?? "")).trim();
      if (!rawName || rawName.length < 3 || rawName.length > 80) continue;
      // Split "Jane Doe, LCSW" → name + credentials
      const credMatch = rawName.match(/^(.+?),\s*([A-Z][A-Za-z.,\s]{1,40})$/);
      const name = credMatch?.[1]?.trim() ?? rawName;
      const credentials = credMatch?.[2]?.trim() ?? null;
      const bio = rawBio.length > 30 ? truncate(rawBio, 600) : null;
      entries.push({ name, credentials, bio });
      if (entries.length >= 8) break;
    }
    if (entries.length > 0) return entries;
  }
  return [];
};

const ADDR_RE =
  /\b(\d{1,6}\s+[A-Z][A-Za-z0-9.\-' ]{2,40}\s+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Way|Pkwy|Parkway|Ct|Court|Pl|Place|Ter|Terrace|Hwy|Suite|Ste)[A-Za-z0-9.,\-' ]*),?\s+[A-Z][A-Za-z\- ]+,\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?\b/;

const extractAddress = (html: string): string | null => {
  const text = stripTags(html);
  const m = text.match(ADDR_RE);
  return m ? m[0].trim() : null;
};

// ---------------------------------------------------------------------------
// New extractors (2026-05) — public-first preview personalization
// ---------------------------------------------------------------------------

const FRIENDLY_USER_AGENT =
  "Mozilla/5.0 (compatible; AshfordEnrichmentBot/1.0; +https://ashford.co)";

/**
 * Tier-1 direct fetch first (free, fast); tier-2 ScraperAPI fallback when
 * direct fetch fails or returns empty/thin HTML. Saves ~70% of paid
 * scraper calls for the SSR-heavy market we serve (WordPress, Webflow,
 * Squarespace SSR, Ghost). Caller already wraps in try/catch and a
 * 20s AbortSignal-equivalent — we propagate failures up.
 */
const fetchWithFallback = async (url: string): Promise<string | null> => {
  // Tier 1: friendly direct fetch.
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": FRIENDLY_USER_AGENT,
        accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) {
      const html = await res.text();
      // "Thin" = under 1 KB likely a JS-shell page (Wix, Squarespace
      // dynamic) we couldn't render; try the proxy.
      if (html.length >= 1024) return html;
    }
  } catch {
    /* fall through to tier 2 */
  }
  // Tier 2: ScraperAPI when configured (anti-bot, headless rendering).
  if (env.scraperapiKey) {
    try {
      const proxied = `https://api.scraperapi.com/?api_key=${encodeURIComponent(
        env.scraperapiKey,
      )}&url=${encodeURIComponent(url)}&render=true`;
      const res = await fetch(proxied, {
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) return await res.text();
    } catch {
      return null;
    }
  }
  return null;
};

/**
 * Walk every `<script type="application/ld+json">` block and return the
 * first object whose @type matches a business/person shape. Preserves
 * the raw object so the merge layer can pull whatever it needs (name,
 * address, telephone, openingHours, areaServed, knowsAbout, founder,
 * employees, etc.). Multiple types in `@graph`: we pick the first match
 * inside it.
 */
const RELEVANT_LD_TYPES = new Set([
  "LocalBusiness",
  "MedicalBusiness",
  "MedicalOrganization",
  "MedicalClinic",
  "Physician",
  "Dentist",
  "ProfessionalService",
  "Organization",
  "Person",
  "HealthAndBeautyBusiness",
]);

const isRelevantType = (t: unknown): boolean => {
  if (typeof t === "string") return RELEVANT_LD_TYPES.has(t);
  if (Array.isArray(t)) return t.some((x) => isRelevantType(x));
  return false;
};

const extractJsonLd = (html: string): Record<string, unknown> | null => {
  const blocks = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const m of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const candidates = Array.isArray(parsed) ? parsed : [parsed];
    for (const c of candidates) {
      if (!c || typeof c !== "object") continue;
      const obj = c as Record<string, unknown>;
      if (isRelevantType(obj["@type"])) return obj;
      // Walk @graph entries (Yoast/RankMath emit one block with many).
      if (Array.isArray(obj["@graph"])) {
        for (const g of obj["@graph"] as unknown[]) {
          if (g && typeof g === "object") {
            const go = g as Record<string, unknown>;
            if (isRelevantType(go["@type"])) return go;
          }
        }
      }
    }
  }
  return null;
};

/**
 * Brand identity extraction. The aim is the "wow, that's MY brand,
 * redesigned" moment — pulling the prospect's existing logo, accent
 * color, and typeface so the preview reads as a continuation, not a
 * replacement. Guarantees: every URL is absolutized against the
 * fetched page so downstream services don't need to re-resolve.
 */
const extractBrand = (
  html: string,
  base: string,
  meta: ReturnType<typeof extractMeta>,
): {
  logoUrl: string | null;
  faviconUrl: string | null;
  accentColor: string | null;
  fontFamily: string | null;
} => {
  // Logo: prefer JSON-LD `logo`, then `<header><img>`, then any `<img>`
  // whose src/alt smells like a logo. Skip favicons and tracking pixels.
  let logoUrl: string | null = null;
  const headerMatch = html.match(/<header\b[\s\S]*?<\/header>/i);
  const headerHtml = headerMatch?.[0] ?? "";
  const headerImgs = headerHtml.match(IMG_RE) ?? [];
  for (const tag of headerImgs) {
    const src = attr(tag, "src") ?? attr(tag, "data-src");
    if (!src) continue;
    if (/sprite|favicon|tracking|pixel|spinner|loading/i.test(src)) continue;
    const alt = (attr(tag, "alt") ?? "").toLowerCase();
    const looksLogo =
      /logo/i.test(src) || alt.includes("logo") || /\.svg(\?|$)/i.test(src);
    if (looksLogo || headerImgs.length === 1) {
      logoUrl = absolutize(src, base);
      if (logoUrl) break;
    }
  }
  if (!logoUrl) {
    const allImgs = html.match(IMG_RE) ?? [];
    for (const tag of allImgs) {
      const src = attr(tag, "src");
      if (!src) continue;
      if (!/logo/i.test(src)) continue;
      logoUrl = absolutize(src, base);
      if (logoUrl) break;
    }
  }

  // Favicon: rel="icon" / "shortcut icon" / "apple-touch-icon".
  let faviconUrl: string | null = null;
  const linkRe = /<link\b[^>]*?>/gi;
  for (const tag of html.match(linkRe) ?? []) {
    const rel = (attr(tag, "rel") ?? "").toLowerCase();
    const href = attr(tag, "href");
    if (!href) continue;
    if (
      rel.includes("icon") ||
      rel.includes("shortcut icon") ||
      rel === "apple-touch-icon"
    ) {
      faviconUrl = absolutize(href, base);
      if (faviconUrl) break;
    }
  }
  if (!faviconUrl) {
    // Default convention.
    faviconUrl = absolutize("/favicon.ico", base);
  }

  // Accent color: explicit `<meta name="theme-color">` first; then look
  // for the most prominent hex color in inline `<style>` blocks.
  let accentColor: string | null = null;
  const themeMatch = html.match(
    /<meta[^>]+name=["']theme-color["'][^>]*content=["']([^"']+)["']/i,
  );
  if (themeMatch?.[1]) {
    accentColor = normalizeHex(themeMatch[1]);
  }
  if (!accentColor) {
    accentColor = pickDominantHex(html);
  }

  // Font family: most-used font-family in the head's CSS / inline style.
  // We scan @font-face + body/header rules and rank by appearance count.
  let fontFamily: string | null = null;
  const fontMatches = Array.from(
    html.matchAll(/font-family\s*:\s*([^;\}"']+)[;\}"']/gi),
  );
  if (fontMatches.length) {
    const counts = new Map<string, number>();
    for (const m of fontMatches) {
      const first = m[1]
        .split(",")[0]
        ?.replace(/['"]/g, "")
        .trim();
      if (!first) continue;
      // Ignore CSS keywords and generic families.
      if (
        /^(inherit|initial|unset|var\(|sans-serif|serif|monospace|cursive|fantasy|system-ui)$/i.test(
          first,
        )
      )
        continue;
      counts.set(first, (counts.get(first) ?? 0) + 1);
    }
    if (counts.size) {
      fontFamily =
        Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
        null;
    }
  }
  // Fallback: Google Fonts <link> often advertises the family.
  if (!fontFamily) {
    const gFont = html.match(
      /fonts\.googleapis\.com\/css2?\?family=([A-Za-z0-9+%]+)/i,
    );
    if (gFont?.[1]) {
      fontFamily = decodeURIComponent(gFont[1].replace(/\+/g, " "));
    }
  }

  // Don't override a meta og:image-derived hero accidentally; this is
  // brand identity, not hero. Caller composes them separately.
  void meta;

  return { logoUrl, faviconUrl, accentColor, fontFamily };
};

const HEX_RE = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;

const normalizeHex = (raw: string): string | null => {
  const s = raw.trim();
  const m = s.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return null;
  const hex = m[1];
  if (hex.length === 3) {
    return `#${hex
      .split("")
      .map((c) => c + c)
      .join("")
      .toLowerCase()}`;
  }
  return `#${hex.toLowerCase()}`;
};

/**
 * Pick the most prominent non-greyscale hex color from inline styles.
 * Skips common defaults (#fff, #000, #333) so we don't pick the body
 * text color as an accent. Returns null if no decent candidate exists.
 */
const pickDominantHex = (html: string): string | null => {
  const styleBlock = (html.match(/<style[\s\S]*?<\/style>/gi) ?? []).join(" ");
  if (!styleBlock) return null;
  const counts = new Map<string, number>();
  let m: RegExpExecArray | null;
  while ((m = HEX_RE.exec(styleBlock)) !== null) {
    const hex = normalizeHex(m[0]);
    if (!hex) continue;
    // Skip near-greyscale, near-white and near-black.
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max - min < 25) continue; // ~greyscale
    if (max < 30) continue; // near-black
    if (min > 230) continue; // near-white
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

/**
 * Pull social profile URLs the prospect links from their site. Matches
 * the canonical hosts only (instagram.com, facebook.com, …) so we
 * don't accept share-button intermediaries or generic outbound links.
 */
const SOCIAL_HOSTS: Record<string, RegExp> = {
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.]+\/?/i,
  facebook: /https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9_.\-]+\/?/i,
  linkedin:
    /https?:\/\/(?:www\.)?linkedin\.com\/(?:in|company|pub)\/[A-Za-z0-9_.\-]+\/?/i,
  tiktok: /https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9_.]+\/?/i,
  youtube:
    /https?:\/\/(?:www\.)?youtube\.com\/(?:c\/|channel\/|user\/|@)[A-Za-z0-9_.\-]+\/?/i,
  psychologyToday:
    /https?:\/\/(?:www\.)?psychologytoday\.com\/(?:us|ca|uk)\/[A-Za-z0-9_.\-/]+/i,
  headway: /https?:\/\/(?:[a-z0-9-]+\.)?headway\.co\/providers\/[A-Za-z0-9_.\-]+/i,
};

const extractSocialLinks = (
  html: string,
  base: string,
): Record<string, string | null> => {
  const out: Record<string, string | null> = {
    instagram: null,
    facebook: null,
    linkedin: null,
    tiktok: null,
    youtube: null,
    psychologyToday: null,
    headway: null,
  };
  // Resolve relative hrefs first so an `href="https://..."` on the page wins.
  const hrefs = Array.from(
    html.matchAll(/href=["']([^"']+)["']/gi),
    (m) => m[1],
  )
    .map((h) => absolutize(h, base) ?? h)
    .filter((h) => /^https?:\/\//i.test(h));
  for (const url of hrefs) {
    for (const [key, re] of Object.entries(SOCIAL_HOSTS)) {
      if (out[key]) continue;
      if (re.test(url)) {
        out[key] = url.replace(/[#?].*$/, "");
      }
    }
  }
  return out;
};

/**
 * Lift hand-curated testimonials from the prospect's own homepage. We
 * look for elements that smell like testimonials (`<blockquote>`,
 * class names containing "testimonial"/"quote"/"review") and require
 * a minimum length so we don't surface CSS placeholder text. Returns
 * up to 6.
 */
const extractTestimonials = (
  html: string,
): Array<{ author: string | null; body: string }> => {
  const out: Array<{ author: string | null; body: string }> = [];
  // <blockquote>…</blockquote>
  const blockquotes = Array.from(
    html.matchAll(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi),
  );
  for (const m of blockquotes) {
    const inner = m[1] ?? "";
    // <cite> or <footer> often holds attribution.
    const citeMatch = inner.match(
      /<(?:cite|footer)[^>]*>([\s\S]*?)<\/(?:cite|footer)>/i,
    );
    const author = citeMatch
      ? decodeHtmlEntities(stripTags(citeMatch[1])).trim() || null
      : null;
    const body = decodeHtmlEntities(
      stripTags(inner.replace(/<(?:cite|footer)[^>]*>[\s\S]*?<\/(?:cite|footer)>/i, "")),
    ).trim();
    if (body.length >= 50 && body.length <= 800) {
      out.push({ author, body });
    }
    if (out.length >= 6) break;
  }
  // Class-name based: <div class="… testimonial …">…</div>
  if (out.length < 6) {
    const cardRe =
      /<(?:div|article|section|figure)[^>]*class=["'][^"']*(?:testimonial|quote|review-card)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|article|section|figure)>/gi;
    for (const m of html.matchAll(cardRe)) {
      const inner = m[1] ?? "";
      // Look for a paragraph; if multiple, pick the longest.
      const paras = Array.from(
        inner.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi),
        (mm) => decodeHtmlEntities(stripTags(mm[1])).trim(),
      ).filter((s) => s.length >= 50 && s.length <= 800);
      if (!paras.length) continue;
      const body = paras.sort((a, b) => b.length - a.length)[0]!;
      // Author guess: text inside an element with class containing "author"/"name".
      const authorMatch = inner.match(
        /<[^>]+class=["'][^"']*(?:author|name|byline)[^"']*["'][^>]*>([\s\S]*?)<\//i,
      );
      const author = authorMatch
        ? decodeHtmlEntities(stripTags(authorMatch[1])).trim() || null
        : null;
      // De-duplicate against blockquote pass.
      if (out.some((t) => t.body === body)) continue;
      out.push({ author, body });
      if (out.length >= 6) break;
    }
  }
  return out;
};

/**
 * Discover the sitemap URL for downstream deep-crawl sources. Tries
 * `/sitemap.xml` first (canonical), then `/robots.txt` for a `Sitemap:`
 * directive. Returns just the URL — parsing is the caller's job. Keeps
 * the network round-trip cheap (HEAD request).
 */
const discoverSitemap = async (base: string): Promise<string | null> => {
  let origin: string;
  try {
    origin = new URL(base).origin;
  } catch {
    return null;
  }
  const direct = `${origin}/sitemap.xml`;
  try {
    const res = await fetch(direct, {
      method: "HEAD",
      headers: { "user-agent": FRIENDLY_USER_AGENT },
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) return direct;
  } catch {
    /* fall through */
  }
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "user-agent": FRIENDLY_USER_AGENT },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const txt = await res.text();
    const m = txt.match(/Sitemap:\s*(\S+)/i);
    return m?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
};

export const websiteScrapingSource = new WebsiteScrapingSource();
