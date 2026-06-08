import React, { type CSSProperties, type ReactNode } from "react";
import {
  TEMPLATES,
  paletteForTemplate,
  type TemplateKeyLiteral,
} from "@workspace/api-zod";

/**
 * Per-template theme wrapper. Reads PALETTES[templateKey] from the
 * canonical template registry and emits CSS variables on its root
 * div so descendant primitives consume `var(--color-primary)` etc.
 *
 * Templates wrap their root in <ThemeProvider templateKey="atrium">.
 * Primitives never read PALETTES directly and never inline hex.
 */

const FONT_BODY_FALLBACK = "'Inter', system-ui, -apple-system, sans-serif";

interface ThemeProviderProps {
  templateKey: TemplateKeyLiteral;
  children: ReactNode;
  /** Optional className passed through to the root div. */
  className?: string;
  /** When true, the wrapper renders a `<section>` instead of a `<div>`. */
  as?: "div" | "section" | "main";
}

export function ThemeProvider({
  templateKey,
  children,
  className,
  as = "div",
}: ThemeProviderProps) {
  const palette = paletteForTemplate(templateKey);
  const def = TEMPLATES[templateKey];

  const style: CSSProperties & Record<`--${string}`, string> = {
    "--color-primary": palette.primary,
    "--color-secondary": palette.secondary ?? palette.muted,
    "--color-accent": palette.accent,
    "--color-surface": palette.surface,
    "--color-surface-soft": palette.surfaceSoft ?? "#ffffff",
    "--color-text": palette.ink,
    "--color-text-muted": palette.muted,
    "--font-display": def?.font
      ? `'${def.font}', Georgia, serif`
      : "'Cormorant Garamond', Georgia, serif",
    "--font-body": def?.fontBody
      ? `'${def.fontBody}', system-ui, -apple-system, sans-serif`
      : FONT_BODY_FALLBACK,
    backgroundColor: palette.surface,
    color: palette.ink,
  };

  const Tag = as;
  return (
    <Tag
      data-template={templateKey}
      data-palette={palette.key}
      className={className}
      style={style}
    >
      {children}
    </Tag>
  );
}

export default ThemeProvider;
