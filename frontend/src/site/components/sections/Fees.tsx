import React, { type ReactNode } from "react";

export interface FeeItem {
  label: string;
  price: string;
  note?: string;
}

interface FeesProps {
  heading?: ReactNode;
  items: FeeItem[];
  /** Sliding-scale or insurance disclaimer rendered below the list. */
  note?: ReactNode;
  /** Right-rail content (e.g. <InsuranceBadges> from _wow). */
  aside?: ReactNode;
  className?: string;
}

export function Fees({ heading, items, note, aside, className = "" }: FeesProps) {
  return (
    <section
      className={`relative w-full py-20 md:py-24 px-6 md:px-12 ${className}`}
      style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)" }}
    >
      <div className="relative max-w-5xl mx-auto grid md:grid-cols-2 gap-12">
        <div>
          {heading && (
            <h2
              className="text-3xl md:text-4xl mb-8 leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {heading}
            </h2>
          )}
          <ul className="space-y-4" style={{ fontFamily: "var(--font-body)" }}>
            {items.map((item) => (
              <li
                key={item.label}
                className="flex items-end justify-between pb-3"
                style={{ borderBottom: "1px solid var(--color-accent)" }}
              >
                <span
                  className="text-xs uppercase tracking-[0.2em]"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {item.label}
                </span>
                <span
                  className="text-xl"
                  style={{ fontFamily: "var(--font-display)", color: "var(--color-text)" }}
                >
                  {item.price}
                </span>
              </li>
            ))}
          </ul>
          {note && (
            <p
              className="mt-6 text-sm italic"
              style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-body)" }}
            >
              {note}
            </p>
          )}
        </div>
        {aside && <div className="self-start">{aside}</div>}
      </div>
    </section>
  );
}

export default Fees;
