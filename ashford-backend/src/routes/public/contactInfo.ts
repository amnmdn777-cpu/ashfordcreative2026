import { Router, type IRouter } from "express";
import { env } from "../../lib/env";
import { PUBLIC_CONTACT_PHONE_DISPLAY } from "../../lib/contact";

/** Public contact info — single source of truth for site/portal/help panels. */
const router: IRouter = Router();

router.get("/contact-info", (_req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json({
    // Public business line (display). Not the Dialpad routing number.
    voiceNumber: PUBLIC_CONTACT_PHONE_DISPLAY,
    smsNumber: PUBLIC_CONTACT_PHONE_DISPLAY,
    supportEmail: env.resendFromEmail ?? "hello@ashfordhealthcreative.com",
  });
});

export default router;
