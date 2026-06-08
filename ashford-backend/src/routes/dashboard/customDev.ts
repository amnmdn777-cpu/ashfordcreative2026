import { Router, type IRouter } from "express";
import { CreateCustomDevRequest } from "@workspace/api-zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import {
  requireAuth,
  requireOnboardingComplete,
} from "../../middleware/requireAuth";
import {
  createQuoteRequest,
  listRepQuotes,
} from "../../services/customDev";
import { dateToIso } from "../../lib/serialize";

const router: IRouter = Router();

router.use("/dashboard", requireAuth, requireOnboardingComplete);

router.post(
  ["/dashboard/custom-dev/request", "/dashboard/custom-dev/quotes"],
  asyncHandler(async (req, res) => {
    const body = CreateCustomDevRequest.parse(req.body);
    const row = await createQuoteRequest({
      repId: req.user!.id,
      leadId: body.leadId,
      saleId: body.saleId,
      featureKeys: body.featureKeys,
      customDescription: body.customDescription,
    });
    res.json({ quote: dateToIso(row) });
  }),
);

router.get(
  "/dashboard/custom-dev/quotes",
  asyncHandler(async (req, res) => {
    const rows = await listRepQuotes(req.user!.id);
    res.json({ quotes: dateToIso(rows) });
  }),
);

export default router;
