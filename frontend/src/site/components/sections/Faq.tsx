import React, { useState, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { usePrefersReducedMotion } from "@site/hooks/motion";

export interface FaqItem {
  q: string;
  a: string;
}

interface FaqProps {
  heading?: ReactNode;
  items: FaqItem[];
  className?: string;
}

export function Faq({ heading, items, className = "" }: FaqProps) {
  return (
    <section
      className={`relative w-full py-20 md:py-24 px-6 md:px-12 ${className}`}
      style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)" }}
    >
      <div className="relative max-w-3xl mx-auto">
        {heading && (
          <h2
            className="text-3xl md:text-4xl mb-10 leading-tight text-center"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {heading}
          </h2>
        )}
        <div className="divide-y" style={{ borderColor: "var(--color-accent)" }}>
          {items.map((item, i) => (
            <FaqRow key={i} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqRow({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);
  const reduced = usePrefersReducedMotion();
  return (
    <div
      className="py-4"
      style={{ borderTop: "1px solid var(--color-accent)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 text-left py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{ color: "var(--color-text)", fontFamily: "var(--font-body)" }}
      >
        <span className="text-base md:text-lg" style={{ fontFamily: "var(--font-display)" }}>
          {item.q}
        </span>
        {open ? (
          <Minus className="w-4 h-4 shrink-0" aria-hidden />
        ) : (
          <Plus className="w-4 h-4 shrink-0" aria-hidden />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.25 }}
            className="overflow-hidden"
          >
            <p
              className="py-3 text-sm leading-relaxed"
              style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-body)" }}
            >
              {item.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Faq;
