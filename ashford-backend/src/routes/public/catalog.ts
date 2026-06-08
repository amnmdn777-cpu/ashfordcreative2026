import { Router, type IRouter } from "express";
import {
  TIERS,
  TierKey,
  CAPABILITIES,
  TEMPLATES,
  PALETTES,
  CRISIS_RESOURCES,
  computeMonthlyCents,
  computeSetupCents,
  resolveTierFeatures,
} from "@workspace/api-zod";
import { z } from "zod";
import { asyncHandler } from "../../middleware/asyncHandler";

const router: IRouter = Router();

router.get("/public/pricing", (_req, res) => {
  res.json({
    tiers: Object.values(TIERS),
    capabilities: Object.values(CAPABILITIES),
  });
});

router.get("/public/templates", (_req, res) => {
  res.json({
    templates: Object.values(TEMPLATES),
    palettes: Object.values(PALETTES),
  });
});

router.get("/public/crisis-resources", (_req, res) => {
  res.json({ resources: CRISIS_RESOURCES });
});

router.post(
  "/public/pricing/quote",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        tierKey: TierKey,
      })
      .parse(req.body);
    res.json({
      tierKey: body.tierKey,
      monthlyTotalCents: computeMonthlyCents(body.tierKey),
      setupCents: computeSetupCents(body.tierKey),
      features: resolveTierFeatures(body.tierKey),
    });
  }),
);

export default router;
