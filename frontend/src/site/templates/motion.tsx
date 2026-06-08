import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Shared "wow factor" motion primitives reused across the 5 site templates.
 * Each helper degrades gracefully when the visitor has
 * `prefers-reduced-motion` set: animations collapse to static reveals so the
 * pages stay legible and never block scroll.
 */

/**
 * `?bare=1` short-circuits *all* deferred animations across the templates
 * (admin audit thumbnails capture screenshots in this mode and need the
 * final pixels rendered immediately, not after a 1.4s ease-out). Same
 * gate is used in WellnessCenter doors; consolidating the read here so
 * every kinetic component picks it up automatically.
 *
 * SSR-safe: returns `false` when `window` is undefined.
 */
const isBareCaptureMode = (): boolean => {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("bare") === "1";
};

/** Animate a number from 0 → target on first scroll-into-view. Returns the
 * current displayed string (formatter applied). With reduced motion OR
 * `?bare=1` (audit screenshot mode), jumps straight to the formatted final
 * value with no animation. */
export function useCountUp(
  target: number,
  opts?: {
    durationMs?: number;
    decimals?: number;
    formatter?: (n: number) => string;
  },
): { ref: React.RefObject<HTMLDivElement | null>; value: string; progress: MotionValue<number> } {
  const reduced = useReducedMotion();
  // `?bare=1` is treated as "reduced motion" for the count-up specifically:
  // the audit screenshot pipeline needs the final value visible at capture
  // time, not a 0 mid-tween. Read once at hook init — bare mode is a URL
  // param, not a runtime preference, so it never changes within a session.
  const bare = isBareCaptureMode();
  const skipAnimation = reduced || bare;
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const decimals = opts?.decimals ?? 0;
  const fmt =
    opts?.formatter ??
    ((n: number) => n.toLocaleString(undefined, { maximumFractionDigits: decimals }));
  const [value, setValue] = useState<string>(fmt(skipAnimation ? target : 0));
  const progress = useMotionValue(skipAnimation ? 1 : 0);

  useEffect(() => {
    if (!inView) return;
    if (skipAnimation) {
      setValue(fmt(target));
      progress.set(1);
      return;
    }
    const duration = opts?.durationMs ?? 1400;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const v = target * eased;
      setValue(fmt(decimals === 0 ? Math.round(v) : Number(v.toFixed(decimals))));
      progress.set(eased);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, target, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  return { ref, value, progress };
}

/** A scroll-triggered, motion-reduced number with an underline progress bar. */
export function KineticStat({
  target,
  suffix = "",
  prefix = "",
  decimals = 0,
  label,
  className,
  valueClassName,
  labelClassName,
}: {
  target: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  label: string;
  className?: string;
  valueClassName?: string;
  labelClassName?: string;
}) {
  const { ref, value, progress } = useCountUp(target, { decimals });
  const width = useTransform(progress, (p) => `${Math.round(p * 100)}%`);
  return (
    <div ref={ref} className={className}>
      <div className={valueClassName}>
        {prefix}
        {value}
        {suffix}
      </div>
      <motion.div
        aria-hidden
        className="h-[2px] mt-2 origin-left"
        style={{ background: "currentColor", width, opacity: 0.55 }}
      />
      <div className={labelClassName}>{label}</div>
    </div>
  );
}

/** Bands of color that slide up to reveal the next section. Useful as
 * inter-section transitions. Renders nothing under reduced motion. */
export function BandReveal({
  color = "var(--p-primary)",
  height = 24,
  delay = 0,
  className,
}: {
  color?: string;
  height?: number;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <motion.div
      aria-hidden
      initial={{ scaleY: 1, transformOrigin: "bottom" }}
      whileInView={{ scaleY: 0 }}
      viewport={{ once: true, margin: "-20%" }}
      transition={{ duration: 0.7, ease: [0.65, 0, 0.35, 1], delay }}
      className={className}
      style={{ background: color, height, transformOrigin: "bottom" }}
    />
  );
}

/** Word-by-word stagger reveal — drops in each word as it scrolls into view. */
export function WordReveal({
  text,
  className,
  style,
  perWordDelay = 0.04,
}: {
  text: string;
  className?: string;
  style?: CSSProperties;
  perWordDelay?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) {
    return (
      <p className={className} style={style}>
        {text}
      </p>
    );
  }
  const words = text.split(/(\s+)/);
  return (
    <p className={className} style={style}>
      {words.map((w, i) =>
        /^\s+$/.test(w) ? (
          <span key={i}>{w}</span>
        ) : (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20px" }}
            transition={{ duration: 0.5, delay: i * perWordDelay, ease: [0.16, 1, 0.3, 1] }}
            className="inline-block"
          >
            {w}
          </motion.span>
        ),
      )}
    </p>
  );
}

/** Sticky compact CTA pill that appears after the visitor scrolls past
 * `triggerPx`. Rendered as a fixed-bottom button. Mirrors the "Book this
 * week" CTA style across templates while keeping per-template colors.
 *
 * Hidden under reduced motion to avoid late-arriving distractions. */
export function StickyCompactCta({
  href,
  label,
  triggerPx = 800,
  background = "var(--p-primary)",
  color = "var(--p-surface)",
}: {
  href: string;
  label: ReactNode;
  triggerPx?: number;
  background?: string;
  color?: string;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (reduced) return;
    const onScroll = () => setShown(window.scrollY > triggerPx);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [reduced, triggerPx]);
  if (reduced) return null;
  return (
    <motion.a
      href={href}
      initial={false}
      animate={shown ? { y: 0, opacity: 1 } : { y: 80, opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="fixed left-1/2 -translate-x-1/2 bottom-5 z-40 px-5 py-3 rounded-full text-sm font-semibold shadow-lg pointer-events-auto"
      style={{ background, color }}
    >
      {label}
    </motion.a>
  );
}

/** Simple cross-fade carousel — useful for review slides where slide-in
 * feels too abrupt. Auto-advances every `intervalMs`; pauses if the user
 * has reduced-motion (no auto-advance, just shows the first slide). */
export function CrossFadeCarousel({
  slides,
  intervalMs = 6000,
  className,
  style,
}: {
  slides: ReactNode[];
  intervalMs?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const reduced = useReducedMotion();
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (reduced || slides.length <= 1) return;
    const t = window.setInterval(
      () => setIdx((i) => (i + 1) % slides.length),
      intervalMs,
    );
    return () => window.clearInterval(t);
  }, [reduced, slides.length, intervalMs]);
  return (
    <div className={`relative ${className ?? ""}`} style={style}>
      {slides.map((s, i) => (
        <motion.div
          key={i}
          initial={false}
          animate={{ opacity: i === idx ? 1 : 0 }}
          transition={{ duration: reduced ? 0 : 1.4, ease: "easeInOut" }}
          className="absolute inset-0"
          aria-hidden={i !== idx}
          style={{ pointerEvents: i === idx ? "auto" : "none" }}
        >
          {s}
        </motion.div>
      ))}
      {/* Dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`Slide ${i + 1}`}
              className="w-2 h-2 rounded-full transition-opacity"
              style={{
                background: "currentColor",
                opacity: i === idx ? 0.95 : 0.3,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
