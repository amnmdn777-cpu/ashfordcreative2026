import { Router, type IRouter } from "express";
import { z } from "zod";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

const QuerySchema = z.object({
  url: z.string().url(),
});

const ALLOWED_HOSTS = new Set<string>([
  "anchor.fm",
  "feeds.simplecast.com",
  "feeds.megaphone.fm",
  "feeds.buzzsprout.com",
  "feeds.transistor.fm",
  "feeds.libsyn.com",
  "rss.art19.com",
  "feed.podbean.com",
  "feeds.captivate.fm",
  "feeds.acast.com",
  "feeds.fireside.fm",
]);

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function pickTag(item: string, tag: string): string | null {
  // Match either CDATA-wrapped or raw inner text for the given tag.
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = item.match(re);
  if (!m) return null;
  let inner = m[1].trim();
  const cdata = inner.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdata) inner = cdata[1];
  return decodeXmlEntities(inner).trim();
}

function pickDuration(item: string): string | null {
  // <itunes:duration> appears as either seconds or H:MM:SS / MM:SS.
  const m = item.match(/<itunes:duration[^>]*>([\s\S]*?)<\/itunes:duration>/i);
  if (!m) return null;
  const raw = m[1].trim();
  if (/^\d+$/.test(raw)) {
    const sec = Number(raw);
    const min = Math.round(sec / 60);
    return `${min} min`;
  }
  const parts = raw.split(":").map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return raw;
  let totalSec = 0;
  if (parts.length === 3) totalSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
  else if (parts.length === 2) totalSec = parts[0] * 60 + parts[1];
  else totalSec = parts[0];
  const min = Math.round(totalSec / 60);
  return `${min} min`;
}

function formatDate(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type Episode = { title: string; date: string | null; duration: string | null; link: string | null };

function parseRss(xml: string, limit: number): Episode[] {
  const items: Episode[] = [];
  const re = /<item\b[\s\S]*?<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null && items.length < limit) {
    const item = match[0];
    const title = pickTag(item, "title");
    if (!title) continue;
    items.push({
      title,
      date: formatDate(pickTag(item, "pubDate")),
      duration: pickDuration(item),
      link: pickTag(item, "link"),
    });
  }
  return items;
}

// Lightweight RSS proxy: validates the host, fetches the feed, parses item titles + pubDate
// + itunes:duration with simple regex, returns up to N episodes. Used by the PodcastEmbed
// add-on so the module is genuinely feed-driven instead of static.
router.get("/podcast/episodes", async (req, res) => {
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "url query param is required" });
    return;
  }
  const target = new URL(parsed.data.url);
  if (target.protocol !== "https:") {
    res.status(400).json({ error: "https feeds only" });
    return;
  }
  const host = target.hostname.toLowerCase();
  const allowed = [...ALLOWED_HOSTS].some((h) => host === h || host.endsWith(`.${h}`));
  if (!allowed) {
    res.status(400).json({ error: "feed host not in allow-list" });
    return;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const r = await fetch(target.toString(), {
      signal: controller.signal,
      headers: { "User-Agent": "AshfordCreative/1.0 (+podcast-embed)", Accept: "application/rss+xml,application/xml,text/xml" },
    });
    clearTimeout(timer);
    if (!r.ok) {
      res.status(502).json({ error: `upstream ${r.status}` });
      return;
    }
    const xml = await r.text();
    if (xml.length > 8_000_000) {
      res.status(413).json({ error: "feed too large" });
      return;
    }
    const channelTitle = pickTag(xml.slice(0, 50_000).replace(/<item\b[\s\S]*$/i, ""), "title");
    const episodes = parseRss(xml, 6);
    res.set("Cache-Control", "public, max-age=600");
    res.json({ title: channelTitle ?? "Podcast", episodes });
  } catch (err) {
    logger.warn({ err, url: target.toString() }, "podcast rss fetch failed");
    res.status(502).json({ error: "feed unavailable" });
  }
});

export default router;
