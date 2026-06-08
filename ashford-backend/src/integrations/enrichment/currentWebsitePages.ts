import { promises as dns } from "node:dns";
import { isIP } from "node:net";
import { env } from "../../lib/env";
import { logger } from "../../lib/logger";
import type { Candidate, EnrichmentSource, LeadInput } from "./types";

/**
 * Multi-page crawl of the prospect's existing website. The single-page
 * `website_meta` source pulls hero/services/team off the homepage; this
 * source goes one hop deeper and lists internal pages (about, services,
 * team, contact, fees, faq, blog) so the prospect preview can surface a
 * "Pages we'll bring over" callout — proving we'll re-create their
 * existing site structure rather than dropping them on a generic
 * template.
 *
 * Crawl rules:
 *   - Homepage + up to 7 internal links (8 fetches max).
 *   - Same-host only; skip mailto:/tel:/PDFs/asset paths.
 *   - Honors `robots.txt` Disallow rules for our own UA + the wildcard
 *     UA, evaluated longest-prefix-wins (per RFC 9309 §2.2.2).
 *   - 8s per fetch; uses ScraperAPI when configured (matches the
 *     existing `website_meta` source) so anti-bot pages don't kill the
 *     run. When direct, an SSRF guard rejects private/loopback hosts
 *     and rejects 30x redirects to private hosts.
 *   - Per-page payload includes `title`, `h1`, `summary`, the first
 *     four meaningful paragraphs, and up to four absolute image URLs.
 *     This is enough for the preview's "Pages we'll bring over"
 *     callout AND for downstream extractors (e.g. team scraping) to
 *     work without a second fetch.
 *   - Soft-fails to `null`: a missing site or rate-limit must not
 *     break enrichment.
 */
const USER_AGENT = "AshfordCreativeBot/1.0 (+https://ashford.studio/bot)";
const MAX_PAGES = 8;
const FETCH_TIMEOUT_MS = 8_000;

class CurrentWebsitePagesSource implements EnrichmentSource {
  readonly key = "current_website_pages";
  readonly label = "Website pages crawl";

  isConfigured(): boolean {
    // We can crawl with bare fetch; ScraperAPI is preferred when available
    // but not required.
    return true;
  }

  async fetch(lead: LeadInput): Promise<Candidate | null> {
    if (!lead.currentWebsite) return null;
    const home = normalizeUrl(lead.currentWebsite);
    if (!home) return null;
    const homeUrl = new URL(home);
    // SSRF prevalidation runs unconditionally — even when ScraperAPI is
    // configured we still talk directly to the host's robots.txt and
    // (defense-in-depth) we don't want a private literal to slip
    // through just because page fetches go via the proxy.
    const safe = await isPublicHost(homeUrl.hostname);
    if (!safe) {
      logger.warn(
        { leadId: lead.id, url: home },
        "current_website_pages: refusing private/loopback host",
      );
      return null;
    }
    const robots = await loadRobots(homeUrl.origin).catch(() => null);
    const allowed = (path: string) => isAllowedByRobots(robots, path);
    if (!allowed(homeUrl.pathname || "/")) {
      return null;
    }
    try {
      const homeHtml = await fetchPage(home);
      if (!homeHtml) return null;
      const links = extractInternalLinks(homeHtml, homeUrl).filter((l) =>
        allowed(l.path),
      );
      const ranked = rankPages(links).slice(0, MAX_PAGES - 1);
      const fetched: PageRecord[] = [
        {
          url: home,
          path: homeUrl.pathname || "/",
          ...summarizeHtml(homeHtml, homeUrl),
          kind: "home",
        },
      ];
      const results = await Promise.allSettled(
        ranked.map(async (cand) => {
          const html = await fetchPage(cand.url);
          if (!html) return null;
          return {
            url: cand.url,
            path: cand.path,
            ...summarizeHtml(html, new URL(cand.url)),
            kind: cand.kind,
          } satisfies PageRecord;
        }),
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) fetched.push(r.value);
      }
      if (fetched.length === 0) return null;

      // Best-effort team extraction from any team-page we found. Cheap
      // heuristic on credential suffixes (LCSW, PhD, MD, MFT, …) — a real
      // structured parser is V2.
      const team = extractTeamFromPages(fetched);

      return {
        confidence: 60,
        summary: `${fetched.length} pages crawled (${fetched
          .map((p) => p.kind)
          .join(", ")})${team.length ? ` · ${team.length} team members` : ""}`,
        payload: {
          targetUrl: home,
          pages: fetched,
          team,
        },
      };
    } catch (err) {
      logger.warn(
        { err, leadId: lead.id, url: home },
        "current_website_pages crawl failed",
      );
      return null;
    }
  }
}

export interface PageRecord {
  url: string;
  path: string;
  title: string | null;
  h1: string | null;
  summary: string | null;
  paragraphs: string[];
  images: string[];
  kind: string;
}

const KIND_PATTERNS: Array<{ kind: string; re: RegExp }> = [
  { kind: "about", re: /\b(about|who-?we-?are|story|mission)\b/i },
  { kind: "services", re: /\b(services|offerings|specialties|what-?we-?do|treatments|therapy)\b/i },
  { kind: "team", re: /\b(team|providers|clinicians|therapists|practitioners|staff|meet)\b/i },
  { kind: "contact", re: /\b(contact|location|locations|directions|hours)\b/i },
  { kind: "fees", re: /\b(fees|pricing|rates|insurance|payment)\b/i },
  { kind: "faq", re: /\b(faq|questions|resources)\b/i },
  { kind: "blog", re: /\b(blog|articles|news|press|posts)\b/i },
];

export const classifyKind = (path: string): string => {
  for (const { kind, re } of KIND_PATTERNS) {
    if (re.test(path)) return kind;
  }
  return "other";
};

const SKIP_EXT = /\.(pdf|jpe?g|png|gif|svg|webp|mp4|mp3|zip|css|js|ico|woff2?)(\?|#|$)/i;
const SKIP_PROTOCOLS = /^(mailto:|tel:|javascript:|#)/i;

export const extractInternalLinks = (
  html: string,
  base: URL,
): Array<{ url: string; path: string; kind: string }> => {
  const seen = new Set<string>();
  const out: Array<{ url: string; path: string; kind: string }> = [];
  const re = /<a\b[^>]*?\bhref\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = (m[2] ?? m[3] ?? "").trim();
    if (!raw || SKIP_PROTOCOLS.test(raw) || SKIP_EXT.test(raw)) continue;
    let abs: URL;
    try {
      abs = new URL(raw, base);
    } catch {
      continue;
    }
    if (abs.host !== base.host) continue;
    if (abs.pathname === base.pathname || abs.pathname === "/") continue;
    if (isSeoFarmPath(abs.pathname)) continue;
    const key = abs.pathname.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      url: `${abs.origin}${abs.pathname}`,
      path: abs.pathname,
      kind: classifyKind(abs.pathname),
    });
  }
  return out;
};

/**
 * SEO landing pages auto-injected by Squarespace / Wix / WordPress
 * directory plugins (e.g. "/psychiatrists/illinois/chicago" or
 * "/find-psychiatrists-in-austin-tx") are content farms — they
 * exist to capture city+specialty Google traffic, not to describe
 * the practitioner. Pulling them into the prospect's preview as
 * "pages we'll bring over" makes the rebuild look ridiculous and
 * leaks competitor / directory text into a custom site. Reject
 * any path that matches the obvious SEO farm shapes.
 */
export const isSeoFarmPath = (path: string): boolean => {
  const normalized = path.toLowerCase();
  if (/\/(psychiatrists?|psychologists?|therapists?|counsel(?:ors?|ing))\//.test(normalized)) {
    return true;
  }
  if (/find-(psychiatrists?|psychologists?|therapists?|counsel(?:ors?|ing))(\b|-)/.test(normalized)) {
    return true;
  }
  const stateAlt =
    "tx|ca|fl|ny|il|tn|wa|or|az|nv|ga|nc|sc|va|md|nj|pa|oh|mi|wi|mn|mo|co|ut|ks|ok|ar|la|ms|al|ky|ia|ne|nm|id|hi|ak|me|nh|vt|ri|ct|ma|de|wv|mt|wy|nd|sd";
  const inNearStateRe = new RegExp(
    `\\b(in|near)-[a-z][a-z-]+-(${stateAlt})(\\b|\\/)`,
    "i",
  );
  if (inNearStateRe.test(normalized)) return true;
  return false;
};

const KIND_PRIORITY: Record<string, number> = {
  about: 100,
  services: 90,
  team: 85,
  contact: 80,
  fees: 70,
  faq: 50,
  blog: 40,
  other: 10,
};

export const rankPages = (
  links: Array<{ url: string; path: string; kind: string }>,
): Array<{ url: string; path: string; kind: string }> => {
  // Keep at most one per kind (so we surface diversity, not 5 blog posts).
  const byKind = new Map<string, { url: string; path: string; kind: string }>();
  const others: typeof links = [];
  for (const l of links) {
    if (l.kind === "other") {
      others.push(l);
    } else if (!byKind.has(l.kind)) {
      byKind.set(l.kind, l);
    }
  }
  const primary = Array.from(byKind.values()).sort(
    (a, b) => (KIND_PRIORITY[b.kind] ?? 0) - (KIND_PRIORITY[a.kind] ?? 0),
  );
  return [...primary, ...others.slice(0, 3)];
};

const normalizeUrl = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return `${u.origin}${u.pathname.replace(/\/$/, "")}` || u.origin;
  } catch {
    return null;
  }
};

const fetchPage = (url: string): Promise<string | null> =>
  safeFetchText(url, FETCH_TIMEOUT_MS);

/**
 * Refuses to talk to private/loopback/link-local IPs (RFC 1918, RFC 4193,
 * RFC 6890). Resolves all A/AAAA records — if any come back private we
 * bail, since an attacker could publish a single private record for a
 * domain whose other records are public. Also rejects `0.0.0.0`,
 * cloud metadata (`169.254.169.254`), and IPv6 mapped equivalents.
 */
const isPublicHost = async (hostname: string): Promise<boolean> => {
  if (!hostname) return false;
  const literal = isIP(hostname);
  if (literal) return !isPrivateAddress(hostname);
  let records: Array<{ address: string; family: number }>;
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    return false;
  }
  if (records.length === 0) return false;
  return records.every((r) => !isPrivateAddress(r.address));
};

export const isPrivateAddress = (addr: string): boolean => {
  const v = addr.toLowerCase();
  // IPv4 literal or IPv4-mapped IPv6 (::ffff:a.b.c.d).
  const v4Match = v.match(/(?:^|:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4Match) {
    const parts = v4Match[1]!.split(".").map((n) => Number(n));
    if (parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return true;
    const [a, b] = parts as [number, number, number, number];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local + AWS metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  // IPv6
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("fe80:") || v.startsWith("fc") || v.startsWith("fd")) return true;
  if (v.startsWith("ff")) return true; // multicast
  return false;
};

// ---------------------------------------------------------------------------
// robots.txt
// ---------------------------------------------------------------------------
interface RobotsRules {
  /** Disallow rules sorted longest-first so longest-match wins. */
  disallow: string[];
  /** Allow rules (override Disallow when more specific). */
  allow: string[];
}
const robotsCache = new Map<string, RobotsRules | null>();

const loadRobots = async (origin: string): Promise<RobotsRules | null> => {
  if (robotsCache.has(origin)) return robotsCache.get(origin)!;
  // robots.txt MUST go through the same SSRF-hardened path as page
  // fetches: a malicious lead.currentWebsite could otherwise return
  // a 30x to 169.254.169.254 (cloud metadata) or any RFC1918 host
  // and we'd happily fetch it just to "look up robots". The first
  // hop is also re-validated even though the caller pre-validated
  // the origin host, because cache poisoning between calls is
  // possible if two different leads share an origin.
  const txt = await safeFetchText(`${origin}/robots.txt`, 5_000);
  const parsed = txt ? parseRobots(txt) : { disallow: [], allow: [] };
  robotsCache.set(origin, parsed);
  return parsed;
};

/**
 * SSRF-hardened text fetch used by both page and robots.txt loads.
 * - When ScraperAPI is configured, traffic goes through the proxy and
 *   the proxy follows redirects on our behalf (it cannot reach our
 *   internal network anyway).
 * - When direct, we re-validate the host against `isPublicHost` and
 *   handle 30x manually so a redirect to a private IP is rejected.
 * - One redirect hop only; deeper chains are uncommon for top-level
 *   pages and not worth the complexity.
 */
const safeFetchText = async (
  url: string,
  timeoutMs: number,
): Promise<string | null> => {
  const usingProxy = !!env.scraperapiKey;
  if (!usingProxy) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    const safe = await isPublicHost(parsed.hostname);
    if (!safe) return null;
  }
  const target = usingProxy
    ? `https://api.scraperapi.com/?api_key=${encodeURIComponent(env.scraperapiKey!)}&url=${encodeURIComponent(url)}&render=false`
    : url;
  try {
    const res = await fetch(target, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: usingProxy
        ? {}
        : {
            "user-agent": USER_AGENT,
            accept: "text/html,application/xhtml+xml,text/plain",
          },
      redirect: usingProxy ? "follow" : "manual",
    });
    if (!usingProxy && res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      const next = new URL(loc, url);
      if (next.protocol !== "http:" && next.protocol !== "https:") return null;
      const safe = await isPublicHost(next.hostname);
      if (!safe) return null;
      const r2 = await fetch(next.toString(), {
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,text/plain",
        },
        redirect: "manual",
      });
      if (!r2.ok) return null;
      return await r2.text();
    }
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
};

export const parseRobots = (txt: string): RobotsRules => {
  // Group records by their User-agent line. Apply rules from the most-
  // specific matching agent: our UA token first, then `*`. This is the
  // RFC 9309 model in its simplest form.
  const lines = txt.split(/\r?\n/);
  const groups: Array<{ agents: string[]; rules: Array<{ kind: "allow" | "disallow"; path: string }> }> = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) {
      lastWasAgent = false;
      continue;
    }
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (field === "disallow" || field === "allow") {
      lastWasAgent = false;
      if (!current) continue;
      if (field === "disallow" && value === "") continue; // explicit "allow all"
      current.rules.push({ kind: field, path: value });
    } else {
      lastWasAgent = false;
    }
  }
  const ua = "ashfordcreativebot";
  const matching = groups.find((g) => g.agents.includes(ua)) ??
    groups.find((g) => g.agents.includes("*"));
  if (!matching) return { disallow: [], allow: [] };
  const disallow = matching.rules
    .filter((r) => r.kind === "disallow")
    .map((r) => r.path)
    .sort((a, b) => b.length - a.length);
  const allow = matching.rules
    .filter((r) => r.kind === "allow")
    .map((r) => r.path)
    .sort((a, b) => b.length - a.length);
  return { disallow, allow };
};

export const isAllowedByRobots = (
  rules: RobotsRules | null,
  path: string,
): boolean => {
  if (!rules) return true;
  const longestAllow = rules.allow.find((p) => robotsMatch(p, path));
  const longestDisallow = rules.disallow.find((p) => robotsMatch(p, path));
  if (longestDisallow && (!longestAllow || longestAllow.length < longestDisallow.length)) {
    return false;
  }
  return true;
};

const robotsMatch = (pattern: string, path: string): boolean => {
  if (!pattern) return false;
  // Convert robots.txt globs (`*`, `$`) into a regex.
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  const anchored = escaped.endsWith("\\$")
    ? `^${escaped.slice(0, -2)}$`
    : `^${escaped}`;
  try {
    return new RegExp(anchored).test(path);
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------------------
// HTML summarisation
// ---------------------------------------------------------------------------
const decode = (s: string): string =>
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

const PARAGRAPH_LIMIT = 4;
const IMAGE_LIMIT = 4;

export const summarizeHtml = (
  html: string,
  base: URL,
): {
  title: string | null;
  h1: string | null;
  summary: string | null;
  paragraphs: string[];
  images: string[];
} => {
  const titleM = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const h1M = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  let descr: string | null = null;
  const metaRe = /<meta\b[^>]*?>/gi;
  for (const tag of html.match(metaRe) ?? []) {
    const nameM = tag.match(/name\s*=\s*"([^"]+)"|name\s*=\s*'([^']+)'/i);
    const propM = tag.match(/property\s*=\s*"([^"]+)"|property\s*=\s*'([^']+)'/i);
    const name = (nameM?.[1] ?? nameM?.[2] ?? propM?.[1] ?? propM?.[2] ?? "").toLowerCase();
    if (name !== "description" && name !== "og:description") continue;
    const cM = tag.match(/content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i);
    const c = (cM?.[1] ?? cM?.[2] ?? "").trim();
    if (c) {
      descr = decode(c);
      if (name === "description") break;
    }
  }
  const paragraphs: string[] = [];
  const pRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let pm: RegExpExecArray | null;
  while ((pm = pRe.exec(html)) !== null && paragraphs.length < PARAGRAPH_LIMIT) {
    const text = decode(stripTags(pm[1] ?? ""));
    if (text.length < 60) continue;
    paragraphs.push(text.length > 500 ? `${text.slice(0, 499)}…` : text);
  }
  const summary =
    descr || (paragraphs[0] ? (paragraphs[0].length > 220 ? `${paragraphs[0].slice(0, 219)}…` : paragraphs[0]) : null);

  const images: string[] = [];
  const seenImg = new Set<string>();
  const imgRe = /<img\b[^>]*?\bsrc\s*=\s*("([^"]+)"|'([^']+)')/gi;
  let im: RegExpExecArray | null;
  while ((im = imgRe.exec(html)) !== null && images.length < IMAGE_LIMIT) {
    const raw = (im[2] ?? im[3] ?? "").trim();
    if (!raw || raw.startsWith("data:")) continue;
    let abs: URL;
    try {
      abs = new URL(raw, base);
    } catch {
      continue;
    }
    if (abs.protocol !== "http:" && abs.protocol !== "https:") continue;
    const url = abs.toString();
    if (seenImg.has(url)) continue;
    seenImg.add(url);
    images.push(url);
  }

  return {
    title: titleM?.[1] ? decode(titleM[1]) : null,
    h1: h1M?.[1] ? decode(stripTags(h1M[1])) : null,
    summary,
    paragraphs,
    images,
  };
};

// ---------------------------------------------------------------------------
// Team extraction (heuristic V1).
// We look on team-kind pages for "Name, Credentials" patterns near
// portrait-shaped images and lift them as `{name, credentials, photo, bio}`.
// This is intentionally cheap — a real extractor lives in V2.
// ---------------------------------------------------------------------------
const CRED_RE =
  /\b(LCSW|LMFT|LPC|LPCC|LMHC|LCMHC|LICSW|LCPC|LMSW|LMHC-S|MFT|MA|MS|MSW|MD|DO|PsyD|PhD|EdD|RN|APRN|PMHNP|NP|NCC|RYT|CADC|BCBA|BCBA-D)\b/i;

export interface TeamCandidate {
  name: string;
  credentials: string | null;
  photo: string | null;
  bio: string | null;
}

export const extractTeamFromPages = (pages: PageRecord[]): TeamCandidate[] => {
  const teamPage = pages.find((p) => p.kind === "team");
  if (!teamPage) return [];
  const out: TeamCandidate[] = [];
  const seen = new Set<string>();
  for (const para of teamPage.paragraphs) {
    // Credential blob can mix case (PhD, PsyD, EdD) — match a leading
    // capital then a short run of letters/punct, then validate against
    // the credential whitelist with CRED_RE.
    // Match "Firstname Lastname[, Mi.], <CRED>[, <CRED>...]" — stop the
    // credential blob at the first non-credential token (a regular word
    // like "is", "brings", or sentence end). Without this stop, a
    // greedy match would swallow the rest of the bio paragraph.
    const m = para.match(
      /^([A-Z][A-Za-z'’.\-]+(?:\s+[A-Z][A-Za-z'’.\-]+){1,3})\s*,\s*([A-Z][A-Za-z][A-Za-z0-9.\-]*(?:\s*[,\/]\s*[A-Z][A-Za-z][A-Za-z0-9.\-]*){0,5})/,
    );
    if (!m) continue;
    const name = m[1]!.trim();
    const credBlob = m[2]!.replace(/[.,]+$/, "").trim();
    if (!CRED_RE.test(credBlob)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      credentials: credBlob,
      photo: teamPage.images[out.length] ?? null,
      bio: para.length > name.length + credBlob.length + 4
        ? para.slice(name.length + credBlob.length + 2).replace(/^[\s,]+/, "")
        : null,
    });
    if (out.length >= 6) break;
  }
  return out;
};

export const currentWebsitePagesSource = new CurrentWebsitePagesSource();
