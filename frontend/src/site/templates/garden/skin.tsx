import React, { type ReactNode } from "react";
import { LanguageToggle } from "@site/components/sections";

/**
 * Garden skin — botanical chrome (gradient bg · 4 corner motifs · leaf
 * monogram · top-bar). No layout logic — primitives drive structure.
 *
 * TODO(BATCH 5): Garden is now the SHORT-form archetype of the 7-template
 * lineup. Page sequence: Hero → Reviews → Services-as-cards → Bio short
 * → BookingCta. No Fees / FAQ / Insurance block on the homepage — those
 * questions are answered in the rep conversation. Botanical SVGs do the
 * heavy lifting between sections.
 */

/** Soft cream-to-surface gradient pinned behind every section. */
export function PageBackground() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none z-0"
      style={{
        background:
          "linear-gradient(180deg, var(--color-secondary) 0%, var(--color-surface) 60%)",
      }}
    />
  );
}

/** Tiny botanical leaf monogram for the header. */
export function LeafMonogram({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden
      style={{ color: "var(--color-primary)" }}
    >
      <path
        d="M16 28 C 8 24, 4 16, 6 6 C 16 6, 24 12, 26 22 C 24 24, 20 26, 16 28 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M6 6 L 26 22"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Four corner botanical line drawings. Subtle sage strokes pinned to
 *  the viewport corners; pointer-events:none so they never block clicks. */
export function BotanicalCorners() {
  const stroke = { stroke: "var(--color-primary)", strokeWidth: 1, fill: "none" } as const;
  return (
    <div aria-hidden className="fixed inset-0 pointer-events-none z-0" style={{ opacity: 0.18 }}>
      {/* Top-left peace-lily · top-right monstera · bottom-left fern · bottom-right ivy. */}
      <svg className="absolute top-4 left-4" width="120" height="120" viewBox="0 0 120 120">
        <path d="M20 100 Q 24 40 60 20 M28 90 Q 12 60 24 30 M40 70 Q 50 40 80 30 M52 60 Q 70 28 100 20" {...stroke} />
        <circle cx="60" cy="20" r="3" {...stroke} /><circle cx="100" cy="20" r="2.5" {...stroke} />
      </svg>
      <svg className="absolute top-4 right-4" width="120" height="120" viewBox="0 0 120 120">
        <path d="M100 100 Q 110 40 60 20 M100 100 Q 60 80 30 30 M86 70 L 70 80 M70 50 L 56 58 M52 32 L 40 38" {...stroke} />
      </svg>
      <svg className="absolute bottom-4 left-4" width="120" height="120" viewBox="0 0 120 120">
        <path d="M20 20 Q 30 70 100 100" {...stroke} />
        {[30, 45, 60, 75, 90].map((x, i) => (
          <path key={i} d={`M${x} ${30 + i * 12} Q ${x + 8} ${20 + i * 12} ${x + 18} ${28 + i * 12}`} {...stroke} />
        ))}
      </svg>
      <svg className="absolute bottom-4 right-4" width="120" height="120" viewBox="0 0 120 120">
        <path d="M100 20 Q 70 30 60 60 Q 50 90 100 100 M70 36 Q 64 30 60 36 Q 64 44 72 42 Z M52 64 Q 46 58 40 64 Q 46 72 56 70 Z M62 88 Q 56 84 50 90 Q 56 96 64 94 Z" {...stroke} />
      </svg>
    </div>
  );
}

interface TopBarProps {
  name: string;
  bookingUrl: string;
  bookingLabel: string;
}

/** Top bar: leaf monogram + nameplate · language toggle · filled sage CTA. */
export function TopBar({ name, bookingUrl, bookingLabel }: TopBarProps) {
  return (
    <header className="relative z-30 px-6 md:px-10 py-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <LeafMonogram />
        <span
          className="text-base md:text-lg"
          style={{ fontFamily: "var(--font-display)", color: "var(--color-text)" }}
        >
          {name}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <LanguageToggle variant="underline" />
        {/* CTA hidden below sm to keep the bar from clipping on mobile;
         *  the hero CTA below is the primary action on small viewports. */}
        <span className="hidden sm:inline-flex">
          <Cta href={bookingUrl}>{bookingLabel}</Cta>
        </span>
      </div>
    </header>
  );
}

interface CtaProps {
  href: string;
  children: ReactNode;
  /** Larger hero CTA vs the compact top-bar CTA. */
  size?: "sm" | "lg";
}

/** Sage filled, white text, pill-rounded CTA — Garden's only button style. */
export function Cta({ href, children, size = "sm" }: CtaProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 hover:opacity-90"
      style={{
        height: size === "lg" ? "3rem" : "2.25rem",
        padding: size === "lg" ? "0 1.75rem" : "0 1.1rem",
        backgroundColor: "var(--color-primary)",
        color: "#ffffff",
        borderRadius: "999px",
        fontFamily: "var(--font-body)",
        fontSize: size === "lg" ? "0.95rem" : "0.85rem",
      }}
    >
      {children}
    </a>
  );
}

/** Italic-display signature line for the footer. */
export function FooterSignature({ name }: { name: string }) {
  return (
    <span
      className="italic"
      style={{ fontFamily: "var(--font-display)", color: "var(--color-secondary)" }}
    >
      {name}
    </span>
  );
}
