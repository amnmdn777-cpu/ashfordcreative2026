import React, { type ReactNode } from "react";
import { ArrowRight } from "lucide-react";

export type BookingMode = "calendar" | "external" | "intake" | "phone";

interface BookingCtaProps {
  /** "calendar" → embed iframe; "external" → button to URL;
   *  "intake" → button to intake-form route; "phone" → tel: link. */
  mode: BookingMode;
  /** URL for external/intake; phone number for phone; iframe src for calendar. */
  href: string;
  label: ReactNode;
  /** Section heading shown above the action. */
  heading?: ReactNode;
  /** Subhead under the heading. */
  subhead?: ReactNode;
  /** Optional secondary action (e.g. "Or call us"). */
  secondary?: ReactNode;
  /** Optional decorative slot for skin chrome. */
  decoration?: ReactNode;
  className?: string;
}

export function BookingCta({
  mode,
  href,
  label,
  heading,
  subhead,
  secondary,
  decoration,
  className = "",
}: BookingCtaProps) {
  const isExternal = mode === "external" || mode === "calendar";
  const linkProps = isExternal
    ? { target: "_blank" as const, rel: "noopener noreferrer" }
    : {};

  return (
    <section
      className={`relative w-full py-20 md:py-24 px-6 md:px-12 ${className}`}
      style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)" }}
    >
      {decoration}
      <div className="relative max-w-3xl mx-auto text-center">
        {heading && (
          <h2
            className="text-3xl md:text-4xl mb-4 leading-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {heading}
          </h2>
        )}
        {subhead && (
          <p
            className="text-base mb-8"
            style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-body)" }}
          >
            {subhead}
          </p>
        )}

        {mode === "calendar" ? (
          <div
            className="w-full overflow-hidden"
            style={{ borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-md)" }}
          >
            <iframe
              src={href}
              title="Booking calendar"
              loading="lazy"
              className="w-full h-[640px] border-0"
            />
          </div>
        ) : (
          <a
            href={href}
            {...linkProps}
            className="inline-flex items-center justify-center gap-2 h-12 px-8 text-sm uppercase tracking-[0.2em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              backgroundColor: "var(--color-primary)",
              color: "var(--color-surface-soft)",
              borderRadius: "var(--radius-sm)",
              fontFamily: "var(--font-body)",
            }}
          >
            {label}
            <ArrowRight className="w-4 h-4" aria-hidden />
          </a>
        )}

        {secondary && (
          <div className="mt-6 text-sm" style={{ color: "var(--color-text-muted)" }}>
            {secondary}
          </div>
        )}
      </div>
    </section>
  );
}

export default BookingCta;
