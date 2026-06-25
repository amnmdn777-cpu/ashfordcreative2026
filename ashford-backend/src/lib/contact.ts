/**
 * Public-facing business phone for Ashford Creative — shown on the
 * marketing site (contact page + footer), prospect-portal help panels,
 * and email footers via the `/contact-info` route and `emailLayout`.
 *
 * DISPLAY ONLY. Outbound rep call / SMS routing still uses the Dialpad /
 * Twilio numbers in `env` — this constant never touches that path, so
 * changing it can't break calling. Set 2026-06-25 per Amine.
 */
export const PUBLIC_CONTACT_PHONE_DISPLAY = "(979) 661-7390";
export const PUBLIC_CONTACT_PHONE_E164 = "+19796617390";
