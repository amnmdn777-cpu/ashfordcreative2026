import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { db, leads as leadsTbl } from "@workspace/db";
import { eq } from "drizzle-orm";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { ensurePortalForLead } from "./portals";
import { getSharedPuppeteerBrowser } from "./templateScreenshot";

/**
 * Generates a silent, mobile + email-friendly MP4 walkthrough of the
 * prospect portal preview: a tall full-page screenshot panned vertically
 * over 30 seconds at 1280×720, with five bilingual caption cards burned
 * in via ffmpeg drawtext. Designed so the rep can drop the video into
 * a follow-up email / WhatsApp / SMS and the prospect sees their site
 * scroll on its own without having to click a tracked link.
 *
 * Why a panned screenshot + ffmpeg rather than CDP screencast? Replit's
 * Reserved VM doesn't reliably stream 30 s of headless Chrome frames
 * without occasional hiccups, and a single drawtext pipeline gives us
 * deterministic timing for the captions. The output is ~4-7 MB which
 * fits inside Gmail's 25 MB attachment cap easily and plays inline on
 * iMessage/iOS Mail/Outlook with no extra player chrome.
 */

const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;
const DURATION_SEC = 30;
const FPS = 30;
const MAX_PAGE_HEIGHT = 8000; // safety cap so a runaway preview doesn't blow memory

const firstNameOf = (full: string): string => {
  const stripped = full
    .replace(/^(?:dr|mr|mrs|ms|mx|prof)\.?\s+/i, "")
    .trim();
  const tok = stripped.split(/\s+/)[0]?.replace(/[,.]+$/, "") ?? full;
  return tok && tok.length > 0 ? tok : "there";
};

// ffmpeg drawtext is fussy about ':', '\', ',', "'" inside the text=
// argument. Escape exactly what drawtext escapes (see ffmpeg-filters docs).
const escapeDrawtext = (s: string): string =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/,/g, "\\,")
    .replace(/%/g, "\\%");

interface Caption {
  from: number;
  to: number;
  text: string;
}

const captionsFor = (
  locale: string,
  firstName: string,
  practice: string,
): Caption[] => {
  const isEs = locale === "es";
  // Keep each line <= ~26 chars so it fits 1 line at fontsize=44 on a
  // 1280 wide canvas without text wrap; longer practice names are
  // truncated with an ellipsis. The 6-second cadence (5 cards * 6 s =
  // 30 s) leaves enough time for the eye to read each card while the
  // page underneath keeps scrolling.
  const practiceShort =
    practice.length > 26 ? practice.slice(0, 25).trim() + "…" : practice;
  return isEs
    ? [
        { from: 0, to: 6, text: `Hola ${firstName}` },
        { from: 6, to: 12, text: "Tu sitio está listo" },
        { from: 12, to: 18, text: `Hecho para ${practiceShort}` },
        { from: 18, to: 24, text: "Apruébalo cuando quieras" },
        { from: 24, to: 30, text: "ashfordcreative.org" },
      ]
    : [
        { from: 0, to: 6, text: `Hi ${firstName}` },
        { from: 6, to: 12, text: "Your site is ready" },
        { from: 12, to: 18, text: `Built for ${practiceShort}` },
        { from: 18, to: 24, text: "Approve it whenever" },
        { from: 24, to: 30, text: "ashfordcreative.org" },
      ];
};

const SYSTEM_FONT_CANDIDATES = [
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
  "/nix/store/*-dejavu-fonts-*/share/fonts/truetype/DejaVuSans-Bold.ttf",
  "/System/Library/Fonts/Helvetica.ttc",
  "C:\\Windows\\Fonts\\arialbd.ttf",
];

let cachedFontPath: string | null = null;

/**
 * Locate a TrueType font for ffmpeg drawtext. Tries common system paths
 * first (Linux/Replit usually has DejaVu, macOS has Helvetica, Windows
 * has Arial), then falls back to fetching Inter-Bold from the public
 * rsms/inter repo and caching it under /tmp. Returned path is safe to
 * embed in an ffmpeg fontfile= argument on the same machine; we only
 * normalise backslashes so the ffmpeg parser doesn't choke on Windows
 * paths during local dev.
 */
const resolveFontFile = async (): Promise<string> => {
  if (cachedFontPath) return cachedFontPath;

  for (const candidate of SYSTEM_FONT_CANDIDATES) {
    // Expand glob in /nix/store path manually (Nix-based images on
    // Replit). Plain `existsSync` is faster but doesn't expand globs.
    if (candidate.includes("*")) {
      try {
        const dir = path.dirname(candidate.split("*")[0]!);
        const entries = await fs.readdir(dir).catch(() => [] as string[]);
        const tail = candidate.split("*").pop() ?? "";
        const match = entries
          .map((entry) => path.join(dir, entry, tail))
          .find(async (p) => {
            try {
              await fs.access(p);
              return true;
            } catch {
              return false;
            }
          });
        if (match) {
          cachedFontPath = match;
          return match;
        }
      } catch {
        // ignore - try next candidate
      }
      continue;
    }
    try {
      await fs.access(candidate);
      cachedFontPath = candidate;
      return candidate;
    } catch {
      // not present, try next
    }
  }

  // Fallback: fetch Inter-Bold and cache it to /tmp. Same upstream the
  // OG renderer uses so we don't add a new external dep.
  const tmpFont = path.join(os.tmpdir(), "ashford-preview-video-font.ttf");
  try {
    await fs.access(tmpFont);
    cachedFontPath = tmpFont;
    return tmpFont;
  } catch {
    // fetch
  }
  const res = await fetch(
    "https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Bold.otf",
  );
  if (!res.ok) {
    throw new Error(
      `Failed to fetch fallback font (HTTP ${res.status}); install dejavu or inter system-wide.`,
    );
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(tmpFont, buf);
  cachedFontPath = tmpFont;
  return tmpFont;
};

// Resolve an ffmpeg binary in this order:
//   1. FFMPEG_PATH env var (manual override, useful for ops)
//   2. ffmpeg-static (dynamic import; works locally on Windows/macOS
//      where Nix isn't an option)
//   3. plain "ffmpeg" on PATH (Replit Nix sandbox ships pkgs.ffmpeg
//      from replit.nix so this is the production path)
// We never throw here; instead we return "ffmpeg" and let spawn fail
// at run time so the caller gets a clear stderr in the error message.
const resolveFfmpeg = async (): Promise<string> => {
  const envOverride = process.env.FFMPEG_PATH;
  if (envOverride) return envOverride;
  try {
    const mod = (await import("ffmpeg-static")) as
      | { default?: string | null }
      | string
      | null;
    const candidate =
      typeof mod === "string"
        ? mod
        : mod && typeof mod === "object" && "default" in mod
          ? (mod.default ?? null)
          : null;
    if (candidate) return candidate;
  } catch {
    // ffmpeg-static not installed for this platform (or not installed
    // at all). Fall through to system PATH lookup.
  }
  return "ffmpeg";
};

const runFfmpeg = (binary: string, args: string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    const proc = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      // Cap the buffered stderr so a verbose ffmpeg log doesn't OOM.
      if (stderr.length > 64_000) stderr = stderr.slice(-32_000);
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-1000)}`));
    });
  });

/**
 * Render the preview portal to an MP4. Returns the buffer plus a
 * filename-safe slug derived from the practice + lead name so the rep's
 * browser saves it as something the prospect will recognise rather than
 * a hash. Errors propagate so the route handler can surface them as
 * 500s with a JSON message.
 */
export const renderLeadPreviewVideo = async (
  leadId: number,
): Promise<{ video: Buffer; filename: string; mime: string }> => {
  const [lead] = await db
    .select()
    .from(leadsTbl)
    .where(eq(leadsTbl.id, leadId))
    .limit(1);
  if (!lead) throw new Error(`Lead ${leadId} not found`);

  const portal = await ensurePortalForLead(leadId);
  const previewUrl = `${env.siteBaseUrl}/preview/${encodeURIComponent(
    portal.slug,
  )}?t=${encodeURIComponent(portal.accessToken)}&internal=1&video=1`;

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ashford-video-"));
  const browser = await getSharedPuppeteerBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({
      width: VIDEO_WIDTH,
      height: 800,
      deviceScaleFactor: 1,
    });
    await page.goto(previewUrl, {
      waitUntil: "networkidle2",
      timeout: 35_000,
    });

    // Hide rep-only overlays and floating chat / CTA bubbles. Same set
    // as leadPreviewPdf so what the prospect sees in the video matches
    // what they would see in the brochure PDF.
    await page.evaluate(() => {
      const hideSelectors = [
        "[data-portal-toolbar]",
        "[data-preview-controls]",
        "[data-rep-overlay]",
        "[data-floating-cta]",
        ".chatbot-launcher",
        ".CrisisFloatingButton",
        "[aria-label='Help']",
      ];
      const style = document.createElement("style");
      style.textContent =
        hideSelectors.join(",") +
        " { display: none !important; } html { scroll-behavior: auto; }";
      document.head.appendChild(style);
    });
    await new Promise((r) => setTimeout(r, 1200));

    // Constrain the captured page height so a runaway preview (e.g.
    // an unintended infinite-scroll demo) doesn't produce a 50k-px PNG
    // and OOM ffmpeg. 8000 px is enough for any realistic site we ship.
    await page.evaluate((maxH: number) => {
      const body = document.body;
      if (body && body.scrollHeight > maxH) {
        body.style.maxHeight = `${maxH}px`;
        body.style.overflow = "hidden";
      }
    }, MAX_PAGE_HEIGHT);

    const screenshotPath = path.join(tmpDir, "page.png");
    await page.screenshot({
      path: screenshotPath as `${string}.png`,
      fullPage: true,
      type: "png",
    });

    const first = firstNameOf(lead.name);
    const caps = captionsFor(lead.locale, first, lead.practice);
    const fontPath = await resolveFontFile();
    // ffmpeg parses fontfile= with backslashes as escapes; on Windows
    // local dev replace them with forward slashes (libavfilter accepts
    // both).
    const fontFileArg = fontPath.replace(/\\/g, "/");

    const drawtextChain = caps
      .map((c) => {
        const txt = escapeDrawtext(c.text);
        // Bottom-center caption with a translucent black border and a
        // soft shadow box for readability over any background colour
        // the template ships with. fontsize scales with width so the
        // captions stay legible on mobile email previews where the
        // video is downscaled to ~360 px wide.
        return [
          `drawtext=fontfile='${fontFileArg}'`,
          `text='${txt}'`,
          `fontcolor=white`,
          `fontsize=52`,
          `borderw=4`,
          `bordercolor=0x000000aa`,
          `box=1`,
          `boxcolor=0x00000088`,
          `boxborderw=24`,
          `x=(w-text_w)/2`,
          `y=h-180`,
          `enable='between(t,${c.from},${c.to})'`,
        ].join(":");
      })
      .join(",");

    // Pan filter: scale the screenshot to the video width, then crop a
    // 1280×720 window whose y-offset linearly interpolates from 0 to
    // (height-720) across the clip. `min()` clamps the pan when the
    // page is shorter than 720 px so we don't get an empty band at the
    // bottom.
    const filter =
      `[0:v]scale=${VIDEO_WIDTH}:-2,setsar=1[scaled];` +
      `[scaled]crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:0:'min((ih-${VIDEO_HEIGHT})*(t/${DURATION_SEC}),max(0,ih-${VIDEO_HEIGHT}))'[panned];` +
      `[panned]${drawtextChain}[vout]`;

    const outPath = path.join(tmpDir, "out.mp4");
    const ffmpegBin = await resolveFfmpeg();
    await runFfmpeg(ffmpegBin, [
      "-y",
      "-loop", "1",
      "-framerate", String(FPS),
      "-t", String(DURATION_SEC),
      "-i", screenshotPath,
      "-filter_complex", filter,
      "-map", "[vout]",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-profile:v", "baseline",
      "-level", "3.1",
      "-r", String(FPS),
      "-preset", "veryfast",
      "-movflags", "+faststart",
      outPath,
    ]);

    const video = await fs.readFile(outPath);

    const slug = `${lead.practice}-${lead.name}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64);
    const filename = `ashford-${slug || `lead-${leadId}`}-preview.mp4`;

    logger.info(
      { leadId, slug: portal.slug, bytes: video.length },
      "lead preview video generated",
    );
    return { video, filename, mime: "video/mp4" };
  } finally {
    await page.close().catch(() => undefined);
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
};
