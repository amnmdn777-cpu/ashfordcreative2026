import { useEffect, useRef, useState } from "react";
import { useScroll, useTransform, type MotionValue } from "framer-motion";

/**
 * Returns true when the user has `prefers-reduced-motion: reduce`
 * set at the OS level. Every other motion hook in this file checks
 * this value and returns a no-op variant when true; templates
 * therefore never need to special-case a11y themselves.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

interface ScrollRevealOptions {
  /** IntersectionObserver threshold; 0 = any pixel, 1 = fully visible. */
  threshold?: number;
  /** Delay (ms) applied to the framer-motion `transition.delay`. */
  delay?: number;
  /** Reveal once and then stop observing. Default true. */
  once?: boolean;
}

interface ScrollRevealResult<T extends HTMLElement> {
  ref: React.RefObject<T | null>;
  visible: boolean;
  /** Spread onto a framer-motion element: `<motion.div {...reveal.motionProps}>` */
  motionProps: {
    initial: { y: number };
    animate: { y: number };
    transition: { duration: number; delay: number; ease: "easeOut" };
  };
}

/**
 * IntersectionObserver-based fade-and-slide reveal. Returns a ref
 * to attach to the element + the visibility flag + ready-made
 * framer-motion props.
 *
 * When the user prefers reduced motion the transition collapses to
 * 0ms and the element starts already visible — no fade-in, no slide.
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options: ScrollRevealOptions = {},
): ScrollRevealResult<T> {
  const { threshold = 0.15, delay = 0, once = true } = options;
  const reduced = usePrefersReducedMotion();
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState<boolean>(reduced);

  useEffect(() => {
    if (reduced) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) obs.disconnect();
          } else if (!once) {
            setVisible(false);
          }
        }
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reduced, threshold, once]);

  // Opacity removed from the reveal entirely (PR #33). PR #32's
  // `opacity:1 unconditional` fix still depended on framer-motion
  // running its transition; observed prod regression where Garden's
  // hero rendered with NO text at all suggested some IO-fed callsites
  // were stuck at `opacity:0` mid-transition because the initial=0
  // animate=1 transition didn't fire reliably on every browser. With
  // opacity stripped from the returned props, the element starts and
  // stays at its CSS-declared opacity (1 by default) and only `y`
  // animates the slide-up entrance. Templates that genuinely want a
  // fade can opt in at the call site.
  return {
    ref,
    visible,
    motionProps: {
      initial: { y: reduced ? 0 : 24 },
      animate: { y: visible ? 0 : 24 },
      transition: {
        duration: reduced ? 0 : 0.7,
        delay: reduced ? 0 : delay / 1000,
        ease: "easeOut" as const,
      },
    },
  };
}

/**
 * Subtle Y-translate driven by document scroll progress. Returns a
 * MotionValue that callers spread onto a `<motion.div style={{ y }}>`.
 *
 * `strength` is the maximum pixel offset at scrollYProgress=1.
 * Reduced-motion users get a constant 0 MotionValue.
 */
export function useHeroParallax(strength: number = 80): MotionValue<number> {
  const reduced = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : strength]);
  return y;
}
