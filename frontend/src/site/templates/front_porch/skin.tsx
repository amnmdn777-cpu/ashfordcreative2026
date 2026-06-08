import React, { type ReactNode } from "react";
import { LanguageToggle } from "@site/components/sections";

/**
 * Front Porch skin — Texas-rooted chrome (wood-grain hero edges ·
 * Texas silhouette mark · sepia photo treatment hooks · terracotta
 * pill CTA · Fraunces nameplate). All chrome consumes theme tokens.
 *
 * TODO(BATCH 5): Front Porch is the PLAIN-SPOKEN middle-weight
 * archetype of the 7-template lineup. Sequence: Hero porch photo →
 * Specialties chips (couples/family) → AboutTexasBio → Services →
 * Insurance/Fees → CommonExtras → BookingCta. The chips strip after
 * the hero signals who Marcus sees before the prose deepens.
 */

/** Subtle wood-grain edge texture pinned at the hero's left/right
 *  for image-right layouts. CSS-only repeating linear gradient — no
 *  raster overhead, no JS. */
export function WoodGrainEdge() {
  return (
    <div
      aria-hidden
      className="absolute inset-y-0 left-0 w-3 pointer-events-none z-10"
      style={{
        backgroundImage:
          "repeating-linear-gradient(to bottom, color-mix(in srgb, var(--color-primary) 18%, transparent) 0 2px, transparent 2px 6px)",
        opacity: 0.6,
      }}
    />
  );
}

/** Sepia-tone wrapper — lifts saturation off photography so a real
 *  prospect headshot reads as part of the warm porch palette. */
export function SepiaPhoto({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <img
      src={src}
      alt={alt}
      loading="eager"
      className={`w-full h-full object-cover ${className}`}
      style={{ filter: "sepia(0.18) saturate(1.05) contrast(1.02)" }}
    />
  );
}

/** Small Texas-silhouette mark for the footer signature. */
export function TexasMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden style={{ color: "var(--color-secondary)" }}>
      {/* Stylised Texas outline — simplified for visual readability at small sizes. */}
      <path
        d="M10 10 L 30 10 L 30 6 L 36 6 L 36 12 L 54 12 L 56 18 L 56 32 L 50 36 L 50 44 L 44 50 L 38 54 L 32 54 L 28 50 L 24 50 L 20 56 L 12 50 L 10 40 Z"
        fill="currentColor"
        opacity="0.85"
      />
    </svg>
  );
}

interface CtaProps { href: string; children: ReactNode; size?: "sm" | "lg" }

/** Solid terracotta pill, white text. text-white + inline color for
 *  the gray-pill regression guard. */
export function Cta({ href, children, size = "sm" }: CtaProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 hover:opacity-90"
      style={{
        height: size === "lg" ? "3rem" : "2.25rem",
        padding: size === "lg" ? "0 1.75rem" : "0 1.1rem",
        backgroundColor: "var(--color-secondary)",
        color: "#ffffff",
        borderRadius: "999px",
        fontFamily: "var(--font-body)",
        fontWeight: 600,
        fontSize: size === "lg" ? "0.95rem" : "0.85rem",
      }}
    >
      {children}
    </a>
  );
}

interface TopBarProps { name: string; bookingUrl: string; bookingLabel: string }

export function TopBar({ name, bookingUrl, bookingLabel }: TopBarProps) {
  return (
    <header className="relative z-30 px-4 sm:px-6 lg:px-10 py-5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <TexasMark size={22} />
        <span className="text-base md:text-lg truncate" style={{ fontFamily: "var(--font-display)", color: "var(--color-text)", fontWeight: 500 }}>
          {name}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <LanguageToggle variant="underline" />
        <span className="hidden sm:inline-flex"><Cta href={bookingUrl}>{bookingLabel}</Cta></span>
      </div>
    </header>
  );
}

export function FooterSignature({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-2" style={{ fontFamily: "var(--font-display)", color: "var(--color-secondary)", fontStyle: "italic" }}>
      <TexasMark size={18} />
      {name}
    </span>
  );
}
