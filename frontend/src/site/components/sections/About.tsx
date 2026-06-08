import React, { type ReactNode } from "react";
import { motion } from "framer-motion";
import { useScrollReveal } from "@site/hooks/motion";
import { ResponsivePicture } from "@site/components/photo/ResponsivePicture";

interface AboutProps {
  /** Practitioner photo URL or full ReactNode (for skinned frames). */
  photo: string | ReactNode;
  photoAlt?: string;
  name: string;
  credentials?: string;
  /** 1–N short paragraphs of intro copy. */
  body: string[];
  /** Optional pull-quote rendered to the side / below depending on layout. */
  quote?: { text: string; attribution?: string };
  /** Headline above the body. */
  heading?: ReactNode;
  /** Optional decorative slot (skin chrome — frame, signature). */
  decoration?: ReactNode;
  /** image-left | image-right swap. Default image-left. */
  imageSide?: "left" | "right";
  className?: string;
}

export function About({
  photo,
  photoAlt = "",
  name,
  credentials,
  body,
  quote,
  heading,
  decoration,
  imageSide = "left",
  className = "",
}: AboutProps) {
  const reveal = useScrollReveal<HTMLDivElement>();

  // String photos with a file extension render as a bare <img> (legacy,
  // including .svg placeholders). String photos WITHOUT an extension are
  // treated as the base path of an optimize-hero-photos.ts variant set
  // and routed through ResponsivePicture so the persona portrait picks
  // up the WebP@1x/2x + JPG fallback automatically.
  const photoNode =
    typeof photo === "string"
      ? /\.(jpe?g|png|webp|svg)$/i.test(photo) || photo === ""
        ? (
          <img
            src={photo}
            alt={photoAlt || name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )
        : (
          <ResponsivePicture
            src={photo}
            alt={photoAlt || name}
            className="w-full h-full object-cover"
          />
        )
      : photo;

  return (
    <section
      className={`relative w-full py-20 md:py-28 px-6 md:px-12 ${className}`}
      style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)" }}
    >
      {decoration}
      <div className="relative max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        <div
          className={`${imageSide === "right" ? "md:order-2" : ""} relative aspect-[3/4] max-w-md w-full mx-auto overflow-hidden`}
          style={{ borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-md)" }}
        >
          {photoNode}
        </div>

        <motion.div ref={reveal.ref} {...reveal.motionProps}>
          {heading && (
            <h2
              className="text-3xl md:text-5xl mb-6 leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {heading}
            </h2>
          )}
          <div className="mb-3">
            <div className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
              {name}
            </div>
            {credentials && (
              <div
                className="text-xs uppercase tracking-[0.2em] mt-1"
                style={{ color: "var(--color-text-muted)" }}
              >
                {credentials}
              </div>
            )}
          </div>
          <div
            className="space-y-4 text-base leading-relaxed"
            style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-body)" }}
          >
            {body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {quote && (
            <blockquote
              className="mt-8 pl-4 border-l-2 italic text-lg leading-snug"
              style={{
                borderColor: "var(--color-accent)",
                color: "var(--color-text)",
                fontFamily: "var(--font-display)",
              }}
            >
              "{quote.text}"
              {quote.attribution && (
                <footer
                  className="mt-2 text-xs not-italic uppercase tracking-[0.2em]"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  — {quote.attribution}
                </footer>
              )}
            </blockquote>
          )}
        </motion.div>
      </div>
    </section>
  );
}

export default About;
