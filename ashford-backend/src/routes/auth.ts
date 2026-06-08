import { Router, type IRouter } from "express";
import { LoginRequest, type SessionUser } from "@workspace/api-zod";
import { db, salesReps } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
  verifySession,
} from "../lib/auth";
import { unauthorized } from "../lib/errors";
import { verifyPassword } from "../lib/password";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/requireAuth";
import { writeAuditExplicit } from "../services/auditLog";

const router: IRouter = Router();

const toSessionUser = (u: typeof salesReps.$inferSelect): SessionUser => ({
  id: u.id,
  username: u.username,
  displayName: u.displayName,
  role: u.role,
  promoCode: u.promoCode,
  hourlyRateCents: u.hourlyRateCents,
  // 2026-05-21 — `hasCompletedOnboarding` dropped (rep training gate killed).
});

// Shared extraction helpers for the audit calls below. Pulling these
// out keeps the login/logout handlers focused on the auth flow itself
// while every audit row (success or failure) carries ip + ua.
const reqIp = (req: import("express").Request): string | null =>
  (req.ip ?? null) || null;
const reqUa = (req: import("express").Request): string | null => {
  const ua = req.get("user-agent");
  return ua ? (ua.length > 512 ? ua.slice(0, 512) : ua) : null;
};

router.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    // Parse manually so a malformed body still leaves an audit trail
    // (brute-force scanners often send junk and we want to see them).
    const parsed = LoginRequest.safeParse(req.body);
    if (!parsed.success) {
      await writeAuditExplicit({
        action: "auth.login.failed",
        actor: null,
        targetType: "sales_rep",
        targetId: null,
        before: null,
        after: { attemptedUsername: null, reason: "malformed" },
        ip: reqIp(req),
        userAgent: reqUa(req),
      });
      throw unauthorized("Invalid credentials");
    }
    const body = parsed.data;
    const attemptedUsername = body.username.toLowerCase();
    const [user] = await db
      .select()
      .from(salesReps)
      .where(eq(salesReps.username, attemptedUsername))
      .limit(1);
    if (!user) {
      await writeAuditExplicit({
        action: "auth.login.failed",
        actor: null,
        targetType: "sales_rep",
        targetId: null,
        before: null,
        after: { attemptedUsername, reason: "no_such_user" },
        ip: reqIp(req),
        userAgent: reqUa(req),
      });
      throw unauthorized("Invalid credentials");
    }
    if (!user.isActive) {
      await writeAuditExplicit({
        action: "auth.login.failed",
        actor: null,
        targetType: "sales_rep",
        targetId: user.id,
        before: null,
        after: { attemptedUsername, reason: "inactive" },
        ip: reqIp(req),
        userAgent: reqUa(req),
      });
      throw unauthorized("Invalid credentials");
    }
    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) {
      await writeAuditExplicit({
        action: "auth.login.failed",
        actor: null,
        targetType: "sales_rep",
        targetId: user.id,
        before: null,
        after: { attemptedUsername, reason: "bad_password" },
        ip: reqIp(req),
        userAgent: reqUa(req),
      });
      throw unauthorized("Invalid credentials");
    }
    const token = signSession(user.id);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions);
    await writeAuditExplicit({
      action: "auth.login",
      actor: { id: user.id, role: user.role },
      targetType: "sales_rep",
      targetId: user.id,
      before: null,
      after: { username: user.username },
      ip: reqIp(req),
      userAgent: reqUa(req),
    });
    res.json({ user: toSessionUser(user) });
  }),
);

router.post(
  "/auth/logout",
  asyncHandler(async (req, res) => {
    // Best-effort actor resolution: this route has no requireAuth gate
    // (a logout call from an already-expired cookie should still clear
    // it cleanly), so we peek at the cookie ourselves. If it's missing
    // or invalid we skip the audit rather than write a junk actor-less
    // row.
    const cookieToken = (req.cookies as Record<string, string> | undefined)?.[
      SESSION_COOKIE
    ];
    const sess = cookieToken ? verifySession(cookieToken) : null;
    if (sess) {
      const [user] = await db
        .select({ id: salesReps.id, role: salesReps.role })
        .from(salesReps)
        .where(eq(salesReps.id, sess.uid))
        .limit(1);
      if (user) {
        await writeAuditExplicit({
          action: "auth.logout",
          actor: { id: user.id, role: user.role },
          targetType: "sales_rep",
          targetId: user.id,
          before: null,
          after: null,
          ip: reqIp(req),
          userAgent: reqUa(req),
        });
      }
    }
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.json({ ok: true });
  }),
);

router.get(
  "/auth/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: toSessionUser(req.user!) });
  }),
);

// BATCH 1.2: returns a fresh signed session for the calling rep so the
// rep dashboard can append `?rep_token=<sess>` to preview links it opens
// on the apex domain (where ash_sess cookie isn't visible). Short TTL —
// the preview only needs it for the initial portal load + a few clicks.
// TODO: drop once api + site + rep share a single apex cookie scope.
router.get(
  "/auth/rep-token",
  requireAuth,
  asyncHandler(async (req, res) => {
    const token = signSession(req.user!.id, 60 * 60);
    res.json({ token });
  }),
);

export default router;
