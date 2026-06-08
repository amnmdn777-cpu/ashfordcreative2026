import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, ArrowRight, Check, Minus, Gift } from "lucide-react";
import type { AddonDef } from "@workspace/api-zod";
import { ADDON_PREVIEWS } from "./addons/registry";
import { useI18n } from "@site/lib/i18n";

const fmt = (cents: number) => `$${(cents / 100).toFixed(0)}`;

/**
 * Drawer mode — "selectable" is the default catalog 2.0 behavior
 * (price + add/remove button). "included" is for the seven
 * always-included default features (#212): suppresses the price + CTA
 * in favor of an "Always included" badge so the prospect doesn't
 * mistake them for upsells.
 */
export type AddonDrawerMode = "selectable" | "included";

/**
 * Right-anchored slide-over drawer that opens when the prospect clicks
 * an add-on card on the Pricing page. Hosts the live preview component
 * (from `ADDON_PREVIEWS`) plus the long-form pitch, bullets, price,
 * and a single "Add to my plan" CTA that hands control back to the
 * parent (the self-serve checkout below ticks the box and scrolls).
 *
 * We render through a portal so the overlay sits above the page nav
 * and traps body scroll while open. Closing on Escape and on backdrop
 * click is handled here; everything else (open state, which addon)
 * lives in the parent.
 */
export function AddonPreviewDrawer({
  addon,
  isSelected,
  onClose,
  onAddToPlan,
  mode = "selectable",
  practitionerName,
}: {
  addon: AddonDef | null;
  isSelected: boolean;
  onClose: () => void;
  onAddToPlan: (key: string) => void;
  mode?: AddonDrawerMode;
  /**
   * Real practitioner display name for the prospect being shown the
   * drawer. Plumbed straight through to whichever preview component
   * opts in (today: WelcomeKitPreview's email "from" line — task
   * #221). Omit on sample/marketing surfaces (Pricing, public
   * TemplateRoute) and the preview falls back to the SAMPLE
   * "Dr. Maya Alvarado" default. Mirrors the AddonInlineProps
   * pattern in `preview/portal/addonInline/index.ts`.
   */
  practitionerName?: string;
}) {
  const { locale } = useI18n();
  const open = !!addon;
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const focusInitial = window.setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (el) =>
          !el.hasAttribute("disabled") &&
          el.getAttribute("aria-hidden") !== "true",
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(focusInitial);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open || !addon) return null;

  const Preview = ADDON_PREVIEWS[addon.key];

  const tx = (en: string, es: string) => (locale === "es" ? es : en);

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label={tx("Close preview", "Cerrar vista previa")}
        className="absolute inset-0 bg-ink/60 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      />

      <aside
        ref={dialogRef}
        aria-labelledby="addon-drawer-title"
        className="absolute right-0 top-0 h-full w-full sm:max-w-[640px] bg-cream shadow-2xl overflow-y-auto animate-in slide-in-from-right"
      >
        <header className="sticky top-0 z-10 bg-cream/95 backdrop-blur border-b border-ink/10 px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {/* Header eyebrow — for included default features the
                generic "Add-on preview" caption would let the prospect
                worry "wait, am I paying for this?". A sage gift badge
                with "INCLUDED · $0/mo" front-loads the answer before
                they read a single bullet. Selectable add-ons keep the
                neutral eyebrow. (Founder note 2026-05-02.) */}
            {mode === "included" ? (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-sage/15 text-sage border border-sage/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] font-mono font-medium mb-1.5">
                <Gift className="w-3 h-3" />
                {tx("Included · $0/mo", "Incluido · $0/mes")}
              </div>
            ) : (
              <div className="text-[10px] uppercase tracking-[0.22em] text-sage font-mono mb-1">
                {tx("Add-on preview", "Vista previa del add-on")}
              </div>
            )}
            <h2
              id="addon-drawer-title"
              className="font-display text-2xl text-ink leading-tight truncate"
            >
              {addon.label}
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="shrink-0 -m-2 p-2 text-ink/60 hover:text-ink transition-colors"
            aria-label={tx("Close", "Cerrar")}
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="px-6 py-6 space-y-6">
          {/* Live preview */}
          {Preview ? (
            <Preview practitionerName={practitionerName} />
          ) : (
            <div className="rounded-xl border border-dashed border-ink/20 p-10 text-center text-ink/55 text-sm bg-cream-warm">
              {tx(
                "Visual preview coming soon — talk to a rep for a walkthrough.",
                "Vista previa visual en camino — pide una demo a un representante.",
              )}
            </div>
          )}

          {/* Pitch — falls back EN→ES per-addon. `longPitchEs` is
              opt-in (#214 catalog 2.0); pre-existing addons render
              EN to ES visitors until the translation pass lands. */}
          {addon.longPitch && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-ink/55 font-mono mb-2">
                {tx("What you get", "Lo que recibes")}
              </div>
              <p className="text-[15px] text-ink/85 leading-[1.7] font-serif">
                {locale === "es" && addon.longPitchEs
                  ? addon.longPitchEs
                  : addon.longPitch}
              </p>
            </div>
          )}

          {/* Bullets — same EN→ES fallback. `bulletsEs` is paired
              1:1 with `bullets` by index; we render the ES array as
              a whole when present, otherwise EN. */}
          {addon.bullets && addon.bullets.length > 0 && (
            <ul className="space-y-2.5">
              {(locale === "es" && addon.bulletsEs && addon.bulletsEs.length === addon.bullets.length
                ? addon.bulletsEs
                : addon.bullets
              ).map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-2.5 text-sm text-ink/85"
                >
                  <Check className="w-4 h-4 text-sage shrink-0 mt-0.5" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Sticky footer — selectable add-on shows price + add/remove,
            included default feature shows a "ships with every plan"
            reassurance (no toggle, since the prospect can't opt out
            of a default). */}
        {mode === "included" ? (
          <footer className="sticky bottom-0 bg-cream-warm border-t border-ink/10 px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-sage/15 text-sage flex items-center justify-center shrink-0">
                <Gift className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-sage font-mono">
                  {tx("Always included", "Siempre incluido")}
                </div>
                <div className="text-[13px] text-ink/85 leading-tight">
                  {tx(
                    "Ships with every $199/mo plan — nothing to add.",
                    "Incluido en cada plan de $199/mes — nada que agregar.",
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-sm px-4 py-2.5 font-mono text-xs uppercase tracking-widest transition-colors border border-ink/20 text-ink/70 hover:border-ink/40 hover:text-ink bg-cream shrink-0"
            >
              {tx("Close", "Cerrar")}
            </button>
          </footer>
        ) : (
          <footer className="sticky bottom-0 bg-cream-warm border-t border-ink/10 px-6 py-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-ink/55 font-mono">
                {tx("Recurring", "Recurrente")}
              </div>
              <div className="font-display text-2xl text-ink leading-none">
                +{fmt(addon.monthlyCents)}
                <span className="text-sm font-normal text-ink/60">
                  /{tx("mo", "mes")}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onAddToPlan(addon.key)}
              className={
                "inline-flex items-center gap-2 rounded-sm px-5 py-3 font-mono text-xs uppercase tracking-widest transition-colors " +
                (isSelected
                  ? "border border-ink/20 text-ink/70 hover:border-ink/40 hover:text-ink bg-cream"
                  : "bg-ink text-cream hover:bg-ink-deep")
              }
              aria-pressed={isSelected}
            >
              {isSelected ? (
                <>
                  <Minus className="w-3.5 h-3.5" />
                  {tx("Remove from plan", "Quitar del plan")}
                </>
              ) : (
                <>
                  {tx("Add to my plan", "Agregar a mi plan")}
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
            {isSelected && (
              <span className="sr-only">
                <Check className="w-3.5 h-3.5" />
                {tx("Currently in your plan", "Actualmente en tu plan")}
              </span>
            )}
          </footer>
        )}
      </aside>
    </div>,
    document.body,
  );
}
