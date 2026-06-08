import React, { type ReactNode } from "react";
import { LanguageToggle } from "@site/components/sections";

/**
 * Sunrise skin — peach-coral chrome (gradient overlay · glass card ·
 * sun-rays motif · top bar).
 *
 * TODO(BATCH 5): Sunrise is the LONG-FORM healing-arc archetype of
 * the 7-template lineup. The page deliberately rises through 8
 * sections: Hero (pain-point eyebrow) → Services accordion →
 * About long → Reviews → Fees + Insurance → FAQ → CommonExtras →
 * BookingCta. Sun-rays + glass card carry the "first warm light"
 * mood throughout the whole arc.
 */
export function SunriseGradientOverlay() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--color-secondary) 50%, transparent) 0%, color-mix(in srgb, var(--color-accent) 30%, transparent) 40%, transparent 100%)",
      }}
    />
  );
}

/** Sun-rays motif pinned to the upper-right corner of the hero. */
export function SunRays() {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6;
    return [90 + Math.cos(a) * 30, 90 + Math.sin(a) * 30, 90 + Math.cos(a) * 64, 90 + Math.sin(a) * 64];
  });
  return (
    <svg aria-hidden className="absolute top-6 right-6 pointer-events-none" width="180" height="180" viewBox="0 0 180 180" style={{ color: "var(--color-surface-soft)", opacity: 0.6 }}>
      <circle cx="90" cy="90" r="22" fill="currentColor" opacity="0.35" />
      <circle cx="90" cy="90" r="14" fill="currentColor" />
      {rays.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      ))}
    </svg>
  );
}

interface GlassBioCardProps {
  photo: string;
  name: string;
  oneLiner: ReactNode;
}

/** Lower-right hero glass card. Hidden on mobile; backdrop-blur so it
 *  reads against any part of the gradient. */
export function GlassBioCard({ photo, name, oneLiner }: GlassBioCardProps) {
  return (
    <aside
      // bottom-32 to clear the bottom-4 Crisis banner; z-20 to paint
      // above the hero's full-bleed media (which Hero.tsx renders at
      // z-0 — without an explicit z-index here the card was hidden
      // behind the hero illustration).
      className="absolute bottom-32 right-6 z-20 hidden md:flex max-w-sm items-center gap-4 px-5 py-4"
      style={{
        backgroundColor: "rgba(255, 255, 255, 0.55)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-md)",
        border: "1px solid rgba(255, 255, 255, 0.6)",
      }}
    >
      <div
        className="w-14 h-14 rounded-full overflow-hidden shrink-0"
        style={{ border: "2px solid var(--color-surface-soft)" }}
      >
        <img src={photo} alt={name} className="w-full h-full object-cover" />
      </div>
      <div className="leading-tight">
        <div
          className="text-sm font-semibold"
          style={{ color: "var(--color-text)", fontFamily: "var(--font-display)" }}
        >
          {name}
        </div>
        <div
          className="text-xs mt-1"
          style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-body)" }}
        >
          {oneLiner}
        </div>
      </div>
    </aside>
  );
}

interface CtaProps {
  href: string;
  children: ReactNode;
  size?: "sm" | "lg";
}

/** Soft-coral filled, white text, pill-rounded — Sunrise's button. */
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
        backgroundColor: "var(--color-accent)",
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

/** Top bar: nameplate · language toggle · soft-coral CTA. */
export function TopBar({ name, bookingUrl, bookingLabel }: TopBarProps) {
  return (
    <header className="relative z-30 px-6 md:px-10 py-5 flex items-center justify-between gap-4">
      <span
        className="text-base md:text-lg"
        style={{ fontFamily: "var(--font-display)", color: "var(--color-text)", fontWeight: 600 }}
      >
        {name}
      </span>
      <div className="flex items-center gap-3">
        <LanguageToggle variant="underline" />
        {/* Top-bar CTA hidden < sm — convention per CLAUDE.md skin rules. */}
        <span className="hidden sm:inline-flex">
          <Cta href={bookingUrl}>{bookingLabel}</Cta>
        </span>
      </div>
    </header>
  );
}

/** Italic-display footer signature. */
export function FooterSignature({ name }: { name: string }) {
  return <span className="italic" style={{ fontFamily: "var(--font-display)", color: "var(--color-accent)" }}>{name}</span>;
}
