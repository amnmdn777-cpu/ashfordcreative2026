import React, { type ReactNode } from "react";
import { motion } from "framer-motion";
import { useHeroParallax, useScrollReveal } from "@site/hooks/motion";

export type HeroLayout = "image-right" | "image-left" | "image-bg" | "no-image";

interface HeroProps {
  eyebrow?: ReactNode;
  headline: ReactNode;
  subhead?: ReactNode;
  primaryCta?: ReactNode;
  secondaryCta?: ReactNode;
  /** Hero artwork. For `image-bg`, this is rendered as a full-bleed
   *  background; for `image-left`/`image-right` it sits in the
   *  opposite column. Ignored when layout is `no-image`. */
  media?: ReactNode;
  layout?: HeroLayout;
  /** Optional decorative slot (skin chrome — corner brackets, motifs).
   *  Renders inside the hero <section> but behind content. */
  decoration?: ReactNode;
  /** Optional class merged onto the root <section>. */
  className?: string;
  /** Skip the parallax MotionValue on the media element. */
  disableParallax?: boolean;
}

export function Hero({
  eyebrow,
  headline,
  subhead,
  primaryCta,
  secondaryCta,
  media,
  layout = "image-right",
  decoration,
  className = "",
  disableParallax = false,
}: HeroProps) {
  const reveal = useScrollReveal<HTMLDivElement>({ delay: 0 });
  const parallaxY = useHeroParallax(60);

  const isSplit = layout === "image-left" || layout === "image-right";
  const isBg = layout === "image-bg";
  const isNoImage = layout === "no-image";

  // image-bg variant caps the section at the viewport so a glass-card /
  // chip / decoration anchored to `bottom-8 right-6` always lands above
  // the fold. The previous `py-32 md:py-48` made the section ~880px
  // intrinsic on desktop — taller than common 720/800/900 viewports —
  // and absolutely-positioned skin chrome scrolled off-screen at
  // landing. Now: section is a flex container at min-h-[600px]
  // md:min-h-[680px] capped at 100vh, content vertically centered.
  // Atrium + Sunrise both use this variant — visually verified on
  // both at 1440×900 and 1280×720 after the change.
  const sectionLayout = isBg
    ? "relative w-full overflow-hidden flex items-center min-h-[600px] md:min-h-[680px] md:max-h-screen"
    : "relative w-full overflow-hidden";

  // image-bg layouts overlay text on top of a photo. The template's
  // `--color-text` is tuned for plain backgrounds (dark ink on
  // cream/paper) and disappears on a dark hero photo. Force light text
  // + a soft drop-shadow + a gradient scrim under the copy so contrast
  // holds regardless of what photo the template ships. Templates that
  // need a different overlay tone can wrap the Hero in their skin and
  // pass `className` / `decoration`. Mirrors the bulletproof-image
  // pattern used in checkoutEmailHtml.
  const overlayHeadlineColor = isBg ? "#FFFFFF" : "var(--color-text)";
  const overlaySubheadColor = isBg
    ? "rgba(255,255,255,0.88)"
    : "var(--color-text-muted)";
  const overlayEyebrowColor = isBg
    ? "rgba(255,255,255,0.78)"
    : "var(--color-text-muted)";
  const overlayTextShadow = isBg ? "0 2px 14px rgba(0,0,0,0.45)" : undefined;

  return (
    <section
      className={`${sectionLayout} ${className}`}
      style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)" }}
    >
      {decoration}

      {isBg && media && (
        <motion.div
          className="absolute inset-0 z-0"
          style={disableParallax ? undefined : { y: parallaxY }}
        >
          {/* Below-the-fold parallax wrapper — actual <img>/<svg> media
           *  is rendered by the caller. Templates should pass
           *  fetchPriority="high" + loading="eager" on the inner <img>
           *  so Chrome treats it as the LCP image. */}
          {media}
          {/* Scrim: bottom-to-top dark gradient so the headline + CTA
           *  (anchored to the lower portion of the hero) always get
           *  ~AA contrast against whatever photo the template ships.
           *  Pointer-events:none so map clicks and CTA hits still
           *  land on the content layer. */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.45) 70%, rgba(0,0,0,0.62) 100%)",
            }}
          />
        </motion.div>
      )}

      <div
        className={`relative z-10 mx-auto max-w-6xl px-6 md:px-12 w-full ${
          isBg ? "py-12 md:py-16" : "py-20 md:py-28"
        }`}
      >
        <div
          className={
            isSplit
              ? "grid md:grid-cols-2 gap-12 items-center"
              : isBg
              ? "max-w-3xl"
              : isNoImage
              ? "max-w-3xl mx-auto text-center"
              : ""
          }
        >
          <motion.div
            ref={reveal.ref}
            {...reveal.motionProps}
            className={`${layout === "image-left" ? "md:order-2" : ""} flex flex-col gap-6`}
          >
            {eyebrow && (
              <div
                className="text-xs uppercase tracking-[0.3em]"
                style={{
                  color: overlayEyebrowColor,
                  textShadow: overlayTextShadow,
                }}
              >
                {eyebrow}
              </div>
            )}
            <h1
              className="text-4xl md:text-6xl leading-[1.05] tracking-tight"
              style={{
                fontFamily: "var(--font-display)",
                color: overlayHeadlineColor,
                textShadow: overlayTextShadow,
              }}
            >
              {headline}
            </h1>
            {subhead && (
              <p
                className="text-base md:text-lg max-w-xl leading-relaxed"
                style={{
                  color: overlaySubheadColor,
                  fontFamily: "var(--font-body)",
                  textShadow: overlayTextShadow,
                }}
              >
                {subhead}
              </p>
            )}
            {(primaryCta || secondaryCta) && (
              <div className="flex flex-wrap items-center gap-4 pt-2">
                {primaryCta}
                {secondaryCta}
              </div>
            )}
          </motion.div>

          {isSplit && media && (
            <motion.div
              className={`${layout === "image-left" ? "md:order-1" : ""} relative`}
              style={disableParallax ? undefined : { y: parallaxY }}
            >
              {media}
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}

export default Hero;
