import React from "react";
import { Quote } from "lucide-react";

/**
 * Homepage testimonials section — DISTINCT from the Google reviews
 * primitive. These are hand-curated quotes lifted from the prospect's
 * own site (`previewContent.testimonials`). Renders nothing when no
 * testimonials are present.
 */
export interface HomepageTestimonial {
  author: string | null;
  body: string;
}

export interface HomepageTestimonialsProps {
  eyebrow: string;
  title: string;
  anonymousLabel: string;
  testimonials: HomepageTestimonial[];
  /** Cap rendered count (default 3). */
  max?: number;
}

export function HomepageTestimonials({
  eyebrow,
  title,
  anonymousLabel,
  testimonials,
  max = 3,
}: HomepageTestimonialsProps) {
  if (!testimonials || testimonials.length === 0) return null;
  const shown = testimonials.slice(0, max);
  return (
    <section
      className="w-full px-6 md:px-12 py-20 md:py-24"
      style={{
        backgroundColor: "var(--color-surface-soft, var(--color-surface))",
        color: "var(--color-text)",
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-1 mb-10">
          <span
            className="text-[11px] uppercase tracking-[0.22em]"
            style={{ color: "var(--color-text-muted)" }}
          >
            {eyebrow}
          </span>
          <h2
            className="text-3xl md:text-4xl leading-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {title}
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {shown.map((t, i) => (
            <figure
              key={i}
              className="p-6 flex flex-col gap-4"
              style={{
                backgroundColor: "var(--color-surface)",
                borderRadius: "var(--radius-md, 12px)",
                boxShadow: "var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))",
              }}
            >
              <Quote className="w-5 h-5 opacity-30" aria-hidden />
              <blockquote
                className="text-sm leading-relaxed italic"
                style={{ fontFamily: "var(--font-body)" }}
              >
                &ldquo;{t.body}&rdquo;
              </blockquote>
              <figcaption
                className="text-xs uppercase tracking-[0.2em] mt-auto"
                style={{ color: "var(--color-text-muted)" }}
              >
                {t.author && t.author.trim().length > 0
                  ? t.author
                  : anonymousLabel}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HomepageTestimonials;
