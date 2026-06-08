import { useI18n } from "@site/lib/i18n";
import type { StringKey } from "@site/lib/strings";

// Eyebrow/title strip above every inline add-on demo. When `included` is true,
// renders an "Included" badge instead of the +$X/mo price chip.
export function RibbonHeader({
  nameKey,
  taglineKey,
  price,
  included = false,
}: {
  nameKey: StringKey;
  taglineKey: StringKey;
  price?: string;
  included?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8 pb-6 border-b border-ink/10">
      <div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-sage font-medium mb-1.5">
          {t("addon_inline_eyebrow")}
        </div>
        <h3 className="font-[var(--font-display)] text-3xl text-ink leading-tight">
          {t(nameKey)}
        </h3>
        <p className="text-sm text-ink/70 mt-1.5 font-[var(--font-serif)]">
          {t(taglineKey)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {/* Founder feedback 2026-05-17: every add-on now ships included in
            all three tiers (Boutique/Pro/Concierge), so the per-month price
            fallback has been retired — the ribbon never reads as a paid
            extra. The Included badge always renders. */}
        <span className="font-mono text-xs uppercase tracking-widest text-sage-light bg-sage/10 px-2.5 py-1 rounded-full">
          {t("addon_inline_included")}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest bg-sage/10 text-sage-light px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-sage animate-pulse" />
          {t("addon_inline_status")}
        </span>
      </div>
    </div>
  );
}
