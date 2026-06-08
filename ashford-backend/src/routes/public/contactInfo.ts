import { Router, type IRouter } from "express";
import { env } from "../../lib/env";

/** Public contact info — single source of truth for site/portal/help panels. */
const router: IRouter = Router();

router.get("/contact-info", (_req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json({
    voiceNumber: env.dialpadFromNumber ?? null,
    smsNumber: env.dialpadFromNumber ?? null,
    supportEmail: env.resendFromEmail ?? "hello@ashfordcreative.org",
  });
});

export default router;
