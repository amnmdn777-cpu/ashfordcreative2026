import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, repDialpadCredentials } from "@workspace/db";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import {
  decryptDialpadToken,
  encryptDialpadToken,
  isDialpadTokenCryptoConfigured,
} from "../lib/dialpadTokenCrypto";

/**
 * Dialpad OAuth 2.0 (authorization-code + PKCE) client.
 *
 * Reference: https://developers.dialpad.com/docs/oauth
 *   /oauth2/authorize → user-facing consent
 *   /oauth2/token     → exchange code or refresh token
 *   /oauth2/deauthorize → revoke a token (best-effort)
 *
 * We mount our endpoints under the API server so the prospect-side
 * `apiBase()` (which is dialpad.com or the operator override) is the
 * SAME host used for the OAuth round-trip — there is no separate
 * `oauth.dialpad.com`.
 */

const REQUIRED_SCOPES = [
  // Place outbound calls + send SMS on behalf of the user.
  "calls:write",
  "sms:write",
  // Read call metadata for the webhook ingest pipeline.
  "calls:read",
  // Vi transcripts + summaries for the rep's own calls.
  "recordings_export",
] as const;

export const dialpadOauthScopeString = (): string =>
  REQUIRED_SCOPES.join(" ");

export const isDialpadOauthConfigured = (): boolean =>
  !!(
    env.dialpadOauthClientId &&
    env.dialpadOauthClientSecret &&
    isDialpadTokenCryptoConfigured()
  );

const oauthBase = (): string => env.dialpadApiBaseUrl.replace(/\/$/, "");

export const buildAuthorizeUrl = (params: {
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string => {
  const u = new URL(`${oauthBase()}/oauth2/authorize`);
  u.searchParams.set("client_id", env.dialpadOauthClientId!);
  u.searchParams.set("redirect_uri", params.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", dialpadOauthScopeString());
  u.searchParams.set("state", params.state);
  u.searchParams.set("code_challenge", params.codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
};

// ---- PKCE helpers ----------------------------------------------------------

export const generatePkceVerifier = (): string =>
  crypto.randomBytes(48).toString("base64url");

export const pkceChallengeFor = (verifier: string): string =>
  crypto.createHash("sha256").update(verifier).digest("base64url");

export const generateState = (): string =>
  crypto.randomBytes(24).toString("base64url");

// ---- Token endpoint --------------------------------------------------------

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number; // seconds
  scope?: string;
};

const postTokenEndpoint = async (
  body: Record<string, string>,
): Promise<TokenResponse> => {
  const res = await fetch(`${oauthBase()}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: env.dialpadOauthClientId!,
      client_secret: env.dialpadOauthClientSecret!,
      ...body,
    }).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `dialpad oauth token failed: ${res.status} ${text.slice(0, 300)}`,
    );
  }
  return (await res.json()) as TokenResponse;
};

export const exchangeCodeForToken = async (params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<TokenResponse> =>
  postTokenEndpoint({
    grant_type: "authorization_code",
    code: params.code,
    code_verifier: params.codeVerifier,
    redirect_uri: params.redirectUri,
  });

const refreshAccessToken = async (
  refreshToken: string,
): Promise<TokenResponse> =>
  postTokenEndpoint({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

// Best-effort revoke. Dialpad's revoke endpoint name varies between
// `/oauth2/deauthorize` and `/oauth2/revoke` depending on tenant; we
// try the documented name and log (don't throw) on failure — the row
// is deleted regardless so the rep can re-Connect cleanly.
export const revokeAccessToken = async (token: string): Promise<void> => {
  try {
    const res = await fetch(`${oauthBase()}/oauth2/deauthorize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: env.dialpadOauthClientId!,
        client_secret: env.dialpadOauthClientSecret!,
        token,
      }).toString(),
    });
    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => "");
      logger.warn(
        { status: res.status, body: text.slice(0, 200) },
        "dialpad: token revoke returned non-2xx (continuing — local row will still be deleted)",
      );
    }
  } catch (err) {
    logger.warn({ err }, "dialpad: token revoke threw (non-fatal)");
  }
};

// ---- userinfo: pull dialpadUserId + email after a successful exchange -----

export const fetchDialpadUserInfo = async (
  accessToken: string,
): Promise<{ id: string; email: string | null }> => {
  const url = `${oauthBase()}/api/v2/users/me`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `dialpad users/me failed: ${res.status} ${text.slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as Record<string, unknown>;
  const id =
    typeof json.id === "string" || typeof json.id === "number"
      ? String(json.id)
      : null;
  const email =
    typeof json.email === "string" && json.email.length > 0
      ? json.email
      : typeof json.primary_email === "string"
        ? (json.primary_email as string)
        : null;
  if (!id) throw new Error("dialpad users/me: missing id field");
  return { id, email };
};

// ---- Per-rep access token resolver ----------------------------------------

const REFRESH_SAFETY_MS = 5 * 60 * 1000; // refresh if expiring within 5 minutes

export type RepDialpadConnection = {
  salesRepId: number;
  accessToken: string;
  dialpadUserId: string;
  dialpadEmail: string | null;
  expiresAt: Date;
  scopes: string[];
};

/**
 * Return the active rep's decrypted access token, refreshing it
 * automatically when it's within 5 minutes of expiry. Returns null
 * when the rep has not connected — caller decides whether to fall
 * back to the shared key or to fail with a "Connect Dialpad first"
 * message.
 *
 * Refresh failures DELETE the row so the rep is forced through the
 * Connect flow again on next attempt — we never silently keep using
 * a token Dialpad has revoked.
 */
export const getRepDialpadAccessToken = async (
  salesRepId: number,
): Promise<RepDialpadConnection | null> => {
  if (!isDialpadOauthConfigured()) return null;
  const [row] = await db
    .select()
    .from(repDialpadCredentials)
    .where(eq(repDialpadCredentials.salesRepId, salesRepId))
    .limit(1);
  if (!row) return null;

  const needsRefresh =
    row.expiresAt.getTime() - Date.now() <= REFRESH_SAFETY_MS;

  if (!needsRefresh) {
    let access: string;
    try {
      access = decryptDialpadToken(row.accessTokenEnc);
    } catch (err) {
      logger.error(
        { err, salesRepId },
        "dialpad: stored access token failed to decrypt — wiping row",
      );
      await db
        .delete(repDialpadCredentials)
        .where(eq(repDialpadCredentials.salesRepId, salesRepId));
      return null;
    }
    return {
      salesRepId,
      accessToken: access,
      dialpadUserId: row.dialpadUserId,
      dialpadEmail: row.dialpadEmail,
      expiresAt: row.expiresAt,
      scopes: row.scopes ?? [],
    };
  }

  // Refresh path.
  if (!row.refreshTokenEnc) {
    logger.warn(
      { salesRepId },
      "dialpad: token expired and no refresh token stored — wiping row",
    );
    await db
      .delete(repDialpadCredentials)
      .where(eq(repDialpadCredentials.salesRepId, salesRepId));
    return null;
  }
  let refreshPlain: string;
  try {
    refreshPlain = decryptDialpadToken(row.refreshTokenEnc);
  } catch (err) {
    logger.error(
      { err, salesRepId },
      "dialpad: refresh token failed to decrypt — wiping row",
    );
    await db
      .delete(repDialpadCredentials)
      .where(eq(repDialpadCredentials.salesRepId, salesRepId));
    return null;
  }

  let refreshed: TokenResponse;
  try {
    refreshed = await refreshAccessToken(refreshPlain);
  } catch (err) {
    logger.error(
      { err, salesRepId },
      "dialpad: refresh failed — wiping row, rep must reconnect",
    );
    await db
      .delete(repDialpadCredentials)
      .where(eq(repDialpadCredentials.salesRepId, salesRepId));
    return null;
  }

  const newExpiresAt = new Date(
    Date.now() + (refreshed.expires_in ?? 3600) * 1000,
  );
  const newAccessEnc = encryptDialpadToken(refreshed.access_token);
  // Dialpad usually returns a fresh refresh token on each refresh; if
  // they don't, keep the existing one.
  const newRefreshEnc = refreshed.refresh_token
    ? encryptDialpadToken(refreshed.refresh_token)
    : row.refreshTokenEnc;

  await db
    .update(repDialpadCredentials)
    .set({
      accessTokenEnc: newAccessEnc,
      refreshTokenEnc: newRefreshEnc,
      expiresAt: newExpiresAt,
      scopes: refreshed.scope
        ? refreshed.scope.split(/\s+/).filter(Boolean)
        : (row.scopes ?? []),
      updatedAt: new Date(),
    })
    .where(eq(repDialpadCredentials.salesRepId, salesRepId));

  return {
    salesRepId,
    accessToken: refreshed.access_token,
    dialpadUserId: row.dialpadUserId,
    dialpadEmail: row.dialpadEmail,
    expiresAt: newExpiresAt,
    scopes: refreshed.scope
      ? refreshed.scope.split(/\s+/).filter(Boolean)
      : (row.scopes ?? []),
  };
};

/**
 * Persist (insert-or-replace) a rep's freshly-exchanged tokens.
 * The previous row (if any) is deleted first so we never leave stale
 * dialpad_user_id pointers around when a rep re-connects under a
 * different Dialpad seat.
 */
export const saveRepDialpadCredentials = async (params: {
  salesRepId: number;
  accessToken: string;
  refreshToken: string | null;
  expiresInSec: number;
  dialpadUserId: string;
  dialpadEmail: string | null;
  scopes: string[];
}): Promise<void> => {
  const expiresAt = new Date(Date.now() + params.expiresInSec * 1000);
  await db
    .delete(repDialpadCredentials)
    .where(eq(repDialpadCredentials.salesRepId, params.salesRepId));
  await db.insert(repDialpadCredentials).values({
    salesRepId: params.salesRepId,
    accessTokenEnc: encryptDialpadToken(params.accessToken),
    refreshTokenEnc: params.refreshToken
      ? encryptDialpadToken(params.refreshToken)
      : null,
    expiresAt,
    dialpadUserId: params.dialpadUserId,
    dialpadEmail: params.dialpadEmail,
    scopes: params.scopes,
  });
};

export const deleteRepDialpadCredentials = async (
  salesRepId: number,
): Promise<{ accessToken: string | null }> => {
  const [row] = await db
    .select()
    .from(repDialpadCredentials)
    .where(eq(repDialpadCredentials.salesRepId, salesRepId))
    .limit(1);
  if (!row) return { accessToken: null };
  let access: string | null = null;
  try {
    access = decryptDialpadToken(row.accessTokenEnc);
  } catch {
    access = null;
  }
  await db
    .delete(repDialpadCredentials)
    .where(eq(repDialpadCredentials.salesRepId, salesRepId));
  return { accessToken: access };
};

/** Look up the owning rep for a dialpad user_id — used by the webhook
 * ingest path to route call.* events to HER token. */
export const findRepByDialpadUserId = async (
  dialpadUserId: string,
): Promise<RepDialpadConnection | null> => {
  if (!dialpadUserId) return null;
  const [row] = await db
    .select()
    .from(repDialpadCredentials)
    .where(eq(repDialpadCredentials.dialpadUserId, dialpadUserId))
    .limit(1);
  if (!row) return null;
  return getRepDialpadAccessToken(row.salesRepId);
};
