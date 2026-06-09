import { promises as fs } from "node:fs";
import path from "node:path";
import puppeteer, { type Browser } from "puppeteer";
import { env } from "../lib/env";
import { logger } from "../lib/logger";

/**
 * Captures and caches above-the-fold screenshots of public template pages so
 * they can be embedded as the "hero" image in outbound preview emails. The
 * image is what makes a prospect feel "they actually built me a site" instead
 * of "this is the same generic CTA email I get from every vendor".
 *
 * Cache strategy: filesystem-only, keyed on `${slug}` plus a short hash of the
 * viewport. Two reasons we don't bother with a memory layer:
 *   1. Each PNG is ~150 KB; we'd burn RAM for marginal latency savings.
 *   2. The api-server runs single-tenant on Replit Reserved VM - the OS page
 *      cache already keeps hot files in memory.
 */

const CACHE_DIR = path.join(
  process.cwd(),
  ".cache",
  "preview-screenshots",
);

const VIEWPORT = { width: 1200, height: 800 };

// Whitelist of slugs we'll screenshot. Anything else returns 404 from the
// route - prevents the endpoint from being abused as a generic
// screenshot-as-a-service for arbitrary URLs.
//
// We accept either a current TemplateKey or a legacy alias (clinic /
// statement / etc.) so that historical drip emails referencing the old
// slugs still resolve to a valid screenshot through the alias map.
import {
  TEMPLATES as CURRENT_TEMPLATES,
  LEGACY_TEMPLATE_ALIASES,
  type TemplateKey,
} from "@workspace/api-zod";

const CURRENT_KEYS = Object.keys(CURRENT_TEMPLATES) as TemplateKey[];
const LEGACY_KEYS = Object.keys(LEGACY_TEMPLATE_ALIASES);
const ALLOWED_SLUGS = new Set<string>([...CURRENT_KEYS, ...LEGACY_KEYS]);

export const isAllowedTemplateSlug = (slug: string): boolean =>
  ALLOWED_SLUGS.has(slug);

// Maps any allowed slug - current or legacy - to the canonical TemplateKey
// the live /template/<key> route understands. Used by the renderer below
// so a request for legacy "wellness_center" still produces a screenshot
// of the new garden template instead of a 404.
const canonicalSlug = (slug: string): string =>
  (LEGACY_TEMPLATE_ALIASES as Record<string, string>)[slug] ?? slug;

const cacheFilePath = (slug: string): string =>
  path.join(CACHE_DIR, `${slug}.png`);

/**
 * Browser is reused across captures within a single process to avoid the
 * 600-1200 ms cold-launch penalty on every email send. It's lazily created
 * and torn down only when the process exits - Chromium's resident memory is
 * around 90 MB which we're happy to pay for the latency win.
 *
 * If `puppeteer.launch()` rejects, we MUST clear the memoized promise; an
 * earlier version left the rejected promise cached, which permanently
 * broke every subsequent screenshot until the process restarted.
 */
let browserPromise: Promise<Browser> | null = null;

export const getSharedPuppeteerBrowser = (): Promise<Browser> => getBrowser();

const getBrowser = async (): Promise<Browser> => {
  if (browserPromise) {
    try {
      const browser = await browserPromise;
      if (browser.connected) return browser;
    } catch {
      // Last launch failed; fall through to a fresh attempt.
    }
    browserPromise = null;
  }
  const launching = puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });
  // Attach a catch BEFORE assigning so a failed launch doesn't poison
  // the cached promise for future calls.
  launching.catch(() => {
    if (browserPromise === launching) browserPromise = null;
  });
  browserPromise = launching;
  return launching;
};

const renderScreenshot = async (slug: string): Promise<Buffer> => {
  // Resolve legacy aliases to their canonical TemplateKey before hitting
  // the live /template/<key> route - historical drip emails still pass
  // values like "wellness_center" or "clinic" that no longer exist as
  // routes. The cache key (file path) keeps the *original* slug so we
  // don't have to re-render after an alias change.
  const url = `${env.siteBaseUrl}/template/${encodeURIComponent(canonicalSlug(slug))}`;
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ ...VIEWPORT, deviceScaleFactor: 2 });
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 20_000,
    });
    // The template route boots with an animated toolbar; give it a moment to
    // settle so we don't capture a half-rendered first paint.
    await new Promise((r) => setTimeout(r, 600));
    const buf = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height },
    });
    return Buffer.from(buf);
  } finally {
    await page.close().catch(() => undefined);
  }
};

export type CapturedScreenshot = {
  buffer: Buffer;
  cached: boolean;
};

/**
 * In-flight render dedupe - multiple concurrent requests for the same slug
 * share one Chromium render instead of fanning out (each render costs
 * ~5-7s of CPU + page memory). Without this, a burst of N email opens
 * after a cache expiry could spawn N parallel pages and OOM the process.
 *
 * We deliberately do NOT bound total concurrent renders across slugs:
 * the allowlist holds only 5 entries, so worst case is 5 concurrent
 * Chromium pages, which Chromium handles comfortably.
 */
const inflightCaptures = new Map<string, Promise<Buffer>>();

const captureWithDedupe = async (slug: string): Promise<Buffer> => {
  const existing = inflightCaptures.get(slug);
  if (existing) return existing;
  const promise = (async () => {
    const started = Date.now();
    const buffer = await renderScreenshot(slug);
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(cacheFilePath(slug), buffer);
    logger.info(
      { slug, ms: Date.now() - started, bytes: buffer.length },
      "captured template screenshot",
    );
    return buffer;
  })().finally(() => {
    inflightCaptures.delete(slug);
  });
  inflightCaptures.set(slug, promise);
  return promise;
};

/**
 * Returns a PNG buffer of the rendered template page. If the cache file
 * exists and is newer than `maxAgeMs`, it's returned directly. Otherwise a
 * fresh screenshot is captured, written to disk, and returned.
 */
export const captureTemplateScreenshot = async (
  slug: string,
  options: { maxAgeMs?: number; force?: boolean } = {},
): Promise<CapturedScreenshot> => {
  if (!isAllowedTemplateSlug(slug)) {
    throw new Error(`Unknown template slug: ${slug}`);
  }
  const maxAgeMs = options.maxAgeMs ?? 24 * 60 * 60 * 1000;
  const filePath = cacheFilePath(slug);

  if (!options.force) {
    try {
      const stat = await fs.stat(filePath);
      if (Date.now() - stat.mtimeMs < maxAgeMs) {
        const buffer = await fs.readFile(filePath);
        return { buffer, cached: true };
      }
    } catch {
      // Cache miss; fall through to capture.
    }
  }

  const buffer = await captureWithDedupe(slug);
  return { buffer, cached: false };
};

/**
 * Builds the absolute, publicly-fetchable URL of the screenshot. This is
 * what we embed in `<img src="...">` inside the email - the recipient's
 * mail client fetches it directly from the api-server.
 */
export const buildPreviewScreenshotUrl = (slug: string): string =>
  `${env.publicBaseUrl}/api/preview-screenshot/${encodeURIComponent(slug)}.png`;

// ---------------------------------------------------------------------------
// Per-portal (lead-contextual) screenshot
//
// The template screenshot above captures the static `/template/:slug` page -
// the same image for every prospect on the same template. That misses the
// whole point of a "we built you a site" hero: by the time the J+3/J+7
// touches go out, the rep has usually customized colors, logo, hero photo,
// and copy on the prospect's actual portal. Capturing `/preview/:slug?t=...`
// renders that customized state, so the email shows the prospect THEIR site,
// not a generic template.
//
// Cache strategy: per-slug PNG, 1-hour TTL. Short TTL because customizations
// are still being edited during the cadence; long enough to dedupe the
// burst of mail-client image fetches on a single send.
// ---------------------------------------------------------------------------

const PORTAL_VIEWPORT = { width: 1200, height: 800 };
const PORTAL_CACHE_TTL_MS = 60 * 60 * 1000;

const portalCacheFilePath = (slug: string): string =>
  path.join(CACHE_DIR, `portal-${slug}.png`);

const renderPortalScreenshot = async (
  slug: string,
  accessToken: string,
): Promise<Buffer> => {
  const url = `${env.siteBaseUrl}/preview/${encodeURIComponent(slug)}?t=${encodeURIComponent(accessToken)}`;
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ ...PORTAL_VIEWPORT, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 25_000 });
    await new Promise((r) => setTimeout(r, 800));
    const buf = await page.screenshot({
      type: "png",
      clip: {
        x: 0,
        y: 0,
        width: PORTAL_VIEWPORT.width,
        height: PORTAL_VIEWPORT.height,
      },
    });
    return Buffer.from(buf);
  } finally {
    await page.close().catch(() => undefined);
  }
};

const inflightPortalCaptures = new Map<string, Promise<Buffer>>();

const capturePortalWithDedupe = async (
  slug: string,
  accessToken: string,
): Promise<Buffer> => {
  const existing = inflightPortalCaptures.get(slug);
  if (existing) return existing;
  const promise = (async () => {
    const started = Date.now();
    const buffer = await renderPortalScreenshot(slug, accessToken);
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(portalCacheFilePath(slug), buffer);
    logger.info(
      { slug, ms: Date.now() - started, bytes: buffer.length },
      "captured portal screenshot",
    );
    return buffer;
  })().finally(() => {
    inflightPortalCaptures.delete(slug);
  });
  inflightPortalCaptures.set(slug, promise);
  return promise;
};

/**
 * Returns a PNG buffer of the prospect's actual customized portal. Uses the
 * same on-disk cache directory as template screenshots but with a `portal-`
 * prefix so the two namespaces never collide. Throws if capture fails - the
 * caller (route handler / email path) is responsible for graceful fallback.
 */
export const capturePortalScreenshot = async (
  slug: string,
  accessToken: string,
  options: { maxAgeMs?: number; force?: boolean } = {},
): Promise<CapturedScreenshot> => {
  const maxAgeMs = options.maxAgeMs ?? PORTAL_CACHE_TTL_MS;
  const filePath = portalCacheFilePath(slug);

  if (!options.force) {
    try {
      const stat = await fs.stat(filePath);
      if (Date.now() - stat.mtimeMs < maxAgeMs) {
        const buffer = await fs.readFile(filePath);
        return { buffer, cached: true };
      }
    } catch {
      // Cache miss; fall through to capture.
    }
  }

  const buffer = await capturePortalWithDedupe(slug, accessToken);
  return { buffer, cached: false };
};

/**
 * URL embedded in `<img src="...">` for the lead-contextual hero. Includes
 * the access token in the query string so the route handler can verify the
 * caller is allowed to read this portal's screenshot (defense against the
 * endpoint being abused as a generic screenshot service for arbitrary
 * portal slugs).
 */
export const buildPortalScreenshotUrl = (
  slug: string,
  accessToken: string,
): string =>
  `${env.publicBaseUrl}/api/portal-screenshot/${encodeURIComponent(slug)}.png?t=${encodeURIComponent(accessToken)}`;

/**
 * Best-effort warm-up that BLOCKS up to `timeoutMs` waiting for a portal
 * screenshot to be on disk before the caller sends an email containing the
 * `/api/portal-screenshot/...` URL.
 *
 * Why this exists: Gmail (and most webmail clients) proxy remote images
 * through their own fetcher. That fetcher gives up after a few seconds on
 * a slow response and caches the failure for the recipient's session, so
 * the image renders broken even though our route would have succeeded if
 * given a few more seconds. Pre-warming the cache before send guarantees
 * the proxy gets a fast response and the prospect actually sees the hero.
 *
 * Returns `true` if the cache is hot when this resolves, `false` if the
 * capture timed out or failed (in which case we still send the email and
 * fall back to on-demand capture on the recipient's image fetch - same
 * behaviour as before this helper existed).
 */
/**
 * Pre-warms the headless Chromium instance at server startup so the FIRST
 * portal-screenshot request (or warmPortalScreenshot call from a send) does
 * not pay the 600-1200ms `puppeteer.launch()` cold-start. Critical for the
 * email-send path: the founder reported that the very first preview email
 * shipped after a deploy consistently rendered with a broken hero because
 * Gmail's image proxy timed out while we were still bringing Chromium up.
 *
 * Idempotent - safely no-ops if the browser is already booted. Failures are
 * swallowed (logged) because a missing browser is a soft degradation: the
 * lazy `getBrowser()` call inside renderScreenshot will retry on the next
 * actual request. We never want the API to refuse to start because of it.
 */
export const warmBrowserOnStartup = async (): Promise<void> => {
  // Pre-warming launches a resident Chromium (~150-300MB) at boot. On a
  // memory-constrained host this spike trips the kernel OOM killer seconds
  // after "chromium warmed", crash-looping the whole API for a feature
  // (email-preview screenshots) that isn't on the login/dashboard path and
  // launches Chromium lazily on first use anyway.
  //
  // Therefore we SKIP the warm by default in production (memory-safe). Opt back
  // in on a host with enough RAM via ENABLE_BROWSER_WARM=true. DISABLE_BROWSER_WARM
  // is still honored everywhere for an explicit off-switch in dev.
  const disabled =
    process.env["DISABLE_BROWSER_WARM"] === "true" ||
    process.env["DISABLE_BROWSER_WARM"] === "1";
  const enabled = process.env["ENABLE_BROWSER_WARM"] === "true";
  const isProd = process.env["NODE_ENV"] === "production";
  if (disabled || (isProd && !enabled)) {
    logger.info(
      "puppeteer chromium warm skipped (memory-safe default; set ENABLE_BROWSER_WARM=true to opt in)",
    );
    return;
  }
  try {
    const started = Date.now();
    await getBrowser();
    logger.info(
      { ms: Date.now() - started },
      "puppeteer chromium warmed at startup",
    );
  } catch (err) {
    logger.warn(
      { err: (err as Error).message },
      "puppeteer chromium failed to warm at startup - will retry lazily on first capture",
    );
  }
};

export const warmPortalScreenshot = async (
  slug: string,
  accessToken: string,
  // Bumped 10s -> 25s on 2026-05 (#224): Gmail's image proxy was timing
  // out on cold-cache portals because the underlying Chromium render
  // routinely takes 12-18s for prospects with many crawled images. The
  // longer warm budget lets us populate the cache before the email is
  // shipped so the proxy fetch is a fast disk read instead of a live
  // Chromium spin-up.
  timeoutMs = 25_000,
): Promise<boolean> => {
  try {
    const result = await Promise.race([
      capturePortalScreenshot(slug, accessToken).then(() => true as const),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
    ]);
    if (!result) {
      // Timed out - still let the underlying capture finish in the
      // background so the cache populates for the next touch / opener.
      capturePortalScreenshot(slug, accessToken).catch(() => undefined);
    }
    return result;
  } catch {
    return false;
  }
};
