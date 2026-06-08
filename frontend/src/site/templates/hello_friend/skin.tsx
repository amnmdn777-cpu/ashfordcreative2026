import React, { type ReactNode } from "react";
import { LanguageToggle } from "@site/components/sections";
import { PolaroidFrame } from "@site/components/photo/Polaroid";
import { ResponsivePicture } from "@site/components/photo/ResponsivePicture";

/**
 * Hello Friend skin — conversational chrome (coral-yellow gradient blob ·
 * pill-tag row · tilted hero photo with masking-tape edge via the
 * shared PolaroidFrame · Caveat script accent).
 *
 * TODO(BATCH 5): Hello Friend is the INTAKE-FORM-FIRST archetype.
 * 6 sections: Hero (chips inline) → About long → Sliding-scale Fees
 * → IntakeForm CTA box (NOT a calendar) → Reviews. No FAQ, no
 * Services grid, no Map / Office Tour. The whole page exists to
 * earn the first message, not the first booking.
 */

/** Coral-to-butter gradient blob, pinned behind the hero photo. */
export function GradientBlob({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`absolute pointer-events-none ${className}`}
      style={{
        width: 480,
        height: 480,
        borderRadius: "50%",
        background: "radial-gradient(circle at 30% 40%, var(--color-secondary) 0%, var(--color-accent) 55%, transparent 75%)",
        opacity: 0.55,
        filter: "blur(20px)",
      }}
    />
  );
}

/** Caveat script accent — same pattern as Polaroid's. */
export function ScriptAccent({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontFamily: "'Caveat', cursive", color: "var(--color-secondary)", fontSize: "0.75em", fontWeight: 400, lineHeight: 1.1 }}>
      {children}
    </span>
  );
}

/** Pill-tag row — small rounded chips listing populations / interests. */
export function PillTags({ tags, ariaLabel }: { tags: string[]; ariaLabel: string }) {
  return (
    <ul aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {tags.map((t) => (
        <li
          key={t}
          className="inline-flex items-center px-3 py-1 text-xs font-medium"
          style={{
            backgroundColor: "var(--color-surface-soft)",
            color: "var(--color-primary)",
            border: "1px solid color-mix(in srgb, var(--color-primary) 18%, transparent)",
            borderRadius: "999px",
            fontFamily: "var(--font-body)",
          }}
        >
          {t}
        </li>
      ))}
    </ul>
  );
}

/** Tilted hero photo with a single masking-tape edge — wraps the
 *  shared PolaroidFrame to keep this template free of polaroid card
 *  internals. The `src` is passed WITHOUT extension; ResponsivePicture
 *  expands it into the WebP@1x/2x + JPG variant set produced by
 *  scripts/optimize-hero-photos.ts. */
export function TiltedPhoto({ src, alt }: { src: string; alt: string }) {
  return (
    <PolaroidFrame
      rotate={-3}
      width={360}
      photoHeight={420}
      tape={[{ position: "top-center", rotate: 4 }]}
    >
      <ResponsivePicture
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        eager
      />
    </PolaroidFrame>
  );
}

interface CtaProps { href: string; children: ReactNode; size?: "sm" | "lg" }

/** Coral pill, white text. text-white + inline color for gray-pill guard. */
export function Cta({ href, children, size = "sm" }: CtaProps) {
  // Intake form lives at a same-origin route, not an external calendar;
  // skip `target="_blank"` so the form opens in the same tab.
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center gap-2 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 hover:opacity-90"
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

interface TopBarProps { name: string; bookingUrl: string; bookingLabel: string; avatarSrc: string }

/** Top bar: small avatar + nameplate · EN/ES · coral CTA. */
export function TopBar({ name, bookingUrl, bookingLabel, avatarSrc }: TopBarProps) {
  return (
    <header className="relative z-30 px-4 sm:px-6 lg:px-10 py-5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="inline-block overflow-hidden shrink-0"
          style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid var(--color-accent)" }}
        >
          <img src={avatarSrc} alt="" className="w-full h-full object-cover" aria-hidden />
        </span>
        <span className="text-base md:text-lg truncate" style={{ fontFamily: "var(--font-display)", color: "var(--color-text)", fontWeight: 700, letterSpacing: "-0.015em" }}>
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
  return <span style={{ fontFamily: "'Caveat', cursive", color: "var(--color-secondary)", fontSize: "1.2em" }}>{name}</span>;
}
