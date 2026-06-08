import { useEffect, useState } from "react";
import { TIERS, type TierKey } from "@workspace/api-zod";
import { fmtUsdFromCents } from "@site/lib/utils";
import { useI18n } from "@site/lib/i18n";
import { Sparkles, Loader2, Star, X } from "lucide-react";

/**
 * LiveTierSwitcher — a high-visibility tier swap control designed for
 * live sales calls (phone / Zoom co-browse). The rep can pivot the
 * customer between Boutique / Pro / Concierge in front of them, with a
 * 2-3s "rebuilding" overlay that sells the moment as a fresh experience
 * instead of a state diff.
 *
 * - Sticky pill in the top-right (always visible)
 * - Click → expand to 3 tier cards
 * - Pick a tier → fullscreen overlay (loader + tier copy) for ~2.5s
 * - Once overlay fades, `onChange` fires and the host site re-renders
 *
 * The overlay is deliberately heavy so the customer perceives a real
 * site-rebuild moment — that's the whole point of doing this on a call.
 */

const TIER_ORDER: readonly TierKey[] = [
  "boutique",
  "boutique_pro",
  "boutique_concierge",
] as const;

// Loading copy shown during the rebuild overlay (EN + ES).
const REBUILD_COPY: Record<TierKey, { en: string; es: string }> = {
  boutique: {
    en: "Rebuilding your Boutique site",
    es: "Reconstruyendo tu sitio Boutique",
  },
  boutique_pro: {
    en: "Rebuilding your Boutique Pro site",
    es: "Reconstruyendo tu sitio Boutique Pro",
  },
  boutique_concierge: {
    en: "Rebuilding your Boutique Concierge site",
    es: "Reconstruyendo tu sitio Boutique Concierge",
  },
};

// Sub-copy under the spinner — names a few capabilities of the
// destination tier so the customer feels the upgrade live.
const REBUILD_SUB: Record<TierKey, { en: string; es: string }> = {
  boutique: {
    en: "Bilingual site · Crisis button · Office tour · Google presence",
    es: "Sitio bilingüe · Botón de crisis · Tour de oficina · Google",
  },
  boutique_pro: {
    en: "Online booking · First-visit video · Telehealth bridge · Onboarding hub",
    es: "Reservas en línea · Video primera visita · Telehealth · Onboarding",
  },
  boutique_concierge: {
    en: "Telehealth full setup · Ghostwritten Insights Journal · 14+ pieces/year",
    es: "Telehealth completo · Insights Journal escrito a mano · 14+ piezas/año",
  },
};

export function LiveTierSwitcher({
  currentTier,
  onChange,
  position = "top-right",
}: {
  currentTier: TierKey;
  onChange: (tier: TierKey) => void;
  position?: "top-right" | "top-center";
}) {
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [pendingTier, setPendingTier] = useState<TierKey | null>(null);

  // Lock body scroll while overlay is up so the visual feels "fullscreen".
  useEffect(() => {
    if (!pendingTier) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [pendingTier]);

  // Drive the rebuild animation: ~2.5s in, then fire onChange, then ~0.6s
  // fade-out. Total perceived time ~3s — enough to feel like a real
  // rebuild, short enough to keep the call momentum.
  useEffect(() => {
    if (!pendingTier) return;
    const t = window.setTimeout(() => {
      onChange(pendingTier);
      // Keep overlay up briefly so the new content paints behind it,
      // then unmount.
      window.setTimeout(() => setPendingTier(null), 600);
    }, 2400);
    return () => window.clearTimeout(t);
  }, [pendingTier, onChange]);

  const triggerTier = (k: TierKey) => {
    if (k === currentTier) {
      setOpen(false);
      return;
    }
    setOpen(false);
    setPendingTier(k);
  };

  const posClass =
    position === "top-center"
      ? "top-3 left-1/2 -translate-x-1/2"
      : "top-3 right-3";

  const currentLabel = TIERS[currentTier].label;
  const currentMonthly = fmtUsdFromCents(TIERS[currentTier].monthlyCents);

  return (
    <>
      {/* ── Sticky pill + expanded card ─────────────────────────────── */}
      <div
        className={`fixed ${posClass} z-[60] print:hidden`}
        data-testid="live-tier-switcher"
      >
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            data-testid="live-tier-switcher-pill"
            className="inline-flex items-center gap-2 rounded-full bg-ink/95 backdrop-blur text-cream text-xs font-medium px-4 py-2.5 shadow-2xl border border-gold/40 hover:bg-ink transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-gold" />
            <span className="font-mono uppercase tracking-widest text-[10px] text-cream/60">
              {locale === "es" ? "Demo en vivo" : "Live demo"}
            </span>
            <span className="hidden sm:inline text-cream/40">·</span>
            <span className="hidden sm:inline">{currentLabel}</span>
            <span className="hidden sm:inline text-cream/55 font-mono text-[10px]">
              {currentMonthly}/mo
            </span>
          </button>
        ) : (
          <div
            data-testid="live-tier-switcher-panel"
            className="bg-ink/95 backdrop-blur text-cream rounded-2xl shadow-2xl border border-gold/40 p-4 w-[min(420px,calc(100vw-1.5rem))]"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-gold" />
                <span className="text-[11px] uppercase tracking-[0.18em] font-mono text-cream/70">
                  {locale === "es" ? "Cambiar el nivel en vivo" : "Switch tier live"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={locale === "es" ? "Cerrar" : "Close"}
                className="p-1 text-cream/60 hover:text-cream rounded-md hover:bg-cream/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-cream/55 mb-3 leading-snug">
              {locale === "es"
                ? "Mostrar el sitio completo en cualquiera de los 3 niveles. El sitio se reconstruye en vivo en pocos segundos."
                : "Show the full site at any of the 3 tiers. The site rebuilds live in a few seconds."}
            </p>
            <div className="flex flex-col gap-2">
              {TIER_ORDER.map((k) => {
                const t = TIERS[k];
                const selected = k === currentTier;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => triggerTier(k)}
                    aria-pressed={selected}
                    data-testid={`live-tier-switcher-card-${k}`}
                    className={
                      "relative text-left rounded-xl px-3 py-2.5 border transition-all flex items-center gap-3 " +
                      (selected
                        ? "border-gold bg-cream/[0.08] cursor-default"
                        : "border-cream/15 bg-cream/[0.03] hover:border-gold/60 hover:bg-cream/[0.06]")
                    }
                  >
                    {t.recommended && (
                      <span className="absolute -top-2 left-3 inline-flex items-center gap-1 bg-gold text-ink text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-sm">
                        <Star className="w-2.5 h-2.5" strokeWidth={2.5} />
                        {locale === "es" ? "Recomendado" : "Recommended"}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-cream/55">
                        {t.label}
                      </div>
                      <div className="text-[11px] text-cream/70 leading-snug line-clamp-2">
                        {t.capabilities.length}{" "}
                        {locale === "es" ? "capacidades incluidas" : "capabilities included"}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-display text-xl text-cream leading-none">
                        {fmtUsdFromCents(t.monthlyCents)}
                      </div>
                      <div className="text-[9px] font-mono text-cream/45 uppercase tracking-wider">
                        /mo
                      </div>
                    </div>
                    {selected && (
                      <span className="absolute top-2 right-2 text-[9px] font-mono uppercase tracking-widest text-gold">
                        {locale === "es" ? "actual" : "current"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Fullscreen rebuild overlay ───────────────────────────────── */}
      {pendingTier && (
        <div
          data-testid="live-tier-switcher-overlay"
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="fixed inset-0 z-[100] bg-ink/95 backdrop-blur-md flex flex-col items-center justify-center text-center px-6 animate-[fadeIn_0.3s_ease-out]"
          style={{
            // inline keyframes via CSS variable + style — keeps this
            // component self-contained without touching the global
            // tailwind config.
            animation: "fadeIn 0.3s ease-out",
          }}
        >
          <style>{`
            @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
            @keyframes scaleUp { from { transform: scale(0.92); opacity: 0 } to { transform: scale(1); opacity: 1 } }
            @keyframes barFill { from { width: 0% } to { width: 100% } }
          `}</style>
          <div
            className="flex flex-col items-center gap-6 max-w-md"
            style={{ animation: "scaleUp 0.4s ease-out" }}
          >
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gold/15 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-gold animate-spin" />
              </div>
              <Sparkles className="w-5 h-5 text-gold absolute -top-1 -right-1" />
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-gold/80 mb-2">
                {locale === "es" ? "Reconstruyendo en vivo" : "Live rebuild"}
              </div>
              <h2 className="font-display text-3xl sm:text-4xl text-cream leading-tight">
                {REBUILD_COPY[pendingTier][locale === "es" ? "es" : "en"]}
              </h2>
              <p className="text-cream/65 text-sm mt-3 leading-snug">
                {REBUILD_SUB[pendingTier][locale === "es" ? "es" : "en"]}
              </p>
            </div>
            <div className="w-full h-1 bg-cream/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gold rounded-full"
                style={{ animation: "barFill 2.4s ease-out forwards" }}
              />
            </div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-cream/40">
              {fmtUsdFromCents(TIERS[pendingTier].monthlyCents)}
              {locale === "es" ? " / mes" : " / month"}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
