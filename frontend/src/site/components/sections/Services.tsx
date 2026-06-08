import React, { type ReactNode } from "react";
import { motion } from "framer-motion";
import { useScrollReveal } from "@site/hooks/motion";

export interface ServiceItem {
  title: string;
  body: string;
  icon?: ReactNode;
}

interface ServicesProps {
  heading?: ReactNode;
  subhead?: ReactNode;
  items: ServiceItem[];
  /** 2 or 3 columns at md+. Default 3. */
  columns?: 2 | 3;
  /** Optional decorative slot rendered behind the grid. */
  decoration?: ReactNode;
  className?: string;
}

export function Services({
  heading,
  subhead,
  items,
  columns = 3,
  decoration,
  className = "",
}: ServicesProps) {
  const reveal = useScrollReveal<HTMLDivElement>();

  return (
    <section
      className={`relative w-full py-20 md:py-28 px-6 md:px-12 ${className}`}
      style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)" }}
    >
      {decoration}
      <div className="relative max-w-6xl mx-auto">
        {(heading || subhead) && (
          <div className="text-center mb-16 max-w-2xl mx-auto">
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
                className="text-base"
                style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-body)" }}
              >
                {subhead}
              </p>
            )}
          </div>
        )}

        <motion.div
          ref={reveal.ref}
          {...reveal.motionProps}
          className={`grid ${columns === 2 ? "md:grid-cols-2" : "md:grid-cols-3"} gap-6`}
        >
          {items.map((item, i) => (
            <article
              key={i}
              className="p-8 flex flex-col gap-4 transition-shadow duration-300 hover:shadow-lg"
              style={{
                backgroundColor: "var(--color-surface-soft)",
                color: "var(--color-text)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {item.icon && (
                <div style={{ color: "var(--color-text-muted)" }}>{item.icon}</div>
              )}
              <h3
                className="text-xl leading-snug"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {item.title}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-body)" }}
              >
                {item.body}
              </p>
            </article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

export default Services;
