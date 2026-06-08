import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, salesReps } from "@workspace/db";
import { eq } from "drizzle-orm";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth, requireAdmin } from "../../middleware/requireAuth";
import { badRequest, notFound } from "../../lib/errors";
import {
  listThreadForRep,
  sendAdminToRep,
  markMessageRead,
  markAllRead,
  unreadCountsByRepForAdmin,
  lastMessagePerRep,
} from "../../services/directMessages";

const router: IRouter = Router();

router.use("/admin/reps", requireAuth, requireAdmin);
router.use("/admin/messages", requireAuth, requireAdmin);

const SendBody = z.object({
  body: z.string().min(1).max(4000),
});

const ensureRep = async (id: number) => {
  const [r] = await db
    .select({ id: salesReps.id })
    .from(salesReps)
    .where(eq(salesReps.id, id))
    .limit(1);
  if (!r) throw notFound("Rep not found");
};

router.get(
  "/admin/reps/:repId/messages",
  asyncHandler(async (req, res) => {
    const repId = z.coerce.number().int().parse(req.params.repId);
    await ensureRep(repId);
    const messages = await listThreadForRep(repId);
    res.json({ messages });
  }),
);

router.post(
  "/admin/reps/:repId/messages",
  asyncHandler(async (req, res) => {
    const repId = z.coerce.number().int().parse(req.params.repId);
    await ensureRep(repId);
    const body = SendBody.parse(req.body);
    const trimmed = body.body.trim();
    if (!trimmed) throw badRequest("Message cannot be empty");
    const msg = await sendAdminToRep({
      repId,
      senderAdminId: req.user!.id,
      body: trimmed,
    });
    res.json({ message: msg });
  }),
);

router.post(
  "/admin/reps/:repId/messages/:id/read",
  asyncHandler(async (req, res) => {
    const repId = z.coerce.number().int().parse(req.params.repId);
    const id = z.coerce.number().int().parse(req.params.id);
    const updated = await markMessageRead({
      repId,
      messageId: id,
      recipient: "admin",
    });
    res.json({ message: updated, ok: !!updated });
  }),
);

router.post(
  "/admin/reps/:repId/messages/read-all",
  asyncHandler(async (req, res) => {
    const repId = z.coerce.number().int().parse(req.params.repId);
    await ensureRep(repId);
    const n = await markAllRead({ repId, recipient: "admin" });
    res.json({ ok: true, marked: n });
  }),
);

// Inbox-style summary for the admin (for the Reps list badge / future inbox).
router.get(
  "/admin/messages/summary",
  asyncHandler(async (_req, res) => {
    const [unread, last] = await Promise.all([
      unreadCountsByRepForAdmin(),
      lastMessagePerRep(),
    ]);
    res.json({ unreadByRep: unread, lastMessageByRep: last });
  }),
);

export default router;
