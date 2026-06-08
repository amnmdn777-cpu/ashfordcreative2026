import { Router, type IRouter } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { badRequest, forbidden } from "../../lib/errors";
import {
  listThreadForRep,
  sendRepToAdmin,
  markMessageRead,
  markAllRead,
  unreadCountForRep,
} from "../../services/directMessages";

const router: IRouter = Router();

router.use("/rep/messages", requireAuth);

const SendBody = z.object({
  body: z.string().min(1).max(4000),
});

router.get(
  "/rep/messages",
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "rep") throw forbidden("Reps only");
    const messages = await listThreadForRep(req.user!.id);
    const unread = await unreadCountForRep(req.user!.id);
    res.json({ messages, unreadCount: unread });
  }),
);

router.get(
  "/rep/messages/unread-count",
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "rep") {
      res.json({ unreadCount: 0 });
      return;
    }
    const unread = await unreadCountForRep(req.user!.id);
    res.json({ unreadCount: unread });
  }),
);

router.post(
  "/rep/messages",
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "rep") throw forbidden("Reps only");
    const body = SendBody.parse(req.body);
    const trimmed = body.body.trim();
    if (!trimmed) throw badRequest("Message cannot be empty");
    const msg = await sendRepToAdmin({
      repId: req.user!.id,
      body: trimmed,
    });
    res.json({ message: msg });
  }),
);

router.post(
  "/rep/messages/:id/read",
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "rep") throw forbidden("Reps only");
    const id = z.coerce.number().int().parse(req.params.id);
    const updated = await markMessageRead({
      repId: req.user!.id,
      messageId: id,
      recipient: "rep",
    });
    res.json({ message: updated, ok: !!updated });
  }),
);

router.post(
  "/rep/messages/read-all",
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "rep") throw forbidden("Reps only");
    const n = await markAllRead({ repId: req.user!.id, recipient: "rep" });
    res.json({ ok: true, marked: n });
  }),
);

export default router;
