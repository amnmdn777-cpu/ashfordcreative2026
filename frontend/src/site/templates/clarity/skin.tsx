import React, { type ReactNode } from "react";
import { LanguageToggle } from "@site/components/sections";

/**
 * Clarity skin — clean / modern / premium chrome.
 *
 * The "feel" (warm, editorial, high-end — think a premium wellness
 * brand landing page): oversized Space Grotesk display type, generous
 * whitespace, a soft warmly-lit backdrop, and rounded image cards.
 *
 * Design principle for sparse leads: the premium feel comes from
 * TYPE + SPACING + the template-owned WarmBackdrop — NOT from the
 * prospect's photos. So a lead with weak or missing imagery still
 * reads as high-end, because the warm backdrop and type scale carry
 * the page on their own. Chrome only; composition lives in Clarity.tsx.
 */

/** Soft, warmly-lit backdrop — large blurred radial blooms in the
 *  palette's accent + secondary. Pure CSS so every prospect gets the
 *  same premium atmosphere regardless of their own image quality. */
export function WarmBackdrop({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
    >
      <div
        className="absolute -top-24 -right-16 w-[42rem] h-[42rem] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--color-accent) 38%, transparent), transparent 62%)",
          filter: "blur(60px)",
        }}
      />
      <div
        className="absolute top-1/3 -left-24 w-[34rem] h-[34rem] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--color-secondary) 55%, transparent), transparent 60%)",
          filter: "blur(70px)",
        }}
      />
    </div>
  );
}

interface NavItem {
  label: string;
  href: string;
}

interface TopBarProps {
  name: string;
  logoUrl?: string | null;
  navItems: NavItem[];
  contactHref: string;
  contactLabel: string;
  /** When set, nav items whose href starts with "/" switch pages via this
   *  callback (multi-page mode) instead of jumping to an anchor. */
  onNavigate?: (path: string) => void;
  /** Current page path — used to highlight the active page link. */
  activePath?: string;
}

/** Clean sticky header: mark/name · nav · solid pill CTA. In single-page
 *  mode the links smooth-scroll to sections (`#services`); in multi-page
 *  mode (when `onNavigate` is set) "/page" links switch pages instead, so
 *  this one header is the site's only nav. */
export function TopBar({
  name,
  logoUrl,
  navItems,
  contactHref,
  contactLabel,
  onNavigate,
  activePath,
}: TopBarProps) {
  const goHome = onNavigate ? () => onNavigate("/") : undefined;
  return (
    <header
      className="sticky top-0 z-40 w-full backdrop-blur-md"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--color-surface) 78%, transparent)",
        borderBottom:
          "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)",
      }}
    >
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between gap-6">
        <button
          type="button"
          onClick={goHome}
          className={`flex items-center gap-2.5 min-w-0 ${goHome ? "cursor-pointer" : "cursor-default"}`}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={name}
              className="h-7 w-auto object-contain"
            />
          ) : (
            <ClarityMark />
          )}
          <span
            className="truncate text-[15px] font-semibold tracking-tight"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--color-text)",
            }}
          >
            {name}
          </span>
        </button>
        <nav className="hidden md:flex items-center gap-7">
          {navItems.map((item) => {
            const isPage = item.href.startsWith("/");
            const isActive = isPage && activePath === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={
                  isPage && onNavigate
                    ? (e) => {
                        e.preventDefault();
                        onNavigate(item.href);
                      }
                    : undefined
                }
                className="text-[13px] tracking-tight transition-colors duration-200"
                style={{
                  color: isActive
                    ? "var(--color-text)"
                    : "var(--color-text-muted)",
                  fontWeight: isActive ? 600 : 400,
                  fontFamily: "var(--font-body)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--color-text)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = isActive
                    ? "var(--color-text)"
                    : "var(--color-text-muted)")
                }
              >
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 shrink-0">
          <LanguageToggle />
          <Cta href={contactHref} size="sm">
            {contactLabel}
          </Cta>
        </div>
      </div>
    </header>
  );
}

/** Two-square geometric mark used when the prospect has no logo. */
export function ClarityMark() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 26 26"
      aria-hidden
      style={{ color: "var(--color-text)" }}
    >
      <rect x="2" y="2" width="9.5" height="9.5" rx="2.5" fill="currentColor" />
      <rect
        x="14.5"
        y="2"
        width="9.5"
        height="9.5"
        rx="4.75"
        fill="currentColor"
        opacity="0.55"
      />
      <rect
        x="2"
        y="14.5"
        width="9.5"
        height="9.5"
        rx="4.75"
        fill="currentColor"
        opacity="0.55"
      />
      <rect
        x="14.5"
        y="14.5"
        width="9.5"
        height="9.5"
        rx="2.5"
        fill="currentColor"
      />
    </svg>
  );
}

interface CtaProps {
  href: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  variant?: "solid" | "light";
}

/** Pill CTA. `solid` = ink-filled (primary action); `light` = white pill
 *  for use over photography (the hero image card). */
export function Cta({
  href,
  children,
  size = "md",
  variant = "solid",
}: CtaProps) {
  const pad =
    size === "sm"
      ? "px-4 py-2 text-[13px]"
      : size === "lg"
        ? "px-8 py-4 text-base"
        : "px-6 py-3 text-sm";
  const solid = variant === "solid";
  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center rounded-full font-medium tracking-tight transition-transform duration-200 hover:-translate-y-0.5 ${pad}`}
      style={{
        fontFamily: "var(--font-body)",
        backgroundColor: solid ? "var(--color-text)" : "#ffffff",
        color: solid ? "var(--color-surface)" : "var(--color-text)",
        boxShadow:
          "0 6px 20px -8px color-mix(in srgb, var(--color-text) 45%, transparent)",
      }}
    >
      {children}
    </a>
  );
}

interface ImageCardProps {
  src: string;
  alt: string;
  caption?: ReactNode;
  className?: string;
}

/** Rounded image card with an optional bottom caption overlay — the
 *  Wellmetrix-style "Try … free" tile. Falls back to a warm gradient
 *  block when `src` is empty so a missing portrait never breaks the grid. */
export function ImageCard({
  src,
  alt,
  caption,
  className = "",
}: ImageCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl ${className}`}
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--color-secondary) 60%, var(--color-surface-soft))",
      }}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div
          aria-hidden
          className="h-full w-full"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 30%, transparent), color-mix(in srgb, var(--color-secondary) 55%, transparent))",
          }}
        />
      )}
      {caption ? (
        <div
          className="absolute inset-x-0 bottom-0 p-5 md:p-6"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.45), transparent)",
          }}
        >
          <span
            className="block text-white text-lg md:text-xl font-semibold leading-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {caption}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** "Design by Ashford Creative" footer signature. */
export function FooterSignature({ name }: { name: string }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-display)",
        fontWeight: 600,
        color: "var(--color-text)",
      }}
    >
      {name}
    </span>
  );
}
