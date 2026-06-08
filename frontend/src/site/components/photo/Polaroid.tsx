import React, { type ReactNode } from "react";

/**
 * Shared polaroid-photo framing primitive. Originally lived inside
 * `src/templates/polaroid/skin.tsx` as a private MaskingTape + figure
 * pair; extracted here so Hello Friend can re-use the masking-tape
 * edge utility without copying the implementation.
 *
 * The framing is opinion-free at the palette level (consumes
 * --color-surface-soft for the paper, --color-secondary for the
 * tape) so any template skin can drop it in.
 */

export type TapePosition = "top-left" | "top-right" | "top-center" | "bottom-left";

const TAPE_POS: Record<TapePosition, React.CSSProperties> = {
  "top-left": { top: -8, left: -10 },
  "top-right": { top: -8, right: -10 },
  "top-center": { top: -10, left: "50%", marginLeft: -36 },
  "bottom-left": { bottom: -6, left: 16 },
};

export interface TapeMark { position: TapePosition; rotate: number }

interface MaskingTapeProps extends TapeMark {
  width?: number;
}

export function MaskingTape({ position, rotate, width = 72 }: MaskingTapeProps) {
  return (
    <span
      aria-hidden
      className="absolute"
      style={{
        ...TAPE_POS[position],
        width,
        height: 22,
        background: "color-mix(in srgb, var(--color-secondary) 80%, transparent)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
        transform: `rotate(${rotate}deg)`,
      }}
    />
  );
}

interface PolaroidFrameProps {
  /** Tilt of the entire polaroid card in degrees. */
  rotate?: number;
  /** Width of the polaroid card in pixels. Default 240. */
  width?: number;
  /** Pixel height of the photo well (the dark area before the white border).
   *  Default 200. Aspect ratios > 1:1 read as portrait. */
  photoHeight?: number;
  /** Masking-tape decorations rendered on top of the card. */
  tape?: TapeMark[];
  /** Caption rendered in Caveat script across the bottom of the card. */
  caption?: ReactNode;
  /** The actual photo content — usually an <img>. */
  children: ReactNode;
  className?: string;
}

/**
 * A single tilted polaroid card. Composes the white paper frame, an
 * inner photo well, optional masking-tape edges, and an optional
 * Caveat-script caption. No layout/positioning — callers wrap it in
 * whatever container they need.
 */
export function PolaroidFrame({
  rotate = 0,
  width = 240,
  photoHeight = 200,
  tape,
  caption,
  children,
  className = "",
}: PolaroidFrameProps) {
  return (
    <figure
      className={`relative bg-white p-3 pb-12 shadow-xl ${className}`}
      style={{ width, transform: `rotate(${rotate}deg)` }}
    >
      {tape?.map((t, i) => (
        <MaskingTape key={i} position={t.position} rotate={t.rotate} />
      ))}
      <div
        className="w-full overflow-hidden"
        style={{ height: photoHeight, backgroundColor: "var(--color-secondary)" }}
      >
        {children}
      </div>
      {caption && (
        <figcaption
          className="absolute bottom-2 left-0 right-0 text-center text-lg"
          style={{ fontFamily: "'Caveat', cursive", color: "var(--color-text)" }}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
