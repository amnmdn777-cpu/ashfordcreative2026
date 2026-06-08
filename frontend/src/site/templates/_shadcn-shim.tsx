import React, { useState, type ReactNode, type ButtonHTMLAttributes, type HTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Minimal shadcn/ui-shaped shims used by the canvas-port templates so the
 * mockup JSX can be lifted verbatim without depending on the full shadcn
 * scaffolding. Only the exact APIs the 6 ported mockups rely on are mirrored.
 */

type AnyVariant = string | undefined;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: AnyVariant;
  size?: AnyVariant;
  asChild?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { children, className = "", variant: _v, size: _s, asChild: _a, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      {...props}
      className={`inline-flex items-center justify-center cursor-pointer transition-colors disabled:pointer-events-none disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
});

export const Card = React.forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function Card(
  { children, className = "", ...props },
  ref,
) {
  return (
    <div ref={ref} {...props} className={className}>
      {children}
    </div>
  );
});

export const CardContent = React.forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function CardContent(
  { children, className = "", ...props },
  ref,
) {
  return (
    <div ref={ref} {...props} className={className}>
      {children}
    </div>
  );
});

type BadgeProps = HTMLAttributes<HTMLSpanElement> & { variant?: AnyVariant };
export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { children, className = "", variant: _v, ...props },
  ref,
) {
  return (
    <span ref={ref} {...props} className={`inline-flex items-center ${className}`}>
      {children}
    </span>
  );
});

type SeparatorProps = HTMLAttributes<HTMLDivElement> & { orientation?: "horizontal" | "vertical" };
export const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(function Separator(
  { className = "", orientation = "horizontal", ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      role="separator"
      {...props}
      className={`shrink-0 bg-current ${orientation === "vertical" ? "w-px h-full" : "h-px w-full"} ${className}`}
    />
  );
});

/* ── Accordion: per-item local state, mirrors shadcn API ───────────────── */
const AccordionContext = React.createContext<{ open: boolean; toggle: () => void } | null>(null);

type AccordionRootProps = {
  children: ReactNode;
  className?: string;
  type?: "single" | "multiple";
  collapsible?: boolean;
};
export const Accordion = ({ children, className = "" }: AccordionRootProps) => (
  <div className={className}>{children}</div>
);

type AccordionItemProps = {
  children: ReactNode;
  className?: string;
  value?: string;
  defaultOpen?: boolean;
};
export const AccordionItem = ({ children, className = "", defaultOpen = false }: AccordionItemProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = () => setOpen((v) => !v);
  return (
    <AccordionContext.Provider value={{ open, toggle }}>
      <div className={className} data-state={open ? "open" : "closed"}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
};

type AccordionTriggerProps = {
  children: ReactNode;
  className?: string;
};
export const AccordionTrigger = ({ children, className = "" }: AccordionTriggerProps) => {
  const ctx = React.useContext(AccordionContext);
  return (
    <button
      type="button"
      onClick={() => ctx?.toggle()}
      aria-expanded={ctx?.open}
      className={`w-full flex items-center justify-between text-left cursor-pointer ${className}`}
    >
      <span className="flex-1">{children}</span>
      <ChevronDown
        className={`w-4 h-4 shrink-0 transition-transform duration-200 ml-3 ${ctx?.open ? "rotate-180" : ""}`}
      />
    </button>
  );
};

type AccordionContentProps = {
  children: ReactNode;
  className?: string;
};
export const AccordionContent = ({ children, className = "" }: AccordionContentProps) => {
  const ctx = React.useContext(AccordionContext);
  if (!ctx?.open) return null;
  return <div className={className}>{children}</div>;
};
