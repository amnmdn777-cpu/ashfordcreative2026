import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function askGeminiDirect(
  system: string,
  history: Msg[],
  attempt = 0,
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
  // Free-tier rate limit (429) / transient 503 — back off briefly and retry
  // up to twice. This is the main cause of "sometimes it doesn't respond"
  // when messages come in quickly on the free tier.
  if ((res.status === 429 || res.status === 503) && attempt < 2) {
    await sleep(1200 * (attempt + 1));
    return askGeminiDirect(system, history, attempt + 1);
  }
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  return (
    data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ??
    "Sorry — I didn't catch that. Could you rephrase, or tap “Contact” to reach the office?"
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

  // Use a portal to render directly into document.body.
  // This escapes the `transform: translateZ(0)` wrapper in TemplateRoute
  // which would otherwise trap `position: fixed` children relative to
  // that container instead of the viewport — making the button invisible.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;

  const ui = (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={tt("Chat with us", "Chatea con nosotros")}
        style={{
          position: "fixed",
          bottom: "80px",
          right: "20px",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          borderRadius: "9999px",
          padding: "12px 20px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
          transition: "transform 0.2s",
          border: "none",
          cursor: "pointer",
          backgroundColor: "#1a1a1a",
          color: "#faf9f7",
          fontFamily: "Inter, sans-serif",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.transform = "translateY(-2px)")
        }
        onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
      >
        {/* Robot / bot icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect
            x="3"
            y="8"
            width="18"
            height="12"
            rx="3"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle cx="8.5" cy="14" r="1.5" fill="currentColor" />
          <circle cx="15.5" cy="14" r="1.5" fill="currentColor" />
          <path
            d="M12 2v4M10 2h4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="12" cy="6" r="1.5" fill="currentColor" />
          <path
            d="M7 20v2M17 20v2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span style={{ fontSize: "14px", fontWeight: 500 }}>
          {tt("Ask us", "Pregúntanos")}
        </span>
      </button>

      {/* Panel */}
      {open ? (
        <div
          style={{
            position: "fixed",
            bottom: "140px",
            right: "20px",
            zIndex: 9999,
            width: "min(92vw, 380px)",
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 8px 40px rgba(0,0,0,0.22)",
            display: "flex",
            flexDirection: "column",
            maxHeight: "min(70vh, 560px)",
            backgroundColor: "#f5f1eb",
            border: "1px solid rgba(26,26,26,0.12)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "#1a1a1a",
              color: "#faf9f7",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {practice.name}
              </div>
              <div style={{ fontSize: "11px", opacity: 0.8 }}>
                {tt("Virtual assistant", "Asistente virtual")}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#faf9f7",
                opacity: 0.8,
              }}
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

          {/* Messages */}
          <div
            ref={scroller}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "80%",
                    borderRadius: "16px",
                    padding: "10px 14px",
                    fontSize: "14px",
                    lineHeight: 1.5,
                    fontFamily: "Inter, sans-serif",
                    ...(m.role === "user"
                      ? { backgroundColor: "#1a1a1a", color: "#faf9f7" }
                      : {
                          backgroundColor: "rgba(210,180,160,0.35)",
                          color: "#1a1a1a",
                        }),
                  }}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {busy ? (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    borderRadius: "16px",
                    padding: "10px 14px",
                    fontSize: "14px",
                    backgroundColor: "rgba(210,180,160,0.35)",
                    color: "#888",
                  }}
                >
                  …
                </div>
              </div>
            ) : null}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            style={{
              padding: "12px",
              display: "flex",
              gap: "8px",
              borderTop: "1px solid rgba(26,26,26,0.10)",
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={tt("Type a message…", "Escribe un mensaje…")}
              style={{
                flex: 1,
                borderRadius: "9999px",
                padding: "10px 16px",
                fontSize: "14px",
                outline: "none",
                backgroundColor: "#faf9f7",
                border: "1px solid rgba(26,26,26,0.14)",
                color: "#1a1a1a",
                fontFamily: "Inter, sans-serif",
              }}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              style={{
                borderRadius: "9999px",
                padding: "10px 16px",
                fontSize: "14px",
                fontWeight: 500,
                backgroundColor: "#c4714a",
                color: "#fff",
                border: "none",
                cursor: busy || !input.trim() ? "not-allowed" : "pointer",
                opacity: busy || !input.trim() ? 0.5 : 1,
                fontFamily: "Inter, sans-serif",
              }}
            >
              {tt("Send", "Enviar")}
            </button>
          </form>
        </div>
      ) : null}
    </>
  );

  return createPortal(ui, document.body);
}
