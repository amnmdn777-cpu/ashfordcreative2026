import type { Request } from "express";
import { db, salesReps, leads } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SESSION_COOKIE, verifySession } from "../lib/auth";

/**
 * LOT 1.4 — shared "is this request an authenticated rep with portal
 * access to this lead?" check. Extracted from resolveCartActor in
 * routes/public/portals.ts (LOT 1.3) so the cart route and the
 * lifecycle rep-bypass in requirePortalAccess can't diverge.
 *
 * Returns the rep actor on a match, null otherwise. Match conditions:
 *   - Valid + unexpired session cookie (ash_sess).
 *   - Rep row exists, isActive=true.
 *   - Rep owns the lead (claimedByRepId === rep.id) OR rep.role === "admin".
 *
 * Unclaimed-lead posture is identical to LOT 1.1: a rep that doesn't
 * own the lead and isn't admin gets NO bypass. They must `claim` first.
 */
export interface PortalRepActor {
  repId: number;
  role: "rep" | "admin";
}

export const resolvePortalRepActor = async (
  req: Request,
  leadId: number,
): Promise<PortalRepActor | null> => {
  const cookies = req.cookies as Record<string, string> | undefined;
  const rawSess = cookies?.[SESSION_COOKIE];
  const sess = rawSess ? verifySession(rawSess) : null;
  if (!sess) return null;
  const [rep] = await db
    .select({
      id: salesReps.id,
      role: salesReps.role,
      isActive: salesReps.isActive,
    })
    .from(salesReps)
    .where(eq(salesReps.id, sess.uid))
    .limit(1);
  if (!rep?.isActive) return null;
  const [leadRow] = await db
    .select({ claimedByRepId: leads.claimedByRepId })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
  const owns = leadRow && leadRow.claimedByRepId === rep.id;
  if (owns || rep.role === "admin") {
    return { repId: rep.id, role: rep.role as "rep" | "admin" };
  }
  return null;
};
