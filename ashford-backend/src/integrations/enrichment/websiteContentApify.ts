import { env } from "../../lib/env";
import { logger } from "../../lib/logger";
import type { Candidate, EnrichmentSource, LeadInput } from "./types";

/**
 * Deep crawl of the prospect's own website using Apify's
 * `apify/website-content-crawler` actor. Returns a structured list of
 * pages with URL, title, headings, meta description, plain text, and a
 * markdown rendering. The AI synthesis source consumes this to extract
 * services, team bios, mission, and value props that the AI agent then
 * maps into the prospect-facing preview content.
 *
 * Why Apify and not our in-process cheerio crawler:
 * - The in-process crawler is intentionally minimal (single-page,
 *   `<title>` + `<h1>` only) and refuses non-public hosts. It cannot
 *   render JavaScript, follow internal links, or extract markdown.
 * - Apify's actor handles URL discovery, robots.txt, retry, and headless
 *   browser rendering for ~$1 per 1k pages — well within our cost budget.
 *
 * Soft-fails (returns null) when:
 * - APIFY_API_TOKEN is missing
 * - the lead has no `currentWebsite` or it points to a directory listing
 *   site (psychologytoday.com, headway.co, calendly.com, helloalma.com)
 *   rather than the prospect's own domain
 * - the actor returns no items or errors out
 *
 * Apify docs:
 *   https://apify.com/apify/website-content-crawler/api/run-sync-get-dataset-items
 */
const DIRECTORY_HOSTS = [
  "psychologytoday.com",
  "headway.co",
  "calendly.com",
  "helloalma.com",
  "zocdoc.com",
  "healthgrades.com",
  "vitals.com",
  "hugedomains.com",
];

const isCrawlable = (url: string | null): boolean => {
  if (!url) return false;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = u.hostname.toLowerCase();
    if (DIRECTORY_HOSTS.some((d) => host === d || host.endsWith(`.${d}`))) {
      return false;
    }
    if (host.endsWith(".example.com") || host === "example.com") return false;
    return true;
  } catch {
    return false;
  }
};

interface ApifyPageItem {
  url?: string;
  loadedUrl?: string;
  title?: string;
  description?: string;
  text?: string;
  markdown?: string;
  html?: string;
  metadata?: { openGraph?: Array<{ property?: string; content?: string }> };
  crawl?: { httpStatusCode?: number };
}

const extractImages = (item: ApifyPageItem, baseUrl: string): string[] => {
  const out = new Set<string>();
  // 1. Open Graph image (high quality, marketing-curated).
  const og = item.metadata?.openGraph;
  if (Array.isArray(og)) {
    for (const tag of og) {
      if (tag?.property === "og:image" && typeof tag.content === "string") {
        out.add(absolutize(tag.content, baseUrl));
      }
    }
  }
  // 2. <img src=> tags from raw HTML — keep only large-ish, non-tracking.
  if (typeof item.html === "string") {
    const rx = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(item.html)) && out.size < 12) {
      const src = m[1];
      if (!src) continue;
      if (/^data:|sprite|spinner|loader|pixel|tracking|1x1/i.test(src)) continue;
      out.add(absolutize(src, baseUrl));
    }
  }
  // 3. Markdown image syntax fallback.
  if (typeof item.markdown === "string") {
    const rx = /!\[[^\]]*\]\(([^)\s]+)/g;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(item.markdown)) && out.size < 12) {
      out.add(absolutize(m[1]!, baseUrl));
    }
  }
  return Array.from(out)
    .filter((u) => /\.(jpe?g|png|webp|avif|gif)(\?|$)/i.test(u) || u.includes("/squarespace-cdn") || u.includes("googleusercontent"))
    .slice(0, 6);
};

const absolutize = (src: string, base: string): string => {
  try {
    return new URL(src, base).toString();
  } catch {
    return src;
  }
};

class WebsiteContentApifySource implements EnrichmentSource {
  readonly key = "website_content_apify";
  readonly label = "Website (Apify Content Crawler)";

  isConfigured(): boolean {
    return !!env.apifyApiToken;
  }

  async fetch(lead: LeadInput): Promise<Candidate | null> {
    if (!this.isConfigured()) return null;
    if (!isCrawlable(lead.currentWebsite)) {
      logger.info(
        { leadId: lead.id, url: lead.currentWebsite },
        "website_content_apify: skipping non-crawlable URL",
      );
      return null;
    }
    const startUrl = lead.currentWebsite!.startsWith("http")
      ? lead.currentWebsite!
      : `https://${lead.currentWebsite!}`;
    const endpoint =
      "https://api.apify.com/v2/acts/apify~website-content-crawler/run-sync-get-dataset-items" +
      `?token=${encodeURIComponent(env.apifyApiToken!)}&timeout=180`;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startUrls: [{ url: startUrl }],
          crawlerType: "cheerio",
          maxCrawlPages: 8,
          maxCrawlDepth: 2,
          saveMarkdown: true,
          // Keep HTML so we can pull <img src> + og:image tags for the
          // preview's per-page recreation. Trimmed before persisting.
          saveHtml: true,
          saveScreenshots: false,
          removeCookieWarnings: true,
          expandIframes: false,
          readableTextCharThreshold: 100,
        }),
        signal: AbortSignal.timeout(180_000),
      });
      if (!res.ok) {
        logger.warn(
          { leadId: lead.id, status: res.status },
          "website_content_apify: actor returned non-2xx",
        );
        return null;
      }
      const items = (await res.json()) as ApifyPageItem[];
      if (!Array.isArray(items) || items.length === 0) return null;
      const pages = items
        .filter((i) => (i.crawl?.httpStatusCode ?? 200) < 400)
        .map((i) => {
          const url = i.loadedUrl ?? i.url ?? "";
          let path = "/";
          try {
            path = new URL(url).pathname || "/";
          } catch { /* ignore */ }
          const images = extractImages(i, url || startUrl);
          // Lift up to 4 substantial leading paragraphs from the body
          // text. Templates render these inline so the prospect sees
          // their actual existing copy carried over, not just URLs.
          const paragraphs = (typeof i.text === "string" ? i.text : "")
            .split(/\n{2,}/)
            .map((s) => s.trim().replace(/\s+/g, " "))
            .filter((s) => s.length >= 60 && s.length <= 800)
            .slice(0, 4);
          return {
            url,
            path,
            title: i.title ?? null,
            description: i.description ?? null,
            text: typeof i.text === "string" ? i.text.slice(0, 8000) : null,
            markdown: typeof i.markdown === "string"
              ? i.markdown.slice(0, 12000)
              : null,
            paragraphs,
            images,
            kind: classifyPath(path),
          };
        })
        .filter((p) => p.url);
      if (pages.length === 0) return null;
      return {
        confidence: 90,
        summary: `Apify crawled ${pages.length} page(s) from ${startUrl}.`,
        payload: {
          startUrl,
          pageCount: pages.length,
          pages,
        },
      };
    } catch (err) {
      logger.warn(
        { err, leadId: lead.id },
        "website_content_apify: fetch failed",
      );
      return null;
    }
  }
}

const classifyPath = (path: string): string => {
  const p = path.toLowerCase();
  if (p === "/" || p === "/home") return "home";
  if (/about|story|who-we-are|our-team|practice/.test(p)) return "about";
  if (/services|treatments|specialt|what-we-treat|approach/.test(p)) {
    return "services";
  }
  if (/team|staff|providers|therapists|clinicians|meet/.test(p)) return "team";
  if (/contact|location|directions|appointment/.test(p)) return "contact";
  if (/faq|questions/.test(p)) return "faq";
  if (/blog|article|post|news/.test(p)) return "blog";
  if (/fee|pricing|insurance|rates/.test(p)) return "pricing";
  return "other";
};

export const websiteContentApifySource = new WebsiteContentApifySource();
