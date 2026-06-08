import { Check, Eye } from "lucide-react";
// Check is still used by the "ALSO INCLUDED" pill icon at the start of
// the row; the per-item check next to bundled labels was removed.

/**
 * Single-row dense bandeau replacing the ~250px-tall 7-card grid that
 * used to render the free defaults + bundled-paid included addons on
 * the Pricing, TemplateRoute, and ProspectPortal surfaces. Each item
 * is a click-to-preview button so the per-item drawer affordance is
 * preserved (#214). Bundled paid addons render with a leading ✓ so the
 * prospect can tell at a glance which items are bundled-paid vs
 * free-default. Founder feedback 2026-05: salesperson shouldn't waste
 * pitch time on free defaults.
 */

export type IncludedBandeauItem = {
  key: string;
  label: string;
  /** True for paid add-ons bundled into the $199/mo plan (welcome_kit
   * etc.); renders a leading ✓ to differentiate from the free default
   * features. */
  bundled?: boolean;
};

export type IncludedBandeauPalette = "sage" | "cream";

export type IncludedBandeauVariant = "included" | "could-be-included";

export function IncludedBandeau({
  items,
  onPreview,
  palette,
  locale,
  className,
  variant = "included",
}: {
  items: readonly IncludedBandeauItem[];
  onPreview: (key: string) => void;
  palette: IncludedBandeauPalette;
  locale: "en" | "es";
  className?: string;
  /** Visual + copy variant. `included` = "Also included" pill (default,
   *  current behaviour). `could-be-included` = "Could also be added"
   *  pill rendered in muted ink so the prospect distinguishes it from
   *  the bundled-included row above (founder feedback 2026-05: needed
   *  a parallel section listing add-ons the prospect MAY pick if they
   *  want, sitting right below the included one). */
  variant?: IncludedBandeauVariant;
}) {
  const isCream = palette === "cream";
  const isOptional = variant === "could-be-included";
  const cnContainer = isOptional
    ? isCream
      ? "rounded-xl border border-dashed border-ink/15 bg-cream/40"
      : "rounded-xl border border-dashed border-cream/20 bg-cream/[0.07]"
    : isCream
      ? "rounded-xl border border-cream/25 bg-cream/[0.05]"
      : "rounded-xl border border-sage/30 bg-white/70";
  const cnPill = isOptional
    ? isCream
      ? "bg-ink/[0.08] text-ink/70"
      : "bg-cream/[0.12] text-cream/70"
    : isCream
      ? "bg-cream/85 text-ink"
      : "bg-sage text-cream";
  // Optional variant sits on a semi-transparent cream container that is
  // often rendered on a dark (ink) toolbar — ink-coloured text becomes
  // nearly invisible there. Use cream-toned text for optional+sage so
  // the chips are legible in both light and dark contexts.
  const cnLink = isCream
    ? "text-cream/85 hover:text-cream decoration-cream/40"
    : isOptional
      ? "text-cream/80 hover:text-cream decoration-cream/40"
      : "text-ink/80 hover:text-ink decoration-sage/60";
  const cnSep = isCream ? "text-cream/30" : isOptional ? "text-cream/25" : "text-ink/25";
  const cnHint = isCream ? "text-cream/55" : isOptional ? "text-cream/45" : "text-sage/80";
  const labels = {
    also: isOptional
      ? locale === "es"
        ? "Podría agregarse"
        : "Could be added"
      : locale === "es"
        ? "También incluido"
        : "Also included",
    tap: locale === "es" ? "Toca para ver" : "Tap any to preview",
  };
  // Optional variant uses a "+" mark so the prospect grasps "extra,
  // not yet selected" at a glance instead of a confusing ✓ pill.
  return (
    <div className={`${cnContainer} px-4 py-2.5 ${className ?? ""}`}>
      <div className="flex items-center gap-x-2 gap-y-1.5 flex-wrap text-[12.5px] leading-snug">
        <span
          className={`${cnPill} inline-flex items-center gap-1.5 shrink-0 rounded-full px-2 py-0.5 font-medium uppercase tracking-wider text-[9.5px]`}
        >
          {isOptional ? (
            <span aria-hidden className="text-[11px] leading-none">+</span>
          ) : (
            <Check className="w-2.5 h-2.5" strokeWidth={3} aria-hidden />
          )}
          <span>{labels.also}</span>
        </span>
        {items.map((item, i) => {
          // Items whose preview drawer was never wired up (spanish
          // translation, crisis 988 button) — they render as plain
          // text so the prospect doesn't tap them and get no
          // response. Founder iPad note 2026-05.
          const NON_INTERACTIVE_KEYS = new Set([
            "spanish_translation",
            "crisis_hotline_button",
          ]);
          const interactive = !NON_INTERACTIVE_KEYS.has(item.key);
          return (
            <span key={item.key} className="inline-flex items-center gap-2">
              {interactive ? (
                <button
                  type="button"
                  onClick={() => onPreview(item.key)}
                  className={`inline-flex items-center gap-1 ${cnLink} hover:underline underline-offset-4 transition-colors`}
                >
                  {/* Per-item ✓ for bundled paid add-ons removed
                      2026-05 (founder iPad note): the "ALSO INCLUDED"
                      pill at the start of the row already states the
                      category — repeating a tiny check next to half the
                      items just made the row noisy. The `bundled` flag
                      on `IncludedBandeauItem` is still accepted for
                      back-compat but no longer renders any visual. */}
                  {item.label}
                </button>
              ) : (
                <span className={`inline-flex items-center gap-1 ${cnLink} cursor-default`}>
                  {item.label}
                </span>
              )}
              {i < items.length - 1 && (
                <span className={cnSep} aria-hidden>
                  ·
                </span>
              )}
            </span>
          );
        })}
        <span
          className={`${cnHint} ml-auto shrink-0 inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider`}
        >
          <Eye className="w-3 h-3" />
          {labels.tap}
        </span>
      </div>
    </div>
  );
}
