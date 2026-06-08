import React from "react";
import { useI18n } from "@site/lib/i18n";
import { FeatureDot } from "@site/components/demo/FeatureBadge";

interface LanguageToggleProps {
  /** Visual variant: "pill" (rounded), "underline" (minimal), "outline" (bordered). */
  variant?: "pill" | "underline" | "outline";
  className?: string;
}

/**
 * EN/ES locale toggle. Reads from useI18n() and persists via the same
 * provider every template uses. Variants are layout-only; colors come
 * from theme CSS vars so each template's chrome dictates the look.
 */
export function LanguageToggle({ variant = "pill", className = "" }: LanguageToggleProps) {
  const { locale, setLocale, t } = useI18n();

  const wrap =
    variant === "pill"
      ? "inline-flex rounded-full p-1"
      : variant === "outline"
      ? "inline-flex border rounded-full overflow-hidden"
      : "inline-flex gap-3";

  const wrapStyle: React.CSSProperties =
    variant === "pill"
      ? { backgroundColor: "rgba(255,255,255,0.6)", backdropFilter: "blur(8px)" }
      : variant === "outline"
      ? { borderColor: "var(--color-accent)" }
      : {};

  const buttonClasses = (active: boolean) => {
    const base = "px-3 py-1 text-xs font-semibold uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2";
    if (variant === "underline") {
      return `${base} ${active ? "underline underline-offset-4" : "opacity-60 hover:opacity-100"}`;
    }
    return `${base} ${variant === "pill" ? "rounded-full" : ""}`;
  };

  const buttonStyle = (active: boolean): React.CSSProperties => {
    if (variant === "underline") {
      return { color: "var(--color-text)" };
    }
    return active
      ? { backgroundColor: "var(--color-primary)", color: "var(--color-surface-soft)" }
      : { color: "var(--color-text-muted)" };
  };

  return (
    <div className={`relative inline-flex items-center gap-2 ${className}`}>
      <div role="group" aria-label={t("nav_lang_select")} className={wrap} style={wrapStyle}>
        <button
          type="button"
          onClick={() => setLocale("en")}
          aria-label={t("nav_lang_en")}
          aria-pressed={locale === "en"}
          className={buttonClasses(locale === "en")}
          style={buttonStyle(locale === "en")}
        >
          EN
        </button>
        <button
          type="button"
          onClick={() => setLocale("es")}
          aria-label={t("nav_lang_es")}
          aria-pressed={locale === "es"}
          className={buttonClasses(locale === "es")}
          style={buttonStyle(locale === "es")}
        >
          ES
        </button>
      </div>
      <FeatureDot featureKey="spanish_translation" />
    </div>
  );
}

export default LanguageToggle;
