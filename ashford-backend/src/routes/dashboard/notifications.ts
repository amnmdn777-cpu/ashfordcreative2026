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
    res.json({ notifications: dateToIso(rows) });
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
