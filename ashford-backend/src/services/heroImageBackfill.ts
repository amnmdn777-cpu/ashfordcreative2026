import { sql } from "drizzle-orm";
import { db, prospectPortals, leads } from "@workspace/db";
import { logger } from "../lib/logger";

/**
 * One-shot backfill (#224, architect review 2026-05): null out any
 * `prospectPortals.customizations.heroPhotoUrl` that does NOT come from
 * one of the three allowed sources — Psychology Today, Headway, or the
 * prospect's own current website host. Founder Candice's locked photo
 * policy explicitly permits PT/Headway portrait CDNs as well as the
 * first-party site; only Google Places / Yelp / AI / unrelated third-
 * party hosts (the Jamonte case) need to be cleared.
 *
 * The previous version of this backfill was over-destructive: it kept
 * only `currentWebsite`-host URLs and would have nulled valid PT and
 * Headway photos. The TRUSTED_HOSTS allow-list below preserves both
 * directories' image CDNs, matching the `previewContent.ts` policy.
 *
 * Idempotent and bounded: runs once at boot, advisory-lock guarded so
 * multi-replica deploys don't double-process. NEW writes are correct
 * by construction (see previewContent.ts host gate); this backfill
 * exists ONLY to clean historical rows.
 */
const TRUSTED_HOSTS: readonly string[] = [
  // Psychology Today portrait CDN
  "psychologytoday.com",
  "cdn.psychologytoday.com",
  "post.psychologytoday.com",
  // Headway portrait CDN
  "headway.co",
  "d3atagt0rnqk7k.cloudfront.net",
];
const ADVISORY_LOCK_KEY = 9_240_001; // arbitrary, unique to this backfill
const BACKFILL_DELAY_MS = 45_000;

const STARTUP = Symbol("hero-backfill-startup-guard");
const g = globalThis as unknown as { [STARTUP]?: boolean };

export function startHeroImageBackfill(): void {
  if (g[STARTUP]) return;
  g[STARTUP] = true;
  setTimeout(() => {
    runBackfillOnce().catch((err) =>
      logger.warn(
        { err: (err as Error).message },
        "hero-image-backfill: unexpected failure (will not retry until next boot)",
      ),
    );
  }, BACKFILL_DELAY_MS);
}

function trustedHost(currentWebsite: string | null | undefined): string | null {
  if (!currentWebsite) return null;
  try {
    const u = new URL(
      currentWebsite.startsWith("http")
        ? currentWebsite
        : `https://${currentWebsite}`,
    );
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function hostMatches(rawUrl: string, host: string): boolean {
  try {
    const u = new URL(rawUrl);
    const h = u.hostname.toLowerCase().replace(/^www\./, "");
    return h === host || h.endsWith(`.${host}`);
  } catch {
    return false;
  }
}

async function runBackfillOnce(): Promise<void> {
  const lockResult = await db.execute(
    sql`SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY}) AS locked`,
  );
  const locked = (lockResult.rows?.[0] as { locked?: boolean })?.locked;
  if (!locked) {
    logger.info(
      { key: ADVISORY_LOCK_KEY },
      "hero-image-backfill: another replica holds the advisory lock; skipping",
    );
    return;
  }
  try {
    const rows = await db
      .select({
        portalId: prospectPortals.id,
        slug: prospectPortals.slug,
        leadId: prospectPortals.leadId,
        customizations: prospectPortals.customizations,
        currentWebsite: leads.currentWebsite,
      })
      .from(prospectPortals)
      .innerJoin(leads, sql`${leads.id} = ${prospectPortals.leadId}`);

    let scanned = 0;
    let cleared = 0;
    let preservedTrusted = 0;
    for (const row of rows) {
      scanned += 1;
      const heroUrl = row.customizations?.heroPhotoUrl;
      if (!heroUrl) continue;
      // Allow-list pass 1: PT/Headway CDN hosts are explicitly trusted
      // by the founder's photo policy regardless of the prospect's own
      // currentWebsite. We MUST preserve these.
      const trustedDirectory = TRUSTED_HOSTS.some((h) =>
        hostMatches(heroUrl, h),
      );
      if (trustedDirectory) {
        preservedTrusted += 1;
        continue;
      }
      // Allow-list pass 2: first-party host (prospect's own site).
      const host = trustedHost(row.currentWebsite);
      const isFirstParty = host ? hostMatches(heroUrl, host) : false;
      if (isFirstParty) continue;
      const next = { ...row.customizations, heroPhotoUrl: undefined };
      // Strip the explicit undefined so JSON storage doesn't carry the key
      delete (next as { heroPhotoUrl?: string }).heroPhotoUrl;
      await db
        .update(prospectPortals)
        .set({ customizations: next, updatedAt: new Date() })
        .where(sql`${prospectPortals.id} = ${row.portalId}`);
      cleared += 1;
      logger.info(
        { slug: row.slug, leadId: row.leadId, host },
        "hero-image-backfill: cleared disallowed heroPhotoUrl",
      );
    }
    logger.info(
      { scanned, cleared, preservedTrusted },
      "hero-image-backfill: complete",
    );
  } finally {
    await db.execute(
      sql`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`,
    );
  }
}
