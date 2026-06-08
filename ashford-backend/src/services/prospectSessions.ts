import { randomBytes, createHash } from "node:crypto";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, portalProspectSessions } from "@workspace/db";
import { env } from "../lib/env";

/**
 * LOT 1.3 — prospect-session cookie minting + validation.
 *
 * The cookie name is scoped to the portal slug (`ash_prospect_<slug>`)
 * so a prospect visiting two distinct portals doesn't carry a session
 * across them. The cookie value is a 32-byte random token, base64url
 * encoded; only SHA-256(token) is persisted. On each cart write we
 * recompute the hash from the cookie value and check it against the
 * row keyed by (portal_id, token_hash).
 *
 * Cookie attributes:
 *   httpOnly: true            — JS in the portal page can't read it,
 *                               so an XSS payload can't exfiltrate.
 *   sameSite: "lax"           — survives the GET /p/:slug?t=... entry
 *                               link from an external mail client.
 *   secure: production only   — dev/staging http stays usable.
 *   path:   /                 — must be sent on /api/public/...
 *   maxAge: 90d (token TTL)   — matches access-token expiry.
 */

const COOKIE_PREFIX = "ash_prospect_";
const TTL_MS = 90 * 24 * 60 * 60 * 1000;

export const cookieNameForSlug = (slug: string): string =>
  `${COOKIE_PREFIX}${slug.toLowerCase()}`;

const hash = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const truncateUa = (ua: string | undefined): string | null => {
  if (!ua) return null;
  return ua.length > 512 ? ua.slice(0, 512) : ua;
};

const cookieOptions = (slug: string) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.nodeEnv === "production",
  path: "/",
  maxAge: TTL_MS,
  // The cookie itself isn't slug-scoped at the browser level (path:/),
  // but the NAME carries the slug so the row lookup is keyed on the
  // intended portal and a cookie minted for portal A is not honored
  // when posting to portal B. cookieNameForSlug is the single source.
  _slugNameTag: slug,
});

/**
 * Mints a fresh session row + sets the cookie. Used by GET /p/:slug
 * when no valid cookie is present on the request.
 */
export async function mintProspectSession(
  req: Request,
  res: Response,
  portalId: number,
  slug: string,
): Promise<{ tokenHash: string }> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hash(token);
  await db.insert(portalProspectSessions).values({
    portalId,
    tokenHash,
    ip: req.ip ?? null,
    userAgent: truncateUa(req.get("user-agent")),
  });
  const { _slugNameTag: _unused, ...opts } = cookieOptions(slug);
  void _unused;
  res.cookie(cookieNameForSlug(slug), token, opts);
  return { tokenHash };
}

export interface ProspectSessionMatch {
  ok: true;
  session: { id: number; portalId: number; tokenHash: string };
}
export interface ProspectSessionMiss {
  ok: false;
  reason: "no_cookie" | "unknown_token" | "wrong_portal";
}
export type ProspectSessionResult =
  | ProspectSessionMatch
  | ProspectSessionMiss;

/**
 * Validates the incoming cookie against the session table. Does NOT
 * mint — callers that want mint-on-miss should call mintProspectSession
 * after handling the miss case explicitly. Bumps last_seen_at on hit.
 */
export async function validateProspectSession(
  req: Request,
  portalId: number,
  slug: string,
): Promise<ProspectSessionResult> {
  const cookies = req.cookies as Record<string, string> | undefined;
  const raw = cookies?.[cookieNameForSlug(slug)];
  if (!raw) return { ok: false, reason: "no_cookie" };
  const tokenHash = hash(raw);
  const [row] = await db
    .select()
    .from(portalProspectSessions)
    .where(eq(portalProspectSessions.tokenHash, tokenHash))
    .limit(1);
  if (!row) return { ok: false, reason: "unknown_token" };
  if (row.portalId !== portalId)
    return { ok: false, reason: "wrong_portal" };
  // Best-effort bump — don't fail the request if it errors.
  void db
    .update(portalProspectSessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(portalProspectSessions.id, row.id))
    .catch(() => undefined);
  return {
    ok: true,
    session: { id: row.id, portalId: row.portalId, tokenHash: row.tokenHash },
  };
}
