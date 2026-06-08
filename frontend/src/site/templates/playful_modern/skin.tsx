import React, { type ReactNode } from "react";
import { LanguageToggle } from "@site/components/sections";

/**
 * PlayfulModern skin — D2C-brand chrome (decorative SVG overlays ·
 * scrolling condition carousel · bouncy header mark · coral pill CTA).
 *
 * TODO(BATCH 5): Playful Modern is the HIGHEST-DENSITY archetype in
 * the 7-template lineup — 9 sections from Hero through stats strip,
 * services, reviews, about, fees, FAQ, and BookingCta. The energy is
 * meant to be sustained top-to-bottom.
 *
 * Decorative overlays consume `var(--color-secondary)` / `accent` so
 * a future palette swap re-tints them automatically. The carousel is
 * CSS-only (no IntersectionObserver) and respects prefers-reduced-motion.
 */

/** Bouncy "B." monogram mark — animates a tiny up-down bounce. */
export function BouncyMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden style={{ animation: "pm-bounce 2.4s ease-in-out infinite" }}>
      <circle cx="16" cy="16" r="14" fill="var(--color-secondary)" />
      <text x="16" y="22" textAnchor="middle" fontSize="16" fontWeight="800" fill="#fff" style={{ fontFamily: "var(--font-display)" }}>B</text>
      <style>{`@keyframes pm-bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } } @media (prefers-reduced-motion: reduce) { svg { animation: none !important; } }`}</style>
    </svg>
  );
}

// ── Decorative overlays — 6 small SVGs, no layout, just absolute positioning ──
type DecoProps = { className?: string; style?: React.CSSProperties };

export function DecoHeart({ className, style }: DecoProps) {
  return <svg className={className} style={style} width="36" height="36" viewBox="0 0 32 32" aria-hidden>
    <path d="M16 28 C 8 22 2 16 2 10 Q 2 4 8 4 Q 12 4 16 9 Q 20 4 24 4 Q 30 4 30 10 C 30 16 24 22 16 28 Z" fill="var(--color-secondary)" />
  </svg>;
}
export function DecoBolt({ className, style }: DecoProps) {
  return <svg className={className} style={style} width="32" height="40" viewBox="0 0 24 32" aria-hidden>
    <path d="M14 0 L 2 18 L 10 18 L 8 32 L 22 12 L 14 12 Z" fill="var(--color-accent)" />
  </svg>;
}
export function DecoSmiley({ className, style }: DecoProps) {
  return <svg className={className} style={style} width="40" height="40" viewBox="0 0 32 32" aria-hidden>
    <circle cx="16" cy="16" r="14" fill="var(--color-accent)" />
    <circle cx="11" cy="13" r="1.6" fill="#1A1647" /><circle cx="21" cy="13" r="1.6" fill="#1A1647" />
    <path d="M10 19 Q 16 24 22 19" stroke="#1A1647" strokeWidth="1.8" fill="none" strokeLinecap="round" />
  </svg>;
}
export function DecoAsterisk({ className, style }: DecoProps) {
  return <svg className={className} style={style} width="28" height="28" viewBox="0 0 24 24" aria-hidden>
    <g stroke="var(--color-secondary)" strokeWidth="2.4" strokeLinecap="round">
      <line x1="12" y1="2" x2="12" y2="22" /><line x1="2" y1="12" x2="22" y2="12" />
      <line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" />
    </g>
  </svg>;
}
export function DecoSquiggle({ className, style }: DecoProps) {
  return <svg className={className} style={style} width="60" height="22" viewBox="0 0 60 22" aria-hidden>
    <path d="M2 11 Q 10 2 18 11 T 34 11 T 50 11 T 60 11" stroke="var(--color-accent)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
  </svg>;
}
export function DecoDots({ className, style }: DecoProps) {
  return <svg className={className} style={style} width="36" height="36" viewBox="0 0 36 36" aria-hidden>
    {[6, 18, 30].flatMap((y) => [6, 18, 30].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.4" fill="var(--color-secondary)" />))}
  </svg>;
}

// ── Scrolling condition carousel ─────────────────────────────────────
interface CarouselProps {
  chips: string[];
  ariaLabel: string;
}

/**
 * CSS-only marquee. Renders the chip list twice in a flex row and
 * translates the row by -50% over 40s. `:hover` pauses; the
 * `prefers-reduced-motion` query removes the animation entirely
 * (chips become a static, scrollable list).
 */
export function ConditionCarousel({ chips, ariaLabel }: CarouselProps) {
  return (
    <section aria-label={ariaLabel} className="relative w-full overflow-hidden py-6" style={{ backgroundColor: "var(--color-surface-soft)" }}>
      <style>{`
        @keyframes pm-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .pm-track { animation: pm-marquee 40s linear infinite; }
        .pm-track:hover { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .pm-track { animation: none; } }
      `}</style>
      <div className="pm-track flex gap-3 w-max" style={{ paddingLeft: "1rem" }}>
        {[...chips, ...chips].map((c, i) => (
          <span key={i} className="inline-flex items-center px-4 py-2 text-sm font-medium whitespace-nowrap"
            style={{ backgroundColor: "var(--color-accent)", color: "var(--color-primary)", borderRadius: "999px", fontFamily: "var(--font-body)" }}>
            {c}
          </span>
        ))}
      </div>
    </section>
  );
}

interface CtaProps { href: string; children: ReactNode; size?: "sm" | "lg" }

/** Coral pill, white text. text-white + inline color (gray-pill guard). */
export function Cta({ href, children, size = "sm" }: CtaProps) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center justify-center text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 hover:opacity-90"
      style={{ height: size === "lg" ? "3rem" : "2.25rem", padding: size === "lg" ? "0 1.75rem" : "0 1.1rem", backgroundColor: "var(--color-secondary)", color: "#ffffff", borderRadius: "999px", fontFamily: "var(--font-body)", fontWeight: 700, fontSize: size === "lg" ? "0.95rem" : "0.85rem", letterSpacing: "-0.005em" }}>
      {children}
    </a>
  );
}

interface TopBarProps { name: string; bookingUrl: string; bookingLabel: string }

export function TopBar({ name, bookingUrl, bookingLabel }: TopBarProps) {
  return (
    <header className="relative z-30 px-4 sm:px-6 lg:px-10 py-5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <BouncyMark />
        <span className="text-base md:text-lg truncate" style={{ fontFamily: "var(--font-display)", color: "var(--color-text)", fontWeight: 700, letterSpacing: "-0.015em" }}>{name}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <LanguageToggle variant="underline" />
        <span className="hidden sm:inline-flex"><Cta href={bookingUrl}>{bookingLabel}</Cta></span>
      </div>
    </header>
  );
}

export function FooterSignature({ name }: { name: string }) {
  return <span style={{ fontFamily: "var(--font-display)", color: "var(--color-secondary)", fontWeight: 700 }}>{name}</span>;
}
