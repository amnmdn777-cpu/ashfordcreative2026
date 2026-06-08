import type { Request, Response, NextFunction } from "express";
import { db, salesReps } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SESSION_COOKIE, verifySession } from "../lib/auth";
import { unauthorized, forbidden } from "../lib/errors";

// 2026-05-21 — keep `forbidden` imported even though
// requireOnboardingComplete no longer uses it; the file may still import
// helpers we want for new gates.
void forbidden;

export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const raw = (req.cookies as Record<string, string> | undefined)?.[
    SESSION_COOKIE
  ];
  const payload = verifySession(raw);
  if (!payload) return next(unauthorized());
  const [user] = await db
    .select()
    .from(salesReps)
    .where(eq(salesReps.id, payload.uid))
    .limit(1);
  if (!user || !user.isActive) return next(unauthorized());
  req.user = user;
  next();
};

export const requireAdmin = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== "admin") return next(forbidden("Admins only"));
  next();
};

/**
 * 2026-05-21 — `requireOnboardingComplete` was the rep training gate.
 * Sprint 2 streamline killed it. The shim below is a no-op so any
 * route that still imports it keeps booting; it should be removed
 * once `grep requireOnboardingComplete` returns nothing.
 */
export const requireOnboardingComplete = (
  _req: Request,
  _res: Response,
  next: NextFunction,
) => next();
