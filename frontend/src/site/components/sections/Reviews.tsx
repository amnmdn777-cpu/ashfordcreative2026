import React, { useState } from "react";
import { Quote, Star } from "lucide-react";
import type { Review } from "@site/templates/types";

interface ReviewsProps {
  reviews: Review[];
  heading?: React.ReactNode;
  /** Cap the number rendered (default 3). */
  max?: number;
  className?: string;
}

// Founder feedback 2026-05-19: cards truncate at ~280 chars + Read more,
// equal-height columns, horizontal snap-scroll carousel on mobile.
const PREVIEW_CHARS = 280;

function ReviewCard({ r }: { r: Review }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = (r.body ?? "").length > PREVIEW_CHARS;
  const shown = expanded || !isLong ? r.body : r.body.slice(0, PREVIEW_CHARS).trimEnd() + "…";
  return (
    <figure
      className="snap-center shrink-0 w-[88%] sm:w-auto sm:shrink p-6 flex flex-col gap-4"
      style={{
        backgroundColor: "var(--color-surface-soft)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <Quote className="w-5 h-5 opacity-30" aria-hidden />
      <blockquote className="text-sm leading-relaxed italic" style={{ color: "var(--color-text)", fontFamily: "var(--font-body)" }}>
        "{shown}"
      </blockquote>
      {isLong ? (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="self-start text-[11px] uppercase tracking-[0.18em] font-medium" style={{ color: "var(--color-accent)" }}>
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}
      <figcaption className="text-xs uppercase tracking-[0.2em] mt-auto" style={{ color: "var(--color-text-muted)" }}>
        {r.author}
        {r.source && ` · ${r.source}`}
      </figcaption>
    </figure>
  );
}

/**
 * Themed reviews block. Owned per-template via the section primitives
 * library; replaced the bespoke per-template review markup that used
 * to live inside the now-deleted <TemplateDefaults> wrapper. Slim
 * card grid; the heavier aggregate-card / office-tour / map block
 * is no longer surfaced — re-add as separate primitives if a future
 * template needs them.
 */
export function Reviews({ reviews, heading, max = 3, className = "" }: ReviewsProps) {
  if (!reviews || reviews.length === 0) return null;
  const shown = reviews.slice(0, max);
  const avg =
    reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.length;
  const rounded = Math.round(avg * 10) / 10;

  return (
    <section
      className={`relative w-full py-20 md:py-28 px-6 md:px-12 ${className}`}
      style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)" }}
    >
      <div className="relative max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
          <h2
            className="text-3xl md:text-4xl leading-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {heading ?? "What patients say"}
          </h2>
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", color: "var(--color-text)" }}>
              {rounded.toFixed(1)}
            </span>
            <span className="inline-flex" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className="w-4 h-4"
                  fill={i < Math.round(avg) ? "currentColor" : "transparent"}
                  style={{ color: "var(--color-accent)" }}
                />
              ))}
            </span>
            <span>· {reviews.length}</span>
          </div>
        </div>

        <div className="flex sm:grid sm:grid-cols-3 gap-6 overflow-x-auto sm:overflow-visible snap-x snap-mandatory -mx-6 sm:mx-0 px-6 sm:px-0 pb-2 sm:pb-0">
          {shown.map((r, i) => (
            <ReviewCard key={i} r={r} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default Reviews;
