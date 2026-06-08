import { createHash } from "node:crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import { db, directoryHtmlCache } from "@workspace/db";
import { env } from "../../lib/env";
import { logger } from "../../lib/logger";

/**
 * Shared directory-scraping primitives. Centralizes the patterns
 * we re-discovered three times (Headway, PT, Healthgrades) and
 * will need 4 more times (Zencare, Alma, Grow Therapy, TherapyDen):
 *
 *   - **Two-tier fetch** with diagnostic logs: direct fetch with a
 *     real-browser User-Agent first ($0, ~70% of pages), ScraperAPI
 *     `render=true` fallback when Cloudflare blocks (~$0.005 per
 *     fallback, handles JS challenges).
 *   - **DOM-text extraction** helpers: strip script/style/tags +
 *     decode entities + collapse whitespace.
 *   - **Section anchored** comma-list extraction (`Specialties` →
 *     items until next section).
 *   - **Photo candidate scoring**: collect <img>/<source srcset>/
 *     CSS `background-image:` URLs from raw HTML, plus a final raw-
 *     URL pass that catches photo refs inside flight chunks /
 *     JSON-LD / inline meta. Caller supplies the host whitelist and
 *     blocklist.
 *   - **Video extraction** (new in 2026-05): Zencare and PT both
 *     embed practitioner intro videos via Vimeo / YouTube / Mux.
 *     `extractVideoCandidates` picks them out of iframe src,
 *     `<video>` source URLs, and `og:video:url` meta.
 *
 * Each scraper imports what it needs and supplies the directory-
 * specific regex anchors and host whitelists. Three-tier parser
 * scaffolding (NEXT_DATA → flight chunks → DOM regex) lives in
 * each scraper because the section headings differ — but the
 * anti-bot fetch + the DOM utilities are stable.
 */

const REAL_BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Cache TTL for directory HTML — 30 days. Headway/PT/Zencare/etc.
 * profiles change rarely (mostly on the rep onboarding cadence,
 * never multiple times a week), so a long TTL cuts ScraperAPI cost
 * 5-10x without staling the prospect-facing data noticeably. Stale-
 * while-revalidate at the orchestrator level (Phase 3.2) catches
 * the rare update case.
 */
const HTML_CACHE_TTL_DAYS = 30;

/**
 * Canonicalize a URL for cache deduplication: lowercase host, drop
 * the query string, drop the fragment, normalize trailing slash.
 * `?utm_source=email` and the bare URL share the same row.
 */
const canonicalUrl = (raw: string): string => {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return raw;
  }
};

/**
 * Two-tier directory HTML fetch with a 30-day persistent cache.
 *
 *   1. Look up the canonical URL in `directory_html_cache`. If a
 *      fresh row exists (≤ 30 days), return it — $0, sub-millisecond.
 *   2. Tier 1 fetch: direct with a real-browser UA ($0, ~70% of
 *      sites that aren't behind aggressive Cloudflare).
 *   3. Tier 2 fetch: ScraperAPI render=true (handles JS challenges).
 *   4. On success, persist to cache so the next run skips the network.
 *
 * Caller supplies the source name for log scoping. The shape is
 * unchanged from the pre-cache version — null on exhaustion, string
 * on success.
 */
export const fetchDirectoryHtml = async (
  url: string,
  sourceName: string,
): Promise<string | null> => {
  // Cache lookup.
  const canon = canonicalUrl(url);
  const urlHash = createHash("sha256").update(canon).digest("hex");
  const cutoff = new Date(Date.now() - HTML_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);
  try {
    const [cached] = await db
      .select()
      .from(directoryHtmlCache)
      .where(
        and(
          eq(directoryHtmlCache.urlHash, urlHash),
          gt(directoryHtmlCache.fetchedAt, cutoff),
        ),
      )
      .orderBy(desc(directoryHtmlCache.fetchedAt))
      .limit(1);
    if (cached) {
      logger.info(
        {
          url,
          source: sourceName,
          tier: "cache",
          bytes: cached.bytes,
          ageHours: Math.round(
            (Date.now() - cached.fetchedAt.getTime()) / (60 * 60 * 1000),
          ),
        },
        `${sourceName}:fetchHtml ok (cached)`,
      );
      return cached.html;
    }
  } catch (err) {
    // Cache lookup failure is not fatal — fall through to network.
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      `${sourceName}:fetchHtml cache lookup failed — fetching live`,
    );
  }

  const html = await fetchDirectoryHtmlUncached(url, sourceName);
  if (html) {
    // Persist to cache. Errors are non-fatal — better to ship the
    // result than fail the enrichment because of a cache write.
    try {
      await db.insert(directoryHtmlCache).values({
        urlHash,
        url: canon,
        sourceKey: sourceName,
        html,
        bytes: html.length,
      });
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        `${sourceName}:fetchHtml cache write failed`,
      );
    }
  }
  return html;
};

/**
 * Internal: the actual two-tier fetch (direct + ScraperAPI). No
 * cache touched here. Exported under a different name so unit tests
 * can exercise the network branch without involving the database.
 */
export const fetchDirectoryHtmlUncached = async (
  url: string,
  sourceName: string,
): Promise<string | null> => {
  // Tier 1.
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": REAL_BROWSER_UA,
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) {
      const html = await res.text();
      if (html.length >= 10_000) {
        logger.info(
          { url, source: sourceName, tier: "direct", bytes: html.length },
          `${sourceName}:fetchHtml ok`,
        );
        return html;
      }
      logger.warn(
        { url, source: sourceName, tier: "direct", bytes: html.length },
        `${sourceName}:fetchHtml direct returned thin HTML — falling back`,
      );
    } else {
      logger.warn(
        { url, source: sourceName, tier: "direct", status: res.status },
        `${sourceName}:fetchHtml direct non-OK — falling back`,
      );
    }
  } catch (err) {
    logger.warn(
      {
        url,
        source: sourceName,
        tier: "direct",
        err: err instanceof Error ? err.message : String(err),
      },
      `${sourceName}:fetchHtml direct threw — falling back`,
    );
  }

  // Tier 2.
  if (env.scraperapiKey != null) {
    try {
      const target = `https://api.scraperapi.com/?api_key=${encodeURIComponent(
        env.scraperapiKey,
      )}&url=${encodeURIComponent(url)}&render=true&country_code=us`;
      const res = await fetch(target, {
        headers: { "user-agent": REAL_BROWSER_UA, accept: "text/html" },
        signal: AbortSignal.timeout(40_000),
      });
      if (!res.ok) {
        logger.warn(
          { url, source: sourceName, tier: "scraperapi", status: res.status },
          `${sourceName}:fetchHtml scraperapi non-OK`,
        );
        return null;
      }
      const html = await res.text();
      logger.info(
        { url, source: sourceName, tier: "scraperapi", bytes: html.length },
        `${sourceName}:fetchHtml ok`,
      );
      return html;
    } catch (err) {
      logger.warn(
        {
          url,
          source: sourceName,
          tier: "scraperapi",
          err: err instanceof Error ? err.message : String(err),
        },
        `${sourceName}:fetchHtml scraperapi threw`,
      );
      return null;
    }
  }
  logger.warn(
    { url, source: sourceName },
    `${sourceName}:fetchHtml exhausted — no SCRAPERAPI_KEY configured`,
  );
  return null;
};

/** Strip script + style + tags + entities to clean body text. */
export const stripToBodyText = (html: string): string =>
  html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();

export const decodeEntities = (s: string): string =>
  s
    .replace(/&amp;/gi, "&")
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");

export const attrFromTag = (tag: string, name: string): string | null => {
  const re = new RegExp(`${name}\\s*=\\s*"([^"]*)"|${name}\\s*=\\s*'([^']*)'`, "i");
  const m = tag.match(re);
  if (!m) return null;
  return decodeEntities(m[1] ?? m[2] ?? "");
};

export const dedupe = (xs: string[]): string[] =>
  Array.from(new Set(xs.map((x) => x.trim()).filter(Boolean)));

/** Split a "A, B, C and D" style list into trimmed items. */
export const splitCsv = (raw: string): string[] =>
  raw
    .replace(/\s+and\s+/gi, ", ")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 80 && /[A-Za-z]/.test(s));

/**
 * Extract a comma-separated list between an anchor regex and a stop
 * regex in body text. Used by Headway/PT/Zencare/etc. for
 * "Specialties: anxiety, depression, …" style sections.
 */
export const extractCsvBetween = (
  text: string,
  anchor: RegExp,
  stop: RegExp,
): string[] => {
  const m = text.match(anchor);
  if (!m || m.index == null) return [];
  const after = text.slice(m.index + m[0].length);
  const stopMatch = after.match(stop);
  const slice = stopMatch ? after.slice(0, stopMatch.index) : after.slice(0, 600);
  return splitCsv(slice);
};

/**
 * Collect every plausible image URL from raw HTML — <img src/data-
 * src/srcset>, <source srcset>, CSS `background-image: url(...)`,
 * and a final raw-URL scan that catches images embedded in flight
 * chunks / JSON-LD / inline meta. Caller filters by host + blocklist.
 */
export const collectImageCandidates = (html: string): string[] => {
  const candidates: string[] = [];
  const imgRe = /<img\b[^>]*?>/gi;
  for (const tag of html.match(imgRe) ?? []) {
    const src = attrFromTag(tag, "src") ?? attrFromTag(tag, "data-src");
    if (src) candidates.push(src);
    const srcset = attrFromTag(tag, "srcset");
    if (srcset) {
      for (const entry of srcset.split(",")) {
        const u = entry.trim().split(/\s+/)[0];
        if (u) candidates.push(u);
      }
    }
  }
  const sourceRe = /<source\b[^>]*?>/gi;
  for (const tag of html.match(sourceRe) ?? []) {
    const srcset = attrFromTag(tag, "srcset");
    if (!srcset) continue;
    for (const entry of srcset.split(",")) {
      const u = entry.trim().split(/\s+/)[0];
      if (u) candidates.push(u);
    }
  }
  const bgRe = /background-image\s*:\s*url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
  for (const m of html.matchAll(bgRe)) {
    if (m[1]) candidates.push(m[1]);
  }
  // Final pass: any URL anywhere that ends in an image extension.
  const RAW_URL_RE =
    /https?:\/\/[^\s"'<>(){}\\]+\.(?:jpe?g|png|webp|avif)(?:\?[^\s"'<>(){}\\]*)?/gi;
  for (const m of html.matchAll(RAW_URL_RE)) {
    candidates.push(m[0]);
  }
  return Array.from(new Set(candidates));
};

/**
 * Extract candidate intro videos from a directory profile page.
 * Looks at <iframe src> (Vimeo, YouTube, Wistia, Mux, Cloudflare
 * Stream), <video><source src> tags, and `og:video:url` /
 * `og:video:secure_url` meta. Returns canonicalized embed URLs
 * with the basename + provider so the caller can pick one.
 *
 * Used by Zencare (mandatory provider intro video) and PT (added
 * "Intro" video tile in 2024). Both directories embed via Vimeo
 * with a unique numeric ID per provider.
 */
export interface VideoCandidate {
  url: string;
  provider: "vimeo" | "youtube" | "wistia" | "mux" | "cloudflarestream" | "other";
  embedUrl: string;
}

export const extractVideoCandidates = (html: string): VideoCandidate[] => {
  const out: VideoCandidate[] = [];
  const seen = new Set<string>();

  const push = (raw: string) => {
    if (!raw || !raw.startsWith("http") || seen.has(raw)) return;
    seen.add(raw);
    const provider = providerFromUrl(raw);
    const embedUrl = canonicalizeEmbed(raw, provider);
    out.push({ url: raw, provider, embedUrl });
  };

  // <iframe src="...">
  const iframeRe = /<iframe\b[^>]*?>/gi;
  for (const tag of html.match(iframeRe) ?? []) {
    const src = attrFromTag(tag, "src");
    if (src && /(?:vimeo|youtube|youtu\.be|wistia|mux|cloudflarestream)/i.test(src)) {
      push(src);
    }
  }
  // <video><source src="...">
  const videoSrcRe = /<source\b[^>]*src=["']([^"']+\.(?:mp4|webm|mov))[^"']*["']/gi;
  for (const m of html.matchAll(videoSrcRe)) {
    if (m[1]) push(m[1]);
  }
  // og:video meta tags.
  const ogVideoRe =
    /<meta[^>]+property=["']og:video(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/gi;
  for (const m of html.matchAll(ogVideoRe)) {
    if (m[1]) push(m[1]);
  }
  // Raw URL pass — Vimeo/YouTube embeds inside flight chunks.
  const RAW_RE =
    /https?:\/\/(?:player\.vimeo\.com\/video|vimeo\.com|www\.youtube\.com\/embed|youtu\.be|fast\.wistia\.com|videodelivery\.net|customer-[a-z0-9-]+\.cloudflarestream\.com)\/[A-Za-z0-9_/?=&\-]+/gi;
  for (const m of html.matchAll(RAW_RE)) {
    push(m[0]);
  }
  return out;
};

const providerFromUrl = (raw: string): VideoCandidate["provider"] => {
  if (/vimeo/i.test(raw)) return "vimeo";
  if (/youtu\.?be/i.test(raw)) return "youtube";
  if (/wistia/i.test(raw)) return "wistia";
  if (/mux\.com|videodelivery\.net/i.test(raw)) return "mux";
  if (/cloudflarestream/i.test(raw)) return "cloudflarestream";
  return "other";
};

const canonicalizeEmbed = (
  raw: string,
  provider: VideoCandidate["provider"],
): string => {
  try {
    const u = new URL(raw);
    if (provider === "vimeo") {
      // Strip query string but keep the numeric ID.
      const id = u.pathname.match(/\/(\d{5,})/)?.[1];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    if (provider === "youtube") {
      // Normalize watch?v=, /embed/, youtu.be/<id> → embed form.
      const id =
        u.searchParams.get("v") ??
        u.pathname.match(/\/(?:embed|v)\/([\w-]{8,})/)?.[1] ??
        u.pathname.replace(/^\//, "");
      if (id && /^[\w-]{8,}$/.test(id)) return `https://www.youtube.com/embed/${id}`;
    }
    return raw;
  } catch {
    return raw;
  }
};

/**
 * Build the lower-cased last-name token for a lead name, stripping
 * honorifics. Multiple scrapers need this for identity verification.
 */
export const lastNameToken = (name: string): string => {
  const parts = name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((s) => s.length >= 2 && !/^(?:dr|mr|mrs|ms|miss|prof)$/.test(s));
  return parts[parts.length - 1] ?? "";
};
