import React, { useEffect, useRef, useState } from "react";

/**
 * Clarity AI concierge — a per-practice chat widget.
 *
 * Knowledge is built dynamically from the practice's own data (name,
 * services, specialties, hours, fees, booking link), so every doctor's
 * bot already knows that practice with zero manual setup.
 *
 * Two transport modes:
 *   - PROD: posts {messages, practice} to our backend `/public/chat`,
 *     which holds GEMINI_API_KEY and calls Gemini. The key never ships
 *     in the browser bundle.
 *   - DEV (local showcase, no backend): if `VITE_CLARITY_GEMINI_KEY` is
 *     present in `.env.local`, it calls Gemini directly so the widget is
 *     testable without running the API. This path is gated on
 *     `import.meta.env.DEV` and is never taken in a production build.
 *
 * Therapy guardrails live in the system prompt + a client-side crisis
 * check that surfaces 988 immediately, before any model call.
 */

export interface ChatPractice {
  name: string;
  blurb?: string;
  services?: string[];
  specialties?: string[];
  insurance?: string[];
  hours?: { day: string; open: string }[];
  feesNote?: string;
  bookingUrl?: string;
  phone?: string;
  email?: string;
}

interface Msg {
  role: "user" | "model";
  text: string;
}

const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ||
  "/api";
const DEV_KEY = import.meta.env.VITE_CLARITY_GEMINI_KEY as string | undefined;
const GEMINI_MODEL = "gemini-2.5-flash-lite";

const CRISIS_RE =
  /\b(suicid|kill myself|end my life|want to die|hurt myself|self.?harm|no reason to live)\b/i;

function buildSystemPrompt(p: ChatPractice, locale: "en" | "es"): string {
  const lang = locale === "es" ? "Spanish" : "English";
  const lines = [
    `You are a warm, concise front-desk assistant for "${p.name}", a mental-health therapy practice.`,
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
    "- Keep replies short (1–3 sentences). Be kind and human.",
    "- You are NOT a clinician: never diagnose, never give medical or clinical advice, never suggest medications. If asked, gently say the therapists can help and invite them to book.",
    "- If the person expresses crisis, self-harm, or thoughts of suicide, STOP and tell them: in the US call or text 988 (Suicide & Crisis Lifeline, 24/7), or 911 if in immediate danger. Encourage them to reach a person now.",
    "- If a question is outside this practice's scope, politely say you can only help with this practice and offer to connect them with the team.",
    "- Never invent prices, insurers, or hours you weren't given.",
  ];
  return lines.filter(Boolean).join("\n");
}

async function askGeminiDirect(
  system: string,
  history: Msg[],
): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${DEV_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: history.map((m) => ({
          role: m.role,
          parts: [{ text: m.text }],
        })),
        generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  return (
    data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ??
    "Sorry — I didn't catch that. Could you rephrase?"
  );
}

async function askBackend(
  practice: ChatPractice,
  locale: "en" | "es",
  history: Msg[],
): Promise<string> {
  const res = await fetch(`${API_BASE}/public/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ practice, locale, messages: history }),
  });
  if (!res.ok) throw new Error(`chat ${res.status}`);
  const data = await res.json();
  return data?.reply ?? "Sorry — I'm having trouble right now.";
}

export function ClarityChatWidget({
  practice,
  locale,
}: {
  practice: ChatPractice;
  locale: "en" | "es";
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const tt = (en: string, es: string) => (locale === "es" ? es : en);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "model",
      text: tt(
        `Hi! I'm the assistant for ${practice.name}. Ask me about services, insurance, hours, or booking a free call.`,
        `¡Hola! Soy el asistente de ${practice.name}. Pregúntame sobre servicios, seguros, horarios o reservar una llamada gratis.`,
      ),
    },
  ]);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({
      top: scroller.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", text }];
    setMessages(next);

    // Client-side crisis safety net — answer immediately, skip the model.
    if (CRISIS_RE.test(text)) {
      setMessages((m) => [
        ...m,
        {
          role: "model",
          text: tt(
            "I'm really glad you reached out. If you're in crisis or thinking about harming yourself, please call or text 988 (Suicide & Crisis Lifeline, available 24/7), or call 911 if you're in immediate danger. You deserve support from a person right now.",
            "Me alegra mucho que hayas escrito. Si estás en crisis o piensas en hacerte daño, por favor llama o envía un mensaje al 988 (Línea de Crisis y Suicidio, 24/7), o llama al 911 si estás en peligro inmediato. Mereces apoyo de una persona ahora mismo.",
          ),
        },
      ]);
      return;
    }

    setBusy(true);
    try {
      const system = buildSystemPrompt(practice, locale);
      const reply =
        import.meta.env.DEV && DEV_KEY
          ? await askGeminiDirect(system, next)
          : await askBackend(practice, locale, next);
      setMessages((m) => [...m, { role: "model", text: reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "model",
          text: tt(
            "I'm having a little trouble connecting right now. You can reach the team directly to get a fast answer.",
            "Estoy teniendo problemas para conectarme ahora mismo. Puedes contactar al equipo directamente para una respuesta rápida.",
          ),
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={tt("Chat with us", "Chatea con nosotros")}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full px-5 py-3 shadow-lg transition-transform hover:-translate-y-0.5"
        style={{
          backgroundColor: "var(--color-text)",
          color: "var(--color-surface)",
          fontFamily: "var(--font-body)",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
          <path
            d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.6-.8L3 21l1.9-5.4A8.5 8.5 0 1 1 21 11.5z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-sm font-medium">
          {tt("Ask us", "Pregúntanos")}
        </span>
      </button>

      {/* Panel */}
      {open ? (
        <div
          className="fixed bottom-20 right-5 z-50 w-[min(92vw,380px)] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          style={{
            backgroundColor: "var(--color-surface-soft)",
            border:
              "1px solid color-mix(in srgb, var(--color-text) 12%, transparent)",
            maxHeight: "min(70vh, 560px)",
          }}
        >
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{
              backgroundColor: "var(--color-text)",
              color: "var(--color-surface)",
            }}
          >
            <div className="min-w-0">
              <div
                className="text-sm font-semibold truncate"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {practice.name}
              </div>
              <div className="text-[11px] opacity-80">
                {tt("Virtual assistant", "Asistente virtual")}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="opacity-80 hover:opacity-100"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <div ref={scroller} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user" ? "flex justify-end" : "flex justify-start"
                }
              >
                <div
                  className="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed"
                  style={
                    m.role === "user"
                      ? {
                          backgroundColor: "var(--color-text)",
                          color: "var(--color-surface)",
                          fontFamily: "var(--font-body)",
                        }
                      : {
                          backgroundColor:
                            "color-mix(in srgb, var(--color-secondary) 35%, var(--color-surface))",
                          color: "var(--color-text)",
                          fontFamily: "var(--font-body)",
                        }
                  }
                >
                  {m.text}
                </div>
              </div>
            ))}
            {busy ? (
              <div className="flex justify-start">
                <div
                  className="rounded-2xl px-3.5 py-2.5 text-[14px]"
                  style={{
                    backgroundColor:
                      "color-mix(in srgb, var(--color-secondary) 35%, var(--color-surface))",
                    color: "var(--color-text-muted)",
                  }}
                >
                  …
                </div>
              </div>
            ) : null}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="p-3 flex gap-2"
            style={{
              borderTop:
                "1px solid color-mix(in srgb, var(--color-text) 10%, transparent)",
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={tt("Type a message…", "Escribe un mensaje…")}
              className="flex-1 rounded-full px-4 py-2.5 text-sm outline-none"
              style={{
                backgroundColor: "var(--color-surface)",
                border:
                  "1px solid color-mix(in srgb, var(--color-text) 14%, transparent)",
                color: "var(--color-text)",
                fontFamily: "var(--font-body)",
              }}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-full px-4 py-2.5 text-sm font-medium disabled:opacity-50"
              style={{
                backgroundColor: "var(--color-accent)",
                color: "#fff",
                fontFamily: "var(--font-body)",
              }}
            >
              {tt("Send", "Enviar")}
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
