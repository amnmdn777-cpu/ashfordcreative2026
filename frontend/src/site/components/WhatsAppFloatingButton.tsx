import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { useI18n } from "@site/lib/i18n";
import { getFunnelSessionId } from "@site/lib/funnel";

const tx = (locale: "en" | "es", en: string, es: string) =>
  locale === "es" ? es : en;

/**
 * Floating "Chat on WhatsApp" pill anchored bottom-right on every
 * patient-facing standalone surface (the 9 template demos, the
 * `/p/<token>` prospect portals, the `/preview/*` showcase).
 *
 * Design choices:
 *   - Number is hardcoded (Candice's personal WhatsApp). The founder
 *     declined the env-var / Business-API route for the < 1000 msg /
 *     month volume — the click goes straight to wa.me on her phone.
 *   - On click we POST `/api/public/whatsapp/click` with the template,
 *     page path, locale, session id, and referrer. Fire-and-forget so
 *     the redirect to wa.me is never blocked by the analytics call.
 *   - The wa.me link opens in a new tab so the demo page state is
 *     preserved if the visitor decides to come back.
 *   - Anchored above the 988 crisis floater on mobile (bottom-20) so
 *     the two floaters never overlap.
 *
 * Intentionally does NOT support a chat-widget UX (no message preview,
 * no typing indicator, no transcript) — the founder's explicit design
 * is "click → wa.me, message lives on Candice's personal phone".
 */

// Candice's personal WhatsApp. wa.me requires digits-only (no +,
// no spaces, no dashes). Number is +505 8111 3197 (Nicaragua).
const CANDICE_WHATSAPP_DIGITS = "50581113197";

const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

const buildWaMeLink = (digits: string, greeting: string): string =>
  `https://wa.me/${digits}?text=${encodeURIComponent(greeting)}`;

const greetingFor = (locale: "en" | "es", templateKey: string | null) => {
  const en = templateKey
    ? `Hi! I'm interested in the ${templateKey} template — can we chat?`
    : "Hi! I'd like to ask a question about your therapy websites.";
  const es = templateKey
    ? `¡Hola! Me interesa la plantilla ${templateKey} — ¿podemos hablar?`
    : "¡Hola! Tengo una pregunta sobre sus sitios web para terapeutas.";
  return locale === "es" ? es : en;
};

const inferTemplateKey = (): string | null => {
  if (typeof window === "undefined") return null;
  const m = window.location.pathname.match(/^\/(?:template|t|preview)\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
};

export function WhatsAppFloatingButton() {
  const { locale } = useI18n();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleClick = () => {
    const templateKey = inferTemplateKey();
    const sessionId = getFunnelSessionId();
    const greeting = greetingFor(locale, templateKey);

    // Fire-and-forget click logger. `keepalive: true` so the POST
    // survives the window unload that wa.me triggers (the user is
    // navigating away to WhatsApp Web / the WhatsApp app handler).
    try {
      void fetch(`${apiBase}/api/public/whatsapp/click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          sessionId,
          templateKey,
          pagePath: window.location.pathname,
          referrer: document.referrer || undefined,
          locale,
        }),
      });
    } catch {
      // Best-effort — never block the redirect.
    }

    window.open(
      buildWaMeLink(CANDICE_WHATSAPP_DIGITS, greeting),
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <div
      data-testid="whatsapp-floating-button"
      className="fixed right-4 z-40 print:hidden bottom-20 sm:bottom-4 sm:right-[calc(360px+2rem)]"
    >
      <div className="relative flex items-center gap-2 rounded-full bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30 hover:shadow-xl hover:bg-[#1ebe5d] transition-all">
        <button
          type="button"
          onClick={handleClick}
          aria-label={tx(locale, "Chat on WhatsApp", "Chatear por WhatsApp")}
          className="flex items-center gap-2 pl-3.5 pr-4 py-2.5 text-sm font-medium rounded-full"
        >
          <MessageCircle className="w-4 h-4" aria-hidden />
          <span className="hidden sm:inline">
            {tx(locale, "Chat on WhatsApp", "Chatear por WhatsApp")}
          </span>
          <span className="sm:hidden">WhatsApp</span>
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={tx(locale, "Dismiss", "Cerrar")}
          className="pr-2.5 pl-1 py-2.5 opacity-70 hover:opacity-100"
        >
          <X className="w-3.5 h-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
