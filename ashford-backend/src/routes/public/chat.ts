import { Router, type IRouter } from "express";
import { z } from "zod";
import { env } from "../../lib/env";
import { logger } from "../../lib/logger";
import { rateLimit } from "../../middleware/rateLimit";
import { asyncHandler } from "../../middleware/asyncHandler";

/**
 * POST /api/public/chat — per-practice AI concierge proxy.
 *
 * The browser sends the practice context + conversation; we hold the
 * GEMINI_API_KEY server-side and call Gemini, so the key never ships in
 * the frontend bundle. Soft-disables (returns a friendly fallback) when
 * no key is configured. Therapy guardrails live in the system prompt.
 */

const router: IRouter = Router();

const GEMINI_MODEL = "gemini-2.5-flash-lite";

const PracticeSchema = z.object({
  name: z.string().min(1).max(160),
  blurb: z.string().max(600).optional(),
  services: z.array(z.string().max(120)).max(20).optional(),
  specialties: z.array(z.string().max(80)).max(30).optional(),
  insurance: z.array(z.string().max(80)).max(30).optional(),
  hours: z
    .array(z.object({ day: z.string().max(20), open: z.string().max(40) }))
    .max(10)
    .optional(),
  feesNote: z.string().max(400).optional(),
  bookingUrl: z.string().max(400).optional(),
});

const ChatBody = z.object({
  practice: PracticeSchema,
  locale: z.enum(["en", "es"]).default("en"),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        text: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(20),
});

type Practice = z.infer<typeof PracticeSchema>;

function buildSystemPrompt(p: Practice, locale: "en" | "es"): string {
  const lang = locale === "es" ? "Spanish" : "English";
  return [
    `You are a warm, concise front-desk assistant for "${p.name}", a solo mental-health therapy practice.`,
    `Answer ONLY about this practice: booking, services, specialties, insurance, fees, hours, location, and what to expect. Reply in ${lang}.`,
    p.blurb ? `About the practice: ${p.blurb}` : "",
    p.services?.length ? `Services: ${p.services.join("; ")}.` : "",
    p.specialties?.length ? `We treat: ${p.specialties.join(", ")}.` : "",
    p.insurance?.length ? `Insurance: ${p.insurance.join(", ")}.` : "",
    p.feesNote ? `Fees: ${p.feesNote}` : "",
    p.hours?.length
      ? `Hours: ${p.hours.map((h) => `${h.day} ${h.open}`).join("; ")}.`
      : "",
    p.bookingUrl ? `To book, point them to a free 15-minute call.` : "",
    "",
    "Rules:",
    "- Keep replies short (1-3 sentences). Be kind and human.",
    "- You are NOT a clinician: never diagnose, never give medical/clinical advice, never suggest medications. If asked, gently say the therapist can help and invite them to book.",
    "- If the person expresses crisis, self-harm, or suicidal thoughts, STOP and tell them: in the US call or text 988 (Suicide & Crisis Lifeline, 24/7), or 911 if in immediate danger. Encourage them to reach a person now.",
    "- If a question is outside this practice's scope, politely say you can only help with this practice and offer to connect them with the therapist.",
    "- Never invent prices, insurers, or hours you were not given.",
  ]
    .filter(Boolean)
    .join("\n");
}

const FALLBACK = (locale: string) =>
  locale === "es"
    ? "Ahora mismo no puedo responder, pero el equipo puede ayudarte rápido — reserva una llamada gratuita de 15 minutos."
    : "I can't answer right now, but the team can help fast — book a free 15-minute call and they'll take care of you.";

router.post(
  "/public/chat",
  rateLimit({ name: "public_chat", capacity: 8, refillPerSecond: 0.25 }),
  asyncHandler(async (req, res) => {
    const parsed = ChatBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    const { practice, locale, messages } = parsed.data;

    if (!env.geminiApiKey) {
      // Soft-disable: no key configured — return a graceful fallback so the
      // widget still behaves (never 500s the prospect).
      res.json({ reply: FALLBACK(locale), disabled: true });
      return;
    }

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const callGemini = async (): Promise<globalThis.Response> => {
      const payload = {
        method: "POST" as const,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: buildSystemPrompt(practice, locale) }],
          },
          contents: messages.map((m) => ({
            role: m.role,
            parts: [{ text: m.text }],
          })),
          generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
        }),
      };
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${env.geminiApiKey}`;
      // Retry transient rate-limit / unavailable up to twice with backoff.
      for (let attempt = 0; ; attempt++) {
        const resp = await fetch(url, payload);
        if ((resp.status === 429 || resp.status === 503) && attempt < 2) {
          await sleep(1000 * (attempt + 1));
          continue;
        }
        return resp;
      }
    };

    try {
      const r = await callGemini();
      if (!r.ok) {
        logger.warn({ status: r.status }, "[public-chat] gemini non-200");
        res.json({ reply: FALLBACK(locale) });
        return;
      }
      const data = (await r.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const reply =
        data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
        FALLBACK(locale);
      res.json({ reply });
    } catch (err) {
      logger.error({ err }, "[public-chat] failed");
      res.json({ reply: FALLBACK(locale) });
    }
  }),
);

export default router;
