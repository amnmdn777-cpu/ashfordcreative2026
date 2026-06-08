import React from "react";
import { AlertTriangle } from "lucide-react";
import { FeatureDot } from "@site/components/demo/FeatureBadge";
import { useDemo } from "@site/components/demo/DemoContext";

export type CrisisCorner =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left";

interface CrisisBannerProps {
  /** Localized label for the crisis-line link, e.g. "988 Suicide & Crisis Lifeline · 24/7". */
  label?: string;
  /** Localized "In a crisis?" prefix. */
  prefix?: string;
  /**
   * Where to pin the banner. Default `bottom-right`. Templates with a
   * bottom-anchored hero decoration (Sunrise's glass bio card) pass
   * `top-right` so the banner doesn't occlude that chrome at common
   * viewport heights.
   */
  corner?: CrisisCorner;
  className?: string;
}

const CORNER_CLASSES: Record<CrisisCorner, string> = {
  "bottom-right": "bottom-4 right-4",
  "bottom-left": "bottom-4 left-4",
  "top-right": "top-4 right-4",
  "top-left": "top-4 left-4",
};

/**
 * 988 Suicide & Crisis Lifeline banner. Surfaces on every template;
 * pinned to the lower-right of the viewport so it never blocks
 * content but remains one tap away. Unstyled to template chrome —
 * uses theme tokens so it inherits the active palette.
 */
export function CrisisBanner({
  label = "988 Suicide & Crisis Lifeline · 24/7",
  prefix = "In crisis?",
  corner = "bottom-right",
  className = "",
}: CrisisBannerProps) {
  const { active } = useDemo();
  return (
    <>
    {active && (
      <div className={`fixed ${CORNER_CLASSES[corner]} z-50 print:hidden hidden sm:block`} style={{ transform: "translate(0, -36px)" }}>
        <FeatureDot featureKey="crisis_hotline_button" />
      </div>
    )}
    <a
      href="tel:988"
      role="link"
      aria-label={`${prefix} ${label}`}
      className={`fixed ${CORNER_CLASSES[corner]} z-40 hidden sm:inline-flex items-center gap-2 max-w-xs px-3 py-2 text-xs leading-tight shadow-lg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${className}`}
      style={{
        backgroundColor: "var(--color-primary)",
        color: "#fff",
        borderRadius: "var(--radius-sm)",
        fontFamily: "var(--font-body)",
      }}
    >
      <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
      <span className="flex flex-col">
        <span className="text-[10px] uppercase tracking-[0.2em] opacity-80">{prefix}</span>
        <span>{label}</span>
      </span>
    </a>
    </>
  );
}

export default CrisisBanner;
