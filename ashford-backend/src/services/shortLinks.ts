/**
 * Public URL shortener. Used to keep outbound SMS bodies under one segment
 * (160 GSM-7 chars) and to give reps a tidy link to share. Codes are
 * unguessable enough for a casual scan but NOT a security boundary - the
 * underlying `targetUrl` already carries its own access token.
 *
 * The `/s/:code` route returns 302 to `targetUrl` and asynchronously bumps
 * the click counter. We don't await the counter update so the redirect stays
 * snappy even if the DB write hiccups.
 */

import { db, shortLinks, type ShortLink } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { env } from "../lib/env";
import { logger } from "../lib/logger";

// 56 unambiguous characters: drops 0/O/o, 1/I/l. base56 ≈ log2(56) ≈ 5.8 bits
// per char, so 7 chars ≈ 41 bits of entropy - more than enough headroom for
// an Ashford-scale prospect list.
const ALPHABET =
  "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const generateCode = (length: number): string => {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
};

export type CreateShortLinkOptions = {
  leadId?: number;
  purpose?: string;
};

export type CreateShortLinkResult = {
  code: string;
  url: string;
};

/**
 * Mint a short link for an arbitrary target URL. The returned `url` is the
 * public-facing redirect endpoint (e.g. `https://www.ashfordcreative.org/s/abc1234`).
 *
 * Retries up to 5 times on unique-constraint collisions, growing the code
 * length each retry so we never get stuck on a hot bucket.
 */
/**
 * Idempotent variant: returns the existing short link for this lead+purpose+
 * targetUrl tuple if one already exists, otherwise mints a new one. Use this
 * for read endpoints (e.g. the dashboard portal panel) so callers don't
 * stamp out a fresh row on every page load.
 */
export const getOrCreateShortLink = async (
  targetUrl: string,
  opts: CreateShortLinkOptions = {},
): Promise<CreateShortLinkResult> => {
  if (opts.leadId != null && opts.purpose) {
    const [existing] = await db
      .select({ code: shortLinks.code, targetUrl: shortLinks.targetUrl })
      .from(shortLinks)
      .where(
        and(
          eq(shortLinks.leadId, opts.leadId),
          eq(shortLinks.purpose, opts.purpose),
          eq(shortLinks.targetUrl, targetUrl),
        ),
      )
      .limit(1);
    if (existing) {
      return {
        code: existing.code,
        url: `${env.publicBaseUrl}/s/${existing.code}`,
      };
    }
  }
  return createShortLink(targetUrl, opts);
};

export const createShortLink = async (
  targetUrl: string,
  opts: CreateShortLinkOptions = {},
): Promise<CreateShortLinkResult> => {
  const baseLength = 7;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode(baseLength + attempt);
    try {
      const [row] = await db
        .insert(shortLinks)
        .values({
          code,
          targetUrl,
          leadId: opts.leadId,
          purpose: opts.purpose,
        })
        .returning();
      return {
        code: row.code,
        url: `${env.publicBaseUrl}/s/${row.code}`,
      };
    } catch (err) {
      lastErr = err;
      // Most likely a unique-violation on `code`. Retry with a longer code.
      logger.warn(
        { err, attempt, code },
        "shortLinks: insert collision, retrying with longer code",
      );
    }
  }
  throw new Error(
    `Could not mint a unique short link after 5 attempts: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`,
  );
};

/**
 * Look up the destination URL for a short code and asynchronously increment
 * the click counter. Returns `null` if the code does not exist.
 */
export const resolveShortLink = async (
  code: string,
): Promise<ShortLink | null> => {
  const [row] = await db
    .select()
    .from(shortLinks)
    .where(eq(shortLinks.code, code))
    .limit(1);
  if (!row) return null;
  // Fire-and-forget click count bump. Use a SQL increment so concurrent
  // resolves don't clobber each other.
  void db
    .update(shortLinks)
    .set({
      clickCount: sql`${shortLinks.clickCount} + 1`,
      lastClickAt: new Date(),
    })
    .where(eq(shortLinks.id, row.id))
    .catch((err) =>
      logger.warn({ err, code }, "shortLinks: click counter bump failed"),
    );
  return row;
};
