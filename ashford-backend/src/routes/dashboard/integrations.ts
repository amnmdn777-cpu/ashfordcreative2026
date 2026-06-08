import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, repDialpadCredentials } from "@workspace/db";
import { writeAudit } from "../../services/auditLog";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { badRequest, forbidden } from "../../lib/errors";
import { env } from "../../lib/env";
import { logger } from "../../lib/logger";
import {
  buildAuthorizeUrl,
  deleteRepDialpadCredentials,
  exchangeCodeForToken,
  fetchDialpadUserInfo,
  generatePkceVerifier,
  generateState,
  isDialpadOauthConfigured,
  pkceChallengeFor,
  revokeAccessToken,
  saveRepDialpadCredentials,
} from "../../integrations/dialpadOAuth";

/**
 * Per-rep Dialpad OAuth round-trip + status endpoints.
 *
 * Flow:
 *   1. GET  /dashboard/integrations/dialpad/start
 *      → mints PKCE verifier + state, stashes them in a short-lived
 *        signed cookie, redirects to Dialpad's authorize URL.
 *   2. GET  /dashboard/integrations/dialpad/callback?code=…&state=…
 *      → verifies state, exchanges code for tokens, fetches the
 *        rep's dialpad user_id + email via /api/v2/users/me, persists
 *        encrypted, and redirects back to the rep settings page.
 *   3. POST /dashboard/integrations/dialpad/disconnect
 *      → best-effort revoke at Dialpad, deletes the local row.
 *   4. GET  /dashboard/integrations/dialpad/status
 *      → JSON: { configured, connected, dialpadEmail, scopes,
 *                 expiresAt }. Used by the LeadDetail page to gate
 *                 the Call/SMS buttons and by the settings page.
 */

const router: IRouter = Router();

router.use("/dashboard/integrations", requireAuth);

const COOKIE_NAME = "dp_oauth";
const COOKIE_MAX_AGE_MS = 10 * 60 * 1000; // 10 min — long enough for the consent screen.

const redirectUri = (): string =>
  `${env.publicBaseUrl.replace(/\/$/, "")}/api/dashboard/integrations/dialpad/callback`;

const settingsUrl = (status: string, msg?: string): string => {
  const u = new URL(
    `${env.publicBaseUrl.replace(/\/$/, "")}/sales/settings`,
  );
  u.searchParams.set("dialpad", status);
  if (msg) u.searchParams.set("msg", msg.slice(0, 200));
  return u.toString();
};

router.get(
  "/dashboard/integrations/dialpad/status",
  asyncHandler(async (req, res) => {
    if (!isDialpadOauthConfigured()) {
      res.json({
        configured: false,
        connected: false,
        dialpadEmail: null,
        scopes: [],
        expiresAt: null,
      });
      return;
    }
    const [row] = await db
      .select()
      .from(repDialpadCredentials)
      .where(eq(repDialpadCredentials.salesRepId, req.user!.id))
      .limit(1);
    res.json({
      configured: true,
      connected: !!row,
      dialpadEmail: row?.dialpadEmail ?? null,
      scopes: row?.scopes ?? [],
      expiresAt: row?.expiresAt?.toISOString() ?? null,
    });
  }),
);

router.get(
  "/dashboard/integrations/dialpad/start",
  asyncHandler(async (req, res) => {
    if (!isDialpadOauthConfigured()) {
      throw badRequest(
        "Dialpad OAuth is not configured on this server (missing DIALPAD_OAUTH_CLIENT_ID / SECRET / TOKEN_ENC_KEY).",
      );
    }
    const state = generateState();
    const verifier = generatePkceVerifier();
    const challenge = pkceChallengeFor(verifier);

    // Stash state + verifier in a short-lived httpOnly cookie scoped to
    // the API path. We deliberately bind the rep id into the cookie too
    // so a callback received under a different session is rejected (a
    // belt-and-suspenders defense against session swap mid-flow).
    const payload = JSON.stringify({
      s: state,
      v: verifier,
      r: req.user!.id,
    });
    res.cookie(COOKIE_NAME, payload, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.publicBaseUrl.startsWith("https://"),
      maxAge: COOKIE_MAX_AGE_MS,
      path: "/api/dashboard/integrations/dialpad",
    });

    const url = buildAuthorizeUrl({
      redirectUri: redirectUri(),
      state,
      codeChallenge: challenge,
    });
    res.redirect(302, url);
  }),
);

const CallbackQuery = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

router.get(
  "/dashboard/integrations/dialpad/callback",
  asyncHandler(async (req, res) => {
    const q = CallbackQuery.parse(req.query);

    // The cookie is path-scoped to this exact callback so it MUST be
    // present here. Clear it on the way out regardless of outcome.
    const rawCookie = (req.cookies as Record<string, string> | undefined)?.[
      COOKIE_NAME
    ];
    res.clearCookie(COOKIE_NAME, {
      path: "/api/dashboard/integrations/dialpad",
    });

    if (q.error) {
      logger.warn(
        { err: q.error, desc: q.error_description },
        "dialpad oauth: provider returned error",
      );
      return res.redirect(
        302,
        settingsUrl("error", q.error_description ?? q.error),
      );
    }
    if (!q.code || !q.state || !rawCookie) {
      return res.redirect(
        302,
        settingsUrl("error", "Missing code/state — please retry."),
      );
    }

    let saved: { s: string; v: string; r: number };
    try {
      saved = JSON.parse(rawCookie);
    } catch {
      return res.redirect(302, settingsUrl("error", "Invalid OAuth state."));
    }
    if (saved.s !== q.state) {
      return res.redirect(302, settingsUrl("error", "OAuth state mismatch."));
    }
    if (saved.r !== req.user!.id) {
      return res.redirect(
        302,
        settingsUrl("error", "Session changed mid-flow."),
      );
    }

    let token;
    try {
      token = await exchangeCodeForToken({
        code: q.code,
        codeVerifier: saved.v,
        redirectUri: redirectUri(),
      });
    } catch (err) {
      logger.error({ err }, "dialpad oauth: token exchange failed");
      return res.redirect(
        302,
        settingsUrl("error", "Token exchange with Dialpad failed."),
      );
    }

    let userInfo;
    try {
      userInfo = await fetchDialpadUserInfo(token.access_token);
    } catch (err) {
      logger.error({ err }, "dialpad oauth: users/me failed");
      return res.redirect(
        302,
        settingsUrl(
          "error",
          "Token granted but Dialpad user lookup failed — please retry.",
        ),
      );
    }

    await saveRepDialpadCredentials({
      salesRepId: req.user!.id,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      expiresInSec: token.expires_in ?? 3600,
      dialpadUserId: userInfo.id,
      dialpadEmail: userInfo.email,
      scopes: token.scope ? token.scope.split(/\s+/).filter(Boolean) : [],
    });

    await writeAudit(req, {
      action: "dialpad_connected",
      targetType: "sales_rep",
      targetId: req.user!.id,
      before: null,
      after: { dialpadUserId: userInfo.id, dialpadEmail: userInfo.email },
    });

    return res.redirect(302, settingsUrl("connected"));
  }),
);

router.post(
  "/dashboard/integrations/dialpad/disconnect",
  asyncHandler(async (req, res) => {
    if (!isDialpadOauthConfigured()) throw badRequest("Not configured.");
    const { accessToken } = await deleteRepDialpadCredentials(req.user!.id);
    if (accessToken) {
      // Fire-and-forget revoke — local row is already gone.
      void revokeAccessToken(accessToken);
    }
    await writeAudit(req, {
      action: "dialpad_disconnected",
      targetType: "sales_rep",
      targetId: req.user!.id,
      before: null,
      after: null,
    });
    res.json({ ok: true });
  }),
);

// Admin can force-disconnect a rep (e.g. offboarding). Same outcome
// as the rep clicking Disconnect, but logged with the admin as actor.
const AdminDisconnectBody = z.object({
  salesRepId: z.number().int().positive(),
});
router.post(
  "/dashboard/integrations/dialpad/admin-disconnect",
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "admin") throw forbidden("Admins only");
    const body = AdminDisconnectBody.parse(req.body);
    const { accessToken } = await deleteRepDialpadCredentials(body.salesRepId);
    if (accessToken) void revokeAccessToken(accessToken);
    await writeAudit(req, {
      action: "dialpad_force_disconnected",
      targetType: "sales_rep",
      targetId: body.salesRepId,
      before: null,
      after: null,
    });
    res.json({ ok: true });
  }),
);

export default router;
