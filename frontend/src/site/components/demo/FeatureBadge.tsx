import { useState, type ReactNode } from "react";
import { useI18n } from "@site/lib/i18n";
import { useDemo } from "./DemoContext";
import {
  FEATURE_LABELS,
  TEMPLATE_FEATURES,
  homepageFeatureNumber,
  type FeatureKey,
} from "@site/lib/templateFeatures";

/**
 * Pulse-dot for the demo overlay. Renders ONLY when DemoContext is
 * active (i.e. on /template/<key>). Two surfaces:
 *
 *   <FeatureMark featureKey>...</FeatureMark>
 *     Wraps a section/element with `position: relative` and pins a
 *     numbered dot to one of its corners.
 *
 *   <FeatureDot featureKey />
 *     Inline dot for elements that are themselves position:fixed or that
 *     can't be wrapped (LanguageToggle inside a skin nav, CrisisBanner
 *     floating pill). Renders next to its siblings.
 *
 * Hover/tap reveals a small tooltip with the feature label + one-sentence
 * explanation. Click also scrolls to the wrapped element via anchor.
 */

type Position = "top-right" | "top-left" | "bottom-right" | "bottom-left";

const POS_CLASSES: Record<Position, string> = {
  "top-right": "top-2 right-2",
  "top-left": "top-2 left-2",
  "bottom-right": "bottom-2 right-2",
  "bottom-left": "bottom-2 left-2",
};

function useTooltipText(featureKey: FeatureKey) {
  const { locale } = useI18n();
  const { templateKey } = useDemo();
  const loc: "en" | "es" = locale === "es" ? "es" : "en";
  const label = FEATURE_LABELS[featureKey][loc];
  const map = templateKey ? TEMPLATE_FEATURES[templateKey] : null;
  const sub = map?.[featureKey]?.sublabel?.[loc] ?? "";
  return { label, sub, loc };
}

export function FeatureDot({
  featureKey,
  className = "",
}: {
  featureKey: FeatureKey;
  className?: string;
}) {
  const { active, templateKey } = useDemo();
  const [open, setOpen] = useState(false);
  const num = active ? homepageFeatureNumber(templateKey, featureKey) : null;
  const { label, sub } = useTooltipText(featureKey);
  if (!active || num == null) return null;
  return (
    <span
      className={`relative inline-flex print:hidden ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${num}. ${label}`}
        className="relative inline-flex items-center justify-center w-6 h-6 rounded-full bg-gold text-ink text-[10px] font-mono font-bold shadow-lg ring-2 ring-cream/80 hover:scale-110 transition-transform"
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-gold/60 animate-ping"
        />
        <span className="relative">{num}</span>
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 max-w-[80vw] bg-ink text-cream text-[12px] rounded-lg shadow-2xl border border-cream/15 p-3 z-50"
        >
          <span className="block font-medium mb-1">
            {num}. {label}
          </span>
          <span className="block text-cream/75 leading-snug">{sub}</span>
        </span>
      )}
    </span>
  );
}

export function FeatureMark({
  featureKey,
  position = "top-right",
  children,
  anchorId,
}: {
  featureKey: FeatureKey;
  position?: Position;
  children: ReactNode;
  /** Optional id placed on the wrapper so the demo legend can scroll-to. */
  anchorId?: string;
}) {
  const { active, templateKey } = useDemo();
  const num = active ? homepageFeatureNumber(templateKey, featureKey) : null;
  if (!active || num == null) return <>{children}</>;
  return (
    <div className="relative" id={anchorId} data-feature-mark={featureKey}>
      {children}
      <div className={`pointer-events-none absolute ${POS_CLASSES[position]} z-30`}>
        <span className="pointer-events-auto">
          <FeatureDot featureKey={featureKey} />
        </span>
      </div>
    </div>
  );
}
