import { Router, type IRouter } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import {
  listNotifications,
  markAllRead,
  markRead,
} from "../../services/notifications";
import { dateToIso } from "../../lib/serialize";

const router: IRouter = Router();

router.use("/dashboard", requireAuth);

router.get(
  "/dashboard/notifications",
  asyncHandler(async (req, res) => {
    const unread = req.query.unread === "1" || req.query.unread === "true";
    const rows = await listNotifications(req.user!.id, unread);
    // NEW-BUG-4: the rep `notifications` table has no leadId column — the id
    // lives inside `payload`. The client renders an "Open lead" link from a
    // top-level `leadId`, so without surfacing it here EVERY notification was
    // non-clickable. Lift payload.leadId (falling back to parsing linkUrl
    // like "/leads/123") onto each row.
    const decorated = rows.map((r) => {
      const fromPayload = (r.payload as { leadId?: number } | null)?.leadId;
      const fromLink = r.linkUrl?.match(/\/leads\/(\d+)/)?.[1];
      const leadId =
        typeof fromPayload === "number"
          ? fromPayload
          : fromLink
            ? Number(fromLink)
            : null;
      return { ...r, leadId };
    });
    res.json({ notifications: dateToIso(decorated) });
  }),
);

router.post(
  "/dashboard/notifications/read",
  asyncHandler(async (req, res) => {
    const body = z
      .object({ id: z.number().int().optional(), all: z.boolean().optional() })
      .parse(req.body);
    if (body.all) {
      await markAllRead(req.user!.id);
    } else if (body.id) {
      await markRead(req.user!.id, body.id);
    }
    res.json({ ok: true });
  }),
);

export default router;
