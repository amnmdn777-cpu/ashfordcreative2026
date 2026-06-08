import React, { type ReactNode } from "react";
import { LanguageToggle } from "@site/components/sections";
import { PolaroidFrame, type TapeMark } from "@site/components/photo/Polaroid";
import { ResponsivePicture } from "@site/components/photo/ResponsivePicture";

/**
 * Polaroid skin — paper texture · tilted polaroid stack · Caveat accent.
 * Photos render through ResponsivePicture (WebP@1x/2x + JPG fallback)
 * — `src` is a path WITHOUT extension that the optimize pipeline
 * expands into the three variants per polaroid still-life.
 *
 * TODO(BATCH 5): Polaroid is the PERSONAL "Sunday note" archetype of
 * the 7-template lineup. Sequence: Hero (tilted polaroid stack) →
 * Bio first-person → Services prose → Polaroid-grid testimonials →
 * Logistics (days / in-person) → BookingCta. The order reads as
 * "meet me / what I do / who I see / how to start".
 *
 * The masking-tape + polaroid-card primitive lives in
 * `src/components/photo/Polaroid.tsx` (shared with Hello Friend); this
 * file composes it into a loose tilted stack.
 */
export function LinenBackground() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none z-0"
      style={{
        backgroundImage:
          "radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--color-ink) 35%, transparent) 1px, transparent 0)",
        backgroundSize: "3px 3px",
        opacity: 0.05,
        mixBlendMode: "multiply",
      }}
    />
  );
}

export interface PolaroidPhoto {
  src: string;
  alt: string;
  caption?: string;
  rotate: number;
  /** Offset within the loose stack — overrides default arrangement. */
  offset?: { top: number; left: number };
  tape: TapeMark[];
}

interface PolaroidStackProps {
  photos: PolaroidPhoto[];
}

/** Loose tilted stack of polaroid photos with masking-tape corners.
 *  Layout-only; the individual card frame lives in components/photo/Polaroid. */
export function PolaroidStack({ photos }: PolaroidStackProps) {
  return (
    <div className="relative w-full max-w-md mx-auto" style={{ minHeight: 420 }}>
      {photos.map((p, i) => (
        <div
          key={i}
          className="absolute"
          style={{ top: p.offset?.top ?? i * 26, left: p.offset?.left ?? i * 30, zIndex: i + 1 }}
        >
          <PolaroidFrame rotate={p.rotate} tape={p.tape} caption={p.caption}>
            <ResponsivePicture src={p.src} alt={p.alt} className="w-full h-full object-cover" />
          </PolaroidFrame>
        </div>
      ))}
    </div>
  );
}

/** Caveat script utility — used for the headline signature accent. */
export function ScriptAccent({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontFamily: "'Caveat', cursive", color: "var(--color-accent)", fontSize: "1.6em", lineHeight: 1 }}>
      {children}
    </span>
  );
}

interface CtaProps {
  href: string;
  children: ReactNode;
  size?: "sm" | "lg";
}

/** Solid teal pill, white text. Belt-and-suspenders against the
 *  gray-pill regression: Tailwind `text-white` + inline `color: #fff`. */
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
        backgroundColor: "var(--color-primary)",
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

interface TopBarProps {
  name: string;
  bookingUrl: string;
  bookingLabel: string;
}

export function TopBar({ name, bookingUrl, bookingLabel }: TopBarProps) {
  return (
    <header className="relative z-30 px-6 md:px-10 py-5 flex items-center justify-between gap-4">
      <span className="text-base md:text-lg" style={{ fontFamily: "var(--font-display)", color: "var(--color-text)" }}>
        {name}
      </span>
      <div className="flex items-center gap-3">
        <LanguageToggle variant="underline" />
        <span className="hidden sm:inline-flex">
          <Cta href={bookingUrl}>{bookingLabel}</Cta>
        </span>
      </div>
    </header>
  );
}

/** Caveat-script footer signature. */
export function FooterSignature({ name }: { name: string }) {
  return <span style={{ fontFamily: "'Caveat', cursive", color: "var(--color-accent)", fontSize: "1.2em" }}>{name}</span>;
}
