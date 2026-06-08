import { Router, type IRouter } from "express";
import dialpadSms from "./dialpadSms";

// Stripe + Resend webhooks mount directly in app.ts because they need the
// raw body before express.json runs. Dialpad SMS uses express.text()
// internally (the JWT token IS the body) and runs fine after the global
// parsers. The Dialpad calls webhook is mounted separately in app.ts.
//
// TextBelt webhook is ALSO mounted directly in app.ts (before express.json)
// because the reply payload is JSON and signature verification needs the
// raw bytes — it intentionally is NOT included in this router.
//
// Twilio webhooks were retired on 2026-04-27 — Dialpad now handles
// inbound calls + voice. As of 2026-04-29 outbound SMS + inbound SMS
// replies route through TextBelt; the Dialpad SMS path is kept as a
// fallback. The legacy twilio.ts / twilioVoice.ts modules remain on disk
// marked @deprecated for reference but are not imported anywhere in the
// active runtime path.

const router: IRouter = Router();
router.use(dialpadSms);

export default router;
