import React, { type ReactNode } from "react";
import { LanguageToggle } from "@site/components/sections";

/**
 * Constellation skin — dark-mode chrome (CSS star field · gold underline ·
 * navy hero overlay · gold CTA · text-only "Schedule" top link).
 *
 * TODO(BATCH 5): Constellation is the ULTRA-MINIMAL archetype of the
 * 7-template lineup. Only 3 page sections: Hero (dark, star-field) →
 * Bio paragraph → single inquiry footer-CTA. No Services / Reviews /
 * Fees / FAQ / Map. The "designed feel" IS the restraint — this is
 * the OPPOSITE of Sunrise's long-form arc.
 *
 * Star field is pure CSS: three layered radial-gradient backgrounds
 * with staggered @keyframes opacity twinkles. Zero JS runtime weight.
 * `prefers-reduced-motion` query freezes every layer at full opacity.
 */

/** Lightweight CSS-only star field for the page background. */
export function StarField() {
  return (
    <div aria-hidden className="cn-stars fixed inset-0 pointer-events-none z-0">
      <style>{`
        .cn-stars { background-color: var(--color-surface); }
        .cn-stars::before, .cn-stars::after, .cn-stars > .cn-l3 {
          content: ""; position: absolute; inset: 0;
        }
        .cn-stars::before {
          background-image:
            radial-gradient(1px 1px at 14% 22%, #F5F0E5 50%, transparent 100%),
            radial-gradient(1px 1px at 32% 78%, #F5F0E5 50%, transparent 100%),
            radial-gradient(1px 1px at 56% 12%, #F5F0E5 50%, transparent 100%),
            radial-gradient(1px 1px at 74% 64%, #F5F0E5 50%, transparent 100%),
            radial-gradient(1px 1px at 88% 30%, #F5F0E5 50%, transparent 100%),
            radial-gradient(1px 1px at 22% 50%, #F5F0E5 50%, transparent 100%);
          opacity: 0.35;
          animation: cn-twinkle-a 5s ease-in-out infinite alternate;
        }
        .cn-stars::after {
          background-image:
            radial-gradient(1.5px 1.5px at 10% 80%, #E5A547 50%, transparent 100%),
            radial-gradient(1.5px 1.5px at 60% 38%, #E5A547 50%, transparent 100%),
            radial-gradient(1.5px 1.5px at 84% 76%, #E5A547 50%, transparent 100%),
            radial-gradient(1.5px 1.5px at 40% 16%, #E5A547 50%, transparent 100%);
          opacity: 0.5;
          animation: cn-twinkle-b 7s ease-in-out infinite alternate;
        }
        .cn-stars > .cn-l3 {
          background-image:
            radial-gradient(0.8px 0.8px at 4% 6%, #A8B0BC 50%, transparent 100%),
            radial-gradient(0.8px 0.8px at 48% 90%, #A8B0BC 50%, transparent 100%),
            radial-gradient(0.8px 0.8px at 92% 8%, #A8B0BC 50%, transparent 100%),
            radial-gradient(0.8px 0.8px at 18% 38%, #A8B0BC 50%, transparent 100%),
            radial-gradient(0.8px 0.8px at 70% 88%, #A8B0BC 50%, transparent 100%);
          opacity: 0.55;
          animation: cn-twinkle-c 9s ease-in-out infinite alternate;
        }
        @keyframes cn-twinkle-a { 0% { opacity: 0.2; } 100% { opacity: 0.55; } }
        @keyframes cn-twinkle-b { 0% { opacity: 0.3; } 100% { opacity: 0.7; } }
        @keyframes cn-twinkle-c { 0% { opacity: 0.35; } 100% { opacity: 0.65; } }
        @media (prefers-reduced-motion: reduce) {
          .cn-stars::before, .cn-stars::after, .cn-stars > .cn-l3 {
            animation: none !important;
          }
        }
      `}</style>
      <div className="cn-l3" />
    </div>
  );
}

/** Gold-underlined accent for the headline emphasis word. */
export function GoldUnderline({ children }: { children: ReactNode }) {
  return (
    <span style={{
      textDecoration: "underline",
      textDecorationColor: "color-mix(in srgb, var(--color-accent) 60%, transparent)",
      textDecorationThickness: "3px",
      textUnderlineOffset: "8px",
      textDecorationSkipInk: "none",
    }}>
      {children}
    </span>
  );
}

/** Navy 60%-opacity overlay rendered above the hero photograph. */
export function HeroOverlay() {
  return (
    <div aria-hidden className="absolute inset-0 z-[1]"
      style={{ backgroundColor: "color-mix(in srgb, var(--color-primary) 60%, transparent)" }}
    />
  );
}

interface CtaProps { href: string; children: ReactNode; size?: "sm" | "lg" }

/** Solid gold pill with navy text. text-color set inline (gray-pill guard). */
export function Cta({ href, children, size = "sm" }: CtaProps) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 hover:opacity-90"
      style={{ height: size === "lg" ? "3rem" : "2.25rem", padding: size === "lg" ? "0 1.75rem" : "0 1.1rem", backgroundColor: "var(--color-accent)", color: "var(--color-primary)", borderRadius: "var(--radius-sm)", fontFamily: "var(--font-body)", fontWeight: 700, fontSize: size === "lg" ? "0.95rem" : "0.85rem", letterSpacing: "0.02em" }}>
      {children}
    </a>
  );
}

/** Text-only "Schedule" link for the top bar (no button styling). */
export function TopLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="text-sm uppercase tracking-[0.15em] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2"
      style={{ color: "var(--color-accent)", fontFamily: "var(--font-body)", fontWeight: 600 }}>
      {children}
    </a>
  );
}

interface TopBarProps { name: string; bookingUrl: string; bookingLabel: string }

export function TopBar({ name, bookingUrl, bookingLabel }: TopBarProps) {
  return (
    <header className="relative z-30 px-4 sm:px-6 lg:px-10 py-5 flex items-center justify-between gap-3" style={{ color: "var(--color-ink)" }}>
      <div className="flex items-center gap-3 min-w-0">
        <span aria-hidden className="inline-block" style={{ width: 24, height: 24, borderRadius: "50%", border: "1.5px solid var(--color-accent)", position: "relative" }}>
          <span style={{ position: "absolute", inset: 6, borderRadius: "50%", backgroundColor: "var(--color-accent)" }} />
        </span>
        <span className="text-sm md:text-base truncate" style={{ fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.01em" }}>
          {name}
        </span>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <LanguageToggle variant="underline" />
        <span className="hidden sm:inline-flex"><TopLink href={bookingUrl}>{bookingLabel}</TopLink></span>
      </div>
    </header>
  );
}

export function FooterSignature({ name }: { name: string }) {
  return <span style={{ fontFamily: "var(--font-display)", color: "var(--color-accent)", fontWeight: 700 }}>{name}</span>;
}
