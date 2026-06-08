import { z } from "zod";

export const PreferredContact = z.enum(["callback", "sms", "email"]);
export type PreferredContact = z.infer<typeof PreferredContact>;

// === Canonical SMS consent disclosures ===
// These are the EXACT strings that must be rendered above the consent
// checkbox on the public contact form and chatbot, AND echoed back to
// the API as `smsConsentText`. The api-server normalizes whitespace and
// rejects any value that does not exactly match one of these. This is
// the audit-grade guarantee TCR/CTIA expects: the text the user saw at
// the moment of consent is the text that lands in the database, byte
// for byte. Both UI surfaces and the legal /sms-consent page MUST
// import from here (or re-export through the site's i18n strings) so
// drift is impossible.
export const SMS_CONSENT_DISCLOSURE_EN =
  "By checking this box, I agree to receive SMS messages from Ashford Creative at the number provided, regarding my inquiry and, if I become a customer, my account. Message and data rates may apply. Message frequency varies — typically fewer than 5 messages per month. Reply STOP to unsubscribe at any time, or HELP for help. My phone number will not be sold, rented, or shared with any third party for their own marketing purposes. See the full Privacy Policy at https://www.ashfordcreative.org/legal/privacy and the SMS Program details at https://www.ashfordcreative.org/legal/sms-consent.";

export const SMS_CONSENT_DISCLOSURE_ES =
  "Al marcar esta casilla, acepto recibir mensajes SMS de Ashford Creative al número proporcionado, sobre mi consulta y, si me convierto en cliente, mi cuenta. Pueden aplicarse tarifas de mensajes y datos. La frecuencia de los mensajes varía — generalmente menos de 5 mensajes al mes. Responde STOP para darte de baja en cualquier momento, o HELP para obtener ayuda. Mi número de teléfono no se venderá, alquilará ni compartirá con terceros para sus propios fines de marketing. Consulta la Política de Privacidad completa en https://www.ashfordcreative.org/legal/privacy y los detalles del Programa de SMS en https://www.ashfordcreative.org/legal/sms-consent.";

export const SMS_CONSENT_DISCLOSURES: readonly string[] = [
  SMS_CONSENT_DISCLOSURE_EN,
  SMS_CONSENT_DISCLOSURE_ES,
];

// Normalizes whitespace so trivial reflows (line wraps, doubled spaces
// from HTML rendering or copy/paste) don't trigger a mismatch — but
// content changes still do.
export function normalizeSmsConsentText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function isCanonicalSmsConsentDisclosure(s: string): boolean {
  const n = normalizeSmsConsentText(s);
  return SMS_CONSENT_DISCLOSURES.some(
    (canonical) => normalizeSmsConsentText(canonical) === n,
  );
}

/**
 * Public contact-form / chatbot payload.
 *
 * SMS opt-in audit fields:
 *   - When `phone` is empty, `smsConsent` MUST be omitted or `false`.
 *   - When `phone` is present, `smsConsent` MUST be `true` AND
 *     `smsConsentText` MUST be one of the canonical disclosure
 *     paragraphs the submitter actually saw on screen. The server
 *     persists `smsConsentText` unmodified so the TCR audit trail
 *     reflects the exact wording each recipient consented to.
 */
export const CreateContactRequestPayload = z
  .object({
    source: z.string().max(64).default("public"),
    name: z.string().min(1).max(128),
    practice: z.string().max(192).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(7).max(32).optional(),
    preferredContact: PreferredContact.default("callback"),
    message: z.string().max(2000).optional(),
    bestTimeToReach: z.string().max(96).optional(),
    // TCR-grade SMS opt-in audit. When `phone` is present these MUST be
    // populated by the client: `smsConsent=true` confirms the user
    // checked the on-page consent box, and `smsConsentText` is the
    // verbatim disclosure paragraph that was rendered above the box at
    // submission time. The server enforces this and snapshots both the
    // text and the timestamp.
    smsConsent: z.boolean().optional(),
    smsConsentText: z.string().max(4000).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.phone && val.phone.trim().length > 0) {
      if (val.smsConsent !== true) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["smsConsent"],
          message:
            "SMS consent is required when a phone number is provided.",
        });
      }
      if (
        !val.smsConsentText ||
        val.smsConsentText.trim().length === 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["smsConsentText"],
          message:
            "The disclosure text must be sent alongside SMS consent.",
        });
      } else if (!isCanonicalSmsConsentDisclosure(val.smsConsentText)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["smsConsentText"],
          message:
            "The disclosure text does not match the canonical SMS consent disclosure.",
        });
      }
    }
  });
export type CreateContactRequestPayload = z.infer<
  typeof CreateContactRequestPayload
>;

export const ContactRequestDto = z.object({
  id: z.number().int(),
  source: z.string(),
  name: z.string(),
  practice: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  preferredContact: PreferredContact,
  message: z.string().nullable(),
  bestTimeToReach: z.string().nullable(),
  status: z.enum(["open", "claimed", "converted", "closed"]),
  claimedByRepId: z.number().int().nullable(),
  internalNote: z.string().nullable(),
  smsConsent: z.boolean(),
  smsConsentText: z.string().nullable(),
  smsConsentAt: z.string().nullable(),
  ipAddress: z.string().nullable(),
  createdAt: z.string(),
});
export type ContactRequestDto = z.infer<typeof ContactRequestDto>;
