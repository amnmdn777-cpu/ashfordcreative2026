import { Router, type IRouter } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { badRequest, forbidden } from "../../lib/errors";
import { db, leads as leadsTbl, calls } from "@workspace/db";
import { eq } from "drizzle-orm";
import { env } from "../../lib/env";
import { logger } from "../../lib/logger";
import {
  getRepDialpadVoice,
  isDialpadVoiceConfigured,
  isPhoneOptedOut,
  normalizePhone,
  placeDialpadCall,
} from "../../integrations/dialpad";
import { isDialpadOauthConfigured } from "../../integrations/dialpadOAuth";
import { checkDailyCostCap } from "../../services/voiceCostCap";

const router: IRouter = Router();

router.use("/dashboard/voice", requireAuth);

const StartCallBody = z.object({
  leadId: z.number().int().nullable(),
  toNumber: z.string().min(7).max(20),
});

router.post(
  "/dashboard/voice/start",
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "rep") throw forbidden("Reps only");
    const body = StartCallBody.parse(req.body);

    // When per-rep OAuth is configured we REQUIRE the active rep to
    // have connected her own Dialpad before placing a call. Otherwise
    // the prospect would see Candice's number — exactly the problem
    // task #226 was created to fix.
    const repConn = isDialpadOauthConfigured()
      ? await getRepDialpadVoice(req.user!.id)
      : null;
    if (isDialpadOauthConfigured() && !repConn) {
      res.status(409).json({
        error: {
          code: "dialpad_not_connected",
          message:
            "Connect your Dialpad in Settings before placing calls so the prospect sees YOUR number.",
        },
      });
      return;
    }
    if (!repConn && !isDialpadVoiceConfigured()) {
      throw badRequest("Voice channel not configured.");
    }

    if (body.leadId !== null) {
      const [lead] = await db
        .select()
        .from(leadsTbl)
        .where(eq(leadsTbl.id, body.leadId))
        .limit(1);
      if (!lead) throw badRequest("Lead not found.");
      if (lead.claimedByRepId !== req.user!.id)
        throw forbidden("You don't own this lead.");
    }

    if (await isPhoneOptedOut(body.toNumber)) {
      res.status(409).json({
        error: {
          code: "opted_out",
          message: "Lead opted out (STOP). Outbound calls blocked.",
        },
      });
      return;
    }

    const cap = await checkDailyCostCap();
    if (cap.blocked) {
      res.status(409).json({
        error: {
          code: "cost_cap_blocked",
          message: `Daily voice budget reached ($${(cap.usedCents / 100).toFixed(2)} of $${(cap.capCents / 100).toFixed(2)}).`,
        },
      });
      return;
    }

    let providerCallId: string | null = null;
    try {
      const result = await placeDialpadCall({
        toNumber: body.toNumber,
        repId: req.user!.id,
        // Force per-rep auth — never silently fall back to Candice's
        // shared number for a rep-initiated outbound call.
        requireRepAuth: isDialpadOauthConfigured(),
      });
      providerCallId = String(result.call_id);
    } catch (err) {
      logger.error({ err }, "voice: dialpad placeCall failed");
      res.status(502).json({
        error: {
          code: "provider_failed",
          message: "Could not place the call right now. Try again.",
        },
      });
      return;
    }

    const [row] = await db
      .insert(calls)
      .values({
        leadId: body.leadId ?? undefined,
        repId: req.user!.id,
        direction: "outbound",
        fromNumber: env.dialpadFromNumber ?? "",
        toNumber: normalizePhone(body.toNumber),
        status: "queued",
        provider: "dialpad",
        dialpadCallId: providerCallId ?? undefined,
      })
      .returning();

    res.json({ callId: row.id, providerCallId, status: "queued" });
  }),
);

router.get(
  "/dashboard/voice/status",
  asyncHandler(async (req, res) => {
    const cap = await checkDailyCostCap();
    // When per-rep OAuth is enabled, "configured" reflects whether THIS
    // rep can actually place a call (i.e. has connected). Otherwise we
    // fall back to the legacy shared-key check.
    let configured = isDialpadVoiceConfigured();
    let repConnected = false;
    if (isDialpadOauthConfigured()) {
      const conn = await getRepDialpadVoice(req.user!.id);
      repConnected = !!conn;
      configured = repConnected;
    }
    res.json({
      configured,
      accessTokensConfigured: false,
      provider: "dialpad",
      dailyCap: cap,
      perRepOauth: isDialpadOauthConfigured(),
      repConnected,
    });
  }),
);

export default router;
