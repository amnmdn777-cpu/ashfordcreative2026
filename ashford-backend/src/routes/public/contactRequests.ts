import { Router, type IRouter } from "express";
import {
  CreateContactRequestPayload,
  normalizeSmsConsentText,
} from "@workspace/api-zod";
import { db, contactRequests, salesReps } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { asyncHandler } from "../../middleware/asyncHandler";
import { notify } from "../../services/notifications";
import { rateLimit } from "../../middleware/rateLimit";

const router: IRouter = Router();

router.post(
  ["/contact-requests", "/public/contact-requests"],
  rateLimit({ name: "contact_request", capacity: 5, refillPerSecond: 0.1 }),
  asyncHandler(async (req, res) => {
    // The Zod schema enforces TCR-grade SMS opt-in: when `phone` is
    // present, `smsConsent` must be true and `smsConsentText` must be
    // one of the canonical EN/ES disclosure paragraphs from
    // `@workspace/api-zod`. Any deviation throws here and the global
    // error handler returns a 400 with field-level details.
    const body = CreateContactRequestPayload.parse(req.body);

    // SMS opt-in audit fields. We persist the disclosure normalized so
    // downstream audit queries and exports compare equal to the
    // canonical constant; this strips trivial whitespace differences
    // without altering the meaning.
    const phoneProvided = Boolean(body.phone && body.phone.trim().length > 0);
    const smsConsent = phoneProvided && body.smsConsent === true;
    const smsConsentText = smsConsent
      ? normalizeSmsConsentText(body.smsConsentText ?? "")
      : null;
    const smsConsentAt = smsConsent ? new Date() : null;

    // Capture the submitter's IP for the consent record. Express's
    // `req.ip` honors `app.set("trust proxy", true)` and returns the
    // leftmost client address from `x-forwarded-for`, with the socket
    // address as the fallback. We avoid parsing the header by hand so
    // the proxy-trust setting stays the single source of truth.
    const ipAddress =
      (req.ip ?? req.socket.remoteAddress ?? "").slice(0, 64) || null;

    const [row] = await db
      .insert(contactRequests)
      .values({
        ...body,
        smsConsent,
        smsConsentText,
        smsConsentAt,
        ipAddress,
      })
      .returning();

    // Broadcast to every active rep that has finished onboarding so anyone can claim it
    // from the shared queue. The rep dashboard owns the round-robin / first-come logic.
    const reps = await db
      .select({ id: salesReps.id })
      .from(salesReps)
      .where(
        and(
          eq(salesReps.isActive, true),
          eq(salesReps.role, "rep"),
          // 2026-05-21 — `hasCompletedOnboarding` filter removed (Sprint 2 streamline).
        ),
      );
    for (const r of reps) {
      await notify({
        repId: r.id,
        type: "contact_request.new",
        title: `New ${body.preferredContact} request from ${body.name}`,
        body: body.message?.slice(0, 200),
        payload: { contactRequestId: row.id },
        linkUrl: `/dashboard/contact-requests/queue`,
      });
    }

    res.json({
      ok: true,
      id: row.id,
      message:
        body.preferredContact === "callback"
          ? "We'll call you back during business hours."
          : "We received your message — a rep will be in touch shortly.",
    });
  }),
);

export default router;
