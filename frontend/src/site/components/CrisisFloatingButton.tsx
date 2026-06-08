import { useEffect, useState } from "react";
import { LifeBuoy, Phone, MessageSquare, X } from "lucide-react";
import { useI18n } from "@site/lib/i18n";

const tx = (locale: "en" | "es", en: string, es: string) =>
  locale === "es" ? es : en;

export function CrisisFloatingButton() {
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // On mobile (<sm) the banner is edge-anchored bottom full-width so
  // it doesn't compete with other floating chrome (demo bar pill,
  // template-specific overlays). The page needs padding-bottom on
  // mobile to keep content from being hidden underneath. Phase 12
  // Commit 6 — toggle a body class while the full banner is mounted;
  // the CSS rule in index.css applies the padding only at <sm AND
  // only while the banner is visible.
  useEffect(() => {
    if (!mounted || collapsed) return;
    document.body.classList.add("crisis-banner-visible");
    return () => document.body.classList.remove("crisis-banner-visible");
  }, [mounted, collapsed]);

  if (!mounted) return null;

  if (collapsed) {
    return (
      <button
        type="button"
        aria-label={tx(locale, "Open crisis resources", "Abrir recursos de crisis")}
        onClick={() => setCollapsed(false)}
        className="fixed bottom-4 right-4 z-50 w-11 h-11 rounded-full bg-ink text-cream shadow-lg flex items-center justify-center hover:bg-ink-deep transition-colors"
      >
        <LifeBuoy className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div
      data-testid="crisis-floating-banner"
      // Mobile: edge-anchored full-width at the bottom (no inset on
      // left/right/bottom). Desktop (sm+): floats with bottom-4 right-4
      // margins and a 360px max-width pill. Phase 12 Commit 6.
      className="fixed bottom-0 left-0 right-0 sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-[360px] z-50 print:hidden"
    >
      <div className="rounded-t-lg sm:rounded-lg bg-ink text-cream shadow-2xl overflow-hidden border-t sm:border border-cream/10">
        <div className="flex items-stretch">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-ink-deep transition-colors"
          >
            <span className="shrink-0 w-7 h-7 rounded-full bg-cream/10 flex items-center justify-center">
              <LifeBuoy className="w-4 h-4 text-cream" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[10px] uppercase tracking-[0.2em] text-cream/60 font-mono">
                {tx(locale, "In crisis?", "¿En crisis?")}
              </span>
              <span className="block text-sm font-medium leading-tight truncate">
                {tx(
                  locale,
                  "988 Suicide & Crisis Lifeline · 24/7",
                  "Línea 988 de Crisis y Suicidio · 24/7",
                )}
              </span>
            </span>
          </button>
          <button
            type="button"
            aria-label={tx(locale, "Hide", "Ocultar")}
            onClick={() => setCollapsed(true)}
            className="shrink-0 px-2 text-cream/50 hover:text-cream hover:bg-ink-deep transition-colors flex items-center"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {open && (
          <div className="px-3.5 pb-3.5 pt-1 space-y-2 border-t border-cream/10">
            <a
              href="tel:988"
              className="flex items-center gap-2 px-3 py-2 rounded-md bg-cream text-ink text-sm font-medium hover:bg-cream/90 transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              {tx(locale, "Call 988", "Llamar al 988")}
            </a>
            <a
              href="sms:741741?body=HELLO"
              className="flex items-center gap-2 px-3 py-2 rounded-md border border-cream/30 text-cream text-sm font-medium hover:border-cream/60 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {tx(locale, "Text HOME to 741741", "Texto HELLO al 741741")}
            </a>
            <p className="text-[11px] text-cream/55 leading-snug pt-1">
              {tx(
                locale,
                "If you or someone you love is in danger, call 911 or go to your nearest emergency room.",
                "Si tú o alguien que amas está en peligro, llama al 911 o ve a la sala de emergencias más cercana.",
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
